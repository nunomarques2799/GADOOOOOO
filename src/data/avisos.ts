/**
 * Avisos e confirmações que funcionam nas duas plataformas.
 * ------------------------------------------------------------------
 * O `Alert` do React Native não está implementado no React Native Web: na app
 * de computador e no browser, um `Alert.alert` não mostra absolutamente nada —
 * o utilizador clica e parece que a app ignorou. Aqui a web usa os diálogos do
 * próprio browser e o nativo usa o Alert, com a mesma chamada dos dois lados.
 */

import { Alert, Platform } from 'react-native';

const naWeb = Platform.OS === 'web';
const temJanela = () => typeof window !== 'undefined';

/** Mensagem informativa com um só botão. */
export function avisar(titulo: string, mensagem: string): void {
  if (naWeb) {
    if (temJanela()) window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

/**
 * Pergunta sim/não. Chama `aoConfirmar` apenas se o utilizador aceitar.
 * `destrutivo` marca a ação a vermelho no iOS/Android.
 */
export function confirmar(
  titulo: string,
  mensagem: string,
  aoConfirmar: () => void,
  { rotuloConfirmar = 'Confirmar', destrutivo = false } = {},
): void {
  if (naWeb) {
    if (temJanela() && window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: rotuloConfirmar,
      style: destrutivo ? 'destructive' : 'default',
      onPress: aoConfirmar,
    },
  ]);
}
