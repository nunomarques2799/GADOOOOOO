-- ==================================================================
-- Gestão de Gado — painel do superadmin (v2)
-- ==================================================================
-- Reescreve o schema_superadmin.sql: agora usa RPCs SECURITY DEFINER
-- em vez de views, para contornar o problema de RLS em `auth.users`
-- (que os clientes normais não podem ler). Cada função valida
-- `public.eh_superadmin()` no topo.
--
-- Novo:
--   - Histórico de subscrições (`subscricao_evento`), com trigger que
--     regista cada alteração à subscrição atual.
--   - Métricas mensais: MRR, novos, cancelamentos, churn rate.
--   - RPCs de drill-down (terrenos/animais/eventos por exploração).
--
-- Aplica em cima de schema.sql + schema_roles.sql. Idempotente.
-- ==================================================================

do $$ begin
  create type public.estado_subscricao as enum ('trial', 'ativa', 'atrasada', 'cancelada');
exception when duplicate_object then null; end $$;

-- ---- Subscrição corrente ----
create table if not exists public.subscricao (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plano text not null default 'Basico',
  preco_mensal numeric(10, 2) not null default 0,
  estado public.estado_subscricao not null default 'trial',
  iniciada_em timestamptz default now(),
  proxima_cobranca timestamptz,
  notas text,
  atualizada_em timestamptz default now()
);

alter table public.subscricao enable row level security;

drop policy if exists subscricao_superadmin_all on public.subscricao;
create policy subscricao_superadmin_all on public.subscricao
  for all using (public.eh_superadmin()) with check (public.eh_superadmin());

drop policy if exists subscricao_self_read on public.subscricao;
create policy subscricao_self_read on public.subscricao
  for select using (auth.uid() = user_id);

-- ---- Histórico de eventos de subscrição ----
-- Cada mudança relevante (novo plano, mudança de preço, mudança de estado)
-- gera uma linha. É o log usado para calcular MRR mensal e churn.
create table if not exists public.subscricao_evento (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  em timestamptz not null default now(),
  tipo text not null check (tipo in ('criado', 'atualizado', 'estado_mudou', 'preco_mudou', 'plano_mudou', 'eliminado')),
  plano text,
  preco_mensal numeric(10, 2),
  estado public.estado_subscricao,
  notas text
);

create index if not exists idx_sub_evento_user on public.subscricao_evento (user_id);
create index if not exists idx_sub_evento_em on public.subscricao_evento (em);

alter table public.subscricao_evento enable row level security;

drop policy if exists sub_evento_superadmin on public.subscricao_evento;
create policy sub_evento_superadmin on public.subscricao_evento
  for all using (public.eh_superadmin()) with check (public.eh_superadmin());

-- Trigger que popula o histórico automaticamente.
create or replace function public.log_subscricao()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.subscricao_evento (user_id, tipo, plano, preco_mensal, estado, notas)
    values (new.user_id, 'criado', new.plano, new.preco_mensal, new.estado, new.notas);
  elsif tg_op = 'UPDATE' then
    if old.estado is distinct from new.estado then
      insert into public.subscricao_evento (user_id, tipo, plano, preco_mensal, estado, notas)
      values (new.user_id, 'estado_mudou', new.plano, new.preco_mensal, new.estado, new.notas);
    elsif old.preco_mensal is distinct from new.preco_mensal then
      insert into public.subscricao_evento (user_id, tipo, plano, preco_mensal, estado, notas)
      values (new.user_id, 'preco_mudou', new.plano, new.preco_mensal, new.estado, new.notas);
    elsif old.plano is distinct from new.plano then
      insert into public.subscricao_evento (user_id, tipo, plano, preco_mensal, estado, notas)
      values (new.user_id, 'plano_mudou', new.plano, new.preco_mensal, new.estado, new.notas);
    else
      insert into public.subscricao_evento (user_id, tipo, plano, preco_mensal, estado, notas)
      values (new.user_id, 'atualizado', new.plano, new.preco_mensal, new.estado, new.notas);
    end if;
  elsif tg_op = 'DELETE' then
    insert into public.subscricao_evento (user_id, tipo, plano, preco_mensal, estado, notas)
    values (old.user_id, 'eliminado', old.plano, old.preco_mensal, old.estado, old.notas);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_log_subscricao on public.subscricao;
create trigger trg_log_subscricao
  after insert or update or delete on public.subscricao
  for each row execute function public.log_subscricao();

-- ==================================================================
-- RPCs — todas verificam eh_superadmin() no topo
-- ==================================================================

