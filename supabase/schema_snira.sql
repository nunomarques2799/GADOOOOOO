-- ==================================================================
-- Terrabovina — o que já foi comunicado ao SNIRA
-- ==================================================================
-- Aplica DEPOIS de schema_papel_veterinario.sql (20), de onde vêm as políticas
-- de escrita do `evento` na sua forma final. Idempotente.
--
-- O QUE TRAZ
--
-- Até aqui a app sabia CALCULAR o prazo do SNIRA e mais nada: contava os sete
-- dias a partir da identificação e punha um alerta na lista. O criador ia ao
-- iDigital, comunicava, voltava à app e não tinha onde o dizer — a não ser nos
-- nascimentos, onde `animal.comunicado_snira` já existia desde o primeiro dia.
--
-- Faltavam as outras duas comunicações obrigatórias, que na app são EVENTOS e
-- não colunas do animal:
--
--   morte ......... o animal morreu na exploração (evento `Morte`)
--   saída/entrada . vendeu-se, comprou-se, mudou de exploração
--                   (eventos `Venda`, `Compra`, `Movimentação`)
--
-- Nasce por isso o par `comunicado_snira` / `comunicado_em` no `evento`, a
-- espelhar exatamente o que o animal já tinha para o nascimento. Com os dois
-- lados marcados, a app consegue responder à pergunta que interessa — "o que
-- me falta comunicar esta semana?" — em vez de repetir o prazo de cada animal.
--
-- PORQUE NÃO UMA TABELA DE COMUNICAÇÕES
--
-- Foi a primeira ideia: um registo por comunicação feita, com tipo, animal e
-- autor. Ficou pelo caminho porque o que se comunica JÁ tem linha própria — o
-- nascimento é o animal, a morte é o evento de morte. Uma tabela à parte era
-- uma segunda cópia da mesma lista, com o trabalho de a manter alinhada e a
-- garantia de que um dia divergiriam. Marca-se a linha que já existe.
--
-- QUEM PODE MARCAR
--
-- No `animal` (nascimentos) a marcação exige `editarAnimais`, porque é um
-- `update` da ficha como qualquer outro — o veterinário não a tem e portanto
-- não marca nada.
--
-- No `evento` a política é mais larga do que isso: desde o ficheiro 20 escrever
-- um evento basta ter `registarTratamentos`, e a RLS não sabe distinguir uma
-- coluna da outra dentro da mesma linha. Ou seja: no servidor, um veterinário
-- consegue marcar uma morte como comunicada. Na app não consegue — o ecrã vive
-- atrás do `verDocumentos`, que ele não tem (ver `permissoes.ts`).
--
-- Fica escrito para não passar por barreira: é gate de interface, como as
-- exportações. Fechá-lo a sério exigia privilégios de COLUNA (o caminho do
-- `schema_auditoria.sql`) e isso trocava um risco pequeno — o veterinário
-- marcar como comunicado o que ele próprio registou — por mais uma camada de
-- grants a manter alinhada com três ficheiros.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. As colunas
-- ------------------------------------------------------------------
-- `comunicado_snira` é BOOLEAN E NULO, e os três estados querem dizer coisas
-- diferentes:
--
--   null   — nunca ninguém disse nada. É o que fica nos eventos antigos e nos
--            que não são comunicáveis (uma pesagem não se comunica a ninguém).
--   false  — falta comunicar. É o que a app escreve ao criar um evento que a
--            lei manda comunicar, e é o que faz o alerta aparecer.
--   true   — já foi.
--
-- O nulo é o que permite acrescentar tipos comunicáveis mais tarde sem
-- transformar todo o histórico em trabalho atrasado: o que já lá está fica em
-- `null` e não conta para lado nenhum. Um `not null default false` teria posto
-- todos os eventos da base — pesagens incluídas — na lista de pendentes.
alter table public.evento add column if not exists comunicado_snira boolean;
alter table public.evento add column if not exists comunicado_em timestamptz;

-- A lista de pendentes é sempre "os que estão por comunicar", e nunca a tabela
-- toda. Índice parcial: só indexa as linhas em falta, que são poucas.
create index if not exists idx_evento_por_comunicar
  on public.evento (animal_id)
  where comunicado_snira = false;


-- ------------------------------------------------------------------
-- 2. A data acompanha a marca
-- ------------------------------------------------------------------
-- `comunicado_em` é escrito pelo SERVIDOR e não pelo cliente, pela mesma razão
-- que `saida_em` no `schema_auditoria.sql`: num modelo offline-first é o
-- aparelho que decide o que envia, e uma data de comunicação com o relógio do
-- telemóvel mal acertado é pior do que não ter data nenhuma — sobretudo esta,
-- que existe para provar que se cumpriu um prazo legal.
--
-- Desmarcar limpa a data. Sem isto, corrigir um engano deixava para trás a hora
-- de uma comunicação que afinal não houve.
create or replace function public.evento_marca_comunicacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- `tg_op` e não `old is null`: num gatilho de INSERT o `old` não está
  -- atribuído, e ler-lhe um campo rebenta com "record 'old' is not assigned
  -- yet" em vez de dar nulo.
  if tg_op = 'INSERT' or new.comunicado_snira is distinct from old.comunicado_snira then
    new.comunicado_em := case when new.comunicado_snira then now() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists evento_comunicacao on public.evento;
create trigger evento_comunicacao
  before insert or update of comunicado_snira on public.evento
  for each row execute function public.evento_marca_comunicacao();


-- ------------------------------------------------------------------
-- 3. Recarregar a cache do PostgREST
-- ------------------------------------------------------------------
-- Sem isto a app recebe "Could not find the 'comunicado_snira' column of
-- 'evento' in the schema cache" — a coluna existe, a cópia em memória da API é
-- que está velha.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- As colunas existem e o histórico ficou em null (ninguém herdou trabalho):
--
--   select comunicado_snira, count(*) from public.evento group by 1;
--
-- O gatilho põe e tira a data:
--
--   begin;
--   update public.evento set comunicado_snira = true
--    where id = (select id from public.evento limit 1)
--    returning tipo, comunicado_snira, comunicado_em;   -- data preenchida
--   update public.evento set comunicado_snira = false
--    where id = (select id from public.evento limit 1)
--    returning tipo, comunicado_snira, comunicado_em;   -- data a null
--   rollback;
--
-- O que está por comunicar, por exploração:
--
--   select e.tipo, count(*)
--     from public.evento e
--    where e.comunicado_snira = false
--    group by 1;
