/**
 * O que se guarda aqui é uma regra de HTML, não um detalhe de estilo: na web,
 * `accessibilityRole="button"` do React Native passa a `<button>`, e um
 * `<button>` dentro de outro é inválido — o React parte com "cannot contain a
 * nested <button>" e o formulário do animal abre com um erro por cima.
 *
 * Aconteceu com o botão de limpar, que vivia dentro do campo. O teste olha para
 * a árvore e recusa qualquer botão descendente de outro botão, seja qual for a
 * razão que apareça para o voltar a pôr lá dentro.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { Pressable, View } from 'react-native';
import { act, create, type ReactTestRenderer, type ReactTestRendererJSON } from 'react-test-renderer';

import { SeletorOpcao } from '../SeletorOpcao';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type No = ReactTestRendererJSON;
type PropsNo = { accessibilityRole?: string; accessibilityLabel?: string };

/** Rótulos de todos os botões que descendem de outro botão. */
function botoesAninhados(no: No | null, dentroDeBotao = false): string[] {
  if (!no || typeof no !== 'object') return [];
  const props = (no.props ?? {}) as PropsNo;
  const eBotao = props.accessibilityRole === 'button';
  const encontrados = eBotao && dentroDeBotao ? [props.accessibilityLabel ?? '(sem rótulo)'] : [];
  const filhos = (no.children ?? []) as (No | string)[];
  return [
    ...encontrados,
    ...filhos.flatMap((f) =>
      typeof f === 'string' ? [] : botoesAninhados(f, dentroDeBotao || eBotao),
    ),
  ];
}

/** Rótulos de todos os botões, aninhados ou não. */
function todosOsBotoes(no: No | string | null, acc: string[] = []): string[] {
  if (!no || typeof no !== 'object') return acc;
  const props = (no.props ?? {}) as PropsNo;
  if (props.accessibilityRole === 'button' && props.accessibilityLabel) {
    acc.push(props.accessibilityLabel);
  }
  ((no.children ?? []) as (No | string)[]).forEach((f) => todosOsBotoes(f, acc));
  return acc;
}

/** Renderiza dentro de `act`: sem isso `toJSON()` vem null e tudo passa vazio. */
function arvore(elemento: React.ReactElement): No | null {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(elemento);
  });
  return r.toJSON() as No | null;
}

function seletor(valor?: string) {
  return arvore(
    <SeletorOpcao
      titulo="Raça"
      valor={valor}
      opcoes={['Mertolenga', 'Charolesa']}
      onEscolher={() => {}}
    />,
  );
}

describe('SeletorOpcao', () => {
  it('com um valor escolhido, o botão de limpar não fica dentro do campo', () => {
    expect(botoesAninhados(seletor('Mertolenga'))).toEqual([]);
  });

  it('sem valor escolhido também não aninha botões', () => {
    expect(botoesAninhados(seletor())).toEqual([]);
  });

  it('os dois botões continuam lá — abrir a lista e limpar a escolha', () => {
    // Sem esta verificação, os testes de cima passavam à mesma se a árvore
    // viesse vazia (foi o que aconteceu antes do `act`).
    const rotulos = todosOsBotoes(seletor('Mertolenga'));
    expect(rotulos).toContain('Raça: Mertolenga');
    expect(rotulos).toContain('Limpar raça');
  });

  it('e o detetor apanha mesmo um botão dentro de outro', () => {
    // A forma que o componente tinha antes. Se isto passasse a devolver [], os
    // testes de cima deixavam de provar seja o que for.
    const aninhado = arvore(
      <Pressable accessibilityRole="button" accessibilityLabel="fora">
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="dentro" />
        </View>
      </Pressable>,
    );
    expect(botoesAninhados(aninhado)).toEqual(['dentro']);
  });
});
