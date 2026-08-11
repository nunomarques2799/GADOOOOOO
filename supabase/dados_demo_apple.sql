-- ---------------------------------------------------------------------------
-- Exploração de demonstração para a revisão da Apple
-- ---------------------------------------------------------------------------
-- PORQUÊ ISTO EXISTE. Uma conta nova nasce com `perfil.estado = 'pendente'`,
-- que é só de leitura. O revisor da Apple regista-se, entra, encontra uma app
-- vazia onde não consegue escrever nada, e chumba por "app incompleta" —
-- diretriz 2.1. A App Review Information TEM de levar uma conta já aprovada e
-- com dados dentro, e é essa que este ficheiro prepara.
--
-- NÃO usa a conta de ninguém real: os 119 animais de Forcalhos são o rebanho
-- verdadeiro de um criador, e os 5000 `carga-` dão uma impressão absurda de uma
-- app que se quer simples.
--
-- Tudo o que cria leva o prefixo `demo-`, por isso a limpeza é uma linha (ver o
-- fim do ficheiro). Correr outra vez é seguro: começa por apagar o que criou.
--
-- Correr com:
--   psql "<ligação>" -v ON_ERROR_STOP=1 -f supabase/dados_demo_apple.sql
-- ---------------------------------------------------------------------------

do $$
declare
  uid   uuid;
  exp   text := 'demo-exp-1';
  hoje  date := current_date;
