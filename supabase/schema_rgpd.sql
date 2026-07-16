-- ==================================================================
-- Gestão de Gado — RGPD: direito ao apagamento (apagar conta + dados)
-- ==================================================================
-- Aplica DEPOIS de schema.sql + schema_roles.sql + schema_superadmin.sql
-- + schema_seguranca.sql. Idempotente.
--
-- IMPORTANTE: depende das FOREIGN KEYS com ON DELETE CASCADE definidas em
-- `schema_seguranca.sql`. Sem elas, apagar a conta removeria a exploração mas
-- deixaria terrenos/animais/eventos órfãos na BD — ou seja, os dados pessoais
-- NÃO ficariam realmente apagados. Corre sempre o schema_seguranca.sql primeiro.
--
-- O que o utilizador consegue fazer sozinho, pela app:
--   apagar_a_minha_conta() — remove a sua conta de autenticação; a cascata
--   remove perfil, explorações (e, por elas, terrenos/animais/eventos),
--   membros, convites criados e a subscrição.
--
-- Nota: se o utilizador for ADMIN de uma exploração, apagar a conta apaga a
-- exploração inteira (incluindo o acesso dos trabalhadores/veterinários dela).
-- Um trabalhador/veterinário que apague a conta só perde a sua ligação; a
-- exploração continua a pertencer ao admin.
-- ==================================================================

create or replace function public.apagar_a_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sem sessão iniciada';
  end if;

  -- A FK convite.usado_por não tem ON DELETE (bloquearia o apagamento se este
  -- utilizador tivesse resgatado algum convite). Libertamos essa referência.
  update public.convite set usado_por = null where usado_por = uid;

  -- Apaga a conta de autenticação. Tudo o resto cai por cascata das FKs:
  --   auth.users → perfil, exploracao (→ terreno/animal/evento),
  --   membro_exploracao, convite (criados), subscricao, subscricao_evento.
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.apagar_a_minha_conta() to authenticated;
