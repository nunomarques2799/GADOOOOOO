/**
 * Gravar uma mensagem de voz.
 * ------------------------------------------------------------------
 * Um recado dito é mais rápido do que um recado escrito, e quem tem as mãos
 * sujas do curral não escreve nada. É a razão de isto existir.
 *
 * O MICROFONE ESTAVA FECHADO DE PROPÓSITO até esta funcionalidade. O
 * `app.json` declarava `microphonePermission: false` no `expo-audio` e no
 * `expo-image-picker` para a revisão da Apple não ter o que perguntar (ver
 * `CONSTRUIR_iOS.md`). Ao abri-lo, duas coisas passaram a ser verdade:
 *   - a app instalada **só grava depois de um build nativo novo**, porque a
 *     permissão vive no binário e não no JavaScript;
 *   - o questionário de privacidade da App Store tem de passar a declarar
 *     áudio como conteúdo do utilizador.
 *
 * O `expo-audio` tem implementação para web, por isso isto funciona também no
 * navegador e no Electron (com `MediaRecorder`, que grava `webm`). Não há
 * `.web.ts` nenhum: o mesmo código serve os dois.
 */

import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { MAX_SEGUNDOS_AUDIO } from './chat';

/**
 * Como se grava. NÃO é o `RecordingPresets.LOW_QUALITY`: aquele grava `.3gp`
 * com AMR no Android, e `audio/3gpp` não é dos tipos que o bucket aceita (nem
 * é dos que o iPhone lê bem). Aqui é AAC em `.m4a` nas duas plataformas, e
 * `webm` no navegador — os três estão na lista do `schema_chat_anexos.sql`.
 *
 * 22 kHz, mono e 32 kbps: é voz, não é música. Um minuto fica em ~240 KB, o
 * que num plano com 1 GB de Storage é a diferença entre caber e não caber.
 */
const OPCOES: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 22050,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { extension: '.m4a', outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: {
    audioQuality: AudioQuality.LOW,
    outputFormat: IOSOutputFormat.MPEG4AAC,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: { mimeType: 'audio/webm', bitsPerSecond: 32000 },
};

/** Abaixo disto não há recado nenhum: foi um toque sem querer. */
const MIN_SEGUNDOS = 1;

export type AudioGravado = {
  bytes: ArrayBuffer;
  mime: string;
  extensao: string;
  tamanho: number;
  segundos: number;
};

export type Gravador = {
  aGravar: boolean;
  /** Segundos decorridos, para o contador no ecrã. */
  segundos: number;
  /** Começa. `false` se o microfone não foi autorizado. */
  comecar: () => Promise<boolean>;
  /** Para e devolve o ficheiro, ou `null` se foi curto de mais. */
  parar: () => Promise<AudioGravado | null>;
  /** Para e deita fora. */
  descartar: () => Promise<void>;
};

export function useGravador(): Gravador {
  const gravador = useAudioRecorder(OPCOES);
  const [aGravar, setAGravar] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararRelogio = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
  }, []);

  // Um contador deixado a correr depois de o ecrã fechar mantém o componente
  // vivo e continua a mexer em estado que já ninguém desenha.
  useEffect(() => pararRelogio, [pararRelogio]);

  const comecar = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;

    // No iOS, sem isto o microfone não abre: a sessão de áudio está em modo de
    // reprodução (é o que o `som.ts` usa para o sinal de gravação).
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

    await gravador.prepareToRecordAsync();
    gravador.record();
    setSegundos(0);
    setAGravar(true);
    relogio.current = setInterval(() => {
      setSegundos((s) => {
        // O teto não é decoração: um dedo esquecido no botão sobe um ficheiro
        // de vários MB para o bucket de toda a gente.
        if (s + 1 >= MAX_SEGUNDOS_AUDIO) pararRelogio();
        return s + 1;
      });
    }, 1000);
    return true;
  }, [gravador, pararRelogio]);

  const recolher = useCallback(async (): Promise<{ uri: string; duracao: number } | null> => {
    pararRelogio();
    setAGravar(false);
    const duracao = gravador.currentTime || segundos;
    try {
      await gravador.stop();
    } catch {
      return null;
    }
    const uri = gravador.uri;
    if (!uri) return null;
    return { uri, duracao };
  }, [gravador, pararRelogio, segundos]);

  const parar = useCallback(async (): Promise<AudioGravado | null> => {
    const r = await recolher();
    if (!r) return null;
    if (r.duracao < MIN_SEGUNDOS) return null;

    // `fetch` sobre o `file://` (ou o `blob:` do navegador) é a via para chegar
    // aos bytes sem outro módulo nativo. É o mesmo que o `ficheiroDocumento.ts`
    // faz com a fotografia.
    const resposta = await fetch(r.uri);
    const bytes = await resposta.arrayBuffer();
    if (bytes.byteLength === 0) return null;

    const naWeb = Platform.OS === 'web';
    return {
      bytes,
      mime: naWeb ? 'audio/webm' : 'audio/m4a',
      extensao: naWeb ? 'webm' : 'm4a',
      tamanho: bytes.byteLength,
      segundos: Math.max(1, Math.round(r.duracao)),
    };
  }, [recolher]);

  const descartar = useCallback(async () => {
    await recolher();
  }, [recolher]);

  return { aGravar, segundos, comecar, parar, descartar };
}
