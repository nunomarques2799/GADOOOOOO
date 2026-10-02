# Design System — Terrabovina

Fonte de verdade do design da app. Desde **2026-10-02** segue o guia de estilo
**"Terrabovina, novo estilo"** (o PDF na pasta `Gado/`): oliveira, creme e
areia, títulos em Fraunces, cartões de cantos largos e quase sem sombra. Os
**princípios do README** continuam acima do guia: simplicidade absoluta para o
utilizador de 82 anos, fontes e botões grandes, alto contraste, estética
rural/de confiança. Onde os dois chocaram (o ocre do guia não se lê como
letra), ganhou o contraste, e está explicado abaixo.

Implementação: [`src/theme/tokens.ts`](src/theme/tokens.ts). Importa sempre via
`@/theme` — nunca uses hex soltos nos componentes.

---

## Marca

O logótipo (cabeça de vaca e duas espigas douradas num círculo de oliveira) só
existia em imagem, no guia. Foi redesenhado em vetor e os mestres estão em
[`assets/marca/`](assets/marca):

| Ficheiro | O que é | De onde saem |
|---|---|---|
| `terrabovina-logo.svg` | O logótipo inteiro, com o círculo | `assets/images/logo-terrabovina.png` (600px, o `<Logotipo>`), `desktop/build/icon.*`, `public/icons/*`, `website/assets/logo.svg` |
| `terrabovina-simbolo.svg` | Sem o círculo de fundo | Ícone do iPhone (`assets/expo.icon/`, o fundo de oliveira vem do `icon.json`) e primeiro plano do ícone adaptativo do Android |
| `terrabovina-favicon.svg` | Só a cabeça, ampliada | Favicon (a 16px as espigas eram ruído) |
| `terrabovina-monocromo.svg` | Silhueta vazada | Ícone temático do Android 13+, que o sistema pinta |

Na app o logótipo é o componente `<Logotipo tamanho={…} />`
(`src/components/Logotipo.tsx`), em PNG através do `expo-image`: a app não
tem `react-native-svg`, e um módulo nativo novo só por um desenho obrigava a
um build. O PNG de 600px chega até 300 pontos num ecrã 2×.

Mudar o logo é mudar o SVG mestre e voltar a gerar os PNG de todos os
tamanhos; um ícone novo no iPhone ou no Android **só chega com um build
nativo** (`eas build`), não com um `eas update`.

---

## Cor

Ancorada na **oliveira** sobre **creme** (o campo e o papel de um caderno de
exploração), com terracota, ocre e verde-azulado para o que quer dizer alguma
coisa.

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#3A4A2C` | Botões, marca, separador ativo, o "hoje" do calendário |
| `primaryDark` / `primaryDarker` | `#2B3621` / `#22281A` | Letra sobre tinte, iniciais dos retratos |
| `primaryTint` / `primaryTintStrong` | `#E2E5D3` / `#D5D9C2` | Pastilha do separador ativo, botão secundário |
| `onPrimary` | `#FBF7F0` | Letra sobre oliveira |
| `background` | `#F3EBDD` | Creme: o fundo dos ecrãs |
| `surface` / `surfaceAlt` / `surfaceSunken` | `#FBF7F0` / `#E8DCC8` / `#ECE3D3` | Cartões / areia (retratos, pastilhas) / premido |
| `text` / `textSecondary` / `textMuted` | `#22281A` / `#5B604D` / `#5D624E` | Tinta, apoio e metadados (todos acima de 4,5:1 no creme) |
| `border` / `borderStrong` | `#E3D8C5` / `#CFC2AC` | Riscas e contornos de cartão / de campos |

**Cor funcional** (fixa, nunca só cor — sempre com ícone + texto). Três delas
têm **dois tons**: o de LETRA, que é o seguro, e o `*Vivo` do guia, só para
pontos, barras e preenchimentos sem nada escrito por cima. O ocre do guia dá
2:1 sobre o creme; como letra não se lê.

