/**
 * As perguntas frequentes abrem-se com movimento, e não de um salto.
 *
 * O que interessa provar não é o aspeto — é que a resposta CHEGA a abrir-se.
 * Uma resposta que cresce até uma altura medida tem duas maneiras silenciosas
 * de ficar a zero para sempre: a medição nunca acontecer, e a mola nunca ser
 * mandada correr. Nas duas, a app fica com uma pergunta que não responde nada e
 * ninguém repara em código nenhum.
 *
 * O `onLayout` é disparado à mão porque não há ecrã nenhum a medir nada num
 * teste. É exatamente essa a dependência que se está a provar.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Animated } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

jest.mock('expo-router', () => {
  const router = { push: () => {}, back: () => {}, navigate: () => {} };
  return { useRouter: () => router };
});

// O ecrã traz consigo o formulário de apoio, e esse traz o Supabase — que sem
// módulos nativos nem sequer se deixa importar. Nada disto está em causa aqui.
jest.mock('@/data/supabase', () => ({ supabase: null, supabaseConfigurado: false }));

import AjudaScreen from '../ajuda';

const PERGUNTA = 'Posso usar a app sem internet?';
/** Quanto mede a resposta depois de desenhada. Um valor qualquer, mas o mesmo. */
const ALTURA_DA_RESPOSTA = 96;

function desenhar(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <AjudaScreen />
      </SafeAreaProvider>,
    );
  });
  return r;
}

/** A caixa que corta a resposta — a que tem a altura animada. */
function caixaDaResposta(r: ReactTestRenderer) {
  const caixa = r.root
    .findAllByType(Animated.View)
    .find((n) => n.props.style?.overflow === 'hidden');
  if (!caixa) throw new Error('Não há caixa nenhuma a cortar a resposta');
  return caixa;
}

/** A altura de facto, agora — a interpolação já resolvida em número. */
function alturaAgora(r: ReactTestRenderer): number {
  const altura = caixaDaResposta(r).props.style.height;
  return typeof altura === 'number' ? altura : Number(altura.__getValue());
}

function medir(r: ReactTestRenderer, altura: number) {
  const interior = caixaDaResposta(r).findAll((n) => typeof n.props?.onLayout === 'function')[0];
  act(() => {
    (interior.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { height: altura } } });
  });
}

function tocarNaPergunta(r: ReactTestRenderer) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.accessibilityLabel === PERGUNTA);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${PERGUNTA}"`);
  act(() => (no.props.onPress as () => void)());
}

/** Deixa a mola correr até assentar. */
function deixarAnimar() {
  act(() => {
    jest.advanceTimersByTime(2000);
  });
}

describe('perguntas frequentes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  it('nasce fechada, com a resposta fora do alcance de quem lê o ecrã', () => {
    const r = desenhar();
    medir(r, ALTURA_DA_RESPOSTA);
    expect(alturaAgora(r)).toBe(0);
    expect(caixaDaResposta(r).props['aria-hidden']).toBe(true);
    expect(caixaDaResposta(r).props.style.pointerEvents).toBe('none');
  });

  it('abre até à altura medida da resposta', () => {
    const r = desenhar();
    medir(r, ALTURA_DA_RESPOSTA);
    tocarNaPergunta(r);
    deixarAnimar();
    expect(alturaAgora(r)).toBeCloseTo(ALTURA_DA_RESPOSTA, 1);
    expect(caixaDaResposta(r).props['aria-hidden']).toBe(false);
  });

  it('passa por alturas pelo meio — cresce, não salta', () => {
    const r = desenhar();
    medir(r, ALTURA_DA_RESPOSTA);
    tocarNaPergunta(r);
    // Um fotograma depois de começar já não está fechada e ainda não chegou ao
    // fim. É esta linha que falha se alguém trocar a mola por um `setState`.
    act(() => {
      jest.advanceTimersByTime(50);
    });
    const meio = alturaAgora(r);
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(ALTURA_DA_RESPOSTA);
  });

  it('fecha outra vez, e volta a zero sem passar por alturas negativas', () => {
    const r = desenhar();
    medir(r, ALTURA_DA_RESPOSTA);
    tocarNaPergunta(r);
    deixarAnimar();
    tocarNaPergunta(r);
    // A mola do fecho passa do sítio; sem o `extrapolateLeft: 'clamp'` isto dava
    // alturas negativas, que o Yoga trata como se a resposta continuasse aberta.
    for (let i = 0; i < 40; i++) {
      act(() => {
        jest.advanceTimersByTime(16);
      });
      expect(alturaAgora(r)).toBeGreaterThanOrEqual(0);
    }
    deixarAnimar();
    expect(alturaAgora(r)).toBe(0);
    expect(caixaDaResposta(r).props['aria-hidden']).toBe(true);
  });
});
