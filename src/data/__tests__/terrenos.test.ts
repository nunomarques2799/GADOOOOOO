import { describe, expect, it } from '@jest/globals';

import { agruparTerrenosPorExploracao, emLinhas, SEM_EXPLORACAO } from '../terrenos';
import type { Terreno } from '../types';

function terreno(id: string, nome: string, exploracaoId: string): Terreno {
  return { id, nome, exploracaoId, tipo: 'Pastagem' };
}

const EXPLORACOES = [
  { id: 'e2', nome: 'Monte do Avô' },
  { id: 'e1', nome: 'Herdade das Corgas' },
];

describe('agruparTerrenosPorExploracao', () => {
  it('faz um grupo por exploração, por ordem do nome', () => {
    const grupos = agruparTerrenosPorExploracao(
      [terreno('t1', 'Lameiro', 'e2'), terreno('t2', 'Cerrado', 'e1')],
      EXPLORACOES,
    );
    expect(grupos.map((g) => g.nome)).toEqual(['Herdade das Corgas', 'Monte do Avô']);
  });

  it('ordena os terrenos por nome dentro de cada grupo', () => {
    const grupos = agruparTerrenosPorExploracao(
      [
        terreno('t1', 'Vale Fundo', 'e1'),
        terreno('t2', 'Barroca', 'e1'),
        terreno('t3', 'Cerrado', 'e1'),
      ],
      EXPLORACOES,
    );
    expect(grupos[0].terrenos.map((t) => t.nome)).toEqual(['Barroca', 'Cerrado', 'Vale Fundo']);
  });

  it('um terreno só entra no grupo da sua exploração', () => {
    const grupos = agruparTerrenosPorExploracao(
      [terreno('t1', 'Lameiro', 'e2'), terreno('t2', 'Cerrado', 'e1')],
      EXPLORACOES,
    );
    const corgas = grupos.find((g) => g.exploracaoId === 'e1')!;
    const monte = grupos.find((g) => g.exploracaoId === 'e2')!;
    expect(corgas.terrenos.map((t) => t.id)).toEqual(['t2']);
    expect(monte.terrenos.map((t) => t.id)).toEqual(['t1']);
  });

  it('a exploração sem terrenos aparece vazia, não desaparece', () => {
    // É assim que se vê que falta registar o terreno de uma delas — e é onde o
    // ecrã oferece criá-lo.
    const grupos = agruparTerrenosPorExploracao([terreno('t1', 'Lameiro', 'e2')], EXPLORACOES);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.exploracaoId === 'e1')!.terrenos).toEqual([]);
  });

  it('um terreno de exploração desconhecida não se perde', () => {
    // Cache fria (os terrenos chegam antes das explorações) ou exploração
    // apagada noutro aparelho: sem este grupo, o terreno sumia da lista.
    const grupos = agruparTerrenosPorExploracao(
      [terreno('t1', 'Lameiro', 'e2'), terreno('t9', 'Órfão', 'nao-existe')],
      EXPLORACOES,
    );
    const ultimo = grupos[grupos.length - 1];
    expect(ultimo.nome).toBe(SEM_EXPLORACAO);
    expect(ultimo.exploracaoId).toBeUndefined();
    expect(ultimo.terrenos.map((t) => t.id)).toEqual(['t9']);
  });

  it('sem terrenos nem explorações, não há grupos', () => {
    expect(agruparTerrenosPorExploracao([], [])).toEqual([]);
  });
});

describe('emLinhas', () => {
  it('numa coluna, cada elemento é uma linha', () => {
    expect(emLinhas(['a', 'b'], 1)).toEqual([['a'], ['b']]);
  });

  it('em duas colunas, junta a pares', () => {
    expect(emLinhas(['a', 'b', 'c', 'd'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('o ímpar fica sozinho na última linha', () => {
    // O ecrã completa a linha com um espaço vazio; sem isso o último cartão
    // esticava para o dobro da largura.
    expect(emLinhas(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('lista vazia dá lista vazia', () => {
    expect(emLinhas([], 2)).toEqual([]);
  });
});
