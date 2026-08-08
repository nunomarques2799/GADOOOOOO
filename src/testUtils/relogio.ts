/**
 * Fixar o relógio nos testes de datas.
 * ------------------------------------
 * Vive fora de `__tests__/` de propósito: o jest trata tudo o que está lá dentro
 * como uma suite, e um ficheiro de apoio sem testes rebentava a execução.
 *
 * O FUSO NÃO SE FIXA AQUI. Fixa-se no `jest.config.js`, que corre no processo
 * principal antes de os workers nascerem — eles herdam o ambiente. Já se tentou
 * pôr `process.env.TZ` dentro do teste e **não funciona**: o `process.env` que o
 * teste vê é o do sandbox do jest e nunca chega ao Node que decide o fuso.
 * Pedia-se Lisboa e os `getTimezoneOffset()` continuavam todos a zero, com os
 * testes a passar por outra razão qualquer. O `exigirFusoDePortugal` abaixo
 * existe para que esse engano não se repita em silêncio.
 */

import { jest } from '@jest/globals';

/** O fuso em que a suite toda corre. Fixado em `jest.config.js`. */
const FUSO = 'Europe/Lisbon';

/**
 * Rebenta se a suite não estiver a correr em hora de Portugal.
 *
 * Metade dos erros de contagem de dias desta app só existe onde o fuso não é
 * UTC: uma data sem hora (`2026-08-05`) é lida como meia-noite UTC, que em UTC
 * coincide com a meia-noite local e não desalinha nada. Correr estes testes em
 * UTC não os faz falhar — faz o pior: passam sem provar nada.
 */
function exigirFusoDePortugal(): void {
  const atual = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (atual !== FUSO) {
    throw new Error(
      `Este teste precisa do fuso ${FUSO} e está a correr em ${atual}. ` +
        'O fuso é fixado no `jest.config.js` (process.env.TZ), antes dos workers ' +
        'nascerem — não dentro do teste, onde não tem efeito nenhum.',
    );
  }
}

/**
 * Corre `corpo` com o relógio parado num instante em hora de Portugal.
 *
 * @param local `[ano, mês (1-12), dia, hora, minuto]`, em hora local.
 *
 * Fixar o relógio não é preciosismo: as contas de dias desta app davam
 * resultados diferentes conforme a hora a que se perguntava, e um teste com a
 * hora real passa a maior parte do dia sem provar nada. Onde interessa cobrir a
 * janela toda, percorrer as horas com `it.each` — foi o que mostrou que os erros
 * viviam das 0h às 12h e não só à meia-noite.
 */
export function comRelogio(
  local: [ano: number, mes: number, dia: number, hora: number, minuto: number],
  corpo: () => void,
): void {
  exigirFusoDePortugal();
  jest.useFakeTimers();
  try {
    const [ano, mes, dia, hora, minuto] = local;
    jest.setSystemTime(new Date(ano, mes - 1, dia, hora, minuto, 0));
    corpo();
  } finally {
    jest.useRealTimers();
  }
}
