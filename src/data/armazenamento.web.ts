/**
 * Armazenamento chave-valor síncrono e persistente (versão WEB/Electron).
 * ------------------------------------------------------------------
 * Na web o `localStorage` já é síncrono e persistente — na app de secretária
 * fica guardado na pasta de dados do utilizador (AppData/Roaming). Ver a
 * versão nativa em `armazenamento.ts`, que usa SQLite pela mesma razão.
 */

// Num browser sem `localStorage` (modo privado antigo, iframe restrito) a app
// continua a funcionar, só perde a persistência entre arranques.
const ls: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null;

/** true se há armazenamento local persistente. */
export const armazenamentoDisponivel = ls !== null;

export function ler(chave: string): string | null {
  if (!ls) return null;
  try {
    return ls.getItem(chave);
  } catch {
    return null;
  }
}

export function guardar(chave: string, valor: string): void {
  if (!ls) return;
  try {
    ls.setItem(chave, valor);
  } catch {
    /* quota cheia / indisponível — a app continua a funcionar em memória */
  }
}

export function remover(chave: string): void {
  if (!ls) return;
  try {
    ls.removeItem(chave);
  } catch {
    /* ignora */
  }
}