| Token | Letra | `*Vivo` | `*Tint` | Significado |
|---|---|---|---|---|
| `danger` | `#9E4B2A` | `#C0613A` | `#F4DDD3` | Urgente: prazos legais, brinco, SNIRA |
| `warning` | `#875D17` | `#DDA54A` | `#F6E5C5` | Reprodução, "esta semana" |
| `saude` | `#3F6B5C` | `#4F7A6B` | `#DCE8E2` | Vacinas e tratamentos |
| `info` | `#3D6583` | | `#DCE6EE` | Meteorologia, informação |
| `success` | `#4E6B37` | | `#E3E9D9` | Em dia, confirmações |
| `femea` / `macho` | `#983F55` / `#3D6583` | | `#F4DDE3` / `#DCE6EE` | Etiqueta do sexo (com a palavra lá dentro) |

`onDanger` (`#FFFFFF`) é a letra sobre um botão ou contador de perigo. Numa
paleta **escura** (a Noite) a letra destas cores passa a clara e os tintes a
escuros (`fixasEscuras` em `tokens.ts`), senão um prazo legal ficava a 2,7:1;
os `*Vivo` não mudam. Cores por espécie (`bovino`, `ovino`, `caprino`,
`suino`, `equideo`) para ícones e chips.

### Paletas à escolha do criador

A oliveira é a paleta **de origem** (`terrabovina`), não a única. O verde com
que a app nasceu continua lá, como **`campo`**. Em *Definições → Cores da app*
o criador escolhe entre umas vinte (`terra`, `ceu`, `ardosia`, `contraste` para
visão reduzida, `noite` de fundo escuro…). Definição em
[`src/theme/paletas.ts`](src/theme/paletas.ts). A escolha fica na CONTA: quem
nunca escolheu passou a ver a oliveira a 2026-10-02, quem escolheu uma fica
com a sua.

**O que muda:** marca (`primary*`, `headerFrom/To`, `onPrimary`), superfícies
(`background`, `surface*`), texto (`text*`, exceto `textOnDark*`), linhas
(`border*`) e o `overlay`.

**O que não muda:** a cor funcional da tabela acima, as cores por espécie, as do
sexo e a faixa do ambiente de testes. São linguagem, não decoração — um
vermelho de prazo vencido que num telemóvel fosse castanho deixava de se
reconhecer de relance.

Cada paleta é verificada por teste (`src/theme/__tests__/paletas.test.ts`)
contra os mínimos WCAG AA — AAA no texto corrido. Uma paleta nova que não passe
não entra.

> **Regra:** ler `colors` **só dentro do render**. As cores vivem num objeto que
> é reescrito no arranque; uma constante no topo de um módulo copia o valor
> antes disso e fica com a cor de origem para sempre (foi o que deixou o botão
> "Entrar" verde numa app azul). Para tabelas em módulo, usa getters:
> `get cor() { return colors.primary; }`. O
> `node scripts/cores-no-arranque.js` procura este erro no projeto todo e corre
> na CI.

Mudar de paleta **recarrega a app** — os ecrãs já desenhados guardaram as cores
antigas nos seus estilos e o React Compiler memoiza-os.

---

## Tipografia — Fraunces, Atkinson Hyperlegible Next e IBM Plex Mono

Três famílias, cada uma com o seu trabalho:

- **Fraunces** nos títulos (`display`, `h1`, `h2`): uma serifa de cantos
  suaves (eixo SOFT a 100), que dá à app o ar de caderno de exploração do
  guia. Vem em duas instâncias fixas, ótica 34 para os títulos grandes e 20
  para os de secção, tiradas do Google Fonts: o React Native não mexe nos
  eixos de uma letra variável.
- **Atkinson Hyperlegible Next** em todo o resto: foi desenhada para baixa
  visão, e distingue `I`, `l` e `1`, ou `0` e `O`, que é o que um brinco
  precisa. Não tem ExtraBold: `fontFamily.extrabold` aponta para o Bold.
- **IBM Plex Mono** no que se lê dígito a dígito: brincos, lotes, prazos
  ("6 dias", "Em atraso").

