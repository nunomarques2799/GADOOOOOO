-- ==================================================================
-- Terrabovina — documentos: guardar faturas e papéis na exploração
-- ==================================================================
-- Aplica DEPOIS de schema_papel_veterinario.sql (20). Idempotente.
--
-- O QUE TRAZ
--
-- O separador Documentos tratava de ficheiros que SAEM (exportar o efetivo,
-- relatórios) e de notas de texto. Faltava-lhe o contrário: guardar lá dentro o
-- papel que se recebe — a fatura da ração, a guia de circulação, o recibo do
-- veterinário. Isso vivia numa gaveta ou na galeria do telemóvel, e o que está
-- na galeria do telemóvel perde-se com o telemóvel.
--
-- Passa a haver a tabela `documento` (o que é, de quem, em que gaveta) e um
-- bucket `documentos` no Storage (o ficheiro em si).
--
-- PORQUÊ STORAGE E NÃO UMA COLUNA
--
-- A fotografia do animal é guardada em base64 na própria coluna, e foi uma boa
-- decisão para o que ela é: 40 KB por animal, que sincronizam pela mesma fila
-- de todos os outros campos. Um documento não é isso. São faturas fotografadas
-- e vão-se acumulando às dezenas, e a cache local da app é lida INTEIRA e de
-- forma SÍNCRONA no arranque, antes de desenhar o primeiro ecrã (ver
-- `src/data/armazenamento.ts`). Cada megabyte de documento guardado assim é um
-- megabyte a ler antes de a app abrir.
--
-- No Storage, a app guarda um caminho de texto e vai buscar o ficheiro só
-- quando alguém o abre.
--
-- ESTE TEM RLS A SÉRIO
--
-- O `schema_papel_veterinario.sql` (20) deixou escrito que os Documentos eram a
-- única das quatro restrições ao veterinário SEM barreira no servidor — porque
-- na altura aquele ecrã só reempacotava dados que ele já podia ler, e fechá-lo
-- obrigava a fechar-lhe a lista de animais.
--
-- Isso deixa de ser verdade aqui. Um documento carregado é conteúdo NOVO, que
-- não existe em mais lado nenhum, portanto pode e deve ser fechado no servidor
-- sem lhe tirar nada do trabalho. A nota do ficheiro 20 continua certa para o
-- que ela descreve (exportações e relatórios); esta parte tem chave própria.
-- ==================================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------------
-- 1. Quem tem documentos
-- ------------------------------------------------------------------
-- Membro da exploração e não veterinário — o mesmo conjunto que o
-- `verDocumentos` de `src/data/permissoes.ts` dá (dono e trabalhador).
--
-- Numa função só, porque as políticas da tabela E as do bucket fazem a mesma
-- pergunta: duas cópias divergiriam na primeira alteração, e a que ficasse para
-- trás seria a do Storage — a que ninguém olha.
create or replace function public.tem_documentos(exp_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.eh_superadmin()
      or (public.membro_de(exp_id) and public.role_em(exp_id) is distinct from 'veterinario');
$$;

revoke all     on function public.tem_documentos(text) from public, anon;
grant  execute on function public.tem_documentos(text) to authenticated;


-- ------------------------------------------------------------------
-- 2. A tabela
-- ------------------------------------------------------------------
create table if not exists public.documento (
  id uuid primary key default gen_random_uuid(),
  exploracao_id text not null references public.exploracao (id) on delete cascade,
  -- `set null` e NÃO `cascade`: um documento pertence à exploração, não a quem
  -- o fotografou. Apagada a conta do trabalhador que tirou a foto da fatura, a
  -- fatura fica — apagá-la com ele era perder um papel da contabilidade de
  -- outra pessoa por causa de uma saída da equipa.
  criado_por uuid references auth.users (id) on delete set null,
  titulo text not null,
  categoria text not null default 'Outros',
  -- Onde o ficheiro está no bucket: `<exploracao_id>/<id>.<extensão>`. É a
  -- primeira pasta do caminho que as políticas do Storage leem para saber a que
  -- exploração o ficheiro pertence — mudar este formato obriga a mexer lá.
  caminho text not null unique,
  /** Bytes. Serve para mostrar o tamanho e para travar o que é grande de mais. */
  tamanho integer,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documento drop constraint if exists documento_categoria_conhecida;
alter table public.documento
  add constraint documento_categoria_conhecida
  check (categoria in ('Financeiro', 'Sanidade', 'Documentos pessoais', 'Outros'));

alter table public.documento drop constraint if exists documento_titulo_nao_vazio;
alter table public.documento
  add constraint documento_titulo_nao_vazio check (length(btrim(titulo)) > 0);

create index if not exists idx_documento_exp on public.documento (exploracao_id, criado_em desc);


-- ------------------------------------------------------------------
-- 3. RLS da tabela
-- ------------------------------------------------------------------
alter table public.documento enable row level security;

drop policy if exists documento_read on public.documento;
create policy documento_read on public.documento
  for select using (public.tem_documentos(exploracao_id));

drop policy if exists documento_insert on public.documento;
create policy documento_insert on public.documento
  for insert with check (
    criado_por = auth.uid()
    and public.tem_documentos(exploracao_id)
    and public.pode_escrever_em(exploracao_id)
  );

-- Alterar é só mudar o título ou a gaveta — o ficheiro não se troca (para
-- trocar, apaga-se e carrega-se outro, e assim o caminho nunca aponta para
-- coisa diferente da que lá estava).
drop policy if exists documento_update on public.documento;
create policy documento_update on public.documento
  for update
  using (
    public.pode_escrever_em(exploracao_id)
    and public.tem_documentos(exploracao_id)
    and (criado_por = auth.uid() or public.role_em(exploracao_id) = 'admin')
  )
  with check (criado_por = auth.uid() or public.role_em(exploracao_id) = 'admin');

drop policy if exists documento_delete on public.documento;
create policy documento_delete on public.documento
  for delete using (
    public.pode_escrever_em(exploracao_id)
    and public.tem_documentos(exploracao_id)
    and (criado_por = auth.uid() or public.role_em(exploracao_id) = 'admin')
  );


-- ------------------------------------------------------------------
-- 4. O bucket
-- ------------------------------------------------------------------
-- PRIVADO. Um bucket público serve os ficheiros a quem souber o URL, sem sessão
-- nenhuma — e o URL de um ficheiro só tem de escapar uma vez (numa partilha, num
-- registo de servidor) para a fatura de alguém ficar na internet aberta. A app
-- pede uma ligação assinada e de prazo curto sempre que precisa de mostrar um.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos',
  'documentos',
  false,
  -- 10 MB. Uma fotografia de fatura reduzida anda nos 300-600 KB; este teto é
  -- para travar o engano, não o uso normal.
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ------------------------------------------------------------------
-- 5. RLS do bucket
-- ------------------------------------------------------------------
-- A pergunta é a mesma da tabela, feita à PRIMEIRA PASTA do caminho — que é o
-- id da exploração (ver a coluna `caminho` acima). `storage.foldername(name)`
-- devolve as pastas em array, e `[1]` é a primeira.
--
-- Nada aqui olha para a tabela `documento`: as duas escritas (a linha e o
-- ficheiro) não são uma transação, e uma política do Storage que exigisse a
-- linha já gravada impedia a ordem inversa — que é a que a app usa, porque um
-- ficheiro sem linha é lixo recuperável e uma linha sem ficheiro é um documento
-- que não abre.
drop policy if exists documentos_bucket_read on storage.objects;
create policy documentos_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and public.tem_documentos((storage.foldername(name))[1])
  );

drop policy if exists documentos_bucket_insert on storage.objects;
create policy documentos_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and public.tem_documentos((storage.foldername(name))[1])
    and public.pode_escrever_em((storage.foldername(name))[1])
  );

