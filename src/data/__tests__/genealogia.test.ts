/**
 * Testes da regra de eliminação.
 *
 * Porquê estes: "eliminar" servia dois casos opostos com a mesma operação —
 * apagar um registo criado por engano (o animal nunca existiu) e apagar um
 * animal com meses de histórico (a cascata leva os eventos atrás, incluindo
 * os que outra pessoa registou hoje). A condição "sem histórico" é o que os
 * separa, e enganar-se nela ou destrói trabalho ou impede o criador de
 * corrigir um engano.
 *
 * Espelha o RPC `eliminar_animal` de `supabase/schema_eliminar.sql`. Ao mudar
 * um, mudar o outro.
 */

import { describe, expect, it } from '@jest/globals';

import { filhosDe, impedimentoParaEliminar, rotuloAnimal } from '../genealogia';
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

describe('impedimentoParaEliminar', () => {
  it('deixa eliminar um registo acabado de criar por engano', () => {
    // É o caso legítimo: enganou-se a registar, o animal nunca existiu.
    const a = animal('a1');
    expect(impedimentoParaEliminar(a, [], [a])).toBeNull();
  });

  it('impede quando o animal tem histórico', () => {
    const a = animal('a1');
    const motivo = impedimentoParaEliminar(a, [evento('a1')], [a]);
    expect(motivo).toContain('um registo no histórico');
  });

  it('conta os registos do histórico, para a mensagem ser concreta', () => {
    const a = animal('a1');
    const motivo = impedimentoParaEliminar(a, [evento('a1'), evento('a1'), evento('a1')], [a]);
    expect(motivo).toContain('3 registos');
  });

  it('ignora eventos de outros animais', () => {
    // Um erro aqui bloquearia eliminações legítimas sem explicação nenhuma.
    const a = animal('a1');
    const outro = animal('a2');
    expect(impedimentoParaEliminar(a, [evento('a2')], [a, outro])).toBeNull();
  });

  it('impede quando é mãe de outro animal', () => {
    // Apagar partiria a árvore genealógica da cria.
    const mae = animal('m1');
    const cria = animal('c1', { maeId: 'm1' });
    const motivo = impedimentoParaEliminar(mae, [], [mae, cria]);
    expect(motivo).toContain('mãe ou pai');
  });

  it('impede quando é pai de outro animal', () => {
    const pai = animal('p1', { sexo: 'Macho' });
    const cria = animal('c1', { paiId: 'p1' });
    expect(impedimentoParaEliminar(pai, [], [pai, cria])).not.toBeNull();
  });

  it('conta as crias', () => {
    const mae = animal('m1');
    const crias = [animal('c1', { maeId: 'm1' }), animal('c2', { maeId: 'm1' })];
    expect(impedimentoParaEliminar(mae, [], [mae, ...crias])).toContain('2 animais');
  });

  it('o histórico fala primeiro — é a razão mais concreta para o criador', () => {
    const mae = animal('m1');
    const cria = animal('c1', { maeId: 'm1' });
    const motivo = impedimentoParaEliminar(mae, [evento('m1')], [mae, cria]);
    expect(motivo).toContain('histórico');
  });

  it('um animal marcado como falecido continua a não se poder eliminar', () => {
    // Marcar a saída é precisamente a alternativa a eliminar; se depois disso
    // se pudesse eliminar na mesma, a regra não valia nada — a saída cria um
    // evento (Morte/Venda), e é esse evento que a protege.
    const a = animal('a1', { estado: 'falecido', dataSaida: '2026-06-01' });
    const morte = evento('a1', { tipo: 'Morte' });
    expect(impedimentoParaEliminar(a, [morte], [a])).not.toBeNull();
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
