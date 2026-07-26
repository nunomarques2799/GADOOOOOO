/**
 * Notificações locais agendadas (versão NATIVA).
 * ------------------------------------------------------------------
 * Um alerta que só existe dentro da app não previne nada: o prazo do brinco
 * (20 dias) e a comunicação ao SNIRA (7 dias) são prazos legais com coima, e
 * o criador não abre a app todos os dias. Aqui agendam-se avisos no próprio
 * telemóvel, que tocam mesmo com a app fechada e sem rede — não são push,
 * não passam por servidor nenhum.
 *
 * Como não há tarefas em segundo plano, o agendamento é recalculado sempre
 * que os dados mudam com a app aberta. O texto de cada aviso é determinístico
 * a partir dos dados, por isso continua correto quando disparar mais tarde.
 *
 * A decisão do que agendar está em `notificacoesPlano.ts` (lógica pura,
 * testável); este ficheiro só a executa contra o sistema. O Metro escolhe
 * `notificacoesLocais.web.ts` na web/Electron, onde isto não se aplica.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Preferencias } from './notificacoes';
import { planear } from './notificacoesPlano';
import type { Alerta } from './types';

export const suportaNotificacoes = true;

const CANAL_ANDROID = 'alertas';

/** Mostra o aviso mesmo com a app aberta — senão passa despercebido. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function garantirCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
    name: 'Prazos e alertas',
    description: 'Avisos de prazos legais e tarefas do efetivo.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/** Já autorizado? Não pede nada ao utilizador. */
export async function temPermissao(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Pede autorização ao sistema (mostra o diálogo). Devolve se ficou concedida.
 * Se o utilizador já recusou antes, o sistema não volta a perguntar e isto
 * devolve false sem incomodar ninguém.
 */
export async function pedirPermissao(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  if (granted) await garantirCanal();
  return granted;
}

/**
 * Uma fila de uma só via, para nunca haver dois reagendamentos em voo.
 * ------------------------------------------------------------------
 * `agendar` cancela tudo e depois agenda até 50 avisos, um a um, com um `await`
 * em cada. Não é instantâneo — e o store reagenda a cada mudança de alertas, o
 * que numa sincronização acontece várias vezes seguidas. Sem esta fila, uma
 * segunda passagem entrava a meio da primeira: o `cancelAll` dela apagava os
 * avisos que a anterior tinha acabado de pôr, e a anterior continuava a agendar
 * por cima do plano novo. O resultado é imprevisível — avisos a dobrar, ou um
 * prazo legal que simplesmente não fica agendado.
 *
 * `sequencia` é a segunda metade da rede: quando várias chamadas esperam na
 * fila, só a ÚLTIMA chega a mexer no sistema. As do meio já estão desatualizadas
 * — reagendar por elas seria trabalho deitado fora, e cada passagem custa 50
 * idas ao sistema operativo.
 */
let sequencia = 0;
let fila: Promise<unknown> = Promise.resolve();

/** Põe `trabalho` na fila. Se entretanto chegar outro pedido, este desiste. */
function enfileirar<T>(trabalho: () => Promise<T>, seDesistir: T): Promise<T> {
  const minha = ++sequencia;
  const resultado = fila.then(() => (minha === sequencia ? trabalho() : seDesistir));
  // A fila não pode ficar rejeitada: um erro numa passagem (permissão retirada
  // a meio, por exemplo) travaria todas as seguintes para sempre.
  fila = resultado.catch(() => undefined);
  return resultado;
}

/**
 * Substitui tudo o que estava agendado pelo plano atual. Cancelar antes de
 * agendar evita avisos duplicados e avisos de situações já resolvidas — se o
 * criador pôs o brinco, o aviso tem de desaparecer do telemóvel também.
 *
 * Devolve quantos ficaram agendados (0 se foi ultrapassada por um plano mais
 * recente antes de chegar a sua vez).
 */
export async function agendar(alertas: Alerta[], p: Preferencias): Promise<number> {
  return enfileirar(async () => {
    if (!(await temPermissao())) return 0;
    await garantirCanal();
    await Notifications.cancelAllScheduledNotificationsAsync();

    const plano = planear(alertas, p);
    for (const { alerta, quando } of plano) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: alerta.titulo,
          body: alerta.descricao,
          data: { alertaId: alerta.id, animalId: alerta.animalId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: quando,
          channelId: CANAL_ANDROID,
        },
      });
    }
    return plano.length;
  }, 0);
}

/**
 * Na mesma fila que o `agendar`, e não à parte: desligar os avisos enquanto um
 * reagendamento estava a correr deixava lá o que ele agendasse a seguir.
 */
export async function cancelarTudo(): Promise<void> {
  await enfileirar(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }, undefined);
}
