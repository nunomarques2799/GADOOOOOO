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
`drop … if exists` antes de recriar), portanto correr de novo é seguro.

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

Dependências a negrito são as que **partem em silêncio** se forem ignoradas:

- **5 depende de 4.** O apagamento de conta assenta nas foreign keys com
  `on delete cascade` que só existem a partir do `schema_seguranca.sql`. Sem
  elas, apagar a conta remove a exploração e deixa terrenos, animais e eventos
  órfãos na base — ou seja, os dados pessoais **não** ficam realmente apagados,
  e a app diz que sim. É um problema de RGPD, não de arrumação.
- **8 depende de 7.** As finanças escrevem com deteção de conflitos.
- **10 depende de 8.** Não há como tornar opcional uma tabela que não existe.
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

Isso gera `supabase/_completo.sql` com os 12 ficheiros pela ordem certa. Colar
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