begin
  select id into uid from auth.users where email = 'testaccount@gmail.com';
  if uid is null then
    raise exception 'A conta testaccount@gmail.com não existe nesta base.';
  end if;

  -- Limpar uma passagem anterior, na ordem inversa das chaves estrangeiras.
  delete from public.evento     where id like 'demo-%';
  delete from public.animal     where id like 'demo-%';
  delete from public.terreno    where id like 'demo-%';
  delete from public.membro_exploracao where exploracao_id like 'demo-%';
  delete from public.exploracao where id like 'demo-%';

  -- A conta tem de estar APROVADA, senão o revisor entra e não escreve nada.
  update public.perfil set estado = 'ativo', nome = 'Conta de Demonstração'
   where id = uid;

  -- Exploração. O trigger `on_exploracao_created` torna o dono admin sozinho.
  -- A coluna chama-se `localizacao`, não `morada` — e leva latitude/longitude
  -- à parte, que é o que acende a meteorologia no ecrã de Início.
  insert into public.exploracao
    (id, user_id, nome, marca_exploracao, nif_detentor, localizacao, latitude, longitude)
  values (exp, uid, 'Herdade da Amoreira', 'PT 61 200 0007', '500000000',
          'Castelo de Vide, Portalegre', 39.415, -7.457);

  insert into public.terreno (id, user_id, exploracao_id, nome, tipo, area, descricao)
  values
    ('demo-ter-1', uid, exp, 'Cerca do Sobreiro', 'Pastagem', 5.4, 'Bebedouro e sombra de sobreiros.'),
    ('demo-ter-2', uid, exp, 'Vale Fundo',        'Pastagem', 3.2, 'Junto à ribeira, água todo o ano.'),
    ('demo-ter-3', uid, exp, 'Souto de Cima',     'Misto',    2.7, 'Souto de castanheiros.');

  -- 18 animais: mistura de raças portuguesas, idades e sexos, para os ecrãs de
  -- alertas e de reprodução terem o que mostrar.
  insert into public.animal
    (id, user_id, exploracao_id, terreno_id, nome, especie, sexo, data_nascimento,
     raca, cor_pelagem, numero_identificacao, estado, finalidade, comunicado_snira)
  select
    'demo-a-' || lpad(g::text, 2, '0'),
    uid, exp,
    'demo-ter-' || (1 + (g % 3)),
    -- Os 14 primeiros nomes são de fêmea e os 4 últimos de macho, porque é essa
    -- a ordem que o `case` abaixo usa para o sexo. Trocados, a lista mostrava
    -- um "Trovão ♀" e uma "Serena ♂" — e é a primeira coisa que salta à vista
    -- numa captura de ecrã.
    (array['Mimosa','Estrela','Boneca','Rosa','Malhada','Formosa','Preciosa','Bonita',
           'Dourada','Serena','Airosa','Ligeira','Aurora','Amêndoa',
           'Gerês','Marquês','Valente','Trovão'])[g],
    'Bovino',
    case when g <= 14 then 'Fêmea' else 'Macho' end,
    to_char(hoje - ((300 + g * 97) || ' days')::interval, 'YYYY-MM-DD'),
    (array['Mertolenga','Alentejana','Limousine','Cruzado Charolês'])[1 + (g % 4)],
    (array['Vermelha','Amarela','Malhada','Branca','Trigo'])[1 + (g % 5)],
    'PT 6120 0099 ' || lpad((3300 + g)::text, 4, '0'),
    'ativo',
    -- A `finalidade` tem CHECK: só Leite/Criação/Semental/Carne/Recria/Trabalho.
    case when g <= 12 then 'Criação'
         when g <= 14 then 'Recria'
         when g = 18  then 'Semental'
         else 'Carne' end,
    true
  from generate_series(1, 18) as g;

  -- Eventos: pesagens recentes e vacinações, para o histórico não estar vazio.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, valor)
  select
    'demo-ev-p-' || lpad(g::text, 2, '0'),
    uid, 'demo-a-' || lpad(g::text, 2, '0'),
    'Pesagem',
    to_char(hoje - ((10 + g) || ' days')::interval, 'YYYY-MM-DD'),
    'Pesagem de rotina',
    260 + (g * 13) % 240
  from generate_series(1, 18) as g;

  insert into public.evento (id, user_id, animal_id, tipo, data, descricao)
  select
    'demo-ev-v-' || lpad(g::text, 2, '0'),
    uid, 'demo-a-' || lpad(g::text, 2, '0'),
    'Vacinação',
    to_char(hoje - ((40 + g * 2) || ' days')::interval, 'YYYY-MM-DD'),
    'Vacinação anual'
  from generate_series(1, 8) as g;

  -- ----------------------------------------------------------------
  -- Reprodução
  -- ----------------------------------------------------------------
  -- O estado reprodutivo NÃO está guardado: `src/data/reproducao.ts` lê-o dos
  -- eventos. Por isso não basta inventar uma coluna — é preciso escrever a
  -- história que produz o estado que se quer ver no ecrã:
  --
  --   · o ciclo atual começa no ÚLTIMO `Parto`; tudo o que é anterior é ignorado;
  --   · dentro do ciclo vale o ÚLTIMO `Cobrição`/`Diagnóstico`;
  --   · `Cobrição` sozinha  → COBERTA;
  --   · `Diagnóstico` com `resultado='gestante'` → GESTANTE;
  --   · gestação de bovino = 283 dias, e "prestes a parir" é uma janela de 30.
  --
  -- Daí as datas abaixo: a cobrição fica a ~260 dias, para o parto previsto cair
  -- dentro dessa janela e o ecrã não sair vazio.

  -- 4 gestantes prestes a parir (previsto entre +7 e +22 dias).
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao)
  select 'demo-ev-c-' || lpad(g::text, 2, '0'), uid, 'demo-a-' || lpad(g::text, 2, '0'),
         'Cobrição', to_char(hoje - ((256 + g * 5) || ' days')::interval, 'YYYY-MM-DD'),
         'Cobrição natural'
  from generate_series(1, 4) as g;

  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, resultado)
  select 'demo-ev-d-' || lpad(g::text, 2, '0'), uid, 'demo-a-' || lpad(g::text, 2, '0'),
         'Diagnóstico', to_char(hoje - ((221 + g * 5) || ' days')::interval, 'YYYY-MM-DD'),
         'Diagnóstico de gestação', 'gestante'
  from generate_series(1, 4) as g;

  update public.animal a
     set data_prevista_parto = to_char(hoje + ((27 - (right(a.id, 2)::int * 5)) || ' days')::interval, 'YYYY-MM-DD')
   where a.id in ('demo-a-01','demo-a-02','demo-a-03','demo-a-04');

  -- 2 gestantes ainda longe (não entram em "prestes a parir").
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao)
  values
    ('demo-ev-c-05', uid, 'demo-a-05', 'Cobrição', to_char(hoje - interval '120 days', 'YYYY-MM-DD'), 'Cobrição natural'),
    ('demo-ev-c-06', uid, 'demo-a-06', 'Cobrição', to_char(hoje - interval '105 days', 'YYYY-MM-DD'), 'Inseminação artificial');

  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, resultado)
  values
    ('demo-ev-d-05', uid, 'demo-a-05', 'Diagnóstico', to_char(hoje - interval '85 days', 'YYYY-MM-DD'), 'Diagnóstico de gestação', 'gestante'),
    ('demo-ev-d-06', uid, 'demo-a-06', 'Diagnóstico', to_char(hoje - interval '70 days', 'YYYY-MM-DD'), 'Diagnóstico de gestação', 'gestante');

  update public.animal set data_prevista_parto = to_char(hoje + interval '163 days', 'YYYY-MM-DD') where id = 'demo-a-05';
  update public.animal set data_prevista_parto = to_char(hoje + interval '178 days', 'YYYY-MM-DD') where id = 'demo-a-06';

  -- 2 cobertas: cobrição recente e ainda sem diagnóstico.
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao)
  values
    ('demo-ev-c-07', uid, 'demo-a-07', 'Cobrição', to_char(hoje - interval '25 days', 'YYYY-MM-DD'), 'Cobrição natural'),
    ('demo-ev-c-08', uid, 'demo-a-08', 'Cobrição', to_char(hoje - interval '18 days', 'YYYY-MM-DD'), 'Inseminação artificial');

  -- Partos. Os das gestantes 01 e 02 são ANTERIORES à cobrição de propósito: o
  -- ciclo começa no último parto, e uma cobrição antes dele seria ignorada.
  -- Dois partos na mesma vaca são o que faz o cartão "intervalo entre partos"
  -- deixar de dizer «ainda sem dois partos registados».
  insert into public.evento (id, user_id, animal_id, tipo, data, descricao)
  values
    ('demo-ev-p-a1', uid, 'demo-a-01', 'Parto', to_char(hoje - interval '690 days', 'YYYY-MM-DD'), 'Parto sem complicações'),
    ('demo-ev-p-a2', uid, 'demo-a-01', 'Parto', to_char(hoje - interval '400 days', 'YYYY-MM-DD'), 'Parto sem complicações'),
    ('demo-ev-p-b1', uid, 'demo-a-02', 'Parto', to_char(hoje - interval '675 days', 'YYYY-MM-DD'), 'Parto sem complicações'),
    ('demo-ev-p-b2', uid, 'demo-a-02', 'Parto', to_char(hoje - interval '390 days', 'YYYY-MM-DD'), 'Parto assistido'),
    -- Estas duas pariram há pouco: ficam vazias, com os dias desde o parto a
    -- contar, que é o que alimenta a lista "sem cobrição após o parto".
    ('demo-ev-p-c1', uid, 'demo-a-09', 'Parto', to_char(hoje - interval '45 days', 'YYYY-MM-DD'), 'Parto sem complicações'),
    ('demo-ev-p-d1', uid, 'demo-a-10', 'Parto', to_char(hoje - interval '62 days', 'YYYY-MM-DD'), 'Parto sem complicações');

  raise notice 'Demonstração pronta: 1 exploração, 3 terrenos, 18 animais.';
  raise notice 'Reprodução: 6 gestantes (4 prestes a parir), 2 cobertas, 6 partos.';
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Conferir
-- ---------------------------------------------------------------------------
--   select count(*) from public.animal where id like 'demo-%';
--
-- Limpar tudo (pela mesma ordem do início do bloco):
--   delete from public.evento  where id like 'demo-%';
--   delete from public.animal  where id like 'demo-%';
--   delete from public.terreno where id like 'demo-%';
--   delete from public.membro_exploracao where exploracao_id like 'demo-%';
--   delete from public.exploracao where id like 'demo-%';
