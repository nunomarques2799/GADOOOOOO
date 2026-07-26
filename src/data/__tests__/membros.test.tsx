/**
 * O arranque não pode ficar preso à espera do servidor.
 *
 * Enquanto o `MembrosProvider` está a carregar, o `AppRouter` não tem o que
 * mostrar — e um pedido a um servidor inalcançável NÃO falha: fica pendurado
 * para sempre. Sem prazo, a app abria numa janela em branco, sem menu, sem
 * botão e sem uma palavra a explicar. Foi assim que aconteceu na app de testes.
 *
 * O que isto prova: por muito que o servidor demore, o carregamento acaba, e
 * acaba com o último acesso conhecido intacto — não a fingir que a conta ficou
 * sem explorações, que mandaria o criador para o ecrã de "aguarda aprovação".
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

/* ---- Fronteiras simuladas ---- */

/** Controla se o servidor responde, demora ou nunca responde. */
const mockServidor = {
  /** `null` = nunca responde (o caso que interessa). */
  responderCom: null as { data: unknown; error: unknown } | null,
};

/** Uma consulta encadeável como a do supabase-js: `.select().eq().maybeSingle()`. */
function mockConsulta(): Record<string, unknown> {
  const resposta = new Promise((resolve) => {
    if (mockServidor.responderCom) resolve(mockServidor.responderCom);
    // Sem resposta configurada, a promessa NUNCA resolve — é exatamente o que
    // um servidor inalcançável faz, e é o que o prazo tem de apanhar.
  });
  const encadeavel: Record<string, unknown> = {
    select: () => encadeavel,
    eq: () => encadeavel,
    maybeSingle: () => resposta,
    then: (...args: unknown[]) =>
      (resposta as Promise<unknown>).then(...(args as [never, never])),
  };
  return encadeavel;
}

jest.mock('../supabase', () => ({
  supabaseConfigurado: true,
  supabase: { from: () => mockConsulta() },
}));

jest.mock('../auth', () => ({
  useAuth: () => ({
    sessao: { user: { id: 'u-1', email: 'criador@exemplo.pt' } },
    aCarregar: false,
  }),
}));

// Sem cache do último acesso: é o arranque em que `aCarregar` começa a true —
// primeira vez no aparelho, ou depois de a app mudar de pasta de dados.
jest.mock('../cacheLocal', () => ({
  cacheDisponivel: false,
  lerAcesso: () => null,
  guardarAcesso: () => undefined,
}));

import { MembrosProvider, useMembros } from '../membros';

/** Mostra o estado de carregamento como texto, para se poder afirmar sobre ele. */
function Sonda() {
  const { aCarregar, membros } = useMembros();
  return <Text>{aCarregar ? 'a-carregar' : `pronto:${membros.length}`}</Text>;
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

describe('MembrosProvider', () => {
  beforeEach(() => {
    mockServidor.responderCom = null;
    jest.useRealTimers();
  });

  it('desiste de esperar por um servidor que nunca responde', async () => {
    jest.useFakeTimers();

    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(
        <MembrosProvider>
          <Sonda />
        </MembrosProvider>,
      );
    });

    // No princípio está mesmo à espera — é o comportamento correto.
    expect(texto(r)).toBe('a-carregar');

    // Passados uns segundos ainda espera: o prazo não pode ser tão curto que
    // corte uma rede de campo lenta antes de ela responder.
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(texto(r)).toBe('a-carregar');

    // Ao fim do prazo desiste, e a app tem finalmente o que mostrar.
    await act(async () => {
      jest.advanceTimersByTime(11000);
    });
    expect(texto(r)).toBe('pronto:0');

    jest.useRealTimers();
  });

  it('quando o servidor responde, não espera pelo prazo nenhum', async () => {
    mockServidor.responderCom = { data: null, error: null };

    let r!: ReactTestRenderer;
    await act(async () => {
      r = create(
        <MembrosProvider>
          <Sonda />
        </MembrosProvider>,
      );
    });

    // Sem adiantar relógio nenhum: a resposta chegou e o carregamento acabou.
    expect(texto(r)).toBe('pronto:0');
  });
});
