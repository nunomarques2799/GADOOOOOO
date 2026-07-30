-- ==================================================================
-- Terrabovina — o acesso pode terminar num dia e numa hora à escolha
-- ==================================================================
-- Aplica DEPOIS de schema_acesso_temporario.sql (15). Idempotente.
--
-- O QUE FALTAVA
--
-- O 15 deu ao convite uma DURAÇÃO ("4 horas de acesso"), contada a partir do
-- momento em que o veterinário usa o código. Isso responde a "quanto tempo", e
-- não responde a "até quando" — que é a pergunta que o criador faz de facto:
-- «ele vem quinta-feira de manhã, quero que perca o acesso quinta às 18h».
--
-- Com a duração, essa frase não se consegue escrever. O dono teria de adivinhar
-- a que horas é que o veterinário vai usar o código e fazer a conta de cabeça —
-- e se ele o usar na véspera à noite, as 12 horas acabam às 8 da manhã, a meio
-- da visita.
--
-- O QUE MUDA
--
-- O convite passa a poder levar um INSTANTE, `acesso_ate`, em vez de (ou além
-- de) uma duração. As duas colunas convivem e a regra é simples: se houver
-- instante, é ele que manda; senão, conta-se a duração a partir do resgate.
--
-- A coluna que decide os acessos continua a ser a mesma de sempre,
-- `membro_exploracao.expira_em`, e continuam a ser os três helpers do 15
-- (`membro_de`, `role_em`, `pode_cap`) a fazê-la valer. Isto não acrescenta
-- caminho nenhum de saída: só acrescenta uma forma de escrever a hora.
--
-- PORQUÊ DUAS COLUNAS E NÃO UMA
--
-- Fazia-se com uma só, convertendo a duração num instante logo na criação do
-- código. Não se faz porque as duas coisas são promessas diferentes: "4 horas a
-- partir de quando entrares" continua a ser o que se quer quando não se sabe o
-- dia da visita, e resolvê-la na criação dava 4 horas a contar de agora — o
-- código de sexta ficava morto no sábado.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. O instante em que o acesso deste convite termina
-- ------------------------------------------------------------------
-- NULL = não foi marcada hora nenhuma (usa-se `acesso_horas`, que por sua vez a
-- NULL quer dizer "sem prazo"). É o valor de tudo o que já existe.
alter table public.convite
  add column if not exists acesso_ate timestamptz;


-- ------------------------------------------------------------------
-- 2. Criar o convite com hora marcada
-- ------------------------------------------------------------------
-- Assinatura nova outra vez, e pela mesma razão do 15: um parâmetro a mais com
-- valor por omissão deixaria as duas versões da função a existir ao mesmo
-- tempo, e o PostgREST escolheria uma delas conforme os argumentos recebidos.
drop function if exists public.criar_convite(text, public.role_membro, text, int, int);

create or replace function public.criar_convite(
  exp_id text,
  novo_role public.role_membro,
  descricao_txt text default null,
  validade_horas int default 168,
  acesso_horas int default null,
  acesso_ate timestamptz default null
) returns text language plpgsql security definer set search_path = 'public' as $$
declare
  novo_codigo text;
  tentativas int := 0;
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

  loop
    novo_codigo := '';
    for i in 1..8 loop
      novo_codigo := novo_codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
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
-- 3. Resgatar: a hora marcada ganha à duração
-- ------------------------------------------------------------------
create or replace function public.resgatar_convite(codigo_txt text)
returns json language plpgsql security definer set search_path = 'public' as $$
declare
  c public.convite%rowtype;
  fim timestamptz;
