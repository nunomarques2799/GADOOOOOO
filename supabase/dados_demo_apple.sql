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
    (array['Mimosa','Estrela','Boneca','Rosa','Malhada','Formosa','Preciosa','Bonita',
           'Gerês','Marquês','Valente','Trovão','Farrusco','Dourada','Serena','Airosa',
           'Nobre','Ligeira'])[g],
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

  raise notice 'Demonstração pronta: 1 exploração, 3 terrenos, 18 animais, 26 eventos.';
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
