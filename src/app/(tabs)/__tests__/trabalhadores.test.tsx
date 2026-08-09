/**
 * O ecrã Trabalhadores com equipa a sério.
 *
 * O agrupamento por pessoa está coberto em `data/__tests__/trabalhadores.test.ts`.
 * O que falta provar é o ecrã: que mostra quem trabalha onde, que o filtro por
 * exploração estreita a lista, que o dono não aparece na sua própria equipa e
 * que os convites por usar não se perdem. No modo demo não há Supabase — logo,
 * não há equipa nenhuma para ver na app a correr, e é aqui que isto se verifica.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { PermissoesMembro } from '@/data/permissoes';
import type { Convite, Exploracao, MembroExploracao, RoleMembro } from '@/data/types';

/** Medidas fixas: sem elas o provider mede o ecrã e não há ecrã nenhum. */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const EXPLORACOES = [
  { id: 'e1', nome: 'Monte do Avô' },
  { id: 'e2', nome: 'Herdade das Corgas' },
] as Exploracao[];

type MembroComNome = MembroExploracao & { nome: string };

function membro(
  id: string,
  userId: string,
  nome: string,
  role: RoleMembro,
  exploracaoId: string,
  permissoes?: PermissoesMembro,
): MembroComNome {
  return { id, userId, nome, role, exploracaoId, permissoes };
}

const EQUIPAS: Record<string, MembroComNome[]> = {
  e1: [
    membro('m1', 'dono', 'Joaquim Marques', 'admin', 'e1'),
    membro('m2', 'u1', 'Zé Silva', 'trabalhador', 'e1'),
    membro('m3', 'u2', 'Bento Vet', 'veterinario', 'e1'),
  ],
  e2: [
    membro('m4', 'dono', 'Joaquim Marques', 'admin', 'e2'),
    // Com uma permissão já tirada à mão — é o caso que a lista tem de marcar.
    membro('m5', 'u1', 'Zé Silva', 'trabalhador', 'e2', { gerirTerrenos: false }),
    membro('m6', 'u3', 'Ana Pastora', 'trabalhador', 'e2'),
    // Um segundo dono: aparece na lista (não é o próprio) e não se ajusta.
    membro('m7', 'u4', 'Sócia Dona', 'admin', 'e2'),
  ],
};

const CONVITES: Record<string, Convite[]> = {
  e1: [{ codigo: 'ABC123', exploracaoId: 'e1', role: 'trabalhador', criadoPor: 'dono' }],
  e2: [
    // Já usado: não é um convite à espera.
    { codigo: 'USADO1', exploracaoId: 'e2', role: 'trabalhador', criadoPor: 'dono', usadoPor: 'u3' },
  ],
};

const mockListarMembros = jest.fn(async (id: string) => EQUIPAS[id] ?? []);
const mockListarConvites = jest.fn(async (id: string) => CONVITES[id] ?? []);
const mockDefinirPermissoes = jest.fn(
  async (_membroId: string, _permissoes: PermissoesMembro): Promise<string | null> => null,
);

/**
 * Cada contexto devolve SEMPRE o mesmo objeto, como os de verdade (tudo o que
 * eles expõem passa por `useCallback`/`useMemo`). O objeto nasce dentro da
 * fábrica do mock de propósito: assim as funções mantêm a identidade entre
 * renders, que é a condição em que o ecrã foi escrito para viver.
 */
jest.mock('expo-router', () => {
  const router = { push: () => {} };
  return { useRouter: () => router };
});
jest.mock('@/data/auth', () => {
  const acesso = { sessao: { user: { id: 'dono' } } };
  return { useAuth: () => acesso };
});
jest.mock('@/data/store', () => {
  const dados = {
    exploracoes: [
      { id: 'e1', nome: 'Monte do Avô' },
      { id: 'e2', nome: 'Herdade das Corgas' },
    ],
  };
  return { useGado: () => dados };
});
jest.mock('@/data/membros', () => {
  const api = {
    pode: () => true,
    aCarregar: false,
    listarMembrosDe: (id: string) => mockListarMembros(id),
    listarConvites: (id: string) => mockListarConvites(id),
    definirPermissoes: (membroId: string, p: PermissoesMembro) =>
      mockDefinirPermissoes(membroId, p),
  };
  return { useMembros: () => api };
});

import TrabalhadoresScreen from '../trabalhadores';

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

function tocar(r: ReactTestRenderer, rotulo: string) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.accessibilityLabel === rotulo || n.props.label === rotulo);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  act(() => (no.props.onPress as () => void)());
}

/**
 * Toca e espera pelo que a ação for buscar (gravar permissões, recarregar a
 * equipa). Um `act` por toque, e não um `act` dentro de outro — o aninhado dá
 * "overlapping act() calls" e a segunda gravação pode acabar fora do primeiro.
 */
async function tocarEsperar(r: ReactTestRenderer, rotulo: string) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.accessibilityLabel === rotulo || n.props.label === rotulo);
  if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  await act(async () => {
    await (no.props.onPress as () => unknown)();
  });
}

/** Mexe num interruptor (os da folha de permissões) pelo seu rótulo. */
function alternar(r: ReactTestRenderer, rotulo: string, valor: boolean) {
  const no = r.root
    .findAll((n) => typeof n.props?.onValueChange === 'function')
    .find((n) => n.props.accessibilityLabel === rotulo);
  if (!no) throw new Error(`Não há interruptor com o rótulo "${rotulo}"`);
  act(() => (no.props.onValueChange as (v: boolean) => void)(valor));
}

async function abrir() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <TrabalhadoresScreen />
      </SafeAreaProvider>,
    );
  });
  return r;
}

