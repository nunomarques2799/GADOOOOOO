/**
 * Push na web e no Electron: não há.
 * ------------------------------------------------------------------
 * O `expo-notifications` não emite tokens no navegador, e o push da web seria
 * outra coisa por inteiro (service worker + VAPID + a chave do lado do
 * servidor). Não vale a pena: a app de computador está aberta enquanto se
 * trabalha, e com ela aberta o aviso curto do `AnfitriaoMensagens` já aparece.
 *
 * Mesmo contrato da versão nativa, para os ecrãs não precisarem de saber onde
 * estão. O `suportaPush` é o que faz as Definições explicarem-se em vez de
 * mostrarem um interruptor que não faz nada.
 */

export const suportaPush = false;

export async function registarPush(): Promise<boolean> {
  return false;
}

export async function esquecerPush(): Promise<void> {
  /* nada a esquecer */
}

export function conversaDoToque(_resposta: unknown): string | null {
  return null;
}
