-- ==================================================================
-- Passar o superadmin para outra conta
-- ==================================================================
-- NÃO é schema (não entra no `ordem.txt`): é uma OPERAÇÃO, como o
-- `reparar.sql`. Corre-se à mão no SQL Editor do projeto, uma vez.
--
-- O QUE FAZ
--   1. `terrabovinasuperadmin@gmail.com` passa a superadmin (e a conta fica
--      ativa, porque um superadmin com o perfil pendente não conseguia entrar).
--   2. `nunomarques271999@gmail.com` deixa de ser superadmin e fica um cliente
--      normal — perfil `ativo`, que é o que lhe permite criar explorações e
--      continuar a ser dono das que já tem. As explorações NÃO se tocam: quem
--      manda nelas é a linha de `membro_exploracao` com `role = 'admin'`, e essa
--      não depende de ser superadmin.
--
-- A ORDEM IMPORTA, e é por isso que isto é um bloco só, numa transação: se a
-- despromoção corresse primeiro e a conta nova não existisse, a plataforma
-- ficava SEM superadmin nenhum — e sem superadmin não há quem aprove clientes
-- novos nem quem se possa promover a si próprio pela app. O `raise exception`
-- abaixo desfaz tudo nesse caso.
--
-- ANTES DE CORRER
--   - A conta `terrabovinasuperadmin@gmail.com` tem de EXISTIR: registá-la
--     primeiro pela app (ecrã de entrada → criar conta) e confirmar o email.
--   - Fazer a cópia de segurança: `powershell scripts/backup.ps1 -Ambiente prod`.
--   - Correr primeiro no projeto de TESTES, com os emails de teste, para ver a
--     mensagem de confirmação a sair como deve ser.
--
-- DEPOIS DE CORRER
--   - Sair da sessão nos dois aparelhos e voltar a entrar: o
--     `is_superadmin` é lido no arranque e guardado na cache de acesso.
-- ==================================================================

do $$
declare
  novo_id  uuid;
  velho_id uuid;
  novo_email   text := 'terrabovinasuperadmin@gmail.com';
  velho_email  text := 'nunomarques271999@gmail.com';
  n_exploracoes int;
begin
  select id into novo_id  from auth.users where lower(email) = lower(novo_email);
  select id into velho_id from auth.users where lower(email) = lower(velho_email);

  if novo_id is null then
    raise exception
      'A conta % ainda não existe. Registe-a na app (e confirme o email) antes de correr isto — sem ela, tirar o superadmin ao % deixava a plataforma sem nenhum.',
      novo_email, velho_email;
  end if;

  -- 1. Promover PRIMEIRO. Se alguma coisa falhar a seguir, a transação desfaz
  --    isto também, mas em nenhum instante existe uma janela sem superadmin.
  update public.perfil
     set is_superadmin = true,
         estado = 'ativo'
   where id = novo_id;

  if not found then
    -- Perfil em falta: o trigger `handle_new_user` cria um por cada conta, mas
    -- contas criadas antes dele (ou por importação) podem não ter linha. Ver a
    -- secção de perfis em falta do `reparar.sql`.
    insert into public.perfil (id, nome, estado, is_superadmin)
    values (novo_id, 'Superadmin Terrabovina', 'ativo', true);
  end if;

  -- 2. Só agora despromover.
  if velho_id is null then
    raise notice 'A conta % não existe neste projeto — nada a despromover.', velho_email;
  else
    update public.perfil
       set is_superadmin = false,
           estado = 'ativo'   -- cliente normal, com acesso de escrita
     where id = velho_id;

    select count(*) into n_exploracoes
      from public.membro_exploracao
     where user_id = velho_id and role = 'admin';

    raise notice
      'ok: % deixou de ser superadmin e fica cliente ativo, dono de % exploração(ões).',
      velho_email, n_exploracoes;
  end if;

  raise notice 'ok: % é agora o superadmin.', novo_email;
end $$;


-- ------------------------------------------------------------------
-- VERIFICAR (correr a seguir; tem de dar exatamente uma linha com true)
-- ------------------------------------------------------------------
select u.email, p.is_superadmin, p.estado
  from public.perfil p
  join auth.users u on u.id = p.id
 where lower(u.email) in ('terrabovinasuperadmin@gmail.com', 'nunomarques271999@gmail.com')
 order by p.is_superadmin desc;
