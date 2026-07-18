/**
 * Que avisos agendar no telemóvel, e para quando.
 * ------------------------------------------------------------------
 * Lógica pura, sem nada de nativo: é aqui que se decide o comportamento, e
 * `notificacoesLocais.ts` só a executa contra o sistema. Separado para poder
 * ser testado em Jest sem simular o `expo-notifications` — agendar mal um
 * prazo legal é o tipo de erro que só se descobre semanas depois, quando o
 * aviso não tocou.
 */

import type { Preferencias } from './notificacoes';
import type { Alerta } from './types';

/** Hora a que os avisos tocam. Cedo, mas não de madrugada. */
export const HORA_AVISO = 8;

/**
 * O iOS guarda no máximo 64 notificações pendentes por app e descarta as
 * restantes em silêncio. Com margem, para os avisos mais próximos nunca
 * caírem por causa de um efetivo grande.
 */
export const MAX_AGENDADAS = 50;

/** Não vale agendar avisos para daqui a meio ano: os dados mudam antes disso. */
export const HORIZONTE_DIAS = 60;

/**
 * Data em que o aviso deve tocar: `diasAFrente` dias a partir de agora, às
 * HORA_AVISO. Se essa hora já passou, empurra para o dia seguinte — agendar
 * no passado faria a notificação disparar de imediato, o que para o criador
 * seria a app a apitar sem motivo aparente mal a abre.
 */
export function quandoTocar(diasAFrente: number, agora = new Date()): Date {
  const d = new Date(agora);
  d.setDate(d.getDate() + Math.max(0, diasAFrente));
  d.setHours(HORA_AVISO, 0, 0, 0);
  if (d.getTime() <= agora.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Escolhe o que agendar e quando.
 *
 * Regras:
 *  - só alertas com prazo a correr; os informativos sem data (ex.: "sem
 *    registo de vacinação") não valem um aviso no telemóvel — são exatamente
 *    o ruído que se quer evitar;
 *  - toca no dia em que o alerta entra na janela de antecedência escolhida
 *    pelo criador, ou já amanhã se essa altura passou;
 *  - categorias desligadas não tocam, mesmo que o alerta exista;
 *  - o mais urgente fica em primeiro, para ser o último a ser cortado pelo
 *    limite do sistema.
 */
export function planear(
  alertas: Alerta[],
  p: Preferencias,
  agora = new Date(),
): { alerta: Alerta; quando: Date }[] {
  const horizonte = agora.getTime() + HORIZONTE_DIAS * 86_400_000;
  return alertas
    .filter((a) => p.ativa[a.categoria] && a.diasRestantes !== undefined)
    .map((a) => {
      const entra = (a.diasRestantes as number) - p.antecedenciaDias[a.categoria];
      return { alerta: a, quando: quandoTocar(entra, agora) };
    })
    .filter((x) => x.quando.getTime() <= horizonte)
    .sort((x, y) => x.quando.getTime() - y.quando.getTime())
    .slice(0, MAX_AGENDADAS);
}
