/**
 * Armazenamento chave-valor síncrono e persistente (versão NATIVA).
 * ------------------------------------------------------------------
 * O `localStorage` não existe em React Native, e o `AsyncStorage` é assíncrono
 * — não serve, porque o arranque da app lê a cache de forma síncrona
 * (`snapshotSincrono` no store) para conseguir desenhar o primeiro ecrã já com
 * dados, sem rede. O `expo-sqlite` tem API síncrona (`getFirstSync`/`runSync`),
 * por isso é ele que sustenta esta camada no telemóvel.
 *
 * Ficheiro próprio (`gado-cache.db`), separado da base de dados relacional
 * `gado.db`: aquela é o modo offline puro (com dados de exemplo semeados na
 * primeira execução) e esta é a cache de uma conta Supabase. Misturá-las abria
 * a porta a ver dados de exemplo à mistura com os dados reais do criador.
 *
 * O Metro escolhe `armazenamento.web.ts` quando compila para a web/Electron.
 */

import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

const NOME_BD = 'gado-cache.db';

let _db: SQLiteDatabase | null = null;

function bd(): SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(NOME_BD);
    _db.execSync(
      'CREATE TABLE IF NOT EXISTS kv (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL)',
    );
  }
  return _db;
}

/** true se há armazenamento local persistente. No nativo há sempre. */
export const armazenamentoDisponivel = true;

export function ler(chave: string): string | null {
  try {
    const linha = bd().getFirstSync<{ valor: string }>(
      'SELECT valor FROM kv WHERE chave = ?',
      chave,
    );
    return linha?.valor ?? null;
  } catch {
    return null;
  }
}

export function guardar(chave: string, valor: string): void {
  try {
    bd().runSync(
      'INSERT INTO kv (chave, valor) VALUES (?, ?) ' +
        'ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
      chave,
      valor,
    );
  } catch {
    /* disco cheio / BD indisponível — a app continua a funcionar em memória */
  }
}

export function remover(chave: string): void {
  try {
    bd().runSync('DELETE FROM kv WHERE chave = ?', chave);
  } catch {
    /* ignora */
  }
}
