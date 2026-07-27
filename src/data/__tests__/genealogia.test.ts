/**
 * Testes da genealogia e do aviso que antecede uma eliminação.
 *
 * Duas regras que se cruzam, e é o cruzamento que estes testes seguram:
 *
 *   1. Eliminar deixou de apagar (`supabase/schema_auditoria.sql`), por isso o
 *      histórico do animal fica.
 *   2. Mas eliminar QUER DIZER "registado por engano", e um animal que não
 *      existiu não é mãe nem filho de ninguém: sai da árvore. Falecidos e
 *      vendidos ficam — esses existiram, e tirá-los partia a ascendência de
 *      todas as crias que deixaram.
 *
 * Errar na 2 é o que dói mais: uma genealogia com um animal a mais é uma
 * genealogia falsa, e ninguém repara enquanto não for tarde.
 */

import { describe, expect, it } from '@jest/globals';

import { avisosDeEliminacao, filhosDe, progenitorDe, rotuloAnimal, ascendentesDe, descendentesDe } from '../genealogia';
import type { Animal, Evento } from '../types';

function animal(id: string, patch: Partial<Animal> = {}): Animal {
  return {
    id,
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    dataNascimento: '2025-01-01',
    ...patch,
  };
}

function evento(animalId: string, patch: Partial<Evento> = {}): Evento {
  return {
    id: `ev-${animalId}-${Math.random()}`,
    animalId,
    tipo: 'Pesagem',
    data: '2026-01-01',
    descricao: '',
    ...patch,
  };
}

describe('avisosDeEliminacao', () => {
  it('não diz nada sobre um registo acabado de criar por engano', () => {
    // Nada a guardar e ninguém a perder um progenitor: uma frase seria ruído em
    // cima do único caso em que eliminar não custa nada a ninguém.
    const a = animal('a1');
    expect(avisosDeEliminacao(a, [], [a])).toEqual([]);
  });

  it('conta um registo do histórico', () => {
    const a = animal('a1');
    expect(avisosDeEliminacao(a, [evento('a1')], [a])).toEqual([
      'Fica guardado um registo no histórico.',
    ]);
  });

  it('conta os registos do histórico, para a frase ser concreta', () => {
    const a = animal('a1');
    const [aviso] = avisosDeEliminacao(a, [evento('a1'), evento('a1'), evento('a1')], [a]);
    expect(aviso).toContain('3 registos');
  });

  it('ignora eventos de outros animais', () => {
    const a = animal('a1');
    const outro = animal('a2');
    expect(avisosDeEliminacao(a, [evento('a2')], [a, outro])).toEqual([]);
  });

  it('avisa que a cria perde a MÃE', () => {
    // O aviso mudou de sentido quando a eliminação passou a tirar o animal da
    // árvore: já não é "fica guardada uma cria", é "uma cria perde a mãe". A
    // diferença é toda: uma é uma garantia, a outra é uma consequência.
    const mae = animal('m1');
    const cria = animal('c1', { maeId: 'm1' });
    expect(avisosDeEliminacao(mae, [], [mae, cria])).toEqual([
      'Uma cria deixa de ter esta mãe na árvore genealógica.',
    ]);
  });

  it('avisa que as crias perdem o PAI, no plural', () => {
    const pai = animal('p1', { sexo: 'Macho' });
    const crias = [animal('c1', { paiId: 'p1' }), animal('c2', { paiId: 'p1' })];
    const [aviso] = avisosDeEliminacao(pai, [], [pai, ...crias]);
    expect(aviso).toBe('2 crias deixam de ter este pai na árvore genealógica.');
  });

  it('dá as duas frases quando há as duas coisas a dizer', () => {
    const mae = animal('m1');
    const cria = animal('c1', { maeId: 'm1' });
    expect(avisosDeEliminacao(mae, [evento('m1')], [mae, cria])).toEqual([
      'Fica guardado um registo no histórico.',
      'Uma cria deixa de ter esta mãe na árvore genealógica.',
    ]);
  });
});

