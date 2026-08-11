/**
 * O separador Terrenos quando ainda não há terreno nenhum.
 *
 * O agrupamento está coberto em `data/__tests__/terrenos.test.ts`. O que falta
 * provar é que uma conta acabada de criar TEM por onde adicionar: a lista é por
 * secções, e uma lista por secções conta os cabeçalhos e rodapés de cada secção
 * como itens — com uma exploração criada e nenhum terreno, ela já não está
 * "vazia" aos olhos do React Native e o `ListEmptyComponent` nunca chegava a
 * aparecer. Como o cabeçalho de grupo (onde vive o "NOVO") está escondido
 * quando só há uma exploração, e o botão flutuante exige terrenos, o separador
 * ficava com o título e mais nada. Era esse o ecrã de quem instalava a app.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Animal, Exploracao, Terreno } from '@/data/types';

/** Medidas fixas: sem elas o provider mede o ecrã e não há ecrã nenhum. */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockDados = {
  exploracoes: [] as Exploracao[],
  terrenos: [] as Terreno[],
  animais: [] as Animal[],
};

const mockAcesso = {
  pode: () => true,
  estadoPerfil: 'ativo' as string,
};

const mockRotas: string[] = [];

jest.mock('expo-router', () => {
  const router = {
    push: (destino: unknown) =>
      mockRotas.push(
        typeof destino === 'string'
          ? destino
          : (destino as { pathname: string }).pathname,
      ),
  };
  return { useRouter: () => router };
});
jest.mock('@/data/store', () => ({ useGado: () => mockDados }));
jest.mock('@/data/membros', () => ({ useMembros: () => mockAcesso }));
jest.mock('@/hooks/useAtualizarPuxando', () => ({
  useAtualizarPuxando: () => ({ controlo: undefined }),
}));
jest.mock('@/hooks/useDesktop', () => ({ useDesktop: () => false }));

import TerrenosScreen from '../terrenos';

function exploracao(id: string, nome: string): Exploracao {
  return { id, nome } as Exploracao;
}

function terreno(id: string, nome: string, exploracaoId: string): Terreno {
  return { id, nome, exploracaoId } as Terreno;
}

/** Todo o texto que o ecrã mostra, em bruto. */
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

/** Os rótulos de tudo o que é tocável no ecrã. */
function tocaveis(r: ReactTestRenderer): string[] {
  return r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .map((n) => String(n.props.label ?? n.props.accessibilityLabel ?? ''));
}

function tocar(r: ReactTestRenderer, rotulo: string) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.label === rotulo || n.props.accessibilityLabel === rotulo);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  act(() => (no.props.onPress as () => void)());
}

function abrir(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <TerrenosScreen />
      </SafeAreaProvider>,
    );
  });
  return r;
}

describe('separador Terrenos vazio', () => {
  beforeEach(() => {
    mockDados.exploracoes = [];
    mockDados.terrenos = [];
    mockDados.animais = [];
    mockAcesso.pode = () => true;
    mockAcesso.estadoPerfil = 'ativo';
    mockRotas.length = 0;
  });

  it('com uma exploração e nenhum terreno, dá por onde adicionar', () => {
    mockDados.exploracoes = [exploracao('e1', 'Monte do Avô')];
    const r = abrir();
    expect(tocaveis(r)).toContain('Novo terreno');
    tocar(r, 'Novo terreno');
    expect(mockRotas).toEqual(['/terreno/novo']);
  });

  it('explica para que servem os terrenos a quem nunca registou nenhum', () => {
    mockDados.exploracoes = [exploracao('e1', 'Monte do Avô')];
    expect(textos(abrir())).toContain('pastagens');
  });

  it('sem exploração nenhuma, manda criar primeiro a exploração', () => {
    const r = abrir();
    expect(textos(r)).toContain('Os terrenos pertencem a uma exploração');
    tocar(r, 'Nova exploração');
    expect(mockRotas).toEqual(['/exploracao/nova']);
  });

  it('não oferece criar a exploração a quem ainda não foi aprovado', () => {
    mockAcesso.estadoPerfil = 'pendente';
    expect(tocaveis(abrir())).not.toContain('Nova exploração');
  });

  it('a quem não gere terrenos, diz de quem é a tarefa em vez de oferecer o botão', () => {
    mockDados.exploracoes = [exploracao('e1', 'Monte do Avô')];
    mockAcesso.pode = () => false;
    const r = abrir();
    expect(tocaveis(r)).not.toContain('Novo terreno');
    expect(textos(r)).toContain('Quem a gere é que os pode registar');
  });

  it('com terrenos já registados, o convite sai da frente', () => {
    mockDados.exploracoes = [exploracao('e1', 'Monte do Avô')];
    mockDados.terrenos = [terreno('t1', 'Courela de Baixo', 'e1')];
    const r = abrir();
    expect(textos(r)).toContain('Courela de Baixo');
    expect(textos(r)).not.toContain('Sem terrenos');
    // Com terrenos, criar é pelo botão flutuante. Ele passou a ser só o sinal
    // "+", por isso "Novo terreno" é agora o rótulo FALADO (ver `FAB`).
    expect(tocaveis(r)).toContain('Novo terreno');
  });

  it('com várias explorações, cada grupo tem o seu "NOVO" e não se repete o convite', () => {
    mockDados.exploracoes = [exploracao('e1', 'Monte do Avô'), exploracao('e2', 'Corgas')];
    const r = abrir();
    expect(textos(r)).not.toContain('Sem terrenos');
    expect(tocaveis(r)).toContain('Novo terreno em Monte do Avô');
    expect(tocaveis(r)).toContain('Novo terreno em Corgas');
  });
});
