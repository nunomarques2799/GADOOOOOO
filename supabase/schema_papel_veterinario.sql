-- ==================================================================
-- Terrabovina — o veterinário passa a ser uma visita, não um segundo dono
-- ==================================================================
-- Aplica DEPOIS de schema_permissoes.sql (13) e schema_acesso_temporario.sql
-- (15). Idempotente.
--
-- O QUE ESTAVA ERRADO
--
-- O veterinário tinha `editarAnimais`, e essa capacidade queria dizer duas
-- coisas ao mesmo tempo: **corrigir a ficha** do animal (nome, brinco, raça,
-- datas de nascimento, o terreno onde anda) e **registar um tratamento** (uma
-- vacina, um medicamento, um parto, uma pesagem).
--
-- São coisas diferentes e uma delas não é dele. Quem vem à exploração uma manhã
-- não tem que poder trocar o brinco de um animal, mudá-lo de courela ou
-- corrigir a data de nascimento que o dono registou — e, com `registarSaida`,
-- podia até dá-lo por morto ou vendido. Nenhuma dessas coisas é ato
-- veterinário; todas são difíceis de descobrir depois.
--
-- O QUE MUDA
--
-- Nasce a capacidade **`registarTratamentos`**, que é só o que a palavra diz:
-- escrever eventos na ficha de um animal, sem lhe tocar na ficha. O
-- veterinário fica com ela e com o `registarCustoTratamento` (pôr o preço do
-- que acabou de dar), e mais nada.
--
--   antes: editarAnimais, registarSaida, registarCustoTratamento
--   agora: registarTratamentos, registarCustoTratamento
--
-- O trabalhador GANHA a capacidade nova além da que já tinha — para ele nada se
-- fecha: quem podia corrigir a ficha continua a poder, e passa a ter o registo
-- de tratamentos escrito à parte em vez de embrulhado no mesmo interruptor.
--
-- E as explorações deixam de se criar a partir de uma conta convidada (secção
-- 4): quem entrou por um código de outra pessoa não vem para abrir quinta.
--
-- O QUE **NÃO** MUDA, E PORQUÊ
--
-- O veterinário continua a LER tudo o que a exploração tem: os animais, o
-- histórico, os terrenos. Sem isso não consegue trabalhar — precisa de ver o
-- que já foi dado àquele animal antes de lhe dar seja o que for. O que a app
-- lhe fecha a mais (as abas Finanças e Documentos) é decisão da interface: as
-- contas já lhe estavam fechadas pela RLS, e os Documentos só reempacotam
-- dados que ele pode ler de qualquer maneira.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. A capacidade nova
-- ------------------------------------------------------------------
-- Ajustável pessoa a pessoa, como as outras do dia a dia: há donos que querem
-- um veterinário só de consulta, e há quem confie no vizinho para apontar uma
-- pesagem. Espelha `CAPACIDADES_GERIVEIS` em `src/data/permissoes.ts`.
create or replace function public.capacidade_gerivel(cap text)
returns boolean language sql immutable set search_path = '' as $$
  select cap = any (array[
    'gerirTerrenos',
    'editarAnimais',
    'registarTratamentos',
    'registarSaida',
    'eliminarAnimais',
    'registarDespesa',
    'registarReceita',
    'registarCustoTratamento'
  ]);
$$;


-- ------------------------------------------------------------------
-- 2. Os conjuntos de origem de cada papel
-- ------------------------------------------------------------------
-- Espelha a tabela `PERMISSOES` da app. Mexer aqui obriga a mexer lá (e no
-- `permissoes.test.ts`).
create or replace function public.role_padrao_pode(r public.role_membro, cap text)
returns boolean language sql immutable set search_path = '' as $$
  select case r
    when 'admin' then true
    when 'trabalhador' then cap = any (array[
      'gerirTerrenos', 'editarAnimais', 'registarTratamentos', 'eliminarAnimais',
      'registarSaida', 'registarDespesa', 'registarCustoTratamento'
    ])
    -- O veterinário trata dos animais e não do património: escreve o que fez,
    -- e não mexe na ficha, nos terrenos, na equipa nem nas contas.
    when 'veterinario' then cap = any (array[
      'registarTratamentos', 'registarCustoTratamento'
    ])
    else false
  end;
$$;


