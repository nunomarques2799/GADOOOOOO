/**
 * Schema SQLite — espelha os tipos de domínio (src/data/types.ts).
 * ------------------------------------------------------------------
 * Cada tabela usa nomes de coluna iguais aos campos do tipo (camelCase),
 * para o mapeamento linha↔objeto ser direto. A coluna `updatedAt` (ISO)
 * é escrita em cada gravação e serve de base à futura sincronização com
 * o Supabase (deteção de alterações). Sem FOREIGN KEYs rígidas: a
 * integridade é gerida na aplicação, evitando bloqueios de ordem de
 * inserção/eliminação num contexto offline-first.
 */

export const DB_NAME = 'gado.db';

/** Versão do schema (PRAGMA user_version). Incrementar ao migrar. */
export const SCHEMA_VERSION = 4;

export const CREATE_TABLES_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS utilizador (
  id TEXT PRIMARY KEY NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  nif TEXT,
  fotografia TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS exploracao (
  id TEXT PRIMARY KEY NOT NULL,
  utilizadorId TEXT NOT NULL,
  nome TEXT NOT NULL,
  marcaExploracao TEXT NOT NULL,
  nifDetentor TEXT NOT NULL,
  localizacao TEXT,
  fotografia TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS terreno (
  id TEXT PRIMARY KEY NOT NULL,
  exploracaoId TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  latitude REAL,
  longitude REAL,
  area REAL,
  tipo TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS animal (
  id TEXT PRIMARY KEY NOT NULL,
  exploracaoId TEXT NOT NULL,
  terrenoId TEXT,
  maeId TEXT,
  paiId TEXT,
  nome TEXT,
  especie TEXT NOT NULL,
  sexo TEXT NOT NULL,
  dataNascimento TEXT NOT NULL,
  raca TEXT,
  corPelagem TEXT,
  numeroIdentificacao TEXT,
  dataIdentificacao TEXT,
  tipoIdentificacao TEXT,
  fotografia TEXT,
  fimIntervaloSeguranca TEXT,
  dataPrevistaParto TEXT,
  comunicadoSnira INTEGER,
  estado TEXT,
  dataSaida TEXT,
  motivoSaida TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS evento (
  id TEXT PRIMARY KEY NOT NULL,
  animalId TEXT NOT NULL,
  tipo TEXT NOT NULL,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  detalhe TEXT,
  valor REAL,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS movimento (
  id TEXT PRIMARY KEY NOT NULL,
  exploracaoId TEXT NOT NULL,
  direcao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  descricao TEXT NOT NULL,
  contraparte TEXT,
  animalId TEXT,
  terrenoId TEXT,
  criadoPor TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_animal_exploracao ON animal(exploracaoId);
CREATE INDEX IF NOT EXISTS idx_terreno_exploracao ON terreno(exploracaoId);
CREATE INDEX IF NOT EXISTS idx_evento_animal ON evento(animalId);
CREATE INDEX IF NOT EXISTS idx_movimento_exploracao ON movimento(exploracaoId);
CREATE INDEX IF NOT EXISTS idx_movimento_animal ON movimento(animalId);
`;
