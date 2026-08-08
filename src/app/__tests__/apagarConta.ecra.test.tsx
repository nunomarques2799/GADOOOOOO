/**
 * O ecrã de apagar a conta, montado como a app o monta.
 *
 * A conta do que se perde está coberta em `data/__tests__/apagarConta.test.ts`.
 * O que falta provar é o que só existe a correr, e que é a razão de o ecrã
 * existir: que o botão NÃO apaga nada enquanto a palavra não estiver escrita.
 *
 * Isto não é zelo a mais. O botão já esteve no Perfil, colado ao "Terminar
 * sessão", e saiu de lá por ser fácil de tocar por engano; se a guarda se
 * perder numa refactorização qualquer, volta-se ao mesmo acidente — desta vez
 * num ecrã que promete o contrário.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/** Tudo o que os mocks devolvem. Mutável: cada teste põe cá o seu cenário. */
const mockEstado = {
  utilizador: { id: 'user-1' } as { id: string } | null,
  configurado: true,
  apagarConta: jest.fn<() => Promise<string | null>>(),
  membros: [] as { exploracaoId: string; role: string }[],
  equipa: [] as { userId: string }[],
  exploracoes: [] as { id: string; nome: string; utilizadorId: string }[],
  animais: [] as { exploracaoId: string }[],
  pendentesSinc: 0,
  /** As perguntas finais que o ecrã fez, por responder. */
  confirmacoes: [] as { titulo: string; mensagem: string; aoConfirmar: () => void }[],
  avisos: [] as { titulo: string; mensagem: string }[],
  voltou: 0,
};

// As fábricas só podem devolver funções que leem o `mockEstado` quando forem
// CHAMADAS: uma fábrica corre antes de as constantes do teste existirem (ver
// `gado-jest-mocks-e-import-dinamico`). Nada aqui toca no estado à cabeça.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: () => {
      mockEstado.voltou += 1;
    },
  }),
}));

jest.mock('@/data/auth', () => ({
  useAuth: () => ({
    utilizador: mockEstado.utilizador,
    configurado: mockEstado.configurado,
    apagarConta: mockEstado.apagarConta,
  }),
}));

jest.mock('@/data/membros', () => ({
  useMembros: () => ({
    membros: mockEstado.membros,
    listarMembrosDe: () => Promise.resolve(mockEstado.equipa),
  }),
}));

jest.mock('@/data/store', () => ({
  useGado: () => ({
    exploracoes: mockEstado.exploracoes,
    animais: mockEstado.animais,
    pendentesSinc: mockEstado.pendentesSinc,
  }),
}));

jest.mock('@/data/avisos', () => ({
  confirmar: (
    titulo: string,
    mensagem: string,
    aoConfirmar: () => void,
  ) => void mockEstado.confirmacoes.push({ titulo, mensagem, aoConfirmar }),
  avisar: (titulo: string, mensagem: string) =>
    void mockEstado.avisos.push({ titulo, mensagem }),
}));

import ApagarContaScreen from '../conta/apagar';

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

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

/** O `Button` com este rótulo, com os props que o ecrã lhe deu. */
function botao(r: ReactTestRenderer, rotulo: string) {
  const no = r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .find((n) => n.props.label === rotulo);
  if (!no) throw new Error(`Não há botão com o rótulo "${rotulo}"`);
  return no;
}

/**
 * Toca no botão SEM olhar ao `disabled`.
 *
 * De propósito: o que se quer provar é que o próprio manipulador se recusa a
 * apagar. Um ecrã que só se defende com a opacidade do botão está a uma
 * refactorização de distância de voltar a apagar contas por engano.
 */
function tocar(r: ReactTestRenderer, rotulo: string) {
  act(() => (botao(r, rotulo).props.onPress as () => void)());
}

function escrever(r: ReactTestRenderer, texto: string) {
  const campo = r.root.find((n) => typeof n.props?.onChangeText === 'function');
  act(() => (campo.props.onChangeText as (t: string) => void)(texto));
}

async function abrir(): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <ApagarContaScreen />
      </SafeAreaProvider>,
    );
  });
  return r;
}

const MINHA = { id: 'e1', nome: 'Quinta do Souto', utilizadorId: 'user-1' };
const ALHEIA = { id: 'e2', nome: 'Herdade da Ponte', utilizadorId: 'user-9' };

beforeEach(() => {
  mockEstado.utilizador = { id: 'user-1' };
  mockEstado.configurado = true;
  mockEstado.apagarConta = jest.fn<() => Promise<string | null>>();
  mockEstado.apagarConta.mockResolvedValue(null);
  mockEstado.membros = [];
  mockEstado.equipa = [];
  mockEstado.exploracoes = [];
  mockEstado.animais = [];
  mockEstado.pendentesSinc = 0;
  mockEstado.confirmacoes = [];
  mockEstado.avisos = [];
  mockEstado.voltou = 0;
});

