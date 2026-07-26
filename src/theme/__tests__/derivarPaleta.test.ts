/**
 * O gerador de paletas.
 *
 * `paletas.test.ts` verifica o RESULTADO — que nenhuma paleta da app tem
 * contraste a menos. Isto verifica as peças: se a mistura de cores estiver
 * trocada, o gerador produz dezoito tokens errados com toda a confiança e o
 * outro teste só diz que "alguma coisa" falhou.
 */

import { describe, expect, it } from '@jest/globals';

import { contraste, derivar, misturar, type Semente } from '../derivarPaleta';

const semente = (over: Partial<Semente> = {}): Semente => ({
  id: 'campo',
  nome: 'Teste',
  descricao: '',
  familia: 'Verdes',
  marca: '#1B7A48',
  escura: '#124D2E',
  ...over,
});

describe('misturar', () => {
  it('anda de uma cor para a outra', () => {
    expect(misturar('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(misturar('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(misturar('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('mistura cada canal por si', () => {
    expect(misturar('#FF0000', '#0000FF', 0.5)).toBe('#800080');
  });
});

describe('contraste', () => {
  it('mede o que se sabe de cor', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 1);
  });
});

describe('derivar', () => {
  it('guarda a identidade que lhe foi dada', () => {
    const p = derivar(semente({ nome: 'Hortelã', descricao: 'Fresca', familia: 'Verdes' }));
    expect(p.nome).toBe('Hortelã');
    expect(p.descricao).toBe('Fresca');
    expect(p.familia).toBe('Verdes');
  });

  it('escurece sozinho uma marca clara de mais para levar texto branco', () => {
    // É o caso do amarelo e do laranja, que foi por isto que este gerador
    // existe: um amarelo-limão como cor de botão dá letra branca sobre fundo
    // claro, ilegível ao sol. Em vez de recusar a cor, escurece-a.
    const limao = derivar(semente({ marca: '#FFE600', escura: '#6B5A00' }));
    expect(contraste('#FFFFFF', limao.tokens.primary)).toBeGreaterThanOrEqual(4.5);
    // E não a escurece até ao preto: continua a ser amarelo.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(limao.tokens.primary.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
  });

  it('não estraga uma marca que já tinha contraste que chegue', () => {
    const p = derivar(semente({ marca: '#1B7A48' }));
    expect(p.tokens.primary).toBe('#1B7A48');
  });

  it('faz fundos claros e um texto escuro, nunca ao contrário', () => {
    const p = derivar(semente({ marca: '#C0282C', escura: '#6C1416' }));
    const t = p.tokens;
    expect(contraste(t.background, '#FFFFFF')).toBeLessThan(1.5); // fundo claro
    expect(contraste(t.text, t.background)).toBeGreaterThanOrEqual(7); // texto legível
    expect(t.surface).toBe('#FFFFFF');
  });

  it('os fundos escurecem por ordem: fundo, alternativo, afundado', () => {
    // Se esta ordem se inverter, um cartão afundado passa a ser mais claro do
    // que o fundo e a hierarquia do ecrã fica ao contrário, sem erro nenhum.
    const t = derivar(semente()).tokens;
    const claro = (c: string) => contraste(c, '#000000');
    expect(claro(t.background)).toBeGreaterThan(claro(t.surfaceAlt));
    expect(claro(t.surfaceAlt)).toBeGreaterThan(claro(t.surfaceSunken));
  });

  it('o scrim dos modais é escuro e translúcido', () => {
    const t = derivar(semente()).tokens;
    expect(t.overlay).toMatch(/^rgba\(\d+, \d+, \d+, 0\.55\)$/);
  });

  it('devolve sempre hex de seis dígitos', () => {
    // Um hex de quatro dígitos NÃO é um cinzento abreviado no React Native —
    // é lido como #RGBA e sai quase transparente. Já aconteceu nesta app.
    const t = derivar(semente({ marca: '#0F8A5F', escura: '#064434' })).tokens;
    for (const [nome, valor] of Object.entries(t)) {
      if (nome === 'overlay') continue;
      expect(valor).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
