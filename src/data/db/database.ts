/**
 * Abertura e inicialização da base de dados SQLite (nativo).
 * ------------------------------------------------------------------
 * Chamado uma vez no arranque, a partir do store. Cria as tabelas se
 * não existirem, corre migrações por versão (PRAGMA user_version) e,
 * na primeira execução, semeia com os dados de exemplo para a app não
 * abrir vazia.
 */

import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { CREATE_TABLES_SQL, DB_NAME, SCHEMA_VERSION } from './schema';
import { semearBd } from './repository';

// Nota: este ficheiro é a versão nativa (iOS/Android). O Metro carrega
// `database.web.ts` na web, isolando o módulo nativo `expo-sqlite` do
// bundle do browser (que não tem o motor WASM configurado).

let _db: SQLiteDatabase | null = null;

/** Devolve a ligação à BD, abrindo-a na primeira chamada. */
export function abrirBd(): SQLiteDatabase {
  if (!_db) _db = SQLite.openDatabaseSync(DB_NAME);
  return _db;
}

/**
 * Garante o schema atualizado e os dados iniciais. Idempotente:
 * pode ser chamado sempre no arranque.
 */
/**
 * Adiciona colunas em falta a tabelas já criadas em versões anteriores.
 * `ALTER TABLE ADD COLUMN` do SQLite não tem `IF NOT EXISTS`, por isso
 * inspeciona-se o `PRAGMA table_info` primeiro.
 */
function garantirColuna(
  db: SQLiteDatabase,
  tabela: string,
  coluna: string,
  definicao: string,
): void {
  const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${tabela})`);
  if (!cols.some((c) => c.name === coluna)) {
    db.execSync(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

export function inicializarBd(): SQLiteDatabase {
  const db = abrirBd();
  db.execSync(CREATE_TABLES_SQL);

  const versaoRow = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const versao = versaoRow?.user_version ?? 0;

  if (versao === 0) {
    // Primeira instalação: semear só se ainda não há efetivo.
    const contagem = db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM animal');
    if ((contagem?.n ?? 0) === 0) semearBd(db);
  }

  // v1 → v2: campo estado/saída no animal.
  if (versao < 2) {
    garantirColuna(db, 'animal', 'estado', 'TEXT');
    garantirColuna(db, 'animal', 'dataSaida', 'TEXT');
    garantirColuna(db, 'animal', 'motivoSaida', 'TEXT');
  }

  if (versao < SCHEMA_VERSION) {
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  return db;
}
