/**
 * Repositório Supabase — CRUD assíncrono para as entidades do domínio.
 * ------------------------------------------------------------------
 * Usado pelo store quando há sessão iniciada. As RLS no Supabase
 * filtram automaticamente por membro/role — não é preciso passar
 * user_id nos SELECTs, o server só devolve o que o utilizador vê.
 *
 * Convenção: BD usa snake_case, domínio camelCase. O mapeamento
 * fica centralizado aqui para os componentes ficarem só com os tipos.
 */

import { supabase } from './supabase';
import type {
  Animal,
  Especie,
  Evento,
  EventoTipo,
  Exploracao,
  Sexo,
  Terreno,
  TipoTerreno,
} from './types';

type ExploracaoRow = {
  id: string;
  user_id: string;
  nome: string;
  marca_exploracao: string;
  nif_detentor: string;
  localizacao?: string | null;
  fotografia?: string | null;
};

type TerrenoRow = {
  id: string;
  exploracao_id: string;
  nome: string;
  descricao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  area?: number | null;
  tipo?: string | null;
};

type AnimalRow = {
  id: string;
  exploracao_id: string;
  terreno_id?: string | null;
  mae_id?: string | null;
  pai_id?: string | null;
  nome?: string | null;
  especie: string;
  sexo: string;
  data_nascimento: string;
  raca?: string | null;
  cor_pelagem?: string | null;
  numero_identificacao?: string | null;
  data_identificacao?: string | null;
  tipo_identificacao?: string | null;
  fotografia?: string | null;
  fim_intervalo_seguranca?: string | null;
  data_prevista_parto?: string | null;
  comunicado_snira?: boolean | null;
};

type EventoRow = {
  id: string;
  animal_id: string;
  tipo: string;
  data: string;
  descricao: string;
  detalhe?: string | null;
};

/* ---- Mapeadores linha ↔ domínio ---- */

const toExploracao = (r: ExploracaoRow): Exploracao => ({
  id: r.id,
  utilizadorId: r.user_id,
  nome: r.nome,
  marcaExploracao: r.marca_exploracao,
  nifDetentor: r.nif_detentor,
  localizacao: r.localizacao ?? undefined,
  fotografia: r.fotografia ?? undefined,
});

const toTerreno = (r: TerrenoRow): Terreno => ({
  id: r.id,
  exploracaoId: r.exploracao_id,
  nome: r.nome,
  descricao: r.descricao ?? undefined,
  latitude: r.latitude ?? undefined,
  longitude: r.longitude ?? undefined,
  area: r.area ?? undefined,
  tipo: (r.tipo as TipoTerreno) ?? undefined,
});

const toAnimal = (r: AnimalRow): Animal => ({
  id: r.id,
  exploracaoId: r.exploracao_id,
  terrenoId: r.terreno_id ?? undefined,
  maeId: r.mae_id ?? undefined,
  paiId: r.pai_id ?? undefined,
  nome: r.nome ?? undefined,
  especie: r.especie as Especie,
  sexo: r.sexo as Sexo,
  dataNascimento: r.data_nascimento,
  raca: r.raca ?? undefined,
  corPelagem: r.cor_pelagem ?? undefined,
  numeroIdentificacao: r.numero_identificacao ?? undefined,
  dataIdentificacao: r.data_identificacao ?? undefined,
  tipoIdentificacao: r.tipo_identificacao ?? undefined,
  fotografia: r.fotografia ?? undefined,
  fimIntervaloSeguranca: r.fim_intervalo_seguranca ?? undefined,
  dataPrevistaParto: r.data_prevista_parto ?? undefined,
  comunicadoSnira: r.comunicado_snira ?? undefined,
});

const toEvento = (r: EventoRow): Evento => ({
  id: r.id,
  animalId: r.animal_id,
  tipo: r.tipo as EventoTipo,
  data: r.data,
  descricao: r.descricao,
  detalhe: r.detalhe ?? undefined,
});

/* ---- Payloads para INSERT/UPSERT (omitem `id` gerado no client) ---- */

