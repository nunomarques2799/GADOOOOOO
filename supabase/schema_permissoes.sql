-- ==================================================================
-- Terrabovina — permissões por PESSOA, por cima do papel (v8)
-- ==================================================================
-- Aplica DEPOIS de todos os anteriores (ver MIGRACOES.md) — em especial de
-- schema_roles.sql (papéis), schema_suspensao.sql (as políticas de escrita que
-- este ficheiro substitui), schema_eliminar.sql (o RPC `eliminar_animal`) e
-- schema_financas_opcional.sql (as políticas de `movimento` mais recentes).
-- Idempotente: seguro para correr mais que uma vez.
--
-- O QUE ISTO TRAZ
-- O papel dizia tudo: um trabalhador podia sempre mexer em terrenos e apagar
-- animais, um veterinário nunca. Numa exploração a sério as pessoas não vêm
-- nesses dois moldes — há o vizinho que só vem à ordenha e não tem de poder
-- apagar registos, e há o veterinário de anos que bem pode mudar o gado de
-- terreno. Sem forma de afinar, a única saída era dar o papel maior e confiar.
--
-- Passa a haver uma coluna `permissoes` (jsonb) em `membro_exploracao` com as
-- EXCEÇÕES de cada pessoa: `{"eliminarAnimais": false}`. O que não estiver lá
-- segue o papel — de propósito, para que mudar a regra de um papel continue a
-- alcançar quem nunca foi afinado à mão.
--
-- PORQUE É QUE ISTO TEM DE ESTAR NO SERVIDOR
-- A app já esconde botões por papel (`src/data/permissoes.ts`). Esconder não é
-- impedir, e nesta app menos ainda: as escritas feitas sem rede ficam numa fila
-- e sobem depois (ver `cacheLocal.ts`). Uma permissão que vivesse só na
-- interface deixava passar tudo o que fosse feito offline, e a recusa — se
-- existisse — aparecia horas mais tarde, longe de quem a provocou. Quem decide
-- é a RLS; a tabela da app é só para não mostrar botões que ela vai recusar.
--
-- O QUE NÃO SE AJUSTA
-- `editarExploracao`, `eliminarExploracao` e `gerirEquipa` não entram na lista
-- das ajustáveis: são de quem responde pela exploração. Se entrassem, um
-- convidado podia receber a permissão de convidar (e promover-se a si mesmo por
-- interposta pessoa) ou de apagar a exploração inteira. Nem o `admin` se
-- ajusta: uma exploração tem de ficar sempre com alguém que lhe consiga mexer.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. A coluna das exceções
-- ------------------------------------------------------------------
alter table public.membro_exploracao
  add column if not exists permissoes jsonb not null default '{}'::jsonb;


-- ------------------------------------------------------------------
-- 2. Quais são as capacidades, e quais se podem ajustar
-- ------------------------------------------------------------------
-- Espelha `CAPACIDADES_GERIVEIS` em `src/data/permissoes.ts`. Mexer numa das
-- listas obriga a mexer na outra (e no `permissoes.test.ts`).
-- O `search_path` vazio nesta e nas três seguintes é o que o linter do Supabase
-- pede (`function_search_path_mutable`): nenhuma delas lê tabelas, por isso o
-- caminho mais apertado serve. Ver `schema_lint.sql`.
create or replace function public.capacidade_gerivel(cap text)
returns boolean language sql immutable set search_path = '' as $$
  select cap = any (array[
    'gerirTerrenos',
    'editarAnimais',
    'registarSaida',
    'eliminarAnimais',
    'registarDespesa',
    'registarReceita',
    'registarCustoTratamento'
  ]);
$$;

-- O que cada papel pode de origem. Espelha a tabela `PERMISSOES` da app.
create or replace function public.role_padrao_pode(r public.role_membro, cap text)
returns boolean language sql immutable set search_path = '' as $$
  select case r
    when 'admin' then true
    when 'trabalhador' then cap = any (array[
      'gerirTerrenos', 'editarAnimais', 'eliminarAnimais', 'registarSaida',
      'registarDespesa', 'registarCustoTratamento'
    ])
    when 'veterinario' then cap = any (array[
      'editarAnimais', 'registarSaida', 'registarCustoTratamento'
    ])
    else false
  end;
