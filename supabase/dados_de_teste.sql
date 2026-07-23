-- ==================================================================
-- Gestão de Gado — dados de teste para uma conta de CLIENTE
-- ==================================================================
-- NÃO faz parte do schema. Não entra no `ordem.txt` nem no
-- `gerar-schema-completo.ps1`: é uma ferramenta de banca de trabalho, para
-- encher uma conta de testes com efetivo suficiente para os ecrãs e os
-- filtros terem alguma coisa que mostrar.
--
-- CORRER SÓ NO PROJETO DE TESTES (wkaxskxfcnexiutjewui, "Gado DEV").
-- Em produção isto misturava animais inventados com o efetivo real de um
-- criador — e depois de misturados, distingui-los é trabalho manual.
--
-- ------------------------------------------------------------------
-- ANTES DE CORRER
-- ------------------------------------------------------------------
--   1. Cria a conta de cliente na app (Criar conta) ou no Supabase em
--      Authentication → Users → Add user. Uma conta DIFERENTE da de
--      superadmin — é isso que faz a app abrir no lado do criador.
--   2. Põe o email dessa conta na linha assinalada com <<<< AQUI.
--   3. Corre o ficheiro todo de uma vez.
--
-- O que ele faz, por esta ordem:
--   · aprova a conta (estado 'ativo') e garante que NÃO é superadmin;
--   · liga a gestão financeira e o registo por casa, para os campos novos
--     aparecerem sem ser preciso ir às Definições;
--   · apaga dados de teste anteriores (todos os ids começam por 'demo-'),
--     por isso pode ser corrido as vezes que forem precisas;
--   · cria 2 explorações, 6 terrenos, 28 animais, eventos e movimentos.
--
-- As datas são todas relativas a hoje, para os alertas e as idades
-- continuarem a fazer sentido daqui a uns meses.
-- ==================================================================

do $$
declare
  -- <<<< AQUI: o email da conta de CLIENTE (não a de superadmin)
  email_cliente text := 'cliente@exemplo.pt';

  uid uuid;
  exp1 text := 'demo-exp-ribeira';
  exp2 text := 'demo-exp-cabeco';
  era_superadmin boolean;
  n_reais int;
