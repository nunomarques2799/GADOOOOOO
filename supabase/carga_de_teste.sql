-- ==================================================================
-- Terrabovina — CARGA de teste (milhares de animais)
-- ==================================================================
-- Irmão do `dados_de_teste.sql`, com outro objetivo. Aquele cria 28 animais
-- escolhidos à mão para cada ecrã e cada filtro terem um caso que mostre. Este
-- cria MILHARES, gerados por fórmula, para responder a outra pergunta: a app
-- aguenta um efetivo grande? A lista, a pesquisa, os filtros, a cache local no
-- arranque e a sincronização são coisas que só partem com volume.
--
-- ------------------------------------------------------------------
-- SEGURANÇA — porque é que este ficheiro pode correr em PRODUÇÃO
-- ------------------------------------------------------------------
-- O `dados_de_teste.sql` proíbe-se a si próprio em produção, e com razão: ele
-- escreve no `perfil` (chega a pôr `is_superadmin = false`) e mistura-se com o
-- efetivo real. Este não faz nem uma coisa nem outra:
--
--   · NÃO toca na tabela `perfil`. Nem no estado, nem no papel, nem nas
--     opções. Lê-a para se defender, e mais nada.
--   · Escreve SÓ com o `user_id` da conta indicada. Nenhuma linha de outro
--     utilizador é lida, alterada ou apagada.
--   · Tudo o que cria leva o prefixo `carga-`, por isso a limpeza no fim é
--     exata e não pode levar à frente nada registado à mão na app.
--   · Recusa-se a correr se a conta for de superadmin, ou se já tiver
--     qualquer coisa que não tenha sido criada por ele.
--
-- Mesmo assim: **fazer a cópia de segurança antes** (`scripts/backup.ps1
-- -Ambiente prod`). A guarda protege do erro previsto; a cópia protege do
-- outro.
--
-- ------------------------------------------------------------------
-- COMO CORRER
-- ------------------------------------------------------------------
--   psql "<ligacao>" --single-transaction -v ON_ERROR_STOP=1 -f carga_de_teste.sql
--
-- O `--single-transaction` não é um detalhe: sem ele, uma falha a meio deixa
-- 3000 animais e nenhum evento, que é pior do que não ter corrido nada.
--
-- Correr pelo SQL Editor do Supabase também funciona (é uma transação só).
--
-- ------------------------------------------------------------------
-- O QUE CRIA
-- ------------------------------------------------------------------
--   4 explorações · 16 terrenos · 5000 animais · ~13 000 eventos
--
-- Os animais não são todos iguais de propósito: há as cinco espécies, os dois
-- sexos, todas as faixas de idade, animais sem brinco (alerta de
-- identificação), SNIRA por comunicar, fêmeas com parto previsto, animais em
-- intervalo de segurança e animais já saídos do efetivo. Uma carga uniforme
-- media a velocidade das listas e não provava mais nada.
--
-- Datas relativas a `current_date`, para os alertas continuarem a fazer
-- sentido daqui a uns meses.
--
-- A limpeza está no fim do ficheiro.
-- ==================================================================

do $$
declare
  -- <<<< A conta a encher.
  email_alvo text := 'nunomarques271999@gmail.com';
  n_animais  int  := 5000;

  uid            uuid;
  e_superadmin   boolean;
  n_alheios      int;
  n_criados      int;
  maes           text[];
  pais           text[];
  -- `idx_exp` e não `e`: o PL/pgSQL substitui variáveis dentro do SQL, e uma
  -- variável `e` com o mesmo nome do alias de coluna `e` faz a consulta
  -- rebentar com "reference is ambiguous".
  idx_exp        int;

  racas_bovino  text[] := array['Alentejana','Arouquesa','Barrosã','Cachena','Charolesa',
                                'Frísia (Holstein)','Limousine','Maronesa','Mertolenga','Minhota',
                                'Mirandesa','Angus','Jersey','Simental','Marinhoa'];
  racas_ovino   text[] := array['Serra da Estrela','Merino Branco','Merino Preto','Churra Algarvia',
                                'Saloia','Texel','Suffolk','Campaniça'];
  racas_caprino text[] := array['Serrana','Charnequeira','Algarvia','Bravia','Saanen','Alpina'];
  racas_suino   text[] := array['Bísaro','Alentejano (Porco Preto)','Duroc','Landrace','Large White'];
  racas_equideo text[] := array['Lusitano','Sorraia','Garrano','Burro de Miranda'];

  pelagens text[] := array['Preta','Branca','Castanha','Vermelha','Amarela','Cinzenta',
                           'Malhada','Barrosa','Ruça','Pia','Fusca','Rosilha'];

  -- Repetem-se ao longo dos 5000, e é assim mesmo: numa exploração grande os
  -- nomes repetem-se e quem procura "Mimosa" tem de conseguir lidar com trinta
  -- resultados. É parte do que se está a testar.
  nomes_f text[] := array['Mimosa','Estrela','Boneca','Rosa','Malhada','Aurora','Canela','Pinta',
                          'Condessa','Duquesa','Formosa','Jóia','Linda','Nobre','Pérola','Rainha',
                          'Serena','Violeta','Amora','Bela','Chica','Dália','Faísca','Gaivota',
                          'Íris','Lua','Meiga','Oliva','Pombinha','Ruiva','Sereia','Uva','Bonita',
                          'Neve','Moura','Galante','Tulipa','Hera'];
  nomes_m text[] := array['Gerês','Trovão','Brioso','Farrusco','Bravo','Lueiro','Vento','Marquês',
                          'Barão','Corisco','Diamante','Escuro','Fidalgo','Garboso','Herói',
                          'Justo','Lidador','Maestro','Orgulho','Príncipe','Ronco','Sultão',
                          'Tenente','Valente','Ruço','Nevoeiro'];
