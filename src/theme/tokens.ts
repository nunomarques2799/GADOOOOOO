/**
 * DESIGN SYSTEM — Terrabovina
 * ------------------------------------------------------------------
 * Fonte de verdade única para cores, tipografia, espaçamento, raios e
 * sombras. Desde 2026-10-02 segue o guia de estilo "Terrabovina, novo estilo"
 * (oliveira, creme, terracota e ocre; Fraunces, Atkinson Hyperlegible Next e
 * IBM Plex Mono), sem largar os princípios de sempre:
 *   - Simplicidade absoluta (utilizador de referência: criador de 82 anos)
 *   - Fontes grandes, botões grandes, alto contraste
 *   - Estética rural / agrícola / de confiança
 *
 * Ver DESIGN_SYSTEM.md para a documentação completa e o racional.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { paletaPorId, PALETA_OMISSAO, type PaletaId, type TokensPaleta } from './paletas';

/* ------------------------------------------------------------------ *
 *  COR
 * ------------------------------------------------------------------ */

/**
 * As cores que NÃO mudam com a paleta escolhida.
 *
 * São as que querem dizer alguma coisa: o terracota de um prazo legal a
 * vencer, o ocre da reprodução e de "esta semana", o verde-azulado da saúde,
 * o rosa e o azul do sexo. Deixar o criador trocá-las era deixá-lo trocar o
 * significado — e um aviso urgente que num telemóvel é castanho e noutro é
 * azul deixa de se reconhecer num relance, que é a única forma como estas
 * cores funcionam.
 *
 * TRÊS DESTAS CORES TÊM DOIS TONS, e não é enfeite. O ocre do guia (#DDA54A)
 * dá 2:1 sobre o creme: lê-se como cor e não se lê como letra ("nunca letra
 * ocre sobre creme", diz o guia). Por isso `warning` é o ocre ESCURO, o que
 * serve para letra e ícones, e `warningVivo` é o ocre do guia, só para pontos,
 * barras e preenchimentos que não levam nada escrito por cima. O mesmo para o
 * terracota (`danger` / `dangerVivo`) e para a saúde (`saude` / `saudeVivo`).
 * Na dúvida, o tom sem "Vivo" é sempre o seguro.
 */
const fixas = {
  /* Semântica (funcional — nunca só cor, sempre com ícone/texto) */
  success: '#4E6B37', // "em dia" — o verde do guia um nada mais escuro, para ler sobre o seu tinte
  successTint: '#E3E9D9',
  warning: '#875D17', // ocre de LETRA — reprodução, avisos desta semana
  warningVivo: '#DDA54A', // ocre do guia — só pontos, barras e preenchimentos
  warningTint: '#F6E5C5',
  danger: '#9E4B2A', // terracota de LETRA e de botão — prazos legais, brinco, SNIRA
  dangerVivo: '#C0613A', // terracota do guia — só pontos e barras
  dangerTint: '#F4DDD3',
  /** A letra sobre um botão ou contador de perigo. */
  onDanger: '#FFFFFF',
  info: '#3D6583', // azul de ardósia — meteorologia, informação
  infoTint: '#DCE6EE',
  saude: '#3F6B5C', // saúde de LETRA — vacinas, tratamentos
  saudeVivo: '#4F7A6B', // saúde do guia — pontos
  saudeTint: '#DCE8E2',

  /* Espécies (para chips / ícones de animais) */
  bovino: '#4E6B37',
  ovino: '#5E6B78',
  caprino: '#8E6230',
  suino: '#A85C76',
  equideo: '#7A5235',

  /* Sexo — o fundo do retrato e a etiqueta na lista de animais e nos filtros.
     A cor sozinha nunca decide nada: vai sempre acompanhada do rótulo
     ("Fêmea", "Macho") ou do ícone de género, porque um em cada doze homens
     não distingue estes dois tons — e o utilizador-alvo é um criador de 82
     anos, muitas vezes com o telemóvel ao sol. */
  femea: '#983F55', // 5,1:1 sobre o seu tinte (o #A6475E do guia dava 4,4)
  femeaTint: '#F4DDE3',
  macho: '#3D6583', // 4,9:1 sobre o seu tinte
  machoTint: '#DCE6EE',

  /* Utilitário */
  // A sombra fica de fora das paletas de propósito: as elevações são criadas
  // uma única vez, no arranque deste módulo (ver `shadowPreset`), e uma cor
  // trocada depois disso nunca lá chegava. Às opacidades que a app usa
  // (6–16%) o tom da sombra é indistinguível em qualquer das paletas.
  shadow: '#22281A',
  white: '#FFFFFF',
  black: '#22281A',

  /* Faixa do ambiente de testes — ver `FaixaAmbiente.tsx`.
   * O roxo é DELIBERADAMENTE estranho a esta paleta: não é oliveira de marca,
   * não é ocre de prazo, não é terracota de urgência. É a única cor da app
   * que não quer dizer nada sobre o gado, e é por isso que serve — não há
   * como confundir esta faixa com um alerta do próprio domínio. Só aparece
   * quando EXPO_PUBLIC_AMBIENTE=dev, portanto nunca chega a produção. */
  ambienteDev: '#6B3FA0',
  onAmbienteDev: '#FFFFFF',
};

