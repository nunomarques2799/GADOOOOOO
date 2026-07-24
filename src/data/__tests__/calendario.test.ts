import { describe, expect, it } from '@jest/globals';

import {
  agruparPorDia,
  celulasDoMes,
  chaveDia,
  mesVizinho,
  piorGravidade,
  rotuloMes,
} from '../calendario';
import type { Alerta } from '../types';

function alerta(id: string, over: Partial<Alerta> = {}): Alerta {
  return {
    id,
    categoria: 'parto',
    gravidade: 'info',
    titulo: '',
    descricao: '',
    ...over,
  };
}

/** Data local, para os testes não dependerem do fuso de quem os corre. */
function local(ano: number, mes: number, dia: number, hora = 12): string {
  return new Date(ano, mes - 1, dia, hora, 0, 0).toISOString();
}

describe('chaveDia', () => {
  it('identifica o dia em hora local', () => {
    expect(chaveDia(local(2026, 7, 3))).toBe('2026-07-03');
    expect(chaveDia(new Date(2026, 0, 9))).toBe('2026-01-09');
  });

  it('o dia é o que o criador vê no relógio dele, não o de UTC', () => {
    // Um parto às 23:00 em Portugal é, em UTC no verão, já dia seguinte.
    // Agrupar por UTC mudava o dia do parto conforme o mês do ano.
    expect(chaveDia(local(2026, 7, 3, 23))).toBe('2026-07-03');
    expect(chaveDia(local(2026, 7, 3, 0))).toBe('2026-07-03');
  });
});

describe('agruparPorDia', () => {
  it('junta no mesmo dia o que cai no mesmo dia', () => {
    const m = agruparPorDia([
      alerta('a', { data: local(2026, 7, 3, 9) }),
      alerta('b', { data: local(2026, 7, 3, 18) }),
      alerta('c', { data: local(2026, 7, 4) }),
    ]);
    expect(m.get('2026-07-03')?.map((a) => a.id)).toEqual(['a', 'b']);
    expect(m.get('2026-07-04')?.map((a) => a.id)).toEqual(['c']);
  });

  it('ignora os alertas sem dia marcado', () => {
    // "Sem registo de vacinação" não é um prazo — não tem dia nenhum onde
    // caber, e inventar-lhe um punha-o no calendário como tarefa marcada.
    const m = agruparPorDia([alerta('sem-data'), alerta('com', { data: local(2026, 7, 3) })]);
    expect([...m.keys()]).toEqual(['2026-07-03']);
  });
});

describe('piorGravidade', () => {
  it('a mais grave é a que manda no dia', () => {
    expect(
      piorGravidade([
        alerta('a', { gravidade: 'info' }),
        alerta('b', { gravidade: 'urgente' }),
        alerta('c', { gravidade: 'aviso' }),
      ]),
    ).toBe('urgente');
    expect(piorGravidade([alerta('a', { gravidade: 'aviso' })])).toBe('aviso');
  });

  it('um dia sem alertas não tem gravidade', () => {
    expect(piorGravidade([])).toBeUndefined();
  });
});

describe('celulasDoMes', () => {
  it('começa à segunda-feira', () => {
    // Julho de 2026 começa a uma quarta-feira: a grelha abre com 29 e 30 de
    // junho. Com a semana a começar ao domingo, o mês inteiro escorregava um
    // dia e cada alerta aparecia na coluna errada.
    const c = celulasDoMes(2026, 6); // mês 6 = julho
    expect(c[0].data.getDate()).toBe(29);
    expect(c[0].data.getMonth()).toBe(5); // junho
    expect(c[0].doMes).toBe(false);
    expect(c[2].data.getDate()).toBe(1);
    expect(c[2].doMes).toBe(true);
  });

  it('um mês que comece à segunda não ganha uma semana à frente', () => {
    // Junho de 2026 começa a uma segunda-feira.
    const c = celulasDoMes(2026, 5);
    expect(c[0].data.getDate()).toBe(1);
    expect(c[0].doMes).toBe(true);
  });

  it('tem sempre semanas inteiras', () => {
    for (let mes = 0; mes < 12; mes++) {
      const c = celulasDoMes(2026, mes);
      expect(c.length % 7).toBe(0);
      expect([35, 42]).toContain(c.length);
    }
  });

  it('não deixa uma última linha inteira fora do mês', () => {
    // Uma sexta semana só de cinzentos é meia página de nada.
    for (let mes = 0; mes < 12; mes++) {
      const c = celulasDoMes(2026, mes);
      expect(c.slice(-7).some((x) => x.doMes)).toBe(true);
    }
  });

  it('cobre o mês todo, incluindo fevereiro bissexto', () => {
    const c = celulasDoMes(2028, 1); // fevereiro de 2028 tem 29 dias
    const dias = c.filter((x) => x.doMes).map((x) => x.data.getDate());
    expect(dias[0]).toBe(1);
    expect(dias[dias.length - 1]).toBe(29);
    expect(dias.length).toBe(29);
  });

  it('todos os meses aparecem completos', () => {
    const esperado = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let mes = 0; mes < 12; mes++) {
      expect(celulasDoMes(2026, mes).filter((x) => x.doMes).length).toBe(esperado[mes]);
    }
  });
});

describe('mesVizinho', () => {
  it('anda para trás e para a frente sem estourar o ano', () => {
    expect(mesVizinho(2026, 0, -1)).toEqual({ ano: 2025, mes: 11 });
    expect(mesVizinho(2026, 11, 1)).toEqual({ ano: 2027, mes: 0 });
    expect(mesVizinho(2026, 6, 1)).toEqual({ ano: 2026, mes: 7 });
  });
});

describe('rotuloMes', () => {
  it('escreve o mês por extenso, em português', () => {
    expect(rotuloMes(2026, 6)).toBe('julho de 2026');
    expect(rotuloMes(2026, 2)).toBe('março de 2026');
  });
});
