/**
 * Substituto do `expo-audio` nos testes.
 * ------------------------------------------------------------------
 * O `expo-audio` estende uma classe nativa ao ser importado
 * (`ExpoAudio.ts`, `class AudioPlayer extends NativeAudioModule…`). Sob o
 * transform do Jest o módulo nativo sai `undefined` e a importação rebenta com
 * `Cannot read properties of undefined (reading 'prototype')` — o ficheiro de
 * teste nem chega a correr. É o mesmo problema do `__mocks__/expo-image.js`,
 * pela mesma razão: um pacote que faz trabalho a sério à importação.
 *
 * Não se mocka por teste porque o áudio está no balão das conversas e no ecrã
 * de denúncias do painel de superadmin: qualquer teste que renderize um deles
 * bate aqui. O Jest aplica sozinho os mocks de `__mocks__/` a pacotes do
 * node_modules, sem `jest.mock()`.
 *
 * O leitor está sempre PARADO no princípio, que é o estado em que um áudio
 * aparece no ecrã. Os testes verificam texto e o que acontece ao tocar nos
 * botões, nunca som.
 */

const { useRef } = require('react');

/**
 * O leitor é o MESMO objeto entre renders, como o de verdade. Um objeto novo a
 * cada render fazia o `useAudioPlayerStatus` parecer mudar de leitor sem nada
 * ter acontecido, e um efeito que dependesse dele corria em ciclo.
 */
function useAudioPlayer() {
  const leitor = useRef(null);
  if (leitor.current === null) {
    leitor.current = {
      play: () => {},
      pause: () => {},
      seekTo: () => {},
      remove: () => {},
    };
  }
  return leitor.current;
}

function useAudioPlayerStatus() {
  const estado = useRef(null);
  if (estado.current === null) {
    estado.current = {
      playing: false,
      currentTime: 0,
      duration: 0,
      didJustFinish: false,
      isLoaded: true,
    };
  }
  return estado.current;
}

module.exports = {
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder: () => ({
    record: () => {},
    stop: async () => {},
    prepareToRecordAsync: async () => {},
    uri: null,
  }),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
  setAudioModeAsync: async () => {},
  requestRecordingPermissionsAsync: async () => ({ granted: true }),
  getRecordingPermissionsAsync: async () => ({ granted: true }),
  RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: {} },
  AudioModule: {},
};
