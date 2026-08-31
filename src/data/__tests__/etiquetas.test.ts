import { describe, expect, it } from '@jest/globals';

import { etiquetaDeLote } from '../codigos';
import { paginaDeEtiquetas } from '../etiquetas';
import { matrizQr } from '../qr';
import type { Medicamento } from '../types';

function lote(over: Partial<Medicamento> = {}): Medicamento {
  return {
    id: 'm1',
    exploracaoId: 'exp-1',
    nome: 'Penicilina',
    tipo: 'Medicamento',
    lote: 'PN-2291',
    validade: '2027-12-31',
    quantidade: 250,
    unidade: 'ml',
    intervaloSegurancaDias: 10,
    dataCompra: '2026-03-15',
    ...over,
  };
}

describe('paginaDeEtiquetas — a folha que sai na impressora', () => {
  it('uma etiqueta por lote', () => {
    const html = paginaDeEtiquetas([lote({ id: 'a' }), lote({ id: 'b' }), lote({ id: 'c' })], 'x');
    expect(html.match(/<section>/g)).toHaveLength(3);
  });

  /**
   * O que se lê SEM leitor. Uma etiqueta que só tenha o quadrado obriga a ir
   * buscar o telemóvel para saber o que está no frasco, e na arrecadação isso
   * é o mesmo que não ter etiqueta.
   */
  it('mostra o nome, o lote e a validade por escrito', () => {
    const html = paginaDeEtiquetas([lote()], 'x');
    expect(html).toContain('Penicilina');
    expect(html).toContain('Lote PN-2291');
    expect(html).toContain('Val. 31/12/2027');
  });

  it('um lote sem número e sem validade sai só com o nome', () => {
    const html = paginaDeEtiquetas([lote({ lote: undefined, validade: undefined })], 'x');
    expect(html).toContain('Penicilina');
    expect(html).not.toContain('class="sub"');
  });

  /**
   * O nome do produto é escrito pelo criador. Um `<` sem escapar não é uma
   * brecha de segurança (a janela é dele, com os dados dele), mas parte a
   * página: a folha sai em branco ou com metade das etiquetas, e a causa não
   * se vê em lado nenhum.
   */
  it('escapa o que vem escrito pelo criador', () => {
    const html = paginaDeEtiquetas([lote({ nome: 'A<b>&"x"' })], 'y<z>');
    expect(html).toContain('A&lt;b&gt;&amp;&quot;x&quot;');
    expect(html).not.toContain('<b>&"x"');
    expect(html).toContain('<title>y&lt;z&gt;</title>');
  });

  /** Cada linha do símbolo tem de estar lá: uma a menos e o QR não lê. */
  it('desenha o símbolo inteiro, linha a linha', () => {
    const alvo = lote({ id: '9f8c1b2a-4d5e-4f60-9a1b-2c3d4e5f6071' });
    const lado = matrizQr(etiquetaDeLote(alvo.id)).length;
    const html = paginaDeEtiquetas([alvo], 'x');
    expect(html.match(/<u>/g)).toHaveLength(lado);
    expect(html).toContain(`--lado:${lado}`);
  });

  /**
   * Sem isto o navegador "poupa tinta" e imprime os quadrados a cinzento, o que
   * chega para o leitor falhar num papel que já saiu da impressora.
   */
  it('obriga a impressora a imprimir o preto a preto', () => {
    const html = paginaDeEtiquetas([lote()], 'x');
    expect(html).toContain('print-color-adjust: exact');
  });

  it('sem lotes, a folha sai sem etiquetas nenhumas', () => {
    expect(paginaDeEtiquetas([], 'x')).not.toContain('<section>');
  });
});
