-- ==================================================================
-- Terrabovina — fotografia do terreno e sede da exploração no mapa (v22)
-- ==================================================================
-- Aplica DEPOIS de todos os anteriores e ANTES do `schema_lint.sql`.
-- Idempotente: correr de novo é seguro.
--
-- Depende de: `schema.sql` (1) — é lá que nascem `exploracao` e `terreno`.
--
-- O QUE TRAZ
--
--   1. `terreno.fotografia` — a mesma coisa que `animal.fotografia` já é: um
--      data URI de um JPEG reduzido a ~600px, guardado na própria coluna (ver
--      `src/data/foto.ts`). Não é Storage de propósito, e a razão é a mesma:
--      sem bucket não há RLS de ficheiros a manter, não há upload de binário a
--      atravessar a fila offline, e uma foto tirada sem rede sincroniza como
--      qualquer outro campo de texto.
--
--   2. `exploracao.latitude` / `exploracao.longitude` — onde fica a sede, para
--      quem prefere marcar no mapa a escrever o nome da terra. O campo de texto
--      (`localizacao`) fica onde estava: são as duas maneiras de dizer a mesma
--      coisa, e nenhuma delas é obrigatória.
--
--      A meteorologia passa a preferi-las. Até aqui saía das coordenadas do
--      PRIMEIRO terreno com GPS, ou de uma geocodificação do texto — e quem tem
--      os cercados espalhados via a previsão de um sítio que nunca escolheu.
--
-- SEM POLÍTICAS NOVAS
--
-- As três colunas entram em tabelas cuja RLS já está escrita e é ao nível da
-- LINHA (quem pode ver/alterar o terreno pode ver/alterar tudo o que ele tem).
-- Não há grants por coluna em lado nenhum desta base, portanto uma coluna nova
-- herda exatamente as permissões da tabela — que é o que se quer aqui.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. As colunas
-- ------------------------------------------------------------------
alter table public.terreno    add column if not exists fotografia text;
alter table public.exploracao add column if not exists latitude  double precision;
alter table public.exploracao add column if not exists longitude double precision;


-- ------------------------------------------------------------------
-- 2. Recarregar a cache do PostgREST
-- ------------------------------------------------------------------
-- A API do Supabase serve-se de uma cópia em memória do schema. Sem isto, a app
-- grava um terreno com foto e recebe "Could not find the 'fotografia' column of
-- 'terreno' in the schema cache" — um erro que diz que a coluna não existe
-- quando ela acabou de ser criada.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- As três colunas existem (3 linhas):
--
--   select table_name, column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and ((table_name = 'terreno'    and column_name = 'fotografia')
--        or (table_name = 'exploracao' and column_name in ('latitude', 'longitude')))
--    order by table_name, column_name;
--
-- E nada se perdeu — as contagens têm de ser as mesmas de antes:
--
--   select count(*) from public.terreno;
--   select count(*) from public.exploracao;