const exploracaoPayload = (e: Exploracao) => ({
  id: e.id,
  nome: e.nome,
  marca_exploracao: e.marcaExploracao,
  nif_detentor: e.nifDetentor,
  localizacao: e.localizacao ?? null,
  fotografia: e.fotografia ?? null,
});

const terrenoPayload = (t: Terreno) => ({
  id: t.id,
  exploracao_id: t.exploracaoId,
  nome: t.nome,
  descricao: t.descricao ?? null,
  latitude: t.latitude ?? null,
  longitude: t.longitude ?? null,
  area: t.area ?? null,
  tipo: t.tipo ?? null,
});

const animalPayload = (a: Animal) => ({
  id: a.id,
  exploracao_id: a.exploracaoId,
  terreno_id: a.terrenoId ?? null,
  mae_id: a.maeId ?? null,
  pai_id: a.paiId ?? null,
  nome: a.nome ?? null,
  especie: a.especie,
  sexo: a.sexo,
  data_nascimento: a.dataNascimento,
  raca: a.raca ?? null,
  cor_pelagem: a.corPelagem ?? null,
  numero_identificacao: a.numeroIdentificacao ?? null,
  data_identificacao: a.dataIdentificacao ?? null,
  tipo_identificacao: a.tipoIdentificacao ?? null,
  fotografia: a.fotografia ?? null,
  fim_intervalo_seguranca: a.fimIntervaloSeguranca ?? null,
  data_prevista_parto: a.dataPrevistaParto ?? null,
  comunicado_snira: a.comunicadoSnira ?? null,
});

const eventoPayload = (e: Evento) => ({
  id: e.id,
  animal_id: e.animalId,
  tipo: e.tipo,
  data: e.data,
  descricao: e.descricao,
  detalhe: e.detalhe ?? null,
});

/* ---- Reads ---- */

export type Snapshot = {
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
};

export async function carregarTudoSupabase(): Promise<Snapshot> {
  if (!supabase) return { exploracoes: [], terrenos: [], animais: [], eventos: [] };
  const [expRes, terRes, aniRes, evtRes] = await Promise.all([
    supabase.from('exploracao').select('*').order('nome'),
    supabase.from('terreno').select('*').order('nome'),
    supabase.from('animal').select('*'),
    supabase.from('evento').select('*').order('data', { ascending: false }),
  ]);
  // Falhar em vez de devolver listas vazias: sem esta guarda, um erro de rede
  // (estar offline) devolveria tudo vazio e apagaria a cache local. Quem chama
  // trata o erro mantendo os dados que já tem em cache.
  const erro = expRes.error ?? terRes.error ?? aniRes.error ?? evtRes.error;
  if (erro) throw new Error(erro.message);
  return {
    exploracoes: ((expRes.data ?? []) as ExploracaoRow[]).map(toExploracao),
    terrenos: ((terRes.data ?? []) as TerrenoRow[]).map(toTerreno),
    animais: ((aniRes.data ?? []) as AnimalRow[]).map(toAnimal),
    eventos: ((evtRes.data ?? []) as EventoRow[]).map(toEvento),
  };
}

/* ---- Writes ---- */

export async function upsertExploracaoSupabase(e: Exploracao): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('exploracao').upsert(exploracaoPayload(e));
  return error?.message ?? null;
}

export async function eliminarExploracaoSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('exploracao').delete().eq('id', id);
  return error?.message ?? null;
}

export async function upsertTerrenoSupabase(t: Terreno): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('terreno').upsert(terrenoPayload(t));
  return error?.message ?? null;
}

export async function eliminarTerrenoSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('terreno').delete().eq('id', id);
  return error?.message ?? null;
}

export async function upsertAnimalSupabase(a: Animal): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('animal').upsert(animalPayload(a));
  return error?.message ?? null;
}

export async function eliminarAnimalSupabase(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('animal').delete().eq('id', id);
  return error?.message ?? null;
}

export async function upsertEventoSupabase(e: Evento): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from('evento').upsert(eventoPayload(e));
  return error?.message ?? null;
}
