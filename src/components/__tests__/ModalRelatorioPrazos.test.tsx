/**
 * A janela do relatório de prazos, desenhada a sério.
 *
 * Os filtros em si estão cobertos em `data/__tests__/exportar.test.ts`. O que
 * falta provar é a ligação ao ecrã: que tocar num chip muda o que vai sair, e
 * que os dois destinos (imprimir e PDF) levam exatamente os prazos escolhidos —
 * era esse o risco de juntar as duas ações numa só linha do menu.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// `mock…` no nome: é a única forma de o jest deixar a fábrica do mock ver a
// variável (o hoisting do jest.mock corre antes das declarações).
const mockImprimir = jest.fn((_titulo: string, _html: string) => true);
const mockGuardar = jest.fn(async (_titulo: string, _html: string, _nome: string) => ({
  estado: 'guardado' as const,
}));

jest.mock('@/data/exportar', () => ({
  ...jest.requireActual<typeof import('@/data/exportar')>('@/data/exportar'),
  imprimirRelatorio: (titulo: string, html: string) => mockImprimir(titulo, html),
  guardarRelatorio: (titulo: string, html: string, nome: string) =>
    mockGuardar(titulo, html, nome),
}));

import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ModalRelatorioPrazos } from '../ModalRelatorioPrazos';
import type { Alerta, Exploracao } from '@/data/types';

/** Medidas fixas: sem elas o provider mede o ecrã e não há ecrã nenhum. */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function alerta(id: string, over: Partial<Alerta> = {}): Alerta {
  return {
    id,
    categoria: 'snira',
    gravidade: 'aviso',
    titulo: `Prazo ${id}`,
    descricao: `Descrição ${id}`,
    ...over,
  };
}

const ALERTAS: Alerta[] = [
  alerta('1', { gravidade: 'urgente', diasRestantes: -2, categoria: 'snira' }),
  alerta('2', { diasRestantes: 4, categoria: 'parto' }),
  alerta('3', { gravidade: 'info', categoria: 'vacinacao' }), // sem prazo a correr
];

const EXPLORACOES: Exploracao[] = [];

/** Todo o texto que a janela mostra, em bruto. */
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
    .find((n) => n.props.accessibilityLabel === rotulo || n.props.label === rotulo);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  act(() => {
    (no.props.onPress as () => void)();
  });
}

function abrir() {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ModalRelatorioPrazos
          visivel
          alertas={ALERTAS}
          exploracoes={EXPLORACOES}
          onFechar={jest.fn()}
        />
      </SafeAreaProvider>,
    );
  });
  return r;
}

describe('ModalRelatorioPrazos', () => {
  beforeEach(() => {
    mockImprimir.mockClear();
    mockGuardar.mockClear();
  });

  it('abre com todos os prazos e diz quantos vão sair', () => {
    const r = abrir();
    expect(textos(r)).toContain('3 prazos no relatório');
    expect(textos(r)).toContain('Todos os prazos');
  });

  it('escolher "Só o que está em atraso" muda a contagem antes de imprimir', () => {
    const r = abrir();
    tocar(r, 'Só o que está em atraso');
    expect(textos(r)).toContain('1 prazo no relatório');
  });

  it('imprime só os prazos escolhidos', () => {
    const r = abrir();
    tocar(r, 'Só o que está em atraso');
    tocar(r, 'Imprimir');

    expect(mockImprimir).toHaveBeenCalledTimes(1);
    const html = mockImprimir.mock.calls[0][1] as string;
    expect(html).toContain('Prazo 1');
    expect(html).not.toContain('Prazo 2'); // não está em atraso
    // O relatório diz o que traz, para não passar por retrato completo.
    expect(html).toContain('Só o que está em atraso');
  });

  it('o botão do PDF leva o mesmo conteúdo que o de imprimir', async () => {
    const r = abrir();
    tocar(r, 'Urgentes');
    tocar(r, 'Descarregar PDF');
    await act(async () => {});

    expect(mockGuardar).toHaveBeenCalledTimes(1);
    const [, html, nome] = mockGuardar.mock.calls[0] as [string, string, string];
    expect(html).toContain('Prazo 1');
    expect(html).not.toContain('Prazo 3');
    expect(nome).toMatch(/^prazos-\d{4}-\d{2}-\d{2}$/);
  });

  it('sem prazos escolhidos não deixa imprimir uma folha vazia', () => {
    const r = abrir();
    // Assunto que nenhum destes alertas tem.
    tocar(r, 'Medicamentos');
    expect(textos(r)).toContain('Nenhum prazo escolhido');
    const botao = r.root
      .findAll((n) => typeof n.props?.onPress === 'function')
      .find((n) => n.props.label === 'Imprimir');
    expect(botao?.props.disabled).toBe(true);
  });
});