Corpo **grande** (17–18px) para o utilizador-alvo. As fontes são ficheiros em
`assets/fontes/` (cada família com a sua licença OFL ao lado), carregados no
`src/app/_layout.tsx`, e **não** os módulos de pacotes npm: o Cloudflare não
publica nada de dentro de `node_modules` (ver `AGENTS.md`).

| Variante | Família / Tamanho | Uso |
|---|---|---|
| `display` | Fraunces 34/40 | Saudação, título do ecrã |
| `h1` | Fraunces 28/34 | Nome do animal, títulos grandes |
| `h2` | Fraunces (ótica 20) 21/27 | Títulos de secção |
| `h3` | Atkinson Bold 18/24 | Nomes nas listas, títulos de cartão |
| `bodyLg` / `body` | Atkinson Regular 18 / 17 | Corpo |
| `bodyStrong` | Atkinson Bold 17 | Valores, destaques |
| `secondary` | Atkinson Regular 15/21 | Texto de apoio |
| `label` | Atkinson Bold 15 | Ações em texto, chips |
| `caption` | Atkinson Medium 13/18 | Metadados, rótulos da barra |
| `rotulo` | Atkinson Bold 13, maiúsculas | "REPRODUÇÃO", dias da semana |
| `mono` | Plex Mono Medium 15/21 | Brincos, lotes, prazos |
| `button` | Atkinson Bold 18 | Botões |

Acesso via componente `<Text variant="…">` que respeita o dimensionamento do
sistema (Dynamic Type), até ao teto de cada variante em `maxFontScale`.

---

## Espaçamento, raios e tamanhos

- **Espaçamento** — escala base-4: `xxs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · xxl 32 · xxxl 40 · huge 56`.
- **Raios** — `sm 10 · md 14 (campos) · botao 16 · lg 20 (cartões) · xl 28 (folhas) · pill 999`.
- **Alvos de toque** — `touchMin 48`, `button 56`, `input 58` (README: botões grandes).
- **Sombras** — leves e da cor da tinta (`sm/md/lg/raised`). A sombra é para
  o que FLUTUA (o Registar da barra, folhas, avisos); botões, cartões e a barra
  de baixo são planos, com uma risca.
- **Animação** — ver `components/ui/movimento.ts` e o `AGENTS.md`.
- **Ecrã estreito** — `useEstreito()` (`src/hooks/useEstreito.ts`) é `true`
  quando a largura a dividir pela escala da letra fica abaixo de 340: um
  telemóvel pequeno ou a letra do sistema no máximo. É ele que parte o
  cabeçalho do Início em duas linhas, põe a ficha em coluna e encolhe as
  linhas da lista de animais. Testar a 258px.

---

## Telemóvel vs. desktop

A app tem **dois desenhos**, escolhidos pela largura da janela — não é o desenho
de telemóvel esticado. O interruptor é `useDesktop()` (`src/hooks/useDesktop.ts`):
`true` só na web/Electron com janela ≥ `900px`. No nativo é sempre `false`.

|                | Telemóvel (e web estreita)              | Desktop (≥ 900px)                                    |
| -------------- | --------------------------------------- | ---------------------------------------------------- |
| Navegação      | Barra de separadores em baixo (polegar) | Barra lateral fixa à esquerda, 248px, com etiquetas  |
| Largura        | Ecrã todo; na web, coluna de 560px      | Janela toda, conteúdo até `layout.conteudoDesktop`   |
| Início         | Secções empilhadas                      | Duas colunas: ação à esquerda, números/atalhos à dir. |
| Listas         | Um cartão por linha                     | Grelha de 2 colunas (`numColumns`)                    |
| Perfil / login | Ecrã todo                               | Coluna única centrada (`conteudoEstreito` / 560px)    |

Larguras em `layout` (`src/theme/tokens.ts`): `colunaMobile 560 ·
conteudoEstreito 760 · conteudoDesktop 1180 · barraLateral 248`.