begin
  select id into uid from auth.users where email = email_cliente;
  if uid is null then
    raise exception
      'Não existe nenhuma conta com o email %. Cria-a primeiro na app (Criar conta) ou em Authentication → Users.',
      email_cliente;
  end if;

  -- ---- Guardas ----
  -- Este script põe `is_superadmin = false`. Corrido por engano com o email da
  -- conta de administração, despromovia-a — e a partir daí já não havia quem
  -- aprovasse clientes nem quem lhe devolvesse o papel pela app. Melhor recusar
  -- do que desfazer.
  select is_superadmin into era_superadmin from public.perfil where id = uid;
  if era_superadmin then
    raise exception
      'A conta % é de SUPERADMIN. Este script tornaria-a cliente comum. Usa o email de uma conta de cliente.',
      email_cliente;
  end if;

  -- E não se enche de gado inventado uma conta que já tem efetivo a sério.
  select count(*) into n_reais
    from public.exploracao where user_id = uid and id not like 'demo-%';
  if n_reais > 0 then
    raise exception
      'A conta % já tem % exploração(ões) que não são de teste. Misturar animais inventados com dados reais só se desfaz à mão — usa uma conta limpa.',
      email_cliente, n_reais;
  end if;

  -- ----------------------------------------------------------------
  -- 1. A conta: cliente aprovado, não superadmin
  -- ----------------------------------------------------------------
  -- Uma conta nova nasce em 'pendente' e a app manda-a para o ecrã de espera.
  -- Aqui aprova-se à mão, que é o que o superadmin faria pelo painel.
  update public.perfil
     set estado = 'ativo',
         is_superadmin = false,
         -- Ligadas para os ecrãs de Finanças e os campos de casa aparecerem
         -- já. Podem ser desligadas depois em Definições, para ver o outro lado.
         financas_ativas = true,
         casa_ativa = true
   where id = uid;

  -- ----------------------------------------------------------------
  -- 2. Limpar dados de teste anteriores
  -- ----------------------------------------------------------------
  -- Só o que este ficheiro criou. O prefixo 'demo-' é o que garante que uma
  -- segunda passagem não leva à frente nada que tenha sido registado à mão
  -- na app entretanto.
  delete from public.movimento where id like 'demo-%';
  delete from public.evento    where id like 'demo-%';
  delete from public.animal    where id like 'demo-%';
  delete from public.terreno   where id like 'demo-%';
  delete from public.membro_exploracao where exploracao_id like 'demo-%';
  delete from public.exploracao where id like 'demo-%';

  -- ----------------------------------------------------------------
  -- 3. Explorações
  -- ----------------------------------------------------------------
  -- Duas, de propósito: com uma só, os filtros por exploração e a coluna da
  -- exploração no ecrã Terrenos nunca chegam a aparecer.
  -- O trigger `on_exploracao_created` trata do resto — mete o dono como admin
  -- e herda as opções do perfil que se acabaram de ligar acima.
  insert into public.exploracao (id, user_id, nome, marca_exploracao, nif_detentor, localizacao) values
    (exp1, uid, 'Quinta da Ribeira do Sol', 'PT 61 200 1120', '501234567', 'Idanha-a-Nova, Castelo Branco'),
    (exp2, uid, 'Cabeço da Vinha',          'PT 61 980 0224', '501234567', 'Penamacor, Castelo Branco');

  -- ----------------------------------------------------------------
  -- 4. Terrenos
  -- ----------------------------------------------------------------
  insert into public.terreno (id, user_id, exploracao_id, nome, tipo, area, descricao, latitude, longitude) values
    ('demo-ter-lameiro', uid, exp1, 'Lameiro do Fundo',   'Pastagem', 6.4, 'Água todo o ano, bebedouro a norte', 39.9203, -7.2411),
    ('demo-ter-fonte',   uid, exp1, 'Chão da Fonte',      'Pastagem', 3.9, 'Sombra de sobreiros',                39.9251, -7.2350),
    ('demo-ter-bouca',   uid, exp1, 'Bouça Grande',       'Misto',    8.2, 'Parte em mato, parte semeada',       39.9180, -7.2480),
    ('demo-ter-cerrado', uid, exp1, 'Cerrado Novo',       'Cultivo',  2.1, 'Aveia e centeio',                    null, null),
    ('demo-ter-sobreiro',uid, exp2, 'Encosta do Sobreiro','Pastagem', 5.0, 'Declive acentuado',                  40.1620, -7.1660),
    ('demo-ter-varzea',  uid, exp2, 'Várzea',             'Pastagem', 4.3, 'Alaga no inverno',                   null, null);

  -- ----------------------------------------------------------------
  -- 5. Animais
  -- ----------------------------------------------------------------
  -- Escolhidos para cada filtro ter alguma coisa que mostrar: os dois sexos,
  -- quatro espécies, raças e pelagens variadas, as quatro faixas de idade,
  -- fêmeas cobertas e vazias, animais com e sem brinco, três casas, todas as
  -- finalidades, e alguns já saídos do efetivo para o arquivo não vir vazio.
  insert into public.animal (
    id, user_id, exploracao_id, terreno_id, mae_id, pai_id, nome, especie, sexo,
    data_nascimento, raca, cor_pelagem, casa, numero_casa, finalidade,
    numero_identificacao, data_identificacao, comunicado_snira,
    data_prevista_parto, fim_intervalo_seguranca, estado, data_saida, motivo_saida
  ) values

  -- ---- Vacas de leite e de criação (Casa do Alto) ----
  ('demo-a-mimosa', uid, exp1, 'demo-ter-lameiro', null, null, 'Mimosa', 'Bovino', 'Fêmea',
   (current_date - 2200)::text || 'T12:00:00.000Z', 'Mertolenga', 'Malhada', 'Casa do Alto', '1', 'Leite',
   'PT 6120 0011 2201', (current_date - 2185)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-estrela', uid, exp1, 'demo-ter-lameiro', null, null, 'Estrela', 'Bovino', 'Fêmea',
   (current_date - 1900)::text || 'T12:00:00.000Z', 'Mertolenga', 'Castanha', 'Casa do Alto', '2', 'Leite',
   'PT 6120 0011 2202', (current_date - 1885)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- Coberta: aparece no filtro "Cobertas" e gera alerta de parto próximo
  ('demo-a-boneca', uid, exp1, 'demo-ter-lameiro', null, null, 'Boneca', 'Bovino', 'Fêmea',
   (current_date - 1750)::text || 'T12:00:00.000Z', 'Alentejana', 'Vermelha', 'Casa do Alto', '3', 'Criação',
   'PT 6120 0011 2203', (current_date - 1735)::text || 'T12:00:00.000Z', true,
   (current_date + 9)::text || 'T12:00:00.000Z', null, null, null, null),

  ('demo-a-rosa', uid, exp1, 'demo-ter-fonte', null, null, 'Rosa', 'Bovino', 'Fêmea',
   (current_date - 1600)::text || 'T12:00:00.000Z', 'Alentejana', 'Vermelha', 'Casa do Alto', '4', 'Criação',
   'PT 6120 0011 2204', (current_date - 1585)::text || 'T12:00:00.000Z', true,
   (current_date + 41)::text || 'T12:00:00.000Z', null, null, null, null),

  ('demo-a-malhada', uid, exp1, 'demo-ter-fonte', null, null, 'Malhada', 'Bovino', 'Fêmea',
   (current_date - 2600)::text || 'T12:00:00.000Z', 'Mertolenga', 'Malhada', 'Casa do Alto', '5', 'Criação',
   'PT 6120 0011 2205', (current_date - 2585)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- ---- Touro e machos (Casa do Souto) ----
  ('demo-a-geres', uid, exp1, 'demo-ter-bouca', null, null, 'Gerês', 'Bovino', 'Macho',
   (current_date - 2000)::text || 'T12:00:00.000Z', 'Limousine', 'Amarela', 'Casa do Souto', '1', 'Semental',
   'PT 6120 0011 2206', (current_date - 1985)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-trovao', uid, exp1, 'demo-ter-bouca', null, null, 'Trovão', 'Bovino', 'Macho',
   (current_date - 1400)::text || 'T12:00:00.000Z', 'Charolesa', 'Branca', 'Casa do Souto', '2', 'Carne',
   'PT 6120 0011 2207', (current_date - 1385)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- Boi de trabalho: a única finalidade que de outra forma ficava sem ninguém
  ('demo-a-brioso', uid, exp1, 'demo-ter-bouca', null, null, 'Brioso', 'Bovino', 'Macho',
   (current_date - 3300)::text || 'T12:00:00.000Z', 'Barrosã', 'Castanha', 'Casa do Souto', '3', 'Trabalho',
   'PT 6120 0011 2208', (current_date - 3285)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- ---- Crias e recria (filhos dos de cima → árvore genealógica) ----
  ('demo-a-aurora', uid, exp1, 'demo-ter-lameiro', 'demo-a-mimosa', 'demo-a-geres', 'Aurora', 'Bovino', 'Fêmea',
   (current_date - 500)::text || 'T12:00:00.000Z', 'Cruzado', 'Malhada', 'Casa do Alto', '6', 'Recria',
   'PT 6120 0011 2209', (current_date - 485)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-farrusco', uid, exp1, 'demo-ter-lameiro', 'demo-a-estrela', 'demo-a-geres', 'Farrusco', 'Bovino', 'Macho',
   (current_date - 430)::text || 'T12:00:00.000Z', 'Cruzado', 'Castanha', 'Casa do Alto', '7', 'Recria',
   'PT 6120 0011 2210', (current_date - 415)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- SEM BRINCO e recém-nascido: alerta de identificação a contar
  ('demo-a-bravo', uid, exp1, 'demo-ter-lameiro', 'demo-a-malhada', 'demo-a-geres', 'Bravo', 'Bovino', 'Macho',
   (current_date - 12)::text || 'T12:00:00.000Z', 'Cruzado', 'Preta', 'Casa do Alto', '8', null,
   null, null, null, null, null, null, null, null),

  -- SEM BRINCO e já fora do prazo: alerta de identificação VENCIDO
  ('demo-a-lueiro', uid, exp1, 'demo-ter-fonte', 'demo-a-rosa', 'demo-a-geres', 'Lueiro', 'Bovino', 'Macho',
   (current_date - 27)::text || 'T12:00:00.000Z', 'Cruzado', 'Vermelha', null, null, null,
   null, null, null, null, null, null, null, null),

  -- Com brinco mas SNIRA por comunicar: alerta de SNIRA
  ('demo-a-canela', uid, exp1, 'demo-ter-fonte', 'demo-a-boneca', 'demo-a-geres', 'Canela', 'Bovino', 'Fêmea',
   (current_date - 22)::text || 'T12:00:00.000Z', 'Cruzado', 'Castanha', 'Casa do Alto', '9', null,
   'PT 6120 0011 2211', (current_date - 6)::text || 'T12:00:00.000Z', false, null, null, null, null, null),

  -- SNIRA em ATRASO
  ('demo-a-pinta', uid, exp1, 'demo-ter-fonte', 'demo-a-mimosa', 'demo-a-geres', 'Pinta', 'Bovino', 'Fêmea',
   (current_date - 40)::text || 'T12:00:00.000Z', 'Cruzado', 'Malhada', 'Casa do Alto', '10', null,
   'PT 6120 0011 2212', (current_date - 20)::text || 'T12:00:00.000Z', false, null, null, null, null, null),

  -- ---- Em intervalo de segurança (alerta de medicamento) ----
  ('demo-a-condessa', uid, exp1, 'demo-ter-cerrado', null, null, 'Condessa', 'Bovino', 'Fêmea',
   (current_date - 1500)::text || 'T12:00:00.000Z', 'Frísia (Holstein)', 'Malhada', 'Casa Nova', '1', 'Leite',
   'PT 6120 0011 2213', (current_date - 1485)::text || 'T12:00:00.000Z', true,
   null, (current_date + 6)::text || 'T12:00:00.000Z', null, null, null),

  ('demo-a-duquesa', uid, exp1, 'demo-ter-cerrado', null, null, 'Duquesa', 'Bovino', 'Fêmea',
   (current_date - 1300)::text || 'T12:00:00.000Z', 'Frísia (Holstein)', 'Preta', 'Casa Nova', '2', 'Leite',
   'PT 6120 0011 2214', (current_date - 1285)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- ---- Animais mais velhos (faixa "Mais de 8 anos") ----
  ('demo-a-veterana', uid, exp1, 'demo-ter-bouca', null, null, 'Veterana', 'Bovino', 'Fêmea',
   (current_date - 3800)::text || 'T12:00:00.000Z', 'Mirandesa', 'Castanha', 'Casa do Souto', '4', 'Criação',
   'PT 6120 0011 2215', (current_date - 3785)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-antiga', uid, exp1, 'demo-ter-bouca', null, null, 'Antiga', 'Bovino', 'Fêmea',
   (current_date - 4200)::text || 'T12:00:00.000Z', 'Maronesa', 'Castanha', 'Casa do Souto', '5', 'Criação',
   'PT 6120 0011 2216', (current_date - 4185)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- ---- Saídos do efetivo (só aparecem com o arquivo ligado) ----
  ('demo-a-vendido', uid, exp1, null, null, null, 'Ruço', 'Bovino', 'Macho',
   (current_date - 900)::text || 'T12:00:00.000Z', 'Charolesa', 'Branca', 'Casa do Souto', '6', 'Carne',
   'PT 6120 0011 2217', (current_date - 885)::text || 'T12:00:00.000Z', true,
   null, null, 'vendido', (current_date - 30)::text || 'T12:00:00.000Z', 'Vendido na feira de Idanha'),

  ('demo-a-falecido', uid, exp1, null, 'demo-a-malhada', 'demo-a-geres', 'Nevoeiro', 'Bovino', 'Macho',
   (current_date - 200)::text || 'T12:00:00.000Z', 'Cruzado', 'Preta', null, null, null,
   null, null, null, null, null, 'falecido', (current_date - 60)::text || 'T12:00:00.000Z', 'Doença respiratória'),

  -- ---- Ovinos (exploração 2) ----
  ('demo-a-ov1', uid, exp2, 'demo-ter-sobreiro', null, null, 'Bonita', 'Ovino', 'Fêmea',
   (current_date - 1100)::text || 'T12:00:00.000Z', 'Serra da Estrela', 'Branca', null, null, null,
   'PT 6198 0055 7701', (current_date - 1085)::text || 'T12:00:00.000Z', true,
   (current_date + 20)::text || 'T12:00:00.000Z', null, null, null, null),

  ('demo-a-ov2', uid, exp2, 'demo-ter-sobreiro', null, null, 'Neve', 'Ovino', 'Fêmea',
   (current_date - 950)::text || 'T12:00:00.000Z', 'Serra da Estrela', 'Branca', null, null, null,
   'PT 6198 0055 7702', (current_date - 935)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-ov3', uid, exp2, 'demo-ter-sobreiro', null, null, 'Carneiro', 'Ovino', 'Macho',
   (current_date - 1600)::text || 'T12:00:00.000Z', 'Merino Branco', 'Branca', null, null, null,
   'PT 6198 0055 7703', (current_date - 1585)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-ov4', uid, exp2, 'demo-ter-varzea', 'demo-a-ov2', 'demo-a-ov3', 'Borrego', 'Ovino', 'Macho',
   (current_date - 120)::text || 'T12:00:00.000Z', 'Merino Branco', 'Branca', null, null, null,
   'PT 6198 0055 7704', (current_date - 105)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- ---- Caprinos ----
  ('demo-a-cap1', uid, exp2, 'demo-ter-varzea', null, null, 'Cabrita', 'Caprino', 'Fêmea',
   (current_date - 800)::text || 'T12:00:00.000Z', 'Serrana', 'Castanha', null, null, null,
   'PT 6198 0077 9901', (current_date - 785)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  ('demo-a-cap2', uid, exp2, 'demo-ter-varzea', null, null, 'Bode', 'Caprino', 'Macho',
   (current_date - 1500)::text || 'T12:00:00.000Z', 'Charnequeira', 'Preta', null, null, null,
   'PT 6198 0077 9902', (current_date - 1485)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- ---- Equídeo: pelagem com vocabulário próprio (Tordilha) ----
  ('demo-a-eq1', uid, exp2, 'demo-ter-sobreiro', null, null, 'Vento', 'Equídeo', 'Macho',
   (current_date - 3000)::text || 'T12:00:00.000Z', 'Lusitano', 'Tordilha', null, null, null,
   'PT 6198 0099 1101', (current_date - 2985)::text || 'T12:00:00.000Z', true, null, null, null, null, null),

  -- Sem vacinação registada nenhuma → alerta informativo (dispensável)
  ('demo-a-eq2', uid, exp2, 'demo-ter-varzea', null, null, 'Moura', 'Equídeo', 'Fêmea',
   (current_date - 2500)::text || 'T12:00:00.000Z', 'Garrano', 'Baia', null, null, null,
   'PT 6198 0099 1102', (current_date - 2485)::text || 'T12:00:00.000Z', true, null, null, null, null, null);

  -- ----------------------------------------------------------------
  -- 6. Eventos
  -- ----------------------------------------------------------------
  -- Vacinações com datas diferentes de propósito: umas recentes (sem alerta),
  -- uma quase a fazer um ano (aviso) e uma passada do ano (revacinação em
  -- atraso). É o que faz o ecrã de Alertas ter as três gravidades.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, detalhe, valor) values
    ('demo-ev-vac1', uid, 'demo-a-mimosa',  'Vacinação', (current_date - 100)::text || 'T10:00:00.000Z',
     'Vacina — Língua azul', 'Lote 4471 · Vet. Dr. Sousa', 18),
    ('demo-ev-vac2', uid, 'demo-a-estrela', 'Vacinação', (current_date - 340)::text || 'T10:00:00.000Z',
     'Vacina — Língua azul', 'Lote 4471', 18),
    ('demo-ev-vac3', uid, 'demo-a-malhada', 'Vacinação', (current_date - 400)::text || 'T10:00:00.000Z',
     'Vacina — Brucelose', 'Lote 3320 · revacinação em atraso', 22),
    ('demo-ev-vac4', uid, 'demo-a-boneca',  'Vacinação', (current_date - 60)::text  || 'T10:00:00.000Z',
     'Vacina — Clostridioses', 'Lote 5510', 20),
    ('demo-ev-vac5', uid, 'demo-a-geres',   'Vacinação', (current_date - 150)::text || 'T10:00:00.000Z',
     'Vacina — Língua azul', 'Lote 4471', 18),

    ('demo-ev-med1', uid, 'demo-a-condessa', 'Medicamento', (current_date - 8)::text || 'T09:30:00.000Z',
     'Medicamento — Antibiótico', 'Dose 20 ml · Injetável · Mastite · segurança 14 dias', 35),

    ('demo-ev-parto1', uid, 'demo-a-mimosa',  'Parto', (current_date - 500)::text || 'T06:00:00.000Z',
     'Parto normal — 1 cria', 'cria fêmea · nado-vivo', null),
    ('demo-ev-parto2', uid, 'demo-a-estrela', 'Parto', (current_date - 430)::text || 'T07:00:00.000Z',
     'Parto normal — 1 cria', 'cria macho · nado-vivo', null),
    ('demo-ev-parto3', uid, 'demo-a-malhada', 'Parto', (current_date - 12)::text  || 'T05:30:00.000Z',
     'Parto normal — 1 cria', 'cria macho · nado-vivo', null),

    ('demo-ev-pes1', uid, 'demo-a-trovao', 'Pesagem', (current_date - 120)::text || 'T11:00:00.000Z',
     'Pesagem: 412 kg', null, null),
    ('demo-ev-pes2', uid, 'demo-a-trovao', 'Pesagem', (current_date - 30)::text  || 'T11:00:00.000Z',
     'Pesagem: 458 kg', 'GMD 0,51 kg/dia', null),
    ('demo-ev-pes3', uid, 'demo-a-aurora', 'Pesagem', (current_date - 20)::text  || 'T11:00:00.000Z',
     'Pesagem: 236 kg', null, null),

    ('demo-ev-compra1', uid, 'demo-a-geres',    'Compra', (current_date - 1980)::text || 'T12:00:00.000Z',
     'Compra do reprodutor', 'Feira de Idanha-a-Nova', 2400),
    ('demo-ev-compra2', uid, 'demo-a-condessa', 'Compra', (current_date - 1480)::text || 'T12:00:00.000Z',
     'Compra', 'Leiloeira de Castelo Branco', 1650),

    ('demo-ev-venda1', uid, 'demo-a-vendido',  'Venda', (current_date - 30)::text || 'T12:00:00.000Z',
     'Animal saiu por venda.', 'Vendido na feira de Idanha', null),
    ('demo-ev-morte1', uid, 'demo-a-falecido', 'Morte', (current_date - 60)::text || 'T12:00:00.000Z',
     'Animal registado como falecido.', 'Doença respiratória', null);

  -- ----------------------------------------------------------------
  -- 7. Movimentos (gestão económica)
  -- ----------------------------------------------------------------
  -- Espalhados pelos últimos meses para o gráfico dos 6 meses ter barras em
  -- todos, e com a alimentação a pesar mais — que é o que acontece a sério
  -- numa exploração de gado.
  insert into public.movimento (id, exploracao_id, direcao, categoria, valor, data, descricao, contraparte, animal_id, criado_por) values
    ('demo-mov-r1', exp1, 'despesa', 'Alimentação', 860,  current_date - 8,   'Ração — 40 sacos',        'Agro-Nisa',     null, uid),
    ('demo-mov-r2', exp1, 'despesa', 'Alimentação', 910,  current_date - 38,  'Ração — 42 sacos',        'Agro-Nisa',     null, uid),
    ('demo-mov-r3', exp1, 'despesa', 'Alimentação', 780,  current_date - 68,  'Ração — 36 sacos',        'Agro-Nisa',     null, uid),
    ('demo-mov-r4', exp1, 'despesa', 'Alimentação', 1120, current_date - 98,  'Fardos de feno',          'Sr. Marques',   null, uid),
    ('demo-mov-r5', exp1, 'despesa', 'Alimentação', 840,  current_date - 128, 'Ração — 38 sacos',        'Agro-Nisa',     null, uid),
    ('demo-mov-r6', exp1, 'despesa', 'Alimentação', 795,  current_date - 158, 'Ração — 36 sacos',        'Agro-Nisa',     null, uid),

    ('demo-mov-e1', exp1, 'despesa', 'Energia e combustível', 210, current_date - 15,  'Gasóleo do trator', 'BP',        null, uid),
    ('demo-mov-e2', exp1, 'despesa', 'Energia e combustível', 148, current_date - 45,  'Eletricidade',      'EDP',       null, uid),
    ('demo-mov-e3', exp1, 'despesa', 'Energia e combustível', 162, current_date - 75,  'Eletricidade',      'EDP',       null, uid),
    ('demo-mov-a1', exp1, 'despesa', 'Água',                   64, current_date - 45,  'Água',              'Câmara',    null, uid),
    ('demo-mov-m1', exp1, 'despesa', 'Máquinas e reparações', 380, current_date - 52,  'Reparação do trator', 'Oficina Silva', null, uid),
    ('demo-mov-t1', exp1, 'despesa', 'Taxas e seguros',       295, current_date - 90,  'Seguro do efetivo', 'Fidelidade',null, uid),
    ('demo-mov-re1',exp1, 'despesa', 'Rendas e terrenos',     600, current_date - 120, 'Renda da Bouça Grande', 'Sr. Nunes', null, uid),
    ('demo-mov-mo1',exp1, 'despesa', 'Mão-de-obra',           720, current_date - 30,  'Jornas da tosquia', null,        null, uid),

    ('demo-mov-v1', exp1, 'receita', 'Venda de animais',     1350, current_date - 30,  'Venda — feira de Idanha', 'Sr. Silva', 'demo-a-vendido', uid),
    ('demo-mov-l1', exp1, 'receita', 'Leite e produtos',      980, current_date - 10,  'Leite de outubro',  'Lactogal',  null, uid),
    ('demo-mov-l2', exp1, 'receita', 'Leite e produtos',      940, current_date - 40,  'Leite do mês',      'Lactogal',  null, uid),
    ('demo-mov-l3', exp1, 'receita', 'Leite e produtos',      910, current_date - 70,  'Leite do mês',      'Lactogal',  null, uid),
    ('demo-mov-s1', exp1, 'receita', 'Apoios e subsídios',   3200, current_date - 100, 'Prémio por vaca aleitante', 'IFAP', null, uid),

    ('demo-mov-c1', exp2, 'despesa', 'Alimentação',           420, current_date - 20,  'Ração para os borregos', 'Agro-Nisa', null, uid),
    ('demo-mov-c2', exp2, 'receita', 'Venda de animais',      680, current_date - 55,  'Venda de dois borregos', 'Talho Central', null, uid);

  raise notice 'Dados de teste criados para % (id %).', email_cliente, uid;
end $$;


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- Substituir o email nas linhas abaixo pelo mesmo que foi usado acima.
--
--   select p.estado, p.is_superadmin, p.financas_ativas, p.casa_ativa
--     from public.perfil p
--     join auth.users u on u.id = p.id
--    where u.email = 'cliente@exemplo.pt';
--   -- esperado: ativo | false | true | true
--
--   select especie, sexo, count(*) from public.animal
--    where id like 'demo-%' group by 1,2 order by 1,2;
--
--   select estado, count(*) from public.animal
--    where id like 'demo-%' group by 1;
--   -- esperado: null/ativo 26, vendido 1, falecido 1
--
--   select direcao, sum(valor) from public.movimento
--    where id like 'demo-%' group by 1;
--
-- ==================================================================
-- APAGAR TUDO O QUE ESTE FICHEIRO CRIOU
-- ==================================================================
-- Não mexe em nada registado à mão na app (esse não tem o prefixo 'demo-').
--
--   delete from public.movimento where id like 'demo-%';
--   delete from public.evento    where id like 'demo-%';
--   delete from public.animal    where id like 'demo-%';
--   delete from public.terreno   where id like 'demo-%';
--   delete from public.membro_exploracao where exploracao_id like 'demo-%';
--   delete from public.exploracao where id like 'demo-%';
