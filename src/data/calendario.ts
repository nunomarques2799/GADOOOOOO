/**
 * Calendário de alertas — lógica pura, sem React.
 * ------------------------------------------------------------------
 * A lista de alertas responde a "o que está em atraso"; o calendário responde
 * a "o que me espera este mês", que é a pergunta com que se organiza uma
 * semana de trabalho. Dois partos no mesmo dia, ou uma revacinação a cair no
 * dia de uma feira, só se veem numa grelha.
 *
 * Tudo o que envolve contas de dias vive aqui para poder ser testado: um erro
 * de um dia num prazo do SNIRA custa uma coima ao criador, e é o tipo de erro
 * que só aparece no fim do mês ou na mudança da hora.
 */

import { diaIso } from './helpers';
import type { Alerta, AlertaGravidade } from './types';

/** Dias da semana, começados à SEGUNDA como em Portugal. */
export const DIAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** Nomes dos dias por extenso, para quem usa leitor de ecrã. */
const DIAS_EXTENSO = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
];

export const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/**
 * Identidade de um dia, em hora LOCAL: "2026-07-24".
 *
 * Local e não UTC de propósito. As datas ficam guardadas em ISO, e um parto
 * previsto para as 23:00 de dia 3 em Lisboa é, em UTC, dia 3 às 22:00 no
 * inverno mas dia 4 no verão. Agrupar por UTC punha o mesmo parto num dia
 * diferente conforme o mês do ano.
 *
 * A conta vive em `helpers.diaIso` — é a mesma que decide o dia com que uma
 * despesa é gravada no servidor, e duas versões dela acabariam a divergir.
 */
export function chaveDia(d: Date | string): string {
  return diaIso(d);
}

/** Alertas com dia marcado, agrupados pelo dia a que pertencem. */
export function agruparPorDia(alertas: Alerta[]): Map<string, Alerta[]> {
  const m = new Map<string, Alerta[]>();
  for (const a of alertas) {
    if (!a.data) continue;
    const k = chaveDia(a.data);
    const lista = m.get(k);
    if (lista) lista.push(a);
    else m.set(k, [a]);
  }
  return m;
}

const ORDEM: Record<AlertaGravidade, number> = { urgente: 0, aviso: 1, info: 2 };

/** A gravidade que manda no dia — é a cor com que o dia se marca. */
export function piorGravidade(alertas: Alerta[]): AlertaGravidade | undefined {
  let pior: AlertaGravidade | undefined;
  for (const a of alertas) {
    if (!pior || ORDEM[a.gravidade] < ORDEM[pior]) pior = a.gravidade;
  }
  return pior;
}

export type Celula = {
  data: Date;
  chave: string;
  /** Do mês que se está a ver, ou das pontas do mês anterior/seguinte? */
  doMes: boolean;
  /** Rótulo para leitores de ecrã: "sexta-feira, 3 de julho". */
  descricao: string;
};

/**
 * As células da grelha de um mês, sempre semanas inteiras de segunda a
 * domingo. Inclui os dias das pontas — o fim de junho na primeira linha de
 * julho — porque uma grelha com buracos nos cantos custa a ler, e um parto no
 * dia 30 do mês passado continua a interessar a quem abre o mês novo.
 */
export function celulasDoMes(ano: number, mes: number): Celula[] {
  const primeiro = new Date(ano, mes, 1);
  // getDay() dá 0 ao domingo; aqui a semana começa à segunda.
  const recuo = (primeiro.getDay() + 6) % 7;

  const inicio = new Date(ano, mes, 1 - recuo);
  const celulas: Celula[] = [];

  // Seis semanas cobrem qualquer mês (um fevereiro que comece ao domingo
  // ocupa cinco; um mês de 31 dias que comece ao domingo ocupa seis).
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    celulas.push({
      data: d,
      chave: chaveDia(d),
      doMes: d.getMonth() === mes,
      descricao: `${DIAS_EXTENSO[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${MESES[d.getMonth()]}`,
    });
  }

  // A última semana só entra se tiver algum dia do próprio mês: sem isto,
  // metade dos meses ganhava uma linha inteira de cinzento no fundo.
  const ultimas = celulas.slice(35);
  return ultimas.some((c) => c.doMes) ? celulas : celulas.slice(0, 35);
}

/** Mês anterior/seguinte, sem estourar o ano. */
export function mesVizinho(ano: number, mes: number, passo: number): { ano: number; mes: number } {
  const d = new Date(ano, mes + passo, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() };
}

/** "julho de 2026" — o título de quem está a ver o mês. */
export function rotuloMes(ano: number, mes: number): string {
  return `${MESES[mes]} de ${ano}`;
}
