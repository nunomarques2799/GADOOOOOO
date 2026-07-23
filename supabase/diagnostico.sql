-- ==================================================================
-- Diagnóstico — porque é que a app não mostra o que devia?
-- ==================================================================
-- Correr no SQL Editor do projeto de TESTES. Só lê, não altera nada.
-- Põe o email da conta de CLIENTE na linha assinalada e corre tudo.
--
-- A coluna `veredito` diz o que está bem e o que não está. A app mostra uma
-- exploração quando existe uma linha em `membro_exploracao` para o utilizador
-- com sessão iniciada — NÃO basta a exploração ter o `user_id` dele. É essa a
-- pergunta que a RLS faz (`exploracao_membros_read` → `membro_de(id)`), e é o
-- ponto onde isto costuma partir.
-- ==================================================================

with alvo as (
  -- <<<< AQUI: o email da conta de cliente
  select id, email from auth.users where email = 'cliente@exemplo.pt'
)

select * from (

  select 1 as ord, 'conta' as o_que,
         coalesce((select email from alvo), '(NÃO EXISTE)') as valor,
         case when exists (select 1 from alvo)
              then 'OK'
              else 'FALHA — cria a conta primeiro na app ou em Authentication → Users' end as veredito

  union all
  select 2, 'perfil.estado',
         coalesce((select p.estado from public.perfil p join alvo a on a.id = p.id), '(sem linha de perfil)'),
         case
           when not exists (select 1 from public.perfil p join alvo a on a.id = p.id)
             then 'FALHA — não há linha em `perfil`. O trigger handle_new_user não correu.'
           when (select p.estado from public.perfil p join alvo a on a.id = p.id) = 'ativo'
             then 'OK'
           else 'FALHA — conta por aprovar: a app manda-a para o ecrã de espera'
         end

  union all
  select 3, 'perfil.is_superadmin',
         coalesce((select p.is_superadmin::text from public.perfil p join alvo a on a.id = p.id), '—'),
         case when coalesce((select p.is_superadmin from public.perfil p join alvo a on a.id = p.id), false)
              then 'FALHA — sendo superadmin, a app abre no painel de clientes e nunca mostra gado'
              else 'OK' end

  union all
  select 4, 'explorações na base (demo-)',
         (select count(*)::text from public.exploracao e join alvo a on a.id = e.user_id where e.id like 'demo-%'),
         case when (select count(*) from public.exploracao e join alvo a on a.id = e.user_id where e.id like 'demo-%') = 2
              then 'OK' else 'FALHA — o dados_de_teste.sql não chegou a inserir' end

  union all
  -- ESTA é a linha que costuma explicar tudo.
  select 5, 'membro_exploracao (é isto que a RLS vê)',
         (select count(*)::text from public.membro_exploracao m join alvo a on a.id = m.user_id where m.exploracao_id like 'demo-%'),
         case when (select count(*) from public.membro_exploracao m join alvo a on a.id = m.user_id where m.exploracao_id like 'demo-%') = 2
              then 'OK'
              else 'FALHA — sem estas linhas as explorações existem mas a app não as vê. Volta a correr o dados_de_teste.sql (versão nova).' end

  union all
  select 6, 'trigger on_exploracao_created',
         coalesce((select tgname from pg_trigger where tgname = 'on_exploracao_created' and not tgisinternal), '(não existe)'),
         case when exists (select 1 from pg_trigger where tgname = 'on_exploracao_created' and not tgisinternal)
              then 'OK' else 'AVISO — explorações criadas PELA APP não vão dar acesso a ninguém' end

  union all
  select 7, 'terrenos', (select count(*)::text from public.terreno where id like 'demo-%'),
         case when (select count(*) from public.terreno where id like 'demo-%') = 6 then 'OK' else 'FALHA' end

  union all
  select 8, 'animais', (select count(*)::text from public.animal where id like 'demo-%'),
         case when (select count(*) from public.animal where id like 'demo-%') = 28 then 'OK' else 'FALHA' end

  union all
  select 9, 'eventos', (select count(*)::text from public.evento where id like 'demo-%'),
         case when (select count(*) from public.evento where id like 'demo-%') = 16 then 'OK' else 'FALHA' end

  union all
  select 10, 'movimentos', (select count(*)::text from public.movimento where id like 'demo-%'),
         case when (select count(*) from public.movimento where id like 'demo-%') = 21 then 'OK' else 'FALHA' end

  union all
  select 11, 'colunas novas (casa/finalidade)',
         (select count(*)::text from public.animal where id like 'demo-%' and casa is not null) || ' com casa, ' ||
         (select count(*)::text from public.animal where id like 'demo-%' and finalidade is not null) || ' com finalidade',
         case when (select count(*) from public.animal where id like 'demo-%' and casa is not null) > 0
              then 'OK' else 'FALHA — o schema_animal_campos.sql pode não ter sido aplicado' end

  union all
  select 12, 'interruptores da conta',
         coalesce((select 'financas=' || e.financas_ativas || ' casa=' || e.casa_ativa
                     from public.exploracao e where e.id = 'demo-exp-ribeira'), '—'),
         case when coalesce((select e.casa_ativa from public.exploracao e where e.id = 'demo-exp-ribeira'), false)
              then 'OK' else 'AVISO — os campos de casa não vão aparecer no formulário' end

  union all
  -- Outras contas, para se perceber com qual se está a entrar na app.
  select 13, 'contas existentes',
         (select string_agg(u.email || case when p.is_superadmin then ' [SUPERADMIN]' else ' [cliente:' || p.estado || ']' end, '  ·  ' order by u.email)
            from auth.users u left join public.perfil p on p.id = u.id),
         'informativo — confirma com qual estás a entrar na app'

) d order by ord;
