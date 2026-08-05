/**
 * Fixar o relógio nos testes de datas.
 * ------------------------------------
 * Vive fora de `__tests__/` de propósito: o jest trata tudo o que está lá dentro
 * como uma suite, e um ficheiro de apoio sem testes rebentava a execução.
 */

import { jest } from '@jest/globals';

/**
 * Corre `corpo` com o RELÓGIO e o FUSO fixos.
 *
 * O fuso tem de ser fixado, e não só o relógio. Metade dos erros de contagem de
 * dias só existe onde o fuso não é UTC — uma data sem hora (`2026-08-05`) é lida
 * como meia-noite UTC, que em UTC coincide com a meia-noite local e não desalinha
 * nada — e a CI corre em UTC. Sem forçar o fuso, um teste destes fica verde na CI
 * sem provar nada, que é exatamente a armadilha que ele existe para fechar.
 *
 * O Node relê o `process.env.TZ` a cada mudança, por isso basta atribuí-lo; o
 * valor anterior é reposto no fim, mesmo que a expectativa falhe.
 *
 * @param fuso  nome IANA, ex. `'Europe/Lisbon'`.
 * @param local instante em hora LOCAL desse fuso: `[ano, mês (1-12), dia, hora, minuto]`.
 */
export function comRelogio(
  fuso: string,
  local: [ano: number, mes: number, dia: number, hora: number, minuto: number],
  corpo: () => void,
): void {
  const tzAnterior = process.env.TZ;
  process.env.TZ = fuso;
  jest.useFakeTimers();
  try {
    const [ano, mes, dia, hora, minuto] = local;
    // Construído já com o fuso trocado — é o que faz `[2026, 8, 6, 0, 30]`
    // significar a meia-noite e meia DE LISBOA e não a do runner.
    jest.setSystemTime(new Date(ano, mes - 1, dia, hora, minuto, 0));
    corpo();
  } finally {
    jest.useRealTimers();
    if (tzAnterior === undefined) delete process.env.TZ;
    else process.env.TZ = tzAnterior;
  }
}
