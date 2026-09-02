-- ==================================================================
-- Terrabovina — sondagens dentro de uma conversa
-- ==================================================================
-- Aplica DEPOIS do `schema_chat_anexos.sql` (é o 37.º; ver `ordem.txt`).
-- Idempotente.
--
-- "Quem pode vir sábado carregar o camião?" com três respostas e a conta feita.
-- É a pergunta que numa conversa de trabalho se faz três vezes e se conta mal.
--
-- TRÊS DECISÕES, tomadas com o criador:
--
--   VOTO COM NOME. Numa equipa de cinco, o voto anónimo é teatro: toda a gente
--   sabe quem falta responder. E o que se quer saber é mesmo QUEM vem sábado,
--   não quantos.
--
--   UMA ESCOLHA por pessoa. Votar outra vez muda o voto (é um `upsert` na
--   chave da pessoa), não acrescenta um segundo.
--
--   QUALQUER MEMBRO cria. Não é uma decisão do dono: quem precisa de saber
--   quem vem sábado é quem está a organizar o sábado.
--
-- A PERGUNTA é o `texto` da própria mensagem, e não uma coluna à parte. Uma
-- sondagem É uma mensagem, com o mesmo autor, a mesma hora e a mesma janela de
-- leitura de todas as outras; dar-lhe um sítio próprio para o texto era ter
-- duas verdades sobre o que ela diz.
--
-- NÃO HÁ FECHAR a sondagem. Uma conversa de trabalho não precisa de urnas:
-- quem quiser parar a votação apaga a mensagem, como faria a qualquer outra.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. O tipo novo de mensagem
-- ------------------------------------------------------------------
-- As duas restrições do ficheiro anterior são refeitas para conhecerem a
-- sondagem. Uma sondagem tem pergunta (o `texto`) e não tem anexo nenhum.
alter table public.mensagem drop constraint if exists mensagem_tipo_conhecido;
alter table public.mensagem
  add constraint mensagem_tipo_conhecido
  check (tipo in ('texto', 'foto', 'audio', 'local', 'sondagem'));

alter table public.mensagem drop constraint if exists mensagem_conteudo;
alter table public.mensagem
  add constraint mensagem_conteudo check (
    -- A saída das apagadas: uma mensagem apagada fica vazia (ver o gatilho do
    -- ficheiro anterior), e sem isto não se conseguia apagar nenhuma que não
    -- fosse de texto.
    apagada_em is not null or
    case tipo
      when 'texto' then char_length(btrim(texto)) between 1 and 2000
      when 'sondagem' then char_length(btrim(texto)) between 1 and 300
      when 'local' then latitude is not null and longitude is not null
                        and char_length(texto) <= 2000
      else anexo is not null and char_length(texto) <= 2000
    end
  );


-- ------------------------------------------------------------------
-- 2. Tabelas
-- ------------------------------------------------------------------

create table if not exists public.sondagem_opcao (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid not null references public.mensagem (id) on delete cascade,
  texto text not null check (char_length(btrim(texto)) between 1 and 80),
  ordem smallint not null,
  unique (mensagem_id, ordem)
);

create index if not exists idx_sondagem_opcao_mensagem
  on public.sondagem_opcao (mensagem_id);

create table if not exists public.sondagem_voto (
  -- A chave é (sondagem, pessoa): é ela que faz "uma escolha por pessoa" ser
  -- uma regra da base de dados e não uma promessa da app.
  mensagem_id uuid not null references public.mensagem (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  opcao_id uuid not null references public.sondagem_opcao (id) on delete cascade,
  votado_em timestamptz not null default clock_timestamp(),
  primary key (mensagem_id, user_id)
);

create index if not exists idx_sondagem_voto_opcao
  on public.sondagem_voto (opcao_id);


-- ------------------------------------------------------------------
-- 3. Helper e RLS
-- ------------------------------------------------------------------
-- A sondagem vive dentro de uma mensagem: quem pode ler a mensagem pode ler a
-- sondagem, e mais ninguém. Toda a pergunta se reduz a essa.
create or replace function public.posso_ler_mensagem_id(msg uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.mensagem m
     where m.id = msg
       and public.posso_ler_mensagem(m.conversa_id, m.criado_em)
  );
$$;

/** Posso votar nesta sondagem agora? (Ler não chega: quem saiu não vota.) */
create or replace function public.posso_votar(msg uuid)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.mensagem m
     where m.id = msg
       and m.tipo = 'sondagem'
       and m.apagada_em is null
       and public.posso_ler_mensagem(m.conversa_id, m.criado_em)
       and public.posso_escrever_na_conversa(m.conversa_id)
  );
