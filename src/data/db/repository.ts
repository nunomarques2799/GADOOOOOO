/**
 * Repositório SQLite — isola todo o SQL da restante aplicação.
 * ------------------------------------------------------------------
 * A UI nunca chama estas funções diretamente: fala com o store
 * (useGado), e é o store que, no nativo, delega aqui. Manter este
 * limite permite que um motor de sincronização (Supabase) seja
 * acrescentado mais tarde sem tocar nos ecrãs.
 *
 * Estratégia de escrita: UPSERT (INSERT OR REPLACE) do objeto completo
 * — o store aplica as alterações ao objeto de domínio e grava-o inteiro,
 * o que dispensa UPDATEs parciais e mantém a BD e o estado React em par.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  animaisSeed,
  eventosSeed,
  exploracoesSeed,
  movimentosSeed,
  terrenosSeed,
  utilizadorSeed,
} from '../seed';
import type {
  Animal,
  CategoriaMovimento,
  Direcao,
  Especie,
  EstadoAnimal,
  Evento,
  Exploracao,
  Movimento,
  Sexo,
  Terreno,
  TipoTerreno,
  Utilizador,
} from '../types';

/** Linha genérica devolvida pelo SQLite. */
type Row = Record<string, string | number | null>;

const agora = () => new Date().toISOString();

/* ---- Conversões de valores (undefined ↔ NULL, boolean ↔ 0/1) ---- */
const txt = (v: string | undefined | null): string | null => (v == null ? null : v);
const num = (v: number | undefined | null): number | null => (v == null ? null : v);
const bool = (v: boolean | undefined): number | null => (v == null ? null : v ? 1 : 0);

const asStr = (v: Row[string]): string | undefined => (v == null ? undefined : String(v));
const asNum = (v: Row[string]): number | undefined => (v == null ? undefined : Number(v));
const asBool = (v: Row[string]): boolean | undefined => (v == null ? undefined : Number(v) === 1);

/* ------------------------------------------------------------------ *
 *  Mapeadores linha → domínio
 * ------------------------------------------------------------------ */

function toUtilizador(r: Row): Utilizador {
  return {
    id: String(r.id),
    nome: String(r.nome),
    email: String(r.email),
    telefone: asStr(r.telefone),
    nif: asStr(r.nif),
    fotografia: asStr(r.fotografia),
  };
}

function toExploracao(r: Row): Exploracao {
  return {
    id: String(r.id),
    utilizadorId: String(r.utilizadorId),
    nome: String(r.nome),
    marcaExploracao: String(r.marcaExploracao),
    nifDetentor: String(r.nifDetentor),
    localizacao: asStr(r.localizacao),
    fotografia: asStr(r.fotografia),
    financasAtivas: asBool(r.financasAtivas) ?? false,
  };
}

function toTerreno(r: Row): Terreno {
  return {
    id: String(r.id),
    exploracaoId: String(r.exploracaoId),
    nome: String(r.nome),
    descricao: asStr(r.descricao),
    latitude: asNum(r.latitude),
    longitude: asNum(r.longitude),
    area: asNum(r.area),
    tipo: asStr(r.tipo) as TipoTerreno | undefined,
  };
}

function toAnimal(r: Row): Animal {
  return {
    id: String(r.id),
    exploracaoId: String(r.exploracaoId),
    terrenoId: asStr(r.terrenoId),
    maeId: asStr(r.maeId),
    paiId: asStr(r.paiId),
    nome: asStr(r.nome),
    especie: String(r.especie) as Especie,
    sexo: String(r.sexo) as Sexo,
    dataNascimento: String(r.dataNascimento),
    raca: asStr(r.raca),
    corPelagem: asStr(r.corPelagem),
    numeroIdentificacao: asStr(r.numeroIdentificacao),
    dataIdentificacao: asStr(r.dataIdentificacao),
    tipoIdentificacao: asStr(r.tipoIdentificacao),
    fotografia: asStr(r.fotografia),
    fimIntervaloSeguranca: asStr(r.fimIntervaloSeguranca),
    dataPrevistaParto: asStr(r.dataPrevistaParto),
    comunicadoSnira: asBool(r.comunicadoSnira),
    estado: asStr(r.estado) as EstadoAnimal | undefined,
    dataSaida: asStr(r.dataSaida),
    motivoSaida: asStr(r.motivoSaida),
  };
}

