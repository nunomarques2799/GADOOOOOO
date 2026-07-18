-- ------------------------------------------------------------------
-- Migração: gestão económica
-- ------------------------------------------------------------------
-- Adiciona a coluna `valor` (euros) à tabela de eventos, usada para o
-- resumo financeiro (receitas de vendas, despesas de compras/vacinas/
-- medicamentos). Idempotente — pode correr-se mais do que uma vez.
--
-- Correr UMA vez no SQL Editor do Supabase (só necessário em bases já
-- criadas antes desta funcionalidade; instalações novas já vêm com a
-- coluna via schema.sql).

alter table public.evento
  add column if not exists valor numeric;
