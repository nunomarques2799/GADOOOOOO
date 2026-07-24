/**
 * Fazer uma paleta inteira a partir de duas cores.
 * ------------------------------------------------------------------
 * Uma paleta são dezoito tokens. Escrevê-los à mão vezes sem conta é como se
 * pede um erro de contraste: basta um fundo três por cento mais escuro para o
 * texto de apoio cair abaixo do mínimo legível, e isso não se vê a olho — vê-se
 * quando o criador de 82 anos diz que "aquilo está apagado".
 *
 * Aqui dá-se a cor da marca e a sua versão escura; o resto — tintes, fundos,
 * texto, linhas — é derivado, e **os níveis de contraste são forçados**: cada
 * cor de texto é escurecida até passar o mínimo sobre o mais escuro dos fundos
 * claros. Uma cor de marca demasiado clara para levar texto branco por cima é
 * escurecida sozinha, em vez de gerar um botão ilegível.
 *
 * O teste em `__tests__/paletas.test.ts` continua a verificar o resultado de
 * fora, sem saber que isto existe. É de propósito: um gerador com um erro de
 * sinal produz dezoito tokens errados com toda a confiança.
 */

import type { Paleta, PaletaId, TokensPaleta } from './paletas';

/* ------------------------------------------------------------------ *
 *  Contas de cor
 * ------------------------------------------------------------------ */

type RGB = [number, number, number];

function paraRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paraHex([r, g, b]: RGB): string {
  const d = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${d(r)}${d(g)}${d(b)}`;
}

/** Mistura duas cores. `peso` é quanto de `b` entra (0 = só `a`, 1 = só `b`). */
export function misturar(a: string, b: string, peso: number): string {
  const [ar, ag, ab] = paraRgb(a);
  const [br, bg, bb] = paraRgb(b);
  return paraHex([
    ar + (br - ar) * peso,
    ag + (bg - ag) * peso,
    ab + (bb - ab) * peso,
  ]);
}

function canal(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const [r, g, b] = paraRgb(hex);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const PRETO = '#000000';
const BRANCO = '#FFFFFF';

/**
 * Escurece `cor` o menos possível até ela atingir `alvo` de contraste com
 * `fundo`. Mantém o matiz — escurecer é misturar com preto, não dessaturar.
 */
function escurecerAte(cor: string, fundo: string, alvo: number): string {
  if (contraste(cor, fundo) >= alvo) return cor;
  for (let p = 0.02; p <= 1; p += 0.02) {
    const tentativa = misturar(cor, PRETO, p);
    if (contraste(tentativa, fundo) >= alvo) return tentativa;
  }
  return PRETO;
}

/* ------------------------------------------------------------------ *
 *  Derivação
 * ------------------------------------------------------------------ */

export type Semente = {
  id: PaletaId;
  nome: string;
  descricao: string;
  familia: Paleta['familia'];
  /** A cor da marca: botões, ícones ativos, o fim do gradiente do cabeçalho. */
  marca: string;
  /**
   * A versão escura da marca, para o início do gradiente. Dada à mão e não
   * derivada porque é onde uma cor perde a alma: um amarelo escurecido por
   * conta própria vai parar ao verde-tropa, e um rosa ao castanho.
   */
  escura: string;
};

/**
 * Mínimos que se exigem, e porquê:
 *
 * - 4,6:1 para texto branco sobre a marca — AA de texto normal, com uma folga
 *   para o arredondamento não deixar nada em cima da linha.
 * - 7,5:1 para o texto corrido — AAA. É o que se lê durante minutos seguidos,
 *   muitas vezes com o sol a bater no ecrã.
 * - 4,6:1 para texto de apoio, medido sobre o `surfaceSunken`, que é o mais
 *   escuro dos fundos. Passando no pior, passa em todos.
 */
const MIN_SOBRE_MARCA = 4.6;
const MIN_TEXTO = 7.5;
const MIN_APOIO = 4.6;

export function derivar(s: Semente): Paleta {
  // A marca tem de aguentar texto branco por cima — é o botão principal da app.
  const primary = escurecerAte(s.marca, BRANCO, MIN_SOBRE_MARCA);
  const primaryDarker = escurecerAte(s.escura, BRANCO, 9);
  const primaryDark = escurecerAte(misturar(primary, primaryDarker, 0.4), BRANCO, 5.6);

  // Fundos: a cor da marca lavada em branco. Uma pontinha do matiz é o que
  // separa um fundo escolhido de um cinzento qualquer.
  const background = misturar(primary, BRANCO, 0.955);
  const surfaceAlt = misturar(primary, BRANCO, 0.935);
  const surfaceSunken = misturar(primary, BRANCO, 0.895);

  const tokens: TokensPaleta = {
    primary,
    primaryDark,
    primaryDarker,
    primaryTint: misturar(primary, BRANCO, 0.945),
    primaryTintStrong: misturar(primary, BRANCO, 0.855),
    onPrimary: BRANCO,
    headerFrom: primaryDarker,
    headerTo: primary,
    background,
    surface: BRANCO,
    surfaceAlt,
    surfaceSunken,
    // O texto não é preto puro: leva um resto do matiz, que é o que faz a app
    // parecer de uma peça em vez de cinzenta com uns botões coloridos.
    text: escurecerAte(misturar(primaryDarker, PRETO, 0.55), BRANCO, MIN_TEXTO),
    textSecondary: escurecerAte(misturar(primary, '#6B6B6B', 0.72), surfaceSunken, 5.2),
    textMuted: escurecerAte(misturar(primary, '#7A7A7A', 0.76), surfaceSunken, MIN_APOIO),
    border: misturar(primary, BRANCO, 0.9),
    borderStrong: misturar(primary, BRANCO, 0.8),
    overlay: sombraDe(primaryDarker),
  };

  return {
    id: s.id,
    nome: s.nome,
    descricao: s.descricao,
    familia: s.familia,
    tokens,
  };
}

/** O scrim dos modais: a cor mais escura da paleta, a 55%. */
function sombraDe(escura: string): string {
  const [r, g, b] = paraRgb(misturar(escura, PRETO, 0.35));
  return `rgba(${r}, ${g}, ${b}, 0.55)`;
}
