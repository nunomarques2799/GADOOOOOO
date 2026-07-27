-- ==================================================================
-- Terrabovina — eliminar deixa de apagar: fica registado quem e quando
-- ==================================================================
-- Aplica DEPOIS de schema_eliminar.sql (9) e schema_permissoes.sql (13),
-- que são os dois donos anteriores do RPC `eliminar_animal`. Idempotente.
--
-- O QUE MUDA
--
-- 1. `eliminar_animal` deixa de fazer `delete` e passa a marcar o animal como
--    `estado = 'eliminado'`. O registo continua na base, com o histórico e a
--    genealogia intactos; o que desaparece é o animal das listas do dia a dia.
--
-- 2. Duas colunas novas guardam QUEM tirou o animal do efetivo e QUANDO:
--    `saida_por` e `saida_em`. Valem para os três motivos de saída (falecido,
--    vendido, eliminado), não só para o eliminado — quem certificou uma morte é
--    tão parte da auditoria como quem apagou um registo.
--
-- 3. Um trigger preenche essas colunas. NÃO é o cliente que as escreve: numa
--    app offline-first o telemóvel decide o que envia, e uma auditoria em que o
--    auditado escolhe o autor não é uma auditoria. `auth.uid()` e `now()` são do
--    servidor e não se discutem.
--
-- PORQUÊ
--
-- A regra antiga ("só se elimina um animal sem eventos nem crias") existia para
-- proteger o histórico da cascata do `delete`. Sem `delete` não há cascata, e a
-- regra deixa de ter o que proteger: o criador passa a poder tirar da lista um
-- animal que já não tem, sem que isso destrua o trabalho de ninguém, e sem que
-- a app tenha de lhe explicar porque é que o botão não funciona.
--
-- O que se perde é a limpeza física da linha. É de propósito: o que se pede a
-- esta app é saber o que aconteceu ao efetivo, e um registo apagado a sério não
-- responde a nada.
-- ==================================================================


-- ------------------------------------------------------------------
-- 1. Quem deu a saída, e quando
-- ------------------------------------------------------------------
alter table public.animal add column if not exists saida_por uuid references auth.users (id);
alter table public.animal add column if not exists saida_em timestamptz;

create index if not exists idx_animal_saida_por on public.animal (saida_por);


-- ------------------------------------------------------------------
-- 2. O trigger que as preenche
-- ------------------------------------------------------------------
-- Corre sempre que o estado MUDA. Voltar a ativar um animal limpa as duas
-- colunas: deixar lá o autor da saída anulada dava um registo de auditoria a
-- descrever uma coisa que já não é verdade.
create or replace function public.regista_saida_do_efetivo()
returns trigger language plpgsql security definer set search_path = 'public' as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.estado, 'ativo') <> 'ativo' then
      new.saida_por := auth.uid();
      new.saida_em := now();
    end if;
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if coalesce(new.estado, 'ativo') = 'ativo' then
      new.saida_por := null;
      new.saida_em := null;
    else
      -- `coalesce` com o valor antigo cobre o caso de um RPC `security definer`
      -- corrido sem sessão (scripts de manutenção): fica o autor anterior em
      -- vez de um nulo que apagaria a linha da auditoria.
      new.saida_por := coalesce(auth.uid(), old.saida_por);
      new.saida_em := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists animal_regista_saida on public.animal;
create trigger animal_regista_saida
  before insert or update on public.animal
  for each row execute function public.regista_saida_do_efetivo();


-- ------------------------------------------------------------------
-- 3. Eliminar passa a marcar, não a apagar
-- ------------------------------------------------------------------
-- Mantém-se o RPC como único caminho (o privilégio de DELETE continua retirado
-- ao papel `authenticated` pelo schema_eliminar.sql) e mantêm-se as duas
-- verificações de acesso, que o SECURITY DEFINER obriga a repetir à mão.
--
-- Desaparecem as condições "sem eventos" e "sem crias": eram a defesa contra a
-- cascata, e já não há cascata nenhuma.
create or replace function public.eliminar_animal(animal_id text)
returns void language plpgsql security definer set search_path = 'public' as $$
declare
  a public.animal%rowtype;
begin
  select * into a from public.animal where id = animal_id;
  if not found then
    raise exception 'Este animal já não existe.';
  end if;

  if not public.pode_escrever_em(a.exploracao_id) then
    raise exception 'A conta está suspensa, ou não tem acesso a esta exploração.';
  end if;

  -- `pode_cap` vem do schema_permissoes.sql e já cruza o papel com os ajustes
  -- por pessoa. É a mesma pergunta que a app faz antes de mostrar o botão.
  if not (public.pode_cap(a.exploracao_id, 'eliminarAnimais') or public.eh_superadmin()) then
    raise exception 'Não tem permissão para eliminar animais nesta exploração.';
  end if;

  update public.animal
     set estado = 'eliminado',
         -- A data da saída só se escreve se ainda não houver uma: um animal já
         -- marcado como vendido em maio e eliminado da lista hoje continua a
         -- ter saído em maio. O `saida_em` do trigger é que diz quando foi o
         -- gesto de eliminar.
         data_saida = coalesce(a.data_saida, to_char(now() at time zone 'UTC', 'YYYY-MM-DD')),
         terreno_id = null
   where id = a.id;
end;
$$;

revoke execute on function public.eliminar_animal(text) from anon, public;
grant  execute on function public.eliminar_animal(text) to authenticated;


-- ------------------------------------------------------------------
-- 4. Os nomes de quem trabalha comigo
-- ------------------------------------------------------------------
-- Uma auditoria que diz "eliminado por 3f2a-…-9c1" não é legível por ninguém.
-- Faltava o caminho para o NOME: a política `perfil_self_select` só deixa cada
-- um ver o seu perfil, e por isso o `select perfil(nome)` embutido que a app
-- fazia na lista de Trabalhadores devolvia vazio para toda a gente menos para o
-- próprio — a app mostrava a equipa inteira sem nomes e ninguém percebia porquê.
--
-- Isto abre exatamente o mínimo: o nome (nunca o email, o NIF ou o telefone) das
-- pessoas que partilham comigo pelo menos uma exploração. Quem não partilha
-- nenhuma continua invisível.
create or replace function public.nomes_da_equipa()
returns table (u_id uuid, u_nome text)
language sql security definer set search_path = 'public' stable as $$
  select distinct m.user_id, coalesce(nullif(btrim(p.nome), ''), 'Sem nome')
    from public.membro_exploracao m
    left join public.perfil p on p.id = m.user_id
   where m.exploracao_id in (
     select mm.exploracao_id from public.membro_exploracao mm where mm.user_id = auth.uid()
   );
$$;

revoke execute on function public.nomes_da_equipa() from anon, public;
grant  execute on function public.nomes_da_equipa() to authenticated;


-- ------------------------------------------------------------------
-- Colunas novas: a API tem de reler o schema
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';


-- ------------------------------------------------------------------
-- VERIFICAR
-- ------------------------------------------------------------------
-- 1. Eliminar um animal de teste deixa-o na base, marcado e com autor:
--
--   select public.eliminar_animal('<id>');
--   select id, estado, data_saida, saida_por, saida_em from public.animal
--    where id = '<id>';
--   -- estado = 'eliminado', saida_por = o meu user, saida_em = agora
--
-- 2. O histórico dele NÃO foi levado atrás (tem de continuar a devolver linhas
--    se o animal tinha eventos):
--
--   select count(*) from public.evento where animal_id = '<id>';
--
-- 3. Os nomes da equipa aparecem (uma linha por pessoa das minhas explorações):
--
--   select * from public.nomes_da_equipa();
