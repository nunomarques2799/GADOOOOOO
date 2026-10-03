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

/**
 * Grava e diz se conseguiu. `false` quer dizer quota cheia ou armazenamento
 * indisponível: quem grava dados que não podem perder-se (a fila do que está
 * por enviar) TEM de olhar para isto, porque a app continua a funcionar em
 * memória e nada mais avisa. Ver `adicionarOutbox` em `cacheLocal.ts`.
 */
export function guardar(chave: string, valor: string): boolean {
  if (!ls) return false;
  try {
    ls.setItem(chave, valor);
    return true;
  } catch {
    return false;
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