$$;

-- A exceção guardada, se for mesmo um verdadeiro/falso. Devolve NULL quando não
-- há exceção — o que faz o `coalesce` mais abaixo cair no valor do papel.
--
-- O `jsonb_typeof` não é zelo a mais: sem ele, um `"sim"` escrito à mão na
-- coluna fazia o cast rebentar DENTRO de uma política de RLS, e o erro que a app
-- recebia era um erro de sintaxe de tipos a falar de uma leitura de animais.
create or replace function public.ajuste_permissao(p jsonb, cap text)
returns boolean language sql immutable set search_path = '' as $$
  select case
    when p is not null and jsonb_typeof(p -> cap) = 'boolean'
      then (p -> cap)::text::boolean
  end;
$$;

-- Só chaves conhecidas, só booleanos. A app já limpa isto antes de gravar (ver
-- `definirPermissoes`), mas a coluna é jsonb e aceita qualquer coisa: uma chave
-- mal escrita — `eliminaAnimais` em vez de `eliminarAnimais` — ficava gravada,
-- sem erro, a não fazer absolutamente nada. O dono via o interruptor desligado
-- e a pessoa continuava a apagar animais.
create or replace function public.permissoes_membro_validas(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and not exists (
      select 1 from jsonb_each(p) e
      where not public.capacidade_gerivel(e.key)
         or jsonb_typeof(e.value) <> 'boolean'
    )
  );
$$;

do $$ begin
  alter table public.membro_exploracao
    add constraint membro_permissoes_validas
    check (public.permissoes_membro_validas(permissoes));
exception when duplicate_object then null; end $$;


-- ------------------------------------------------------------------
-- 3. A pergunta que as políticas passam a fazer
-- ------------------------------------------------------------------
-- `pode_cap(exploracao, capacidade)` junta as três camadas na ordem certa:
--   1. superadmin passa sempre (tem de poder assistir um cliente);
--   2. `pode_escrever_em()` — conta ativa e exploração de dono ativo
--      (schema_suspensao.sql); uma conta suspensa não escreve, nem sendo dona;
--   3. o papel, com a exceção da pessoa por cima.
--
-- Sem membro nenhum na exploração o `coalesce` dá `false`: quem não é da equipa
-- não escreve, o que já era o efeito das políticas antigas.
create or replace function public.pode_cap(exp_id text, cap text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select public.eh_superadmin() or (
    public.pode_escrever_em(exp_id)
    and coalesce((
      select case
        -- O dono não se ajusta, e o que não é ajustável segue sempre o papel.
        when m.role = 'admin' or not public.capacidade_gerivel(cap)
          then public.role_padrao_pode(m.role, cap)
        else coalesce(
          public.ajuste_permissao(m.permissoes, cap),
          public.role_padrao_pode(m.role, cap)
        )
      end
      from public.membro_exploracao m
      where m.exploracao_id = exp_id and m.user_id = auth.uid()
      limit 1
    ), false)
  );
$$;


-- ------------------------------------------------------------------
-- 4. TERRENO — passa a depender de `gerirTerrenos`
-- ------------------------------------------------------------------
-- A leitura (`terreno_membros_read`, de schema_roles.sql) fica como está: quem
-- é da equipa vê os terrenos, mesmo sem os poder mudar.
drop policy if exists terreno_maneio_write on public.terreno;
create policy terreno_maneio_write on public.terreno
  for all using (
    public.pode_cap(exploracao_id, 'gerirTerrenos')
  ) with check (
    public.pode_cap(exploracao_id, 'gerirTerrenos')
  );


-- ------------------------------------------------------------------
-- 5. ANIMAL — escrever, e apagar, são permissões diferentes
-- ------------------------------------------------------------------
-- Nota sobre o UPDATE: marcar a saída de um animal (falecido/vendido) é também
-- um update da linha, e não há como uma política distinguir "corrigir a ficha"
-- de "registar a morte" sem comparar coluna a coluna o antes com o depois. Por
-- isso o UPDATE aceita quem tenha UMA das duas — e é a app que não deixa
-- registar a saída a quem só tem `editarAnimais`. É a única capacidade em que a
-- interface é mais estreita do que o servidor, e fica dito aqui para não passar
-- por engano.
drop policy if exists animal_insere on public.animal;
create policy animal_insere on public.animal
  for insert with check (public.pode_cap(exploracao_id, 'editarAnimais'));

drop policy if exists animal_atualiza on public.animal;
create policy animal_atualiza on public.animal
  for update using (
    public.pode_cap(exploracao_id, 'editarAnimais')
    or public.pode_cap(exploracao_id, 'registarSaida')
  ) with check (
    public.pode_cap(exploracao_id, 'editarAnimais')
    or public.pode_cap(exploracao_id, 'registarSaida')
  );

-- Apagar leva o histórico atrás (e só é possível sem histórico nenhum — ver
-- schema_eliminar.sql). Fica com quem tiver `eliminarAnimais`.
drop policy if exists animal_elimina on public.animal;
create policy animal_elimina on public.animal
  for delete using (public.pode_cap(exploracao_id, 'eliminarAnimais'));


-- ------------------------------------------------------------------
-- 6. EVENTO — segue o animal a que pertence
-- ------------------------------------------------------------------
drop policy if exists evento_insere on public.evento;
create policy evento_insere on public.evento
  for insert with check (
    exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and (
          public.pode_cap(a.exploracao_id, 'editarAnimais')
          -- A saída cria automaticamente um evento de Morte/Venda.
          or public.pode_cap(a.exploracao_id, 'registarSaida')
        )
    )
  );

