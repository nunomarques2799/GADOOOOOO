-- ==================================================================
-- Terrabovina — conversas entre as pessoas da exploração (Fase 1: texto)
-- ==================================================================
-- Aplica DEPOIS de tudo o resto (é o 35.º; ver `ordem.txt` e `MIGRACOES.md`).
-- Idempotente: pode voltar a correr as vezes que forem precisas.
--
-- ------------------------------------------------------------------
-- O MODELO
-- ------------------------------------------------------------------
-- Há dois tipos de conversa, e mais nenhum:
--
--   GRUPO     Um por exploração, criado sozinho. Lá dentro estão o dono e os
--             trabalhadores. O VETERINÁRIO NÃO ENTRA: é uma visita, e o grupo
--             é onde se combina o trabalho da casa. Ninguém o cria à mão e
--             ninguém cria um segundo, porque quem manda é o gatilho da
--             secção 6.
--
--   PRIVADA   Entre duas pessoas que partilham uma exploração ATIVA. Uma só
--             por par, mesmo que partilhem duas explorações: quem escreve a
--             alguém escreve à PESSOA, não ao papel que ela tem em cada quinta.
--             O veterinário tem estas (é assim que se lhe pergunta uma dose
--             sem pôr a exploração inteira a ler).
--
-- A garantia de "uma por par" é a coluna `par_a`/`par_b` com a restrição
-- `par_a < par_b`: com o par sempre pela mesma ordem, um índice único resolve
-- o problema que de outra maneira obrigava a contar membros em cada insert.
--
-- ------------------------------------------------------------------
-- O QUE CADA UM VÊ, E A JANELA DE TEMPO
-- ------------------------------------------------------------------
-- Ser membro não dá acesso à conversa toda: dá acesso ao que foi escrito
-- ENQUANTO lá se esteve. Cada linha de `conversa_membro` tem `entrou_em` e
-- `saiu_em`, e é entre essas duas horas que as mensagens se veem.
--
-- É isso que faz as três regras pedidas cairem sozinhas:
--   - quem é removido do grupo deixa de escrever e continua a ver o que
--     apanhou (`saiu_em` preenchido, a linha fica);
--   - quem sai da exploração sai do grupo no mesmo instante (gatilho no
--     `delete` de `membro_exploracao`);
--   - o veterinário cujo prazo acabou fica com o histórico das privadas e não
--     escreve mais nada (`podem_falar()` deixa de o reconhecer).
--
-- Voltar a entrar no grupo REINICIA a janela: quem foi removido em março e
-- reposto em maio não recupera o que se disse pelo meio. É a leitura estrita
-- de "vê só o que foi escrito enquanto lá esteve", e é a que não deixa uma
-- remoção ser desfeita para ir espreitar.
--
-- ------------------------------------------------------------------
-- O SUPERADMIN NÃO LÊ MENSAGENS
-- ------------------------------------------------------------------
-- Em quase todas as políticas desta base há um `or public.eh_superadmin()`.
-- Aqui NÃO HÁ, e a ausência é a funcionalidade: as conversas dos clientes são
-- deles. Quem administra a plataforma não vê uma única linha do que lá está
-- escrito.
--
-- A ÚNICA exceção é a mensagem DENUNCIADA, e só ela: a diretriz 1.2 da Apple
-- exige que haja alguém a poder agir sobre conteúdo ofensivo em 24 horas, e
-- sem ninguém a poder ler a denúncia não passa de um botão a fingir. Denunciar
-- copia aquela mensagem (e as três anteriores, para se perceber o contexto)
-- para `mensagem_denuncia`, que é a única tabela deste ficheiro que o
-- superadmin lê. Quem denuncia está a pedir que alguém leia; o resto da
-- conversa continua fechado, também para ele.
--
-- Note-se o que isto NÃO é: cifra ponta a ponta. Quem tem a chave da base de
-- dados lê a tabela `mensagem`, como lê qualquer outra. O que aqui se fecha é
-- o acesso pela APP e pela API. Está escrito assim na política de privacidade.
--
-- ------------------------------------------------------------------
-- SEIS MESES
-- ------------------------------------------------------------------
-- Mensagens com mais de seis meses são apagadas por uma tarefa diária
-- (secção 9). Não é arrumação: é o que impede uma tabela que só cresce de
-- comer os 500 MB do plano, e o que faz com que uma conversa de trabalho não
-- se transforme num arquivo permanente de tudo o que uma equipa já disse.
-- A app diz-o, em letra pequena, no topo de cada conversa.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Tabelas
-- ------------------------------------------------------------------

create table if not exists public.conversa (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('grupo', 'privada')),

  -- Só nos grupos. `on delete cascade`: apagada a exploração, vai o grupo e,
  -- por ele, as mensagens.
  exploracao_id text references public.exploracao (id) on delete cascade,

  -- Só nos grupos, e opcional: vazio quer dizer "chama-se como a exploração".
  -- Copiar o nome da exploração para aqui à nascença obrigava a mantê-lo
  -- alinhado com o outro para sempre.
  nome text check (nome is null or char_length(btrim(nome)) between 1 and 60),

  -- Só nas privadas, e sempre pela mesma ordem (ver o cabeçalho). `set null`
  -- e não `cascade`: quem apaga a conta não leva a conversa do outro atrás.
  par_a uuid references auth.users (id) on delete set null,
  par_b uuid references auth.users (id) on delete set null,

  criado_em timestamptz not null default now(),

  -- A hora da última mensagem. Está desnormalizada de propósito: é por ela que
  -- a lista de conversas se ordena, e sem ela cada abertura da lista varria a
  -- tabela de mensagens à procura do máximo de cada uma.
  ultima_em timestamptz not null default now(),

  constraint conversa_grupo_tem_exploracao check (
    (tipo = 'grupo' and exploracao_id is not null and par_a is null and par_b is null)
    or (tipo = 'privada' and exploracao_id is null)
  ),
  -- O `is null` está aqui por causa do apagamento de conta: uma das pontas
  -- fica a null e a comparação deixaria de poder ser feita.
  constraint conversa_par_ordenado check (
    par_a is null or par_b is null or par_a < par_b
  )
);

