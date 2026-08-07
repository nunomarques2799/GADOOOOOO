/**
 * Substituto do `expo-image` nos testes.
 * ------------------------------------------------------------------
 * O `expo-image` passou a correr código de inicialização ao ser importado
 * (`observe.ts`, a registar integrações). Sob o transform do Jest a referência
 * que esse módulo faz a si próprio sai `undefined`, e a importação rebenta com
 * `observe.getIntegrations is not a function` — a suite nem chega a arrancar.
 * Apareceu a 2026-08-07, ao subir de 57.0.0 para 57.0.2 (a subida que corrigiu
 * o arranque no iOS; ver CONSTRUIR_iOS.md).
 *
 * Não se mocka por teste porque `expo-image` está em oito ecrãs e componentes:
 * qualquer teste que renderize um deles bate no mesmo sítio. O Jest aplica
 * sozinho os mocks de `__mocks__/` a pacotes do node_modules, sem `jest.mock()`.
 *
 * O que os testes verificam é texto e navegação, nunca pixels — por isso basta
 * um componente que aceite as mesmas props e não toque em nada nativo.
 */

const { Image } = require('react-native');

module.exports = {
  Image,
  ImageBackground: Image,
};
