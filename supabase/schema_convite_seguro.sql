-- ==================================================================
-- Terrabovina — códigos de convite que não se adivinham nem se experimentam
-- ==================================================================
-- Aplica DEPOIS de schema_acesso_ate.sql (17), que é onde o `criar_convite`
-- ficou com a hora de fim, e de schema_convite_por_papel.sql (22), que é onde o
-- `resgatar_convite` ficou com a conferência do papel. Substitui os dois.
-- Idempotente.
--
-- Um código de convite é a chave da exploração: quem o resgata entra na equipa,
-- fica com um papel e passa a ver o efetivo. Havia duas maneiras de lá chegar
-- sem ele ter sido dado a ninguém.
--
-- 1. O CÓDIGO SAÍA DO `random()`
--
-- O `random()` do Postgres não é criptográfico: é um gerador com estado, e a
-- partir de valores observados dele podem inferir-se os seguintes. Quem
-- receba um convite legítimo (um trabalhador que já saiu, por exemplo) tem uma
-- amostra na mão. Não é um ataque de fim de semana — mas é uma propriedade
-- que uma chave de acesso não pode ter, e trocar o gerador não custa nada.
--
-- Passa a `gen_random_bytes` (pgcrypto), que vai buscar entropia ao sistema
-- operativo. O alfabeto tem 32 letras de propósito e o ficheiro recusa-se a
-- trabalhar com outro número: 256 é múltiplo exato de 32, portanto `byte % 32`
-- dá as 32 letras com a mesma probabilidade. Com um alfabeto de 30, as duas
-- primeiras letras sairiam mais vezes do que as outras — e uma chave com letras
-- prováveis é uma chave mais curta do que parece.
--
-- O alfabeto não tem I, O, 0 nem 1 — vem de trás e é para ler ao telefone.
--
-- 2. PODIA-SE EXPERIMENTAR CÓDIGOS A EITO
--
-- O `resgatar_convite` respondia a quantas tentativas lhe fizessem. Com sessão
-- iniciada (registar uma conta é livre), um ciclo podia bater à porta sem fim,
-- e cada exploração tem sempre alguns códigos válidos à espera.
--
-- Passa a haver um travão: 10 tentativas falhadas por conta em 15 minutos.
--
-- POR ISSO É QUE ESTA FUNÇÃO DEIXOU DE DAR ERRO E PASSOU A DEVOLVÊ-LO
--
-- Um travão precisa de contar as tentativas, e contar precisa de escrever. Mas
-- a função sinalizava tudo o que corria mal com `raise exception`, e uma
-- exceção leva atrás a transação INTEIRA — incluindo a linha que acabou de
-- registar a tentativa. O contador ficava sempre a zero: o travão existia no
-- código e não existia na base. (Não há volta a dar dentro de uma função:
-- transação autónoma não há em Postgres, e `commit` só dentro de procedimentos,
-- que não é o que o PostgREST chama.)
--
-- Então o que corre mal passa a vir DENTRO da resposta: `{"erro": "..."}`. A
-- transação fecha-se bem, a tentativa fica registada, e o texto que a app
-- mostra é o mesmo de antes. O cliente (`data/membros.tsx`) lê os dois
-- caminhos — o `erro` da resposta e a exceção — porque uma base que ainda não
-- tenha corrido este ficheiro continua a responder pelo caminho antigo.
--
-- O que NÃO conta como tentativa: um código que existe mesmo mas já foi usado,
-- expirou, ou é do outro papel. Quem tem um código verdadeiro na mão não anda a
-- adivinhar — e trancá-lo por insistir num que tem à frente dos olhos era
-- transformar um travão contra estranhos num castigo a quem cá trabalha.
-- ==================================================================

create extension if not exists pgcrypto;


-- ------------------------------------------------------------------
-- 1. Criar: o código vem de entropia a sério
-- ------------------------------------------------------------------
-- Cópia integral da versão do ficheiro 17 com o gerador trocado. É copiada e
-- não estendida porque `create or replace` substitui o corpo inteiro — ter aqui
-- só o pedaço novo deixava o resto por escrever.
--
-- O `search_path` leva `extensions` à frente porque é lá que o Supabase instala
-- o pgcrypto; com `'public'` sozinho, o `gen_random_bytes` não era encontrado e
-- criar convites deixava de funcionar. Se numa base o pgcrypto estiver no
-- `public` (instalações antigas), esta lista encontra-o à mesma.
create or replace function public.criar_convite(
  exp_id text,
  novo_role public.role_membro,
  descricao_txt text default null,
  validade_horas int default 168,
  acesso_horas int default null,
  acesso_ate timestamptz default null
) returns text language plpgsql security definer
  set search_path = 'public', 'extensions' as $$
declare
  novo_codigo text;
  tentativas int := 0;
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  i int;
  fim_codigo timestamptz;