begin
  select * into c from public.convite where codigo = upper(trim(codigo_txt));
  if not found then
    raise exception 'código inválido';
  end if;
  if c.usado_por is not null then
    raise exception 'código já foi usado';
  end if;
  if c.expira_em is not null and c.expira_em < now() then
    raise exception 'código expirado';
  end if;
  -- Defesa a dobrar: a secção 2 já encurta a validade do código à hora do fim
  -- do acesso, mas os códigos criados ANTES deste ficheiro não passaram por lá.
  if c.acesso_ate is not null and c.acesso_ate <= now() then
    raise exception 'o prazo de acesso deste convite já terminou';
  end if;

  fim := case
    when c.acesso_ate is not null then c.acesso_ate
    when c.acesso_horas is null then null
    else now() + make_interval(hours => c.acesso_horas)
  end;

  insert into public.membro_exploracao (user_id, exploracao_id, role, expira_em)
  values (auth.uid(), c.exploracao_id, c.role, fim)
  on conflict (user_id, exploracao_id) do update
    set role = excluded.role,
        expira_em = excluded.expira_em;

  update public.convite set usado_por = auth.uid(), usado_em = now() where codigo = c.codigo;
  update public.perfil set estado = 'ativo' where id = auth.uid();

  return json_build_object(
    'exploracao_id', c.exploracao_id,
    'role', c.role,
    'expira_em', fim
  );
end;
$$;

grant execute on function public.resgatar_convite(text) to authenticated;


-- ------------------------------------------------------------------
-- 4. Marcar a hora a quem já cá está
-- ------------------------------------------------------------------
-- O irmão do `definir_prazo_de_acesso` (15), que recebe horas a contar de
-- agora. Este recebe o instante. Ambos existem porque ambas as frases são
-- naturais: "mais um dia" e "até quinta às 18h".
--
-- Passa por RPC pela mesma razão que o outro: com a coluna aberta a `update`,
-- um veterinário estendia o seu próprio prazo.
create or replace function public.definir_fim_de_acesso(membro_id uuid, fim timestamptz)
returns timestamptz language plpgsql security definer set search_path = 'public' as $$
declare
  m public.membro_exploracao%rowtype;
begin
  select * into m from public.membro_exploracao where id = membro_id;
  if not found then
    raise exception 'Esta pessoa já não pertence à exploração.';
  end if;

  if public.role_em(m.exploracao_id) is distinct from 'admin' and not public.eh_superadmin() then
    raise exception 'Só quem gere a exploração pode mudar o tempo de acesso.';
  end if;
  if m.role = 'admin' then
    raise exception 'O dono da exploração não tem prazo de acesso.';
  end if;

  -- `null` tira o prazo; uma hora no passado termina o acesso já. Não se recusa
  -- a hora passada: "terminar às 8 de hoje" às 9 é uma ordem clara, e recusá-la
  -- deixava o dono a carregar num botão que não faz nada.
  update public.membro_exploracao set expira_em = fim where id = membro_id;
  return fim;
end;
$$;

revoke execute on function public.definir_fim_de_acesso(uuid, timestamptz) from anon, public;
grant  execute on function public.definir_fim_de_acesso(uuid, timestamptz) to authenticated;


-- ------------------------------------------------------------------
-- Coluna nova: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Criar um convite com hora marcada e ver a coluna preenchida:
--
--   select public.criar_convite('<exploracao>', 'veterinario', 'visita',
--                               168, null, now() + interval '3 hours');
--   select codigo, acesso_horas, acesso_ate, expira_em from public.convite
--    order by criado_em desc limit 1;
--   -- acesso_horas = null, acesso_ate = daqui a 3h, expira_em = a MESMA hora
--   --    (a validade do código foi encurtada à do acesso)
--
-- 2. Resgatado (na sessão do veterinário), o vínculo fica com essa hora exata:
--
--   select public.resgatar_convite('<codigo>');
--   select expira_em from public.membro_exploracao where user_id = auth.uid();
--
-- 3. Uma hora já passada é recusada na criação:
--
--   select public.criar_convite('<exploracao>', 'veterinario', null,
--                               168, null, now() - interval '1 hour');
--   -- ERROR: a hora de fim do acesso já passou
--
-- 4. Marcar a hora a quem já lá está:
--
--   select public.definir_fim_de_acesso('<id do vínculo>', now() + interval '2 days');
