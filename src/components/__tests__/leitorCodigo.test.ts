import { describe, expect, it } from '@jest/globals';

import { moduloCompleto } from '../LeitorCodigo';

/**
 * A forma do `expo-camera`, e porque é que ela merece um teste.
 * ------------------------------------------------------------------
 * O leitor carrega o módulo com um `require` escondido (ver o cabeçalho do
 * `LeitorCodigo.tsx`), e uma guarda decide se ele está inteiro. Uma guarda
 * ERRADA não rebenta: faz a app dizer "precisa de uma versão nova" a toda a
 * gente, com o módulo lá dentro e a funcionar. Foi exatamente o que aconteceu
 * na primeira versão, que procurava o `requestCameraPermissionsAsync` no topo
 * do módulo quando ele vive em `Camera.*`.
 *
 * Uma falha assim não aparece em lado nenhum: não há erro, não há aviso na
 * consola, e o ecrã explica-se com uma frase que parece razoável. É o pior
 * modo de falhar que há, e é por isso que fica aqui preso.
 */
describe('moduloCompleto — a guarda que decide se há leitor', () => {
  it('aceita o expo-camera tal como ele é hoje', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(moduloCompleto(require('expo-camera'))).toBe(true);
  });

  it('recusa uma app construída antes de o módulo existir', () => {
    expect(moduloCompleto(null)).toBe(false);
    expect(moduloCompleto(undefined)).toBe(false);
    expect(moduloCompleto({})).toBe(false);
  });

  /**
   * O erro que já foi cometido: as funções de autorização à cabeça em vez de
   * dentro do `Camera`. Sem esta linha, voltar a escrevê-lo passa despercebido.
   */
  it('recusa o módulo sem as autorizações dentro do `Camera`', () => {
    expect(
      moduloCompleto({
        CameraView: () => null,
        requestCameraPermissionsAsync: () => Promise.resolve({ granted: true }),
        getCameraPermissionsAsync: () => Promise.resolve({ granted: true }),
      }),
    ).toBe(false);
  });

  it('recusa o módulo sem a vista da câmara', () => {
    expect(
      moduloCompleto({
        Camera: {
          requestCameraPermissionsAsync: () => Promise.resolve({ granted: true }),
          getCameraPermissionsAsync: () => Promise.resolve({ granted: true }),
        },
      }),
    ).toBe(false);
  });
});
