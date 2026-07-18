-- ==================================================================
-- Gestão de Gado — só se elimina um animal sem histórico (v7)
-- ==================================================================
-- Aplica DEPOIS dos anteriores. Idempotente.
--
-- A REGRA: eliminar um animal só é possível se ele não tiver eventos nem
-- crias registadas. Um animal com histórico não se elimina — marca-se a
-- saída (falecido ou vendido), que é o que o domínio já faz e que preserva
-- a árvore genealógica dos descendentes.
--
-- Porquê: "eliminar" servia dois casos opostos com a mesma operação.
--   1. Registei um animal por engano  → apagar está certo, não existiu.
--   2. Apagar um animal com meses de histórico → a cascata leva os eventos
--      atrás, incluindo os que outra pessoa registou hoje de manhã. Isto
--      não é eliminar um registo, é destruir trabalho.
-- A condição "sem histórico" separa os dois e recusa o segundo.
--
-- Bónus: resolve o conflito de concorrência que a versão da linha NÃO
-- resolvia. Criar um evento não altera a linha do animal, portanto o
-- `updated_at` do animal não mexe e a verificação de versão deixava passar
-- exatamente o caso mau. A condição "sem eventos" apanha-o.
--
-- POR ARQUITETURA, isto NÃO usa um trigger `before delete`. Um trigger teria
-- de distinguir "apagar este animal" de "apagar a exploração/conta inteira",
-- que apagam animais com histórico de forma legítima — e essa distinção
-- depende de como o Postgres expõe o contexto de uma cascata, que é subtil.
-- Em vez disso tira-se o privilégio de DELETE ao papel `authenticated` e
-- abre-se um único caminho, este RPC. As cascatas de chave estrangeira
-- correm com os privilégios do DONO da tabela, não do utilizador, por isso
-- continuam a funcionar intactas: apagar a exploração e o
-- `apagar_a_minha_conta()` do RGPD não são afetados.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. O único caminho para eliminar um animal
-- ------------------------------------------------------------------
create or replace function public.eliminar_animal(animal_id text)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  a public.animal%rowtype;
  n_eventos int;
  n_crias int;
begin
  select * into a from public.animal where id = animal_id;
  if not found then
    raise exception 'Este animal já não existe.';
  end if;

  -- Mesmas condições da política `animal_elimina`. Repetem-se aqui porque
  -- SECURITY DEFINER passa por cima da RLS: quem valida somos nós.
  if not public.pode_escrever_em(a.exploracao_id) then
    raise exception 'A conta está suspensa, ou não tem acesso a esta exploração.';
  end if;
  if not (
    public.role_em(a.exploracao_id) in ('admin', 'trabalhador')
    or public.eh_superadmin()
  ) then
    raise exception 'Não tem permissão para eliminar animais nesta exploração.';
  end if;

  select count(*) into n_eventos from public.evento e where e.animal_id = a.id;
  if n_eventos > 0 then
    raise exception
      'Este animal tem % registo(s) no histórico. Marque a saída (falecido ou vendido) em vez de eliminar.',
      n_eventos;
  end if;

  select count(*) into n_crias
    from public.animal f where f.mae_id = a.id or f.pai_id = a.id;
  if n_crias > 0 then
    raise exception
      'Este animal é progenitor de % animal(is) registado(s). Marque a saída em vez de eliminar, para não partir a árvore genealógica.',
      n_crias;
  end if;

  delete from public.animal where id = a.id;
end;
$$;

revoke execute on function public.eliminar_animal(text) from anon, public;
grant  execute on function public.eliminar_animal(text) to authenticated;


-- ------------------------------------------------------------------
-- 2. Fechar o caminho direto
-- ------------------------------------------------------------------
-- Sem isto, a app (ou qualquer pedido com a chave publishable) continuaria a
-- poder `delete from animal` e a regra acima era decorativa.
--
-- As cascatas NÃO são afetadas: as ações de integridade referencial correm
-- com os privilégios do dono da tabela. É por isso que um ON DELETE CASCADE
-- funciona mesmo quando o utilizador não tem DELETE na tabela filha.
revoke delete on public.animal from authenticated;

-- A política `animal_elimina` fica onde está, como segunda linha de defesa:
-- se alguém voltar a conceder o privilégio, a RLS ainda limita os papéis.


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. O papel `authenticated` não pode apagar animais diretamente (0 linhas):
--
--   select privilege_type from information_schema.table_privileges
--    where table_name = 'animal' and grantee = 'authenticated'
--      and privilege_type = 'DELETE';
--
-- 2. Mas continua a poder ler e escrever (SELECT/INSERT/UPDATE presentes):
--
--   select privilege_type from information_schema.table_privileges
--    where table_name = 'animal' and grantee = 'authenticated'
--    order by privilege_type;
--
-- 3. E a cascata continua inteira — apagar uma exploração de teste com
--    animais tem de funcionar. Testar numa exploração descartável, não numa
--    a sério.
