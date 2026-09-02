-- ==================================================================
-- Terrabovina — sociedades agrícolas: o supervisor e o líder de exploração
-- ==================================================================
-- Aplica DEPOIS de todos os anteriores (é o último do `ordem.txt`). Idempotente.
--
-- O QUE ISTO TRAZ
--
-- Até aqui só havia uma forma de ter explorações: criá-las, e ficar dono
-- (`admin`) de cada uma. Serve quem tem a sua quinta. Não serve uma sociedade
-- agrícola, onde quem assina a subscrição não é quem anda com o gado: é uma
-- pessoa que tem várias explorações, põe um responsável à frente de cada uma, e
-- quer ver o que se passa em todas sem lhes mexer no efetivo.
--
-- Nascem por isso dois lugares novos, e nenhum deles é um superadmin:
--
--   SUPERVISOR (`role = 'supervisor'`). A conta que a sociedade paga. Cria as
--   explorações, convida um líder para cada uma, e daí em diante SUPERVISIONA:
--   lê tudo o que lá se passa (animais, histórico, contas, atividade), trata do
--   património (terrenos, dados da exploração), da equipa, e é o único que pode
--   apagar uma exploração da sociedade. Não regista animais, não escreve
--   tratamentos, não dá saídas, não apaga um registo que seja. O gado é de quem
--   trata dele.
--
--   LÍDER DE EXPLORAÇÃO. Não é papel novo nenhum — é o `admin` de sempre, agora
--   a poder entrar por convite. Corre a exploração como o dono de sempre a
--   corria: animais, terrenos, equipa, contas, documentos. O que não pode é
--   apagar a exploração (não é dele: é da sociedade) nem mexer na linha do
--   supervisor.
--
-- PORQUE É QUE O LÍDER É O `admin` E NÃO UM PAPEL NOVO
--
-- Há 42 sítios nas políticas desta base a perguntar `role_em(...) = 'admin'`:
-- equipa, convites, contas, documentos, agenda, atividade. Um papel novo obriga
-- a passar por todos, e um esquecido não dá erro nenhum — fecha em silêncio uma
-- porta a quem usa a app todos os dias. O supervisor, esse, aparece só onde a
-- supervisão precisa dele, que são meia dúzia de sítios, e todos aqui.
--
-- AS TRÊS ARMADILHAS QUE VÊM COM ISTO (secções 5, 6 e 7)
--
--   1. Quem paga deixa de ser o `admin`. `exploracao_ativa()` perguntava "há um
--      admin com conta ativa?" — com o líder a ser esse admin, suspender a
--      sociedade por falta de pagamento não congelava nada, e a exploração
--      nascia congelada no intervalo entre ser criada e o líder aceitar o
--      convite.
--   2. O líder é `admin`, e `eh_convidado()` dizia "tem vínculos e nenhum é de
--      dono" — ou seja, o líder passava a poder abrir quintas próprias por
--      conta da subscrição de outra pessoa.
--   3. `membro_admin_write` deixa um admin escrever na equipa da exploração
--      dele. Sem uma exceção, o líder apagava a linha do supervisor e trancava
--      fora da exploração a pessoa que a criou e a paga.
--
-- ------------------------------------------------------------------
-- LER ISTO ANTES DE MEXER: a regra do `::text`
-- ------------------------------------------------------------------
-- Este é o primeiro ficheiro de schema com um `alter type ... add value`, e o
-- `scripts/gerar-schema-completo.ps1` conta com que não houvesse nenhum: o
-- `_completo.sql` cola-se de uma vez e o Postgres corre isso como UMA
-- transação, que é o que faz uma aplicação falhada não deixar a base a meio.
--
-- O Postgres deixa acrescentar um valor a um enum dentro de uma transação, mas
-- NÃO deixa usar esse valor antes de ela fechar. "Usar" inclui uma coisa que
-- não parece uso nenhum: escrever o literal `'supervisor'` num sítio que o
-- Postgres analisa no momento em que o comando é criado — o corpo de uma função
-- `language sql`, a condição de uma política, uma restrição `check`. Todos eles
-- convertem o literal para o enum ali mesmo, e o comando rebenta com «unsafe
-- use of new value "supervisor"».
--
--   REGRA: neste ficheiro, o valor `'supervisor'` compara-se SEMPRE contra
--   texto — `role::text = 'supervisor'`, `role_em(...) in ('admin',
--   'supervisor')` (o `role_em()` já devolve texto). Nunca `role =
--   'supervisor'`.
--
-- As exceções são os corpos `language plpgsql`, que o Postgres só analisa na
-- primeira execução — muito depois de a transação ter fechado. Lá dentro o
-- literal pode ser o enum, e é (ver a secção 2). Se um dia isto for a um
-- ficheiro novo, a regra volta a ser precisa lá.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. O papel novo, e o tipo de conta que o faz nascer
-- ------------------------------------------------------------------
alter type public.role_membro add value if not exists 'supervisor';