$$;

alter table public.sondagem_opcao enable row level security;

drop policy if exists sondagem_opcao_select on public.sondagem_opcao;
create policy sondagem_opcao_select on public.sondagem_opcao
  for select using (public.posso_ler_mensagem_id(mensagem_id));

-- Criar opções é só pelo RPC (que cria a mensagem e as opções de uma vez):
-- sem insert, ninguém acrescenta uma quarta resposta a uma sondagem alheia.

alter table public.sondagem_voto enable row level security;

-- Os votos veem-se todos: são com nome, e é esse o ponto.
drop policy if exists sondagem_voto_select on public.sondagem_voto;
create policy sondagem_voto_select on public.sondagem_voto
  for select using (public.posso_ler_mensagem_id(mensagem_id));

-- Votar é pelo RPC `votar_sondagem`, que confere que a opção pertence mesmo à
-- sondagem em que se está a votar. Sem isso, uma escrita direta podia registar
-- um voto numa opção de outra pergunta.


-- ------------------------------------------------------------------
-- 4. O que a app chama
-- ------------------------------------------------------------------

/**
 * Cria a sondagem: a mensagem e as opções, de uma vez. Devolve o id da
 * mensagem.
 *
 * Numa só função porque as duas coisas não fazem sentido separadas: uma
 * mensagem de sondagem sem opções é um balão vazio, e a app teria de as gravar
 * em dois pedidos com uma janela pelo meio em que o balão estava assim.
 */
create or replace function public.criar_sondagem(
  conv uuid,
  pergunta text,
  opcoes text[]
)
returns uuid language plpgsql security definer set search_path = 'public' as $$
declare
  msg uuid;
  limpa text := btrim(coalesce(pergunta, ''));
  limpas text[];
  o text;
  i smallint := 0;
begin
  if not public.posso_escrever_na_conversa(conv) then
    raise exception 'sem acesso a esta conversa';
  end if;
  if char_length(limpa) = 0 or char_length(limpa) > 300 then
    raise exception 'a pergunta tem de ter entre 1 e 300 caracteres';
  end if;

  -- Opções vazias fora, e sem repetidas: duas respostas iguais numa sondagem
  -- repartem os votos por nada.
  select array_agg(distinct btrim(x)) into limpas
    from unnest(coalesce(opcoes, array[]::text[])) as x
   where btrim(x) <> '';

  if limpas is null or array_length(limpas, 1) < 2 then
    raise exception 'uma sondagem precisa de pelo menos duas respostas diferentes';
  end if;
  if array_length(limpas, 1) > 6 then
    raise exception 'uma sondagem leva no máximo seis respostas';
  end if;

  insert into public.mensagem (conversa_id, autor, texto, tipo)
  values (conv, auth.uid(), limpa, 'sondagem')
  returning id into msg;

  -- Pela ordem em que foram escritas, e não pela do `array_agg` (que o
  -- `distinct` ordena por texto): quem escreveu "Sim, Não, Talvez" espera vê-las
  -- assim, e não "Não, Sim, Talvez".
  foreach o in array coalesce(opcoes, array[]::text[]) loop
    if btrim(o) <> '' and btrim(o) = any (limpas) then
      -- `limpas` encolhe a cada volta para as repetidas não entrarem duas vezes.
      limpas := array_remove(limpas, btrim(o));
      insert into public.sondagem_opcao (mensagem_id, texto, ordem)
      values (msg, btrim(o), i);
      i := i + 1;
    end if;
  end loop;

  return msg;
end;
$$;

