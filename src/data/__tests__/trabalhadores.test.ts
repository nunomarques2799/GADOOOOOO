import { describe, expect, it } from '@jest/globals';

import {
  agruparTrabalhadores,
  contarPorPapel,
  iniciais,
  resumoVinculos,
  SEM_NOME,
  type EquipaExploracao,
  type MembroComNome,
} from '../trabalhadores';
import type { RoleMembro } from '../types';

function membro(
  userId: string,
  nome: string,
  role: RoleMembro,
  id = `m-${userId}-${role}`,
): MembroComNome {
  return { id, userId, exploracaoId: 'ignorado', role, nome };
}

function equipa(
  exploracaoId: string,
  nomeExploracao: string,
  membros: MembroComNome[],
): EquipaExploracao {
  return { exploracaoId, nomeExploracao, membros };
}

describe('agruparTrabalhadores', () => {
  it('junta o mesmo homem que anda em duas quintas numa linha só', () => {
    const lista = agruparTrabalhadores([
      equipa('e1', 'Monte do Avô', [membro('u1', 'Zé Silva', 'trabalhador', 'm1')]),
      equipa('e2', 'Herdade das Corgas', [membro('u1', 'Zé Silva', 'trabalhador', 'm2')]),
    ]);
    expect(lista).toHaveLength(1);
    expect(lista[0].vinculos.map((v) => v.nomeExploracao)).toEqual([
      'Herdade das Corgas',
      'Monte do Avô',
    ]);
  });

  it('deixa de fora quem está a olhar (o dono não é seu próprio trabalhador)', () => {
    const lista = agruparTrabalhadores(
      [
        equipa('e1', 'Monte do Avô', [
          membro('dono', 'Joaquim', 'admin'),
          membro('u1', 'Zé Silva', 'trabalhador'),
        ]),
      ],
      { excluirUserId: 'dono' },
    );
    expect(lista.map((t) => t.nome)).toEqual(['Zé Silva']);
  });

  it('ordena trabalhadores, depois veterinários, depois donos — e por nome', () => {
    const lista = agruparTrabalhadores([
      equipa('e1', 'Monte do Avô', [
        membro('u3', 'Ana Dono', 'admin'),
        membro('u2', 'Vet Bento', 'veterinario'),
        membro('u1', 'Zé Silva', 'trabalhador'),
        membro('u4', 'Ana Trabalha', 'trabalhador'),
      ]),
    ]);
    expect(lista.map((t) => t.nome)).toEqual(['Ana Trabalha', 'Zé Silva', 'Vet Bento', 'Ana Dono']);
  });

  it('quem é trabalhador numa e veterinário noutra aparece como trabalhador', () => {
    // É o papel de quem está lá todos os dias, e é por ele que se procura a
    // pessoa nesta lista.
    const [t] = agruparTrabalhadores([
      equipa('e1', 'Monte do Avô', [membro('u1', 'Zé', 'veterinario', 'm1')]),
      equipa('e2', 'Corgas', [membro('u1', 'Zé', 'trabalhador', 'm2')]),
    ]);
    expect(t.papelPrincipal).toBe('trabalhador');
    expect(t.vinculos).toHaveLength(2);
  });

  it('não conta o mesmo vínculo duas vezes se a equipa vier repetida', () => {
    const m = membro('u1', 'Zé', 'trabalhador', 'm1');
    const [t] = agruparTrabalhadores([
      equipa('e1', 'Monte do Avô', [m]),
      equipa('e1', 'Monte do Avô', [m]),
    ]);
    expect(t.vinculos).toHaveLength(1);
  });

  it('aproveita o nome de outra linha quando o perfil ainda não o tem', () => {
    const [t] = agruparTrabalhadores([
      equipa('e1', 'Monte do Avô', [membro('u1', SEM_NOME, 'trabalhador', 'm1')]),
      equipa('e2', 'Corgas', [membro('u1', 'Zé Silva', 'trabalhador', 'm2')]),
    ]);
    expect(t.nome).toBe('Zé Silva');
  });

  it('sem equipas devolve lista vazia', () => {
    expect(agruparTrabalhadores([])).toEqual([]);
  });
});

describe('contarPorPapel', () => {
  it('conta pelo papel principal de cada pessoa', () => {
    const lista = agruparTrabalhadores([
      equipa('e1', 'Monte do Avô', [
        membro('u1', 'Zé', 'trabalhador'),
        membro('u2', 'Ana', 'trabalhador'),
        membro('u3', 'Vet', 'veterinario'),
      ]),
    ]);
    expect(contarPorPapel(lista)).toEqual({ trabalhador: 2, veterinario: 1, admin: 0 });
  });
});

describe('resumoVinculos', () => {
  const so = (equipas: EquipaExploracao[]) => resumoVinculos(agruparTrabalhadores(equipas)[0]);

  it('com uma exploração diz o papel e o nome dela', () => {
    expect(so([equipa('e1', 'Monte do Avô', [membro('u1', 'Zé', 'trabalhador')])])).toBe(
      'Trabalhador em Monte do Avô',
    );
  });

  it('com o mesmo papel em várias, conta-as', () => {
    expect(
      so([
        equipa('e1', 'Monte do Avô', [membro('u1', 'Zé', 'trabalhador', 'm1')]),
        equipa('e2', 'Corgas', [membro('u1', 'Zé', 'trabalhador', 'm2')]),
      ]),
    ).toBe('Trabalhador em 2 explorações');
  });

  it('com papéis diferentes, diz qual é onde', () => {
    expect(
      so([
        equipa('e1', 'Monte do Avô', [membro('u1', 'Zé', 'trabalhador', 'm1')]),
        equipa('e2', 'Corgas', [membro('u1', 'Zé', 'veterinario', 'm2')]),
      ]),
    ).toBe('Veterinário em Corgas · Trabalhador em Monte do Avô');
  });
});

describe('iniciais', () => {
  it('leva a primeira e a última palavra', () => {
    expect(iniciais('Joaquim Marques')).toBe('JM');
    expect(iniciais('Ana Maria Costa Silva')).toBe('AS');
  });

  it('com um nome só, leva uma letra', () => {
    expect(iniciais('Zé')).toBe('Z');
  });

  it('sem nome não rebenta', () => {
    expect(iniciais('')).toBe('?');
    expect(iniciais(SEM_NOME)).toBe('?');
  });
});
