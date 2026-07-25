/**
 * Testes da gravação com versão (deteção de conflitos).
 *
 * Porquê estes e não outros: um UPDATE recusado pela RLS e um UPDATE travado
 * por conflito de versão são indistinguíveis à superfície — ambos devolvem
 * ZERO linhas afetadas e nenhum erro. Trocá-los tem consequências opostas:
 * dizer "alguém alterou" a quem só lhe falta permissão manda a pessoa
 * procurar um colega que não existe; e dar um conflito por resolvido faria
 * perder a alteração do outro em silêncio, que é exatamente o bug que isto
 * veio corrigir.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Mock do cliente Supabase. As chamadas encadeiam
 * (`.from().update().eq().lte().select()`), por isso cada passo devolve o
 * mesmo objeto e só o fim resolve. `mockRespostas` diz o que cada operação
 * devolve; o prefixo `mock` é o que autoriza o jest a referenciá-la dentro da
 * fábrica, que é içada acima dos imports.
 */
type Erro = { message: string; code?: string } | null;

const mockRespostas: {
  update: { data: unknown[] | null; error: Erro };
  select: { data: unknown; error: Erro };
  insert: { error: Erro };
  /** Resposta do UPDATE sem `.select()` — o recurso quando o insert duplica. */
  updateDireto: { error: Erro };
} = {
  update: { data: [], error: null },
  select: { data: null, error: null },
  insert: { error: null },
  updateDireto: { error: null },
};

const mockChamadas: {
  tabela: string;
  op: string;
  filtros: Record<string, unknown>;
  /** O payload que a app mandou gravar — é onde se vê o mapeamento das colunas. */
  dados?: Record<string, unknown>;
}[] = [];

jest.mock('../supabase', () => {
  const construir = (tabela: string) => {
    let op = '';
    let dados: Record<string, unknown> | undefined;
    const filtros: Record<string, unknown> = {};
    const cadeia: Record<string, unknown> = {
      update(payload: Record<string, unknown>) { op = 'update'; dados = payload; return cadeia; },
      insert(payload: Record<string, unknown>) {
        op = 'insert';
        dados = payload;
        mockChamadas.push({ tabela, op, filtros, dados });
        return Promise.resolve(mockRespostas.insert);
      },
      // Um UPDATE sem `.select()` no fim resolve-se ao ser esperado. É o
      // recurso do insert duplicado, e sem isto o `await` devolvia a própria
      // cadeia e o teste passava sem chamada nenhuma ter acontecido.
      then(resolve: (v: unknown) => void) {
        mockChamadas.push({ tabela, op, filtros, dados });
        resolve(mockRespostas.updateDireto);
      },
      select() {
        if (op === 'update') {
          mockChamadas.push({ tabela, op, filtros, dados });
          return Promise.resolve(mockRespostas.update);
        }
        op = 'select';
        return cadeia;
      },
      eq(coluna: string, valor: unknown) { filtros[coluna] = valor; return cadeia; },
      lte(coluna: string, valor: unknown) { filtros[`${coluna}__lte`] = valor; return cadeia; },
      maybeSingle() {
        mockChamadas.push({ tabela, op: 'select', filtros });
        return Promise.resolve(mockRespostas.select);
      },
    };
    return cadeia;
  };
  return { supabase: { from: (tabela: string) => construir(tabela) }, supabaseConfigurado: true };
});

import {
  eConflito,
  mensagemLegivel,
  upsertAnimalSupabase,
  upsertMovimentoSupabase,
} from '../supabaseRepo';
import type { Animal, Movimento } from '../types';

function animal(patch: Partial<Animal> = {}): Animal {
  return {
    id: 'a1',
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: '2025-01-01',
    ...patch,
  };
}

beforeEach(() => {
  mockChamadas.length = 0;
  mockRespostas.update = { data: [], error: null };
  mockRespostas.select = { data: null, error: null };
  mockRespostas.insert = { error: null };
  mockRespostas.updateDireto = { error: null };
});

describe('gravação sem versão conhecida — registo criado neste aparelho', () => {
  it('usa INSERT, não upsert — o upsert arrastava as políticas de UPDATE', async () => {
    // O upsert gera INSERT … ON CONFLICT DO UPDATE, e a política de UPDATE da
    // exploração exige um papel (`admin`) que só o trigger cria DEPOIS do
    // insert. Criar a primeira exploração dava 403 com o upsert e passa com o
    // insert — este teste trava a regressão de voltar a pôr upsert.
    const erro = await upsertAnimalSupabase(animal());

    expect(erro).toBeNull();
    expect(mockChamadas).toEqual([
      expect.objectContaining({ tabela: 'animal', op: 'insert' }),
    ]);
  });

  it('propaga o erro do servidor tal como veio', async () => {
    mockRespostas.insert = { error: { message: 'permission denied for table animal' } };
    expect(await upsertAnimalSupabase(animal())).toBe('permission denied for table animal');
  });

  it('chave duplicada não é erro: a linha já existe, faz UPDATE em vez de gritar', async () => {
    // Acontece quando a resposta do insert se perdeu (o registo entrou na
    // mesma) ou a fila offline repetiu a operação. Era o que o upsert absorvia
    // sozinho — o utilizador via a exploração criada e um aviso vermelho a
    // dizer que falhou, que é precisamente o que isto corrige.
    mockRespostas.insert = { error: { message: 'duplicate key value', code: '23505' } };

    const erro = await upsertAnimalSupabase(animal());

    expect(erro).toBeNull();
    expect(mockChamadas).toEqual([
      expect.objectContaining({ tabela: 'animal', op: 'insert' }),
      expect.objectContaining({ tabela: 'animal', op: 'update', filtros: { id: 'a1' } }),
    ]);
  });
});