Ao criar um ecrã novo: se usa `<Screen>`, a coluna de desktop já vem tratada.
Se monta o seu próprio `ScrollView`/`FlatList`, aplica ao `contentContainerStyle`
`width: '100%'`, `maxWidth` (do `layout`) e `alignSelf: 'center'`.

---

## Ícones

Set **único**: `MaterialCommunityIcons` (via `@expo/vector-icons`), acedido pelo
wrapper `<Icon name="…" />`. Cobre tanto a UI genérica como o domínio pecuário
(`cow`, `sheep`, `barn`, `grass`, `tag`, `needle`, `medical-bag`…). Nunca emojis.
Um só set garante consistência de traço e estilo.

---

## Inventário de componentes

`src/components/ui/` (primitivas): `Text · Icon · Screen · Card · Button ·
Badge · Chip · IconBadge · SectionHeader · FAB · Avatar · EmptyState · Header`.

`src/components/` (domínio): `Logotipo · WeatherCard · AlertItem · AnimalRow ·
ExploracaoRow · StatCard · QuickAction · AnfitriaoToasts · AnfitriaoAvisos ·
FolhaPermissoes`.

O retrato de um animal é o `RetratoAnimal` (em `AnimalRow.tsx`): a fotografia,
ou a inicial do nome em Fraunces sobre areia, ou, sem nome, o desenho da
espécie. É o mesmo na lista e na ficha, e é por isso que pode voar de uma
para a outra. A `Badge` tem os tons da cor funcional (`saude`, `femea`,
`macho`…) e o `cheia` para os contadores ("3 urgentes").

### Dizer que correu bem (ou mal)

Três registos, e a escolha entre eles não é de gosto:

| O quê | Quando | Como |
| --- | --- | --- |
| **Toast** (`useToasts()`) | Confirmar o que o criador acabou de fazer, e as falhas de que ele se pode simplesmente esquecer. | Aparece em baixo, some sozinho, não pede nada. |
| **`avisar()`** (`data/avisos.ts`) | O que ele **tem** de ler antes de continuar: uma lista de animais que ficaram por gravar, um texto que se perde sem ligação. | Interrompe e exige "Entendido". |
| **`confirmar()`** (`data/avisos.ts`) | Perguntar antes de uma ação sem volta: eliminar um animal, terminar sessão com alterações por enviar. | Interrompe, com o botão destrutivo a vermelho e o "Cancelar" primeiro. |
| **Linha no formulário** | A razão de uma gravação recusada, enquanto ele corrige os campos. | Fica no ecrã até mudar algo. |

Um erro de gravação num formulário leva os dois últimos: o toast chama a atenção
de quem já ia a sair, a linha fica para se ler com calma. Confirmações que
interrompem ensinam a tocar em "OK" sem ler — e isso estraga também os avisos a
sério.

Os dois do meio são desenhados pela app (`components/AnfitriaoAvisos.tsx`,
montado uma vez na raiz), e não pelo sistema. Os diálogos do sistema —
`window.confirm` no computador — apareciam numa barra agarrada ao topo da
janela, com o tipo de letra do navegador e um "localhost diz" por cima da
pergunta: a coisa mais destrutiva da app pedia confirmação num balão com ar de
erro. Os do sistema ficam como recurso, para quando `confirmar()` é chamado
fora da árvore da app (testes, arranque).

---

## Princípios aplicados (do README)

- **Simplicidade absoluta** — poucos ecrãs, hierarquia clara, 1 CTA por ecrã.
- **Poucos toques** — registar um animal em < 30s (chips em vez de teclado; data "Hoje" por omissão).
- **Alvos grandes / alto contraste** — botões 56px, corpo 17–18px, texto near-black.
- **PT-PT** — terminologia do sector (exploração, efetivo, brinco, SNIRA).
- **Cor funcional com ícone+texto** — nunca comunicar só por cor.

---

## Recuperação hierárquica (futuro)

Se este projeto crescer, adota o padrão *Master + Overrides*: regras globais aqui,
desvios por ecrã em `design-system/pages/<ecra>.md`. Ao construir um ecrã, lê
primeiro o override; se não existir, usa este documento.