-- Um grupo por exploração, e um par por par. São índices PARCIAIS porque as
-- colunas de cada um só valem para um dos tipos.
create unique index if not exists conversa_grupo_unico
  on public.conversa (exploracao_id) where tipo = 'grupo';
create unique index if not exists conversa_par_unico
  on public.conversa (par_a, par_b) where tipo = 'privada';

create table if not exists public.conversa_membro (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversa (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- A janela de leitura (ver o cabeçalho).
  --
  -- `clock_timestamp()` e não `now()`, aqui e no `criado_em` das mensagens: o
  -- `now()` é a hora de INÍCIO DA TRANSAÇÃO e não anda enquanto ela durar. Uma
  -- pessoa removida do grupo e uma mensagem escrita a seguir, dentro da mesma
  -- transação, ficavam com a MESMA hora ao microssegundo, e a condição da
  -- janela (`criado_em <= saiu_em`) deixava-a ler o que veio depois de sair.
  -- Em produção cada gravação é a sua própria transação e a diferença nunca
  -- se via; foi a prova em psql que a apanhou (e é o motivo de a prova valer).
  entrou_em timestamptz not null default clock_timestamp(),
  saiu_em timestamptz,

  -- Até onde esta pessoa já leu. Serve o contador de não lidas e mais nada:
  -- não há recibos de leitura, ninguém sabe o que os outros leram.
  lido_ate timestamptz not null default '-infinity',

  -- Esta conversa está silenciada para esta pessoa (não notifica).
  silenciada boolean not null default false,

  unique (conversa_id, user_id)
);

create index if not exists idx_conversa_membro_user
  on public.conversa_membro (user_id);
create index if not exists idx_conversa_membro_conversa
  on public.conversa_membro (conversa_id);

create table if not exists public.mensagem (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.conversa (id) on delete cascade,

  -- `set null` e não `cascade`: apagada a conta, a mensagem fica e a app
  -- mostra "Utilizador removido". Apagar o que a pessoa escreveu deixava as
  -- conversas dos outros com buracos e sem sentido.
  autor uuid references auth.users (id) on delete set null,

  texto text not null check (char_length(texto) between 1 and 2000),

  -- A hora é do SERVIDOR, e o cliente não a escreve (ver o grant de coluna na
  -- secção 10). Foi assim que ficou por duas razões:
  --
  --   1. O relógio do telemóvel. A janela de leitura de cada membro compara-se
  --      com esta hora: um aparelho cinco minutos atrasado escrevia mensagens
  --      "anteriores" à entrada de um colega, que passava a não as ver, sem
  --      nada de errado à vista em lado nenhum.
  --   2. Uma conversa de trabalho é onde se combina o que se fez e quando.
  --      Com a hora vinda do cliente, qualquer um podia gravar uma mensagem
  --      datada da semana passada.
  --
  -- O preço é a mensagem escrita SEM REDE ficar com a hora a que saiu do
  -- telemóvel e não a que foi escrita. Enquanto está na fila, a app mostra-a
  -- com a hora local e a marca "por enviar", e corrige-a quando ela chega.
  criado_em timestamptz not null default clock_timestamp(),

  -- Apagada pelo próprio autor. Continua na tabela (a conversa dos outros não
  -- se reescreve) e a app mostra "Mensagem apagada" no lugar.
  apagada_em timestamptz
);

-- O índice que serve as duas únicas consultas que existem: as mensagens de uma
-- conversa por ordem, e a limpeza dos seis meses.
create index if not exists idx_mensagem_conversa
  on public.mensagem (conversa_id, criado_em desc);
create index if not exists idx_mensagem_criado_em
  on public.mensagem (criado_em);

-- ---- Bloquear alguém (exigido pela diretriz 1.2 da Apple) ----
-- Vale só para as PRIVADAS. Não se bloqueia o patrão no grupo de trabalho: o
-- grupo da exploração é uma ferramenta da quinta, não uma rede social, e um
-- trabalhador que se retirasse dele por sua conta deixava de receber recados
-- sem ninguém saber.
create table if not exists public.bloqueio (
  id uuid primary key default gen_random_uuid(),
  bloqueador uuid not null references auth.users (id) on delete cascade,
  bloqueado uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (bloqueador, bloqueado),
  constraint bloqueio_nao_proprio check (bloqueador <> bloqueado)
);

create index if not exists idx_bloqueio_bloqueador on public.bloqueio (bloqueador);

-- ---- Denúncias ----
-- O texto vai COPIADO, e não por referência: o autor pode apagar a mensagem no
-- segundo seguinte, e uma denúncia que aponta para uma linha vazia é uma
-- denúncia que não se pode julgar.
create table if not exists public.mensagem_denuncia (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid references public.mensagem (id) on delete set null,
  conversa_id uuid,
  denunciado_por uuid references auth.users (id) on delete set null,
  autor_denunciado uuid references auth.users (id) on delete set null,
  texto_copia text not null,
  -- As três anteriores, para se perceber o que se estava a passar.
  contexto jsonb not null default '[]'::jsonb,
  motivo text,
  criado_em timestamptz not null default now(),
  estado text not null default 'aberta' check (estado in ('aberta', 'tratada')),
  tratado_em timestamptz,
  nota_superadmin text
);

create index if not exists idx_denuncia_estado
  on public.mensagem_denuncia (estado, criado_em desc);

-- ---- Para as bases que já correram a primeira versão deste ficheiro ----
-- O `create table if not exists` não mexe numa tabela que já existe, e estas
-- duas colunas nasceram com `now()`. Sem isto, uma base já preparada ficava
-- com a versão antiga da hora e o erro da janela de leitura descrito acima
-- continuava lá, sem nada a indicá-lo.
alter table public.conversa_membro alter column entrou_em set default clock_timestamp();
alter table public.mensagem alter column criado_em set default clock_timestamp();


-- ------------------------------------------------------------------
-- 2. Helpers (SECURITY DEFINER, para as políticas não recursarem)
-- ------------------------------------------------------------------
-- Todos sem `eh_superadmin()`, ao contrário do resto da base. Ver o cabeçalho.

-- Sou membro ATIVO desta conversa? (Escrever exige isto.)
create or replace function public.na_conversa(conv uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.conversa_membro
     where conversa_id = conv and user_id = auth.uid() and saiu_em is null
  );
$$;

-- Sou, ou já fui, membro desta conversa? (Ver a lista e o histórico exige
-- isto; quem saiu continua a ver a conversa, com o que apanhou lá dentro.)
create or replace function public.vi_conversa(conv uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.conversa_membro
     where conversa_id = conv and user_id = auth.uid()
  );
$$;

-- Posso ver uma mensagem escrita a esta hora? É a janela do cabeçalho.
create or replace function public.posso_ler_mensagem(conv uuid, quando timestamptz)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.conversa_membro
     where conversa_id = conv
       and user_id = auth.uid()
       and quando >= entrou_em
       and (saiu_em is null or quando <= saiu_em)
  );
