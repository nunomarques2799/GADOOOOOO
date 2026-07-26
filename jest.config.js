/**
 * Testes unitários da lógica de domínio (prazos legais DGAV/SNIRA, parsing de
 * datas). Preset jest-expo para resolver os transforms de React Native e o
 * alias `@/` igual ao tsconfig.
 */
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
  testPathIgnorePatterns: ['/node_modules/', '/\\.claude/'],
  modulePathIgnorePatterns: ['/\\.claude/'],
};