drop policy if exists evento_atualiza on public.evento;
create policy evento_atualiza on public.evento
  for update using (
    exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and (
          public.pode_cap(a.exploracao_id, 'editarAnimais')
          or public.pode_cap(a.exploracao_id, 'registarSaida')
        )
    )
  ) with check (
    exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and (
          public.pode_cap(a.exploracao_id, 'editarAnimais')
          or public.pode_cap(a.exploracao_id, 'registarSaida')
        )
    )
  );

drop policy if exists evento_elimina on public.evento;
create policy evento_elimina on public.evento
  for delete using (
    exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and public.pode_cap(a.exploracao_id, 'eliminarAnimais')
    )
  );


-- ------------------------------------------------------------------
-- 7. MOVIMENTO — despesas e receitas são permissões separadas
-- ------------------------------------------------------------------
-- Continua a exigir a gestão económica ligada na exploração
-- (schema_financas_opcional.sql), e continua a exigir que quem não é dono lance
-- em nome próprio: sem o `criado_por = auth.uid()`, um trabalhador lançava em
-- nome do dono e escapava ao filtro de leitura, que é o que lhe mostra o que
-- ele próprio lançou e mais nada.
drop policy if exists movimento_insert on public.movimento;
create policy movimento_insert on public.movimento
  for insert with check (
    public.eh_superadmin()
    or (
      public.financas_ativas_em(exploracao_id)
      and (public.role_em(exploracao_id) = 'admin' or criado_por = auth.uid())
      and (
        (direcao = 'despesa' and public.pode_cap(exploracao_id, 'registarDespesa'))
        or (direcao = 'receita' and public.pode_cap(exploracao_id, 'registarReceita'))
      )
    )
  );

drop policy if exists movimento_update on public.movimento;
create policy movimento_update on public.movimento
  for update using (
    public.eh_superadmin()
    or public.role_em(exploracao_id) = 'admin'
    or (public.membro_de(exploracao_id) and criado_por = auth.uid())
  ) with check (
    public.eh_superadmin()
    or (
      public.financas_ativas_em(exploracao_id)
      and (public.role_em(exploracao_id) = 'admin' or criado_por = auth.uid())
      and (
        (direcao = 'despesa' and public.pode_cap(exploracao_id, 'registarDespesa'))
        or (direcao = 'receita' and public.pode_cap(exploracao_id, 'registarReceita'))
      )
    )
  );

-- Apagar dinheiro da conta fica com o dono, como estava: não é ajustável.


