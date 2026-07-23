/**
 * DESIGN SYSTEM — Gestão de Gado
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

/* ------------------------------------------------------------------ *
 *  COR
 * ------------------------------------------------------------------ */

/** Escala da marca — verde folha profundo (agricultura, confiança, vida). */
const green = {
  900: '#0C3A22',
  800: '#124D2E',
  700: '#166B3D', // primaryDark — headers, gradientes
  600: '#1B7A48', // primary — CTA, marca
  500: '#2E9E5B',
  400: '#57B97D',
  300: '#8FD3A9',
  100: '#DCF2E4',
  50: '#EEF8F1', // tinte de superfície
};

export const colors = {
  /* Marca */
  primary: green[600],
  primaryDark: green[700],
  primaryDarker: green[800],
  primaryTint: green[50],
  primaryTintStrong: green[100],
  onPrimary: '#FFFFFF',

  /* Gradiente do cabeçalho / cartões escuros (meteo) */
  headerFrom: green[800],
  headerTo: green[600],

  /* Superfícies e fundo (bege-verde muito claro, como a inspiração) */
  background: '#F3F6F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4EE',
  surfaceSunken: '#E9EFE7',

  /* Texto — alto contraste para visão reduzida */
  text: '#15251C', // ~near-black esverdeado
  textSecondary: '#54655B',
  // Atenção ao formato: um hex de 4 dígitos NÃO é um cinzento abreviado — o
  // React Native lê-o como #RGBA. Este token esteve escrito '#8593' e saía
  // rgba(136,85,153,0.20): um roxo quase invisível (1,30:1 sobre o fundo) em
  // mais de 100 sítios, incluindo os separadores inativos e os placeholders.
  textMuted: '#647268', // 4,65:1 sobre o fundo · 5,06:1 sobre branco (WCAG AA)
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.82)',

  /* Linhas / bordas */
  border: '#E3EAE0',
  borderStrong: '#D2DCCD',

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
  overlay: 'rgba(15, 40, 26, 0.55)', // scrim de modais (>40%)
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

export type ColorToken = keyof typeof colors;

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