function toEvento(r: Row): Evento {
  return {
    id: String(r.id),
    animalId: String(r.animalId),
    tipo: String(r.tipo) as Evento['tipo'],
    data: String(r.data),
    descricao: String(r.descricao),
    detalhe: asStr(r.detalhe),
    valor: asNum(r.valor),
  };
}

function toMovimento(r: Row): Movimento {
  return {
    id: String(r.id),
    exploracaoId: String(r.exploracaoId),
    direcao: String(r.direcao) as Direcao,
    categoria: String(r.categoria) as CategoriaMovimento,
    valor: Number(r.valor),
    data: String(r.data),
    descricao: String(r.descricao),
    contraparte: asStr(r.contraparte),
    animalId: asStr(r.animalId),
    terrenoId: asStr(r.terrenoId),
    criadoPor: asStr(r.criadoPor),
  };
}

/* ------------------------------------------------------------------ *
 *  Leitura — carregar todo o efetivo para o estado React
 * ------------------------------------------------------------------ */

export function carregarUtilizador(db: SQLiteDatabase): Utilizador | undefined {
  const r = db.getFirstSync<Row>('SELECT * FROM utilizador LIMIT 1');
  return r ? toUtilizador(r) : undefined;
}

export function carregarTudo(db: SQLiteDatabase): {
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
  movimentos: Movimento[];
} {
  return {
    exploracoes: db.getAllSync<Row>('SELECT * FROM exploracao ORDER BY nome').map(toExploracao),
    terrenos: db.getAllSync<Row>('SELECT * FROM terreno ORDER BY nome').map(toTerreno),
    animais: db.getAllSync<Row>('SELECT * FROM animal ORDER BY updatedAt DESC').map(toAnimal),
    eventos: db.getAllSync<Row>('SELECT * FROM evento ORDER BY data DESC').map(toEvento),
    movimentos: db.getAllSync<Row>('SELECT * FROM movimento ORDER BY data DESC').map(toMovimento),
  };
}

/* ------------------------------------------------------------------ *
 *  Escrita — UPSERT por entidade
 * ------------------------------------------------------------------ */

export function guardarUtilizador(db: SQLiteDatabase, u: Utilizador): void {
  db.runSync(
    `INSERT OR REPLACE INTO utilizador (id, nome, email, telefone, nif, fotografia, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [u.id, u.nome, u.email, txt(u.telefone), txt(u.nif), txt(u.fotografia), agora()],
  );
}

export function guardarExploracao(db: SQLiteDatabase, e: Exploracao): void {
  db.runSync(
    `INSERT OR REPLACE INTO exploracao (id, utilizadorId, nome, marcaExploracao, nifDetentor, localizacao, fotografia, financasAtivas, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id, e.utilizadorId, e.nome, e.marcaExploracao, e.nifDetentor,
      txt(e.localizacao), txt(e.fotografia), bool(e.financasAtivas ?? false), agora(),
    ],
  );
}

export function guardarTerreno(db: SQLiteDatabase, t: Terreno): void {
  db.runSync(
    `INSERT OR REPLACE INTO terreno (id, exploracaoId, nome, descricao, latitude, longitude, area, tipo, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.id, t.exploracaoId, t.nome, txt(t.descricao), num(t.latitude), num(t.longitude), num(t.area), txt(t.tipo), agora()],
  );
}

export function guardarAnimal(db: SQLiteDatabase, a: Animal): void {
  db.runSync(
    `INSERT OR REPLACE INTO animal
     (id, exploracaoId, terrenoId, maeId, paiId, nome, especie, sexo, dataNascimento, raca, corPelagem,
      numeroIdentificacao, dataIdentificacao, tipoIdentificacao, fotografia, fimIntervaloSeguranca,
      dataPrevistaParto, comunicadoSnira, estado, dataSaida, motivoSaida, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      a.id, a.exploracaoId, txt(a.terrenoId), txt(a.maeId), txt(a.paiId), txt(a.nome), a.especie, a.sexo,
      a.dataNascimento, txt(a.raca), txt(a.corPelagem), txt(a.numeroIdentificacao), txt(a.dataIdentificacao),
      txt(a.tipoIdentificacao), txt(a.fotografia), txt(a.fimIntervaloSeguranca), txt(a.dataPrevistaParto),
      bool(a.comunicadoSnira), txt(a.estado), txt(a.dataSaida), txt(a.motivoSaida), agora(),
    ],
  );
}