begin
  if public.role_em(exp_id) is distinct from 'admin' and not public.eh_superadmin() then
    raise exception 'apenas admins da exploração podem criar convites';
  end if;
  if novo_role = 'admin' then
    raise exception 'convites não podem promover a admin';
  end if;
  if acesso_horas is not null and acesso_horas <= 0 then
    raise exception 'o tempo de acesso tem de ser maior do que zero';
  end if;

  -- Uma hora já passada é sempre engano de quem escreveu: o código nasceria
  -- morto e a app só o descobriria quando o veterinário o tentasse usar, do
  -- outro lado do telefone.
  if acesso_ate is not null and acesso_ate <= now() then
    raise exception 'a hora de fim do acesso já passou';
  end if;

  -- As duas juntas não são um erro (a app manda uma de cada vez), mas seriam
  -- uma ambiguidade escrita na base. Quem marca a hora, marca a hora.
  if acesso_ate is not null then
    acesso_horas := null;
  end if;

  -- 32 letras é o que torna o `% 32` justo (ver o cabeçalho). Mexer no alfabeto
  -- sem dar por isso enviesava os códigos em silêncio; assim, para aqui.
  if length(alfabeto) <> 32 then
    raise exception 'o alfabeto dos convites tem de ter 32 letras (tem %)', length(alfabeto);
  end if;

  loop
    bytes := gen_random_bytes(8);
    novo_codigo := '';
    for i in 1..8 loop
      novo_codigo := novo_codigo || substr(alfabeto, 1 + (get_byte(bytes, i - 1) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.convite where codigo = novo_codigo);
    tentativas := tentativas + 1;
    if tentativas > 5 then raise exception 'falhou a gerar código único'; end if;
  end loop;

  -- Um código válido 7 dias que dá acesso até amanhã às 18h é um código que
  -- deixa de servir para nada amanhã às 18h. Encurtar aqui a validade DELE evita
  -- que fique meia semana à espera na conversa do WhatsApp a parecer bom.
  fim_codigo := now() + make_interval(hours => validade_horas);
  if acesso_ate is not null and acesso_ate < fim_codigo then
    fim_codigo := acesso_ate;
  end if;

  insert into public.convite
    (codigo, exploracao_id, role, criado_por, descricao, expira_em, acesso_horas, acesso_ate)
  values
    (novo_codigo, exp_id, novo_role, auth.uid(), descricao_txt,
     fim_codigo, acesso_horas, acesso_ate);
  return novo_codigo;
end;
$$;

revoke execute on function public.criar_convite(text, public.role_membro, text, int, int, timestamptz) from anon, public;
grant  execute on function public.criar_convite(text, public.role_membro, text, int, int, timestamptz) to authenticated;


-- ------------------------------------------------------------------
-- 2. Onde ficam as tentativas falhadas
-- ------------------------------------------------------------------
-- Guarda-se QUEM e QUANDO. O código tentado não se guarda: não serve para nada
-- aqui, e um código quase certo escrito numa tabela é uma pista que não
-- precisamos de ter.
create table if not exists public.convite_tentativa (
  id bigint generated by default as identity primary key,
  -- `on delete cascade`: apagada a conta, apagado o que se sabia dela. Isto não
  -- é histórico para ninguém consultar, é um contador com data.
  user_id uuid not null references auth.users (id) on delete cascade,
  em timestamptz not null default now()
);

-- É sempre lido da mesma maneira: uma conta, os últimos minutos.
create index if not exists idx_convite_tentativa_user
  on public.convite_tentativa (user_id, em desc);

-- RLS ligada e SEM políticas nenhumas: ninguém lê nem escreve isto pela API. Os
-- `revoke` fazem o mesmo por outro caminho, e os dois juntos são de propósito —
-- quem só tem RLS conta com que ninguém lhe dê um `grant` por engano.
-- A escrita é toda da função aqui abaixo, que corre como dona e passa por cima.
alter table public.convite_tentativa enable row level security;
revoke all on public.convite_tentativa from anon, authenticated;


-- ------------------------------------------------------------------
-- 3. Resgatar: com travão, e a dizer o que correu mal em vez de rebentar
-- ------------------------------------------------------------------
create or replace function public.resgatar_convite(codigo_txt text)
returns json language plpgsql security definer set search_path = 'public' as $$
declare
  c        public.convite%rowtype;
  fim      timestamptz;
  intencao public.role_membro;
  quem     uuid := auth.uid();
  falhadas int;
begin
  if quem is null then
    return json_build_object('erro', 'sessão não iniciada');
  end if;

  -- Lixo de ontem, limpo por quem passa. Sem isto a tabela só crescia — e o
  -- travão só olha para os últimos 15 minutos, o resto não serve a ninguém.
  delete from public.convite_tentativa
   where user_id = quem and em < now() - interval '1 day';

  select count(*) into falhadas
    from public.convite_tentativa
   where user_id = quem and em > now() - interval '15 minutes';

  -- Devolve-se ANTES de registar mais uma: quem está travado não faz crescer a
  -- tabela, e o tempo de espera não se renova a cada tentativa (senão quem
  -- insiste nunca mais entra, nem com o código certo na mão).
  if falhadas >= 10 then
    return json_build_object(
      'erro', 'Demasiadas tentativas falhadas. Espere 15 minutos e tente outra vez.');
  end if;

  select * into c from public.convite where codigo = upper(trim(codigo_txt));
  if not found then
    -- A única falha que conta como tentativa: um código que não existe é o que
    -- fica de quem anda a adivinhar.
    insert into public.convite_tentativa (user_id) values (quem);
    return json_build_object('erro', 'código inválido');
  end if;
  if c.usado_por is not null then
    return json_build_object('erro', 'código já foi usado');
  end if;
  if c.expira_em is not null and c.expira_em < now() then
    return json_build_object('erro', 'código expirado');
  end if;
  -- Defesa a dobrar: a secção 2 do ficheiro 17 já encurta a validade do código
  -- à hora do fim do acesso, mas os códigos criados ANTES dele não passaram por
  -- lá.
  if c.acesso_ate is not null and c.acesso_ate <= now() then
    return json_build_object('erro', 'o prazo de acesso deste convite já terminou');
  end if;

  -- O código é de um papel, a conta foi criada para outro. A frase diz os dois
  -- nomes de propósito: quem a lê é a pessoa que está a tentar entrar, e é ela
  -- que vai ter de pedir o código certo a quem lho deu.
  intencao := public.intencao_de_equipa(quem);
  if intencao is not null and c.role in ('trabalhador', 'veterinario') and c.role <> intencao then
    return json_build_object('erro', format(
      'este código é de %s, e a sua conta foi criada como %s. Peça um código de %s a quem gere a exploração.',
      case c.role     when 'veterinario' then 'veterinário' else 'trabalhador' end,
      case intencao   when 'veterinario' then 'veterinário' else 'trabalhador' end,
      case intencao   when 'veterinario' then 'veterinário' else 'trabalhador' end));
  end if;

  fim := case
    when c.acesso_ate is not null then c.acesso_ate
    when c.acesso_horas is null then null
    else now() + make_interval(hours => c.acesso_horas)
  end;

  insert into public.membro_exploracao (user_id, exploracao_id, role, expira_em)
  values (quem, c.exploracao_id, c.role, fim)
  on conflict (user_id, exploracao_id) do update
    set role = excluded.role,
        expira_em = excluded.expira_em;

  update public.convite set usado_por = quem, usado_em = now() where codigo = c.codigo;
  update public.perfil set estado = 'ativo' where id = quem;

  -- Entrou: o que tinha falhado antes já não interessa a ninguém. Quem se
  -- enganou duas vezes e acertou à terceira não fica com meio travão em cima
  -- para o convite seguinte.
  delete from public.convite_tentativa where user_id = quem;

  return json_build_object(
    'exploracao_id', c.exploracao_id,
    'role', c.role,
    'expira_em', fim
  );
end;
$$;

grant execute on function public.resgatar_convite(text) to authenticated;


-- ------------------------------------------------------------------
-- Tabela nova e funções mudadas: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Os códigos continuam a sair com 8 letras do alfabeto certo (na sessão de
--    um admin de exploração):
--
--   select public.criar_convite('<id da exploração>', 'trabalhador');
--   -- 8 caracteres, sem I, O, 0 nem 1
--
-- 2. E saem bem distribuídos — 32 grupos com contagens parecidas, nenhum a
--    zero (numa base de testes, e a apagar no fim):
--
--   select substr(codigo, 1, 1) as letra, count(*)
--     from (select public.criar_convite('<exp>', 'trabalhador') as codigo
--             from generate_series(1, 2000)) t
--    group by 1 order by 2 desc;
--   delete from public.convite where usado_por is null and descricao is null;
--
-- 3. O travão fecha à décima primeira. Na sessão de uma conta qualquer:
--
--   select public.resgatar_convite('ZZZZZZZZ') from generate_series(1, 11);
--   -- as 10 primeiras: {"erro": "código inválido"}
--   -- a 11.ª:          {"erro": "Demasiadas tentativas falhadas..."}
--
--   E — o que é o ponto todo deste ficheiro — as tentativas ficaram mesmo lá:
--
--   select count(*) from public.convite_tentativa;   -- 10
--
-- 4. Um código verdadeiro não gasta tentativas. Com um código já usado:
--
--   select public.resgatar_convite('<código já usado>') from generate_series(1, 20);
--   select count(*) from public.convite_tentativa;   -- na mesma
--
-- 5. Ninguém lê o contador pela API. Na sessão de um utilizador:
--
--   select * from public.convite_tentativa;   -- permission denied
