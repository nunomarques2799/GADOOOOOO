/**
 * O indicador de "a atualizar" é um só para a app inteira, e a loja que o
 * acende conta atualizações em vez de guardar um sim/não. Com um booleano, dois
 * ecrãs a atualizar ao mesmo tempo apagavam o indicador quando o PRIMEIRO
 * acabasse, com o segundo ainda a correr. E um `acabar` a mais (uma falha que
 * passe duas vezes pelo `finally`) não pode deixar a conta negativa, senão a
 * próxima atualização nunca chegava a acender nada.
 */

import { describe, expect, it } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { acabarAtualizar, comecarAtualizar, useAAtualizar } from '../IndicadorAtualizar';

function Sonda() {
  return <Text>{useAAtualizar() ? 'sim' : 'nao'}</Text>;
}

function estado(r: ReturnType<typeof create>) {
  return r.root.findByType(Text).props.children as string;
}

describe('IndicadorAtualizar', () => {
  it('fica aceso enquanto houver alguma atualização a correr', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Sonda />);
    });
    expect(estado(r)).toBe('nao');

    act(() => {
      comecarAtualizar();
      comecarAtualizar();
    });
    expect(estado(r)).toBe('sim');

    act(() => acabarAtualizar());
    expect(estado(r)).toBe('sim');

    act(() => acabarAtualizar());
    expect(estado(r)).toBe('nao');
  });

  it('um acabar a mais não deixa a conta negativa', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Sonda />);
    });
    act(() => {
      acabarAtualizar();
      acabarAtualizar();
    });
    act(() => comecarAtualizar());
    expect(estado(r)).toBe('sim');
    act(() => acabarAtualizar());
    expect(estado(r)).toBe('nao');
  });
});