-- 'individual' (o que sempre houve): cria explorações e é dona delas.
-- 'sociedade': cria explorações e SUPERVISIONA-AS; quem as corre é o líder que
-- ela convida. Quem marca isto é o superadmin, porque é um plano que se vende
-- (ver `superadmin_definir_tipo_conta` na secção 13).
--
-- Mudar o tipo a uma conta que já tem explorações NÃO desfaz o que está feito,
-- de propósito: as que ela já tinha continuam dela (é `admin` delas, mexe no
-- gado), e só as SEGUINTES nascem supervisionadas. Uma conta pode assim ficar
-- com as duas coisas ao mesmo tempo, e a app aguenta isso sem esforço — o papel
-- é por exploração, e cada ecrã pergunta pelo papel DAQUELA exploração.
alter table public.perfil
  add column if not exists tipo_conta text not null default 'individual';

do $$ begin
  alter table public.perfil
    add constraint perfil_tipo_conta_valido
    check (tipo_conta in ('individual', 'sociedade'));
exception when duplicate_object then null; end $$;

-- ---- O guarda das colunas que a sessão não escreve ----
-- `is_superadmin`, `estado` e agora `tipo_conta` decidem o que uma conta pode
-- fazer, e vivem na MESMA LINHA que o nome e o telefone. A política
-- `perfil_self_update` limita que LINHA se escreve e não que COLUNAS, portanto
-- por ela um `update perfil set is_superadmin = true` passava.
--
-- Isso foi fechado em julho de 2026 com grants por coluna — escritos à mão no
-- SQL Editor, e em ficheiro nenhum. Quer dizer que a produção está protegida e
-- que qualquer base NOVA nasce com o buraco aberto, e que a coluna que este
-- ficheiro acrescenta não estaria coberta em base nenhuma.
--
-- Aqui fecha-se por gatilho, e não repetindo os grants, por duas razões: o
-- Postgres não sabe tirar UMA coluna de um `grant update` dado à tabela inteira
-- (era preciso revogar e reconstruir a lista, e essa lista já divergiu entre
-- bases), e um gatilho diz na mensagem o que se passou em vez de um "permission
-- denied for column" seco.
--
-- `current_user` é o que separa os dois mundos: o PostgREST corre como
-- `authenticated`, e as funções `security definer` (`resgatar_convite`, que põe
-- a conta ativa, `superadmin_aprovar_cliente`, `superadmin_definir_tipo_conta`)
-- correm como dono e passam. O superadmin também passa: o painel dele é o sítio
-- onde estas colunas se mudam.
--
-- E é por isso que esta função, ao contrário de quase todas as outras deste
-- ficheiro, **não é `security definer`**. Dentro de uma função dessas o
-- `current_user` é o DONO da função e não quem está a escrever, por isso a
-- condição de cima nunca podia ser verdadeira: o gatilho deixava passar tudo,
-- em silêncio, e parecia estar a defender a coluna. Foi assim que ele nasceu, e
-- foi a prova no psql que o apanhou (`update perfil set is_superadmin = true`
-- na sessão de uma conta normal passou à primeira). Aqui não é preciso
-- privilégio nenhum: a função só olha para o `old` e o `new`.
create or replace function public.perfil_colunas_reservadas()
returns trigger language plpgsql set search_path = 'public' as $$
begin
  if current_user in ('authenticated', 'anon')
     and not public.eh_superadmin()
     and (
          new.is_superadmin is distinct from old.is_superadmin
       or new.estado        is distinct from old.estado
       or new.tipo_conta    is distinct from old.tipo_conta
     )
  then
    raise exception
      'As colunas estado, is_superadmin e tipo_conta do perfil só se mudam pelas funções próprias.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_perfil_colunas_reservadas on public.perfil;
create trigger trg_perfil_colunas_reservadas
  before update on public.perfil
  for each row execute function public.perfil_colunas_reservadas();


-- ------------------------------------------------------------------
-- 2. A exploração de uma sociedade nasce supervisionada
-- ------------------------------------------------------------------
-- Cópia integral da versão do ficheiro 34 (`schema_existencias_opcional.sql`)
-- com o papel a depender do tipo de conta. É copiada e não estendida porque o
-- `create or replace` substitui o corpo inteiro — ter aqui só o pedaço novo
-- deixava as três heranças de opt-in por escrever, e ninguém dava por isso
-- senão no dia em que uma exploração nova nascesse com as finanças desligadas.
--
-- É `language plpgsql`, e é por isso que o literal `'supervisor'` pode aqui ser
-- o enum: este corpo só é analisado na primeira vez que a função corre. Ver a
-- regra do `::text` no cabeçalho.
create or replace function public.handle_new_exploracao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.membro_exploracao (user_id, exploracao_id, role)
  values (
    new.user_id,
    new.id,
    case
      when coalesce(
             (select p.tipo_conta from public.perfil p where p.id = new.user_id),
             'individual'
           ) = 'sociedade'
        then 'supervisor'::public.role_membro
        else 'admin'::public.role_membro
    end
  )
  on conflict do nothing;

  update public.exploracao
     set financas_ativas = coalesce(
           (select p.financas_ativas from public.perfil p where p.id = new.user_id),
           false
         ),
         casa_ativa = coalesce(
           (select p.casa_ativa from public.perfil p where p.id = new.user_id),
           false
         ),
         existencias_ativas = coalesce(
           (select p.existencias_ativas from public.perfil p where p.id = new.user_id),
           false
         )
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_exploracao_created on public.exploracao;
create trigger on_exploracao_created
  after insert on public.exploracao
  for each row execute function public.handle_new_exploracao();

