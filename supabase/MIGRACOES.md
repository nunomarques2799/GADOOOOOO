# Schema Supabase — ordem de aplicação

Os ficheiros `schema*.sql` desta pasta **não são independentes**: cada um assume
que os anteriores já correram. Aplicados por outra ordem, uns falham com "relation
does not exist" e — pior — outros correm até ao fim deixando políticas de RLS a
apontar para colunas que ainda não existem. Uma base assim parece boa e não é.

Até 2026-07-22 esta ordem não estava escrita em lado nenhum: vivia na cabeça de
quem foi colando os ficheiros no SQL Editor, por ordem de criação. Isso chega
enquanto só há uma base de dados. Deixa de chegar no momento em que é preciso
**recriar o sistema do zero** — que é exatamente o que um ambiente de dev é.

## A ordem

Aplicar de cima para baixo. Todos são idempotentes (`if not exists`,
`drop … if exists` antes de recriar), portanto correr a SEQUÊNCIA de novo é
seguro.

> **Correr o 1.º sozinho por cima de uma base que já anda NÃO é seguro.** O
> `schema.sql` recria as políticas da era de utilizador único (`perfil_self`,
> `exploracao_owner`, … — `for all`, guiadas só pelo `user_id`), e as políticas
> de um comando somam-se por OR: as novas continuam lá e deixam de decidir
> nada, porque basta uma dizer que sim. Ninguém vê erro nenhum — a app funciona,
> e o isolamento entre clientes é que deixou de existir. Se for preciso mexer no
> 1.º, corre-se a sequência INTEIRA a seguir (é o que o `_completo.sql` faz),
> nunca só ele. Achado da auditoria de 2026-07-18.

