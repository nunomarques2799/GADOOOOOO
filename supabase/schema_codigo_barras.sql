-- ==================================================================
-- Terrabovina — o código impresso na caixa do medicamento
-- ==================================================================
-- Aplica DEPOIS de schema_medicamentos.sql (30). Idempotente.
--
-- O QUE TRAZ
--
-- Uma coluna: `medicamento.codigo_barras`. É o que a câmara leu na caixa,
-- guardado no lote a que pertence.
--
-- PORQUÊ UMA COLUNA E NÃO UMA TABELA DE PRODUTOS
--
-- Foi a decisão que decidiu o resto, e é a mesma que já está tomada no ficheiro
-- 30: uma linha de `medicamento` é um LOTE COMPRADO, não um produto. Uma tabela
-- `produto` à parte (código → nome, unidade, intervalo de segurança) seria o
-- desenho de um armazém e traria tudo o que um catálogo traz: RLS própria, quem
-- o pode editar, o que acontece a um lote quando alguém muda o produto por
-- baixo dele, e a pergunta de a quem pertence o catálogo numa conta com três
-- explorações.
--
-- Nada disso se ganha. O que a app precisa de responder é "já registei este
-- código alguma vez, e com que nome?", e essa pergunta responde-se a olhar
-- para os lotes que já lá estão. O catálogo é o histórico, e o histórico já
-- existe.
--
-- O QUE FICA GUARDADO É A CHAVE, NÃO O QUE A CÂMARA LEU
--
-- O mesmo produto lido do código de riscas (EAN-13, 13 dígitos) e do Data
-- Matrix (o `(01)` do GS1, 14 dígitos) dá dois números diferentes, e um é o
-- outro com um zero à frente. Guardar o que se leu em cru fazia a app não
-- reconhecer no Data Matrix o produto que já tinha aprendido das riscas. Quem
-- normaliza é a app (`src/data/codigos.ts`), e o que chega aqui vem sempre com
-- 14 dígitos quando é um número de produto.
--
-- Isto NÃO É UM IDENTIFICADOR e não leva restrição de unicidade: dois lotes do
-- mesmo antibiótico têm o mesmo código, que é exatamente o que faz o
-- reconhecimento funcionar. O que distingue os frascos continua a ser a coluna
-- `lote`.
--
-- SEM ÍNDICE, DE PROPÓSITO
--
-- A pergunta "já vi este código?" é feita na app, sobre os lotes que ela já tem
-- em memória (a lista inteira é carregada no arranque, é assim que o
-- offline-first desta app funciona). Nenhuma consulta do servidor filtra por
-- esta coluna, e um índice que ninguém usa é peso na escrita e mais uma coisa
-- a explicar.
--
-- QUEM MEXE NELA
--
-- Ninguém de novo. A coluna entra na tabela `medicamento`, cujas políticas já
-- decidem tudo: lê quem é membro (veterinário incluído), escreve quem tem
-- `editarAnimais`. A `medicamento` não tem grants por COLUNA (ao contrário da
-- `mensagem` do chat), portanto não há nada a abrir aqui.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. A coluna
-- ------------------------------------------------------------------
alter table public.medicamento
  add column if not exists codigo_barras text;

comment on column public.medicamento.codigo_barras is
  'Código impresso na caixa, normalizado a GTIN-14 quando é número de produto. '
  'Serve para reconhecer o produto numa compra seguinte. Não é identificador: '
  'repete-se de propósito entre lotes do mesmo produto.';


-- ------------------------------------------------------------------
-- 2. Travão ao lixo
-- ------------------------------------------------------------------
-- Não valida o conteúdo (um código pode ser um número, pode ser texto de uma
-- etiqueta impressa pela app, e um dia pode ser um formato que ainda não
-- existe). Valida só que não é uma string VAZIA, que é o valor que não quer
-- dizer nada: "sem código" escreve-se `null`, e ter as duas maneiras de dizer
-- o mesmo fazia a app ter de perguntar as duas em cada leitura.
do $$
begin
  alter table public.medicamento drop constraint if exists medicamento_codigo_nao_vazio;
  alter table public.medicamento
    add constraint medicamento_codigo_nao_vazio
    check (codigo_barras is null or length(btrim(codigo_barras)) > 0);
end $$;


-- ------------------------------------------------------------------
-- 3. A API tem de reler o schema
-- ------------------------------------------------------------------
-- Sem isto, a app recebe `Could not find the 'codigo_barras' column of
-- 'medicamento' in the schema cache` — o erro diz "não existe", a coluna
-- existe, e não há nada no SQL que sugira onde procurar.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- Conferir
-- ------------------------------------------------------------------
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'medicamento'
--      and column_name = 'codigo_barras';
--
-- E, depois de umas leituras, ver a memória de produtos a encher-se:
--   select codigo_barras, count(*) as lotes, min(nome) as produto
--     from public.medicamento
--    where codigo_barras is not null
--    group by codigo_barras
--    order by lotes desc;
