-- ==================================================================
-- Terrabovina — agenda: os eventos que as pessoas marcam
-- ==================================================================
-- Aplica DEPOIS de schema_papel_veterinario.sql (20), de onde vem a régua do
-- que o veterinário é. Idempotente.
--
-- O QUE TRAZ
--
-- Até aqui o calendário da app só sabia o que a app calculava: prazos do SNIRA,
-- partos previstos, fim de intervalos de segurança. Tudo derivado dos animais,
-- nada escrito por ninguém. Faltava o resto do que enche uma semana no campo —
-- a feira de quinta, a visita do veterinário, a entrega da ração, o dia de
-- carregar para o matadouro.
--
-- Nasce a tabela `evento_agenda`: um título, um dia, e — se fizer falta — uma
-- hora. Não se confunde com a tabela `evento`, que é outra coisa: essa é o que
-- JÁ ACONTECEU a um animal (a vacina que se deu, o parto que houve). Esta é o
-- que ESTÁ MARCADO para a exploração. Uma olha para trás e faz histórico
-- clínico; a outra olha para a frente e faz agenda. Por isso são duas tabelas e
-- não uma com uma coluna a dizer qual é qual.
--
-- PÚBLICO OU PRIVADO
--
-- Cada evento é de quem o escreveu e nasce à escolha:
--
--   público  — toda a equipa da exploração o vê. É a feira, a entrega, o dia de
--              vacinar o lote todo: coisas que interessam a quem lá trabalha.
--   privado  — só quem o escreveu. É o lembrete pessoal, e a app não tem que
--              o mostrar aos colegas só por ele estar guardada no mesmo sítio.
--
-- O privado é fechado pela RLS e não pela interface. Um "só eu vejo" que na
-- verdade depende de o outro ecrã se lembrar de filtrar não é privado nenhum:
-- basta a lista chegar por outro caminho — uma exportação, um ecrã novo — para
-- aparecer a toda a gente.
--
-- O VETERINÁRIO NÃO TEM AGENDA AQUI
--
-- Ele não vê o calendário nem marca eventos. É uma visita: vem, regista o que
-- fez ao animal, e vai-se embora — e a agenda de uma exploração diz quando é a
-- feira, quando chega a ração e a que horas se carrega o camião, que é o
-- movimento da casa de outra pessoa. Ao contrário dos Documentos (ver a nota do
-- ficheiro 20), isto TEM barreira no servidor: aqui não há nada que ele já
-- pudesse ler por outro lado, portanto fechá-lo não lhe tira nada do trabalho.
-- ==================================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------------
-- 1. A tabela
-- ------------------------------------------------------------------
create table if not exists public.evento_agenda (
  id uuid primary key default gen_random_uuid(),
  exploracao_id text not null references public.exploracao (id) on delete cascade,
  -- Default `auth.uid()`: o cliente não precisa de o mandar, e a política de
  -- insert garante que ninguém marca eventos em nome de outro.
  criado_por uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  -- `date` e não `timestamptz`: o dia de um evento é o dia em Portugal, e um
  -- instante guardado em UTC muda de dia conforme o mês do ano (ver a nota de
  -- `src/data/calendario.ts`, que teve exatamente este problema com os partos).
  dia date not null,
  -- A hora à parte, e a poder faltar. "Dia 12 há feira" é um evento completo;
  -- obrigar a uma hora punha lá 00:00 e o calendário passava a dizer que a
  -- feira era à meia-noite.
  hora time,
  publico boolean not null default true,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um título vazio é um evento que não se consegue ler no calendário.
alter table public.evento_agenda drop constraint if exists evento_agenda_titulo_nao_vazio;
alter table public.evento_agenda
  add constraint evento_agenda_titulo_nao_vazio check (length(btrim(titulo)) > 0);

-- O calendário pede sempre "os eventos desta exploração neste mês".
create index if not exists idx_evento_agenda_exp_dia
  on public.evento_agenda (exploracao_id, dia);
-- E a lista de um utilizador, para os privados.
create index if not exists idx_evento_agenda_autor
  on public.evento_agenda (criado_por, dia);


-- ------------------------------------------------------------------
-- 2. Quem tem agenda
-- ------------------------------------------------------------------
-- Membro da exploração e não veterinário. A pergunta fica numa função porque
-- as quatro políticas abaixo fazem-na toda — e três cópias da mesma condição
-- são três sítios onde ela pode divergir na próxima alteração (foi o que a
-- nota do `schema_acesso_temporario.sql` já tinha aprendido com o prazo).
--
-- `membro_de()` já deixa de fora quem tem o prazo esgotado: o veterinário cujo
-- acesso caiu não é membro de nada.
create or replace function public.tem_agenda(exp_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_superadmin()
      or (public.membro_de(exp_id) and public.role_em(exp_id) is distinct from 'veterinario');
$$;

revoke all     on function public.tem_agenda(text) from public, anon;
grant  execute on function public.tem_agenda(text) to authenticated;


-- ------------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------------
alter table public.evento_agenda enable row level security;

-- LER: os públicos da exploração, mais os meus privados.
drop policy if exists evento_agenda_read on public.evento_agenda;
create policy evento_agenda_read on public.evento_agenda
  for select
  using (
    public.tem_agenda(exploracao_id)
    and (publico or criado_por = auth.uid())
  );

-- ESCREVER: só em nome próprio, só numa exploração onde se possa escrever.
-- `pode_escrever_em` é quem trata da conta suspensa e da exploração inativa.
drop policy if exists evento_agenda_insert on public.evento_agenda;
create policy evento_agenda_insert on public.evento_agenda
  for insert
  with check (
    criado_por = auth.uid()
    and public.tem_agenda(exploracao_id)
    and public.pode_escrever_em(exploracao_id)
  );

-- ALTERAR e APAGAR: o autor sempre; o dono da exploração também, mas só nos
-- PÚBLICOS. Os privados dos outros ele nem vê (a política de leitura fecha-os),
-- e uma política de escrita mais larga do que a de leitura deixava-o apagar às
-- cegas linhas que não consegue ler — e descobri-las pelo que desaparecia.
drop policy if exists evento_agenda_update on public.evento_agenda;
create policy evento_agenda_update on public.evento_agenda
  for update
  using (
    public.pode_escrever_em(exploracao_id)
    and public.tem_agenda(exploracao_id)
    and (criado_por = auth.uid() or (publico and public.role_em(exploracao_id) = 'admin'))
  )
  with check (
    criado_por = auth.uid()
    or (publico and public.role_em(exploracao_id) = 'admin')
  );

drop policy if exists evento_agenda_delete on public.evento_agenda;
create policy evento_agenda_delete on public.evento_agenda
  for delete
  using (
    public.pode_escrever_em(exploracao_id)
    and public.tem_agenda(exploracao_id)
    and (criado_por = auth.uid() or (publico and public.role_em(exploracao_id) = 'admin'))
  );


-- ------------------------------------------------------------------
-- 4. updated_at a cada alteração
-- ------------------------------------------------------------------
-- Reutiliza a função do `schema_versoes.sql`, recriada aqui para este ficheiro
-- correr sozinho. Tem de ficar IGUAL à de lá, `set search_path` incluído: um
-- `create or replace` sem a cláusula apaga-a da função existente e o aviso do
-- linter volta.
create or replace function public.toca_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_updated_at on public.evento_agenda;
create trigger trg_updated_at before update on public.evento_agenda
  for each row execute function public.toca_updated_at();


-- ------------------------------------------------------------------
-- Tabela nova: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- 1. A tabela e as quatro políticas existem:
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'evento_agenda' order by cmd;
--
-- 2. Na sessão de um TRABALHADOR da exploração, marcar e ler:
--
--   insert into public.evento_agenda (exploracao_id, titulo, dia, hora, publico)
--   values ('<exploracao>', 'Feira de Idanha', current_date + 3, '09:00', true);
--   select titulo, dia, hora, publico from public.evento_agenda;
--
-- 3. Um evento privado de outra pessoa NÃO aparece (0 linhas):
--
--   -- (na sessão do colega) insert ... publico = false;
--   -- (de volta à primeira sessão)
--   select count(*) from public.evento_agenda where not publico and criado_por <> auth.uid();
--
-- 4. Na sessão do VETERINÁRIO, a agenda está fechada nos dois sentidos:
--
--   select count(*) from public.evento_agenda;                  -- 0
--   insert into public.evento_agenda (exploracao_id, titulo, dia)
--   values ('<exploracao>', 'teste', current_date);             -- ERROR: RLS
--
-- 5. O dono apaga um público de outro, mas não lhe toca nos privados:
--
--   delete from public.evento_agenda where id = '<público de um trabalhador>';
--   -- (1 linha; os privados dele nem aparecem no select)
