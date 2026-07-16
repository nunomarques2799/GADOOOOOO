-- ==================================================================
-- Gestão de Gado — hierarquia de acesso (superadmin → clientes → equipa)
-- ==================================================================
-- Aplica em cima do schema.sql original. Idempotente (safe re-runs).
--
-- Modelo:
--   1. SUPERADMIN (dono da plataforma). Aprova quem pode ser cliente.
--      Marca em `perfil.is_superadmin = true`. Só há um, na prática.
--   2. CLIENTE. Regista-se; fica em `perfil.estado='pendente'` até o
--      superadmin aprovar (`estado='ativo'`). Só então pode criar
--      explorações — o trigger torna-o `admin` das que cria.
--   3. TRABALHADOR / VETERINÁRIO. Não se pode registar "livremente":
--      recebe um CÓDIGO DE CONVITE do cliente admin de uma exploração.
--      Ao registar-se com o código (ou resgatá-lo após o registo),
--      entra imediatamente como membro dessa exploração com o role
--      definido — sem passar pela aprovação do superadmin.
--
-- Movimentação: um cliente admin pode remover um membro de uma exploração
-- (delete em `membro_exploracao`) e gerar um novo convite para outra.
-- ==================================================================

create extension if not exists pgcrypto;

-- Enum dos papéis (dentro de uma exploração — o superadmin é global)
do $$ begin
  create type public.role_membro as enum ('admin', 'trabalhador', 'veterinario');
exception when duplicate_object then null; end $$;

-- ---- Perfil: estado + flag de superadmin ----
alter table public.perfil
  add column if not exists estado text not null default 'pendente'
    check (estado in ('pendente', 'ativo'));

alter table public.perfil
  add column if not exists is_superadmin boolean not null default false;

-- Superadmins são sempre 'ativos' (regra de sanidade).
update public.perfil set estado = 'ativo' where is_superadmin;

-- ---- Membros por exploração ----
create table if not exists public.membro_exploracao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exploracao_id text not null references public.exploracao (id) on delete cascade,
  role public.role_membro not null,
  criado_em timestamptz default now(),
  unique (user_id, exploracao_id)
);

create index if not exists idx_membro_user on public.membro_exploracao (user_id);
create index if not exists idx_membro_exploracao on public.membro_exploracao (exploracao_id);

-- ---- Convites (códigos que trabalhadores/vets usam) ----
create table if not exists public.convite (
  codigo text primary key,
  exploracao_id text not null references public.exploracao (id) on delete cascade,
  role public.role_membro not null,
  criado_por uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz default now(),
  expira_em timestamptz,
  usado_por uuid references auth.users (id),
  usado_em timestamptz,
  descricao text
);

create index if not exists idx_convite_exploracao on public.convite (exploracao_id);

-- ==================================================================
-- Helpers SQL (SECURITY DEFINER — evitam recursão nas policies)
-- ==================================================================
create or replace function public.eh_superadmin()
returns boolean language sql security definer stable set search_path = 'public' as $$
  select coalesce(
    (select is_superadmin from public.perfil where id = auth.uid()),
    false
  );
$$;

create or replace function public.perfil_ativo()
returns boolean language sql security definer stable set search_path = 'public' as $$
  select coalesce(
    (select estado = 'ativo' from public.perfil where id = auth.uid()),
    false
  );
$$;

create or replace function public.membro_de(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.membro_exploracao
    where exploracao_id = exp_id and user_id = auth.uid()
  );
$$;

create or replace function public.role_em(exp_id text)
returns text language sql security definer stable set search_path = 'public' as $$
  select role::text from public.membro_exploracao
  where exploracao_id = exp_id and user_id = auth.uid()
  limit 1;
$$;

-- ==================================================================
-- Row Level Security
-- ==================================================================

-- ---- perfil ----
alter table public.perfil enable row level security;

drop policy if exists perfil_self on public.perfil;
drop policy if exists perfil_self_select on public.perfil;
create policy perfil_self_select on public.perfil
  for select using (auth.uid() = id or public.eh_superadmin());

drop policy if exists perfil_self_update on public.perfil;
create policy perfil_self_update on public.perfil
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists perfil_superadmin_update on public.perfil;
create policy perfil_superadmin_update on public.perfil
  for update using (public.eh_superadmin()) with check (public.eh_superadmin());

-- Nenhum policy de INSERT/DELETE — só o trigger `handle_new_user` cria linhas.

-- ---- membro_exploracao ----
alter table public.membro_exploracao enable row level security;

-- Cada user vê os SEUS membros. Admins da exploração veem todos os dela.
drop policy if exists membro_self_select on public.membro_exploracao;
create policy membro_self_select on public.membro_exploracao
  for select using (
    auth.uid() = user_id
    or public.role_em(exploracao_id) = 'admin'
    or public.eh_superadmin()
  );