| # | Ficheiro | O que traz | Depende de |
| --- | --- | --- | --- |
| 1 | `schema.sql` | Tabelas base: perfil, exploração, terreno, animal, evento. RLS por `user_id`. | — |
| 2 | `schema_roles.sql` | Hierarquia superadmin → cliente → trabalhador/veterinário. | 1 |
| 3 | `schema_superadmin.sql` | Painel comercial: RPCs `security definer`, subscrições, métricas. | 1, 2 |
| 4 | `schema_seguranca.sql` | Correções de fuga de dados e as **foreign keys `on delete cascade`**. | 1, 2, 3 |
| 5 | `schema_rgpd.sql` | Direito ao apagamento (apagar conta + dados). | 1, 2, 3, **4** |
| 6 | `schema_suspensao.sql` | Suspensão que suspende mesmo (escrita bloqueada, não só o perfil). | 1, 2, 3, 4 |
| 7 | `schema_versoes.sql` | `updated_at` por linha, para deteção de conflitos. | anteriores |
| 8 | `schema_financas.sql` | `evento.valor` e a tabela `movimento`. | 1, 2, **7** |
| 9 | `schema_eliminar.sql` | Só se elimina animal sem eventos nem crias. | anteriores |
| 10 | `schema_financas_opcional.sql` | Finanças passam a opt-in por cliente. | **8** |
| 11 | `schema_animal_campos.sql` | Casa/número e finalidade do animal; opt-in da casa. | **10** |
| 12 | `schema_notas.sql` | Notas pessoais (tabela `nota`, por utilizador). | 1 |
| 13 | `schema_permissoes.sql` | Permissões por pessoa (coluna `permissoes`) e as políticas de escrita a passarem por `pode_cap()`. | 1, 2, **6**, **9**, **10** |
| 14 | `schema_auditoria.sql` | Eliminar marca em vez de apagar; `saida_por`/`saida_em` por trigger; `nomes_da_equipa()`. | 1, 2, **9**, **13** |
| 15 | `schema_acesso_temporario.sql` | `membro_exploracao.expira_em`; o veterinário entra por um prazo e sai sozinho. | 2, 6, **13** |
| 16 | `schema_notificacao_registo.sql` | Email ao superadmin quando alguém cria conta (trigger + `pg_net` + Resend). | 1, 2 |
| 17 | `schema_acesso_ate.sql` | O convite pode terminar num dia e hora à escolha (`convite.acesso_ate`), e não só ao fim de N horas. | **15** |
| 18 | `schema_atividade.sql` | `registo_atividade`: quem alterou o quê e quando, por trigger em animal/evento/terreno/movimento. | 1, 2, 13, 14, **15** |
| 19 | `schema_apoio.sql` | Escrever ao apoio e reportar problemas de dentro da app; o motor de envio muda para o schema `interno`. | **16** |
| 20 | `schema_papel_veterinario.sql` | `registarTratamentos` separada de `editarAnimais`; o veterinário deixa de mexer em fichas, terrenos e saídas; contas convidadas não criam explorações. | 2, **13**, 15 |
| 21 | `schema_fotos_localizacao.sql` | `terreno.fotografia` e `exploracao.latitude`/`longitude`: foto do sítio e sede marcada no mapa. | 1 |
| 22 | `schema_convite_por_papel.sql` | Um código de trabalhador deixa de servir a uma conta de veterinário (e vice-versa): o `resgatar_convite` confere o papel do código com o que a conta disse ser. | **17** |
| 23 | `schema_agenda.sql` | `evento_agenda`: os eventos que as pessoas marcam (dia, hora opcional, público ou privado). O veterinário não tem agenda. | 1, 2, **20** |
| 24 | `schema_documentos.sql` | `documento` + o bucket privado `documentos`: guardar faturas e papéis na exploração, por categoria. O veterinário não os vê. | 1, 2, **20** |
| 25 | `schema_equipa_e_foto.sql` | `superadmin_membros_exploracao()` (quem trabalha em cada exploração) e `perfil.fotografia`. | 3, **15** |
| 26 | `schema_documento_visibilidade.sql` | `documento.publico`: cada papel nasce à escolha, e o privado é fechado na tabela **e no bucket**. | **24** |
| 27 | `schema_historico_equipa.sql` | `equipa_historico`: quem saiu da equipa, com que papel, quando entrou e quem o tirou. Escrito por gatilho no `delete` de `membro_exploracao`. | 2, 14, **15** |
| 28 | `schema_snira.sql` | `evento.comunicado_snira`/`comunicado_em`: marcar o que já foi comunicado ao SNIRA (mortes e saídas, a par do nascimento que o animal já tinha). | 1, **20** |
| 29 | `schema_reproducao.sql` | `evento.resultado` (gestante/vazia/duvidoso). Os tipos `Cobrição` e `Diagnóstico` não precisam de schema — `evento.tipo` é texto livre. | **28** |
| 30 | `schema_medicamentos.sql` | Tabela `medicamento` (um lote comprado por linha) e `evento.medicamento_id`/`quantidade`. Existências = comprado − aplicado, calculado e não guardado. | 1, 2, **13**, 29 |
| 31 | `schema_privilegios.sql` | Tira ao `anon`/`authenticated` o `TRUNCATE`, `TRIGGER` e `REFERENCES` que as omissões do Supabase dão a cada tabela nova. O `truncate` **não passa por RLS**. Mexe também nas omissões, para as tabelas seguintes. | **todos os que criam tabelas** |
| 32 | `schema_convite_seguro.sql` | Códigos de convite de `gen_random_bytes` (o `random()` não é criptográfico) e travão de 10 tentativas falhadas por conta em 15 min. O `resgatar_convite` passa a devolver `{"erro": …}` em vez de rebentar — ver abaixo. | **17**, **22** |
| 33 | `schema_lint.sql` | Fecha os avisos do linter: `search_path` fixo e quem pode executar cada função `security definer`. Tem a lista das que ficam FECHADAS mesmo a quem tem sessão. **Reescrito a 2026-08-07**: o `apagar_a_minha_conta()` saiu dessa lista, porque a app passou a ter o botão de apagar a conta. Nas bases que já correram a versão anterior é preciso **correr o ficheiro outra vez** — senão o botão dá «permission denied for function» a quem o tocar, e nada no resto do `estado.sql` avisa. | **todos** |

Dependências a negrito são as que **partem em silêncio** se forem ignoradas:

- **5 depende de 4.** O apagamento de conta assenta nas foreign keys com
  `on delete cascade` que só existem a partir do `schema_seguranca.sql`. Sem
  elas, apagar a conta remove a exploração e deixa terrenos, animais e eventos
  órfãos na base — ou seja, os dados pessoais **não** ficam realmente apagados,
  e a app diz que sim. É um problema de RGPD, não de arrumação.
- **8 depende de 7.** As finanças escrevem com deteção de conflitos.
- **10 depende de 8.** Não há como tornar opcional uma tabela que não existe.
- **13 depende de 6, 9 e 10.** O 13 **reescreve** as políticas de escrita de
  terreno/animal/evento (que vêm do 6), o RPC `eliminar_animal` (do 9) e as
  políticas de `movimento` (na versão mais recente, que é a do 10). Aplicado
  antes de qualquer um deles, é esse que fica por cima — e as permissões por
  pessoa passam a existir na coluna sem nenhuma política as ler. A app esconde os
  botões, o servidor aceita tudo, e nada no SQL indica que falta um passo.
