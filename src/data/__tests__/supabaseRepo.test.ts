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
const mockRespostas: {
  update: { data: unknown[] | null; error: { message: string } | null };
  select: { data: unknown; error: { message: string } | null };
  upsert: { error: { message: string } | null };
} = {
  update: { data: [], error: null },
  select: { data: null, error: null },
  upsert: { error: null },
};

const mockChamadas: { tabela: string; op: string; filtros: Record<string, unknown> }[] = [];

jest.mock('../supabase', () => {
  const construir = (tabela: string) => {
    let op = '';
    const filtros: Record<string, unknown> = {};
    const cadeia: Record<string, unknown> = {
      update() { op = 'update'; return cadeia; },
      upsert() {
        op = 'upsert';
        mockChamadas.push({ tabela, op, filtros });
        return Promise.resolve(mockRespostas.upsert);
      },
      select() {
        if (op === 'update') {
          mockChamadas.push({ tabela, op, filtros });
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

import { eConflito, mensagemLegivel, upsertAnimalSupabase } from '../supabaseRepo';
import type { Animal } from '../types';

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
  mockRespostas.upsert = { error: null };
});

describe('gravação sem versão conhecida — registo criado neste aparelho', () => {
  it('usa upsert, porque não há outro autor com quem colidir', async () => {
    const erro = await upsertAnimalSupabase(animal());

    expect(erro).toBeNull();
    expect(mockChamadas).toEqual([
      expect.objectContaining({ tabela: 'animal', op: 'upsert' }),
    ]);
  });

  it('propaga o erro do servidor tal como veio', async () => {
    mockRespostas.upsert = { error: { message: 'permission denied for table animal' } };
    expect(await upsertAnimalSupabase(animal())).toBe('permission denied for table animal');
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
