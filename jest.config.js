/**
 * Testes unitários da lógica de domínio (prazos legais DGAV/SNIRA, parsing de
 * datas). Preset jest-expo para resolver os transforms de React Native e o
 * alias `@/` igual ao tsconfig.
 */

/**
 * A suite corre SEMPRE em hora de Portugal, e tem de ser fixado aqui.
 *
 * Metade dos erros de contagem de dias desta app só existe onde o fuso não é
 * UTC: uma data sem hora (`2026-08-05`) é lida como meia-noite UTC, que em UTC
 * coincide com a meia-noite local e não desalinha nada. A CI corre em UTC — sem
 * isto, esses testes ficavam verdes lá sem provar nada, que é exatamente a
 * armadilha que existem para fechar. E ao contrário, a máquina de quem
 * desenvolve corre em Lisboa: sem fixar, os mesmos testes davam resultados
 * diferentes na CI e cá.
 *
 * Tem de ser NESTE ficheiro e não dentro de um teste. O `jest.config.js` é
 * avaliado no processo principal, antes de os workers nascerem, e eles herdam o
 * ambiente. Um `process.env.TZ = ...` dentro de um teste não faz nada: o
 * `process.env` que o teste vê é o do sandbox e nunca chega ao Node que decide o
 * fuso — pedia-se Lisboa e os `getTimezoneOffset()` continuavam todos a zero.
 *
 * O `TZ_TESTE` é a única porta para outro fuso, e existe para um punhado de
 * testes que provam o CONTRÁRIO: que uma função não depende do fuso nenhum.
 * Esses vivem em ficheiros `*.oeste.test.ts`, correm por `jest.config.oeste.js`
 * e ficam de fora desta corrida — a suite normal não pode sair de Portugal,
 * porque o `comRelogio` rebenta de propósito se sair.
 */
process.env.TZ = process.env.TZ_TESTE ?? 'Europe/Lisbon';

module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  /**
   * `.claude/worktrees/` são cópias do repositório em commits antigos, criadas
   * por sessões de agentes. O jest percorria-as e corria os testes de LÁ além
   * dos daqui: 614 execuções onde só ~205 são deste código. Um teste que já foi
   * corrigido continuava a falhar pela cópia velha, e o número de testes não
   * dizia nada sobre a cobertura real. O `tsc` nunca as apanhou (ignora pastas
   * que começam por ponto), o que tornava a diferença ainda mais confusa.
   *
   * `modulePathIgnorePatterns` é o que impede também a colisão de módulos com
   * o mesmo nome entre as cópias.
   */
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/', '\\.oeste\\.test\\.ts$'],
  modulePathIgnorePatterns: ['/\\.claude/'],
};
