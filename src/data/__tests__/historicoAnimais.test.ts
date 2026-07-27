/**
 * Testes do histórico do efetivo (a auditoria de quem saiu).
 *
 * Porquê estes: este ecrã é o ÚNICO sítio onde um animal eliminado volta a
 * aparecer. Se a lista o deixar de fora, o registo existe na base de dados e
 * não existe em lado nenhum para quem usa a app — que é pior do que o ter
 * apagado, porque ninguém fica a saber. E se a ordem estiver trocada, quem
 * abre o ecrã para perceber o que aconteceu esta manhã lê primeiro o que
 * aconteceu no ano passado.
 */

import { describe, expect, it } from '@jest/globals';

import {
  contarPorMotivo,
  historicoDoEfetivo,
  saiuDoEfetivo,
  type MotivoSaida,
} from '../historicoAnimais';
import type { Animal } from '../types';

function animal(id: string, patch: Partial<Animal> = {}): Animal {
  return {
    id,
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: '2024-01-01',
    ...patch,
  };
}

function saido(id: string, motivo: MotivoSaida, patch: Partial<Animal> = {}): Animal {
  return animal(id, { estado: motivo, dataSaida: '2026-06-01', ...patch });
}

describe('saiuDoEfetivo', () => {
  it('trata a ausência de estado como ativo (registos antigos)', () => {
    expect(saiuDoEfetivo(animal('a1'))).toBe(false);
    expect(saiuDoEfetivo(animal('a2', { estado: 'ativo' }))).toBe(false);
  });

  it('conta os três motivos de saída', () => {
    expect(saiuDoEfetivo(saido('a1', 'falecido'))).toBe(true);
    expect(saiuDoEfetivo(saido('a2', 'vendido'))).toBe(true);
    expect(saiuDoEfetivo(saido('a3', 'eliminado'))).toBe(true);
  });
});

describe('historicoDoEfetivo', () => {
  it('deixa de fora os animais que estão no efetivo', () => {
    const lista = historicoDoEfetivo([animal('vivo'), saido('morto', 'falecido')]);
    expect(lista.map((l) => l.animal.id)).toEqual(['morto']);
  });

  it('inclui os eliminados — é o único sítio onde voltam a aparecer', () => {
    const lista = historicoDoEfetivo([saido('apagado', 'eliminado')]);
    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('eliminado');
  });

  it('ordena pelo instante do REGISTO, não pela data da saída', () => {
    // O animal que morreu em janeiro mas só foi registado hoje tem de vir
    // primeiro: o que este ecrã mostra é o rasto do que as pessoas fizeram.
    const antigo = saido('a1', 'falecido', {
      dataSaida: '2026-05-01',
      saidaEm: '2026-07-27T09:00:00.000Z',
    });
    const recente = saido('a2', 'vendido', {
      dataSaida: '2026-01-10',
      saidaEm: '2026-07-27T18:00:00.000Z',
    });
    expect(historicoDoEfetivo([antigo, recente]).map((l) => l.animal.id)).toEqual(['a2', 'a1']);
  });

  it('usa a data da saída quando não há instante de registo guardado', () => {
    // Os registos anteriores à coluna `saidaEm` não podem cair todos para o
    // fim por ordem indefinida: numa lista lida de cima para baixo isso
    // parece dados corrompidos.
    const velho = saido('a1', 'falecido', { dataSaida: '2026-01-01' });
    const novo = saido('a2', 'falecido', { dataSaida: '2026-06-01' });
    expect(historicoDoEfetivo([velho, novo]).map((l) => l.animal.id)).toEqual(['a2', 'a1']);
  });

  it('filtra por exploração', () => {
    const cá = saido('a1', 'vendido');
    const lá = saido('a2', 'vendido', { exploracaoId: 'exp-2' });
    const lista = historicoDoEfetivo([cá, lá], { exploracaoId: 'exp-2' });
    expect(lista.map((l) => l.animal.id)).toEqual(['a2']);
  });

  it('filtra por motivo', () => {
    const lista = historicoDoEfetivo(
      [saido('a1', 'vendido'), saido('a2', 'eliminado')],
      { motivo: 'eliminado' },
    );
    expect(lista.map((l) => l.animal.id)).toEqual(['a2']);
  });

  it('procura por nome e por brinco, sem distinguir maiúsculas', () => {
    const lista = [
      saido('a1', 'vendido', { nome: 'Mimosa' }),
      saido('a2', 'vendido', { numeroIdentificacao: 'PT123456' }),
    ];
    expect(historicoDoEfetivo(lista, { texto: 'mimo' }).map((l) => l.animal.id)).toEqual(['a1']);
    expect(historicoDoEfetivo(lista, { texto: 'pt1234' }).map((l) => l.animal.id)).toEqual(['a2']);
  });

  it('leva o autor e o instante do registo para a linha', () => {
    const [linha] = historicoDoEfetivo([
      saido('a1', 'eliminado', {
        saidaPor: 'user-7',
        saidaEm: '2026-07-27T18:00:00.000Z',
        motivoSaida: 'registado por engano',
      }),
    ]);
    expect(linha.registadoPor).toBe('user-7');
    expect(linha.registadoEm).toBe('2026-07-27T18:00:00.000Z');
    expect(linha.nota).toBe('registado por engano');
  });
});

describe('contarPorMotivo', () => {
  it('conta cada motivo, e zero para os que não têm ninguém', () => {
    const conta = contarPorMotivo([
      animal('vivo'),
      saido('a1', 'vendido'),
      saido('a2', 'vendido'),
      saido('a3', 'eliminado'),
    ]);
    expect(conta).toEqual({ falecido: 0, vendido: 2, eliminado: 1 });
  });

  it('respeita a exploração escolhida', () => {
    const conta = contarPorMotivo(
      [saido('a1', 'vendido'), saido('a2', 'vendido', { exploracaoId: 'exp-2' })],
      { exploracaoId: 'exp-1' },
    );
    expect(conta.vendido).toBe(1);
  });
});
