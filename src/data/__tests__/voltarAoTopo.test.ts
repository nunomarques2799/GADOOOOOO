/**
 * Voltar ao topo ao tocar outra vez no separador.
 *
 * Porquê testar uma coisa tão pequena: os três contentores que a app usa não
 * concordam no método de rolar, e chamar o errado NÃO DÁ ERRO — não faz nada.
 * Um `scrollTo` numa `FlatList` é exatamente isto: um toque que parece morto, e
 * ninguém liga o sintoma à causa.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { esquecerListas, registarLista, voltarAoTopo } from '../voltarAoTopo';

describe('voltarAoTopo', () => {
  beforeEach(() => esquecerListas());

  it('sem lista registada, diz que não fez nada', () => {
    // Quem chama precisa de saber: um ecrã que não rola continua a poder
    // navegar em vez de ficar preso num toque sem efeito.
    expect(voltarAoTopo('index')).toBe(false);
  });

  it('rola um ScrollView pelo `scrollTo`', () => {
    const scrollTo = jest.fn();
    registarLista('index', { scrollTo });
    expect(voltarAoTopo('index')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it('rola uma FlatList pelo `scrollToOffset`', () => {
    const scrollToOffset = jest.fn();
    registarLista('animais', { scrollToOffset });
    expect(voltarAoTopo('animais')).toBe(true);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true });
  });

  it('rola uma SectionList pelo responder de dentro', () => {
    // A `SectionList` não tem `scrollTo` nem `scrollToOffset`. Sem este
    // caminho, o separador dos Terrenos era o único onde o toque não fazia nada.
    const scrollTo = jest.fn();
    registarLista('terrenos', { getScrollResponder: () => ({ scrollTo }) });
    expect(voltarAoTopo('terrenos')).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
  });

  it('sempre com animação', () => {
    // O pedido era "com animação": um salto seco faz perder o sítio onde se
    // estava, e a lista parece ter mudado de conteúdo em vez de ter subido.
    const scrollToOffset = jest.fn();
    registarLista('alertas', { scrollToOffset });
    voltarAoTopo('alertas');
    expect(scrollToOffset).toHaveBeenCalledWith(expect.objectContaining({ animated: true }));
  });

  it('cada separador tem a sua lista', () => {
    const inicio = jest.fn();
    const alertas = jest.fn();
    registarLista('index', { scrollTo: inicio });
    registarLista('alertas', { scrollTo: alertas });
    voltarAoTopo('alertas');
    expect(alertas).toHaveBeenCalled();
    expect(inicio).not.toHaveBeenCalled();
  });

  it('desmontar o ecrã apaga o registo', () => {
    // É o `ref` a devolver `null`. Sem isto ficava aqui uma referência a uma
    // lista que já saiu do ecrã, e o toque seguinte ia bater nela.
    registarLista('index', { scrollTo: jest.fn() });
    registarLista('index', null);
    expect(voltarAoTopo('index')).toBe(false);
  });
});
