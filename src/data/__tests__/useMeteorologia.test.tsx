/**
 * A meteorologia não pode ficar presa a carregar para sempre.
 *
 * O que aconteceu: o efeito que vai buscar o tempo dependia de OBJETOS
 * recriados a cada render — o array de `terrenosByExploracao()` e o
 * `LocalMeteo` montado a partir dele. Cada render dava dependências novas, o
 * efeito voltava a correr, abortava o pedido anterior antes de ele chegar e
 * punha o estado outra vez em 'a-carregar'. O pedido nunca terminava, e o
 * cartão ficava com o indicador a rodar indefinidamente.
 *
 * Só acontecia a QUEM TINHA COORDENADAS: sem elas o valor calculado era `null`,
 * que é estável, e o ciclo não se fechava. Por isso o teste dá coordenadas.
 *
 * O que isto prova: com o store a devolver arrays novos em cada chamada (que é
 * o que ele faz de verdade), o pedido é feito UMA vez e o estado assenta em
 * 'atual'. Sem a correção, `fetchMeteorologia` é chamada vezes sem conta e o
 * estado nunca sai de 'a-carregar'.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import type { Meteorologia } from '../types';

const TEMPO: Meteorologia = {
  local: 'Idanha-a-Nova',
  temperatura: 24,
  condicao: 'Céu limpo',
  icone: 'weather-sunny',
  humidade: 40,
  vento: 8,
  precipitacao: 0,
  maxima: 30,
  minima: 12,
  conselho: 'Tempo calmo: bom dia para trabalhos no campo.',
  dias: [],
};

/** Quantas vezes o hook pediu o tempo ao servidor. */
const chamadas = { fetch: 0 };

jest.mock('../weather', () => ({
  fetchMeteorologia: jest.fn(async () => {
    chamadas.fetch++;
    return TEMPO;
  }),
}));

/**
 * O store a portar-se como o verdadeiro: `terrenosByExploracao` devolve um
 * ARRAY NOVO em cada chamada (é um `filter` dentro de um `useCallback`), e é
 * exatamente isso que fazia o efeito disparar sem fim.
 */
jest.mock('../store', () => ({
  useGado: () => ({
    exploracaoById: () => ({
      id: 'exp-1',
      utilizadorId: 'u-1',
      nome: 'Monte do Avô',
      marcaExploracao: 'PT 00 000 0000',
      nifDetentor: '000000000',
      localizacao: 'Idanha-a-Nova',
    }),
    terrenosByExploracao: () => [
      { id: 't-1', exploracaoId: 'exp-1', nome: 'Lameiro', latitude: 39.92, longitude: -7.24 },
    ],
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useMeteorologia } = require('../useMeteorologia') as typeof import('../useMeteorologia');

/** Um componente que só existe para expor o que o hook devolve. */
function Sonda({ aoRender }: { aoRender: (estado: string) => void }) {
  const { estado } = useMeteorologia('exp-1');
  aoRender(estado);
  return <Text>{estado}</Text>;
}

describe('useMeteorologia', () => {
  beforeEach(() => {
    chamadas.fetch = 0;
  });

  it('pede o tempo uma só vez e assenta em "atual"', async () => {
    let ultimo = '';
    await act(async () => {
      create(<Sonda aoRender={(e) => { ultimo = e; }} />);
    });

    // Deixa correr as promessas todas: se houvesse ciclo, cada volta agendava
    // outra e a contagem subiria.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(chamadas.fetch).toBe(1);
    expect(ultimo).toBe('atual');
  });

  it('não volta a pedir quando o componente torna a desenhar sem nada mudar', async () => {
    let arvore: ReturnType<typeof create> | undefined;
    await act(async () => {
      arvore = create(<Sonda aoRender={() => undefined} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(chamadas.fetch).toBe(1);

    // Um render novo com as MESMAS coordenadas: os arrays vêm outra vez novos
    // do store, mas os valores não mudaram — logo, nada a pedir.
    await act(async () => {
      arvore?.update(<Sonda aoRender={() => undefined} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(chamadas.fetch).toBe(1);
  });
});