/** Vota (ou muda o voto). A opção tem de ser desta sondagem. */
create or replace function public.votar_sondagem(msg uuid, opcao uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.posso_votar(msg) then
    raise exception 'não é possível votar nesta sondagem';
  end if;
  if not exists (
    select 1 from public.sondagem_opcao where id = opcao and mensagem_id = msg
  ) then
    raise exception 'essa resposta não é desta pergunta';
  end if;

  insert into public.sondagem_voto (mensagem_id, user_id, opcao_id)
  values (msg, auth.uid(), opcao)
  on conflict (mensagem_id, user_id)
    do update set opcao_id = excluded.opcao_id, votado_em = clock_timestamp();
end;
$$;

/** Tira o voto (tocar outra vez na resposta que já se escolheu). */
create or replace function public.tirar_voto(msg uuid)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.posso_votar(msg) then
    raise exception 'não é possível mexer nesta sondagem';
  end if;
  delete from public.sondagem_voto where mensagem_id = msg and user_id = auth.uid();
end;
$$;

/**
 * As sondagens de uma conversa, com as contas feitas: uma linha por opção.
 *
 * Uma ida ao servidor por conversa aberta, e não uma por sondagem. `quem`
 * traz os IDS e não os nomes: a app já sabe traduzir ids em nomes
 * (`nomes_da_equipa()`), e devolver nomes daqui era um segundo sítio a
 * responder à mesma pergunta.
 */
create or replace function public.sondagens_da_conversa(conv uuid)
returns table (
  s_mensagem uuid,
  s_opcao uuid,
  s_texto text,
  s_ordem smallint,
  s_votos integer,
  s_quem uuid[],
  s_minha boolean
)
language sql security definer stable set search_path = 'public' as $$
  select o.mensagem_id,
         o.id,
         o.texto,
         o.ordem,
         count(v.user_id)::int,
         coalesce(array_agg(v.user_id) filter (where v.user_id is not null), array[]::uuid[]),
         bool_or(v.user_id = auth.uid())
    from public.mensagem m
    join public.sondagem_opcao o on o.mensagem_id = m.id
    left join public.sondagem_voto v on v.opcao_id = o.id
   where m.conversa_id = conv
     and m.tipo = 'sondagem'
     and public.posso_ler_mensagem(m.conversa_id, m.criado_em)
   group by o.mensagem_id, o.id, o.texto, o.ordem
   order by o.mensagem_id, o.ordem;
$$;


-- ------------------------------------------------------------------
-- 5. Privilégios
-- ------------------------------------------------------------------
revoke insert, update, delete on public.sondagem_opcao from anon, authenticated;
revoke insert, update, delete on public.sondagem_voto from anon, authenticated;
revoke truncate, trigger, references on public.sondagem_opcao from anon, authenticated;
revoke truncate, trigger, references on public.sondagem_voto from anon, authenticated;

revoke execute on function public.posso_ler_mensagem_id(uuid) from anon, public;
revoke execute on function public.posso_votar(uuid) from anon, public;
revoke execute on function public.criar_sondagem(uuid, text, text[]) from anon, public;
revoke execute on function public.votar_sondagem(uuid, uuid) from anon, public;
revoke execute on function public.tirar_voto(uuid) from anon, public;
revoke execute on function public.sondagens_da_conversa(uuid) from anon, public;

grant execute on function public.posso_ler_mensagem_id(uuid) to authenticated;
grant execute on function public.posso_votar(uuid) to authenticated;
grant execute on function public.criar_sondagem(uuid, text, text[]) to authenticated;
grant execute on function public.votar_sondagem(uuid, uuid) to authenticated;
grant execute on function public.tirar_voto(uuid) to authenticated;
grant execute on function public.sondagens_da_conversa(uuid) to authenticated;


notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Criar uma sondagem e ver as contas (a impersonar um membro):
--
--   select public.criar_sondagem('<conv>', 'Quem vem sábado?', array['Eu vou','Não posso']);
--   select * from public.sondagens_da_conversa('<conv>');
--
-- 2. Votar duas vezes MUDA o voto, não soma (o total tem de ficar em 1):
--
--   select public.votar_sondagem('<msg>', '<opcao-a>');
--   select public.votar_sondagem('<msg>', '<opcao-b>');
--   select sum(s_votos) from public.sondagens_da_conversa('<conv>') where s_mensagem = '<msg>';
--
-- 3. Uma opção de outra pergunta é recusada:
--
--   select public.votar_sondagem('<msg>', '<opcao-de-outra>');   -- erro
