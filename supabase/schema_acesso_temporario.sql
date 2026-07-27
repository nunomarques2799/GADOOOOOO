-- ==================================================================
-- Terrabovina — acesso com prazo (o veterinário entra e sai sozinho)
-- ==================================================================
-- Aplica DEPOIS de schema_roles.sql (2), schema_suspensao.sql (6) e
-- schema_permissoes.sql (13). Idempotente.
--
-- O PROBLEMA
--
-- Um veterinário é convidado para uma vinda, não para sempre. Até aqui o
-- convite dava-lhe acesso permanente à exploração, e tirá-lo dependia de o
-- criador se lembrar de o remover à mão — semanas depois, se se lembrasse. Um
-- acesso que só termina por memória de alguém é um acesso que não termina.
--
-- O QUE MUDA
--
-- `membro_exploracao` ganha `expira_em`. Passada a hora, a linha continua lá
-- (é o que deixa o dono ver que o acesso existiu e renová-lo) mas deixa de
-- valer: `membro_de()`, `role_em()` e `pode_cap()` passam a ignorá-la. Como
-- TODAS as políticas de RLS passam por uma dessas três, o veterinário fica sem
-- exploração nenhuma no instante certo, sem ninguém correr nada.
--
-- A conta dele NÃO é tocada: continua criada, continua a poder entrar, e o que
-- vê é uma app sem explorações. É o que o criador pediu, e é também o que evita
-- ter de a recriar quando ele voltar cá.
--
-- PORQUÊ NOS HELPERS E NÃO NAS POLÍTICAS
--
-- São três funções contra dezenas de políticas espalhadas por cinco ficheiros.
-- Pôr a condição em cada política era garantir que uma ficava esquecida — e uma
-- política esquecida aqui é uma porta que fica aberta depois do prazo, calada.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Até quando vale este vínculo
-- ------------------------------------------------------------------
-- NULL = sem prazo. É o valor de tudo o que já existe (donos e trabalhadores),
-- e é o que tem de ser: uma migração que pusesse prazo por omissão fechava a
-- porta a toda a gente de uma vez.
alter table public.membro_exploracao
  add column if not exists expira_em timestamptz;

create index if not exists idx_membro_expira on public.membro_exploracao (expira_em);

-- O dono nunca tem prazo. Uma exploração cujo admin expirasse ficava sem
-- ninguém que a pudesse gerir, e sem ninguém que pudesse renovar o acesso.
update public.membro_exploracao set expira_em = null where role = 'admin';

alter table public.membro_exploracao
  drop constraint if exists membro_admin_sem_prazo;
alter table public.membro_exploracao
  add constraint membro_admin_sem_prazo
  check (role <> 'admin' or expira_em is null);


