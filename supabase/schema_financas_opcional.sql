-- ==================================================================
-- Gestão de Gado — as finanças passam a ser opcionais (v8)
-- ==================================================================
-- Aplica DEPOIS de schema_financas.sql. Idempotente.
--
-- PORQUÊ
-- Nem todos os criadores querem a contabilidade dentro desta app: muitos já
-- fazem as contas noutro lado, ou com o contabilista. Para esses, um ecrã de
-- Finanças permanentemente a zeros não é uma funcionalidade — parece uma
-- avaria. A gestão económica passa a ser LIGADA PELO CLIENTE, e fica desligada
-- para toda a gente até alguém a ligar (`default false`, incluindo em contas
-- que já têm movimentos registados).
--
-- Desligar ESCONDE, NÃO APAGA. Nenhuma linha de `movimento` é removida aqui,
-- e nenhum `evento.valor` já gravado é limpo: quem religar encontra as contas
-- como as deixou.
--
-- ONDE VIVE O INTERRUPTOR (e porque é que são duas colunas)
--   `perfil.financas_ativas` ...... a escolha do cliente. É o que ele liga.
--   `exploracao.financas_ativas` .. espelho, mantido pelo RPC abaixo.
--
-- Duas colunas porque a RLS de `perfil` só deixa cada um ver o SEU perfil (ver
-- `perfil_self_select` em schema_roles.sql). Se a decisão vivesse apenas lá, o
-- trabalhador e o veterinário não conseguiriam saber se as finanças estão
-- ligadas na exploração onde trabalham — e a app deles teria de adivinhar.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Colunas
-- ------------------------------------------------------------------
alter table public.perfil
  add column if not exists financas_ativas boolean not null default false;

alter table public.exploracao
  add column if not exists financas_ativas boolean not null default false;


-- ------------------------------------------------------------------
-- 2. Helper: as finanças estão ligadas nesta exploração?
-- ------------------------------------------------------------------
-- SECURITY DEFINER como os restantes helpers de schema_roles.sql, para poder
-- ser usado dentro das policies sem recursão de RLS.
create or replace function public.financas_ativas_em(exp_id text)
returns boolean language sql security definer stable set search_path = 'public' as $$
  select coalesce(
    (select financas_ativas from public.exploracao where id = exp_id),
    false
  );
$$;


-- ------------------------------------------------------------------
-- 3. RPC: o cliente liga/desliga, de uma vez, em toda a conta
-- ------------------------------------------------------------------
-- É uma decisão de conta, não de exploração: quem não quer contabilidade na
-- app não a quer em lado nenhum. O RPC grava a escolha no perfil e espelha-a
-- em todas as explorações onde o utilizador é admin, numa transação só — com
-- dois UPDATEs soltos do lado do cliente, uma falha de rede a meio deixava a
-- conta a dizer uma coisa e as explorações outra.
create or replace function public.definir_financas_ativas(ativas boolean)
returns void language plpgsql security definer set search_path = 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'é preciso sessão iniciada';
  end if;

  update public.perfil set financas_ativas = ativas where id = auth.uid();

  -- Só as explorações que esta pessoa administra. Um trabalhador que consiga
  -- chamar o RPC muda o seu próprio perfil (inofensivo) e mais nada.
  update public.exploracao e
     set financas_ativas = ativas
   where exists (
     select 1 from public.membro_exploracao m
      where m.exploracao_id = e.id
        and m.user_id = auth.uid()
        and m.role = 'admin'
   );
end;
$$;

grant execute on function public.definir_financas_ativas(boolean) to authenticated;


-- ------------------------------------------------------------------
-- 4. Uma exploração nova herda a escolha do dono
-- ------------------------------------------------------------------
-- Sem isto, um cliente com as finanças ligadas criava a exploração seguinte
-- e ela nascia desligada, sem explicação nenhuma.
-- Substitui a versão de schema_roles.sql, mantendo o que ela já fazia
-- (tornar o criador admin da exploração).
create or replace function public.handle_new_exploracao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.membro_exploracao (user_id, exploracao_id, role)
  values (new.user_id, new.id, 'admin')
  on conflict do nothing;

  update public.exploracao
     set financas_ativas = coalesce(
       (select p.financas_ativas from public.perfil p where p.id = new.user_id),
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


-- ------------------------------------------------------------------
-- 5. Com o interruptor desligado, ninguém lança movimentos
-- ------------------------------------------------------------------
-- Repõe as policies de escrita de schema_financas.sql com a condição extra.
-- A de SELECT fica como está: desligar esconde na app, mas os dados continuam
-- a ser do cliente e a sair nas exportações e no RGPD.
drop policy if exists movimento_insert on public.movimento;
create policy movimento_insert on public.movimento
  for insert with check (
    public.eh_superadmin()
    or (
      public.perfil_ativo()
      and public.financas_ativas_em(exploracao_id)
      and (
        public.role_em(exploracao_id) = 'admin'
        or (
          public.role_em(exploracao_id) = 'trabalhador'
          and direcao = 'despesa'
          and criado_por = auth.uid()
        )
      )
    )
  );

drop policy if exists movimento_update on public.movimento;
create policy movimento_update on public.movimento
  for update using (
    public.eh_superadmin()
    or public.role_em(exploracao_id) = 'admin'
    or (public.role_em(exploracao_id) = 'trabalhador' and criado_por = auth.uid())
  ) with check (
    public.eh_superadmin()
    or (
      public.perfil_ativo()
      and public.financas_ativas_em(exploracao_id)
      and (
        public.role_em(exploracao_id) = 'admin'
        or (
          public.role_em(exploracao_id) = 'trabalhador'
          and criado_por = auth.uid()
          and direcao = 'despesa'
        )
      )
    )
  );


-- ------------------------------------------------------------------
-- 6. Nem custos nos eventos
-- ------------------------------------------------------------------
-- O custo da vacina e do medicamento vive em `evento.valor`, e uma policy não
-- consegue recusar UMA coluna — recusaria o evento inteiro, o que impediria o
-- veterinário de registar o tratamento só porque o dono não quer contabilidade.
-- O trigger deixa o registo sanitário passar e ignora o dinheiro.
create or replace function public.limpa_valor_sem_financas()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if new.valor is not null and not public.financas_ativas_em(
    (select a.exploracao_id from public.animal a where a.id = new.animal_id)
  ) then
    new.valor := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_valor_sem_financas on public.evento;
create trigger trg_valor_sem_financas
  before insert or update on public.evento
  for each row execute function public.limpa_valor_sem_financas();


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- Toda a gente começa desligada:
--
--   select financas_ativas, count(*) from public.perfil group by 1;
--   select financas_ativas, count(*) from public.exploracao group by 1;
--
-- Ligar na tua conta (ou fazê-lo pelo ecrã Perfil → Gestão financeira):
--
--   select public.definir_financas_ativas(true);
--
-- E confirmar que o espelho acompanhou:
--
--   select nome, financas_ativas from public.exploracao order by nome;
--
-- Nada foi apagado — os movimentos continuam lá, à espera de voltar a aparecer:
--
--   select count(*), sum(valor) from public.movimento;
