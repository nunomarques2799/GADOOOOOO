-- ==================================================================
-- Terrabovina — documentos públicos e privados
-- ==================================================================
-- Aplica DEPOIS de schema_documentos.sql (24). Idempotente.
--
-- O QUE MUDA
--
-- Um documento nasceu visível a toda a equipa da exploração. Só que a gaveta
-- "Documentos pessoais" existe desde o primeiro dia — cartões, licenças,
-- contratos — e um cartão de cidadão guardado numa gaveta que o trabalhador
-- também abre não é um documento pessoal: é um documento pessoal partilhado com
-- quem calhar andar na exploração.
--
-- Cada documento passa a nascer à escolha, como já acontece nos eventos da
-- agenda (ver `schema_agenda.sql`) e pelas mesmas duas razões:
--
--   público  — toda a equipa da exploração o vê. É a fatura da ração, a guia de
--              circulação: papéis da casa, que interessam a quem lá trabalha.
--   privado  — só quem o guardou. Mais ninguém, nem o dono da exploração.
--
-- O VETERINÁRIO CONTINUA A NÃO VER NENHUM, público ou privado — isso não mexe:
-- é o `tem_documentos()` que o decide, e ele fica intacto.
--
-- POR QUE RAZÃO O DONO NÃO VÊ OS PRIVADOS DOS OUTROS
--
-- É a mesma régua da agenda, e é deliberada. O dono manda na exploração, não na
-- gaveta pessoal de quem lá trabalha. Se a promessa "só eu vejo" tiver uma
-- exceção para o patrão, não é uma promessa — e a app estaria a convidar as
-- pessoas a guardarem ali o cartão de cidadão com base numa frase que não
-- cumpre.
--
-- O DEFAULT É `true`, E ISSO É DE PROPÓSITO
--
-- Os documentos que já lá estão foram guardados quando não havia escolha, e
-- toda a equipa os via. Fazê-los nascer privados nesta migração ESCONDIA-OS de
-- quem os estava a usar, sem ninguém pedir nada. O que já é partilhado
-- continua partilhado; a escolha vale do carregamento seguinte em diante.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. A coluna
-- ------------------------------------------------------------------
alter table public.documento
  add column if not exists publico boolean not null default true;


-- ------------------------------------------------------------------
-- 2. As políticas
-- ------------------------------------------------------------------
-- LER: os públicos da exploração, mais os meus privados.
drop policy if exists documento_read on public.documento;
create policy documento_read on public.documento
  for select
  using (
    public.tem_documentos(exploracao_id)
    and (publico or criado_por = auth.uid())
  );

-- ALTERAR: mudar o nome, a gaveta ou a visibilidade. O autor sempre; o dono da
-- exploração também, mas SÓ nos públicos.
--
-- A condição do `with check` repete a do `using` por uma razão que não é
-- arrumação: sem ela, o dono pegava num documento público de outra pessoa,
-- marcava-o privado, e a linha saía-lhe da vista — mas ele acabara de a
-- esconder de toda a equipa sem que o autor soubesse. Com ela, o Postgres
-- recusa a linha DEPOIS da alteração e a jogada não passa.
drop policy if exists documento_update on public.documento;
create policy documento_update on public.documento
  for update
  using (
    public.pode_escrever_em(exploracao_id)
    and public.tem_documentos(exploracao_id)
    and (criado_por = auth.uid() or (publico and public.role_em(exploracao_id) = 'admin'))
  )
  with check (
    criado_por = auth.uid()
    or (publico and public.role_em(exploracao_id) = 'admin')
  );

-- APAGAR: a mesma régua. Um privado que o dono não vê também não apaga —
-- uma política de escrita mais larga do que a de leitura deixava-o apagar às
-- cegas linhas que não consegue ler, e descobri-las pelo que desaparecia.
drop policy if exists documento_delete on public.documento;
create policy documento_delete on public.documento
  for delete
  using (
    public.pode_escrever_em(exploracao_id)
    and public.tem_documentos(exploracao_id)
    and (criado_por = auth.uid() or (publico and public.role_em(exploracao_id) = 'admin'))
  );


-- ------------------------------------------------------------------
-- 3. E o FICHEIRO, que é a outra metade
-- ------------------------------------------------------------------
-- A linha da tabela e o objeto no bucket são duas coisas, com duas RLS. Fechar
-- só a linha deixava o privado escondido da lista e aberto a quem soubesse o
-- caminho — e o caminho é `<exploracao>/<id>.jpg`, que qualquer pessoa da
-- equipa consegue adivinhar a partir de um id que já viu.
--
-- A política do bucket passa a perguntar à tabela: existe uma linha para este
-- caminho que EU possa ler? Como a `documento_read` já responde a isso, a
-- resposta vem de graça e as duas nunca podem divergir.
--
-- O `insert` NÃO passa a olhar para a tabela: ao guardar, o ficheiro sobe
-- ANTES da linha (ver o cabeçalho de `data/useDocumentos.ts` para o porquê),
-- portanto nesse instante a linha ainda não existe e a condição recusaria
-- sempre. Fica como estava — quem pode escrever na exploração pode lá pôr um
-- ficheiro.
drop policy if exists documentos_bucket_read on storage.objects;
create policy documentos_bucket_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and exists (
      select 1 from public.documento d where d.caminho = storage.objects.name
    )
  );

drop policy if exists documentos_bucket_delete on storage.objects;
create policy documentos_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and public.pode_escrever_em((storage.foldername(name))[1])
    and exists (
      select 1 from public.documento d where d.caminho = storage.objects.name
    )
  );


-- ------------------------------------------------------------------
-- Coluna nova: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- 1. A coluna existe e o que já lá estava ficou público:
--
--   select publico, count(*) from public.documento group by 1;
--
-- 2. Na sessão de um TRABALHADOR: guardar um privado e ver que o DONO não o vê.
--
--   -- (trabalhador) insert into public.documento
--   --   (exploracao_id, criado_por, titulo, categoria, caminho, publico)
--   --   values ('<exp>', auth.uid(), 'O meu cartão', 'Documentos pessoais',
--   --           '<exp>/privado.jpg', false);
--   -- (dono) select count(*) from public.documento where titulo = 'O meu cartão';
--   -- 0
--
-- 3. E o FICHEIRO desse privado também não (0 linhas, na sessão do dono):
--
--   select count(*) from storage.objects
--    where bucket_id = 'documentos' and name = '<exp>/privado.jpg';
--
-- 4. O dono não consegue esconder um público de outra pessoa (ERRO de RLS):
--
--   update public.documento set publico = false where id = '<público de outro>';
