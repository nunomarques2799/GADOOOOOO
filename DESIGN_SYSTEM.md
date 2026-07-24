# Design System — Terrabovina

Fonte de verdade do design da app. Derivado da **imagem de inspiração** (app
agrícola verde, cartões muito arredondados, sombras suaves) e dos **princípios
do README**: simplicidade absoluta para o utilizador de 82 anos, fontes e botões
grandes, alto contraste, estética rural/de confiança.

Implementação: [`src/theme/tokens.ts`](src/theme/tokens.ts). Importa sempre via
`@/theme` — nunca uses hex soltos nos componentes.

---

## Cor

Ancorada num **verde folha profundo** (agricultura, vida, confiança).

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#1B7A48` | CTA, marca, ícones ativos |
| `primaryDark` | `#166B3D` | Gradientes de cabeçalho, títulos de ação |
| `primaryTint` / `primaryTintStrong` | `#EEF8F1` / `#DCF2E4` | Fundos de realce, chips ativos |
| `background` | `#F3F6F2` | Canvas dos ecrãs (bege-verde muito claro) |
| `surface` | `#FFFFFF` | Cartões |
| `text` / `textSecondary` / `textMuted` | `#15251C` / `#54655B` / `#8A968E` | Texto (near-black esverdeado → alto contraste) |
| `border` | `#E3EAE0` | Linhas e contornos de cartões |

**Cor funcional** (nunca só cor — sempre com ícone + texto):

| Token | Hex | Significado |
|---|---|---|
| `danger` | `#D45B3B` | Prazos vencidos / urgentes |
| `warning` | `#E39A2E` | Prazos "esta semana" |
| `info` | `#3B82C4` | Meteorologia / a acompanhar |
| `success` | `#2E9E5B` | Tudo em dia / confirmações |

Cada uma tem um par `*Tint` para fundos suaves. Cores por espécie
(`bovino`, `ovino`, `caprino`, `suino`, `equideo`) para chips e avatares.

### Paletas à escolha do criador

O verde é a paleta **de origem**, não a única. Em *Definições → Cores da app* o
criador escolhe entre `campo` (verde), `terra`, `ceu`, `ardosia` e `contraste`
(alto contraste, para visão reduzida). Definição em
[`src/theme/paletas.ts`](src/theme/paletas.ts).

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

## Tipografia — Nunito

Família **Nunito** (arredondada, muito legível — combina com a estética de
cartões arredondados e com a acessibilidade). Corpo **grande** (17–18px) para
o utilizador-alvo. Carregada via `@expo-google-fonts/nunito`.

| Variante | Peso / Tamanho | Uso |
|---|---|---|
| `display` | ExtraBold 32 | Saudação, títulos de ecrã |
| `h1` / `h2` / `h3` | Extra/Bold 26 / 21 / 18 | Hierarquia de secções |
| `bodyLg` / `body` | Regular 18 / 17 | Corpo |
| `bodyStrong` | Bold 17 | Valores, destaques |
| `secondary` | Medium 15 | Texto de apoio |
| `label` / `caption` | Bold 15 / Semibold 13 | Etiquetas, metadados |
| `button` | ExtraBold 18 | Botões |

Acesso via componente `<Text variant="…">` que respeita o dimensionamento do
sistema (Dynamic Type).

---

## Espaçamento, raios e tamanhos

- **Espaçamento** — escala base-4: `xxs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · xxl 32 · xxxl 40 · huge 56`.
- **Raios** — cartões muito arredondados: `sm 10 · md 16 · lg 22 · xl 28 · pill 999`.
- **Alvos de toque** — `touchMin 48`, `button 56`, `input 58` (README: botões grandes).
- **Sombras** — suaves e verde-tingidas (`sm/md/lg/raised`), elevação consistente.
- **Animação** — micro-interações 150–300ms (`motion.fast/base/slow`).

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

`src/components/` (domínio): `WeatherCard · AlertItem · AnimalRow ·
ExploracaoRow · StatCard · QuickAction`.

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