-- O supervisor não tem prazo, pela mesma razão que o admin não tinha: uma
-- exploração cujo supervisor expirasse ficava sem ninguém que a pudesse gerir e
-- sem ninguém que pudesse renovar o acesso. Substitui a restrição do ficheiro
-- 15, que só falava do admin.
update public.membro_exploracao set expira_em = null where role::text = 'supervisor';

alter table public.membro_exploracao
  drop constraint if exists membro_admin_sem_prazo;
alter table public.membro_exploracao
  add constraint membro_admin_sem_prazo
  check (role::text not in ('admin', 'supervisor') or expira_em is null);


-- ------------------------------------------------------------------
-- 3. O que o supervisor pode de origem
-- ------------------------------------------------------------------
-- Espelha a tabela `PERMISSOES` de `src/data/permissoes.ts`. Mexer aqui obriga
-- a mexer lá (e no `permissoes.test.ts`).
--
-- O supervisor trata do PATRIMÓNIO e da EQUIPA, e não do gado: terrenos sim,
-- dados da exploração sim, convidar e remover pessoas sim. Animais não —
-- nem a ficha, nem os tratamentos, nem as saídas, nem eliminar. As contas
-- lê-as todas (secção 10) mas não lança nem uma: quem lança despesas é quem
-- traz a fatura da ração, e quem lança receitas é quem vendeu o animal.
-- Marcar na agenda também não (secção 11): a agenda é o plano de quem lá anda.
--
-- O `marcarEventos` do trabalhador é correção antiga que só agora se vê: a
-- lista dele nunca o teve aqui (a da app sempre o teve), e ninguém deu por isso
-- porque política nenhuma perguntava por essa capacidade. A secção 11 passa a
-- perguntar, e sem esta linha o trabalhador perdia hoje a agenda que usa desde
-- que ela existe.
--
-- `eliminarExploracao` é dele, e é a única coisa que o LÍDER perde por a
-- exploração ser de uma sociedade: apagar é de quem a exploração é. Onde não há
-- supervisor, o `admin` continua a apagar a sua, como sempre apagou (secção 9).
create or replace function public.role_padrao_pode(r public.role_membro, cap text)
returns boolean language sql immutable set search_path = '' as $$
  select case r::text
    when 'admin' then true
    when 'supervisor' then cap = any (array[
      'gerirTerrenos', 'editarExploracao', 'gerirEquipa', 'eliminarExploracao'
    ])
    when 'trabalhador' then cap = any (array[
      'gerirTerrenos', 'editarAnimais', 'registarTratamentos', 'eliminarAnimais',
      'registarSaida', 'registarDespesa', 'registarCustoTratamento', 'marcarEventos'
    ])
    when 'veterinario' then cap = any (array[
      'registarTratamentos', 'registarCustoTratamento'
    ])
    else false
  end;
$$;