describe('gravação com versão conhecida', () => {
  const versao = '2026-07-18T10:00:00.000+00:00';

  it('grava quando o servidor ainda está na versão que vimos', async () => {
    mockRespostas.update = { data: [{ id: 'a1' }], error: null };

    const erro = await upsertAnimalSupabase(animal({ atualizadoEm: versao }));

    expect(erro).toBeNull();
    // A condição tem de incluir o filtro de versão, senão não guarda nada.
    expect(mockChamadas[0]).toEqual(
      expect.objectContaining({
        op: 'update',
        filtros: { id: 'a1', 'updated_at__lte': versao },
      }),
    );
  });

  it('dá CONFLITO quando o servidor avançou para uma versão mais recente', async () => {
    mockRespostas.update = { data: [], error: null };
    mockRespostas.select = {
      data: { updated_at: '2026-07-18T11:30:00.000+00:00' }, // meia hora à frente
      error: null,
    };

    const erro = await upsertAnimalSupabase(animal({ atualizadoEm: versao }));

    expect(erro).not.toBeNull();
    expect(eConflito(erro as string)).toBe(true);
    expect(erro).toContain('outra pessoa alterou');
  });

  it('NÃO dá conflito quando a versão não mudou — aí o que falta é permissão', async () => {
    // Zero linhas afetadas com a versão intacta só pode ser a RLS a recusar.
    // Chamar a isto "conflito" mandaria a pessoa procurar um colega que nunca
    // tocou no registo.
    mockRespostas.update = { data: [], error: null };
    mockRespostas.select = { data: { updated_at: versao }, error: null };

    const erro = await upsertAnimalSupabase(animal({ atualizadoEm: versao }));

    expect(eConflito(erro as string)).toBe(false);
    expect(erro).toContain('permissão');
  });

  it('dá conflito quando a linha já não existe — foi eliminada por outra pessoa', async () => {
    // Recriá-la seria ressuscitar um registo que alguém apagou de propósito.
    mockRespostas.update = { data: [], error: null };
    mockRespostas.select = { data: null, error: null };

    const erro = await upsertAnimalSupabase(animal({ atualizadoEm: versao }));

    expect(eConflito(erro as string)).toBe(true);
    expect(erro).toContain('eliminado');
  });

  it('não vai ler a linha quando a gravação passou (poupa uma ida à rede)', async () => {
    mockRespostas.update = { data: [{ id: 'a1' }], error: null };

    await upsertAnimalSupabase(animal({ atualizadoEm: versao }));

    expect(mockChamadas.filter((c) => c.op === 'select')).toHaveLength(0);
  });
});

/**
 * A coluna `movimento.data` é um `date` do Postgres e o domínio guarda um ISO
 * completo, por isso há uma conversão à saída. Ela tem de ler o dia LOCAL: o
 * atalho de cortar os dez primeiros caracteres do ISO lê o dia em UTC, e em
 * Portugal (UTC+1 de março a outubro) isso grava a despesa da meia-noite no dia
 * anterior — com o formulário a confirmar a data certa por cima.
 *
 * Os dois primeiros casos são simétricos de propósito: qual deles apanhava o
 * `slice(0, 10)` depende do sinal do fuso da máquina que corre os testes, e um
 * só deles deixava a CI a passar em metade do mundo.
 */
describe('movimento — o dia que vai para a coluna `date`', () => {
  function movimento(data: string): Movimento {
    return {
      id: 'm1',
      exploracaoId: 'exp-1',
      direcao: 'despesa',
      categoria: 'Alimentação',
      valor: 860,
      data,
      descricao: 'Ração',
    };
  }

  /** O que o servidor recebeu na coluna `data`. */
  async function diaGravado(data: string): Promise<unknown> {
    mockChamadas.length = 0;
    await upsertMovimentoSupabase(movimento(data));
    return mockChamadas[0]?.dados?.data;
  }

  it('grava o dia local de um instante que em UTC já é o dia anterior', async () => {
    // 25/07 às 00:30 em Lisboa = 24/07T23:30Z. É o caso que estava errado.
    const meiaNoiteEMeia = new Date(2026, 6, 25, 0, 30).toISOString();
    expect(await diaGravado(meiaNoiteEMeia)).toBe('2026-07-25');
  });

  it('grava o dia local de um instante que em UTC ainda é o dia seguinte', async () => {
    // O simétrico, para o fuso não ser assumido: com TZ a oeste de Greenwich as
    // 23:30 locais são já o dia seguinte em UTC, e o dia a gravar continua a ser
    // o que o criador vê no ecrã.
    const quaseMeiaNoite = new Date(2026, 6, 25, 23, 30).toISOString();
    expect(await diaGravado(quaseMeiaNoite)).toBe('2026-07-25');
  });

  it('deixa intacta uma data que já vem só com o dia (vinda do servidor)', async () => {
    expect(await diaGravado('2026-07-25')).toBe('2026-07-25');
  });
});

describe('mensagemLegivel — o marcador técnico não é para o criador ver', () => {
  it('tira o prefixo de uma mensagem de conflito', () => {
    expect(mensagemLegivel('CONFLITO_DE_VERSAO: outra pessoa alterou este registo.')).toBe(
      'outra pessoa alterou este registo.',
    );
  });

  it('deixa as outras mensagens intactas', () => {
    expect(mensagemLegivel('Não tem permissão.')).toBe('Não tem permissão.');
  });
});