begin
  -- ----------------------------------------------------------------
  -- 0. Guardas
  -- ----------------------------------------------------------------
  select id into uid from auth.users where email = email_alvo;
  if uid is null then
    raise exception 'Não existe nenhuma conta com o email %.', email_alvo;
  end if;

  -- Encher a conta de administração de gado inventado deixava o painel de
  -- superadmin inútil justamente para quem tem de o usar para aprovar clientes.
  select is_superadmin into e_superadmin from public.perfil where id = uid;
  if coalesce(e_superadmin, false) then
    raise exception 'A conta % é de SUPERADMIN. Usa uma conta de cliente.', email_alvo;
  end if;

  -- A guarda que interessa a sério em produção: nunca misturar 5000 animais
  -- inventados com o efetivo de alguém. Depois de misturados, separá-los é
  -- trabalho manual — e o criador não tem como saber quais são quais.
  select count(*) into n_alheios
    from public.exploracao where user_id = uid and id not like 'carga-%';
  if n_alheios > 0 then
    raise exception
      'A conta % já tem % exploração(ões) que não são desta carga. Recuso-me a misturar.',
      email_alvo, n_alheios;
  end if;

  raise notice 'Conta % (id %) — validada.', email_alvo, uid;

  -- ----------------------------------------------------------------
  -- 1. Limpar uma carga anterior
  -- ----------------------------------------------------------------
  -- Pelo prefixo E pelo dono: as duas condições juntas fazem com que uma
  -- distração no email não chegue para apagar dados de outra pessoa.
  delete from public.evento     where id like 'carga-%' and user_id = uid;
  delete from public.animal     where id like 'carga-%' and user_id = uid;
  delete from public.terreno    where id like 'carga-%' and user_id = uid;
  delete from public.membro_exploracao
        where exploracao_id like 'carga-%' and user_id = uid;
  delete from public.exploracao where id like 'carga-%' and user_id = uid;

  -- ----------------------------------------------------------------
  -- 2. Explorações
  -- ----------------------------------------------------------------
  insert into public.exploracao (id, user_id, nome, marca_exploracao, nif_detentor, localizacao) values
    ('carga-exp-1', uid, 'Herdade do Vale Escuro', 'PT 61 101 0001', '509876543', 'Idanha-a-Nova, Castelo Branco'),
    ('carga-exp-2', uid, 'Monte da Pedra Alta',    'PT 61 102 0002', '509876543', 'Penamacor, Castelo Branco'),
    ('carga-exp-3', uid, 'Quinta dos Freixos',     'PT 61 103 0003', '509876543', 'Sabugal, Guarda'),
    ('carga-exp-4', uid, 'Courela da Ribeira',     'PT 61 104 0004', '509876543', 'Nisa, Portalegre');

  -- O trigger `on_exploracao_created` já faz isto. Repete-se à mão porque a
  -- RLS de leitura é `membro_de(id)` e não o `user_id`: sem esta linha as
  -- explorações existem na base e a app abre VAZIA — uma falha que não dá erro
  -- nenhum e por isso custa muito a diagnosticar.
  insert into public.membro_exploracao (user_id, exploracao_id, role)
  select uid, e.id, 'admin' from public.exploracao e where e.id like 'carga-exp-%'
  on conflict (user_id, exploracao_id) do update set role = 'admin';

  -- ----------------------------------------------------------------
  -- 3. Terrenos (4 por exploração)
  -- ----------------------------------------------------------------
  insert into public.terreno (id, user_id, exploracao_id, nome, tipo, area, descricao, latitude, longitude)
  select
    'carga-ter-' || x.e || '-' || x.t,
    uid,
    'carga-exp-' || x.e,
    (array['Lameiro','Chão da Fonte','Bouça','Cerrado','Várzea','Encosta','Coutada','Tapada'])
      [1 + ((x.e - 1) * 4 + x.t - 1) % 8] || ' ' ||
      (array['do Norte','do Sul','Grande','Novo'])[x.t],
    (array['Pastagem','Pastagem','Misto','Cultivo'])[x.t],
    round((3 + ((x.e * 7 + x.t * 13) % 45) * 0.7)::numeric, 1)::double precision,
    (array['Água todo o ano','Sombra de sobreiros','Parte em mato','Semeado de aveia'])[x.t],
    39.90 + x.e * 0.08 + x.t * 0.01,
    -7.30 + x.e * 0.06 + x.t * 0.01
  from (select e, t from generate_series(1,4) e, generate_series(1,4) t) x;

  -- ----------------------------------------------------------------
  -- 4. Animais
  -- ----------------------------------------------------------------
  -- Distribuição pelas explorações: 40 / 25 / 20 / 15 %. Desigual de
  -- propósito — quatro explorações do mesmo tamanho não mostravam o que
  -- acontece quando se abre a maior.
  insert into public.animal (
    id, user_id, exploracao_id, terreno_id, nome, especie, sexo,
    data_nascimento, raca, cor_pelagem, casa, numero_casa, finalidade,
    numero_identificacao, data_identificacao, comunicado_snira,
    data_prevista_parto, fim_intervalo_seguranca, estado, data_saida, motivo_saida
  )
  select
    'carga-a-' || lpad(g.i::text, 5, '0'),
    uid,
    'carga-exp-' || g.e,
    case when g.i % 19 = 0 then null
         else 'carga-ter-' || g.e || '-' || (1 + (g.i / 7) % 4) end,
    -- ~1 em 3 tem nome. Nos outros o brinco é o nome, como numa exploração
    -- grande a sério.
    case when g.i % 3 <> 0 then null
         when g.sexo = 'Macho' then nomes_m[1 + (g.i * 31) % array_length(nomes_m, 1)]
         else nomes_f[1 + (g.i * 31) % array_length(nomes_f, 1)] end,
    g.especie,
    g.sexo,
    (current_date - g.idade)::text || 'T12:00:00.000Z',
    case g.especie
      when 'Bovino'  then racas_bovino [1 + (g.i * 17) % array_length(racas_bovino, 1)]
      when 'Ovino'   then racas_ovino  [1 + (g.i * 17) % array_length(racas_ovino, 1)]
      when 'Caprino' then racas_caprino[1 + (g.i * 17) % array_length(racas_caprino, 1)]
      when 'Suíno'   then racas_suino  [1 + (g.i * 17) % array_length(racas_suino, 1)]
      else                racas_equideo[1 + (g.i * 17) % array_length(racas_equideo, 1)]
    end,
    pelagens[1 + (g.i * 23) % array_length(pelagens, 1)],
    case when g.especie = 'Bovino'
         then (array['Casa do Alto','Casa do Souto','Casa Nova'])[1 + g.i % 3] end,
    case when g.especie = 'Bovino' then (1 + g.i % 60)::text end,
    -- Só a bovinos, e respeitando o sexo: um macho não é de "Criação" nem uma
    -- fêmea "Semental" (ver `finalidadesPara()` em constants.ts).
    case when g.especie <> 'Bovino' then null
         when g.idade < 400 then 'Recria'
         when g.sexo = 'Macho'
           then (array['Semental','Carne','Trabalho'])[1 + (g.i / 5) % 3]
         else (array['Leite','Criação','Carne'])[1 + (g.i / 5) % 3]
    end,
    -- ~1 em 15 sem brinco → alerta de identificação (a contar ou já vencido,
    -- consoante a idade).
    case when g.i % 15 = 0 then null
         else 'PT ' || (6100 + g.e) || ' ' || lpad(((g.i * 7) % 10000)::text, 4, '0')
              || ' ' || lpad((g.i % 10000)::text, 4, '0') end,
    case when g.i % 15 = 0 then null
         else (current_date - g.idade + 15)::text || 'T12:00:00.000Z' end,
    case when g.i % 15 = 0 then null else g.i % 11 <> 0 end,
    -- Fêmeas adultas cobertas: alimenta o alerta de parto previsto.
    --
    -- O módulo TEM de ser primo com o 4 do sexo. Com `i % 12` (a primeira
    -- versão) isto dava zero animais: todo o i ≡ 5 (mod 12) é também
    -- ≡ 1 (mod 4), que é exatamente a condição de ser macho — e a carga saía
    -- sem um único parto previsto, o alerta mais importante da app.
    case when g.sexo = 'Fêmea' and g.idade > 900 and g.i % 13 = 5
         then (current_date + (5 + (g.i * 13) % 250))::text || 'T12:00:00.000Z' end,
    -- Em intervalo de segurança (~2%): alerta de medicamento.
    case when g.i % 47 = 9
         then (current_date + (1 + (g.i * 7) % 18))::text || 'T12:00:00.000Z' end,
    g.estado,
    case when g.estado = 'ativo' then null
         else (current_date - (g.i * 3) % 300)::text || 'T12:00:00.000Z' end,
    case g.estado when 'vendido'  then 'Vendido em feira'
                  when 'falecido' then 'Doença'
                  else null end
  from (
    select
      i,
      case when (i % 20) < 8 then 1 when (i % 20) < 13 then 2
           when (i % 20) < 17 then 3 else 4 end                     as e,
      45 + (i * 7919) % 4400                                        as idade,
      case when (i % 100) < 76 then 'Bovino'
           when (i % 100) < 88 then 'Ovino'
           when (i % 100) < 95 then 'Caprino'
           when (i % 100) < 98 then 'Suíno'
           else 'Equídeo' end                                       as especie,
      -- `% 7` e não `% 4`: como 4 divide 100, `i % 4` fica completamente
      -- determinado por `i % 100` — o mesmo número que escolhe a espécie. O
      -- efeito é que cada espécie só apanha alguns sexos, e as faixas
      -- estreitas apanham um só: os equídeos (i % 100 em {98,99}) saíam TODOS
      -- fêmeas. Num teste de carga isso é pior do que um número feio, porque
      -- parece um bug da app a filtrar. 7 é primo com 100 e espalha.
      case when i % 7 < 2 then 'Macho' else 'Fêmea' end             as sexo,
      case when i % 25 = 3  then 'vendido'
           when i % 70 = 11 then 'falecido'
           else 'ativo' end                                         as estado
    from generate_series(1, n_animais) i
  ) g;

  get diagnostics n_criados = row_count;
  raise notice '% animais criados.', n_criados;

  -- ----------------------------------------------------------------
  -- 5. Genealogia
  -- ----------------------------------------------------------------
  -- Sem isto a árvore genealógica ficava por testar, que é justamente o ecrã
  -- que navega de registo em registo e mais sofre com volume.
  --
  -- Mães e pais saem sempre dos animais VELHOS da mesma exploração e os filhos
  -- são só os jovens: os dois conjuntos são disjuntos, e por isso não há como
  -- um animal ficar seu próprio ascendente nem como se formar um ciclo.
  for idx_exp in 1..4 loop
    select array_agg(id) into maes
      from public.animal
     where user_id = uid and id like 'carga-%'
       and exploracao_id = 'carga-exp-' || idx_exp
       and sexo = 'Fêmea'
       and data_nascimento < (current_date - 1500)::text;

    select array_agg(id) into pais
      from public.animal
     where user_id = uid and id like 'carga-%'
       and exploracao_id = 'carga-exp-' || idx_exp
       and sexo = 'Macho'
       and data_nascimento < (current_date - 1500)::text;

    if maes is not null and pais is not null then
      update public.animal a
         set mae_id = maes[1 + (abs(hashtext(a.id)) % array_length(maes, 1))],
             pai_id = pais[1 + (abs(hashtext(a.id || 'p')) % array_length(pais, 1))]
       where a.user_id = uid and a.id like 'carga-%'
         and a.exploracao_id = 'carga-exp-' || idx_exp
         and a.data_nascimento > (current_date - 1100)::text;
    end if;
  end loop;

  -- ----------------------------------------------------------------
  -- 6. Eventos
  -- ----------------------------------------------------------------
  -- Vacinações com datas propositadamente espalhadas: umas recentes (sem
  -- alerta), outras perto do ano (aviso) e outras passadas do ano
  -- (revacinação em atraso). É o que faz o ecrã de Alertas ter as três
  -- gravidades em vez de uma só.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, detalhe, valor)
  select 'carga-ev-vac-' || a.id, uid, a.id, 'Vacinação',
         (current_date - (30 + (abs(hashtext(a.id)) % 400)))::text || 'T10:00:00.000Z',
         'Vacina — ' || (array['Língua azul','Brucelose','Clostridioses','Carbúnculo'])
                        [1 + abs(hashtext(a.id)) % 4],
         'Lote ' || (1000 + abs(hashtext(a.id)) % 9000),
         (14 + abs(hashtext(a.id)) % 12)::numeric
    from public.animal a
   where a.user_id = uid and a.id like 'carga-%'
     and abs(hashtext(a.id)) % 10 < 7;          -- ~70% dos animais

  -- Duas pesagens por animal, com meses de intervalo: é o par que permite
  -- calcular o ganho médio diário.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, detalhe, valor)
  select 'carga-ev-pes' || p.n || '-' || a.id, uid, a.id, 'Pesagem',
         (current_date - (p.n * 90 + abs(hashtext(a.id)) % 30))::text || 'T11:00:00.000Z',
         'Pesagem: ' || (180 + abs(hashtext(a.id)) % 350 - (p.n - 1) * 45) || ' kg',
         null, null
    from public.animal a, generate_series(1, 2) p(n)
   where a.user_id = uid and a.id like 'carga-%'
     and abs(hashtext(a.id)) % 10 < 5;          -- ~50% dos animais

  -- Partos das fêmeas que já têm descendência registada — coerente com a
  -- genealogia da secção 5, em vez de partos inventados sem cria nenhuma.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, detalhe, valor)
  -- `distinct on (mae_id)`: uma linha por mãe, a do parto mais recente. Sem
  -- isto, uma mãe com três crias dava três eventos com o mesmo id e a chave
  -- primária recusava a inserção inteira.
  select distinct on (cria.mae_id)
         'carga-ev-parto-' || cria.mae_id, uid, cria.mae_id, 'Parto',
         cria.data_nascimento,
         'Parto normal — 1 cria', 'nado-vivo', null
    from public.animal cria
   where cria.user_id = uid and cria.id like 'carga-%' and cria.mae_id is not null
   order by cria.mae_id, cria.data_nascimento desc;

  -- Medicamento para quem está em intervalo de segurança: sem o evento, o
  -- alerta existia sem nada que o explicasse no histórico do animal.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, detalhe, valor)
  select 'carga-ev-med-' || a.id, uid, a.id, 'Medicamento',
         (current_date - 3)::text || 'T09:30:00.000Z',
         'Medicamento — Antibiótico',
         'Dose 20 ml · Injetável · intervalo de segurança em curso',
         35::numeric
    from public.animal a
   where a.user_id = uid and a.id like 'carga-%'
     and a.fim_intervalo_seguranca is not null;

  -- Saídas do efetivo: a venda e a morte que justificam o estado.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, detalhe, valor)
  select 'carga-ev-saida-' || a.id, uid, a.id,
         case a.estado when 'vendido' then 'Venda' else 'Morte' end,
         a.data_saida,
         case a.estado when 'vendido' then 'Animal saiu por venda.'
                       else 'Animal registado como falecido.' end,
         a.motivo_saida,
         case when a.estado = 'vendido'
              then (600 + abs(hashtext(a.id)) % 1200)::numeric end
    from public.animal a
   where a.user_id = uid and a.id like 'carga-%'
     and a.estado <> 'ativo' and a.data_saida is not null;

  select count(*) into n_criados
    from public.evento where user_id = uid and id like 'carga-%';
  raise notice '% eventos criados.', n_criados;

  raise notice 'Carga concluída para %.', email_alvo;
end $$;


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- select e.nome,
--        count(*) filter (where a.estado = 'ativo')  as ativos,
--        count(*) filter (where a.estado <> 'ativo') as saidos,
--        count(*)                                     as total
--   from public.exploracao e
--   join public.animal a on a.exploracao_id = e.id
--  where e.id like 'carga-%'
--  group by e.nome order by total desc;
--
-- select especie, sexo, count(*) from public.animal
--  where id like 'carga-%' group by 1,2 order by 1,2;

-- ==================================================================
-- APAGAR TUDO O QUE ESTE FICHEIRO CRIOU
-- ==================================================================
-- Não mexe em nada registado à mão na app (esse não tem o prefixo 'carga-').
-- Correr por esta ordem — as chaves estrangeiras dependem dela.
--
--   delete from public.evento     where id like 'carga-%';
--   delete from public.animal     where id like 'carga-%';
--   delete from public.terreno    where id like 'carga-%';
--   delete from public.membro_exploracao where exploracao_id like 'carga-%';
--   delete from public.exploracao where id like 'carga-%';
-- ==================================================================
