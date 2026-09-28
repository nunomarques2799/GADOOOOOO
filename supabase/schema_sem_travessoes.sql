-- =====================================================================
-- Terrabovina · sem travessões no que as pessoas leem (41.º)
-- =====================================================================
-- O travessão (—) não entra em texto que alguém leia: é o sinal mais
-- reconhecível de texto escrito por IA. A app já não tinha nenhum no código,
-- mas continuavam a aparecer por DOIS caminhos que não passam por ele:
--
--   1. FUNÇÕES do servidor com texto dentro: a recusa do apoio por excesso de
--      mensagens (que a app mostra tal como vem) e os assuntos dos emails de
--      registo e de apoio. Os ficheiros de origem (16.º e 19.º) já foram
--      corrigidos; aqui corrige-se a cópia que JÁ ESTÁ na base.
--
--   2. DADOS gravados por versões antigas ou por scripts: descrições que a app
--      gerava em julho ("Parto normal — 1 cria") e as dos dados de teste
--      ("Vacina — Língua azul", "Ração — 40 sacos"). Passam ao formato que a
--      app gera hoje ("Vacina: Língua azul", ver `evento/novo.tsx`).
--
-- Só se mexe no que a APP ou os SCRIPTS escreveram, reconhecido pelo começo do
-- texto. O que uma pessoa escreveu à mão fica como ela o escreveu, com ou sem
-- travessão: corrigir o texto de alguém não é trabalho de uma migração.
--
-- Porque é que as funções não se reescrevem aqui por inteiro: o `schema_lint`
-- (33.º) e outros ficheiros posteriores mexeram nelas depois de nascerem
-- (`search_path`, quem as pode executar). Colar aqui a versão do 19.º desfazia
-- esses acertos em silêncio. Em vez disso lê-se a definição que está na base
-- (`pg_get_functiondef`), troca-se SÓ o texto, e volta a gravar-se: o
-- `create or replace` guarda o dono, os privilégios e o `security definer`.
--
-- Os gatilhos: o `toca_updated_at` avança a versão das linhas corrigidas (é o
-- que faz os aparelhos trazerem o texto novo na sincronização seguinte), e o
-- registo de atividade não escreve nada, porque sem sessão não há autor (ver
-- `schema_atividade.sql`). O histórico de ninguém fica com linhas que não fez.
--
-- Idempotente: correr outra vez não encontra nada para trocar.
-- Depende de: 16 (notificar_registo_pendente), 19 (enviar_mensagem_apoio),
-- 7 (updated_at), 8 (movimento), 18 (o registo de atividade que se cala).
-- =====================================================================

-- ---- 1. O texto dentro das funções -----------------------------------
do $$
declare
  f   regprocedure;
  def text;
  novo text;
begin
  foreach f in array array[
    'public.enviar_mensagem_apoio(text, text, text, text)'::regprocedure,
    'public.notificar_registo_pendente()'::regprocedure,
    'public.testar_notificacao_registo()'::regprocedure
  ] loop
    def := pg_get_functiondef(f);
    novo := replace(def, 'Aguarde um pouco ' || chr(8212) || ' vamos', 'Aguarde um pouco: vamos');
    novo := replace(novo, '''Terrabovina ' || chr(8212) || ' ', '''Terrabovina · ');
    if novo is distinct from def then
      execute novo;
      raise notice 'corrigida: %', f;
    end if;
  end loop;
end $$;

-- ---- 2. Os dados que a app e os scripts escreveram -------------------
-- Vacinas e medicamentos: "Vacina — X" passa a "Vacina: X", como hoje.
update public.evento
   set descricao = regexp_replace(descricao, '^(Vacina|Medicamento) ' || chr(8212) || ' ', '\1: ')
 where descricao ~ ('^(Vacina|Medicamento) ' || chr(8212) || ' ');

-- Partos: "Parto normal — 1 cria" passa a "Parto normal, 1 cria".
update public.evento
   set descricao = regexp_replace(descricao, '^(Parto [^' || chr(8212) || ']*?) ' || chr(8212) || ' ', '\1, ')
 where descricao ~ ('^Parto [^' || chr(8212) || ']* ' || chr(8212) || ' ');

-- Movimentos dos dados de teste: "Ração — 40 sacos", "Venda — feira de Idanha".
update public.movimento
   set descricao = regexp_replace(descricao, '^(Ração|Venda) ' || chr(8212) || ' ', '\1: ')
 where descricao ~ ('^(Ração|Venda) ' || chr(8212) || ' ');

notify pgrst, 'reload schema';
