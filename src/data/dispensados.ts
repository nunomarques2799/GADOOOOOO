/**
 * Alertas dispensados pelo criador.
 * ------------------------------------------------------------------
 * Alguns alertas não têm prazo nem fim: "Sem registo de vacinação" aparece
 * para todo o adulto sem histórico e nunca desaparece por si. Num efetivo com
 * 40 animais antigos são 40 linhas permanentes — e uma lista sempre cheia
 * deixa de ser lida, o que faz perder também os avisos urgentes.
 *
 * Por isso guarda-se aqui o que o criador mandou calar, com a gravidade que o
 * alerta tinha nessa altura. Se mais tarde piorar (info → aviso → urgente), a
 * dispensa deixa de valer e o alerta volta: nunca se silencia um prazo legal
 * que entretanto se agravou.
 *
 * Persistido via `armazenamento.ts` (KV síncrono: SQLite no telemóvel,
 * localStorage na web) — nunca `localStorage` direto, que não existe em RN.
 */

import { guardar as guardarKv, ler as lerKv } from './armazenamento';
import type { Alerta, AlertaGravidade } from './types';

/** id do alerta → gravidade que tinha quando foi dispensado. */
export type Dispensas = Record<string, AlertaGravidade>;

const CHAVE = 'gado.alertas-dispensados.v1';

/** Menor = mais grave. Serve para detetar agravamentos. */
const ordem: Record<AlertaGravidade, number> = { urgente: 0, aviso: 1, info: 2 };

const GRAVIDADES: AlertaGravidade[] = ['urgente', 'aviso', 'info'];

/**
 * Um alerta só pode ser dispensado se não tiver um prazo a correr: nada com
 * contagem decrescente (identificação, SNIRA, parto, intervalo de segurança)
 * pode ser silenciado, por muito que incomode. Na prática isto abrange o
 * "Sem registo de vacinação" e futuros avisos informativos do mesmo género.
 */
export function podeDispensar(a: Alerta): boolean {
  return a.gravidade === 'info' && a.diasRestantes === undefined;
}

export function lerDispensas(): Dispensas {
  const bruto = lerKv(CHAVE);
  if (!bruto) return {};
  try {
    const d = JSON.parse(bruto) as unknown;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
    // Só entram pares id→gravidade válidos: um valor corrompido não pode
    // silenciar alertas por engano.
    const limpo: Dispensas = {};
    for (const [id, g] of Object.entries(d as Record<string, unknown>)) {
      if (typeof g === 'string' && (GRAVIDADES as string[]).includes(g)) {
        limpo[id] = g as AlertaGravidade;
      }
    }
    return limpo;
  } catch {
    return {};
  }
}

export function guardarDispensas(d: Dispensas): void {
  guardarKv(CHAVE, JSON.stringify(d));
}

/** Marca um alerta como dispensado e devolve o registo atualizado. */
export function dispensar(d: Dispensas, a: Alerta): Dispensas {
  const novo: Dispensas = { ...d, [a.id]: a.gravidade };
  guardarDispensas(novo);
  return novo;
}

/** Anula a dispensa de um alerta e devolve o registo atualizado. */
export function reporDispensa(d: Dispensas, id: string): Dispensas {
  if (!(id in d)) return d;
  const novo = { ...d };
  delete novo[id];
  guardarDispensas(novo);
  return novo;
}

/** true se este alerta está calado — e continua igual ou menos grave. */
export function estaDispensado(d: Dispensas, a: Alerta): boolean {
  const quando = d[a.id];
  if (quando === undefined) return false;
  return ordem[a.gravidade] >= ordem[quando];
}

/** Tira da lista os alertas dispensados que não se agravaram entretanto. */
export function filtrarDispensados(alertas: Alerta[], d: Dispensas): Alerta[] {
  return alertas.filter((a) => !estaDispensado(d, a));
}

/**
 * Esquece dispensas de alertas que já não existem (animal eliminado, vacinação
 * finalmente registada). Devolve `null` quando não há nada a mudar, para o
 * chamador poder evitar uma escrita inútil no armazenamento.
 */
export function limparObsoletas(d: Dispensas, idsAtuais: Set<string>): Dispensas | null {
  const sobrantes = Object.keys(d).filter((id) => !idsAtuais.has(id));
  if (sobrantes.length === 0) return null;
  const novo = { ...d };
  for (const id of sobrantes) delete novo[id];
  return novo;
}