/**
 * As mesmas cores com significado, numa paleta de FUNDO ESCURO.
 *
 * Os tons de cima foram escolhidos para ler sobre creme. Sobre o fundo da
 * Noite, um terracota de letra (#9E4B2A) fica a 2,7:1 — um prazo legal que não
 * se lê. Aqui a letra passa a clara e os tintes passam a escuros, para as
 * etiquetas continuarem a ser "letra de cor sobre o seu tinte". O significado é
 * o mesmo, o tom é o que se lê naquele fundo. Os `Vivo` (pontos e barras)
 * ficam iguais: não levam letra por cima.
 */
const fixasEscuras: Partial<typeof fixas> = {
  success: '#9DBE7E',
  successTint: '#273120',
  warning: '#E2B35E',
  warningTint: '#3A301D',
  danger: '#EC9473',
  dangerTint: '#3E2820',
  onDanger: '#141810',
  info: '#9BBBD9',
  infoTint: '#1F2B36',
  saude: '#8EC2AF',
  saudeTint: '#1E2F29',
  femea: '#EBA2B7',
  femeaTint: '#3C232B',
  macho: '#9BBBD9',
  machoTint: '#1F2B36',
  black: '#0E120A',
};

export type Cores = TokensPaleta & typeof fixas;

/**
 * As cores da app. Começa na paleta de origem e é REESCRITA no arranque, se o
 * criador tiver escolhido outra (ver `aplicarPaletaNasCores`).
 *
 * Continua a ler-se como sempre — `colors.primary` — e é por isso que muda de
 * paleta sem tocar nos ~950 sítios que a usam. Em troca, há uma regra a
 * respeitar: **ler `colors` só dentro do render**. Uma constante no topo de um
 * módulo copia o valor no momento do import, antes de a paleta guardada ser
 * aplicada, e fica com a cor de origem para o resto da execução.
 */
export const colors: Cores = { ...paletaPorId(PALETA_OMISSAO).tokens, ...fixas };

/**
 * Passa a app para uma paleta. Chamada uma vez, no arranque, antes de se
 * desenhar seja o que for — trocar de paleta com a app a correr recarrega-a
 * (ver `src/theme/preferencia.ts`), porque metade do ecrã já tem as cores
 * antigas guardadas em memória e não há como as mandar redesenhar todas.
 */
export function aplicarPaletaNasCores(id: PaletaId): void {
  const paleta = paletaPorId(id);
  // As fixas voltam primeiro ao tom claro: quem passa da Noite para outra
  // paleta não pode ficar com a letra clara das escuras.
  Object.assign(colors, paleta.tokens, fixas, paleta.escura ? fixasEscuras : {});
}