-- Escrita: apenas admins da exploração (ou superadmin). NUNCA um role='admin'
--   pode ser criado por uma insert direta: só via trigger de criação da
--   exploração, ou via superadmin (não faz sentido no fluxo normal).
drop policy if exists membro_admin_write on public.membro_exploracao;
create policy membro_admin_write on public.membro_exploracao
  for all using (
    public.role_em(exploracao_id) = 'admin' or public.eh_superadmin()
  ) with check (
    (public.role_em(exploracao_id) = 'admin' or public.eh_superadmin())
    and role <> 'admin'
  );

-- ---- convite ----
alter table public.convite enable row level security;

-- Ver: admins da exploração (para gerir os convites), OU o próprio user que
-- procura o código exato (o "resgate" é feito pela função abaixo).
drop policy if exists convite_admin_select on public.convite;
create policy convite_admin_select on public.convite
  for select using (
    public.role_em(exploracao_id) = 'admin' or public.eh_superadmin()
  );

-- Só admins criam / apagam convites.
drop policy if exists convite_admin_write on public.convite;
create policy convite_admin_write on public.convite
  for all using (
    public.role_em(exploracao_id) = 'admin' or public.eh_superadmin()
  ) with check (
    public.role_em(exploracao_id) = 'admin' or public.eh_superadmin()
  );

-- ---- exploracao ----
-- Ler: membros ou superadmin.
drop policy if exists exploracao_owner on public.exploracao;
drop policy if exists exploracao_membros_read on public.exploracao;
create policy exploracao_membros_read on public.exploracao
  for select using (public.membro_de(id) or public.eh_superadmin());

-- Criar: só perfis ATIVOS podem criar exploração (dono passa a admin via trigger).
drop policy if exists exploracao_admin_write on public.exploracao;
drop policy if exists exploracao_ativo_insert on public.exploracao;
create policy exploracao_ativo_insert on public.exploracao
  for insert with check (auth.uid() = user_id and public.perfil_ativo());

-- Editar / apagar: só admin da exploração.
drop policy if exists exploracao_admin_update on public.exploracao;
create policy exploracao_admin_update on public.exploracao
  for update using (public.role_em(id) = 'admin' or public.eh_superadmin())
  with check (public.role_em(id) = 'admin' or public.eh_superadmin());

drop policy if exists exploracao_admin_delete on public.exploracao;
create policy exploracao_admin_delete on public.exploracao
  for delete using (public.role_em(id) = 'admin' or public.eh_superadmin());

-- ---- terreno ----
drop policy if exists terreno_owner on public.terreno;
drop policy if exists terreno_membros_read on public.terreno;
create policy terreno_membros_read on public.terreno
  for select using (public.membro_de(exploracao_id) or public.eh_superadmin());

drop policy if exists terreno_maneio_write on public.terreno;
create policy terreno_maneio_write on public.terreno
  for all using (
    public.role_em(exploracao_id) in ('admin', 'trabalhador') or public.eh_superadmin()
  ) with check (
    public.role_em(exploracao_id) in ('admin', 'trabalhador') or public.eh_superadmin()
  );

-- ---- animal ----
drop policy if exists animal_owner on public.animal;
drop policy if exists animal_membros_read on public.animal;
create policy animal_membros_read on public.animal
  for select using (public.membro_de(exploracao_id) or public.eh_superadmin());

drop policy if exists animal_maneio_write on public.animal;
create policy animal_maneio_write on public.animal
  for all using (
    public.role_em(exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    or public.eh_superadmin()
  ) with check (
    public.role_em(exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    or public.eh_superadmin()
  );

-- ---- evento ----
drop policy if exists evento_owner on public.evento;
drop policy if exists evento_membros_read on public.evento;
create policy evento_membros_read on public.evento
  for select using (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id and public.membro_de(a.exploracao_id)
    )
  );

drop policy if exists evento_maneio_write on public.evento;
create policy evento_maneio_write on public.evento
  for all using (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.role_em(a.exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    )
  ) with check (
    public.eh_superadmin() or exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.role_em(a.exploracao_id) in ('admin', 'trabalhador', 'veterinario')
    )
  );

-- ==================================================================
-- Triggers
-- ==================================================================

-- Ao registar novo utilizador (auth.users), cria o perfil PENDENTE.
-- Substitui a versão do schema.sql para garantir que os campos `estado`
-- e `is_superadmin` são preenchidos de forma coerente.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfil (id, nome, estado, is_superadmin)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''), 'pendente', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Ao criar exploração, torna o dono admin dela.
create or replace function public.handle_new_exploracao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.membro_exploracao (user_id, exploracao_id, role)
  values (new.user_id, new.id, 'admin')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_exploracao_created on public.exploracao;
