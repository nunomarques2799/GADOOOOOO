/**
 * Cache local + fila de sincronização (outbox) para funcionamento offline.
 * ------------------------------------------------------------------
 * Alvo principal: a app de secretária (Electron), que corre o bundle web e
 * tem `localStorage` persistente (guardado na pasta de dados do utilizador).
 * Com sessão Supabase, os dados passam a ser gravados aqui para poderem ser
 * consultados e editados sem rede — no campo/no mato. As alterações feitas
 * offline entram numa fila e são enviadas ao Supabase quando a ligação volta.
 *
 * Em plataformas sem `localStorage` (nativo) estas funções ficam inertes e a
 * app mantém o comportamento anterior (online). O móvel offline continua a
 * usar o SQLite local quando o Supabase não está configurado.
 */

import type { Animal, Evento, Exploracao, Terreno } from './types';

/** Instantâneo dos dados guardados localmente (mesma forma que o Snapshot). */
export type DadosGado = {
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
};

export type Entidade = 'exploracao' | 'terreno' | 'animal' | 'evento';

/** Operação por sincronizar: gravar (upsert) ou eliminar uma entidade. */
export type OpPendente =
  | { op: 'upsert'; entidade: Entidade; dados: Exploracao | Terreno | Animal | Evento }
  | { op: 'delete'; entidade: Entidade; id: string };

const CHAVE_CACHE = 'gado.cache.v1';
const CHAVE_OUTBOX = 'gado.outbox.v1';

// `localStorage` só existe na web/Electron. No nativo fica null → funções inertes.
const ls: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null;

/** true se há armazenamento local persistente (web/Electron). */
export const cacheDisponivel = ls !== null;

/** Lê o último instantâneo guardado, ou null se ainda não houver. */
export function lerCache(): DadosGado | null {
  if (!ls) return null;
  try {
    const bruto = ls.getItem(CHAVE_CACHE);
    return bruto ? (JSON.parse(bruto) as DadosGado) : null;
  } catch {
    return null;
  }
}

/** Grava o instantâneo completo (chamado sempre que os dados mudam). */
export function guardarCache(dados: DadosGado): void {
  if (!ls) return;
  try {
    ls.setItem(CHAVE_CACHE, JSON.stringify(dados));
  } catch {
    /* quota cheia / indisponível — ignora, a app continua a funcionar */
  }
}

/** Fila de operações à espera de envio ao Supabase (por ordem). */
export function lerOutbox(): OpPendente[] {
  if (!ls) return [];
  try {
    const bruto = ls.getItem(CHAVE_OUTBOX);
    return bruto ? (JSON.parse(bruto) as OpPendente[]) : [];
  } catch {
    return [];
  }
}

export function guardarOutbox(ops: OpPendente[]): void {
  if (!ls) return;
  try {
    ls.setItem(CHAVE_OUTBOX, JSON.stringify(ops));
  } catch {
    /* ignora */
  }
}

/** Acrescenta uma operação ao fim da fila e devolve o novo total pendente. */
export function adicionarOutbox(op: OpPendente): number {
  const ops = [...lerOutbox(), op];
  guardarOutbox(ops);
  return ops.length;
}

/**
 * Heurística para distinguir falha de rede (offline → tentar mais tarde) de
 * um erro lógico do servidor (validação/RLS → não vale a pena repetir). Não
 * é infalível, mas os erros de rede do supabase-js trazem sempre "fetch"/
 * "network" na mensagem, e no offline o navigator.onLine costuma ser false.
 */
export function pareceErroDeRede(msg: string): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = msg.toLowerCase();
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to') ||
    m.includes('timeout') ||
    m.includes('connection') ||
    m.includes('conexão') ||
    m.includes('ligação')
  );
}