-- ------------------------------------------------------------------
-- 8. O RPC de eliminar animal valida o mesmo
-- ------------------------------------------------------------------
-- `eliminar_animal` é SECURITY DEFINER: passa por cima da RLS, e por isso a
-- verificação é feita à mão lá dentro. Sem esta parte, tirar a permissão de
-- apagar animais a alguém não tinha efeito nenhum — a app usa este caminho, e
-- não o `delete` direto (que está revogado).
create or replace function public.eliminar_animal(animal_id text)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  a public.animal%rowtype;
  n_eventos int;
  n_crias int;
begin
  select * into a from public.animal where id = animal_id;
  if not found then
    raise exception 'Este animal já não existe.';
  end if;

  -- Duas verificações, para o criador saber qual delas o travou.
  if not public.pode_escrever_em(a.exploracao_id) then
    raise exception 'A conta está suspensa, ou não tem acesso a esta exploração.';
  end if;
  if not public.pode_cap(a.exploracao_id, 'eliminarAnimais') then
    raise exception 'Não tem permissão para eliminar animais nesta exploração.';
  end if;

  select count(*) into n_eventos from public.evento e where e.animal_id = a.id;
  if n_eventos > 0 then
    raise exception
      'Este animal tem % registo(s) no histórico. Marque a saída (falecido ou vendido) em vez de eliminar.',
      n_eventos;
  end if;

  select count(*) into n_crias
    from public.animal f where f.mae_id = a.id or f.pai_id = a.id;
  if n_crias > 0 then
    raise exception
      'Este animal é progenitor de % animal(is) registado(s). Marque a saída em vez de eliminar, para não partir a árvore genealógica.',
      n_crias;
  end if;

  delete from public.animal where id = a.id;
end;
$$;


-- ------------------------------------------------------------------
-- 9. Quem pode executar o quê
-- ------------------------------------------------------------------
revoke execute on function public.pode_cap(text, text) from anon, public;
grant  execute on function public.pode_cap(text, text) to authenticated;
grant  execute on function public.capacidade_gerivel(text) to authenticated;
grant  execute on function public.role_padrao_pode(public.role_membro, text) to authenticated;
grant  execute on function public.ajuste_permissao(jsonb, text) to authenticated;
grant  execute on function public.permissoes_membro_validas(jsonb) to authenticated;
revoke execute on function public.eliminar_animal(text) from anon, public;
grant  execute on function public.eliminar_animal(text) to authenticated;

-- Coluna nova → a API tem de reler o schema, senão a app recebe
-- "Could not find the 'permissoes' column of 'membro_exploracao' in the schema
-- cache" e o erro diz "não existe" sobre uma coluna que existe.
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. A tabela ganhou a coluna, com `{}` em todas as linhas:
--
--   select role, permissoes from public.membro_exploracao order by role;
--
-- 2. Os valores de partida batem com a app (true/false pela ordem esperada):
--
--   select public.role_padrao_pode('trabalhador','gerirTerrenos')  as t_terrenos,   -- t
--          public.role_padrao_pode('veterinario','gerirTerrenos')  as v_terrenos,   -- f
--          public.role_padrao_pode('veterinario','editarAnimais')  as v_animais,    -- t
--          public.role_padrao_pode('trabalhador','registarReceita') as t_receitas;  -- f
--
-- 3. A restrição recusa lixo (as três primeiras têm de falhar, a última passar):
--
--   update public.membro_exploracao set permissoes = '{"eliminaAnimais": false}';
--   update public.membro_exploracao set permissoes = '{"eliminarAnimais": "nao"}';
--   update public.membro_exploracao set permissoes = '{"gerirEquipa": true}';
--   update public.membro_exploracao set permissoes = '{"eliminarAnimais": false}'
--    where role = 'trabalhador';
--
-- 4. E o efeito, na conta do próprio trabalhador (não na do dono — `pode_cap`
--    responde sobre `auth.uid()`): com a linha acima gravada, apagar um animal
--    dessa exploração passa a dar "Não tem permissão para eliminar animais".
--
-- 5. As políticas ficam a apontar todas para `pode_cap`:
--
--   select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public'
--      and qual like '%pode_cap%' or with_check like '%pode_cap%'
--    order by tablename, cmd;
