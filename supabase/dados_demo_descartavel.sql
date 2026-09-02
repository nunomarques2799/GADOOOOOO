-- ---------------------------------------------------------------------------
-- Segunda conta de demonstração: a que o revisor pode APAGAR
-- ---------------------------------------------------------------------------
-- PORQUÊ ISTO EXISTE. A diretriz 5.1.1(v) obriga a app a deixar apagar a conta
-- de dentro dela, e a Apple pediu para VER esse fluxo numa gravação de ecrã.
-- Só que:
--
--   · apagar a conta de demonstração principal (`testaccount@gmail.com`)
--     destrói os dados que a revisão precisa de encontrar;
--   · e no build 7 uma conta acabada de registar NÃO consegue apagar-se, porque
--     sem exploração a app mostra o ecrã de acesso em vez dos separadores (é o
--     buraco fechado a 2026-08-25 no `EcraPendente`, que só existe do 8 em
--     diante).
--
-- Daí uma SEGUNDA conta, aprovada e com uma exploração pequena: dá para ir a
-- Perfil → Apagar a minha conta e levar o fluxo até ao fim, à frente da câmara,
-- sem tocar na conta principal. É descartável por desenho: quando for apagada,
-- não se perde nada.
--
-- A CONTA TEM DE SER REGISTADA À MÃO ANTES DE CORRER ISTO (na app ou no site).
-- Este ficheiro não cria contas de autenticação: aprova a que existir e
-- semeia-lhe dados.
--
-- Tudo o que cria leva o prefixo `demo2-`, que NÃO colide com o `demo-` do
-- `dados_demo_apple.sql` (em SQL, 'demo2-x' não corresponde a 'demo-%').
-- Correr outra vez é seguro: começa por apagar o que criou.
--
-- Correr com:
--   psql "<ligação>" -v ON_ERROR_STOP=1 -v email=terrabovinademo2@gmail.com \
--        -f supabase/dados_demo_descartavel.sql
-- ---------------------------------------------------------------------------

\if :{?email}
\else
  \echo 'ERRO: falta -v email=<endereço da conta descartável>'
  \quit
\endif

-- A variável do psql (`:email`) só existe do lado do cliente e os blocos
-- `do $$` não a veem. Passa-se para a sessão, e é de lá que o PL/pgSQL a lê
-- com `current_setting`. Sem `local`, de propósito: tem de sobreviver ao
-- `commit` para a consulta de conferência lá em baixo ainda a encontrar.
set demo.email = :'email';

begin;

do $$
declare
  uid  uuid;
  exp  text := 'demo2-exp-1';
  hoje date := current_date;
begin
  select id into uid from auth.users where email = current_setting('demo.email');
  if uid is null then
    raise exception
      'A conta % não existe nesta base. Registe-a primeiro na app.',
      current_setting('demo.email');
  end if;

  -- Limpar uma passagem anterior, na ordem inversa das chaves estrangeiras.
  delete from public.evento     where id like 'demo2-%';
  delete from public.animal     where id like 'demo2-%';
  delete from public.terreno    where id like 'demo2-%';
  delete from public.membro_exploracao where exploracao_id like 'demo2-%';
  delete from public.exploracao where id like 'demo2-%';

  -- Aprovada, senão não escreve nada e nem sequer sai do ecrã de acesso.
  update public.perfil
     set estado = 'ativo', nome = 'Conta Descartável'
   where id = uid;

  -- Uma exploração chega. O trigger `on_exploracao_created` torna o dono admin
  -- sozinho, e é isso que faz a app mostrar os separadores em vez do ecrã de
  -- acesso -- que é a razão de tudo isto existir.
  insert into public.exploracao
    (id, user_id, nome, marca_exploracao, nif_detentor, localizacao, latitude, longitude)
  values (exp, uid, 'Quinta de Ensaio', 'PT 61 200 0008', '500000001',
          'Castelo de Vide, Portalegre', 39.415, -7.457);

  insert into public.terreno (id, user_id, exploracao_id, nome, tipo, area, descricao)
  values ('demo2-ter-1', uid, exp, 'Cerca Pequena', 'Pastagem', 1.8, 'Terreno de ensaio.');

  -- Quatro animais: poucos de propósito. O ecrã de apagar conta conta o que se
  -- perde a partir dos dados REAIS, portanto a pergunta final vai dizer
  -- "1 exploração e 4 animais" -- que é exatamente o que se quer ver na
  -- gravação, em vez de um aviso genérico.
  insert into public.animal
    (id, user_id, exploracao_id, terreno_id, nome, especie, sexo, data_nascimento,
     raca, cor_pelagem, numero_identificacao, estado, finalidade, comunicado_snira)
  select
    'demo2-a-' || g,
    uid, exp, 'demo2-ter-1',
    (array['Ensaio','Amostra','Exemplo','Modelo'])[g],
    'Bovino',
    case when g <= 3 then 'Fêmea' else 'Macho' end,
    to_char(hoje - ((400 + g * 90) || ' days')::interval, 'YYYY-MM-DD'),
    (array['Mertolenga','Alentejana','Limousine','Cruzado Charolês'])[g],
    (array['Vermelha','Amarela','Malhada','Branca'])[g],
    'PT 6120 0099 ' || lpad((9900 + g)::text, 4, '0'),
    'ativo',
    case when g <= 3 then 'Criação' else 'Carne' end,
    true
  from generate_series(1, 4) as g;

  insert into public.evento (id, user_id, animal_id, tipo, data, descricao, valor)
  select
    'demo2-ev-p-' || g,
    uid, 'demo2-a-' || g,
    'Pesagem',
    to_char(hoje - ((10 + g) || ' days')::interval, 'YYYY-MM-DD'),
    'Pesagem de rotina',
    300 + g * 20
  from generate_series(1, 4) as g;

  raise notice 'Conta % aprovada, com 1 exploração, 1 terreno, 4 animais e 4 eventos.',
    current_setting('demo.email');
end $$;

commit;


-- ---- Conferir ------------------------------------------------------------
\echo ''
\echo '== A conta ficou aprovada e com dados? =='
select p.nome, p.estado,
       (select count(*) from public.exploracao where user_id = p.id and id like 'demo2-%') as exploracoes,
       (select count(*) from public.animal     where user_id = p.id and id like 'demo2-%') as animais,
       (select count(*) from public.membro_exploracao where user_id = p.id) as membros
  from public.perfil p
  join auth.users u on u.id = p.id
 where u.email = current_setting('demo.email');
-- O `membros` TEM de ser 1. A zero, a app mostra o ecrã de acesso e o botão de
-- apagar a conta não aparece no build 7 -- que é o cenário que isto evita.


-- ---- Limpar, quando já não fizer falta -----------------------------------
-- A conta de autenticação apaga-se a si própria pela app (é para isso que
-- existe). Isto é só para os dados, se a conta ficar e os dados não fizerem
-- falta:
--
--   delete from public.evento     where id like 'demo2-%';
--   delete from public.animal     where id like 'demo2-%';
--   delete from public.terreno    where id like 'demo2-%';
--   delete from public.membro_exploracao where exploracao_id like 'demo2-%';
--   delete from public.exploracao where id like 'demo2-%';
