/**
 * PALETAS — o aspeto da app, à escolha do criador.
 * ------------------------------------------------------------------
 * A app nasceu toda verde. O verde continua a ser o que vem de origem, mas
 * quem passa o dia com ela ao sol, ou tem pouca visão, pode preferir outra
 * coisa — daí o ecrã "Aspeto da app" nas Definições.
 *
 * O QUE MUDA E O QUE NÃO MUDA
 *
 * Uma paleta mexe na cor da MARCA e nas superfícies: o verde dos botões, os
 * fundos, o texto, as linhas. Não mexe nas cores com SIGNIFICADO — vermelho de
 * prazo vencido, âmbar de "esta semana", azul de informação, verde de "em dia"
 * — nem nas cores por espécie. Essas são linguagem, não decoração: se o
 * vermelho de "identificação em atraso" mudasse com o gosto de cada um,
 * deixava de querer dizer o que quer dizer. Ficam em `tokens.ts`.
 *
 * REGRA PARA QUEM ACRESCENTAR CÓDIGO
 *
 * Os tokens daqui só podem ser lidos DENTRO do render de um componente. Uma
 * constante no topo de um módulo (`const META = { cor: colors.primary }`)
 * congela a cor no arranque e fica com a paleta errada para sempre. Para cores
 * fixas — as semânticas e as das espécies — não há esse problema.
 *
 * CONTRASTE
 *
 * O utilizador de referência tem 82 anos e lê a app à luz do dia. Cada paleta
 * é verificada por teste (`__tests__/paletas.test.ts`) contra os mínimos das
 * WCAG AA nos pares que aparecem mesmo no ecrã. Uma paleta nova que não passe
 * não entra — por muito bonita que seja.
 */

/** Os tokens que uma paleta pode mudar. */
export type TokensPaleta = {
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  primaryTint: string;
  primaryTintStrong: string;
  onPrimary: string;
  headerFrom: string;
  headerTo: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceSunken: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  overlay: string;
};

export type PaletaId = 'campo' | 'terra' | 'ceu' | 'ardosia' | 'contraste';

export type Paleta = {
  id: PaletaId;
  /** Nome como aparece na lista. Curto — cabe num cartão. */
  nome: string;
  /** Uma linha a dizer a quem serve. */
  descricao: string;
  tokens: TokensPaleta;
};

export const PALETAS: Paleta[] = [
  {
    id: 'campo',
    nome: 'Campo',
    descricao: 'O verde de sempre.',
    tokens: {
      primary: '#1B7A48',
      primaryDark: '#166B3D',
      primaryDarker: '#124D2E',
      primaryTint: '#EEF8F1',
      primaryTintStrong: '#DCF2E4',
      onPrimary: '#FFFFFF',
      headerFrom: '#124D2E',
      headerTo: '#1B7A48',
      background: '#F3F6F2',
      surface: '#FFFFFF',
      surfaceAlt: '#F0F4EE',
      surfaceSunken: '#E9EFE7',
      text: '#15251C',
      textSecondary: '#54655B',
      // Um tom mais escuro do que o histórico #647268: aquele cumpria AA sobre
      // o fundo e sobre branco, mas ficava-se pelos 4,33:1 sobre o
      // `surfaceSunken`, que é onde assentam os cartões afundados.
      textMuted: '#616E64',
      border: '#E3EAE0',
      borderStrong: '#D2DCCD',
      overlay: 'rgba(15, 40, 26, 0.55)',
    },
  },
  {
    id: 'terra',
    nome: 'Terra',
    descricao: 'Castanhos quentes, como a courela no verão.',
    tokens: {
      primary: '#7D5227',
      primaryDark: '#6B4522',
      primaryDarker: '#4E3219',
      primaryTint: '#FAF4EC',
      primaryTintStrong: '#F0E3D2',
      onPrimary: '#FFFFFF',
      headerFrom: '#4E3219',
      headerTo: '#7D5227',
      background: '#F7F3EC',
      surface: '#FFFFFF',
      surfaceAlt: '#F3EDE3',
      surfaceSunken: '#EBE3D6',
      text: '#2A1F14',
      textSecondary: '#655544',
      textMuted: '#736251',
      border: '#E8DFD2',
      borderStrong: '#D9CCBA',
      overlay: 'rgba(40, 26, 15, 0.55)',
    },
  },
  {
    id: 'ceu',
    nome: 'Céu',
    descricao: 'Azul calmo, descansado para os olhos.',
    tokens: {
      primary: '#1D5D96',
      primaryDark: '#174E7E',
      primaryDarker: '#103A5F',
      primaryTint: '#EDF4FA',
      primaryTintStrong: '#D6E7F5',
      onPrimary: '#FFFFFF',
      headerFrom: '#103A5F',
      headerTo: '#1D5D96',
      background: '#F1F5F8',
      surface: '#FFFFFF',
      surfaceAlt: '#ECF1F6',
      surfaceSunken: '#E3EBF2',
      text: '#12212C',
      textSecondary: '#4E5F6B',
      textMuted: '#5B6B77',
      border: '#DDE6EC',
      borderStrong: '#C9D6E0',
      overlay: 'rgba(12, 30, 45, 0.55)',
    },
  },
  {
    id: 'ardosia',
    nome: 'Ardósia',
    descricao: 'Cinzentos sóbrios, sem cor a puxar pela vista.',
    tokens: {
      primary: '#3F5261',
      primaryDark: '#33434F',
      primaryDarker: '#26333C',
      primaryTint: '#F0F3F5',
      primaryTintStrong: '#DDE4E9',
      onPrimary: '#FFFFFF',
      headerFrom: '#26333C',
      headerTo: '#3F5261',
      background: '#F4F6F7',
      surface: '#FFFFFF',
      surfaceAlt: '#EEF1F3',
      surfaceSunken: '#E5EAED',
      text: '#1A2229',
      textSecondary: '#52606A',
      textMuted: '#5E6A73',
      border: '#E1E6EA',
      borderStrong: '#CDD5DB',
      overlay: 'rgba(20, 28, 34, 0.55)',
    },
  },
  {
    id: 'contraste',
    nome: 'Alto contraste',
    descricao: 'Letra escura, fundos claros e linhas bem marcadas.',
    tokens: {
      primary: '#0B4F9E',
      primaryDark: '#083B78',
      primaryDarker: '#062B57',
      primaryTint: '#EAF1FA',
      primaryTintStrong: '#CFE0F5',
      onPrimary: '#FFFFFF',
      headerFrom: '#062B57',
      headerTo: '#0B4F9E',
      // O fundo é cinzento e as superfícies brancas: com os dois a branco, um
      // cartão deixava de se ver como cartão. As linhas são bem mais escuras
      // do que nas outras paletas, que é o ponto desta.
      background: '#EFEFEF',
      surface: '#FFFFFF',
      surfaceAlt: '#E4E4E4',
      surfaceSunken: '#DADADA',
      text: '#000000',
      textSecondary: '#2B2B2B',
      textMuted: '#454545',
      border: '#A9A9A9',
      borderStrong: '#767676',
      overlay: 'rgba(0, 0, 0, 0.65)',
    },
  },
];

export const PALETA_OMISSAO: PaletaId = 'campo';

/** A paleta com este id, ou a de origem se o id não existir (dados antigos). */
export function paletaPorId(id: string | null | undefined): Paleta {
  return PALETAS.find((p) => p.id === id) ?? PALETAS[0];
}