describe('ecrã Trabalhadores', () => {
  beforeEach(() => {
    mockListarMembros.mockClear();
    mockListarConvites.mockClear();
  });

  it('mostra as pessoas das duas explorações, sem repetir quem anda nas duas', async () => {
    const r = await abrir();
    const t = textos(r);
    expect(t).toContain('Ana Pastora');
    expect(t).toContain('Zé Silva');
    expect(t).toContain('Bento Vet');
    // O Zé é trabalhador nas duas — uma linha só, com a contagem.
    expect(t).toContain('Trabalhador em 2 explorações');
    expect(t.match(/Zé Silva/g)).toHaveLength(1);
  });

  it('não põe o dono na lista da sua própria equipa', async () => {
    const r = await abrir();
    expect(textos(r)).not.toContain('Joaquim Marques');
  });

  it('resume quantos são de cada tipo', async () => {
    const r = await abrir();
    const t = textos(r);
    expect(t).toContain('2 trabalhadores');
    expect(t).toContain('1 veterinário');
  });

  it('filtrar por exploração deixa só quem lá entra', async () => {
    const r = await abrir();
    // A escolha da exploração deixou de ser uma fila de pastilhas e passou a
    // ser um botão que abre a folha com as quintas lá dentro — daí os dois
    // toques (ver `SeletorExploracao`).
    tocar(r, 'Exploração: Todas');
    tocar(r, 'Herdade das Corgas');
    const t = textos(r);
    expect(t).toContain('Ana Pastora');
    expect(t).toContain('Trabalhador em Herdade das Corgas');
    // O veterinário só entra na outra exploração.
    expect(t).not.toContain('Bento Vet');
  });

  it('mostra os convites à espera e ignora os já usados', async () => {
    const r = await abrir();
    const t = textos(r);
    expect(t).toContain('ABC123');
    expect(t).not.toContain('USADO1');
    // O número vem num nó de texto próprio, daí o espaço no meio.
    expect(t).toMatch(/CONVITES À ESPERA \(\s*1\s*\)/);
  });

  it('pede a equipa de cada exploração uma vez', async () => {
    await abrir();
    expect(mockListarMembros.mock.calls.map((c) => c[0]).sort()).toEqual(['e1', 'e2']);
  });
});

/**
 * A folha "o que pode alterar", que é a razão de se tocar numa pessoa.
 *
 * O que interessa provar aqui é o formato do que se GRAVA: os ajustes guardam só
 * as exceções (ver `permissoes.ts`), e um erro nessa parte não dá erro nenhum —
 * grava a lista inteira e congela a pessoa nas regras de hoje, ou grava a chave
 * errada e o interruptor deixa de querer dizer nada.
 */
describe('permissões de uma pessoa', () => {
  beforeEach(() => {
    mockListarMembros.mockClear();
    mockListarConvites.mockClear();
    mockDefinirPermissoes.mockClear();
  });

  it('tocar numa pessoa abre o que ela pode alterar', async () => {
    const r = await abrir();
    tocar(r, 'Zé Silva, trabalhador');
    const t = textos(r);
    expect(t).toContain('O que pode alterar');
    expect(t).toContain('Eliminar animais');
    expect(t).toContain('Terrenos');
  });

  it('tirar uma permissão grava só essa exceção', async () => {
    const r = await abrir();
    tocar(r, 'Ana Pastora, trabalhador');
    alternar(r, 'Eliminar animais', false);
    await tocarEsperar(r, 'Guardar permissões');
    // Só a exceção: o resto continua a seguir o papel, para acompanhar a regra
    // se ela mudar.
    expect(mockDefinirPermissoes).toHaveBeenCalledWith('m6', { eliminarAnimais: false });
  });

  it('dar uma permissão que o papel não dá grava-a', async () => {
    const r = await abrir();
    tocar(r, 'Bento Vet, veterinário');
    alternar(r, 'Terrenos', true);
    await tocarEsperar(r, 'Guardar permissões');
    expect(mockDefinirPermissoes).toHaveBeenCalledWith('m3', { gerirTerrenos: true });
  });

  it('voltar ao valor do papel apaga a exceção em vez de a gravar igual', async () => {
    const r = await abrir();
    tocar(r, 'Bento Vet, veterinário');
    alternar(r, 'Terrenos', true);
    alternar(r, 'Terrenos', false); // o veterinário já não geria terrenos
    await tocarEsperar(r, 'Guardar permissões');
    expect(mockDefinirPermissoes).toHaveBeenCalledWith('m3', {});
  });

  it('não deixa ajustar as permissões de um dono', async () => {
    // O ecrã exclui o próprio, mas um co-dono aparece na lista — e uma
    // exploração tem de ficar sempre com alguém que lhe consiga mexer.
    const r = await abrir();
    tocar(r, 'Sócia Dona, dono');
    const t = textos(r);
    expect(t).toContain('Dono da exploração');
    expect(t).not.toContain('Eliminar animais');
  });

  it('marca na lista quem tem permissões fora do que o papel dá', async () => {
    // Sem esta marca, saber quem está afinado à mão obrigava a abrir a folha de
    // cada pessoa, uma a uma.
    const r = await abrir();
    expect(textos(r)).toContain('Permissões ajustadas');
    tocar(r, 'Zé Silva, trabalhador');
    const t = textos(r);
    expect(t).toContain('ALTERADO');
    expect(t).toContain('Repor o que o papel dá');
  });

  it('o dinheiro não aparece com a gestão económica desligada', async () => {
    // Com o interruptor desligado o servidor recusa qualquer movimento, mesmo ao
    // dono: dar a permissão não servia de nada e prometia o que não acontece.
    const r = await abrir();
    tocar(r, 'Zé Silva, trabalhador');
    expect(textos(r)).not.toContain('Despesas');
  });
});
