import { describe, expect, it } from '@jest/globals';

import {
  analisarCodigo,
  dataGs1ParaIso,
  destinoDoCodigo,
  etiquetaDeLote,
  loteDaEtiqueta,
  normalizarGtin,
  produtoConhecido,
} from '../codigos';
import type { Medicamento } from '../types';

/** O separador de campos do GS1 (FNC1), tal como o leitor o entrega. */
const GS = String.fromCharCode(29);

function lote(over: Partial<Medicamento> = {}): Medicamento {
  return {
    id: 'm1',
    exploracaoId: 'exp-1',
    nome: 'Penicilina',
    tipo: 'Medicamento',
    lote: 'PN-1',
    quantidade: 100,
    unidade: 'ml',
    intervaloSegurancaDias: 10,
    dataCompra: '2026-03-15',
    ...over,
  };
}

/* ------------------------------------------------------------------
 * Números de produto
 * ------------------------------------------------------------------ */

describe('normalizarGtin — o EAN-13 e o GTIN-14 têm de dar a mesma chave', () => {
  it('põe o EAN-13 a 14 dígitos', () => {
    expect(normalizarGtin('5601234567893')).toBe('05601234567893');
  });

  it('deixa o GTIN-14 como está', () => {
    expect(normalizarGtin('05601234567893')).toBe('05601234567893');
  });

  /**
   * É a razão de ser da função. Sem isto, o mesmo frasco lido das riscas e do
   * Data Matrix ficava com duas chaves e a app não se reconhecia a si própria.
   */
  it('o mesmo produto lido das riscas e do Data Matrix dá a MESMA chave', () => {
    expect(normalizarGtin('5601234567893')).toBe(normalizarGtin('05601234567893'));
  });

  it('aceita o EAN-8 e o UPC-A', () => {
    expect(normalizarGtin('96385074')).toBe('00000096385074');
    expect(normalizarGtin('012345678905')).toBe('00012345678905');
  });

  it('recusa o que não tem comprimento de número de produto', () => {
    expect(normalizarGtin('12345')).toBeUndefined();
    expect(normalizarGtin('123456789012345')).toBeUndefined();
    expect(normalizarGtin('')).toBeUndefined();
  });
});

/* ------------------------------------------------------------------
 * Datas GS1
 * ------------------------------------------------------------------ */

