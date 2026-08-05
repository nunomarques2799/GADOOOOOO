/**
 * O que corre mal ao resgatar um convite chega por DOIS caminhos, e a app tem
 * de ler os dois.
 *
 * O `schema_convite_seguro.sql` fez o `resgatar_convite` passar a devolver
 * `{"erro": …}` dentro da resposta em vez de levantar exceção — sem isso, a
 * exceção levava atrás (rollback) o registo da tentativa falhada que ela mesma
 * acabava de contar, e o travão a quem experimenta códigos a eito não existia.
 *
 * Mas as bases não mudam todas no mesmo dia: enquanto a de produção não correr
 * esse ficheiro, o erro continua a chegar como exceção. Ler só o caminho novo
 * dava, nessas, um "entrou" a quem não entrou — o ecrã de acesso fechava-se e a
 * pessoa ficava a olhar para uma app sem exploração nenhuma.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

/* ---- Fronteiras simuladas ---- */

/**
 * O que o servidor responde ao `rpc('resgatar_convite')`. O prefixo `mock` é o
 * que autoriza o jest a referenciar isto dentro da fábrica do `jest.mock`, que
 * é içada acima dos imports.
 */
const mockRpc = {
  responderCom: { data: null as unknown, error: null as unknown },
};

/** Consulta encadeável do supabase-js, sempre com resposta (nunca pendurada). */
function mockConsulta(): Record<string, unknown> {
  const resposta = Promise.resolve({ data: null, error: null });
  const encadeavel: Record<string, unknown> = {
    select: () => encadeavel,
    eq: () => encadeavel,
    maybeSingle: () => resposta,
    then: (...args: unknown[]) => resposta.then(...(args as [never, never])),
  };
  return encadeavel;
}

jest.mock('../supabase', () => ({
  supabaseConfigurado: true,
  supabase: {
    from: () => mockConsulta(),
    rpc: () => Promise.resolve(mockRpc.responderCom),
  },
}));

jest.mock('../auth', () => ({
  useAuth: () => ({
    sessao: { user: { id: 'u-1', email: 'novo@exemplo.pt' } },
    aCarregar: false,
  }),
}));

jest.mock('../cacheLocal', () => ({
  cacheDisponivel: false,
  lerAcesso: () => null,
  guardarAcesso: () => undefined,
}));

import { MembrosProvider, useMembros } from '../membros';

/** Guarda a função do contexto, para se poder chamá-la de fora da árvore. */
let resgatar: ((codigo: string) => Promise<string | null>) | null = null;

function Sonda() {
  resgatar = useMembros().resgatarConvite;
  return <Text>pronto</Text>;
}

async function montar() {
  await act(async () => {
    create(
      <MembrosProvider>
        <Sonda />
      </MembrosProvider>,
    );
  });
}

/** Resgata e devolve o que a app diria à pessoa (null = entrou). */
async function tentar(codigo: string): Promise<string | null> {
  let resultado: string | null = 'não chegou a responder';
  await act(async () => {
    resultado = await resgatar!(codigo);
  });
  return resultado;
}

beforeEach(() => {
  mockRpc.responderCom = { data: null, error: null };
});

describe('resgatar convite — o erro pode vir por dois caminhos', () => {
  it('mostra o erro que vem DENTRO da resposta (base já migrada)', async () => {
    await montar();
    mockRpc.responderCom = { data: { erro: 'código inválido' }, error: null };

    expect(await tentar('ZZZZZZZZ')).toBe('código inválido');
  });

  it('mostra o texto do travão às tentativas', async () => {
    await montar();
    mockRpc.responderCom = {
      data: { erro: 'Demasiadas tentativas falhadas. Espere 15 minutos e tente outra vez.' },
      error: null,
    };

    expect(await tentar('ZZZZZZZZ')).toMatch(/Demasiadas tentativas/);
  });

  it('continua a mostrar o erro que vem como exceção (base por migrar)', async () => {
    await montar();
    mockRpc.responderCom = { data: null, error: { message: 'código já foi usado' } };

    expect(await tentar('ABCD2345')).toBe('código já foi usado');
  });

  it('não inventa erro nenhum quando a pessoa entra mesmo', async () => {
    await montar();
    mockRpc.responderCom = {
      data: { exploracao_id: 'exp-1', role: 'trabalhador', expira_em: null },
      error: null,
    };

    expect(await tentar('ABCD2345')).toBeNull();
  });
});
