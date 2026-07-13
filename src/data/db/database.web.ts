/**
 * Stub web — na web não há SQLite (o store usa dados em memória).
 * ------------------------------------------------------------------
 * O Metro escolhe automaticamente este ficheiro em vez de `database.ts`
 * quando compila para a web, mantendo o módulo nativo `expo-sqlite` (e o
 * seu WASM) fora do bundle do browser. Estas funções nunca são chamadas
 * na web — o store só toca na BD quando Platform.OS !== 'web'.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

const indisponivel = (): never => {
  throw new Error('SQLite não está disponível na web — o store usa dados em memória.');
};

export function abrirBd(): SQLiteDatabase {
  return indisponivel();
}

export function inicializarBd(): SQLiteDatabase {
  return indisponivel();
}
