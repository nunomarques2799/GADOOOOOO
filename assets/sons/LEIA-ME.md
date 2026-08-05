# Sons dos avisos

Três ficheiros, um por tipo de aviso. São eles que tocam quando um registo fica
gravado, quando alguma coisa falha, e quando a app tem de dizer algo que **tem**
de ser lido. Quem os toca é [`src/data/som.ts`](../../src/data/som.ts), a partir
do mesmo sítio por onde passa a vibração (`data/toasts.tsx`).

| Ficheiro | Quando toca |
| --- | --- |
| `sucesso.wav` | Um registo ficou gravado: animal, medicação, despesa, receita, documento, terreno — tudo o que hoje mostra o cartão verde. |
| `erro.wav` | A gravação foi recusada (sem rede, sem permissão, campo em falta). |
| `aviso.wav` | Uma pergunta ou um aviso que interrompe (`avisar()`), como a confirmação de eliminar. |

## Trocar por outros

Substituir o ficheiro **pelo mesmo nome e com a mesma extensão** — não é preciso
mexer em código nenhum.

- **Formato**: `.wav`. Se o som que descarregar vier em `.mp3`, ou se converte,
  ou se mudam os três nomes na tabela `FICHEIRO` de `src/data/som.ts` (é a única
  linha que os menciona). O `.mp3` também toca; o `.wav` é que é o que lá está.
- **Duração**: curta, até meio segundo. Isto toca a cada gravação; um som de dois
  segundos numa importação de Excel com trinta linhas é um alarme.
- **Volume**: gravado já baixo. A app não lhe mexe — toca o ficheiro como ele é.

Os que aqui estão são tons gerados, de propósito neutros: servem para a coisa
funcionar de ponta a ponta enquanto não houver melhores.

## Onde se desliga

Perfil → Notificações e avisos → **Som ao gravar**. Como a vibração, a
preferência é do APARELHO e não da conta: o telemóvel no curral e o computador da
secretária não têm de fazer a mesma coisa.

## Aviso sobre a app instalada

O som usa o `expo-audio`, que é um módulo **nativo**. A app que já está instalada
no telemóvel foi construída antes dele existir, por isso só passa a ter som
depois de um `eas build` novo — um `eas update` (que só entrega JavaScript) não
chega. Até lá a app funciona na mesma, apenas calada; ver a nota no cabeçalho de
`src/data/som.ts`.
