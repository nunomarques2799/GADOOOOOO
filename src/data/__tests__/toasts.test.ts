import { describe, expect, it } from '@jest/globals';

import {
  acrescentar,
  DURACAO_MS,
  MAX_TOASTS,
  mensagemDeErro,
  remover,
  type Toast,
} from '../toasts';

function toast(id: number, mensagem: string, tipo: Toast['tipo'] = 'sucesso'): Toast {
  return { id, tipo, mensagem };
}

describe('fila de avisos', () => {
  it('o mais recente fica no fim (é o que se lê primeiro, em baixo)', () => {
    const fila = acrescentar(acrescentar([], toast(1, 'A')), toast(2, 'B'));
    expect(fila.map((t) => t.mensagem)).toEqual(['A', 'B']);
  });

  it('nunca passa do teto — os mais antigos saem', () => {
    let fila: Toast[] = [];
    for (let i = 1; i <= MAX_TOASTS + 2; i++) fila = acrescentar(fila, toast(i, `msg ${i}`));
    expect(fila).toHaveLength(MAX_TOASTS);
    // Ficam os últimos: o que interessa é o que acabou de acontecer.
    expect(fila[fila.length - 1].mensagem).toBe(`msg ${MAX_TOASTS + 2}`);
  });

  it('a mensagem repetida substitui a anterior em vez de empilhar', () => {
    // O toque duplo no botão de guardar dava dois cartões iguais.
    const fila = acrescentar(acrescentar([], toast(1, 'Animal registado')), toast(2, 'Animal registado'));
    expect(fila).toHaveLength(1);
    // Com id novo: é o id que manda no temporizador, e a contagem tem de voltar
    // ao início — senão o segundo aviso desaparecia mais depressa que o primeiro.
    expect(fila[0].id).toBe(2);
  });

  it('mensagens diferentes com o mesmo texto mas detalhe diferente não se juntam', () => {
    const fila = acrescentar(
      acrescentar([], { id: 1, tipo: 'sucesso', mensagem: 'Animal registado', detalhe: 'Mimosa' }),
      { id: 2, tipo: 'sucesso', mensagem: 'Animal registado', detalhe: 'Estrela' },
    );
    expect(fila).toHaveLength(2);
  });

  it('o mesmo texto com gravidade diferente não se junta', () => {
    // "Terreno não adicionado" a verde por cima de um erro seria mentira.
    const fila = acrescentar(acrescentar([], toast(1, 'Guardado')), toast(2, 'Guardado', 'erro'));
    expect(fila).toHaveLength(2);
  });

  it('remover tira só o indicado', () => {
    const fila = [toast(1, 'A'), toast(2, 'B'), toast(3, 'C')];
    expect(remover(fila, 2).map((t) => t.id)).toEqual([1, 3]);
  });

  it('remover um id que já saiu não mexe na fila', () => {
    // Acontece sempre: o temporizador dispara depois de o criador tocar para fechar.
    const fila = [toast(1, 'A')];
    expect(remover(fila, 99)).toEqual(fila);
  });

  it('o erro fica no ecrã bastante mais tempo do que a confirmação', () => {
    // Um "gravado" confirma-se na lista por baixo; um erro tem texto do servidor
    // para ler e é a única cópia da má notícia.
    expect(DURACAO_MS.erro).toBeGreaterThan(DURACAO_MS.sucesso * 2);
  });
});

describe('mensagemDeErro', () => {
  it('usa a mensagem do erro', () => {
    expect(mensagemDeErro(new Error('Sem ligação ao servidor.'))).toBe('Sem ligação ao servidor.');
  });

  it('aceita o que não é Error', () => {
    expect(mensagemDeErro('falhou')).toBe('falhou');
  });

  it('nunca devolve vazio — um aviso em branco não diz nada', () => {
    expect(mensagemDeErro(new Error('   '))).toBe('Ocorreu um erro inesperado.');
    expect(mensagemDeErro(undefined)).toBe('Ocorreu um erro inesperado.');
    expect(mensagemDeErro(null)).toBe('Ocorreu um erro inesperado.');
  });
});
