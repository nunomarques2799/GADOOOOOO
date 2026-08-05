-- ==================================================================
-- Terrabovina — um código de trabalhador não serve a um veterinário
-- ==================================================================
-- Aplica DEPOIS de schema_acesso_ate.sql (17), que é onde vive a versão do
-- `resgatar_convite` que este ficheiro substitui. Idempotente.
--
-- O QUE ESTAVA ERRADO
--
-- O papel com que alguém entra numa exploração vem do CÓDIGO, e só do código. A
-- conta, porém, também diz ao que vem: quem se regista escolhe "trabalhador" ou
-- "veterinário" (ver `src/data/intencao.ts`), e essa escolha decide o caminho
-- que a app lhe abre a seguir.
--
-- As duas coisas nunca se falavam. Uma conta criada como veterinário aceitava um
-- código de trabalhador e entrava — com as permissões de trabalhador, que são
-- mais largas: terrenos, fichas de animais, eliminar animais, despesas. O dono
-- gerou o código para o homem que anda lá todos os dias e quem o usou foi o
-- veterinário que veio à consulta. Nada no ecrã dizia que tinha havido troca.
--
-- O QUE MUDA
--
-- O resgate passa a comparar as duas: um código de `trabalhador` só é aceite por
-- quem se registou como trabalhador, e um de `veterinario` só por quem se
-- registou como veterinário. Recusa com uma frase que diz qual é qual, para o
-- dono saber que código tem de gerar em vez de ficar a olhar para um "inválido".
--
-- QUEM NÃO É AFETADO, E PORQUÊ
--
--   - contas SEM intenção escrita — as que se registaram antes de a pergunta
--     existir. Recusá-las trancava à porta gente que já cá anda, por causa de um
--     campo que ninguém lhes chegou a mostrar.
--   - contas de DONO. Um dono que aceite tratar da quinta do vizinho é convidado
--     para lá como trabalhador, e isso é um arranjo normal entre criadores. A
--     queixa é sobre as duas portas da equipa se trocarem uma pela outra, não
--     sobre esta.
--
-- ISTO NÃO É UMA BARREIRA DE SEGURANÇA — É UMA CONFERÊNCIA
--
-- A intenção vive no `raw_user_meta_data`, que o próprio utilizador pode
-- reescrever com `auth.updateUser`. Quem quiser contorná-la, contorna-a. O que
-- isto impede é o ENGANO: gerar o código errado, ou dá-lo à pessoa errada, e não
-- dar por isso. E não há escalada possível por trás — o papel que fica gravado
-- em `membro_exploracao` continua a ser o do CÓDIGO, nunca o que a conta diz de
-- si própria. Quem editar a metadata à mão consegue usar o outro código e recebe
-- exatamente as permissões desse outro código, que é o que já acontecia hoje.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. O que a conta diz ser
-- ------------------------------------------------------------------
-- Lê-se de `auth.users`, que é `security definer` território: um utilizador
-- normal não tem select nessa tabela, e é por isso que isto vive dentro da
-- função e não numa política.
--
-- Devolve `null` para tudo o que não seja um dos dois papéis de equipa —
-- incluindo 'dono', a ausência do campo e um valor escrito à mão que não
-- conhecemos. Quem chama trata os três da mesma maneira: deixa passar.
create or replace function public.intencao_de_equipa(quem uuid)
returns public.role_membro
language sql
stable
security definer
set search_path = ''
as $$
  select case (u.raw_user_meta_data ->> 'intencao')
           when 'trabalhador' then 'trabalhador'::public.role_membro
           when 'veterinario' then 'veterinario'::public.role_membro
           else null
         end
    from auth.users u
   where u.id = quem;
$$;

revoke all     on function public.intencao_de_equipa(uuid) from public, anon;
grant  execute on function public.intencao_de_equipa(uuid) to authenticated;


-- ------------------------------------------------------------------
-- 2. O resgate, com a conferência pelo meio
-- ------------------------------------------------------------------
-- Cópia integral da versão do ficheiro 17 mais o bloco novo. É copiada e não
-- estendida porque `create or replace` substitui o corpo inteiro — e ter aqui
-- só o pedaço novo deixaria o resto por escrever.
create or replace function public.resgatar_convite(codigo_txt text)
returns json language plpgsql security definer set search_path = 'public' as $$
declare
  c        public.convite%rowtype;
  fim      timestamptz;
  intencao public.role_membro;
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
  -- Defesa a dobrar: a secção 2 do ficheiro 17 já encurta a validade do código
  -- à hora do fim do acesso, mas os códigos criados ANTES dele não passaram por
  -- lá.
  if c.acesso_ate is not null and c.acesso_ate <= now() then
    raise exception 'o prazo de acesso deste convite já terminou';
  end if;

  -- O código é de um papel, a conta foi criada para outro. A frase diz os dois
  -- nomes de propósito: quem a lê é a pessoa que está a tentar entrar, e é ela
  -- que vai ter de pedir o código certo a quem lho deu.
  intencao := public.intencao_de_equipa(auth.uid());
  if intencao is not null and c.role in ('trabalhador', 'veterinario') and c.role <> intencao then
    raise exception 'este código é de %, e a sua conta foi criada como %. Peça um código de % a quem gere a exploração.',
      case c.role when 'veterinario' then 'veterinário' else 'trabalhador' end,
      case intencao when 'veterinario' then 'veterinário' else 'trabalhador' end,
      case intencao when 'veterinario' then 'veterinário' else 'trabalhador' end;
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
-- Função nova: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ==================================================================
-- VERIFICAR
-- ==================================================================
-- 1. O que cada conta diz ser (como superadmin):
--
--   select u.email, public.intencao_de_equipa(u.id) as intencao
--     from auth.users u order by u.created_at desc limit 10;
--
-- 2. Na sessão de uma conta criada como veterinário, um código de trabalhador
--    tem de ser recusado com a frase inteira:
--
--   select public.resgatar_convite('<código de trabalhador>');
--   -- ERROR: este código é de trabalhador, e a sua conta foi criada como
--   --        veterinário. Peça um código de veterinário a quem gere a exploração.
--
-- 3. O código do papel certo continua a entrar:
--
--   select public.resgatar_convite('<código de veterinário>');
--   select role, expira_em from public.membro_exploracao where user_id = auth.uid();
--
-- 4. Uma conta sem intenção escrita (ou de dono) não é afetada:
--
--   update auth.users set raw_user_meta_data = raw_user_meta_data - 'intencao'
--    where id = '<conta de teste>';
--   -- e o resgate de qualquer um dos códigos volta a passar
