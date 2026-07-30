/**
 * Testes da leitura do registo de alterações.
 *
 * Porquê estes: o que este ecrã diz é usado para julgar o trabalho de outra
 * pessoa. Uma alteração agrupada no dia errado, ou uma hora convertida em UTC
 * quando Portugal está em UTC+1, põe o veterinário a mexer nos animais à
 * meia-noite de um dia em que nem lá esteve — e a app diz isso com toda a
 * confiança, porque não tem como saber que está errada.
 *
 * O que escreve as linhas são os triggers de `supabase/schema_atividade.sql`.
 * O que se testa aqui é a apresentação delas.
 */

import { describe, expect, it, jest } from '@jest/globals';

// O módulo importa o cliente do Supabase para ir buscar as linhas, e esse puxa
// o AsyncStorage nativo, que num teste não existe. O que se testa aqui é o que
// se faz com as linhas DEPOIS de chegarem — o servidor não entra.
jest.mock('../supabase', () => ({ supabase: null, supabaseConfigurado: false }));

import {
  agruparPorDia,
  autores,
  frase,
  horaDe,
  legendaTabela,
  tituloDoDia,
  type Atividade,
} from '../atividade';

/** Uma alteração, com o mínimo escrito à mão. */
function linha(p: Partial<Atividade> & { id: number; em: string }): Atividade {
  return {
    exploracaoId: 'exp1',
    userId: 'u1',
    tabela: 'animal',
    acao: 'alterou',
    resumo: 'Malhada',
    ...p,
  };
}

/** Um instante em hora LOCAL — é assim que o criador o vê no ecrã. */
const local = (ano: number, mes: number, dia: number, h = 12, m = 0) =>
  new Date(ano, mes - 1, dia, h, m).toISOString();

describe('agruparPorDia', () => {
  it('junta as alterações do mesmo dia', () => {
    const g = agruparPorDia([
      linha({ id: 3, em: local(2026, 7, 30, 9) }),
      linha({ id: 2, em: local(2026, 7, 30, 8) }),
      linha({ id: 1, em: local(2026, 7, 29, 18) }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].linhas.map((l) => l.id)).toEqual([3, 2]);
    expect(g[1].linhas.map((l) => l.id)).toEqual([1]);
  });

  it('mantém a ordem que veio do servidor', () => {
    // A ordenação é da consulta (mais recente primeiro). Reordenar aqui daria
    // duas fontes de ordem a discordarem quando uma delas mudasse.
    const g = agruparPorDia([
      linha({ id: 1, em: local(2026, 7, 28) }),
      linha({ id: 2, em: local(2026, 7, 30) }),
    ]);
    expect(g.map((x) => x.linhas[0].id)).toEqual([1, 2]);
  });

  it('agrupa pelo dia LOCAL, não pelo dia em UTC', () => {
    // Portugal está em UTC+1 no verão: entre a meia-noite e a uma da manhã, o
    // dia em UTC ainda é o anterior. Agrupar por UTC punha a alteração de hoje
    // de madrugada no grupo de ontem.
    const meiaNoiteEMeia = local(2026, 7, 30, 0, 30);
    const aoAlmoco = local(2026, 7, 30, 13, 0);
    const g = agruparPorDia([linha({ id: 2, em: aoAlmoco }), linha({ id: 1, em: meiaNoiteEMeia })]);
    expect(g).toHaveLength(1);
  });

  it('lista vazia dá zero grupos', () => {
    expect(agruparPorDia([])).toEqual([]);
  });
});

describe('tituloDoDia', () => {
  const agora = new Date(2026, 6, 30, 15, 0);

  it('diz Hoje e Ontem', () => {
    expect(tituloDoDia('2026-07-30', agora)).toBe('Hoje');
    expect(tituloDoDia('2026-07-29', agora)).toBe('Ontem');
  });

  it('mais atrás escreve a data à portuguesa', () => {
    expect(tituloDoDia('2026-07-20', agora)).toBe('20/07/2026');
  });

  it('acerta na virada do mês', () => {
    // O "ontem" de 1 de agosto é 31 de julho, e não o dia 0 de agosto.
    expect(tituloDoDia('2026-07-31', new Date(2026, 7, 1, 10, 0))).toBe('Ontem');
  });
});

describe('frase', () => {
  it('usa o verbo próprio de cada tabela', () => {
    // «criou movimento» não é português e «registou terreno» é ao lado do que
    // se fez: as frases são escritas à mão de propósito.
    expect(frase(linha({ id: 1, em: local(2026, 7, 30), tabela: 'animal', acao: 'criou' })))
      .toBe('Registou o animal');
    expect(frase(linha({ id: 2, em: local(2026, 7, 30), tabela: 'terreno', acao: 'alterou' })))
      .toBe('Alterou o terreno');
    expect(frase(linha({ id: 3, em: local(2026, 7, 30), tabela: 'movimento', acao: 'criou' })))
      .toBe('Lançou');
  });

  it('tirar do efetivo não se lê como apagar', () => {
    expect(frase(linha({ id: 4, em: local(2026, 7, 30), tabela: 'animal', acao: 'removeu' })))
      .toBe('Tirou do efetivo');
  });

  it('há legenda para todas as tabelas', () => {
    for (const t of ['animal', 'evento', 'terreno', 'movimento'] as const) {
      expect(legendaTabela(t)).toBeTruthy();
    }
  });
});

describe('horaDe', () => {
  it('dá só as horas e os minutos (o dia já está no grupo)', () => {
    expect(horaDe(local(2026, 7, 30, 9, 5))).toBe('09:05');
  });
});

describe('autores', () => {
  it('conta por pessoa e põe à frente quem mexeu mais', () => {
    const lista = [
      linha({ id: 1, em: local(2026, 7, 30), userId: 'a' }),
      linha({ id: 2, em: local(2026, 7, 30), userId: 'b' }),
      linha({ id: 3, em: local(2026, 7, 30), userId: 'b' }),
    ];
    expect(autores(lista)).toEqual([
      { userId: 'b', quantas: 2 },
      { userId: 'a', quantas: 1 },
    ]);
  });

  it('ignora as linhas sem autor', () => {
    // Acontece quando a conta de quem fez a alteração foi apagada: a linha
    // fica, o autor não. Um chip de filtro sem nome nem id não filtra nada.
    const lista = [
      linha({ id: 1, em: local(2026, 7, 30), userId: undefined }),
      linha({ id: 2, em: local(2026, 7, 30), userId: 'a' }),
    ];
    expect(autores(lista)).toEqual([{ userId: 'a', quantas: 1 }]);
  });
});
