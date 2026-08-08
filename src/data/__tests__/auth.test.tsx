/**
 * Terminar sessão tem de terminar a sessão.
 *
 * O `signOut()` sem `scope` pede ao SERVIDOR para revogar o token, e por isso
 * é uma ida à rede como qualquer outra: falha sem ligação, com o token já
 * inválido, ou quando o cadeado do auth-js está preso noutro separador. Enquanto
 * o `sair()` foi um `await` sem rede de segurança, essa falha levava atrás o
 * `limparCache()` — e o criador ficava dentro da conta depois de tocar em
 * "Terminar sessão", sem uma palavra a explicar porquê. Numa app que se usa no
 * campo, com rede a meio, isto não é o caso raro.
 *
 * O que se prova aqui é o desfecho, não o caminho: a cache da conta que saiu
 * desaparece e a app volta ao ecrã de entrada, com servidor ou sem ele. E, já
 * agora, o contrário — que havendo rede o token continua a ser revogado do
 * outro lado, e não se fica pelo caminho de casa.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/* ---- Fronteiras simuladas ---- */

type Ouvinte = (evento: string, sessao: unknown) => void;

const SESSAO = { user: { id: 'u-1', email: 'criador@exemplo.pt' } };

/** O cliente de autenticação, com as falhas que interessam à mão. */
const mockAuth = {
  /** A sessão que o cliente tem guardada. `null` = já não há sessão. */
  sessao: null as typeof SESSAO | null,
  /** O que o `signOut()` sem `scope` faz — o que vai ao servidor. */
  servidor: 'ok' as 'ok' | 'rejeita' | 'devolve-erro',
  /** O que o `signOut({ scope: 'local' })` faz. */
  local: 'ok' as 'ok' | 'rejeita',
  /** Os `scope` com que o `signOut` foi chamado, por ordem. */
  chamadas: [] as (string | undefined)[],
  ouvintes: [] as Ouvinte[],
  cacheLimpa: 0,
};

/** O que o auth-js faz ao apagar a sessão: esquece-a e avisa quem está à escuta. */
function mockEsquecerSessao() {
  mockAuth.sessao = null;
  mockAuth.ouvintes.forEach((ouvinte) => ouvinte('SIGNED_OUT', null));
}

/**
 * O `signOut` do supabase-js, com as duas portas por onde ele entrega uma
 * falha: uma rejeição, ou um `error` na resposta.
 *
 * A falha do servidor é simulada a deixar a sessão POR fechar. É o pior caso e
 * é o que interessa: a versão do auth-js instalada hoje ainda apaga a sessão
 * local quando o servidor recusa, mas isso é detalhe de implementação dela — o
 * contrato é só "isto pode falhar", e é sobre esse que a app tem de aguentar-se.
 *
 * O nome começa por `mock` porque tem de começar: o hoist do Jest recusa uma
 * fábrica que toque em qualquer outra coisa de fora.
 */
async function mockSignOut(opcoes?: { scope?: string }): Promise<{ error: unknown }> {
  mockAuth.chamadas.push(opcoes?.scope);
  if (opcoes?.scope === 'local') {
    if (mockAuth.local === 'rejeita') throw new Error('armazenamento indisponível');
    mockEsquecerSessao();
    return { error: null };
  }
  if (mockAuth.servidor === 'rejeita') throw new Error('Network request failed');
  if (mockAuth.servidor === 'devolve-erro') return { error: { message: 'Network request failed' } };
  mockEsquecerSessao();
  return { error: null };
}

// As fábricas só podem devolver funções que leem o `mockAuth` quando forem
// CHAMADAS: uma fábrica corre antes de as constantes do teste existirem. Nada
// aqui toca no estado à cabeça.
jest.mock('../supabase', () => ({
  supabaseConfigurado: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: mockAuth.sessao } }),
      onAuthStateChange: (ouvinte: Ouvinte) => {
        mockAuth.ouvintes.push(ouvinte);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                mockAuth.ouvintes = mockAuth.ouvintes.filter((o) => o !== ouvinte);
              },
            },
          },
        };
      },
      signOut: (opcoes?: { scope?: string }) => mockSignOut(opcoes),
    },
  },
}));

jest.mock('../cacheLocal', () => ({
  garantirDono: () => false,
  limparCache: () => {
    mockAuth.cacheLimpa += 1;
  },
}));

import { AuthProvider, useAuth } from '../auth';

/* ---- Andaime ---- */

type Ctx = ReturnType<typeof useAuth>;

/**
 * Mostra o que o criador tem à frente.
 *
 * A condição é a mesma do `PortaoAuth` (`_layout.tsx`): sem sessão, a app
 * mostra o ecrã de entrada. Está repetida aqui de propósito — montar o layout
 * inteiro trazia fontes, splash e meia dúzia de providers para provar uma
 * coisa que se decide numa linha — mas é a repetição que deixa o teste afirmar
 * sobre o ECRÃ e não sobre um campo de um objeto.
 */