-- ------------------------------------------------------------------
-- 4. O supervisor não se ajusta, como o dono não se ajustava
-- ------------------------------------------------------------------
-- Cópia da versão do ficheiro 15 (`schema_acesso_temporario.sql`, que lhe
-- juntou o prazo) com `supervisor` ao lado de `admin` no ramo que ignora os
-- ajustes por pessoa. Sem isto, o líder abria a folha de permissões do
-- supervisor e tirava-lhe os terrenos — quem foi convidado a limitar quem
-- convida.
create or replace function public.pode_cap(exp_id text, cap text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select public.eh_superadmin() or (
    public.pode_escrever_em(exp_id)
    and coalesce((
      select case
        when m.role::text in ('admin', 'supervisor') or not public.capacidade_gerivel(cap)
          then public.role_padrao_pode(m.role, cap)
        else coalesce(
          public.ajuste_permissao(m.permissoes, cap),
          public.role_padrao_pode(m.role, cap)
        )
      end
      from public.membro_exploracao m
      where m.exploracao_id = exp_id
        and m.user_id = auth.uid()
        and (m.expira_em is null or m.expira_em > now())
      limit 1
    ), false)
  );
$$;


-- ------------------------------------------------------------------
-- 5. Quem paga passa a ser o supervisor, quando há um
-- ------------------------------------------------------------------
create or replace function public.tem_supervisor(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.membro_exploracao
     where exploracao_id = exp_id and role::text = 'supervisor'
  );
$$;

-- `exploracao_ativa()` decide se uma exploração está congelada — e congelada
-- quer dizer só de leitura para TODA a gente que lá trabalha, incluindo o líder
-- e os trabalhadores. É a peça que faz a suspensão por falta de pagamento
-- valer alguma coisa (ver `schema_suspensao.sql`, 6.º).
--
-- Perguntava "há um admin com conta ativa?". Com o líder a ser esse admin,
-- passava a acontecer o contrário do que se quer nas duas pontas: suspender a
-- sociedade não congelava nada (o líder estava ativo), e suspender um líder
-- congelava uma exploração que estava paga.
--
-- Passa a ser: onde há supervisor, é a conta DELE que decide, e mais nenhuma.
-- Onde não há, fica exatamente como estava. O `case` é o que garante que um
-- líder ativo não descongela a exploração de uma sociedade suspensa — um
-- `or` no lugar dele fazia precisamente isso.
create or replace function public.exploracao_ativa(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1
      from public.membro_exploracao m
      join public.perfil p on p.id = m.user_id
     where m.exploracao_id = exp_id
       and p.estado = 'ativo'
       and m.role::text = case
             when public.tem_supervisor(exp_id) then 'supervisor'
             else 'admin'
           end
  );
$$;


-- ------------------------------------------------------------------
-- 6. O líder não abre quinta própria
-- ------------------------------------------------------------------
-- `eh_convidado()` é o que impede uma conta que entrou pela porta de outra
-- pessoa de criar explorações suas (política `exploracao_ativo_insert`, do
-- ficheiro 20). Perguntava "tem vínculos e nenhum deles é de dono?" — e o líder
-- É dono da exploração que lhe deram a correr, portanto passava no teste e
-- ficava a poder abrir as suas por conta da subscrição da sociedade.
--
-- A pergunta certa nunca foi sobre o papel: é sobre a conta ter chegado pela
-- porta de outra pessoa. Passa a ser "tem vínculos e nunca criou uma
-- exploração", que responde igual a tudo o que já respondia — o trabalhador e o
-- veterinário nunca criaram nenhuma, a conta nova não tem vínculos e continua a
-- poder criar a primeira, e o cliente de sempre criou as suas — e responde
-- certo ao líder, que é `admin` sem nunca ter criado nada.
--
-- A conta de sociedade criou as dela: continua a poder criar mais.
create or replace function public.eh_convidado()
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (select 1 from public.membro_exploracao where user_id = auth.uid())
     and not exists (select 1 from public.exploracao where user_id = auth.uid());
$$;


-- ------------------------------------------------------------------
-- 7. A equipa: quem a vê, quem lhe mexe, e a linha que ninguém apaga
-- ------------------------------------------------------------------
drop policy if exists membro_self_select on public.membro_exploracao;
create policy membro_self_select on public.membro_exploracao
  for select using (
    auth.uid() = user_id
    or public.role_em(exploracao_id) in ('admin', 'supervisor')
    or public.eh_superadmin()
  );

-- Duas assimetrias, e as duas de propósito:
--
--   O supervisor pode criar linhas de `admin` — é assim que um líder entra — e
--   não pode criar outro supervisor: o supervisor de uma exploração é quem a
--   criou, e não se convida ninguém para esse lugar.
--
--   O admin (o líder, ou o dono de sempre) não toca em linhas de `supervisor`,
--   nem no `using` (não as apaga) nem no `with check` (não as cria). Sem a
--   primeira metade, o líder removia da equipa a pessoa que criou a exploração
--   e a paga, e ficava com ela para si.
drop policy if exists membro_admin_write on public.membro_exploracao;
create policy membro_admin_write on public.membro_exploracao
  for all using (
    public.eh_superadmin()
    or public.role_em(exploracao_id) = 'supervisor'
    or (public.role_em(exploracao_id) = 'admin' and role::text <> 'supervisor')
  ) with check (
    public.eh_superadmin()
    or (public.role_em(exploracao_id) = 'supervisor' and role::text <> 'supervisor')
    or (public.role_em(exploracao_id) = 'admin' and role::text not in ('admin', 'supervisor'))
  );


-- ------------------------------------------------------------------
-- 8. Convites: só o supervisor convida um líder
-- ------------------------------------------------------------------
drop policy if exists convite_admin_select on public.convite;
create policy convite_admin_select on public.convite
  for select using (
    public.role_em(exploracao_id) in ('admin', 'supervisor') or public.eh_superadmin()
  );

drop policy if exists convite_admin_write on public.convite;
create policy convite_admin_write on public.convite
  for all using (
    public.role_em(exploracao_id) in ('admin', 'supervisor') or public.eh_superadmin()
  ) with check (
    public.role_em(exploracao_id) in ('admin', 'supervisor') or public.eh_superadmin()
  );

-- Cópia integral da versão do ficheiro 32 (`schema_convite_seguro.sql`, o
-- gerador de entropia a sério) com o portão do início reescrito. Copiada e não
-- estendida pela razão de sempre: o `create or replace` troca o corpo todo.
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
  papel_de_quem text := public.role_em(exp_id);
begin
  if papel_de_quem is distinct from 'admin'
     and papel_de_quem is distinct from 'supervisor'
     and not public.eh_superadmin() then
    raise exception 'apenas quem gere a exploração pode criar convites';
  end if;

  -- O lugar de supervisor não se convida: é de quem criou a exploração.
  if novo_role::text = 'supervisor' then
    raise exception 'o supervisor de uma exploração é quem a cria, e não se convida';
  end if;

  -- Um código de líder só sai da mão do supervisor. Para o dono de sempre a
  -- regra fica a que sempre foi ("convites não podem promover a admin"): a
  -- exploração dele tem um dono, que é ele.
  if novo_role::text = 'admin'
     and papel_de_quem is distinct from 'supervisor'
     and not public.eh_superadmin() then
    raise exception 'só o supervisor pode convidar um líder de exploração';
  end if;

  -- Um líder não entra por prazo — a restrição `membro_admin_sem_prazo` recusa
  -- a linha, e sem esta mensagem o erro só aparecia do lado de quem resgatasse
  -- o código, a falar de uma restrição que essa pessoa não conhece.
  if novo_role::text = 'admin' and (acesso_horas is not null or acesso_ate is not null) then
    raise exception 'um líder de exploração não entra por prazo';
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

  -- 32 letras é o que torna o `% 32` justo (ver o cabeçalho do ficheiro 32).
  -- Mexer no alfabeto sem dar por isso enviesava os códigos em silêncio.
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


-- ------------------------------------------------------------------
-- 9. A exploração: o supervisor edita, e apagar fica de fora
-- ------------------------------------------------------------------
-- Editar (nome, marca, NIF, localização) é do supervisor e do líder.
drop policy if exists exploracao_admin_update on public.exploracao;
create policy exploracao_admin_update on public.exploracao
  for update using (
    public.pode_escrever_em(id)
    and (public.role_em(id) in ('admin', 'supervisor') or public.eh_superadmin())
  ) with check (
    public.pode_escrever_em(id)
    and (public.role_em(id) in ('admin', 'supervisor') or public.eh_superadmin())
  );

-- Apagar é de quem a exploração é, e a pergunta "de quem é?" tem duas
-- respostas: onde há supervisor é dele, e só dele; onde não há é do `admin`,
-- que é o dono de sempre.
--
-- O líder fica de fora quando há supervisor — não porque não saiba o que faz,
-- mas porque a exploração não é dele: ele foi convidado para a correr, e apagar
-- leva o efetivo e o histórico de outra pessoa atrás.
--
-- Nas explorações sem supervisor — as de sempre — não muda nada.
drop policy if exists exploracao_admin_delete on public.exploracao;
create policy exploracao_admin_delete on public.exploracao
  for delete using (
    public.eh_superadmin()
    or (
      public.pode_escrever_em(id)
      and (
        public.role_em(id) = 'supervisor'
        or (public.role_em(id) = 'admin' and not public.tem_supervisor(id))
      )
    )
  );


-- ------------------------------------------------------------------
-- 10. O que o supervisor VÊ
-- ------------------------------------------------------------------
-- Os animais, os terrenos, os eventos e os documentos já lhe estavam abertos
-- sem se lhe tocar: essas políticas perguntam por `membro_de()` (ou por
-- `tem_documentos()`/`tem_agenda()`, que é "é membro e não é veterinário"), e o
-- supervisor é membro. Faltam as três que perguntavam por `= 'admin'`, que são
-- justamente as que respondem à pergunta que ele faz — o que se passou, quem
-- fez, e quanto custou.

-- ---- As contas ----
-- Ver a exploração inteira. Lançar não: nenhuma das políticas de escrita de
-- `movimento` o inclui (ficheiro 13), e `registarDespesa`/`registarReceita`
-- não estão no conjunto dele.
drop policy if exists movimento_select on public.movimento;
create policy movimento_select on public.movimento
  for select using (
    public.eh_superadmin()
    or public.role_em(exploracao_id) in ('admin', 'supervisor')
    or (public.membro_de(exploracao_id) and criado_por = auth.uid())
  );

-- ---- Quem alterou o quê ----
drop policy if exists atividade_select on public.registo_atividade;
create policy atividade_select on public.registo_atividade
  for select using (
    public.eh_superadmin()
    or user_id = auth.uid()
    or public.role_em(exploracao_id) in ('admin', 'supervisor')
  );

-- ---- Quem passou pela equipa ----
drop policy if exists equipa_historico_select on public.equipa_historico;
create policy equipa_historico_select on public.equipa_historico
  for select using (
    public.eh_superadmin()
    or user_id = auth.uid()
    or public.role_em(exploracao_id) in ('admin', 'supervisor')
  );


-- ------------------------------------------------------------------
-- 11. A agenda passa a olhar para `marcarEventos`
-- ------------------------------------------------------------------
-- `evento_agenda_insert` deixava marcar a quem tivesse agenda e pudesse
-- escrever na exploração — o que, para os papéis que existiam, dava o mesmo que
-- a tabela da app diz (o veterinário não tem agenda, e mais ninguém estava de
-- fora). Com o supervisor deixa de dar: ele tem agenda para ver e não a marca.
--
-- Em vez de o excluir pelo nome, a política passa a fazer a pergunta que a app
-- já fazia. Para o admin e para o trabalhador não muda nada.
drop policy if exists evento_agenda_insert on public.evento_agenda;
create policy evento_agenda_insert on public.evento_agenda
  for insert
  with check (
    criado_por = auth.uid()
    and public.tem_agenda(exploracao_id)
    and public.pode_escrever_em(exploracao_id)
    and public.pode_cap(exploracao_id, 'marcarEventos')
  );


-- ------------------------------------------------------------------
-- 12. As conversas
-- ------------------------------------------------------------------
-- O supervisor entra no grupo da exploração sem se lhe tocar: o gatilho
-- `chat_apos_membro` põe lá toda a gente menos o veterinário. Falta só quem
-- MANDA no grupo — mudar-lhe o nome, tirar e repor pessoas — que é a mesma
-- pergunta do `gerirEquipa`.
create or replace function public.mando_no_grupo(conv uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1
      from public.conversa c
      join public.membro_exploracao m on m.exploracao_id = c.exploracao_id
     where c.id = conv
       and c.tipo = 'grupo'
       and m.user_id = auth.uid()
       and m.role::text in ('admin', 'supervisor')
       and (m.expira_em is null or m.expira_em > now())
  );
$$;


-- ------------------------------------------------------------------
-- 13. O painel do superadmin
-- ------------------------------------------------------------------
-- Sem isto, uma conta de sociedade DESAPARECIA da lista de clientes: ela tem
-- vínculos e nenhum é de `admin`, que era exatamente a forma de dizer "este não
-- é cliente, é alguém que entrou por convite". E os líderes apareciam lá como
-- se fossem clientes, com a exploração de outra pessoa contada como sua.
--
-- As duas primeiras levam `drop` antes do `create`, e não é arrumação: ganham a
-- coluna `tipo_conta`, e o `create or replace` recusa-se a mudar o tipo de
-- retorno de uma função que já existe. Apagam-se de baixo para cima (a segunda
-- lê a primeira) e criam-se de cima para baixo.
drop function if exists public.superadmin_obter_cliente(uuid);
drop function if exists public.superadmin_listar_clientes();

create or replace function public.superadmin_listar_clientes()
returns table (
  user_id uuid,
  nome text,
  email text,
  telefone text,
  nif text,
  estado text,
  registado_em timestamptz,
  n_exploracoes bigint,
  n_terrenos bigint,
  n_animais bigint,
  plano text,
  preco_mensal numeric,
  estado_subscricao public.estado_subscricao,
  proxima_cobranca timestamptz,
  tipo_conta text
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then
    raise exception 'sem permissão';
  end if;
  return query
    select
      p.id,
      coalesce(p.nome, '(sem nome)'),
      u.email::text,
      p.telefone,
      p.nif,
      p.estado,
      u.created_at,
      coalesce(exp_stats.n_exploracoes, 0)::bigint,
      coalesce(ter_stats.n_terrenos, 0)::bigint,
      coalesce(ani_stats.n_animais, 0)::bigint,
      s.plano,
      s.preco_mensal,
      s.estado,
      s.proxima_cobranca,
      p.tipo_conta
    from public.perfil p
    join auth.users u on u.id = p.id
    left join (
      select m.user_id, count(distinct e.id) as n_exploracoes
      from public.membro_exploracao m
      join public.exploracao e on e.id = m.exploracao_id
      where m.role::text in ('admin', 'supervisor')
      group by m.user_id
    ) exp_stats on exp_stats.user_id = p.id
    left join (
      select m.user_id, count(t.id) as n_terrenos
      from public.membro_exploracao m
      join public.terreno t on t.exploracao_id = m.exploracao_id
      where m.role::text in ('admin', 'supervisor')
      group by m.user_id
    ) ter_stats on ter_stats.user_id = p.id
    left join (
      select m.user_id, count(a.id) as n_animais
      from public.membro_exploracao m
      join public.animal a on a.exploracao_id = m.exploracao_id
      where m.role::text in ('admin', 'supervisor')
      group by m.user_id
    ) ani_stats on ani_stats.user_id = p.id
    left join public.subscricao s on s.user_id = p.id
    where not p.is_superadmin
      and (
        -- candidato a cliente: ainda não tem membros (nunca resgatou convite)
        not exists (select 1 from public.membro_exploracao m where m.user_id = p.id)
        -- ou supervisiona alguma (é uma sociedade, e é ela que paga)
        or exists (
          select 1 from public.membro_exploracao m
           where m.user_id = p.id and m.role::text = 'supervisor'
        )
        -- ou é dono de alguma exploração SEM supervisor (criou as suas
        -- próprias). O `not tem_supervisor` é o que deixa os líderes de fora:
        -- eles são `admin` de uma exploração que outra pessoa paga.
        or exists (
          select 1 from public.membro_exploracao m
           where m.user_id = p.id
             and m.role::text = 'admin'
             and not public.tem_supervisor(m.exploracao_id)
        )
      )
    order by u.created_at desc;
end;
$$;

-- Recriada só por causa da assinatura: o `superadmin_obter_cliente` devolve as
-- colunas desta, e a coluna `tipo_conta` nova tem de aparecer nas duas. Já foi
-- apagada acima, antes da que ela lê.
create or replace function public.superadmin_obter_cliente(alvo uuid)
returns table (
  user_id uuid, nome text, email text, telefone text, nif text,
  estado text, registado_em timestamptz,
  n_exploracoes bigint, n_terrenos bigint, n_animais bigint,
  plano text, preco_mensal numeric,
  estado_subscricao public.estado_subscricao, proxima_cobranca timestamptz,
  tipo_conta text
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select * from public.superadmin_listar_clientes() c where c.user_id = alvo;
end;
$$;

-- As explorações de um cliente: as que ele corre e as que ele supervisiona.
create or replace function public.superadmin_exploracoes_cliente(alvo uuid)
returns table (
  id text, nome text, marca_exploracao text, nif_detentor text, localizacao text,
  n_terrenos bigint, n_animais bigint
) language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select
      e.id, e.nome, e.marca_exploracao, e.nif_detentor, e.localizacao,
      coalesce((select count(*) from public.terreno t where t.exploracao_id = e.id), 0)::bigint,
      coalesce((select count(*) from public.animal a where a.exploracao_id = e.id), 0)::bigint
    from public.exploracao e
    join public.membro_exploracao m
      on m.exploracao_id = e.id and m.role::text in ('admin', 'supervisor')
    where m.user_id = alvo
    order by e.nome;
end;
$$;

-- A equipa de uma exploração, com o supervisor à cabeça. Cópia da versão do
-- ficheiro 25 com uma linha mudada: a ordem punha-o no grupo das visitas.
create or replace function public.superadmin_membros_exploracao(exp_id text)
returns table (
  membro_id uuid,
  user_id uuid,
  nome text,
  email text,
  role public.role_membro,
  criado_em timestamptz,
  expira_em timestamptz,
  permissoes jsonb
)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  return query
    select
      m.id,
      m.user_id,
      coalesce(nullif(btrim(p.nome), ''), 'Sem nome')::text,
      coalesce(u.email, '')::text,
      m.role,
      m.criado_em,
      m.expira_em,
      m.permissoes
    from public.membro_exploracao m
    left join public.perfil p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    where m.exploracao_id = exp_id
    -- Quem paga primeiro, depois quem corre a exploração, depois os
    -- trabalhadores, depois as visitas; dentro de cada grupo por nome.
    order by case m.role::text
               when 'supervisor' then 0
               when 'admin' then 1
               when 'trabalhador' then 2
               else 3
             end,
             coalesce(nullif(btrim(p.nome), ''), 'Sem nome');
end;
$$;

-- Marcar (ou desmarcar) uma conta como sociedade. É aqui que o plano se vende.
create or replace function public.superadmin_definir_tipo_conta(alvo uuid, tipo text)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.eh_superadmin() then raise exception 'sem permissão'; end if;
  if tipo not in ('individual', 'sociedade') then
    raise exception 'tipo de conta desconhecido: %', tipo;
  end if;
  update public.perfil set tipo_conta = tipo where id = alvo;
end;
$$;


-- ------------------------------------------------------------------
-- 14. Quem pode executar o quê
-- ------------------------------------------------------------------
-- Este ficheiro vem DEPOIS do `schema_lint.sql` (33.º), e uma função criada
-- depois dele nasce com o `EXECUTE` a `PUBLIC` que ele existe para tirar. Cada
-- função criada ou substituída acima tem de repetir aqui o que o lint lhe teria
-- feito: fechada a `anon`/`public`, aberta a `authenticated` — e as de GATILHO
-- fechadas também a `authenticated`, que não têm que ser chamáveis por `/rpc/`.
-- O `perfil_colunas_reservadas` é a exceção: fica com o `EXECUTE` a
-- `authenticated`, ao contrário das outras funções de gatilho. Não é
-- `security definer` (ver a secção 1), e uma função de gatilho normal não tem
-- que se arriscar a uma verificação de permissão no momento em que dispara —
-- perder essa aposta era cada gravação do perfil a falhar com «permission
-- denied for function». Expô-la não abre nada: o PostgREST não publica funções
-- que devolvam `trigger`, e chamá-la à mão dá «can only be called as trigger».
revoke execute on function public.perfil_colunas_reservadas() from anon, public;
grant  execute on function public.perfil_colunas_reservadas() to authenticated;
revoke execute on function public.handle_new_exploracao() from anon, public, authenticated;

revoke execute on function public.role_padrao_pode(public.role_membro, text) from anon, public;
grant  execute on function public.role_padrao_pode(public.role_membro, text) to authenticated;

revoke execute on function public.pode_cap(text, text) from anon, public;
grant  execute on function public.pode_cap(text, text) to authenticated;

revoke execute on function public.tem_supervisor(text) from anon, public;
grant  execute on function public.tem_supervisor(text) to authenticated;

revoke execute on function public.exploracao_ativa(text) from anon, public;
grant  execute on function public.exploracao_ativa(text) to authenticated;

revoke execute on function public.eh_convidado() from anon, public;
grant  execute on function public.eh_convidado() to authenticated;

revoke execute on function
  public.criar_convite(text, public.role_membro, text, int, int, timestamptz) from anon, public;
grant  execute on function
  public.criar_convite(text, public.role_membro, text, int, int, timestamptz) to authenticated;

revoke execute on function public.mando_no_grupo(uuid) from anon, public;
grant  execute on function public.mando_no_grupo(uuid) to authenticated;

revoke execute on function public.superadmin_listar_clientes() from anon, public;
grant  execute on function public.superadmin_listar_clientes() to authenticated;

revoke execute on function public.superadmin_obter_cliente(uuid) from anon, public;
grant  execute on function public.superadmin_obter_cliente(uuid) to authenticated;

revoke execute on function public.superadmin_exploracoes_cliente(uuid) from anon, public;
grant  execute on function public.superadmin_exploracoes_cliente(uuid) to authenticated;

revoke execute on function public.superadmin_membros_exploracao(text) from anon, public;
grant  execute on function public.superadmin_membros_exploracao(text) to authenticated;

revoke execute on function public.superadmin_definir_tipo_conta(uuid, text) from anon, public;
grant  execute on function public.superadmin_definir_tipo_conta(uuid, text) to authenticated;

-- A coluna `tipo_conta` é de leitura para a app (o ecrã precisa de saber se
-- mostra "criar exploração" ou "convidar líder") e de escrita para ninguém: o
-- gatilho da secção 1 é que a defende, porque o `grant update` desta tabela
-- está diferente de base para base.


-- ------------------------------------------------------------------
-- Coluna nova e funções mudadas: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. O papel existe e o conjunto de origem é o que se quer:
--
--   select public.role_padrao_pode('supervisor','gerirTerrenos')   as s_terrenos, -- t
--          public.role_padrao_pode('supervisor','editarExploracao') as s_editar,  -- t
--          public.role_padrao_pode('supervisor','gerirEquipa')      as s_equipa,  -- t
--          public.role_padrao_pode('supervisor','editarAnimais')    as s_animais, -- f
--          public.role_padrao_pode('supervisor','marcarEventos')    as s_agenda,  -- f
--          public.role_padrao_pode('supervisor','eliminarExploracao') as s_apaga; -- t
--
-- 2. Nada mudou para os papéis que já existiam (tem de dar tudo `t`):
--
--   select public.role_padrao_pode('admin','eliminarExploracao')
--      and public.role_padrao_pode('trabalhador','editarAnimais')
--      and public.role_padrao_pode('trabalhador','marcarEventos')
--      and public.role_padrao_pode('veterinario','registarTratamentos')
--      and not public.role_padrao_pode('veterinario','editarAnimais');
--
-- 3. Marcar uma conta como sociedade e criar uma exploração com ela deixa-a
--    SUPERVISOR e não admin (na sessão dessa conta, e com rollback):
--
--   select public.superadmin_definir_tipo_conta('<uuid>', 'sociedade'); -- superadmin
--   -- depois, na sessão da conta: criar a exploração pela app, e
--   select role from public.membro_exploracao where exploracao_id = '<id>';  -- supervisor
--
-- 4. Na sessão do SUPERVISOR (ver `gado-provar-rls-psql`), dentro de uma
--    transação com rollback:
--
--    - `insert into public.terreno …` tem de FUNCIONAR;
--    - `update public.exploracao set nome = …` tem de afetar 1 linha;
--    - `insert into public.animal …` tem de dar "new row violates row-level
--      security policy";
--    - `insert into public.evento_agenda …` idem;
--    - `insert into public.movimento …` idem;
--    - `delete from public.exploracao where id = …` tem de apagar 1 linha (é a
--      exploração dele: criou-a e paga-a). Fazer isto por último, e com o
--      rollback à espera;
--    - `select count(*) from public.movimento where exploracao_id = …` tem de
--      contar os movimentos TODOS, e não só os dele.
--
-- 5. Na sessão do LÍDER (o `admin` que entrou por código):
--
--    - registar um animal tem de FUNCIONAR;
--    - `delete from public.membro_exploracao where role = 'supervisor'` tem de
--      apagar 0 linhas;
--    - `delete from public.exploracao where id = …` tem de apagar 0 linhas
--      (uma política de DELETE que não encontra linha não dá erro — é preciso
--      olhar para o "DELETE 0");
--    - `insert into public.exploracao …` tem de dar "new row violates
--      row-level security policy" (é convidado: nunca criou nenhuma).
--
-- 6. A suspensão segue a sociedade, e não o líder:
--
--   select public.superadmin_bloquear_cliente('<uuid do supervisor>');
--   -- na sessão do LÍDER, registar um animal tem de passar a ser recusado,
--   -- mesmo com a conta dele ativa. Voltar a aprovar devolve-lhe a escrita.
--
-- 7. E o dono de sempre não perdeu nada — na sessão de um `admin` de uma
--    exploração SEM supervisor, apagar a exploração continua a funcionar.