/** As cores com significado tal como ficam numa paleta (para os testes de contraste). */
export function coresFixasDe(escura: boolean): typeof fixas {
  return { ...fixas, ...(escura ? fixasEscuras : {}) };
}

export type ColorToken = keyof Cores;

/* ------------------------------------------------------------------ *
 *  ESPAÇAMENTO — escala base 4 (ritmo 4/8dp)
 * ------------------------------------------------------------------ */

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

/* ------------------------------------------------------------------ *
 *  RAIOS — do guia de estilo: 14 nos campos, 16 nos botões, 20 nos
 *  cartões, 28 no topo das folhas que sobem
 * ------------------------------------------------------------------ */

export const radii = {
  sm: 10,
  /** Campos de formulário, ícones em quadrado. */
  md: 14,
  /** Botões. */
  botao: 16,
  /** Cartões. */
  lg: 20,
  /** Topo das folhas que sobem do fundo. */
  xl: 28,
  pill: 999,
} as const;

/* ------------------------------------------------------------------ *
 *  ALVOS DE TOQUE — grandes, para o utilizador-alvo
 * ------------------------------------------------------------------ */

export const sizes = {
  touchMin: 48, // mínimo absoluto
  button: 56, // altura de botão primário (README)
  input: 58, // altura de campo de formulário
  icon: { xs: 16, sm: 20, md: 24, lg: 28, xl: 36 },
  avatar: { sm: 40, md: 48, lg: 64 },
  tabBar: 68,
} as const;

/* ------------------------------------------------------------------ *
 *  LAYOUT — larguras do desenho de telemóvel vs. desktop
 * ------------------------------------------------------------------ */

export const layout = {
  /** Coluna central em janelas de web estreitas (mantém o desenho móvel). */
  colunaMobile: 560,
  /** Largura máxima do conteúdo em desktop (evita linhas demasiado longas). */
  conteudoDesktop: 1180,
  /** Coluna única para ecrãs de lista de opções (perfil, definições). */
  conteudoEstreito: 760,
  /** O painel dos formulários no computador (ver `EcraComTeclado`). */
  formularioDesktop: 880,
  /** Barra lateral de navegação do desktop. */
  barraLateral: 248,
} as const;

/* ------------------------------------------------------------------ *
 *  TIPOGRAFIA — três letras, cada uma com o seu trabalho:
 *   - Fraunces (serifa suave, a do logótipo): títulos, números grandes e a
 *     inicial no retrato. Peso 600, eixo SOFT a 100.
 *   - Atkinson Hyperlegible Next (Braille Institute, para quem vê mal: o I, o
 *     l e o 1 não se confundem): tudo o que se lê.
 *   - IBM Plex Mono: brincos, números do animal, prazos e datas curtas.
 *     Algarismos da mesma largura, e os brincos alinham-se numa lista.
 *
 * O Fraunces é uma letra variável, e o React Native não sabe mexer nos eixos.
 * Por isso há DUAS instâncias fixas, tiradas do Google Fonts: a de 34 (ótica
 * de título grande) e a de 20 (ótica de secção). No navegador escolhe-se a
 * ótica pelo tamanho; aqui escolhe-se pela variante. Ver `assets/fontes/`.
 * ------------------------------------------------------------------ */

export const fontFamily = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  /** Não há 800 de Atkinson na app: o 700 já é cheio, e é menos uma fonte a carregar. */
  extrabold: 'AtkinsonHyperlegibleNext_700Bold',
  /** Fraunces 600, ótica de título (34). */
  titulo: 'Fraunces_600SemiBold_opsz34',
  /** Fraunces 600, ótica de secção (20). */
  seccao: 'Fraunces_600SemiBold_opsz20',
  /** IBM Plex Mono 500: brincos, números, prazos. */
  mono: 'IBMPlexMono_500Medium',
  /** IBM Plex Mono 600: o número que tem de saltar à vista. */
  monoForte: 'IBMPlexMono_600SemiBold',
} as const;

