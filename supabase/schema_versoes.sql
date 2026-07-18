-- ==================================================================
-- Gestão de Gado — versão das linhas, para deteção de conflitos (v6)
-- ==================================================================
-- Aplica DEPOIS dos anteriores. Idempotente.
--
-- O problema: as escritas são `upsert` da linha inteira e a leitura substitui
-- o estado local pelo do servidor. Com duas pessoas na mesma exploração — que
-- é exatamente o que os papéis de trabalhador e veterinário criam — quem
-- sincroniza por último apaga o trabalho do outro, campo a campo, sem que
-- ninguém saiba. E como uma delas pode ter estado horas sem rede, a janela
-- para isso acontecer não é de milissegundos: é de uma manhã inteira.
--
-- A coluna `updated_at` já existia em todas as tabelas, mas com
-- `default now()` e SEM TRIGGER: era preenchida no insert e nunca mais
-- mexida. Como marcador de versão não servia para nada. Este ficheiro
-- passa a mantê-la a cada UPDATE, que é o que permite ao cliente dizer
-- "só grava se ninguém tiver mexido desde a versão que eu vi".
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Trigger que marca a hora a cada alteração
-- ------------------------------------------------------------------
-- SECURITY INVOKER (o default): isto não precisa de privilégios especiais,
-- só de correr no contexto de quem escreve.
create or replace function public.toca_updated_at()
returns trigger language plpgsql as $$
begin
  -- Ignora o que o cliente tenha mandado nesta coluna: a versão é do
  -- servidor, senão um relógio mal acertado no telemóvel partia a deteção.
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['exploracao', 'terreno', 'animal', 'evento'] loop
    execute format('drop trigger if exists trg_updated_at on public.%I;', t);
    execute format(
      'create trigger trg_updated_at before update on public.%I
         for each row execute function public.toca_updated_at();', t);
  end loop;
end $$;


-- ------------------------------------------------------------------
-- 2. Preencher as linhas que ficaram sem versão
-- ------------------------------------------------------------------
-- Linhas criadas antes de a coluna existir podem ter `updated_at` nulo. Uma
-- versão nula faria o filtro `lte` nunca encontrar a linha, e todas as
-- gravações sobre ela pareceriam conflito. Damos-lhes uma versão inicial.
update public.exploracao set updated_at = now() where updated_at is null;
update public.terreno     set updated_at = now() where updated_at is null;
update public.animal      set updated_at = now() where updated_at is null;
update public.evento      set updated_at = now() where updated_at is null;


-- ------------------------------------------------------------------
-- 3. Índices — o filtro de versão entra em todas as gravações
-- ------------------------------------------------------------------
-- A condição é sempre `id = ? and updated_at <= ?`. O índice da chave
-- primária já resolve o `id`; estes ajudam as leituras por data.
create index if not exists idx_animal_updated  on public.animal  (updated_at);
create index if not exists idx_evento_updated  on public.evento  (updated_at);


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- Os quatro triggers têm de aparecer:
--
--   select event_object_table, trigger_name, action_timing, event_manipulation
--     from information_schema.triggers
--    where trigger_name = 'trg_updated_at'
--    order by event_object_table;
--
-- E nenhuma linha pode ficar sem versão:
--
--   select 'exploracao' t, count(*) from public.exploracao where updated_at is null
--   union all select 'terreno', count(*) from public.terreno where updated_at is null
--   union all select 'animal',  count(*) from public.animal  where updated_at is null
--   union all select 'evento',  count(*) from public.evento  where updated_at is null;