-- ------------------------------------------------------------------
-- 3. Escrever um evento deixa de exigir poder editar a ficha
-- ------------------------------------------------------------------
-- As três políticas de `evento` passam a aceitar também quem tenha só
-- `registarTratamentos`. As de `animal` NÃO se tocam — é justamente por elas
-- continuarem a pedir `editarAnimais` (ou `registarSaida`, para a morte/venda)
-- que o veterinário deixa de poder corrigir a ficha e de mudar o animal de
-- terreno, que é um `update` da coluna `terreno_id` como qualquer outro.
drop policy if exists evento_insere on public.evento;
create policy evento_insere on public.evento
  for insert with check (
    exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and (
          public.pode_cap(a.exploracao_id, 'editarAnimais')
          or public.pode_cap(a.exploracao_id, 'registarTratamentos')
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
          or public.pode_cap(a.exploracao_id, 'registarTratamentos')
          or public.pode_cap(a.exploracao_id, 'registarSaida')
        )
    )
  ) with check (
    exists (
      select 1 from public.animal a
      where a.id = evento.animal_id
        and (
          public.pode_cap(a.exploracao_id, 'editarAnimais')
          or public.pode_cap(a.exploracao_id, 'registarTratamentos')
          or public.pode_cap(a.exploracao_id, 'registarSaida')
        )
    )
  );

-- Apagar continua a ser de quem gere o efetivo (`eliminarAnimais`): um
-- tratamento mal registado corrige-se, não se faz desaparecer.


-- ------------------------------------------------------------------
-- 4. Uma conta convidada não abre quinta
-- ------------------------------------------------------------------
-- "Convidado" é quem tem vínculos e nenhum deles é de dono. A pergunta é feita
-- assim, e não "é veterinário?", porque o que importa não é o papel: é a conta
-- ter entrado pela porta de outra pessoa. Um veterinário que também tenha a sua
-- exploração é admin nalgum lado e continua a criar as que quiser.
--
-- Uma conta NOVA, sem vínculo nenhum, não é convidada — e tem de continuar a
-- poder criar a primeira exploração, senão ninguém entra na app.
--
-- Os vínculos expirados contam como vínculos de propósito: o veterinário cujo
-- acesso caiu ontem continua a ser uma visita, e a alternativa era ele ganhar o
-- direito de criar explorações no instante exato em que o prazo acabou.
create or replace function public.eh_convidado()
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (select 1 from public.membro_exploracao where user_id = auth.uid())
     and not exists (
       select 1 from public.membro_exploracao
        where user_id = auth.uid() and role = 'admin'
     );
$$;

revoke execute on function public.eh_convidado() from anon, public;
grant  execute on function public.eh_convidado() to authenticated;

drop policy if exists exploracao_ativo_insert on public.exploracao;
create policy exploracao_ativo_insert on public.exploracao
  for insert with check (
    auth.uid() = user_id
    and public.perfil_ativo()
    and not public.eh_convidado()
  );


-- ------------------------------------------------------------------
-- 5. Os ajustes que o dono já tinha feito à mão
-- ------------------------------------------------------------------
-- Um veterinário a quem o dono tenha LIGADO explicitamente o `editarAnimais` na
-- folha de permissões continua a poder editar fichas depois deste ficheiro: o
-- ajuste por pessoa ganha sempre ao valor do papel, e é para isso que ele
-- existe. Não se apaga nada aqui — desfazer em silêncio uma decisão que o dono
-- tomou é pior do que a decisão.
--
-- Para VER se existe algum caso desses nesta base:
--
--   select m.user_id, m.exploracao_id, m.permissoes
--     from public.membro_exploracao m
--    where m.role = 'veterinario'
--      and (m.permissoes ? 'editarAnimais' or m.permissoes ? 'registarSaida');
--
-- E, se se quiser mesmo repor o padrão novo nesses casos (decisão do dono, não
-- desta migração — por isso está comentado):
--
--   update public.membro_exploracao
--      set permissoes = permissoes - 'editarAnimais' - 'registarSaida'
--    where role = 'veterinario';


-- ------------------------------------------------------------------
-- Função nova: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Os conjuntos de origem ficaram como se quer:
--
--   select public.role_padrao_pode('veterinario','registarTratamentos') as v_trata,   -- t
--          public.role_padrao_pode('veterinario','editarAnimais')       as v_ficha,   -- f
--          public.role_padrao_pode('veterinario','registarSaida')       as v_saida,   -- f
--          public.role_padrao_pode('trabalhador','registarTratamentos') as t_trata,   -- t
--          public.role_padrao_pode('trabalhador','editarAnimais')       as t_ficha;   -- t
--
-- 2. Na sessão de um VETERINÁRIO (ver `gado-provar-rls-psql`), dentro de uma
--    transação com rollback:
--
--    - escrever um evento tem de FUNCIONAR;
--    - `update public.animal set nome = …` tem de afetar 0 linhas (a RLS não dá
--      erro num update que não encontra linha nenhuma — é preciso olhar para o
--      "UPDATE 0");
--    - `update public.animal set terreno_id = …` idem;
--    - `insert into public.exploracao …` tem de dar "new row violates row-level
--      security policy".
--
-- 3. E que ao TRABALHADOR não se fechou nada: os mesmos três updates têm de
--    continuar a afetar 1 linha.
