/**
 * DESIGN SYSTEM — Terrabovina
 * ------------------------------------------------------------------
 * Fonte de verdade única para cores, tipografia, espaçamento, raios e
 * sombras. Derivado da inspiração visual (app agrícola verde, cartões
 * arredondados, sombras suaves) e dos princípios do README:
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
 * São as que querem dizer alguma coisa: o vermelho de um prazo vencido, o
 * âmbar de "esta semana", o azul da meteorologia, a cor de cada espécie, o
 * rosa e o azul do sexo. Deixar o criador trocá-las era deixá-lo trocar o
 * significado — e um alerta vermelho que num telemóvel é castanho deixa de se
 * reconhecer num relance, que é a única forma como estas cores funcionam.
 */
const fixas = {
  /* Texto sobre superfícies escuras (cabeçalhos, cartão da meteo) */
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.82)',

  /* Semântica (funcional — nunca só cor, sempre com ícone/texto) */
  success: '#2E9E5B',
  successTint: '#E4F5EA',
  warning: '#E39A2E', // âmbar — prazos "esta semana"
  warningTint: '#FBF0DC',
  danger: '#D45B3B', // terracota — prazos vencidos / urgentes
  dangerTint: '#FBE7E0',
  info: '#3B82C4', // céu — meteo / informação
  infoTint: '#E4EFF8',

  /* Espécies (para chips / ícones de animais) */
  bovino: '#166B3D',
  ovino: '#6C7A89',
  caprino: '#A0713B',
  suino: '#C56B8A',
  equideo: '#8A5A3B',

  /* Sexo — o fundo do ícone na lista de animais e nos filtros.
     A cor sozinha nunca decide nada: vai sempre acompanhada do ícone de
     género (♀/♂) e do rótulo, porque um em cada doze homens não distingue
     estes dois tons — e o utilizador-alvo é um criador de 82 anos, muitas
     vezes com o telemóvel ao sol. */
  femea: '#B8447C', // 4,58:1 sobre o seu tinte
  femeaTint: '#FBE6F1',
  macho: '#2F6FB5', // 4,71:1 sobre o seu tinte
  machoTint: '#E3EEFA',

  /* Utilitário */
  // A sombra fica de fora das paletas de propósito: as elevações são criadas
  // uma única vez, no arranque deste módulo (ver `shadowPreset`), e uma cor
  // trocada depois disso nunca lá chegava. Às opacidades que a app usa
  // (6–16%) o tom da sombra é indistinguível em qualquer das paletas.
  shadow: '#0C3A22',
  white: '#FFFFFF',
  black: '#15251C',

  /* Faixa do ambiente de testes — ver `FaixaAmbiente.tsx`.
   * O roxo é DELIBERADAMENTE estranho a esta paleta: não é verde de marca,
   * não é âmbar de prazo, não é terracota de urgência. É a única cor da app
   * que não quer dizer nada sobre o gado, e é por isso que serve — não há
   * como confundir esta faixa com um alerta do próprio domínio. Só aparece
   * quando EXPO_PUBLIC_AMBIENTE=dev, portanto nunca chega a produção. */
  ambienteDev: '#6B3FA0',
  onAmbienteDev: '#FFFFFF',
} as const;

export type Cores = TokensPaleta & typeof fixas;

/**
 * As cores da app. Começa na paleta de origem e é REESCRITA no arranque, se o
 * criador tiver escolhido outra (ver `aplicarPaletaNasCores`).
 *
 * Continua a ler-se como sempre — `colors.primary` — e é por isso que muda de
 * paleta sem tocar nos ~950 sítios que a usam. Em troca, há uma regra a
 * respeitar: **ler `colors` só dentro do render**. Uma constante no topo de um
 * módulo copia o valor no momento do import, antes de a paleta guardada ser
 * aplicada, e fica verde numa app azul para o resto da execução.
 */
export const colors: Cores = { ...paletaPorId(PALETA_OMISSAO).tokens, ...fixas };

/**
 * Passa a app para uma paleta. Chamada uma vez, no arranque, antes de se
 * desenhar seja o que for — trocar de paleta com a app a correr recarrega-a
 * (ver `src/theme/preferencia.ts`), porque metade do ecrã já tem as cores
 * antigas guardadas em memória e não há como as mandar redesenhar todas.
 */
export function aplicarPaletaNasCores(id: PaletaId): void {
  Object.assign(colors, paletaPorId(id).tokens);
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
 *  RAIOS — cartões muito arredondados (como a inspiração)
 * ------------------------------------------------------------------ */

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
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
  /** Barra lateral de navegação do desktop. */
  barraLateral: 248,
} as const;

/* ------------------------------------------------------------------ *
 *  TIPOGRAFIA — Nunito (arredondada, altamente legível). Fonte grande.
 * ------------------------------------------------------------------ */

export const fontFamily = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

type TypeVariant = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'
>;

/** Escala tipográfica — generosa (corpo 17–18px) para acessibilidade. */
export const type = {
  display: {
    fontFamily: fontFamily.extrabold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: fontFamily.extrabold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
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
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 21,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  caption: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fontFamily.extrabold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.2,
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
  button: 1.25,
} satisfies Record<TypeVariantName, number>;

/* ------------------------------------------------------------------ *
 *  SOMBRAS — suaves, verde-tingidas (elevação consistente)
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
  sm: shadowPreset(2, 8, 0.06, 2),
  md: shadowPreset(4, 16, 0.08, 6),
  lg: shadowPreset(8, 24, 0.12, 10),
  /** Sombra elevada para FAB / barra inferior. */
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