- **14 depende de 9 e 13.** O 14 reescreve o RPC `eliminar_animal` (que nasce no
  9) e usa o `pode_cap()` do 13 para decidir quem pode eliminar. Aplicado antes
  do 9, é o 9 que fica por cima e o eliminar volta a apagar a linha de vez, sem
  auditoria nenhuma e sem nada no SQL a indicá-lo.
- **15 depende de 13.** O 15 reescreve `pode_cap()` (do 13) para o prazo de
  acesso também travar a ESCRITA. Aplicado antes do 13, é o 13 que fica por
  cima: a leitura fecha na hora certa e a escrita continua aberta — um
  veterinário fora do prazo deixa de ver a exploração e continua a poder gravar
  nela às cegas. Reescreve também `membro_de()`, `role_em()`,
  `criar_convite()` e `resgatar_convite()`, todos do 2.
- **17 depende de 15.** Reescreve `criar_convite()` e `resgatar_convite()`, que
  são do 15. Aplicado antes dele, é o 15 que fica por cima e a hora marcada no
  convite passa a ser uma coluna que ninguém lê: o dono escolhe "até quinta às
  18h", o veterinário resgata e fica com acesso sem prazo nenhum. Nada falha à
  vista — só o prazo é que não existe.
- **18 depende de 15.** A política de leitura do registo usa o `role_em()` com
  a condição do prazo (do 15). Com o `role_em()` do 2, um veterinário cujo
  acesso terminou continuava a poder ler o registo de atividade da exploração.
- **19 depende de 16.** Ele **move** o corpo de `enviar_email_notificacao` para
  `interno.enviar_email` e deixa em `public` só a casca com a verificação.
  Aplicado antes do 16, é o 16 que fica por cima e repõe a versão antiga: o
  aviso de registo continua a funcionar, e o formulário de apoio da app passa a
  rebentar com "esta função só é chamada por dentro da base de dados" — porque
  o `interno.enviar_email` que ele chama existe, mas a `public` que o 19 tinha
  reescrito já não. Precisa da mesma PREPARAÇÃO do 16 (`pg_net` + chave no
  Vault) e de nada mais.
- **20 depende de 13.** Ele reescreve `capacidade_gerivel()` e
  `role_padrao_pode()` (do 13) e as três políticas de `evento`. Aplicado antes
  do 13, é o 13 que fica por cima e o `registarTratamentos` passa a ser uma
  capacidade que a app pede e que o servidor não conhece: `role_padrao_pode`
  devolve `false` para ela, e o veterinário — que já perdeu o `editarAnimais` no
  lado da app — fica sem conseguir registar tratamento nenhum. A app mostra os
  botões (a tabela dela diz que pode) e cada gravação bate contra a RLS.
- **32 depende de 17 e 22.** Reescreve o `criar_convite()` (que é do 17) e o
  `resgatar_convite()` (que é do 22). Aplicado antes deles, são eles que ficam
  por cima: os códigos voltam a sair do `random()` e o travão às tentativas
  desaparece sem deixar rasto — a tabela `convite_tentativa` fica lá, vazia para
  sempre, a parecer um travão que existe.
  **E não é só SQL:** ele muda o CONTRATO do `resgatar_convite`, que passa a
  devolver `{"erro": …}` em vez de levantar exceção (a razão está no cabeçalho
  do ficheiro — uma exceção apagava o registo da tentativa que a acabava de
  contar). O `data/membros.tsx` lê os dois caminhos de propósito, por isso
  aplicar ou não aplicar nunca deixa a app partida; o que fica por existir, se
  não se aplicar, é o travão.
- **33 depende de todos, e é por isso que é o último.** O que ele faz é decidir
  quem pode executar cada função `security definer` da base. Se correr a meio,
  as funções que os ficheiros seguintes criarem nascem com o `EXECUTE` que o
  Postgres dá ao PUBLIC — que inclui o `anon`, ou seja, gente sem sessão
  iniciada. Foi exatamente isso que aconteceu com o 4.º (que fazia esta mesma
  limpeza) e deixou cinco funções dos ficheiros 10, 11 e 14 abertas ao `anon`
  em produção durante meses, sem um único erro à vista. **Um ficheiro novo
  entra sempre antes deste, e o `schema_lint.sql` volta a correr a seguir.**
- **16 não é só SQL.** O envio de email precisa da extensão `pg_net` ligada e
  da chave da API guardada no Vault — os dois passos estão no cabeçalho do
  ficheiro. Sem eles o schema aplica-se na mesma e o trigger cria-se: o que
  acontece é que cada registo fica com uma linha de erro em
  `public.notificacao_envio` e email nenhum. Confirmar sempre com
  `select public.testar_notificacao_registo();` depois de aplicar.
  Reparar também que a função de envio **não** se defende por permissões, e sim
  por uma verificação lá dentro — precisamente porque o 33 (o linter) lhe
  devolveria o `execute` a `authenticated` a seguir.