drop policy if exists documentos_bucket_delete on storage.objects;
create policy documentos_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and public.tem_documentos((storage.foldername(name))[1])
    and public.pode_escrever_em((storage.foldername(name))[1])
  );


-- ------------------------------------------------------------------
-- 6. updated_at a cada alteração
-- ------------------------------------------------------------------
create or replace function public.toca_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_updated_at on public.documento;
create trigger trg_updated_at before update on public.documento
  for each row execute function public.toca_updated_at();


-- ------------------------------------------------------------------
-- Tabela nova: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- 1. O bucket é privado e só aceita imagens:
--
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets where id = 'documentos';
--
-- 2. As políticas dos dois lados existem:
--
--   select policyname, cmd from pg_policies
--    where tablename = 'documento' order by cmd;
--   select policyname, cmd from pg_policies
--    where schemaname = 'storage' and policyname like 'documentos_bucket%';
--
-- 3. Na sessão de um TRABALHADOR, a linha grava:
--
--   insert into public.documento (exploracao_id, titulo, categoria, caminho)
--   values ('<exploracao>', 'Fatura da ração', 'Financeiro', '<exploracao>/teste.jpg');
--
-- 4. Na sessão do VETERINÁRIO, não vê nem grava:
--
--   select count(*) from public.documento;                    -- 0
--   select public.tem_documentos('<exploracao>');             -- f
--   insert into public.documento (exploracao_id, titulo, caminho)
--   values ('<exploracao>', 'x', '<exploracao>/x.jpg');       -- ERROR: RLS
