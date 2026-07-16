-- ==================================================================
-- Gestão de Gado — correções de segurança e integridade (v4)
-- ==================================================================
-- Aplica em cima de schema.sql + schema_roles.sql + schema_superadmin.sql.
-- Idempotente (seguro para correr mais que uma vez).
--
-- O que corrige:
--   1. FUGA DE DADOS: a view `utilizadores_pendentes` juntava `auth.users`
--      (emails) e `perfil` (NIF/telefone) e NÃO era `security_invoker`, por
--      isso corria com privilégios do dono e IGNORAVA o RLS — qualquer
--      utilizador autenticado (mesmo um trabalhador) conseguia ler os dados
--      pessoais de todos os clientes pendentes. Substituída por um RPC
--      SECURITY DEFINER que valida `eh_superadmin()` no topo (mesmo padrão
--      já usado em schema_superadmin.sql).
--
--   2. INTEGRIDADE / RGPD: as tabelas de domínio não tinham foreign keys.
--      Apagar uma exploração deixava terrenos/animais/eventos órfãos na BD
--      (a cascata só existia no cliente), e como a linha de membro era
--      apagada, o RLS passava a bloquear esses registos — dados pessoais
--      "apagados" ficavam presos e inacessíveis para sempre. Adicionamos
--      FKs com ON DELETE CASCADE / SET NULL para que a cascata aconteça no
--      servidor. Antes de criar cada FK, limpamos os órfãos já existentes
--      (senão a criação da constraint falharia).
-- ==================================================================

-- ------------------------------------------------------------------
-- 1. RPC seguro que substitui a view `utilizadores_pendentes`
-- ------------------------------------------------------------------
create or replace function public.superadmin_listar_pendentes()
returns table (id uuid, nome text, email text, telefone text, nif text)
language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'sem permissão';
  end if;
  return query
    select p.id, p.nome, u.email::text, p.telefone, p.nif
    from public.perfil p
    join auth.users u on u.id = p.id
    where p.estado = 'pendente' and not p.is_superadmin
    order by u.created_at desc;
end;
$$;

grant execute on function public.superadmin_listar_pendentes() to authenticated;

-- Remover a view insegura (expunha auth.users a qualquer autenticado).
drop view if exists public.utilizadores_pendentes;

-- ------------------------------------------------------------------
-- 2. Limpeza de órfãos + foreign keys com cascata
-- ------------------------------------------------------------------
-- 2a. Apagar registos órfãos deixados por eliminações anteriores.
--     (ordem: eventos → animais → terrenos, para respeitar dependências)
delete from public.evento e
  where not exists (select 1 from public.animal a where a.id = e.animal_id);

delete from public.animal a
  where not exists (select 1 from public.exploracao x where x.id = a.exploracao_id);

delete from public.terreno t
  where not exists (select 1 from public.exploracao x where x.id = t.exploracao_id);

-- 2b. Anular referências "soltas" nas colunas opcionais (terreno/mãe/pai)
--     antes de criar as FKs com ON DELETE SET NULL.
update public.animal a set terreno_id = null
  where terreno_id is not null
    and not exists (select 1 from public.terreno t where t.id = a.terreno_id);

update public.animal a set mae_id = null
  where mae_id is not null
    and not exists (select 1 from public.animal m where m.id = a.mae_id);

update public.animal a set pai_id = null
  where pai_id is not null
    and not exists (select 1 from public.animal p where p.id = a.pai_id);

-- 2c. Criar as foreign keys (só se ainda não existirem).
do $$ begin
  -- terreno.exploracao_id → exploracao.id  (apagar exploração apaga terrenos)
  if not exists (select 1 from pg_constraint where conname = 'terreno_exploracao_fk') then
    alter table public.terreno
      add constraint terreno_exploracao_fk
      foreign key (exploracao_id) references public.exploracao (id) on delete cascade;
  end if;

  -- animal.exploracao_id → exploracao.id  (apagar exploração apaga animais)
  if not exists (select 1 from pg_constraint where conname = 'animal_exploracao_fk') then
    alter table public.animal
      add constraint animal_exploracao_fk
      foreign key (exploracao_id) references public.exploracao (id) on delete cascade;
  end if;

  -- animal.terreno_id → terreno.id  (apagar terreno só desassocia o animal)
  if not exists (select 1 from pg_constraint where conname = 'animal_terreno_fk') then
    alter table public.animal
      add constraint animal_terreno_fk
      foreign key (terreno_id) references public.terreno (id) on delete set null;
  end if;

  -- animal.mae_id / pai_id → animal.id  (apagar progenitor só limpa o vínculo)
  if not exists (select 1 from pg_constraint where conname = 'animal_mae_fk') then
    alter table public.animal
      add constraint animal_mae_fk
      foreign key (mae_id) references public.animal (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'animal_pai_fk') then
    alter table public.animal
      add constraint animal_pai_fk
      foreign key (pai_id) references public.animal (id) on delete set null;
  end if;

  -- evento.animal_id → animal.id  (apagar animal apaga o seu histórico)
  if not exists (select 1 from pg_constraint where conname = 'evento_animal_fk') then
    alter table public.evento
      add constraint evento_animal_fk
      foreign key (animal_id) references public.animal (id) on delete cascade;
  end if;
end $$;

-- 2d. Índices para as novas FKs (aceleram os joins e a cascata).
create index if not exists idx_terreno_exploracao on public.terreno (exploracao_id);
create index if not exists idx_animal_exploracao on public.animal (exploracao_id);
create index if not exists idx_animal_terreno on public.animal (terreno_id);

-- ------------------------------------------------------------------
-- 3. Bloquear a execução das funções SECURITY DEFINER a quem NÃO está
--    autenticado. O Postgres concede EXECUTE ao PUBLIC por omissão (inclui o
--    papel `anon`), e o linter do Supabase avisa disso. As funções já se
--    protegem por dentro (verificam auth.uid()/o papel), mas por boa prática
--    revogamos o PUBLIC e concedemos só a `authenticated`. Os triggers não
--    precisam de EXECUTE concedido a ninguém (disparam internamente).
-- ------------------------------------------------------------------
do $$
declare
  r record;
  triggers text[] := array['handle_new_user', 'handle_new_exploracao', 'log_subscricao'];
begin
  for r in
    select p.proname,
           format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    -- Ninguém deve chamar estas funções sem sessão iniciada. O Supabase dá
    -- EXECUTE ao `anon` explicitamente, por isso revogamos o `anon` diretamente
    -- (não basta revogar o PUBLIC).
    execute format('revoke execute on function %s from anon, public;', r.sig);
    if r.proname = any (triggers) then
      -- Triggers disparam internamente; não precisam de EXECUTE a ninguém.
      execute format('revoke execute on function %s from authenticated;', r.sig);
    else
      -- RPCs e helpers de RLS: só utilizadores autenticados.
      execute format('grant execute on function %s to authenticated;', r.sig);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------
-- 4. (Opcional, recomendado) Unicidade do nº de brinco por exploração.
--    O SIA/brinco é único por lei. Evita dois animais com o mesmo brinco
--    na mesma exploração. Ignora nulos (animais ainda por identificar).
--    Deixado comentado: descomenta só depois de garantir que não há
--    duplicados existentes (senão a criação do índice falha).
-- ------------------------------------------------------------------
-- create unique index if not exists uq_animal_brinco_exploracao
--   on public.animal (exploracao_id, numero_identificacao)
--   where numero_identificacao is not null;
