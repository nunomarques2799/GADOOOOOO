-- ==================================================================
-- Terrabovina — reprodução: cobrição, diagnóstico e o resultado
-- ==================================================================
-- Aplica DEPOIS de schema_snira.sql (29). Idempotente.
--
-- O QUE TRAZ
--
-- Uma coluna. Só isso — e é de propósito.
--
-- O ciclo reprodutivo de uma vaca é cobrição → diagnóstico de gestação →
-- parto, e os três já cabem na tabela `evento`: `tipo` é texto livre, portanto
-- `Cobrição` e `Diagnóstico` entram ao lado de `Parto`, `Vacinação` e
-- `Pesagem` sem tocar em nada. A data está lá, o animal está lá, e o histórico
-- da ficha passa a mostrar o ciclo todo por ordem sem uma linha de código novo.
--
-- O que NÃO cabia era o resultado do diagnóstico. Gestante ou vazia é a
-- resposta de que depende tudo o que vem a seguir — a data prevista do parto, a
-- lista de quem está prenhe, o aviso de quem voltou a estar vazia — e enfiá-la
-- no texto do `descricao` obrigava a app a ir lê-lo com uma expressão regular.
-- É o que já se faz com o peso ("520 kg" → 520) e funciona, mas ali o pior que
-- acontece é um ganho médio diário não aparecer. Aqui o pior que acontece é uma
-- vaca dada por prenhe quando não está.
--
-- PORQUE NÃO UM CAMPO `estado_reprodutivo` NO ANIMAL
--
-- Porque seria uma segunda verdade. O estado reprodutivo é o que os eventos
-- dizem: coberta a 12 de março, diagnosticada gestante a 20 de abril, pariu a
-- 18 de dezembro. Guardá-lo também numa coluna do animal obriga a mantê-los
-- iguais para sempre — e no dia em que alguém corrigir a data de um parto, a
-- coluna fica a mentir sem ninguém dar por isso. A app calcula-o (ver
-- `src/data/reproducao.ts`) a partir dos eventos, que é onde ele está.
--
-- A única exceção continua a ser `animal.data_prevista_parto`, que já existia:
-- essa é uma PREVISÃO, não um facto observado, e ter de a recalcular a cada
-- ecrã para a pôr no calendário e nos avisos não pagava.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. A coluna
-- ------------------------------------------------------------------
alter table public.evento add column if not exists resultado text;

-- Lista fechada, escrita pela app. A restrição não protege de nada em
-- funcionamento normal — existe para o caso de alguém escrever direto na base:
-- um valor fora da lista não rebentaria nada, a vaca é que desaparecia das
-- listas de reprodução sem uma palavra a dizer porquê.
--
--   gestante  — confirmada prenhe. É o que põe a data prevista de parto.
--   vazia     — não está prenhe. Volta à lista de quem precisa de cobrição.
--   duvidoso  — o veterinário não se comprometeu. Fica a aguardar repetição,
--               que é diferente de "vazia" e MUITO diferente de "gestante".
--
-- `null` é o estado de tudo o resto: uma pesagem não tem resultado nenhum.
do $$
begin
  alter table public.evento drop constraint if exists evento_resultado_valido;
  alter table public.evento
    add constraint evento_resultado_valido
    check (resultado is null or resultado in ('gestante', 'vazia', 'duvidoso'));
end $$;


-- ------------------------------------------------------------------
-- 2. Índice
-- ------------------------------------------------------------------
-- As listas de reprodução perguntam sempre "o último evento de tipo X deste
-- animal". A app carrega os eventos todos e resolve isso em memória (é
-- offline-first: a lista já lá está), mas o índice serve as consultas de
-- diagnóstico e o dia em que houver relatórios do lado do servidor.
create index if not exists idx_evento_animal_tipo_data
  on public.evento (animal_id, tipo, data desc);


-- ------------------------------------------------------------------
-- 3. Recarregar a cache do PostgREST
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- A coluna existe e o histórico ficou intacto:
--
--   select tipo, count(*) filter (where resultado is not null) as com_resultado,
--          count(*) as total
--     from public.evento group by 1 order by 1;
--
-- A restrição recusa o que não está na lista:
--
--   begin;
--   update public.evento set resultado = 'talvez' where id = (select id from public.evento limit 1);
--   -- ERROR:  new row violates check constraint "evento_resultado_valido"
--   rollback;
--
-- Os tipos novos entram sem restrição nenhuma (o `tipo` é texto livre):
--
--   select distinct tipo from public.evento order by 1;
