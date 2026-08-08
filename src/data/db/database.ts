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

  // v6 → v7: auditoria da saída do efetivo. Quem tirou o animal da lista e
  // quando, e o instante em que um movimento foi lançado. Ficam vazios no que
  // já existe — não se inventa um autor para uma saída registada antes de haver
  // sítio onde o guardar, que é exatamente a mentira que uma auditoria não pode
  // contar. O ecrã de histórico mostra "Sem registo de autor" nesses casos.
  if (versao < 7) {
    garantirColuna(db, 'animal', 'saidaPor', 'TEXT');
    garantirColuna(db, 'animal', 'saidaEm', 'TEXT');
    garantirColuna(db, 'movimento', 'criadoEm', 'TEXT');
  }

  // v7 → v8: fotografia do terreno e coordenadas da exploração. Ficam vazias no
  // que já existe — as coordenadas dos terrenos NÃO se copiam para a
  // exploração: o primeiro terreno com GPS não é a sede da quinta, e inventar
  // isso punha a meteorologia a mudar de sítio sozinha em quem nunca a marcou.
  if (versao < 8) {
    garantirColuna(db, 'terreno', 'fotografia', 'TEXT');
    garantirColuna(db, 'exploracao', 'latitude', 'REAL');
    garantirColuna(db, 'exploracao', 'longitude', 'REAL');
  }

  // v8 → v9: comunicação ao SNIRA, resultado do diagnóstico de gestação e a
  // ligação do tratamento ao lote de onde saiu. A tabela `medicamento` é criada
  // pelo CREATE_TABLES_SQL acima; aqui ficam só as colunas do `evento`.
  //
  // `comunicadoSnira` fica a NULL no histórico, e é isso que se quer: null quer
  // dizer "não é comunicável" e não "falta comunicar" (ver
  // `supabase/schema_snira.sql`). Pô-lo a 0 punha todas as pesagens já
  // registadas na lista de trabalho atrasado.
  if (versao < 9) {
    garantirColuna(db, 'evento', 'resultado', 'TEXT');
    garantirColuna(db, 'evento', 'medicamentoId', 'TEXT');
    garantirColuna(db, 'evento', 'quantidade', 'REAL');
    garantirColuna(db, 'evento', 'comunicadoSnira', 'INTEGER');
    garantirColuna(db, 'evento', 'comunicadoEm', 'TEXT');
  }

  // v9 → v10: interruptor do registo de medicamentos (a aba Existências).
  //
  // Fica LIGADO onde já há lotes registados, e desligado no resto. É o
  // contrário do que se fez com as finanças (v5), de propósito: aquelas
  // nasceram com o interruptor e ninguém perdia nada por nascerem desligadas;
  // esta funcionalidade já cá anda, e pôr toda a gente a 0 fazia desaparecer da
  // app um registo que a lei obriga a ter. Mesma regra do lado do servidor —
  // ver o passo 5 de `supabase/schema_existencias_opcional.sql`.
  if (versao < 10) {
    garantirColuna(db, 'exploracao', 'existenciasAtivas', 'INTEGER');
    db.runSync(
      `UPDATE exploracao SET existenciasAtivas =
         CASE WHEN EXISTS (SELECT 1 FROM medicamento m WHERE m.exploracaoId = exploracao.id)
              THEN 1 ELSE 0 END
       WHERE existenciasAtivas IS NULL`,
    );
  }

  if (versao < SCHEMA_VERSION) {
    db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }

  return db;
}
