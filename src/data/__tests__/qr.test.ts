import { describe, expect, it } from '@jest/globals';

import { etiquetaDeLote } from '../codigos';
import { matrizQr, segmentosQr } from '../qr';
import { AMOSTRAS_QR } from '../../testUtils/qrAmostras';

/**
 * O gerador de QR, provado contra uma implementação independente.
 * ------------------------------------------------------------------
 * Um código QR quase certo é indistinguível de um certo a olho nu: um símbolo
 * com um byte de correção trocado desenha-se igual e não lê. Por isso este
 * teste não olha para a forma do símbolo, compara-o MÓDULO A MÓDULO com o que a
 * biblioteca `qrcode` do npm produz para o mesmo texto (ver `qr.amostras.ts`).
 *
 * As amostras foram geradas fora do repositório, para o projeto não passar a
 * depender dessa biblioteca. Para as refazer:
 *
 *   npm install qrcode
 *   const qr = require('qrcode').create(texto, { errorCorrectionLevel: 'M' });
 *   // qr.modules.data, lido em linhas de qr.modules.size
 */
describe('matrizQr — a grelha tem de ser igual à da referência', () => {
  for (const [texto, amostra] of Object.entries(AMOSTRAS_QR)) {
    const nome = texto.length > 44 ? `${texto.slice(0, 44)}…` : texto;

    it(`versão ${amostra.versao} (${amostra.lado}x${amostra.lado}): ${nome}`, () => {
      const m = matrizQr(texto);
      expect(m.length).toBe(amostra.lado);
      // Linha a linha, e não a grelha toda de uma vez: com um `toEqual` sobre
      // 57x57 booleanos, o que a consola mostra quando falha não ajuda ninguém
      // a perceber ONDE falhou.
      const nossas = m.map((linha) => linha.map((v) => (v ? '1' : '0')).join(''));
      expect(nossas).toEqual(amostra.linhas);
    });
  }
});

describe('matrizQr — a etiqueta desta app', () => {
  /**
   * O tamanho do símbolo decide se ele cabe num frasco de 20 ml. Uma versão a
   * mais são mais 4 módulos de lado, e ninguém dá por isso a olhar para o
   * código: dá-se por isso na etiqueta impressa.
   */
  it('cabe numa versão 4 (33x33), que é o que se consegue colar num frasco', () => {
    const m = matrizQr(etiquetaDeLote('9f8c1b2a-4d5e-4f60-9a1b-2c3d4e5f6071'));
    expect(m.length).toBe(33);
  });

  it('um identificador curto cabe numa versão 1', () => {
    expect(matrizQr(etiquetaDeLote('m1')).length).toBe(21);
  });

  /** Dois textos diferentes não podem dar o mesmo símbolo. */
  it('textos diferentes dão símbolos diferentes', () => {
    const a = matrizQr(etiquetaDeLote('m1')).map((l) => l.join('')).join('');
    const b = matrizQr(etiquetaDeLote('m2')).map((l) => l.join('')).join('');
    expect(a).not.toBe(b);
  });
});

describe('matrizQr — o que recusa', () => {
  it('texto vazio', () => {
    expect(() => matrizQr('')).toThrow();
  });

  /**
   * Acima do teto rebenta com uma mensagem, em vez de devolver um símbolo
   * truncado: um QR que não lê só se descobre com o leitor na mão, e nessa
   * altura já está colado no frasco.
   */
  it('texto acima do que a versão 10 aguenta', () => {
    expect(() => matrizQr('x'.repeat(300))).toThrow(/demasiado longo/i);
  });
});

describe('segmentosQr — o que se desenha', () => {
  it('junta os quadrados seguidos da mesma cor', () => {
    const linhas = segmentosQr([[true, true, false, false, false, true]]);
    expect(linhas[0]).toEqual([
      { escuro: true, quantos: 2 },
      { escuro: false, quantos: 3 },
      { escuro: true, quantos: 1 },
    ]);
  });

  /** Cada linha tem de continuar a somar o lado do símbolo. */
  it('não perde nem inventa quadrados', () => {
    const m = matrizQr(etiquetaDeLote('9f8c1b2a-4d5e-4f60-9a1b-2c3d4e5f6071'));
    for (const linha of segmentosQr(m)) {
      expect(linha.reduce((soma, s) => soma + s.quantos, 0)).toBe(m.length);
    }
  });

  /**
   * É a razão de ser da função. Uma vista por quadrado seriam 1089 vistas num
   * símbolo de versão 4; por segmentos ficam pouco mais de 500.
   *
   * A poupança é de cerca de metade e não de dez vezes, e isso é do próprio
   * QR: a zona de dados é ruído, e ruído quase não tem quadrados seguidos.
   * Metade continua a valer a pena e é o que se pode prometer sem inventar.
   */
  it('corta para cerca de metade as vistas a desenhar', () => {
    const m = matrizQr(etiquetaDeLote('9f8c1b2a-4d5e-4f60-9a1b-2c3d4e5f6071'));
    const segmentos = segmentosQr(m).reduce((soma, l) => soma + l.length, 0);
    expect(segmentos).toBeLessThan(m.length * m.length * 0.6);
  });
});