create trigger on_exploracao_created
  after insert on public.exploracao
  for each row execute function public.handle_new_exploracao();

-- ==================================================================
-- Funções RPC (chamadas do cliente)
-- ==================================================================

-- Superadmin aprova um cliente pendente → passa `estado` a 'ativo'.
create or replace function public.superadmin_aprovar_cliente(alvo uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'apenas o superadmin pode aprovar clientes';
  end if;
  update public.perfil set estado = 'ativo' where id = alvo;
end;
$$;

-- Superadmin bloqueia (volta a pendente); o user perde a permissão de criar
-- exploração até nova aprovação. As explorações já criadas continuam a ver-se.
create or replace function public.superadmin_bloquear_cliente(alvo uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'apenas o superadmin pode bloquear clientes';
  end if;
  update public.perfil set estado = 'pendente' where id = alvo;
end;
$$;

-- Cliente admin gera um código de convite (curto, legível).
-- Nota: alfabeto sem 0/O/1/I para reduzir ambiguidade ao ditar/copiar.
create or replace function public.criar_convite(
  exp_id text,
  novo_role public.role_membro,
  descricao_txt text default null,
  validade_horas int default 168
) returns text language plpgsql security definer set search_path = 'public' as $$
declare
  novo_codigo text;
  tentativas int := 0;
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if public.role_em(exp_id) is distinct from 'admin' and not public.eh_superadmin() then
    raise exception 'apenas admins da exploração podem criar convites';
  end if;
  if novo_role = 'admin' then
    raise exception 'convites não podem promover a admin';
  end if;

  loop
    novo_codigo := '';
    for i in 1..8 loop
      novo_codigo := novo_codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.convite where codigo = novo_codigo);
    tentativas := tentativas + 1;
    if tentativas > 5 then raise exception 'falhou a gerar código único'; end if;
  end loop;

  insert into public.convite (codigo, exploracao_id, role, criado_por, descricao, expira_em)
  values (novo_codigo, exp_id, novo_role, auth.uid(), descricao_txt,
          now() + make_interval(hours => validade_horas));
  return novo_codigo;
end;
$$;

-- Utilizador (já registado) resgata um código → vira membro imediatamente.
-- Também marca o perfil como 'ativo' para poder aceder à app.
create or replace function public.resgatar_convite(codigo_txt text)
returns json language plpgsql security definer set search_path = 'public' as $$
declare
  c public.convite%rowtype;
begin
  select * into c from public.convite where codigo = upper(trim(codigo_txt));
  if not found then
    raise exception 'código inválido';
  end if;
  if c.usado_por is not null then
    raise exception 'código já foi usado';
  end if;
  if c.expira_em is not null and c.expira_em < now() then
    raise exception 'código expirado';
  end if;

  insert into public.membro_exploracao (user_id, exploracao_id, role)
  values (auth.uid(), c.exploracao_id, c.role)
  on conflict (user_id, exploracao_id) do update set role = excluded.role;

  update public.convite set usado_por = auth.uid(), usado_em = now() where codigo = c.codigo;
  update public.perfil set estado = 'ativo' where id = auth.uid();

  return json_build_object('exploracao_id', c.exploracao_id, 'role', c.role);
end;
$$;

grant execute on function public.superadmin_aprovar_cliente(uuid) to authenticated;
grant execute on function public.superadmin_bloquear_cliente(uuid) to authenticated;
grant execute on function public.criar_convite(text, public.role_membro, text, int) to authenticated;
grant execute on function public.resgatar_convite(text) to authenticated;

-- ==================================================================
-- Pendentes de aprovação
-- ==================================================================
-- NOTA DE SEGURANÇA: aqui existia uma view `utilizadores_pendentes` que
-- juntava auth.users (emails) + perfil (NIF/telefone). Como as views normais
-- NÃO respeitam o RLS das tabelas de origem, qualquer utilizador autenticado
-- conseguia ler os dados pessoais de todos os pendentes. Foi substituída pelo
-- RPC `superadmin_listar_pendentes()` (SECURITY DEFINER, valida eh_superadmin)
-- definido em `schema_seguranca.sql`. Se a view antiga ainda existir, esse
-- ficheiro faz `drop view` dela.

-- ==================================================================
-- BOOTSTRAP: marcar o superadmin (executar UMA vez com o teu email)
-- ==================================================================
-- Descomenta e ajusta o email antes de correr esta secção UMA vez:
update public.perfil
   set is_superadmin = true, estado = 'ativo'
 where id = (select id from auth.users where email = 'nunomarques271999@gmail.com');
