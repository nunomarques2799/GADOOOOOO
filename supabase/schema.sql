-- ==================================================================
-- Gestão de Gado — schema Supabase (PostgreSQL)
-- ==================================================================
-- Como aplicar:
--   1. Abrir o projeto em https://supabase.com/dashboard
--   2. Menu "SQL Editor" -> "New query"
--   3. Colar TODO este ficheiro e clicar em "Run"
--
-- Cada tabela tem `user_id` e Row Level Security (RLS): cada utilizador
-- só consegue ler/escrever as SUAS linhas. Os nomes de coluna estão em
-- snake_case (convenção PostgreSQL); a app mapeia para os seus tipos.
-- Seguro para correr mais que uma vez (idempotente).
-- ==================================================================

-- ---- Perfil (dados do utilizador; o email vive em auth.users) ----
create table if not exists public.perfil (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  telefone text,
  nif text,
  updated_at timestamptz default now()
);

-- ---- Exploração ----
create table if not exists public.exploracao (
  id text primary key,
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  nome text not null,
  marca_exploracao text not null,
  nif_detentor text not null,
  localizacao text,
  fotografia text,
  updated_at timestamptz default now()
);

-- ---- Terreno ----
create table if not exists public.terreno (
  id text primary key,
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  exploracao_id text not null,
  nome text not null,
  descricao text,
  latitude double precision,
  longitude double precision,
  area double precision,
  tipo text,
  updated_at timestamptz default now()
);

-- ---- Animal ----
create table if not exists public.animal (
  id text primary key,
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  exploracao_id text not null,
  terreno_id text,
  mae_id text,
  pai_id text,
  nome text,
  especie text not null,
  sexo text not null,
  data_nascimento text not null,
  raca text,
  cor_pelagem text,
  numero_identificacao text,
  data_identificacao text,
  tipo_identificacao text,
  fotografia text,
  fim_intervalo_seguranca text,
  data_prevista_parto text,
  comunicado_snira boolean,
  estado text default 'ativo',
  data_saida text,
  motivo_saida text,
  updated_at timestamptz default now()
);

-- Migração idempotente para bases já criadas (v1 → v2: estado do animal).
alter table public.animal add column if not exists estado text default 'ativo';
alter table public.animal add column if not exists data_saida text;
alter table public.animal add column if not exists motivo_saida text;

-- ---- Evento ----
create table if not exists public.evento (
  id text primary key,
  user_id uuid not null default auth.uid () references auth.users (id) on delete cascade,
  animal_id text not null,
  tipo text not null,
  data text not null,
  descricao text not null,
  detalhe text,
  valor numeric,
  updated_at timestamptz default now()
);

create index if not exists idx_animal_user on public.animal (user_id);
create index if not exists idx_evento_user on public.evento (user_id);
create index if not exists idx_evento_animal on public.evento (animal_id);

-- ==================================================================
-- Row Level Security — cada utilizador só acede aos seus dados
-- ==================================================================
alter table public.perfil enable row level security;
alter table public.exploracao enable row level security;
alter table public.terreno enable row level security;
alter table public.animal enable row level security;
alter table public.evento enable row level security;

-- Perfil: o dono é a própria linha (id = auth.uid())
drop policy if exists perfil_self on public.perfil;
create policy perfil_self on public.perfil
  for all using (auth.uid () = id) with check (auth.uid () = id);

-- Tabelas de dados: o dono é user_id
drop policy if exists exploracao_owner on public.exploracao;
create policy exploracao_owner on public.exploracao
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

drop policy if exists terreno_owner on public.terreno;
create policy terreno_owner on public.terreno
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

drop policy if exists animal_owner on public.animal;
create policy animal_owner on public.animal
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

drop policy if exists evento_owner on public.evento;
create policy evento_owner on public.evento
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- ==================================================================
-- Criar automaticamente o perfil quando um utilizador se regista
-- ==================================================================
create or replace function public.handle_new_user ()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfil (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nome', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();