describe('a guarda do botão', () => {
  it('sem a palavra escrita, tocar no botão não pergunta nem apaga', async () => {
    mockEstado.exploracoes = [MINHA];
    mockEstado.membros = [{ exploracaoId: 'e1', role: 'admin' }];
    const r = await abrir();

    expect(botao(r, 'Apagar a minha conta').props.disabled).toBe(true);
    tocar(r, 'Apagar a minha conta');

    expect(mockEstado.confirmacoes).toHaveLength(0);
    expect(mockEstado.apagarConta).not.toHaveBeenCalled();
  });

  it('com a palavra quase certa, continua fechado', async () => {
    const r = await abrir();
    escrever(r, 'apag');

    expect(botao(r, 'Apagar a minha conta').props.disabled).toBe(true);
    tocar(r, 'Apagar a minha conta');
    expect(mockEstado.confirmacoes).toHaveLength(0);
  });

  it('com a palavra escrita, ainda assim pergunta antes de apagar', async () => {
    const r = await abrir();
    escrever(r, 'APAGAR');

    expect(botao(r, 'Apagar a minha conta').props.disabled).toBe(false);
    tocar(r, 'Apagar a minha conta');

    // Escrever a palavra abre o botão; não apaga nada por si.
    expect(mockEstado.confirmacoes).toHaveLength(1);
    expect(mockEstado.apagarConta).not.toHaveBeenCalled();

    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());
    expect(mockEstado.apagarConta).toHaveBeenCalledTimes(1);
  });

  it('sem sessão (modo local) não apaga, mesmo com a palavra escrita', async () => {
    mockEstado.configurado = false;
    const r = await abrir();
    escrever(r, 'APAGAR');

    expect(botao(r, 'Apagar a minha conta').props.disabled).toBe(true);
    tocar(r, 'Apagar a minha conta');
    expect(mockEstado.confirmacoes).toHaveLength(0);
  });
});

describe('o que o ecrã diz a cada pessoa', () => {
  it('ao dono, diz o nome da exploração e quantos animais caem', async () => {
    mockEstado.exploracoes = [MINHA];
    mockEstado.membros = [{ exploracaoId: 'e1', role: 'admin' }];
    mockEstado.animais = [{ exploracaoId: 'e1' }, { exploracaoId: 'e1' }];
    mockEstado.equipa = [{ userId: 'user-1' }, { userId: 'user-7' }];
    const r = await abrir();

    const t = textos(r);
    expect(t).toContain('Isto vai ser apagado');
    expect(t).toContain('Quinta do Souto');
    expect(t).toContain('2 animais');
    // A equipa conta-se sem o próprio: uma pessoa fica sem acesso, não duas.
    expect(t).toContain('1 pessoa da sua equipa');
  });

  it('ao trabalhador, não promete apagar animais que não são dele', async () => {
    mockEstado.exploracoes = [ALHEIA];
    mockEstado.membros = [{ exploracaoId: 'e2', role: 'trabalhador' }];
    mockEstado.animais = [{ exploracaoId: 'e2' }, { exploracaoId: 'e2' }];
    const r = await abrir();

    const t = textos(r);
    expect(t).not.toContain('Isto vai ser apagado');
    expect(t).toContain('Isto continua a existir, sem si');
    expect(t).toContain('Herdade da Ponte');

    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    // A pergunta final também não pode falar de explorações nem de animais.
    expect(mockEstado.confirmacoes[0].mensagem).not.toContain('animais');
  });

  it('avisa do que ainda não subiu ao servidor', async () => {
    mockEstado.pendentesSinc = 3;
    const r = await abrir();
    expect(textos(r)).toContain('3 alterações guardadas');
  });
});

describe('depois de tocar em apagar', () => {
  it('correu bem: avisa e não fica preso no ecrã', async () => {
    const r = await abrir();
    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());

    expect(mockEstado.avisos[0].titulo).toBe('Conta apagada');
    // Não se navega: sem sessão, o portão de autenticação leva a app ao ecrã
    // de entrada sozinho. Um `router.back()` aqui empurrava para um ecrã que
    // já não existe.
    expect(mockEstado.voltou).toBe(0);
  });

  it('o servidor recusou: fica no ecrã com a razão à vista', async () => {
    mockEstado.apagarConta.mockResolvedValue('Sem ligação à internet.');
    const r = await abrir();
    escrever(r, 'APAGAR');
    tocar(r, 'Apagar a minha conta');
    await act(async () => mockEstado.confirmacoes[0].aoConfirmar());

    expect(textos(r)).toContain('Sem ligação à internet.');
    expect(mockEstado.avisos).toHaveLength(0);
    // A palavra continua escrita: obrigar a escrevê-la outra vez depois de uma
    // falha da rede é castigar quem já decidiu.
    expect(botao(r, 'Apagar a minha conta').props.disabled).toBe(false);
  });
});