function Sonda({ aoRender }: { aoRender: (c: Ctx) => void }) {
  const ctx = useAuth();
  aoRender(ctx);
  if (ctx.aCarregar) return <Text>a-carregar</Text>;
  return <Text>{ctx.sessao ? 'app' : 'ecra-de-entrada'}</Text>;
}

function texto(r: ReactTestRenderer): string {
  const juntar = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(juntar).join('');
    if (no && typeof no === 'object' && 'children' in no) {
      return juntar((no as { children: unknown }).children);
    }
    return '';
  };
  return juntar(r.toJSON());
}

/** Abre a app já com sessão iniciada, como quem a encontra de manhã. */
async function abrirComSessao(): Promise<{ ctx: () => Ctx; ecra: () => string }> {
  mockAuth.sessao = SESSAO;
  let atual: Ctx | null = null;
  let arvore!: ReactTestRenderer;
  await act(async () => {
    arvore = create(
      <AuthProvider>
        <Sonda aoRender={(c) => (atual = c)} />
      </AuthProvider>,
    );
  });
  // Sem isto, um teste em que a sessão nunca chegou a abrir passava a dizer que
  // a saída correu bem.
  expect(texto(arvore)).toBe('app');
  return { ctx: () => atual as Ctx, ecra: () => texto(arvore) };
}

/**
 * Toca em "Terminar sessão" e diz se a promessa rejeitou.
 *
 * A rejeição é apanhada AQUI DENTRO, antes de sair do `act`. Deixá-la escapar
 * faz o `act` propagar o erro sem descarregar as atualizações de estado em
 * fila, e a sonda continuava a mostrar o ecrã de ANTES — o teste rebentava com
 * a rejeição em vez de dizer o que ficou mal. Que ela seja `false` também é
 * parte do que se prova: os ecrãs chamam `void sair()` (ver `(tabs)/perfil`),
 * e uma rejeição a escapar daí é um erro por apanhar em cima do criador.
 */
async function terminarSessao(ctx: () => Ctx): Promise<boolean> {
  let rejeitou = false;
  await act(async () => {
    try {
      await ctx().sair();
    } catch {
      rejeitou = true;
    }
  });
  return rejeitou;
}

beforeEach(() => {
  mockAuth.sessao = null;
  mockAuth.servidor = 'ok';
  mockAuth.local = 'ok';
  mockAuth.chamadas = [];
  mockAuth.ouvintes = [];
  mockAuth.cacheLimpa = 0;
});

describe('sair()', () => {
  it('com rede, revoga o token no servidor e fica-se por aí', async () => {
    const { ctx, ecra } = await abrirComSessao();

    expect(await terminarSessao(ctx)).toBe(false);
    // Só uma chamada, e sem `scope`: é a que vai ao servidor. O recuo local
    // existe para quando ela falha, não para ser o caminho normal — sair sem
    // revogar deixava o token a servir quem lhe deitasse a mão.
    expect(mockAuth.chamadas).toEqual([undefined]);
    expect(mockAuth.cacheLimpa).toBe(1);
    expect(ecra()).toBe('ecra-de-entrada');
  });

  it('sem rede, sai à mesma: limpa a cache e volta ao ecrã de entrada', async () => {
    const { ctx, ecra } = await abrirComSessao();
    mockAuth.servidor = 'rejeita';

    const rejeitou = await terminarSessao(ctx);

    // Primeiro o que o criador vê, que é o que interessa.
    expect(ecra()).toBe('ecra-de-entrada');
    expect(mockAuth.cacheLimpa).toBe(1);
    // Tentou primeiro pelo servidor — é lá que o token se revoga quando há
    // rede — e só depois pelo caminho de casa.
    expect(mockAuth.chamadas).toEqual([undefined, 'local']);
    expect(rejeitou).toBe(false);
  });

  it('o servidor recusa sem rejeitar: mesmo desfecho', async () => {
    const { ctx, ecra } = await abrirComSessao();
    mockAuth.servidor = 'devolve-erro';

    const rejeitou = await terminarSessao(ctx);

    expect(ecra()).toBe('ecra-de-entrada');
    expect(mockAuth.cacheLimpa).toBe(1);
    expect(mockAuth.chamadas).toEqual([undefined, 'local']);
    expect(rejeitou).toBe(false);
  });

  it('nem o caminho de casa resulta: a cache vai à mesma e ninguém rebenta', async () => {
    const { ctx } = await abrirComSessao();
    mockAuth.servidor = 'rejeita';
    mockAuth.local = 'rejeita';

    const rejeitou = await terminarSessao(ctx);

    // Os dados da conta que saiu desaparecem deste aparelho de qualquer forma:
    // é a única parte disto que não depende de ninguém.
    expect(mockAuth.cacheLimpa).toBe(1);
    expect(mockAuth.chamadas).toEqual([undefined, 'local']);
    expect(rejeitou).toBe(false);
    // A sessão fica onde estava, e não se finge o contrário: com o
    // armazenamento em baixo, um ecrã de entrada que voltasse atrás no arranque
    // seguinte seria uma saída a mentir. Não há aqui nada mais a fazer — o
    // token caduca sozinho.
  });
});
