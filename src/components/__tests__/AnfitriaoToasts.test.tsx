/**
 * Os avisos curtos, montados como a app os monta.
 *
 * A fila em si está coberta em `data/__tests__/toasts.test.ts`. O que falta
 * provar é a parte que só se vê a correr: que o aviso aparece no ecrã, que
 * desaparece sozinho passado o seu tempo, e que tocar nele o fecha antes disso.
 * Um aviso que não se apaga fica a tapar a lista para sempre — e é a única forma
 * de o descobrir sem ser no telemóvel de quem usa a app.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Pressable } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { AnfitriaoToasts } from '@/components/AnfitriaoToasts';
import { DURACAO_MS, ToastsProvider, useToasts } from '@/data/toasts';

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Um botão qualquer que manda um aviso, como um formulário faria. */
function BotaoQueAvisa({ tipo }: { tipo: 'sucesso' | 'erro' }) {
  const toast = useToasts();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="disparar"
      onPress={() =>
        tipo === 'sucesso'
          ? toast.sucesso('Animal registado', 'Mimosa')
          : toast.erro('Animal não registado', 'Sem permissão.')
      }
    />
  );
}

function textos(r: ReactTestRenderer): string {
  const juntar = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(juntar).join(' ');
    if (no && typeof no === 'object' && 'children' in no) {
      return juntar((no as { children: unknown }).children);
    }
    return '';
  };
  return juntar(r.toJSON());
}

function tocar(r: ReactTestRenderer, rotulo: string) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.accessibilityLabel === rotulo);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  act(() => (no.props.onPress as () => void)());
}

function montar(tipo: 'sucesso' | 'erro' = 'sucesso') {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ToastsProvider>
          <BotaoQueAvisa tipo={tipo} />
          <AnfitriaoToasts />
        </ToastsProvider>
      </SafeAreaProvider>,
    );
  });
  return r;
}

describe('avisos no ecrã', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('não desenha nada enquanto não houver avisos', () => {
    const r = montar();
    expect(textos(r)).not.toContain('Animal');
  });

  it('mostra a mensagem e o detalhe de quem gravou', () => {
    const r = montar();
    tocar(r, 'disparar');
    const t = textos(r);
    expect(t).toContain('Animal registado');
    expect(t).toContain('Mimosa');
  });

  it('desaparece sozinho passado o seu tempo', () => {
    const r = montar();
    tocar(r, 'disparar');
    act(() => {
      jest.advanceTimersByTime(DURACAO_MS.sucesso - 1);
    });
    expect(textos(r)).toContain('Animal registado');
    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(textos(r)).not.toContain('Animal registado');
  });

  it('o erro ainda está no ecrã quando um "gravado" já teria saído', () => {
    const r = montar('erro');
    tocar(r, 'disparar');
    act(() => {
      jest.advanceTimersByTime(DURACAO_MS.sucesso + 1);
    });
    expect(textos(r)).toContain('Animal não registado');
    expect(textos(r)).toContain('Sem permissão.');
  });

  it('tocar no aviso fecha-o logo', () => {
    const r = montar();
    tocar(r, 'disparar');
    tocar(r, 'Animal registado. Mimosa');
    expect(textos(r)).not.toContain('Animal registado');
  });
});
