/**
 * Testes do aviso que antecede uma eliminação.
 *
 * Porquê estes: eliminar deixou de apagar (ver `supabase/schema_auditoria.sql`)
 * e o que resta é dizer à pessoa, ANTES de ela decidir, o que fica guardado.
 * Contar a menos faria a app prometer que se perde trabalho que não se perde;
 * contar a mais faria uma eliminação simples parecer perigosa. As duas versões
 * levam a mesma coisa: alguém que não carrega no botão de que precisa.
 */

import { describe, expect, it } from '@jest/globals';

import { filhosDe, historicoQueFicaGuardado, rotuloAnimal } from '../genealogia';
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

describe('historicoQueFicaGuardado', () => {
  it('não diz nada sobre um registo acabado de criar por engano', () => {
    // Não há histórico nenhum a guardar: uma frase a dizê-lo seria ruído em
    // cima do único caso em que eliminar não custa nada a ninguém.
    const a = animal('a1');
    expect(historicoQueFicaGuardado(a, [], [a])).toBeNull();
  });

  it('conta um registo do histórico', () => {
    const a = animal('a1');
    expect(historicoQueFicaGuardado(a, [evento('a1')], [a])).toContain('um registo no histórico');
  });

  it('conta os registos do histórico, para a frase ser concreta', () => {
    const a = animal('a1');
    const texto = historicoQueFicaGuardado(a, [evento('a1'), evento('a1'), evento('a1')], [a]);
    expect(texto).toContain('3 registos');
  });

  it('ignora eventos de outros animais', () => {
    const a = animal('a1');
    const outro = animal('a2');
    expect(historicoQueFicaGuardado(a, [evento('a2')], [a, outro])).toBeNull();
  });

  it('conta as crias de que é mãe', () => {
    const mae = animal('m1');
    const cria = animal('c1', { maeId: 'm1' });
    expect(historicoQueFicaGuardado(mae, [], [mae, cria])).toContain('uma cria');
  });

  it('conta as crias de que é pai', () => {
    const pai = animal('p1', { sexo: 'Macho' });
    const crias = [animal('c1', { paiId: 'p1' }), animal('c2', { paiId: 'p1' })];
    expect(historicoQueFicaGuardado(pai, [], [pai, ...crias])).toContain('2 crias');
  });

  it('junta as duas coisas numa frase só', () => {
    // Duas frases seguidas, cada uma com o seu "ficam guardados", liam-se como
    // um erro da app.
    const mae = animal('m1');
    const cria = animal('c1', { maeId: 'm1' });
    const texto = historicoQueFicaGuardado(mae, [evento('m1')], [mae, cria]);
    expect(texto).toBe('Ficam guardados um registo no histórico e uma cria na genealogia.');
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
