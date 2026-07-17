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
};