-- ------------------------------------------------------------------
-- 2. Os três helpers por onde passa toda a RLS
-- ------------------------------------------------------------------
create or replace function public.membro_de(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select exists (
    select 1 from public.membro_exploracao
    where exploracao_id = exp_id
      and user_id = auth.uid()
      and (expira_em is null or expira_em > now())
  );
$$;

create or replace function public.role_em(exp_id text)
returns text language sql security definer stable set search_path = 'public' as $$
  select role::text from public.membro_exploracao
  where exploracao_id = exp_id
    and user_id = auth.uid()
    and (expira_em is null or expira_em > now())
  limit 1;
$$;

-- Igual ao de `schema_permissoes.sql`, com a condição do prazo no `where`.
-- Está repetido de propósito: o `pode_cap` lê a tabela diretamente (precisa da
-- coluna `permissoes` da mesma linha) e não passa pelo `role_em`, por isso
-- corrigir só os outros dois deixava a ESCRITA aberta depois do prazo — a
-- leitura fechava e o veterinário continuava a poder gravar às cegas.
create or replace function public.pode_cap(exp_id text, cap text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select public.eh_superadmin() or (
    public.pode_escrever_em(exp_id)
    and coalesce((
      select case
        when m.role = 'admin' or not public.capacidade_gerivel(cap)
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
-- 3. O convite passa a levar o prazo consigo
-- ------------------------------------------------------------------
-- Duas durações diferentes, e confundi-las seria o erro fácil:
--   `validade_horas` — quanto tempo o CÓDIGO pode ser usado (já existia);
--   `acesso_horas`   — quanto tempo o acesso dura DEPOIS de usado (novo).
-- Um código válido 7 dias que dá 4 horas de acesso é um caso normal.
alter table public.convite
  add column if not exists acesso_horas int;

-- O parâmetro novo tem de entrar por uma assinatura nova: acrescentá-lo com
-- valor por omissão à antiga deixava as duas versões a existir ao mesmo tempo,
-- e o PostgREST escolhia uma delas conforme os argumentos que recebesse.
drop function if exists public.criar_convite(text, public.role_membro, text, int);

create or replace function public.criar_convite(
  exp_id text,
  novo_role public.role_membro,
  descricao_txt text default null,
  validade_horas int default 168,
  acesso_horas int default null
) returns text language plpgsql security definer set search_path = 'public' as $$
declare
  novo_codigo text;
  tentativas int := 0;
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
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

  loop
    novo_codigo := '';
    for i in 1..8 loop
      novo_codigo := novo_codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.convite where codigo = novo_codigo);
    tentativas := tentativas + 1;
    if tentativas > 5 then raise exception 'falhou a gerar código único'; end if;
  end loop;

  insert into public.convite
    (codigo, exploracao_id, role, criado_por, descricao, expira_em, acesso_horas)
  values
    (novo_codigo, exp_id, novo_role, auth.uid(), descricao_txt,
     now() + make_interval(hours => validade_horas), acesso_horas);
  return novo_codigo;
end;
$$;

revoke execute on function public.criar_convite(text, public.role_membro, text, int, int) from anon, public;
grant  execute on function public.criar_convite(text, public.role_membro, text, int, int) to authenticated;


-- ------------------------------------------------------------------
-- 4. Resgatar o código põe o relógio a contar
-- ------------------------------------------------------------------
-- O prazo conta a partir de AGORA (do resgate), não da criação do código: o
-- veterinário que só entra três dias depois tem as horas todas, que é o que o
-- dono quis dizer com "quatro horas de acesso".
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

  fim := case
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
-- 5. Mudar o prazo de quem já lá está
-- ------------------------------------------------------------------
-- Renovar ("mais 4 horas"), terminar já ("horas = 0") ou tirar o prazo de vez
-- ("horas = null"). Passa por RPC e não por um `update` direto porque a coluna
-- decide acessos: com a política de UPDATE aberta, um veterinário podia
-- estender o seu próprio prazo, que é o buraco exato que isto vem fechar.
--
-- As horas contam-se a partir de agora, e não do fim anterior: quem carrega em
-- "mais um dia" a um acesso que expirou ontem quer um dia a partir de hoje.
create or replace function public.definir_prazo_de_acesso(membro_id uuid, horas int)
returns timestamptz language plpgsql security definer set search_path = 'public' as $$
declare
  m public.membro_exploracao%rowtype;
  fim timestamptz;
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

  fim := case
    when horas is null then null
    when horas <= 0 then now()      -- termina já
    else now() + make_interval(hours => horas)
  end;

  update public.membro_exploracao set expira_em = fim where id = membro_id;
  return fim;
end;
$$;

revoke execute on function public.definir_prazo_de_acesso(uuid, int) from anon, public;
grant  execute on function public.definir_prazo_de_acesso(uuid, int) to authenticated;


-- ------------------------------------------------------------------
-- 6. O dono tem de continuar a VER quem expirou
-- ------------------------------------------------------------------
-- A política de leitura de `membro_exploracao` (schema_roles.sql) deixa o admin
-- ver os membros da sua exploração, e essa passa pelo `role_em` DELE, que não
-- tem prazo — portanto continua a ver as linhas expiradas, que é o que permite
-- renovar. O próprio também continua a ver a sua (a política tem
-- `user_id = auth.uid()`), e é isso que deixa a app dizer-lhe "o seu acesso a
-- esta exploração terminou" em vez de o deixar num ecrã vazio sem explicação.
--
-- Nada a fazer aqui, portanto. Fica escrito porque é o que se vai querer
-- confirmar da próxima vez que alguém mexa nestas políticas.


notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Um vínculo com prazo no passado deixa de contar (tem de dar false/null):
--
--   update public.membro_exploracao set expira_em = now() - interval '1 hour'
--    where id = '<id do vínculo de teste>';
--   -- na sessão DESSE utilizador:
--   select public.membro_de('<exploracao>'), public.role_em('<exploracao>'),
--          public.pode_cap('<exploracao>', 'editarAnimais');
--
-- 2. E que ele deixa de ver a exploração (0 linhas), continuando com conta:
--
--   select count(*) from public.exploracao;
--
-- 3. O dono continua a ver a linha expirada, para a poder renovar:
--
--   select id, user_id, role, expira_em from public.membro_exploracao
--    where exploracao_id = '<exploracao>';
--
-- 4. Renovar funciona e devolve a hora nova:
--
--   select public.definir_prazo_de_acesso('<id do vínculo>', 4);
