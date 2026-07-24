/**
 * Contraste das paletas.
 * ------------------------------------------------------------------
 * Uma paleta é uma escolha de gosto, mas a legibilidade não é. O criador de
 * referência tem 82 anos e usa a app no meio do campo, muitas vezes com o sol
 * a bater no ecrã: uma paleta bonita com texto a 3:1 sobre o fundo é uma app
 * que ele não consegue ler.
 *
 * Este teste corre sobre TODAS as paletas, incluindo as que ainda não existem.
 * É de propósito: o custo de acrescentar uma paleta nova passa a incluir
 * provar que se lê.
 */

import { describe, expect, it } from '@jest/globals';

import { FAMILIAS, PALETAS, PALETA_OMISSAO, paletaOmissao, paletaPorId, paletasDe } from '../paletas';

/* ---- Contraste WCAG 2.1 ---- */

function canal(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Cor não é um hex de 6 dígitos: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * canal((n >> 16) & 255) +
    0.7152 * canal((n >> 8) & 255) +
    0.0722 * canal(n & 255)
  );
}

/** Razão de contraste entre duas cores (1 = iguais, 21 = preto sobre branco). */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('contraste', () => {
  it('mede o que se sabe de cor', () => {
    // Sem isto, um erro na fórmula dava um teste que aprova tudo — a pior
    // espécie de teste de acessibilidade.
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
  });
});

describe('paletas', () => {
  it('a paleta de origem existe e abre a lista', () => {
    expect(paletaPorId(PALETA_OMISSAO).id).toBe(PALETA_OMISSAO);
    expect(paletaOmissao().id).toBe(PALETA_OMISSAO);
    expect(PALETAS[0].id).toBe(PALETA_OMISSAO);
  });

  it('a paleta de origem mantém as cores exatas com que a app foi desenhada', () => {
    // Esta não é uma paleta como as outras: é a que TODA a gente tem, e quem
    // nunca abrir o ecrã do aspeto continua com ela. Um acerto no gerador ou
    // um "arredondar" bem-intencionado destes valores muda a app a toda a
    // gente de uma vez, sem ninguém ter pedido nada.
    const t = paletaOmissao().tokens;
    expect(t.primary).toBe('#1B7A48');
    expect(t.primaryDark).toBe('#166B3D');
    expect(t.primaryDarker).toBe('#124D2E');
    expect(t.background).toBe('#F3F6F2');
    expect(t.surface).toBe('#FFFFFF');
    expect(t.text).toBe('#15251C');
  });

  it('está toda arrumada por famílias', () => {
    // A ordem da lista é a ordem por que aparecem no ecrã. Uma paleta cuja
    // família não conste ficava fora da lista sem erro nenhum — desaparecia
    // simplesmente, e quem a tivesse escolhida caía na de origem.
    for (const p of PALETAS) expect(FAMILIAS).toContain(p.familia);
    expect(FAMILIAS.flatMap(paletasDe).length).toBe(PALETAS.length);
  });

  it('nenhuma família fica vazia', () => {
    for (const f of FAMILIAS) expect(paletasDe(f).length).toBeGreaterThan(0);
  });

  it('há escolha que chegue, e de cores diferentes', () => {
    expect(PALETAS.length).toBeGreaterThanOrEqual(15);
    // Duas paletas com a mesma cor de marca são uma opção a fingir.
    const marcas = PALETAS.map((p) => p.tokens.primary);
    expect(new Set(marcas).size).toBe(marcas.length);
  });

  it('um id desconhecido cai na paleta de origem', () => {
    // Acontece a sério: uma paleta que se retire fica gravada no telemóvel de
    // quem a tinha escolhida. Rebentar no arranque por causa disso seria
    // deixar a app inutilizável por uma questão de cor.
    expect(paletaPorId('paleta-que-ja-nao-existe').id).toBe(PALETA_OMISSAO);
    expect(paletaPorId(null).id).toBe(PALETA_OMISSAO);
    expect(paletaPorId(undefined).id).toBe(PALETA_OMISSAO);
  });

  it('não há ids repetidos', () => {
    const ids = PALETAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const p of PALETAS) {
    describe(p.nome, () => {
      const t = p.tokens;

      // Texto corrido: AAA (7:1). É o que se lê durante minutos seguidos.
      it('o texto principal lê-se sobre o fundo e sobre os cartões', () => {
        expect(contraste(t.text, t.background)).toBeGreaterThanOrEqual(7);
        expect(contraste(t.text, t.surface)).toBeGreaterThanOrEqual(7);
      });

      // Texto de apoio: AA (4.5:1). É onde a app costuma escorregar — foi
      // assim que o `textMuted` andou meses num roxo a 1,30:1.
      it('o texto secundário e o esbatido cumprem o mínimo AA', () => {
        for (const fundo of [t.background, t.surface, t.surfaceAlt, t.surfaceSunken]) {
          expect(contraste(t.textSecondary, fundo)).toBeGreaterThanOrEqual(4.5);
          expect(contraste(t.textMuted, fundo)).toBeGreaterThanOrEqual(4.5);
        }
      });

      it('o texto dos botões lê-se sobre a cor da marca', () => {
        expect(contraste(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(t.onPrimary, t.primaryDark)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(t.onPrimary, t.primaryDarker)).toBeGreaterThanOrEqual(4.5);
      });

      it('o texto sobre o cabeçalho colorido lê-se nas duas pontas do gradiente', () => {
        expect(contraste(t.onPrimary, t.headerFrom)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(t.onPrimary, t.headerTo)).toBeGreaterThanOrEqual(4.5);
      });

      it('a marca lê-se sobre o seu próprio tinte (chips e etiquetas)', () => {
        expect(contraste(t.primaryDark, t.primaryTint)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(t.primaryDark, t.primaryTintStrong)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(t.primaryDark, t.surface)).toBeGreaterThanOrEqual(4.5);
      });

      it('os cartões distinguem-se do fundo', () => {
        // Não é contraste de texto — é só garantir que uma superfície branca
        // sobre um fundo branco não faz os cartões desaparecerem.
        expect(contraste(t.surface, t.background)).toBeGreaterThan(1.02);
      });
    });
  }
});
