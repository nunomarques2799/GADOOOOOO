/**
 * O que acontece quando o armazenamento do aparelho enche.
 *
 * Na web e no Windows o navegador tem um teto por site, e as fotografias dos
 * animais vão dentro dos dados guardados. Até 2026-10-03 a gravação engolia o
 * erro de quota e a fila do que está por enviar dizia "1 por enviar" sem ter
 * gravado nada: a sincronização seguinte lia a fila do disco, vazia, e a
 * alteração feita sem rede desaparecia sem uma palavra.
 *
 * A regra agora: a fila tem prioridade sobre a cópia dos dados (que é só um
 * espelho do servidor), e o que não couber de todo é recusado à vista.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/** Um armazenamento com teto, que recusa (`false`) o que o ultrapassar. */
const mockMapa = new Map<string, string>();
const mockTeto = { caracteres: Infinity };
const ocupado = (sem?: string) =>
  [...mockMapa].reduce((n, [c, v]) => (c === sem ? n : n + c.length + v.length), 0);

jest.mock('../armazenamento', () => ({
  armazenamentoDisponivel: true,
  ler: (chave: string) => mockMapa.get(chave) ?? null,
  guardar: (chave: string, valor: string) => {
    if (ocupado(chave) + chave.length + valor.length > mockTeto.caracteres) return false;
    mockMapa.set(chave, valor);
    return true;
  },
  remover: (chave: string) => void mockMapa.delete(chave),
}));

import {
  adicionarOutbox,
  ErroSemEspaco,
  guardarCache,
  lerCache,
  lerOutbox,
  registarFalhada,
  lerFalhadas,
  type DadosGado,
  type OpPendente,
} from '../cacheLocal';

function dados(nAnimais: number): DadosGado {
  return {
    exploracoes: [],
    terrenos: [],
    animais: Array.from({ length: nAnimais }, (_, i) => ({
      id: `an-${i}`,
      exploracaoId: 'exp-1',
      especie: 'Bovino' as const,
      sexo: 'Fêmea' as const,
      dataNascimento: '2021-08-25',
      // Uma fotografia de 600px em base64 anda pelos 60 a 90 mil caracteres.
      fotografia: `data:image/jpeg;base64,${'A'.repeat(800)}`,
    })),
    eventos: [],
    movimentos: [],
    medicamentos: [],
  };
}

function op(id: string): OpPendente {
  return {
    op: 'upsert',
    entidade: 'animal',
    dados: { id, exploracaoId: 'exp-1', especie: 'Bovino', sexo: 'Fêmea', dataNascimento: '2025-01-01' },
  };
}

beforeEach(() => {
  mockMapa.clear();
  mockTeto.caracteres = Infinity;
});

describe('com o armazenamento cheio', () => {
  it('a fila abdica da cópia dos dados para caber, e a alteração fica mesmo guardada', () => {
    expect(guardarCache(dados(40))).toBe(true);
    // Fica sem espaço para mais nada: a cópia ocupa quase tudo.
    mockTeto.caracteres = ocupado() + 50;
    expect(adicionarOutbox(op('novo'))).toBe(1);
    expect(lerOutbox().map((o) => (o.op === 'upsert' ? o.dados.id : o.id))).toEqual(['novo']);
    expect(lerCache()).toBeNull();
  });

  it('o que não cabe nem sem a cópia dos dados é recusado, em vez de dado por guardado', () => {
    mockTeto.caracteres = 20; // nem a fila vazia cabe
    expect(() => adicionarOutbox(op('novo'))).toThrow(ErroSemEspaco);
    expect(lerOutbox()).toEqual([]);
  });

  it('a recusa traz uma mensagem para o criador ler, e não um erro técnico', () => {
    mockTeto.caracteres = 20;
    try {
      adicionarOutbox(op('novo'));
      throw new Error('devia ter recusado');
    } catch (e) {
      expect(e).toBeInstanceOf(ErroSemEspaco);
      expect((e as Error).message).toMatch(/espaço/i);
    }
  });

  it('uma cópia dos dados que já não cabe é apagada, em vez de ficar desatualizada', () => {
    expect(guardarCache(dados(5))).toBe(true);
    mockTeto.caracteres = ocupado() + 10;
    expect(guardarCache(dados(60))).toBe(false);
    expect(lerCache()).toBeNull();
  });

  it('o registo do que se perdeu também abdica da cópia dos dados para caber', () => {
    expect(guardarCache(dados(40))).toBe(true);
    mockTeto.caracteres = ocupado() + 50;
    registarFalhada(op('recusado'), 'new row violates row-level security policy');
    expect(lerFalhadas()).toHaveLength(1);
  });

  it('com espaço de sobra, nada muda: a cópia dos dados fica e a fila cresce', () => {
    expect(guardarCache(dados(3))).toBe(true);
    expect(adicionarOutbox(op('a'))).toBe(1);
    expect(adicionarOutbox(op('b'))).toBe(2);
    expect(lerCache()?.animais).toHaveLength(3);
  });
});