describe('dataGs1ParaIso — a validade que vem no símbolo', () => {
  it('lê AAMMDD', () => {
    expect(dataGs1ParaIso('271231', 2026)).toBe('2027-12-31');
  });

  /**
   * Quase todas as caixas trazem só mês e ano ("12/2027"), e o dia vem a `00`.
   * Sem esta regra saía dia 0, que não é data nenhuma.
   */
  it('o dia 00 quer dizer o ÚLTIMO dia do mês', () => {
    expect(dataGs1ParaIso('271200', 2026)).toBe('2027-12-31');
    expect(dataGs1ParaIso('270400', 2026)).toBe('2027-04-30');
    expect(dataGs1ParaIso('270200', 2026)).toBe('2027-02-28');
    expect(dataGs1ParaIso('280200', 2026)).toBe('2028-02-29');
  });

  /**
   * O século não vem no código. A janela dos 50 anos é o que impede a validade
   * de um frasco comprado hoje ir parar a 1927 e a app o dar por estragado.
   */
  it('escolhe o século pela janela dos 50 anos', () => {
    expect(dataGs1ParaIso('300101', 2026)).toBe('2030-01-01');
    expect(dataGs1ParaIso('990101', 2026)).toBe('1999-01-01');
    expect(dataGs1ParaIso('760101', 2026)).toBe('2076-01-01');
  });

  it('recusa o que não é data', () => {
    expect(dataGs1ParaIso('271331', 2026)).toBeUndefined();
    expect(dataGs1ParaIso('27123', 2026)).toBeUndefined();
    expect(dataGs1ParaIso('AB1231', 2026)).toBeUndefined();
    expect(dataGs1ParaIso('270231', 2026)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------
 * Leitura
 * ------------------------------------------------------------------ */

describe('analisarCodigo — código de riscas', () => {
  it('um EAN-13 é só um número, e a chave vem normalizada', () => {
    const c = analisarCodigo('5601234567893');
    expect(c.tipo).toBe('ean');
    expect(c.chave).toBe('05601234567893');
    expect(c.lote).toBeUndefined();
    expect(c.validade).toBeUndefined();
  });

  it('guarda sempre o que a câmara leu, tal e qual', () => {
    expect(analisarCodigo('  5601234567893 ').bruto).toBe('5601234567893');
  });
});

describe('analisarCodigo — Data Matrix GS1', () => {
  /**
   * É a leitura que vale a pena: o lote e a validade são os dois campos mais
   * chatos de copiar à mão com o frasco na outra mão.
   */
  it('traz o produto, a validade e o lote', () => {
    const c = analisarCodigo(`0105601234567893172712311021AB77${GS}21SER99`, 2026);
    expect(c.tipo).toBe('gs1');
    expect(c.chave).toBe('05601234567893');
    expect(c.validade).toBe('2027-12-31');
    expect(c.lote).toBe('21AB77');
    expect(c.serie).toBe('SER99');
  });

  it('lê a forma com parênteses, que é a que está impressa por baixo', () => {
    const c = analisarCodigo('(01)05601234567893(17)271231(10)21AB77', 2026);
    expect(c.tipo).toBe('gs1');
    expect(c.chave).toBe('05601234567893');
    expect(c.validade).toBe('2027-12-31');
    expect(c.lote).toBe('21AB77');
  });

  it('tira o identificador de simbologia que alguns leitores põem à frente', () => {
    const c = analisarCodigo(`]d20105601234567893172712311021AB77`, 2026);
    expect(c.tipo).toBe('gs1');
    expect(c.chave).toBe('05601234567893');
    expect(c.lote).toBe('21AB77');
  });

  /**
   * Sem o separador entre campos variáveis, o lote comia o que vinha a seguir.
   * A ordem `10` antes de `17` acontece e tem de funcionar.
   */
  it('o lote acaba no separador e não engole o campo seguinte', () => {
    const c = analisarCodigo(`01056012345678931021AB77${GS}17271231`, 2026);
    expect(c.lote).toBe('21AB77');
    expect(c.validade).toBe('2027-12-31');
  });

  it('o lote sem separador a seguir vai até ao fim', () => {
    const c = analisarCodigo('01056012345678931021AB77', 2026);
    expect(c.lote).toBe('21AB77');
  });

  /**
   * Um identificador desconhecido tem comprimento desconhecido. Continuar a
   * cortar às cegas dava um lote com pedaços do campo seguinte lá dentro, e um
   * lote errado no registo de medicamentos é pior do que lote nenhum.
   */
  it('para num identificador que não conhece, em vez de adivinhar', () => {
    const c = analisarCodigo('01056012345678939912345678901234567890', 2026);
    expect(c.tipo).toBe('gs1');
    expect(c.chave).toBe('05601234567893');
    expect(c.lote).toBeUndefined();
  });

  /**
   * A guarda que impede um EAN-13 começado em "17" de ser lido como validade.
   */
  it('um EAN-13 que comece por 17 continua a ser um EAN-13', () => {
    const c = analisarCodigo('1712345678901');
    expect(c.tipo).toBe('ean');
    expect(c.chave).toBe('01712345678901');
    expect(c.validade).toBeUndefined();
  });
});

describe('analisarCodigo — etiquetas da app e o resto', () => {
  it('reconhece a etiqueta que a app imprime', () => {
    const c = analisarCodigo(etiquetaDeLote('abc-123'));
    expect(c.tipo).toBe('interno');
    expect(c.loteId).toBe('abc-123');
  });

  it('a ida e volta da etiqueta não perde nada', () => {
    expect(loteDaEtiqueta(etiquetaDeLote('abc-123'))).toBe('abc-123');
    expect(loteDaEtiqueta('outra coisa qualquer')).toBeUndefined();
    expect(loteDaEtiqueta('TBV1:LOTE:')).toBeUndefined();
  });

  /**
   * Nunca falha, de propósito: um código que a app não percebe continua a
   * servir de chave para reconhecer o mesmo frasco da próxima vez.
   */
  it('o que não se sabe ler guarda-se na mesma', () => {
    const c = analisarCodigo('QUALQUER-COISA-42');
    expect(c.tipo).toBe('texto');
    expect(c.chave).toBe('QUALQUER-COISA-42');
  });
});

/* ------------------------------------------------------------------
 * A memória de produtos
 * ------------------------------------------------------------------ */

describe('produtoConhecido — o catálogo é o histórico', () => {
  it('não conhece um código que nunca foi registado', () => {
    expect(produtoConhecido('05601234567893', [lote()])).toBeUndefined();
  });

  it('copia a identidade do produto e o que vem da bula', () => {
    const anterior = lote({ codigoBarras: '05601234567893', unidade: 'l', fornecedor: 'Agro-Nisa' });
    const p = produtoConhecido('05601234567893', [anterior]);
    expect(p?.nome).toBe('Penicilina');
    expect(p?.tipo).toBe('Medicamento');
    expect(p?.unidade).toBe('l');
    expect(p?.intervaloSegurancaDias).toBe(10);
    expect(p?.fornecedor).toBe('Agro-Nisa');
  });

  /**
   * O que muda de frasco para frasco (quantidade, lote, validade, custo) NÃO se
   * herda, e o tipo só expõe o que se herda. Este teste guarda essa fronteira:
   * propor a quantidade da compra anterior era pôr a app a mentir sobre a
   * arrecadação.
   */
  it('não traz nada do que muda de frasco para frasco', () => {
    const p = produtoConhecido('05601234567893', [lote({ codigoBarras: '05601234567893' })]);
    expect(Object.keys(p ?? {}).sort()).toEqual([
      'fornecedor',
      'intervaloSegurancaDias',
      'nome',
      'origem',
      'tipo',
      'unidade',
    ]);
  });

  it('entre vários, ganha a compra mais recente', () => {
    const antigo = lote({ id: 'm1', codigoBarras: 'X', nome: 'Antigo', dataCompra: '2025-01-01' });
    const novo = lote({ id: 'm2', codigoBarras: 'X', nome: 'Recente', dataCompra: '2026-06-01' });
    expect(produtoConhecido('X', [antigo, novo])?.nome).toBe('Recente');
  });

  /**
   * Quem tem duas quintas compra o mesmo antibiótico para as duas, e o
   * fornecedor costuma ser o de cada uma.
   */
  it('a exploração aberta ganha à compra mais recente da outra', () => {
    const outra = lote({
      id: 'm1',
      exploracaoId: 'exp-2',
      codigoBarras: 'X',
      nome: 'Da outra quinta',
      dataCompra: '2026-06-01',
    });
    const desta = lote({
      id: 'm2',
      exploracaoId: 'exp-1',
      codigoBarras: 'X',
      nome: 'Desta quinta',
      dataCompra: '2025-01-01',
    });
    expect(produtoConhecido('X', [outra, desta], 'exp-1')?.nome).toBe('Desta quinta');
  });
});

/* ------------------------------------------------------------------
 * Para onde vai a leitura
 * ------------------------------------------------------------------ */

describe('destinoDoCodigo — o que o botão de ler faz a seguir', () => {
  it('código nunca visto abre uma entrada nova', () => {
    const d = destinoDoCodigo('5601234567893', [lote()]);
    expect(d.tipo).toBe('novo');
    expect(d.codigo.chave).toBe('05601234567893');
  });

  it('código conhecido abre uma entrada nova já preenchida', () => {
    const d = destinoDoCodigo('5601234567893', [lote({ codigoBarras: '05601234567893' })]);
    expect(d.tipo).toBe('produto');
    if (d.tipo === 'produto') expect(d.produto.nome).toBe('Penicilina');
  });

  it('a etiqueta da app abre o frasco a que pertence', () => {
    const m = lote({ id: 'm7' });
    const d = destinoDoCodigo(etiquetaDeLote('m7'), [m]);
    expect(d.tipo).toBe('lote');
    if (d.tipo === 'lote') expect(d.medicamento.id).toBe('m7');
  });

  /**
   * A etiqueta de um lote eliminado (ou de outra conta) não pode dar erro: cai
   * para a entrada nova, que é o que a pessoa quer fazer com o frasco na mão.
   */
  it('etiqueta de um lote que já não existe cai para a entrada nova', () => {
    expect(destinoDoCodigo(etiquetaDeLote('desaparecido'), [lote()]).tipo).toBe('novo');
  });

  /**
   * Com lote lido do símbolo procura-se o FRASCO, não só o produto. É a
   * diferença entre "abre a Penicilina" e "abre ESTE frasco de Penicilina".
   */
  it('o Data Matrix de um frasco já registado abre esse frasco', () => {
    const registado = lote({ id: 'm9', codigoBarras: '05601234567893', lote: '21AB77' });
    const d = destinoDoCodigo(`0105601234567893172712311021AB77`, [registado], 'exp-1', 2026);
    expect(d.tipo).toBe('lote');
    if (d.tipo === 'lote') expect(d.medicamento.id).toBe('m9');
  });

  it('o mesmo produto com OUTRO lote abre uma entrada nova preenchida', () => {
    const registado = lote({ id: 'm9', codigoBarras: '05601234567893', lote: 'PN-1' });
    const d = destinoDoCodigo(`0105601234567893172712311021AB77`, [registado], 'exp-1', 2026);
    expect(d.tipo).toBe('produto');
    expect(d.codigo.lote).toBe('21AB77');
    expect(d.codigo.validade).toBe('2027-12-31');
  });
});
