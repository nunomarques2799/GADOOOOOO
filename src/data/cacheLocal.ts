/**
 * Cache local + fila de sincronização (outbox) para funcionamento offline.
 * ------------------------------------------------------------------
 * Com sessão Supabase, os dados são gravados aqui para poderem ser consultados
 * e editados sem rede — no campo/no mato. As alterações feitas offline entram
 * numa fila e são enviadas ao Supabase quando a ligação volta.
 *
 * Funciona em TODAS as plataformas: no telemóvel por cima do SQLite e na
 * web/Electron por cima do `localStorage` (ver `armazenamento.ts` e
 * `armazenamento.web.ts`). Até 2026-07-18 isto dependia diretamente do
 * `localStorage`, que não existe em React Native — o resultado era que no
 * Android, com sessão iniciada, não havia cache NEM SQLite e cada gravação
 * exigia rede, apesar de a app prometer "funciona sem internet".
 */

import { armazenamentoDisponivel, guardar, ler, remover } from './armazenamento';
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

/** true se há armazenamento local persistente. */
export const cacheDisponivel = armazenamentoDisponivel;

/** Lê o último instantâneo guardado, ou null se ainda não houver. */
export function lerCache(): DadosGado | null {
  const bruto = ler(CHAVE_CACHE);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as DadosGado;
  } catch {
    return null;
  }
}

/** Grava o instantâneo completo (chamado sempre que os dados mudam). */
export function guardarCache(dados: DadosGado): void {
  guardar(CHAVE_CACHE, JSON.stringify(dados));
}

/** Fila de operações à espera de envio ao Supabase (por ordem). */
export function lerOutbox(): OpPendente[] {
  const bruto = ler(CHAVE_OUTBOX);
  if (!bruto) return [];
  try {
    const ops = JSON.parse(bruto) as OpPendente[];
    // Um valor corrompido não pode passar por fila: o store itera sobre isto.
    return Array.isArray(ops) ? ops : [];
  } catch {
    return [];
  }
}

export function guardarOutbox(ops: OpPendente[]): void {
  guardar(CHAVE_OUTBOX, JSON.stringify(ops));
}

/** Acrescenta uma operação ao fim da fila e devolve o novo total pendente. */
export function adicionarOutbox(op: OpPendente): number {
  const ops = [...lerOutbox(), op];
  guardarOutbox(ops);
  return ops.length;
}

/**
 * Apaga os dados locais da conta. Chamado ao terminar sessão: sem isto, o
 * criador seguinte a entrar no mesmo dispositivo veria, durante o arranque, o
 * efetivo do anterior (a cache é lida antes de o servidor responder).
 */
export function limparCache(): void {
  remover(CHAVE_CACHE);
  remover(CHAVE_OUTBOX);
}

/**
 * Heurística para distinguir falha de rede (offline → tentar mais tarde) de
 * um erro lógico do servidor (validação/RLS → não vale a pena repetir). Não
 * é infalível, mas os erros de rede do supabase-js trazem sempre "fetch"/
 * "network" na mensagem, e no offline o navigator.onLine costuma ser false.
 *
 * Em caso de dúvida é preferível classificar como rede: uma operação que fica
 * na fila é reenviada mais tarde, enquanto uma descartada perde o registo do
 * criador para sempre.
 */
export function pareceErroDeRede(msg: string): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = msg.toLowerCase();
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to') ||
    m.includes('timeout') ||
    // "timed out" (com espaço) é a forma que o React Native devolve — só
    // "timeout" deixava passar um timeout genuíno para o ramo de erro lógico,
    // que DESCARTA a operação. Apanhado por teste, não em produção.
    m.includes('timed out') ||
    m.includes('connection') ||
    m.includes('unreachable') ||
    m.includes('econnreset') ||
    m.includes('conexão') ||
    m.includes('ligação') ||
    // React Native devolve estes quando o pedido morre sem resposta.
    m.includes('aborted') ||
    m.includes('sem ligação')
  );
}