- **27 depende de 15, e é por isso que fica no fim (tirando o linter).** A
  política de leitura do histórico usa o `role_em()` com a condição do prazo (do
  15). Com o `role_em()` do 2, um veterinário cujo acesso já caiu continuava a
  poder ver quem entrou e saiu da equipa daquela exploração. Ele guarda também
  o NOME de quem sai, e é o único sítio da base onde um nome fica copiado fora
  do `perfil` — daí trazer o gatilho que o limpa quando a conta é apagada.
- **11 depende de 10.** Ambos substituem o trigger `handle_new_exploracao`. O
  11 reescreve-o a herdar as DUAS opções (finanças e casa); aplicá-lo antes do
  10 fazia o 10 sobrepor-se-lhe e as explorações novas nasciam sem a casa
  herdada — sem erro nenhum, só um campo que não aparecia.

> A ordem não é a alfabética nem a do explorador de ficheiros. É esta.

> A lista acima tem uma cópia legível por máquinas em [`ordem.txt`](ordem.txt),
> que é de onde os scripts a leem. Ao acrescentar um ficheiro, atualizar os dois.

## Aplicar numa base vazia (ambiente novo)

```bash
powershell scripts/gerar-schema-completo.ps1
```

Isso gera `supabase/_completo.sql` com os ficheiros do `ordem.txt` pela ordem
certa (são 28 à data desta linha, mas quem manda é o `ordem.txt`). Colar
**tudo de uma vez** no *SQL Editor* → *Run*.

Colar tudo junto é mais seguro do que ficheiro a ficheiro, ao contrário do que
parece: o Postgres corre um lote enviado de uma vez como **uma transação
implícita** — se algo falhar a meio, faz rollback e a base fica intacta. Dez
colagens são dez transações, e falhar na sexta deixa a base num estado que não
corresponde a versão nenhuma do código.

Isto depende de nenhum ficheiro usar `create index concurrently`, `alter type …
add value` ou `begin`/`commit` próprios — comandos que não podem viver dentro
de uma transação. Hoje nenhum usa. Se algum passar a usar, tem de ser aplicado
sozinho, e o script deixa de servir para ele.

O script também recusa gerar se encontrar um `schema*.sql` na pasta que não
esteja no `ordem.txt` — que é o erro que faz um ambiente novo nascer sem uma
funcionalidade inteira, e só dar sinal semanas depois.

## Aplicar uma alteração nova (o dia a dia)

**Regra: dev primeiro, produção depois — e nunca no mesmo dia sem dormir sobre o
assunto.** Ver [`../AMBIENTES.md`](../AMBIENTES.md).

1. Escrever o `schema_*.sql` novo, idempotente, com cabeçalho a dizer de que
   ficheiros depende (é o que mantém esta tabela possível de reconstruir).
2. Aplicar **no projeto de dev**. Testar a app contra ele.
3. **Backup de produção**: `powershell scripts/backup.ps1 -Ambiente prod`.
4. Só então aplicar em produção.
5. Acrescentar a linha nova a esta tabela, com as dependências.

Um ficheiro que acrescente **colunas** deve terminar com `notify pgrst, 'reload
schema';`. A API do Supabase serve-se de uma cópia em memória do schema, e
enquanto ela estiver velha a app recebe `Could not find the 'x' column of 'y'
in the schema cache` — o erro diz "não existe", a coluna existe, e não há nada
no SQL que sugira onde procurar.

## Quando a base está feita e a app dá erro à mesma

[`reparar.sql`](reparar.sql) — não é schema (não entra no `ordem.txt`), são as
correções ao *estado* dos dados: perfis em falta, contas por aprovar que não
conseguem criar explorações, e o recarregar da cache acima. Começa pelo bloco
de diagnóstico.

## Porque não `supabase db push` / migrations da CLI

A CLI do Supabase tem migrations versionadas a sério (`supabase/migrations/`,
com `db push` e `db diff`). É melhor do que colar SQL à mão, e vale a pena mudar
quando houver mais do que um utilizador real.

Hoje não se muda por uma razão prática: a conversão obrigaria a reordenar e
renomear os 10 ficheiros e a marcar a base de produção como já migrada
(`db pull` para gerar a baseline). Qualquer engano nesse passo mexe na base de
uma pessoa que está a usar a app agora, para não ganhar nada que esta tabela e o
script de backup não deem. A ordem escrita resolve 90% do risco por 1% do custo.
