/**
 * O token deste aparelho, para as mensagens tocarem com a app fechada.
 * ------------------------------------------------------------------
 * É a PRIMEIRA notificação desta app que não é local. Todas as outras
 * (`notificacoesLocais.ts`) são avisos agendados no próprio telemóvel a partir
 * de dados que ele já tem: o prazo do brinco sabe-se com uma semana de
 * antecedência. Uma mensagem não se sabe, e por isso alguém tem de a empurrar
 * até cá — quem o faz é o gatilho de `supabase/schema_chat_push.sql`.
 *
 * AQUI SÓ SE TRATA DO TOKEN: pedi-lo ao sistema, guardá-lo no servidor e
 * esquecê-lo ao sair. Quem decide o texto do aviso é a base de dados (que sabe
 * quem são os destinatários e em que língua está cada aparelho).
 *
 * DUAS COISAS QUE ISTO NÃO RESOLVE SOZINHO, e sem as quais o token nem é
 * emitido:
 *   - a chave APNs tem de estar no EAS (`eas credentials -p ios`), e as
 *     credenciais FCM para o Android;
 *   - depois disso, é preciso um BUILD NATIVO NOVO. Não chega publicar.
 *
 * Na web e no Electron não há push nenhum: o `.web.ts` responde que não é
 * suportado, e as Definições das conversas dizem-no por palavras.
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase, supabaseConfigurado } from './supabase';
import { idiomaAtual } from '@/i18n/idioma';

export const suportaPush = true;

/** O canal Android das mensagens, à parte dos prazos do efetivo. */
const CANAL = 'mensagens';

/**
 * O que já foi registado neste arranque, para não repetir o pedido a cada
 * montagem de um ecrã. O token de um aparelho não muda de um minuto para o
 * outro.
 */
let tokenAtual: string | null = null;

async function garantirCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Mensagens',
    description: 'Mensagens novas nas conversas da exploração.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * Pede o token à Expo e grava-o no servidor. Devolve `false` quando não dá:
 * sem autorização, sem chave de push configurada, ou num simulador.
 *
 * O `projectId` vai EXPLÍCITO. Sem ele, um build feito fora do EAS não sabe a
 * que projeto pertence e o pedido falha com uma mensagem que não ajuda
 * ninguém.
 */
export async function registarPush(): Promise<boolean> {
  if (!supabaseConfigurado || !supabase) return false;

  const atual = await Notifications.getPermissionsAsync();
  let concedida = atual.granted;
  if (!concedida) {
    if (!atual.canAskAgain) return false;
    concedida = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!concedida) return false;

  await garantirCanal();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return false;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return false;
    tokenAtual = token;
    const { error } = await supabase.rpc('registar_push_token', {
      p_token: token,
      p_plataforma: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      p_idioma: idiomaAtual(),
    });
    return !error;
  } catch {
    // Num simulador, ou sem a chave APNs configurada no EAS, isto rebenta. Não
    // é motivo para estragar o arranque da app: fica sem push e mais nada.
    return false;
  }
}

/** Tira este aparelho da lista. Ao sair da conta, e ao desligar os avisos. */
export async function esquecerPush(): Promise<void> {
  if (!tokenAtual || !supabaseConfigurado || !supabase) return;
  try {
    await supabase.rpc('esquecer_push_token', { p_token: tokenAtual });
  } catch {
    /* sem rede: o token fica lá até alguém o limpar (`limpar_push_tokens`) */
  }
  tokenAtual = null;
}

/**
 * O toque numa notificação de mensagem, se o último toque foi num aviso destes.
 *
 * Devolve o id da conversa a abrir. O `AberturaPorAviso` já trata dos avisos
 * de prazo; esta é a mesma ideia para as conversas.
 */
export function conversaDoToque(resposta: Notifications.NotificationResponse | null): string | null {
  if (!resposta) return null;
  const dados = (resposta.notification.request.content.data ?? {}) as { conversaId?: unknown };
  return typeof dados.conversaId === 'string' && dados.conversaId ? dados.conversaId : null;
}
