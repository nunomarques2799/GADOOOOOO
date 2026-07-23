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

  // v2 → v3: valor (€) no evento, para a gestão económica.
  if (versao < 3) {
    garantirColuna(db, 'evento', 'valor', 'REAL');
  }

  // v3 → v4: tabela `movimento` (despesas da exploração e todas as receitas).
  // A tabela em si é criada pelo CREATE_TABLES_SQL acima; o que falta é mudar
  // de sítio os preços de venda que estavam em `evento.valor`. Sem isto, as
  // receitas já registadas desapareciam do ecrã — `financas.ts` deixou de
  // contar o valor de eventos de Venda (ver o cabeçalho de schema_financas.sql).
  if (versao < 4) {
    db.withTransactionSync(() => {
      db.runSync(
        `INSERT OR IGNORE INTO movimento
           (id, exploracaoId, direcao, categoria, valor, data, descricao, animalId, updatedAt)
         SELECT 'mig-' || e.id, a.exploracaoId, 'receita', 'Venda de animais',
                e.valor, e.data,
                CASE WHEN e.descricao = '' THEN 'Venda de animal' ELSE e.descricao END,
                e.animalId, ?
           FROM evento e JOIN animal a ON a.id = e.animalId
          WHERE e.tipo = 'Venda' AND e.valor IS NOT NULL AND e.valor > 0`,
        [new Date().toISOString()],
      );
      // Deixar o valor no evento fá-lo-ia ser contado duas vezes.
      db.runSync(`UPDATE evento SET valor = NULL WHERE tipo = 'Venda'`);
    });
  }

  // v4 → v5: interruptor da gestão económica. Fica DESLIGADO em explorações já
  // criadas — é opt-in, e ninguém deve passar a ver um ecrã de contas que não
  // pediu. Os movimentos já registados ficam guardados, só escondidos.
  if (versao < 5) {
    garantirColuna(db, 'exploracao', 'financasAtivas', 'INTEGER');
    db.runSync('UPDATE exploracao SET financasAtivas = 0 WHERE financasAtivas IS NULL');
  }

  // v5 → v6: casa/número e finalidade do animal, e o interruptor do registo
  // por casa. Fica DESLIGADO nas explorações que já existem, pela mesma razão
  // que as finanças: é opt-in, e ninguém deve dar de caras com campos novos
  // que não pediu. Os campos ficam vazios — nada é inventado a partir do nome.
  if (versao < 6) {
    garantirColuna(db, 'animal', 'casa', 'TEXT');
    garantirColuna(db, 'animal', 'numeroCasa', 'TEXT');
    garantirColuna(db, 'animal', 'finalidade', 'TEXT');
    garantirColuna(db, 'exploracao', 'casaAtiva', 'INTEGER');
    db.runSync('UPDATE exploracao SET casaAtiva = 0 WHERE casaAtiva IS NULL');
  }

  if (versao < SCHEMA_VERSION) {
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  return db;
}
