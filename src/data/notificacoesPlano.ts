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
 * Para onde vai a app quando se toca num aviso do telemóvel.
 *
 * A ficha do animal quando ele existe — é lá que está o alerta, o histórico e o
 * botão de registar o que o aviso está a pedir. A lista de alertas nos outros
 * casos: prazos que não são de um animal, e animais que já não existem (vendido
 * e eliminado noutro aparelho, ou um aviso que ficou agendado de outra conta).
 * Mandar para uma ficha inexistente dava um "Animal não encontrado" a quem só
 * queria saber o que tinha de fazer hoje.
 */
export function destinoDoAviso(
  aviso: { animalId?: string },
  existeAnimal: (id: string) => boolean,
): string {
  if (aviso.animalId && existeAnimal(aviso.animalId)) return `/animal/${aviso.animalId}`;
  return '/alertas';
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

/* ==================================================================
 * O acesso a acabar
 * ================================================================== */

/**
 * Quantos minutos antes do fim do acesso é que o telemóvel avisa.
 *
 * Três avisos e não um: o de 30 minutos é o que ainda dá para acabar o que se
 * está a fazer, o de 5 é o que faz guardar. Um só, a qualquer distância, ou
 * chega cedo de mais para servir de aviso ou tarde de mais para servir de nada.
 */
export const MINUTOS_AVISO_ACESSO = [30, 15, 5] as const;

/** Um vínculo com prazo, como o plano precisa de o ver. */
export type AcessoComPrazo = {
  /** Identifica o vínculo, para o aviso saber de qual fala. */
  membroId: string;
  nomeExploracao: string;
  /** ISO. Sem isto não há nada a avisar. */
  expiraEm?: string;
};

export type AvisoAcesso = {
  membroId: string;
  titulo: string;
  corpo: string;
  quando: Date;
  /** Minutos que faltavam quando este aviso foi marcado. */
  minutosAntes: number;
};

/**
 * Os avisos de "o seu acesso está a acabar", para o telemóvel de quem o tem.
 *
 * É o outro lado do prazo do veterinário: ele entra por uma manhã e sai
 * sozinho, e até aqui saía sem aviso nenhum — a app ficava vazia a meio de uma
 * visita, com o trabalho por registar e sem nada que explicasse porquê.
 *
 * LIMITE HONESTO: isto são notificações LOCAIS, agendadas no aparelho enquanto
 * a app está aberta. Não há servidor a empurrar nada. Se o veterinário nunca
 * abrir a app dentro dos 30 minutos que antecedem o fim, não há aviso — não
 * havia onde o agendar. Para avisos que cheguem com a app fechada há semanas
 * era preciso push a sério, que é outra história (e outro servidor).
 *
 * Só conta o que ainda está para vir: um instante já passado agendaria uma
 * notificação no passado, que o sistema dispara de imediato — a app a apitar
 * três vezes seguidas mal se abre, a dizer que falta meia hora para uma coisa
 * que já aconteceu.
 */
export function planearFimDeAcesso(
  acessos: AcessoComPrazo[],
  agora = new Date(),
): AvisoAcesso[] {
  const avisos: AvisoAcesso[] = [];

  for (const a of acessos) {
    if (!a.expiraEm) continue;
    const fim = new Date(a.expiraEm).getTime();
    // Uma data que não se lê não gera aviso nenhum: é o mesmo lado seguro do
    // `acessoTerminou`, que perante lixo deixa passar em vez de trancar.
    if (Number.isNaN(fim) || fim <= agora.getTime()) continue;

    for (const minutos of MINUTOS_AVISO_ACESSO) {
      const quando = new Date(fim - minutos * 60_000);
      if (quando.getTime() <= agora.getTime()) continue;
      avisos.push({
        membroId: a.membroId,
        titulo: `Acesso a ${a.nomeExploracao} termina em ${minutos} minutos`,
        // Diz o que fazer, e não só o que se passa. Quem lê isto está no campo
        // com o telemóvel numa mão.
        corpo:
          minutos <= 5
            ? 'Grave já o que tiver por registar. Passado o prazo deixa de conseguir escrever.'
            : 'Depois disso deixa de ver esta exploração. Peça mais tempo a quem o convidou se precisar.',
        quando,
        minutosAntes: minutos,
      });
    }
  }

  // Os mais próximos primeiro: são os que têm de sobreviver ao teto do sistema.
  return avisos.sort((x, y) => x.quando.getTime() - y.quando.getTime());
}