$$;

-- Sou o dono (admin) da exploração deste grupo? É quem manda no grupo.
create or replace function public.mando_no_grupo(conv uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1
      from public.conversa c
      join public.membro_exploracao m on m.exploracao_id = c.exploracao_id
     where c.id = conv
       and c.tipo = 'grupo'
       and m.user_id = auth.uid()
       and m.role = 'admin'
       and (m.expira_em is null or m.expira_em > now())
  );
$$;

-- Um dos dois bloqueou o outro?
create or replace function public.ha_bloqueio_com(outro uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.bloqueio
     where (bloqueador = auth.uid() and bloqueado = outro)
        or (bloqueador = outro and bloqueado = auth.uid())
  );
$$;

-- Eu e esta pessoa podemos falar em privado AGORA?
--
-- É aqui que moram três das regras: só se fala com quem se partilha uma
-- exploração (não há lista de utilizadores da plataforma), o prazo do
-- veterinário fecha a escrita quando acaba, e uma exploração suspensa congela
-- também as conversas — como congela tudo o resto (`exploracao_ativa`).
create or replace function public.podem_falar(outro uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select outro is not null
     and outro <> auth.uid()
     and public.perfil_ativo()
     and not public.ha_bloqueio_com(outro)
     and exists (
       select 1
         from public.membro_exploracao a
         join public.membro_exploracao b on b.exploracao_id = a.exploracao_id
        where a.user_id = auth.uid()
          and b.user_id = outro
          and (a.expira_em is null or a.expira_em > now())
          and (b.expira_em is null or b.expira_em > now())
          and public.exploracao_ativa(a.exploracao_id)
     );
$$;

-- Posso escrever NESTA conversa, agora?
create or replace function public.posso_escrever_na_conversa(conv uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select public.perfil_ativo()
     and public.na_conversa(conv)
     and exists (
       select 1 from public.conversa c
        where c.id = conv
          and (
            (c.tipo = 'grupo' and public.exploracao_ativa(c.exploracao_id))
            or (
              c.tipo = 'privada'
              and public.podem_falar(
                case when c.par_a = auth.uid() then c.par_b else c.par_a end
              )
            )
          )
     );
$$;


-- ------------------------------------------------------------------
-- 3. RLS: conversa
-- ------------------------------------------------------------------
alter table public.conversa enable row level security;

-- Ver: quem é ou foi membro. Sem superadmin.
drop policy if exists conversa_membros_select on public.conversa;
create policy conversa_membros_select on public.conversa
  for select using (public.vi_conversa(id));

-- Não há política de INSERT nem de DELETE, e a ausência é deliberada:
--   - os grupos nascem do gatilho da secção 6 (ninguém cria um segundo);
--   - as privadas nascem do RPC `abrir_conversa` (que confere `podem_falar`);
--   - apagar uma conversa não existe. O que se apaga são mensagens, e é o
--     tempo que as apaga.
--
-- O UPDATE também não: mudar o nome do grupo passa pelo RPC
-- `mudar_nome_do_grupo`, e a `ultima_em` é escrita pelo gatilho.


-- ------------------------------------------------------------------
-- 4. RLS: conversa_membro
-- ------------------------------------------------------------------
alter table public.conversa_membro enable row level security;

-- Ver os membros das conversas em que estou (é o que desenha "quem está no
-- grupo" e o nome de quem está do outro lado de uma privada).
drop policy if exists conversa_membro_select on public.conversa_membro;
create policy conversa_membro_select on public.conversa_membro
  for select using (public.vi_conversa(conversa_id));

-- Escrever só na MINHA linha, e mesmo assim só duas colunas (ver a secção 10):
-- marcar até onde li e silenciar. Sem o grant de coluna, esta política deixava
-- qualquer um mexer no seu `entrou_em` e passar a ver a conversa toda desde o
-- princípio.
drop policy if exists conversa_membro_self_update on public.conversa_membro;
create policy conversa_membro_self_update on public.conversa_membro
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Entrar e sair é sempre por gatilho ou por RPC. Sem insert nem delete.


-- ------------------------------------------------------------------
-- 5. RLS: mensagem, bloqueio, denúncias
-- ------------------------------------------------------------------
alter table public.mensagem enable row level security;

drop policy if exists mensagem_select on public.mensagem;
create policy mensagem_select on public.mensagem
  for select using (public.posso_ler_mensagem(conversa_id, criado_em));

drop policy if exists mensagem_insert on public.mensagem;
create policy mensagem_insert on public.mensagem
  for insert with check (
    autor = auth.uid()
    and apagada_em is null
    and public.posso_escrever_na_conversa(conversa_id)
  );

-- Apagar o que escrevi. É um UPDATE (marca `apagada_em`) e não um DELETE: a
-- linha fica, para a conversa dos outros não mudar de forma por baixo deles.
-- O grant de coluna da secção 10 impede que este mesmo caminho sirva para
-- reescrever o texto de uma mensagem antiga.
drop policy if exists mensagem_autor_update on public.mensagem;
create policy mensagem_autor_update on public.mensagem
  for update using (autor = auth.uid()) with check (autor = auth.uid());

-- Sem DELETE para ninguém: quem apaga é a tarefa dos seis meses, que corre
-- como dona da base e não passa por aqui.

alter table public.bloqueio enable row level security;

drop policy if exists bloqueio_self on public.bloqueio;
create policy bloqueio_self on public.bloqueio
  for select using (bloqueador = auth.uid());

drop policy if exists bloqueio_self_insert on public.bloqueio;
create policy bloqueio_self_insert on public.bloqueio
  for insert with check (bloqueador = auth.uid());

drop policy if exists bloqueio_self_delete on public.bloqueio;
create policy bloqueio_self_delete on public.bloqueio
  for delete using (bloqueador = auth.uid());

alter table public.mensagem_denuncia enable row level security;

-- A ÚNICA porta do superadmin a conteúdo de conversas, e só ao que lhe foi
-- entregue por quem denunciou. Ver o cabeçalho.
drop policy if exists denuncia_superadmin_select on public.mensagem_denuncia;
create policy denuncia_superadmin_select on public.mensagem_denuncia
  for select using (public.eh_superadmin());

drop policy if exists denuncia_superadmin_update on public.mensagem_denuncia;
create policy denuncia_superadmin_update on public.mensagem_denuncia
  for update using (public.eh_superadmin()) with check (public.eh_superadmin());

-- Denunciar é pelo RPC `denunciar_mensagem` (é ele que copia o contexto), por
-- isso não há política de insert.


-- ------------------------------------------------------------------
-- 6. Os grupos nascem e mantêm-se sozinhos
-- ------------------------------------------------------------------

-- Devolve o grupo de uma exploração, criando-o se ainda não existir.
create or replace function public.garantir_grupo(exp_id text)
returns uuid language plpgsql security definer set search_path = 'public' as $$
declare
  conv uuid;
begin
  select id into conv from public.conversa
   where tipo = 'grupo' and exploracao_id = exp_id;
  if conv is null then
    insert into public.conversa (tipo, exploracao_id)
    values ('grupo', exp_id)
    -- Duas sessões a criar a mesma exploração ao mesmo tempo não é caso que
    -- aconteça, mas o índice único é que decide e não uma corrida.
    on conflict (exploracao_id) where tipo = 'grupo' do nothing
    returning id into conv;
    if conv is null then
      select id into conv from public.conversa
       where tipo = 'grupo' and exploracao_id = exp_id;
    end if;
  end if;
  return conv;
end;
$$;

-- Põe (ou repõe) alguém no grupo da exploração.
create or replace function public.entrar_no_grupo(exp_id text, quem uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  conv uuid := public.garantir_grupo(exp_id);
begin
  insert into public.conversa_membro (conversa_id, user_id)
  values (conv, quem)
  on conflict (conversa_id, user_id) do update
    -- Voltar a entrar reinicia a janela (ver o cabeçalho). O `lido_ate` vai
    -- com ela: não faz sentido dar por lido o que ela já não pode ver.
    set entrou_em = clock_timestamp(), saiu_em = null, lido_ate = clock_timestamp()
    where conversa_membro.saiu_em is not null;
end;
$$;

-- Tira alguém do grupo, deixando-lhe o que já leu.
create or replace function public.sair_do_grupo(exp_id text, quem uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  update public.conversa_membro m
     set saiu_em = clock_timestamp()
    from public.conversa c
   where c.id = m.conversa_id
     and c.tipo = 'grupo'
     and c.exploracao_id = exp_id
     and m.user_id = quem
     and m.saiu_em is null;
end;
$$;

-- Uma exploração nova nasce com o seu grupo. Um gatilho À PARTE e não uma
-- linha dentro do `handle_new_exploracao`: aquela função já foi reescrita por
-- três ficheiros diferentes (ver `MIGRACOES.md`), e quem lhe mexer a seguir
-- não tem de saber que o chat existe.
create or replace function public.chat_apos_exploracao()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  perform public.garantir_grupo(new.id);
  return new;
end;
$$;

drop trigger if exists trg_chat_exploracao on public.exploracao;
create trigger trg_chat_exploracao
  after insert on public.exploracao
  for each row execute function public.chat_apos_exploracao();

-- A equipa manda no grupo: quem entra na exploração entra no grupo, quem sai
-- sai, e o veterinário nunca lá está.
create or replace function public.chat_apos_membro()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if tg_op = 'DELETE' then
    perform public.sair_do_grupo(old.exploracao_id, old.user_id);
    return old;
  end if;

  -- Mudar de exploração é sair de uma e entrar na outra. Não acontece hoje
  -- (muda-se de equipa apagando a linha e criando outra), mas se um dia
  -- acontecer, a pessoa não pode ficar no grupo da quinta que deixou.
  if tg_op = 'UPDATE' and old.exploracao_id is distinct from new.exploracao_id then
    perform public.sair_do_grupo(old.exploracao_id, old.user_id);
  end if;

  if new.role = 'veterinario' then
    -- Inclui o caso de alguém ser DESPROMOVIDO a veterinário: sai do grupo.
    perform public.sair_do_grupo(new.exploracao_id, new.user_id);
  else
    perform public.entrar_no_grupo(new.exploracao_id, new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chat_membro on public.membro_exploracao;
create trigger trg_chat_membro
  after insert or update of role, exploracao_id or delete on public.membro_exploracao
  for each row execute function public.chat_apos_membro();

-- A hora da última mensagem, para a lista se ordenar sem varrer nada.
create or replace function public.chat_apos_mensagem()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  update public.conversa set ultima_em = new.criado_em where id = new.conversa_id;
  return new;
end;
$$;

drop trigger if exists trg_chat_mensagem on public.mensagem;
create trigger trg_chat_mensagem
  after insert on public.mensagem
  for each row execute function public.chat_apos_mensagem();


-- ------------------------------------------------------------------
-- 7. O que a app chama (RPCs)
-- ------------------------------------------------------------------

-- Abrir (ou reabrir) a conversa privada com alguém. Devolve o id.
create or replace function public.abrir_conversa(outro uuid)
returns uuid language plpgsql security definer set search_path = 'public' as $$
declare
  eu uuid := auth.uid();
  a uuid;
  b uuid;
  conv uuid;
begin
  if eu is null then
    raise exception 'sem sessão iniciada';
  end if;
  if not public.podem_falar(outro) then
    raise exception 'não é possível falar com esta pessoa';
  end if;

  a := least(eu, outro);
  b := greatest(eu, outro);

  select id into conv from public.conversa
   where tipo = 'privada' and par_a = a and par_b = b;

  if conv is null then
    insert into public.conversa (tipo, par_a, par_b) values ('privada', a, b)
    returning id into conv;
  end if;

  -- Os dois membros. Numa privada ninguém sai, por isso o `do nothing` chega:
  -- a janela de quem já lá estava não se mexe.
  insert into public.conversa_membro (conversa_id, user_id)
  values (conv, a), (conv, b)
  on conflict (conversa_id, user_id) do nothing;

  return conv;
end;
$$;

-- Marcar a conversa como lida até agora.
--
-- É um RPC e não um `update` direto pela mesma razão do `criado_em`: a hora
-- tem de ser a do SERVIDOR. Com o relógio do telemóvel, um aparelho adiantado
-- marcava como lidas mensagens que ainda não existiam, e o contador dessa
-- pessoa nunca mais acendia.
create or replace function public.marcar_conversa_lida(conv uuid)
returns void language sql security definer set search_path = 'public' as $$
  update public.conversa_membro
     set lido_ate = clock_timestamp()
   where conversa_id = conv and user_id = auth.uid();
$$;

-- Mudar o nome do grupo. Só o dono.
create or replace function public.mudar_nome_do_grupo(conv uuid, novo text)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  limpo text := nullif(btrim(coalesce(novo, '')), '');
begin
  if not public.mando_no_grupo(conv) then
    raise exception 'só o dono da exploração muda o nome do grupo';
  end if;
  if limpo is not null and char_length(limpo) > 60 then
    raise exception 'o nome é demasiado comprido';
  end if;
  -- Vazio devolve-o ao nome da exploração, que é como ele nasceu.
  update public.conversa set nome = limpo where id = conv and tipo = 'grupo';
end;
$$;

-- Tirar alguém do grupo (sem o tirar da exploração). Só o dono.
create or replace function public.remover_do_grupo(conv uuid, quem uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  exp_id text;
begin
  if not public.mando_no_grupo(conv) then
    raise exception 'só o dono da exploração mexe nos membros do grupo';
  end if;
  if quem = auth.uid() then
    raise exception 'o dono não se pode remover do grupo';
  end if;
  select exploracao_id into exp_id from public.conversa where id = conv;
  perform public.sair_do_grupo(exp_id, quem);
end;
$$;

-- Repor no grupo quem lá tinha sido tirado. Só o dono, e só se a pessoa
-- continuar na equipa (o grupo é o espelho da equipa, não uma lista à parte).
create or replace function public.repor_no_grupo(conv uuid, quem uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  exp_id text;
  papel text;
begin
  if not public.mando_no_grupo(conv) then
    raise exception 'só o dono da exploração mexe nos membros do grupo';
  end if;
  select exploracao_id into exp_id from public.conversa where id = conv;

  select role::text into papel from public.membro_exploracao
   where exploracao_id = exp_id and user_id = quem;

  if papel is null then
    raise exception 'esta pessoa já não pertence à equipa';
  end if;
  if papel = 'veterinario' then
    raise exception 'o veterinário não entra no grupo da exploração';
  end if;

  perform public.entrar_no_grupo(exp_id, quem);
end;
$$;

-- Com quem posso começar uma conversa privada. Não é uma lista de
-- utilizadores da plataforma: é a equipa das MINHAS explorações, que é o
-- único conjunto de pessoas que esta app deixa alguém contactar.
create or replace function public.pessoas_para_conversar()
returns table (u_id uuid, u_nome text, u_papel text)
language sql security definer stable set search_path = 'public' as $$
  select distinct on (m.user_id)
         m.user_id,
         coalesce(nullif(btrim(p.nome), ''), 'Sem nome'),
         m.role::text
    from public.membro_exploracao m
    left join public.perfil p on p.id = m.user_id
   where m.user_id <> auth.uid()
     -- A MESMA pergunta que a RLS faz na hora de escrever, e não uma cópia
     -- das condições dela. Uma cópia acabava por divergir, e a divergência
     -- aparecia da pior maneira: um nome na lista de "a quem escrever" que
     -- rejeitava a primeira mensagem.
     and public.podem_falar(m.user_id)
   order by m.user_id, m.role;
$$;

-- A lista de conversas, pronta a desenhar.
--
-- É UM pedido e não cinco. Feita à mão pela app, esta lista custava: as
-- conversas, mais a última mensagem de cada uma, mais a contagem do que falta
-- ler em cada uma. E a contagem não se pode fazer no telemóvel sem trazer as
-- mensagens todas para lá, que é precisamente o que uma lista não precisa.
--
-- Os dois `lateral` respeitam a janela de cada um (ver o cabeçalho): a última
-- mensagem que aqui aparece é a última que ESTA pessoa pode ver, não a última
-- que existe.
create or replace function public.minhas_conversas()
returns table (
  c_id uuid,
  c_tipo text,
  c_nome text,
  c_exploracao text,
  c_outro uuid,
  c_ultima_em timestamptz,
  c_ultimo_texto text,
  c_ultimo_autor uuid,
  c_ultimo_apagado boolean,
  c_nao_lidas integer,
  c_silenciada boolean,
  c_ativa boolean
)
language sql security definer stable set search_path = 'public' as $$
  select c.id,
         c.tipo,
         c.nome,
         c.exploracao_id,
         case when c.tipo = 'privada'
              then case when c.par_a = auth.uid() then c.par_b else c.par_a end
         end,
         c.ultima_em,
         u.texto,
         u.autor,
         (u.apagada_em is not null),
         coalesce(n.qtd, 0)::int,
         m.silenciada,
         (m.saiu_em is null)
    from public.conversa c
    join public.conversa_membro m
      on m.conversa_id = c.id and m.user_id = auth.uid()
    left join lateral (
      select x.texto, x.autor, x.apagada_em
        from public.mensagem x
       where x.conversa_id = c.id
         and x.criado_em >= m.entrou_em
         and (m.saiu_em is null or x.criado_em <= m.saiu_em)
       order by x.criado_em desc
       limit 1
    ) u on true
    left join lateral (
      -- As minhas não contam: ninguém tem mensagens por ler de si próprio.
      select count(*) as qtd
        from public.mensagem y
       where y.conversa_id = c.id
         and y.criado_em > m.lido_ate
         and y.criado_em >= m.entrou_em
         and (m.saiu_em is null or y.criado_em <= m.saiu_em)
         and y.autor is distinct from auth.uid()
    ) n on true
   order by c.ultima_em desc;
$$;

-- Quem está no grupo (e quem lá esteve). Serve o ecrã de informação do grupo:
-- o dono precisa de ver quem removeu, para o poder repor.
create or replace function public.membros_da_conversa(conv uuid)
returns table (u_id uuid, u_nome text, u_papel text, u_saiu boolean)
language sql security definer stable set search_path = 'public' as $$
  select m.user_id,
         coalesce(nullif(btrim(p.nome), ''), 'Sem nome'),
         coalesce(me.role::text, ''),
         (m.saiu_em is not null)
    from public.conversa_membro m
    left join public.perfil p on p.id = m.user_id
    left join public.conversa c on c.id = m.conversa_id
    left join public.membro_exploracao me
      on me.exploracao_id = c.exploracao_id and me.user_id = m.user_id
   where m.conversa_id = conv
     and public.vi_conversa(conv)
   order by (m.saiu_em is not null), 2;
$$;

-- Denunciar uma mensagem. Copia-a, com as três anteriores, para a fila que o
-- superadmin lê (ver o cabeçalho). É a única coisa nesta base que tira texto
-- de uma conversa para fora dela.
create or replace function public.denunciar_mensagem(msg uuid, motivo_txt text default null)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  m record;
  ctx jsonb;
begin
  select * into m from public.mensagem where id = msg;
  if m.id is null then
    raise exception 'mensagem não encontrada';
  end if;
  -- Só se denuncia o que se pode ler, e não a própria.
  if not public.posso_ler_mensagem(m.conversa_id, m.criado_em) then
    raise exception 'sem acesso a esta mensagem';
  end if;
  if m.autor = auth.uid() then
    raise exception 'não faz sentido denunciar a própria mensagem';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'autor', a.autor, 'texto', a.texto, 'criado_em', a.criado_em
         ) order by a.criado_em), '[]'::jsonb)
    into ctx
    from (
      select autor, texto, criado_em
        from public.mensagem
       where conversa_id = m.conversa_id and criado_em < m.criado_em
       order by criado_em desc
       limit 3
    ) a;

  insert into public.mensagem_denuncia (
    mensagem_id, conversa_id, denunciado_por, autor_denunciado,
    texto_copia, contexto, motivo
  ) values (
    m.id, m.conversa_id, auth.uid(), m.autor,
    m.texto, ctx, nullif(btrim(coalesce(motivo_txt, '')), '')
  );
end;
$$;

-- Quantas denúncias estão por tratar. É o que o painel do superadmin lê para
-- saber que tem trabalho, sem ter de abrir nada.
create or replace function public.denuncias_por_tratar()
returns integer language sql security definer stable set search_path = 'public' as $$
  select case when public.eh_superadmin()
              then (select count(*)::int from public.mensagem_denuncia where estado = 'aberta')
              else 0 end;
$$;


-- ------------------------------------------------------------------
-- 8. Preencher o que já existe
-- ------------------------------------------------------------------
-- Os gatilhos só valem para o que acontecer daqui para a frente. As
-- explorações e as equipas que já lá estão têm de entrar à mão, uma vez.
do $$
declare
  r record;
begin
  for r in select id from public.exploracao loop
    perform public.garantir_grupo(r.id);
  end loop;

  for r in
    select exploracao_id, user_id from public.membro_exploracao
     where role <> 'veterinario'
  loop
    perform public.entrar_no_grupo(r.exploracao_id, r.user_id);
  end loop;
end $$;

-- Quem já cá estava não abre a app com trezentas mensagens por ler: a janela
-- começa hoje, e antes de hoje não há nada escrito de qualquer maneira.
update public.conversa_membro set lido_ate = greatest(lido_ate, entrou_em)
 where lido_ate = '-infinity';


-- ------------------------------------------------------------------
-- 9. Os seis meses
-- ------------------------------------------------------------------
-- Corre todos os dias às 4 da manhã. Também se pode chamar à mão:
--
--   select public.limpar_mensagens_antigas();   -- devolve quantas apagou
create or replace function public.limpar_mensagens_antigas()
returns integer language plpgsql security definer set search_path = 'public' as $$
declare
  quantas integer;
begin
  delete from public.mensagem where criado_em < now() - interval '6 months';
  get diagnostics quantas = row_count;

  -- As denúncias sobrevivem à mensagem denunciada de propósito (é uma cópia,
  -- e é prova de que houve um problema), mas também não são para sempre.
  delete from public.mensagem_denuncia
   where estado = 'tratada' and criado_em < now() - interval '6 months';

  return quantas;
end;
$$;

-- O agendamento precisa do `pg_cron`, que não vem ligado. Se não der para o
-- ligar aqui (o SQL Editor do painel corre com um utilizador que não pode),
-- liga-se à mão em Database → Extensions → pg_cron e corre-se este ficheiro
-- outra vez. Sem isto nada falha à vista: as mensagens é que ficam para
-- sempre, e a base cresce em silêncio.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron não pôde ser ligado aqui (%). Ligar em Database → Extensions e correr o ficheiro outra vez.', sqlerrm;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('terrabovina-limpar-mensagens')
      where exists (select 1 from cron.job where jobname = 'terrabovina-limpar-mensagens');
    perform cron.schedule(
      'terrabovina-limpar-mensagens',
      '0 4 * * *',
      $cron$select public.limpar_mensagens_antigas()$cron$
    );
  else
    raise notice 'sem pg_cron: as mensagens antigas NÃO estão a ser apagadas.';
  end if;
exception when others then
  raise notice 'não foi possível agendar a limpeza (%).', sqlerrm;
end $$;


-- ------------------------------------------------------------------
-- 10. Privilégios
-- ------------------------------------------------------------------
-- Este ficheiro corre DEPOIS do `schema_lint.sql` (33.º), portanto as funções
-- que cria nascem com o `EXECUTE` aberto a `PUBLIC` que ele existe para tirar.
-- Fecham-se aqui, uma a uma, como faz o `schema_existencias_opcional.sql`.

revoke execute on function public.na_conversa(uuid) from anon, public;
revoke execute on function public.vi_conversa(uuid) from anon, public;
revoke execute on function public.posso_ler_mensagem(uuid, timestamptz) from anon, public;
revoke execute on function public.mando_no_grupo(uuid) from anon, public;
revoke execute on function public.ha_bloqueio_com(uuid) from anon, public;
revoke execute on function public.podem_falar(uuid) from anon, public;
revoke execute on function public.posso_escrever_na_conversa(uuid) from anon, public;
revoke execute on function public.abrir_conversa(uuid) from anon, public;
revoke execute on function public.marcar_conversa_lida(uuid) from anon, public;
revoke execute on function public.mudar_nome_do_grupo(uuid, text) from anon, public;
revoke execute on function public.remover_do_grupo(uuid, uuid) from anon, public;
revoke execute on function public.repor_no_grupo(uuid, uuid) from anon, public;
revoke execute on function public.pessoas_para_conversar() from anon, public;
revoke execute on function public.minhas_conversas() from anon, public;
revoke execute on function public.membros_da_conversa(uuid) from anon, public;
revoke execute on function public.denunciar_mensagem(uuid, text) from anon, public;
revoke execute on function public.denuncias_por_tratar() from anon, public;

-- Estas são de dentro da base e mais ninguém as chama: nem o `authenticated`.
revoke execute on function public.garantir_grupo(text) from anon, public, authenticated;
revoke execute on function public.entrar_no_grupo(text, uuid) from anon, public, authenticated;
revoke execute on function public.sair_do_grupo(text, uuid) from anon, public, authenticated;
revoke execute on function public.limpar_mensagens_antigas() from anon, public, authenticated;
revoke execute on function public.chat_apos_exploracao() from anon, public, authenticated;
revoke execute on function public.chat_apos_membro() from anon, public, authenticated;
revoke execute on function public.chat_apos_mensagem() from anon, public, authenticated;

grant execute on function public.na_conversa(uuid) to authenticated;
grant execute on function public.vi_conversa(uuid) to authenticated;
grant execute on function public.posso_ler_mensagem(uuid, timestamptz) to authenticated;
grant execute on function public.mando_no_grupo(uuid) to authenticated;
grant execute on function public.ha_bloqueio_com(uuid) to authenticated;
grant execute on function public.podem_falar(uuid) to authenticated;
grant execute on function public.posso_escrever_na_conversa(uuid) to authenticated;
grant execute on function public.abrir_conversa(uuid) to authenticated;
grant execute on function public.marcar_conversa_lida(uuid) to authenticated;
grant execute on function public.mudar_nome_do_grupo(uuid, text) to authenticated;
grant execute on function public.remover_do_grupo(uuid, uuid) to authenticated;
grant execute on function public.repor_no_grupo(uuid, uuid) to authenticated;
grant execute on function public.pessoas_para_conversar() to authenticated;
grant execute on function public.minhas_conversas() to authenticated;
grant execute on function public.membros_da_conversa(uuid) to authenticated;
grant execute on function public.denunciar_mensagem(uuid, text) to authenticated;
grant execute on function public.denuncias_por_tratar() to authenticated;

-- ---- Os grants de COLUNA ----
-- É aqui que se fecha a porta que a política de update deixaria aberta.
--
-- `conversa_membro`: a política deixa cada um escrever na sua linha, porque
-- tem de poder silenciar a conversa. Sem o grant de coluna, o mesmo caminho
-- deixava-o pôr o seu `entrou_em` em 1970 e ler a conversa desde o princípio,
-- ou tirar o seu `saiu_em` e voltar a um grupo de onde o dono o tirou. A RLS
-- decide LINHAS; quem decide COLUNAS é isto.
--
-- O `lido_ate` também não está aqui: quem o escreve é o
-- `marcar_conversa_lida()`, com a hora do servidor.
revoke update on public.conversa_membro from authenticated;
grant update (silenciada) on public.conversa_membro to authenticated;

-- `mensagem`: o autor pode apagar o que escreveu, e mais nada. Sem isto,
-- podia reescrever o texto de uma mensagem antiga e mudar o que ficou dito.
revoke update on public.mensagem from authenticated;
grant update (apagada_em) on public.mensagem to authenticated;

-- E na INSERÇÃO, a hora não é do cliente (ver a coluna `criado_em`). O `id`
-- continua a vir de lá: é ele que deixa a app reconhecer a sua própria
-- mensagem quando ela volta pelo tempo real, em vez de a mostrar duas vezes.
revoke insert on public.mensagem from authenticated;
grant insert (id, conversa_id, autor, texto) on public.mensagem to authenticated;

-- E o resto das omissões do Supabase que o `schema_privilegios.sql` (31.º)
-- tira a todas as tabelas. Ele já deixou uma regra de omissão preparada para
-- as tabelas futuras, mas repete-se aqui para este ficheiro não depender de
-- ela ter corrido nesta base.
revoke truncate, trigger, references on public.conversa from anon, authenticated;
revoke truncate, trigger, references on public.conversa_membro from anon, authenticated;
revoke truncate, trigger, references on public.mensagem from anon, authenticated;
revoke truncate, trigger, references on public.bloqueio from anon, authenticated;
revoke truncate, trigger, references on public.mensagem_denuncia from anon, authenticated;

-- Ninguém apaga linhas destas tabelas pela API (as mensagens são apagadas
-- pelo tempo, e as conversas não se apagam).
revoke delete on public.conversa from anon, authenticated;
revoke delete on public.conversa_membro from anon, authenticated;
revoke delete on public.mensagem from anon, authenticated;
revoke insert on public.conversa from anon, authenticated;
revoke insert on public.conversa_membro from anon, authenticated;


-- ------------------------------------------------------------------
-- 11. Tempo real
-- ------------------------------------------------------------------
-- A app subscreve os inserts de `mensagem`. A RLS aplica-se também aqui: cada
-- sessão só recebe o que a política `mensagem_select` lhe deixaria ler, e é
-- por isso que uma subscrição só chega para tudo (o contador de não lidas e a
-- conversa aberta).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagem'
  ) then
    alter publication supabase_realtime add table public.mensagem;
  end if;
exception when others then
  raise notice 'não foi possível pôr `mensagem` no tempo real (%).', sqlerrm;
end $$;


-- ------------------------------------------------------------------
-- 12. A API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Cada exploração tem um grupo, e lá dentro está a equipa menos o vet:
--
--   select e.nome, c.id, count(m.*) filter (where m.saiu_em is null) as membros
--     from public.exploracao e
--     join public.conversa c on c.exploracao_id = e.id and c.tipo = 'grupo'
--     left join public.conversa_membro m on m.conversa_id = c.id
--    group by e.nome, c.id;
--
-- 2. O veterinário NÃO está em grupo nenhum (tem de dar zero):
--
--   select count(*) from public.conversa_membro m
--     join public.conversa c on c.id = m.conversa_id and c.tipo = 'grupo'
--     join public.membro_exploracao me
--       on me.user_id = m.user_id and me.exploracao_id = c.exploracao_id
--    where me.role = 'veterinario' and m.saiu_em is null;
--
-- 3. O superadmin não lê mensagens. A impersonar a conta dele (ver
--    `gado-provar-rls-psql`), isto tem de dar ZERO linhas mesmo com mensagens
--    na base:
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid-do-superadmin>","role":"authenticated"}';
--   select count(*) from public.mensagem;   -- 0
--   rollback;
--
-- 4. A limpeza está agendada:
--
--   select jobname, schedule from cron.job where jobname = 'terrabovina-limpar-mensagens';
