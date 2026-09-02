/**
 * Que avisos agendar no telemóvel, e para quando.
 * ------------------------------------------------------------------
 * Lógica pura, sem nada de nativo: é aqui que se decide o comportamento, e
 * `notificacoesLocais.ts` só a executa contra o sistema. Separado para poder
 * ser testado em Jest sem simular o `expo-notifications` — agendar mal um
 * prazo legal é o tipo de erro que só se descobre semanas depois, quando o
 * aviso não tocou.
 */

import { t } from '@/i18n';

import type { Preferencias } from './notificacoes';
import type { Alerta } from './types';

/** Hora a que os avisos tocam. Cedo, mas não de madrugada. */
export const HORA_AVISO = 8;

/**
 * O iOS guarda no máximo 64 notificações pendentes por app e descarta as
 * restantes em silêncio. Este é o número do sistema, não uma escolha nossa.
 */
export const TETO_IOS = 64;

/**
 * Quantos avisos de prazo se agendam, no máximo. Fica abaixo do `TETO_IOS` para
 * sobrar espaço aos avisos de acesso e para um efetivo grande nunca empurrar os
 * avisos mais próximos para fora do teto do sistema.
 *
 * Desde que os avisos são um por DIA (ver `planear`), 50 são 50 dias e não 50
 * alertas: com o horizonte de 60 dias, é quase tudo o que há para agendar.
 */
export const MAX_AGENDADAS = 50;

/**
 * Quantos nomes cabem no corpo de um aviso de dia antes do "e mais N".
 *
 * Três: é o que se lê de relance no ecrã bloqueado sem o sistema cortar a
 * meio, e é o que responde à pergunta que a pessoa faz ao pegar no telemóvel
 * ("o que é que eu tenho para hoje?"). A lista completa está na app.
 */
export const NOMES_NO_CORPO = 3;

/**
 * Quantos avisos de prazo cabem, descontando os do fim de acesso.
 *
 * Os 50 do `MAX_AGENDADAS` deixavam 14 de margem por baixo do teto do iOS, e
 * isso chegava enquanto os avisos de acesso fossem poucos. Só que são TRÊS por
 * vínculo com prazo a correr (ver `MINUTOS_AVISO_ACESSO`): a partir de cinco
 * vínculos — um veterinário com cinco visitas marcadas no mesmo dia — o total
 * passa dos 64 e o iOS deita fora o excedente sem dizer nada.
 *
 * Quem cede o lugar são os prazos, e de propósito: estão a dias ou semanas de
 * distância e voltam a ser agendados na próxima vez que a app abrir, enquanto
 * o aviso de acesso está a minutos e não tem segunda oportunidade.
 */
export function orcamentoParaAlertas(avisosDeAcesso: number): number {
  return Math.max(0, Math.min(MAX_AGENDADAS, TETO_IOS - avisosDeAcesso));
}

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
 *
 * A CONVERSA vem primeiro, e sozinha: um aviso de mensagem chega por push (do
 * gatilho de `supabase/schema_chat_push.sql`) e nunca traz animal nenhum, mas
 * a app tem uma só porta para os toques em avisos — e sem esta linha o toque
 * numa mensagem abria a lista de alertas, que não tem nada a ver.
 */
export function destinoDoAviso(
  aviso: { animalId?: string; conversaId?: string },
  existeAnimal: (id: string) => boolean,
): string {
  if (aviso.conversaId) return `/chat/${aviso.conversaId}`;
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
 *  - **um aviso por DIA**, com o que esse dia traz lá dentro;
 *  - o dia mais próximo fica em primeiro, para ser o último a ser cortado pelo
 *    limite do sistema.
 *
 * UM POR DIA, E NÃO UM POR ALERTA (2026-09-02). Cada aviso tocava à sua hora, e
 * a hora era sempre a mesma: as 8 da manhã. Numa exploração com trinta animais,
 * todos os prazos que já tinham entrado na janela caíam no mesmo instante e o
 * telemóvel dava dezenas de apitos seguidos — o criador acordava com o ecrã
 * cheio de avisos e não tinha por onde começar a lê-los. Um aviso que se
 * dispensa em bloco não avisa de nada, e o passo seguinte de quem o recebe é
 * desligar as notificações.
 *
 * Agora as 8 da manhã trazem UMA linha: "3 avisos para hoje", com os nomes lá
 * dentro. O que a pessoa quer saber ao pegar no telemóvel é quantas coisas tem
 * para fazer, e a lista completa está a um toque de distância.
 */
export type AvisoDoDia = {
  /** O instante em que toca: `HORA_AVISO` do dia em que estes alertas entram. */
  quando: Date;
  /** O que esse dia traz, do mais urgente para o menos. */
  alertas: Alerta[];
};

export function planear(
  alertas: Alerta[],
  p: Preferencias,
  agora = new Date(),
  /** Quantos DIAS cabem — ver `orcamentoParaAlertas`. Por omissão, o máximo. */
  orcamento = MAX_AGENDADAS,
): AvisoDoDia[] {
  const horizonte = agora.getTime() + HORIZONTE_DIAS * 86_400_000;

  const porDia = new Map<number, Alerta[]>();
  for (const a of alertas) {
    if (!p.ativa[a.categoria] || a.diasRestantes === undefined) continue;
    const entra = a.diasRestantes - p.antecedenciaDias[a.categoria];
    const quando = quandoTocar(entra, agora);
    if (quando.getTime() > horizonte) continue;
    const chave = quando.getTime();
    const lista = porDia.get(chave);
    if (lista) lista.push(a);
    else porDia.set(chave, [a]);
  }

  return [...porDia.entries()]
    .sort(([x], [y]) => x - y)
    .slice(0, Math.min(orcamento, MAX_AGENDADAS))
    .map(([quando, doDia]) => ({
      quando: new Date(quando),
      // Dentro do dia, o que falta menos tempo primeiro: é esse que dá o nome
      // ao aviso quando ele é só um, e é o primeiro da lista quando são vários.
      alertas: [...doDia].sort(
        (a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0),
      ),
    }));
}

/**
 * O que o aviso de um dia diz, e para onde leva.
 *
 * Com um alerta só, é o alerta: o título dele, a descrição dele, e o toque
 * abre a ficha do animal. Não se ganha nada em dizer "1 aviso para hoje" e
 * esconder qual é.
 *
 * Com vários, é a conta e os nomes: "3 avisos para hoje" e as três primeiras
 * linhas. O toque abre a lista de alertas, porque não há uma ficha para onde
 * ir — e é lá que estão os outros.
 */
export function textoDoAviso(dia: AvisoDoDia): {
  titulo: string;
  corpo: string;
  /** Vai no `data` da notificação; é o que decide o destino do toque. */
  alertaId?: string;
  animalId?: string;
} {
  const [primeiro, ...resto] = dia.alertas;
  if (resto.length === 0) {
    return {
      titulo: primeiro.titulo,
      corpo: primeiro.descricao,
      alertaId: primeiro.id,
      animalId: primeiro.animalId,
    };
  }

  const nomes = dia.alertas.slice(0, NOMES_NO_CORPO).map((a) => a.titulo);
  const sobram = dia.alertas.length - nomes.length;
  return {
    titulo: t('avisos.nParaHoje', { n: dia.alertas.length }),
    corpo: sobram > 0 ? t('avisos.eMais', { lista: nomes.join(', '), n: sobram }) : nomes.join(', '),
  };
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