export function guardarEvento(db: SQLiteDatabase, e: Evento): void {
  db.runSync(
    `INSERT OR REPLACE INTO evento (id, animalId, tipo, data, descricao, detalhe, valor, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [e.id, e.animalId, e.tipo, e.data, e.descricao, txt(e.detalhe), num(e.valor), agora()],
  );
}

export function guardarMovimento(db: SQLiteDatabase, m: Movimento): void {
  db.runSync(
    `INSERT OR REPLACE INTO movimento
     (id, exploracaoId, direcao, categoria, valor, data, descricao, contraparte,
      animalId, terrenoId, criadoPor, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      m.id, m.exploracaoId, m.direcao, m.categoria, m.valor, m.data, m.descricao,
      txt(m.contraparte), txt(m.animalId), txt(m.terrenoId), txt(m.criadoPor), agora(),
    ],
  );
}

export function eliminarMovimento(db: SQLiteDatabase, id: string): void {
  db.runSync('DELETE FROM movimento WHERE id = ?', [id]);
}

/**
 * Elimina um animal e o seu histórico de eventos (sem órfãos na BD).
 * Os movimentos que lhe estavam imputados ficam, sem animal: o dinheiro saiu
 * na mesma e não pode desaparecer da conta só porque o animal foi apagado.
 */
export function eliminarAnimal(db: SQLiteDatabase, id: string): void {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM evento WHERE animalId = ?', [id]);
    db.runSync('UPDATE movimento SET animalId = NULL WHERE animalId = ?', [id]);
    db.runSync('DELETE FROM animal WHERE id = ?', [id]);
  });
}

/** Elimina um terreno (os animais lá afetos ficam sem terreno atribuído). */
export function eliminarTerreno(db: SQLiteDatabase, id: string): void {
  db.withTransactionSync(() => {
    db.runSync('UPDATE animal SET terrenoId = NULL WHERE terrenoId = ?', [id]);
    db.runSync('UPDATE movimento SET terrenoId = NULL WHERE terrenoId = ?', [id]);
    db.runSync('DELETE FROM terreno WHERE id = ?', [id]);
  });
}

/** Elimina uma exploração inteira: terrenos, animais, eventos e movimentos. */
export function eliminarExploracao(db: SQLiteDatabase, id: string): void {
  db.withTransactionSync(() => {
    const animais = db.getAllSync<Row>('SELECT id FROM animal WHERE exploracaoId = ?', [id]);
    animais.forEach((a) => db.runSync('DELETE FROM evento WHERE animalId = ?', [String(a.id)]));
    db.runSync('DELETE FROM movimento WHERE exploracaoId = ?', [id]);
    db.runSync('DELETE FROM animal WHERE exploracaoId = ?', [id]);
    db.runSync('DELETE FROM terreno WHERE exploracaoId = ?', [id]);
    db.runSync('DELETE FROM exploracao WHERE id = ?', [id]);
  });
}

/* ------------------------------------------------------------------ *
 *  Semear — 1.ª execução (BD vazia) com os dados de exemplo
 * ------------------------------------------------------------------ */

export function semearBd(db: SQLiteDatabase): void {
  db.withTransactionSync(() => {
    guardarUtilizador(db, utilizadorSeed);
    exploracoesSeed.forEach((e) => guardarExploracao(db, e));
    terrenosSeed.forEach((t) => guardarTerreno(db, t));
    animaisSeed.forEach((a) => guardarAnimal(db, a));
    eventosSeed.forEach((e) => guardarEvento(db, e));
    movimentosSeed.forEach((m) => guardarMovimento(db, m));
  });
}