-- ---- Listar todos os clientes com stats ----
create or replace function public.superadmin_listar_clientes()
returns table (
  user_id uuid,
  nome text,
  email text,
  telefone text,
  nif text,
  estado text,
  registado_em timestamptz,
  n_exploracoes bigint,
  n_terrenos bigint,
  n_animais bigint,
  plano text,
  preco_mensal numeric,
  estado_subscricao public.estado_subscricao,
  proxima_cobranca timestamptz
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'sem permissão';
  end if;
  return query
    select
      p.id,
      coalesce(p.nome, '(sem nome)'),
      u.email::text,
      p.telefone,
      p.nif,
      p.estado,
      u.created_at,
      coalesce(exp_stats.n_exploracoes, 0)::bigint,
      coalesce(ter_stats.n_terrenos, 0)::bigint,
      coalesce(ani_stats.n_animais, 0)::bigint,
      s.plano,
      s.preco_mensal,
      s.estado,
      s.proxima_cobranca
    from public.perfil p
    join auth.users u on u.id = p.id
    left join (
      select m.user_id, count(distinct e.id) as n_exploracoes
      from public.membro_exploracao m
      join public.exploracao e on e.id = m.exploracao_id
      where m.role = 'admin'
      group by m.user_id
    ) exp_stats on exp_stats.user_id = p.id
    left join (
      select m.user_id, count(t.id) as n_terrenos
      from public.membro_exploracao m
      join public.terreno t on t.exploracao_id = m.exploracao_id
      where m.role = 'admin'
      group by m.user_id
    ) ter_stats on ter_stats.user_id = p.id
    left join (
      select m.user_id, count(a.id) as n_animais
      from public.membro_exploracao m
      join public.animal a on a.exploracao_id = m.exploracao_id
      where m.role = 'admin'
      group by m.user_id
    ) ani_stats on ani_stats.user_id = p.id
    left join public.subscricao s on s.user_id = p.id
    where not p.is_superadmin
      and (
        -- candidato a cliente: ainda não tem membros (nunca resgatou convite)
        not exists (select 1 from public.membro_exploracao m where m.user_id = p.id)
        -- ou é admin de alguma exploração (criou as suas próprias)
        or exists (select 1 from public.membro_exploracao m where m.user_id = p.id and m.role = 'admin')
      )
    order by u.created_at desc;
end;
$$;

-- ---- Obter um cliente específico ----
create or replace function public.superadmin_obter_cliente(alvo uuid)
returns table (
  user_id uuid, nome text, email text, telefone text, nif text,
  estado text, registado_em timestamptz,
  n_exploracoes bigint, n_terrenos bigint, n_animais bigint,
  plano text, preco_mensal numeric,
  estado_subscricao public.estado_subscricao, proxima_cobranca timestamptz
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select * from public.superadmin_listar_clientes() c where c.user_id = alvo;
end;
$$;

-- ---- Explorações dum cliente ----
create or replace function public.superadmin_exploracoes_cliente(alvo uuid)
returns table (
  id text, nome text, marca_exploracao text, nif_detentor text, localizacao text,
  n_terrenos bigint, n_animais bigint
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select
      e.id, e.nome, e.marca_exploracao, e.nif_detentor, e.localizacao,
      coalesce((select count(*) from public.terreno t where t.exploracao_id = e.id), 0)::bigint,
      coalesce((select count(*) from public.animal a where a.exploracao_id = e.id), 0)::bigint
    from public.exploracao e
    join public.membro_exploracao m on m.exploracao_id = e.id and m.role = 'admin'
    where m.user_id = alvo
    order by e.nome;
end;
$$;

-- ---- Terrenos duma exploração ----
create or replace function public.superadmin_terrenos_exploracao(exp_id text)
returns setof public.terreno
language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query select * from public.terreno where exploracao_id = exp_id order by nome;
end;
$$;

-- ---- Animais duma exploração ----
create or replace function public.superadmin_animais_exploracao(exp_id text)
returns setof public.animal
language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query select * from public.animal where exploracao_id = exp_id order by nome nulls last;
end;
$$;

-- ---- Eventos dum animal ----
create or replace function public.superadmin_eventos_animal(ani_id text)
returns setof public.evento
language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query select * from public.evento where animal_id = ani_id order by data desc;
end;
$$;

-- ---- Histórico de subscrição dum cliente ----
create or replace function public.superadmin_historico_subscricao(alvo uuid)
returns table (
  id uuid, em timestamptz, tipo text,
  plano text, preco_mensal numeric, estado public.estado_subscricao, notas text
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select se.id, se.em, se.tipo, se.plano, se.preco_mensal, se.estado, se.notas
    from public.subscricao_evento se
    where se.user_id = alvo
    order by se.em desc;
end;
$$;

-- ---- Métricas mensais dos últimos N meses ----
-- Para cada mês devolve:
--   mrr        — soma do preço mensal das subscrições ATIVAS no final do mês
--   novos      — clientes que se tornaram ativos nesse mês (evento 'criado' ou
--                'estado_mudou' para 'ativa' pela primeira vez nesse mês)
--   cancelados — clientes que passaram a 'cancelada' nesse mês
--   churn_rate — cancelados / (ativos no início do mês) * 100
create or replace function public.superadmin_metricas_mensais(meses int default 6)
returns table (
  mes date,
  mrr numeric,
  novos int,
  cancelados int,
  ativos_fim int,
  churn_rate numeric
) language plpgsql security definer set search_path = 'public' as $$
declare
  m date;
  fim_mes timestamptz;
  ini_mes timestamptz;
  ativos_ini int;
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  for m in
    select (date_trunc('month', current_date) - make_interval(months => i))::date
    from generate_series(0, greatest(meses - 1, 0)) i
    order by 1
  loop
    ini_mes := m::timestamptz;
    fim_mes := (m + interval '1 month')::timestamptz;

    -- Estado no fim do mês: para cada user, o evento mais recente <= fim_mes.
    with ultimo as (
      select distinct on (user_id) user_id, estado, preco_mensal
      from public.subscricao_evento
      where em < fim_mes
      order by user_id, em desc
    )
    select
      coalesce(sum(preco_mensal) filter (where estado = 'ativa'), 0),
      count(*) filter (where estado = 'ativa')::int
    into mrr, ativos_fim
    from ultimo;

    -- Ativos no início do mês (mesma técnica com em < ini_mes).
    with ultimo_ini as (
      select distinct on (user_id) user_id, estado
      from public.subscricao_evento
      where em < ini_mes
      order by user_id, em desc
    )
    select count(*) filter (where estado = 'ativa')::int into ativos_ini from ultimo_ini;

    -- Eventos DENTRO do mês.
    select count(*) into novos
    from public.subscricao_evento
    where em >= ini_mes and em < fim_mes
      and (tipo = 'criado' or (tipo = 'estado_mudou' and estado = 'ativa'));

    select count(*) into cancelados
    from public.subscricao_evento
    where em >= ini_mes and em < fim_mes
      and tipo = 'estado_mudou' and estado = 'cancelada';

    churn_rate := case
      when ativos_ini > 0 then round(cancelados::numeric / ativos_ini * 100, 1)
      else 0
    end;

    mes := m;
    return next;
  end loop;
end;
$$;

-- ==================================================================
-- RPC: superadmin cria/atualiza subscrição de um cliente.
-- ==================================================================
create or replace function public.superadmin_definir_subscricao(
  alvo uuid,
  novo_plano text,
  novo_preco numeric,
  novo_estado public.estado_subscricao,
  proxima timestamptz default null,
  notas_txt text default null
) returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'apenas o superadmin pode gerir subscrições';
  end if;
  insert into public.subscricao (user_id, plano, preco_mensal, estado, proxima_cobranca, notas)
  values (alvo, novo_plano, novo_preco, novo_estado, proxima, notas_txt)
  on conflict (user_id) do update set
    plano = excluded.plano,
    preco_mensal = excluded.preco_mensal,
    estado = excluded.estado,
    proxima_cobranca = excluded.proxima_cobranca,
    notas = excluded.notas,
    atualizada_em = now();
end;
$$;

grant execute on function public.superadmin_definir_subscricao(uuid, text, numeric, public.estado_subscricao, timestamptz, text) to authenticated;
grant execute on function public.superadmin_listar_clientes() to authenticated;
grant execute on function public.superadmin_obter_cliente(uuid) to authenticated;
grant execute on function public.superadmin_exploracoes_cliente(uuid) to authenticated;
grant execute on function public.superadmin_terrenos_exploracao(text) to authenticated;
grant execute on function public.superadmin_animais_exploracao(text) to authenticated;
grant execute on function public.superadmin_eventos_animal(text) to authenticated;
grant execute on function public.superadmin_historico_subscricao(uuid) to authenticated;
grant execute on function public.superadmin_metricas_mensais(int) to authenticated;
