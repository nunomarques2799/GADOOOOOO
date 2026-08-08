/**
 * A corrida a OESTE de Greenwich. `npm run test:fuso-oeste`.
 * ---------------------------------------------------------
 * Só os ficheiros `*.oeste.test.ts`, e só eles: a suite normal corre fixada em
 * hora de Portugal e não pode sair de lá — o `comRelogio` rebenta de propósito
 * se sair, porque metade dos testes de datas é sobre o fuso português.
 *
 * Estes são o contrário: provam que uma função NÃO depende do fuso. Em Portugal
 * (UTC+0/+1) essas funções acertavam sempre, mesmo erradas, porque a meia-noite
 * UTC cai sempre no mesmo dia local. O erro só se vê a oeste, e sem esta corrida
 * não havia forma nenhuma de o mostrar — só de argumentar que existia.
 *
 * O `TZ_TESTE` é posto ANTES do `require` de propósito: é o `jest.config.js` que
 * lê essa variável e fixa o `process.env.TZ` para os workers.
 */
process.env.TZ_TESTE = 'America/New_York';

const base = require('./jest.config');

module.exports = {
  ...base,
  testMatch: ['**/*.oeste.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
};
