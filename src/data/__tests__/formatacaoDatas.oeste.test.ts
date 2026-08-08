/**
 * Escrever datas não pode depender do fuso. Corre a OESTE de Greenwich.
 * --------------------------------------------------------------------
 * `npm run test:fuso-oeste` (config `jest.config.oeste.js`). NÃO entra na suite
 * normal, que corre fixada em hora de Portugal.
 *
 * Porquê à parte: em Portugal (UTC+0/+1) as versões erradas destas funções
 * acertavam SEMPRE. Uma data sem hora é lida como meia-noite UTC, e a meia-noite
 * UTC cai sempre no mesmo dia local quando se está a leste. Não há input nenhum
 * que distinga o certo do errado em Lisboa — este ficheiro é a única forma de
 * mostrar o erro em vez de argumentar que ele existe.
 */

import { describe, expect, it } from '@jest/globals';

import { diaIso, formatDataCurta, formatDataHora, formatDataPt } from '../helpers';

describe('a oeste de Greenwich', () => {
  it('está mesmo num fuso a oeste (senão isto não prova nada)', () => {
    // O mesmo cuidado do `comRelogio`: um teste que exige um fuso tem de
    // confirmar que o tem. Foi por não confirmar que se andou a tomar por
    // provado o que não estava.
    expect(new Date(2026, 2, 2).getTimezoneOffset()).toBeGreaterThan(0);
  });

  it('uma data SEM hora escreve-se tal e qual', () => {
    // `'2026-03-02'` é o que o servidor devolve numa coluna `date`. Passá-la por
    // `new Date` fazia dela meia-noite UTC, que aqui ainda é dia 1: a folha
    // exportada escrevia 01/03/2026 por cima de uma data que dizia 2.
    expect(formatDataCurta('2026-03-02')).toBe('02/03/2026');
    expect(formatDataPt('2026-03-02')).toBe('2 mar 2026');
  });

  it('e o primeiro dia do ano não recua para o ano anterior', () => {
    // O caso mais visível de todos: 31/12/2025 num relatório de 2026.
    expect(formatDataCurta('2026-01-01')).toBe('01/01/2026');
    expect(formatDataPt('2026-01-01')).toBe('1 jan 2026');
  });

  it('um instante completo continua a escrever-se em hora local', () => {
    // A outra metade do contrato: quando há hora, é o dia LOCAL que conta, não o
    // dia UTC. Às 20:30 de Nova Iorque já é dia 3 em Londres, e o que o criador
    // vê tem de ser o dia dele.
    const noite = new Date(2026, 2, 2, 20, 30).toISOString();
    expect(formatDataCurta(noite)).toBe('02/03/2026');
    expect(diaIso(noite)).toBe('2026-03-02');
  });

  it('o formatDataHora também não deixa o dia recuar', () => {
    // Esta precisa do instante — é a hora que vem mostrar — e para o que recebe
    // hoje (`registadoEm`, `acessoAte`, todos `timestamptz`) já estava certa. O
    // que se fecha é a entrada sem hora: virava meia-noite UTC, que aqui é o dia
    // anterior, e ainda inventava um "19:00" que ninguém registou.
    expect(formatDataHora('2026-03-02')).toBe('02/03');
    expect(formatDataHora('2026-01-01')).toBe('01/01');
  });

  it('mas com hora a dentro continua a mostrar a hora LOCAL', () => {
    // O contrato da outra metade: um instante escreve-se na hora de quem o lê.
    // Às 20:30 daqui já é dia 3 em Londres, e o que aparece tem de ser o dia e a
    // hora locais — não os de UTC.
    const noite = new Date(2026, 2, 2, 20, 30).toISOString();
    expect(formatDataHora(noite)).toBe('02/03 20:30');
  });

  it('as três leituras do mesmo dia concordam entre si', () => {
    // `diaIso`, a data curta e a data por extenso têm de dizer o mesmo dia.
    // Enquanto duas iam por `diaIso` e uma por `new Date`, discordavam — e o
    // Excel exportado ficava com colunas a apontar para dias diferentes.
    for (const entrada of ['2026-03-02', '2026-01-01', '2026-08-05']) {
      const dia = diaIso(entrada);
      const [ano, mes, d] = dia.split('-');
      expect(formatDataCurta(entrada)).toBe(`${d}/${mes}/${ano}`);
      expect(formatDataPt(entrada)).toContain(String(Number(d)));
      expect(formatDataPt(entrada)).toContain(ano);
    }
  });
});