describe('o eliminado sai da árvore, o falecido fica', () => {
  it('uma cria eliminada deixa de aparecer como filha', () => {
    const mae = animal('m1');
    const engano = animal('c1', { maeId: 'm1', estado: 'eliminado' });
    const real = animal('c2', { maeId: 'm1' });
    expect(filhosDe([mae, engano, real], 'm1').map((a) => a.id)).toEqual(['c2']);
  });

  it('uma cria falecida CONTINUA a aparecer como filha', () => {
    // Morreu, mas nasceu: apagá-la da árvore era apagar um parto que houve.
    const mae = animal('m1');
    const morta = animal('c1', { maeId: 'm1', estado: 'falecido' });
    const vendida = animal('c2', { maeId: 'm1', estado: 'vendido' });
    expect(filhosDe([mae, morta, vendida], 'm1').map((a) => a.id).sort()).toEqual(['c1', 'c2']);
  });

  it('uma mãe eliminada deixa de ser mãe de quem lhe apontava', () => {
    const mae = animal('m1', { estado: 'eliminado' });
    const cria = animal('c1', { maeId: 'm1' });
    expect(progenitorDe([mae, cria], 'm1')).toBeUndefined();
  });

  it('uma mãe falecida continua a ser mãe', () => {
    const mae = animal('m1', { estado: 'falecido' });
    const cria = animal('c1', { maeId: 'm1' });
    expect(progenitorDe([mae, cria], 'm1')?.id).toBe('m1');
  });

  it('a ascendência não passa por um progenitor eliminado', () => {
    // E leva o ramo inteiro atrás: a avó só chegava à árvore através da mãe
    // que afinal nunca existiu, e mostrá-la era inventar uma linhagem.
    const avo = animal('av1');
    const mae = animal('m1', { maeId: 'av1', estado: 'eliminado' });
    const cria = animal('c1', { maeId: 'm1' });
    expect(ascendentesDe([avo, mae, cria], cria, 3)).toEqual([]);
  });

  it('a descendência salta os netos que vêm por um filho eliminado', () => {
    const mae = animal('m1');
    const filhoEngano = animal('f1', { maeId: 'm1', estado: 'eliminado' });
    const neto = animal('n1', { maeId: 'f1' });
    expect(descendentesDe([mae, filhoEngano, neto], mae, 3)).toEqual([]);
  });
});

describe('filhosDe', () => {
  it('encontra crias por mãe e por pai', () => {
    const mae = animal('m1');
    const pai = animal('p1', { sexo: 'Macho' });
    const c1 = animal('c1', { maeId: 'm1' });
    const c2 = animal('c2', { paiId: 'p1' });
    const todos = [mae, pai, c1, c2];

    expect(filhosDe(todos, 'm1').map((a) => a.id)).toEqual(['c1']);
    expect(filhosDe(todos, 'p1').map((a) => a.id)).toEqual(['c2']);
  });

  it('ordena das mais novas para as mais velhas', () => {
    const mae = animal('m1');
    const velha = animal('c1', { maeId: 'm1', dataNascimento: '2024-01-01' });
    const nova = animal('c2', { maeId: 'm1', dataNascimento: '2026-01-01' });

    expect(filhosDe([mae, velha, nova], 'm1').map((a) => a.id)).toEqual(['c2', 'c1']);
  });
});

describe('rotuloAnimal', () => {
  it('prefere o nome, depois o brinco, depois um genérico', () => {
    expect(rotuloAnimal(animal('a1', { nome: 'Mimosa' }))).toBe('Mimosa');
    expect(rotuloAnimal(animal('a1', { numeroIdentificacao: 'PT123' }))).toBe('PT123');
    expect(rotuloAnimal(animal('a1'))).toBe('Sem nome');
  });
});