type TypeVariant = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing' | 'textTransform'
>;

/**
 * Escala tipográfica — generosa (corpo 17px) para acessibilidade, com os
 * tamanhos do guia: título do ecrã 34/37, secção 20/26, nome na lista 18/24,
 * texto 17/25, secundário 14/20 (aqui 15/21: o criador de 82 anos lê-o ao sol),
 * rótulo 13 em maiúsculas, brinco e prazo 14/20.
 */
export const type = {
  /** Título do ecrã ("Bom dia, Nuno", "Animais"). Fraunces. */
  display: {
    fontFamily: fontFamily.titulo,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.3,
  },
  /** Título grande dentro do ecrã (o nome na ficha, o título de uma folha). Fraunces. */
  h1: {
    fontFamily: fontFamily.titulo,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.2,
  },
  /** Secção ("Precisa da sua atenção", "Histórico"). Fraunces. */
  h2: {
    fontFamily: fontFamily.seccao,
    fontSize: 21,
    lineHeight: 27,
  },
  /** Nome na lista, título de cartão. */
  h3: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  bodyLg: {
    fontFamily: fontFamily.regular,
    fontSize: 18,
    lineHeight: 27,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 17,
    lineHeight: 25,
  },
  bodyStrong: {
    fontFamily: fontFamily.bold,
    fontSize: 17,
    lineHeight: 25,
  },
  secondary: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  /** Rótulo em maiúsculas por cima de um bloco ("REPRODUÇÃO", "PESO"). */
  rotulo: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  /** Brincos, números do animal, prazos ("3 dias"), datas curtas. */
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 15,
    lineHeight: 21,
  },
  button: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    lineHeight: 22,
  },
} satisfies Record<string, TypeVariant>;

export type TypeVariantName = keyof typeof type;

/**
 * Teto de ampliação por variante ("Tamanho da letra" do Android / Dynamic Type).
 *
 * A escala acima já é generosa de propósito — o público-alvo é idoso. Deixar o
 * sistema multiplicá-la ainda por 1,5–2× não ajuda ninguém: parte palavras a
 * meio ("Animai s"), sobrepõe títulos às ações e esmaga colunas até o texto sair
 * na vertical. Os títulos, que já são enormes, esticam pouco; o texto pequeno,
 * que tem folga, estica mais. Ampliar continua a funcionar — só deixa de
 * destruir o desenho.
 */
export const maxFontScale = {
  display: 1.15,
  h1: 1.15,
  h2: 1.2,
  h3: 1.25,
  bodyLg: 1.3,
  body: 1.3,
  bodyStrong: 1.3,
  secondary: 1.35,
  label: 1.3,
  caption: 1.4,
  rotulo: 1.3,
  mono: 1.3,
  button: 1.25,
} satisfies Record<TypeVariantName, number>;

/* ------------------------------------------------------------------ *
 *  SOMBRAS — quase nenhumas. O guia: "cartões com linha de 1 px e quase
 *  sem sombra; a sombra fica para o que flutua (o Registar, os avisos)".
 * ------------------------------------------------------------------ */

function shadowPreset(
  elevation: number,
  radius: number,
  opacity: number,
  offsetY: number,
): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation },
    default: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  }) as ViewStyle;
}

export const shadow = {
  none: {},
  /** A dos cartões: só um sopro — quem separa o cartão do fundo é a linha. */
  sm: shadowPreset(1, 6, 0.04, 1),
  md: shadowPreset(3, 14, 0.07, 4),
  lg: shadowPreset(8, 24, 0.12, 10),
  /** Sombra elevada para o que flutua: o Registar, os avisos. */
  raised: shadowPreset(10, 20, 0.16, 8),
} as const;

/* ------------------------------------------------------------------ *
 *  DURAÇÕES DE ANIMAÇÃO (150–300ms micro-interações)
 * ------------------------------------------------------------------ */

export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
} as const;
