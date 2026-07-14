/**
 * API do painel de superadmin — usa RPCs SECURITY DEFINER no Supabase,
 * cada uma valida `eh_superadmin()` no topo. Assim contornamos:
 *   (a) o problema de `auth.users` não ser SELECTable por RLS normal
 *   (b) evitamos permissões complexas nas policies das views.
 */

import { supabase } from './supabase';
import type { Animal, Especie, Evento, EventoTipo, Sexo, Terreno, TipoTerreno } from './types';

export type EstadoSubscricao = 'trial' | 'ativa' | 'atrasada' | 'cancelada';
export type EstadoCliente = 'pendente' | 'ativo';

export interface ClienteResumo {
  userId: string;
  nome: string;
  email: string;
  telefone?: string;
  nif?: string;
  estado: EstadoCliente;
  registadoEm?: string;
  nExploracoes: number;
  nTerrenos: number;
  nAnimais: number;
  plano?: string;
  precoMensal?: number;
  estadoSubscricao?: EstadoSubscricao;
  proximaCobranca?: string;
}

export interface ExploracaoResumo {
  id: string;
  nome: string;
  marcaExploracao: string;
  nifDetentor: string;
  localizacao?: string;
  nTerrenos: number;
  nAnimais: number;
}

export interface EventoHistorico {
  id: string;
  em: string;
  tipo: string;
  plano?: string;
  precoMensal?: number;
  estado?: EstadoSubscricao;
  notas?: string;
}

export interface MetricasMensais {
  mes: string; // YYYY-MM-01
  mrr: number;
  novos: number;
  cancelados: number;
  ativosFim: number;
  churnRate: number;
}

/* ---------- Helpers ---------- */

const num = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v);

type ClienteRow = {
  user_id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  nif?: string | null;
  estado: EstadoCliente;
  registado_em?: string | null;
  n_exploracoes: number | string;
  n_terrenos: number | string;
  n_animais: number | string;
  plano?: string | null;
  preco_mensal?: number | string | null;
  estado_subscricao?: EstadoSubscricao | null;
  proxima_cobranca?: string | null;
};

const toCliente = (r: ClienteRow): ClienteResumo => ({
  userId: r.user_id,
  nome: r.nome,
  email: r.email,
  telefone: r.telefone ?? undefined,
  nif: r.nif ?? undefined,
  estado: r.estado,
  registadoEm: r.registado_em ?? undefined,
  nExploracoes: num(r.n_exploracoes),
  nTerrenos: num(r.n_terrenos),
  nAnimais: num(r.n_animais),
  plano: r.plano ?? undefined,
  precoMensal: r.preco_mensal == null ? undefined : num(r.preco_mensal),
  estadoSubscricao: r.estado_subscricao ?? undefined,
  proximaCobranca: r.proxima_cobranca ?? undefined,
});

/* ---------- Chamadas ---------- */

export async function listarClientes(): Promise<ClienteResumo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_listar_clientes');
  if (error) throw new Error(error.message);
  return ((data ?? []) as ClienteRow[]).map(toCliente);
}

export async function obterCliente(userId: string): Promise<ClienteResumo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('superadmin_obter_cliente', { alvo: userId });
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as ClienteRow[];
  return linhas[0] ? toCliente(linhas[0]) : null;
}

export async function listarExploracoesDoCliente(userId: string): Promise<ExploracaoResumo[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_exploracoes_cliente', { alvo: userId });
  if (error) throw new Error(error.message);
  type Row = {
    id: string;
    nome: string;
    marca_exploracao: string;
    nif_detentor: string;
    localizacao?: string | null;
    n_terrenos: number | string;
    n_animais: number | string;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    nome: r.nome,
    marcaExploracao: r.marca_exploracao,
    nifDetentor: r.nif_detentor,
    localizacao: r.localizacao ?? undefined,
    nTerrenos: num(r.n_terrenos),
    nAnimais: num(r.n_animais),
  }));
}

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

export async function listarTerrenosDaExploracao(expId: string): Promise<Terreno[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_terrenos_exploracao', { exp_id: expId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TerrenoRow[]).map((r) => ({
    id: r.id,
    exploracaoId: r.exploracao_id,
    nome: r.nome,
    descricao: r.descricao ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    area: r.area ?? undefined,
    tipo: (r.tipo as TipoTerreno) ?? undefined,
  }));
}

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

export async function listarAnimaisDaExploracao(expId: string): Promise<Animal[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_animais_exploracao', { exp_id: expId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AnimalRow[]).map((r) => ({
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
  }));
}

type EventoRow = {
  id: string;
  animal_id: string;
  tipo: string;
  data: string;
  descricao: string;
  detalhe?: string | null;
};

export async function listarEventosDoAnimal(aniId: string): Promise<Evento[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_eventos_animal', { ani_id: aniId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as EventoRow[]).map((r) => ({
    id: r.id,
    animalId: r.animal_id,
    tipo: r.tipo as EventoTipo,
    data: r.data,
    descricao: r.descricao,
    detalhe: r.detalhe ?? undefined,
  }));
}

export async function historicoSubscricao(userId: string): Promise<EventoHistorico[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_historico_subscricao', { alvo: userId });
  if (error) throw new Error(error.message);
  type Row = {
    id: string;
    em: string;
    tipo: string;
    plano?: string | null;
    preco_mensal?: number | string | null;
    estado?: EstadoSubscricao | null;
    notas?: string | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    em: r.em,
    tipo: r.tipo,
    plano: r.plano ?? undefined,
    precoMensal: r.preco_mensal == null ? undefined : num(r.preco_mensal),
    estado: r.estado ?? undefined,
    notas: r.notas ?? undefined,
  }));
}

export async function metricasMensais(meses = 6): Promise<MetricasMensais[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('superadmin_metricas_mensais', { meses });
  if (error) throw new Error(error.message);
  type Row = {
    mes: string;
    mrr: number | string;
    novos: number | string;
    cancelados: number | string;
    ativos_fim: number | string;
    churn_rate: number | string;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    mes: r.mes,
    mrr: num(r.mrr),
    novos: num(r.novos),
    cancelados: num(r.cancelados),
    ativosFim: num(r.ativos_fim),
    churnRate: num(r.churn_rate),
  }));
}

export async function definirSubscricao(
  alvo: string,
  plano: string,
  precoMensal: number,
  estado: EstadoSubscricao,
  proximaCobranca?: string,
  notas?: string,
): Promise<string | null> {
  if (!supabase) return 'Supabase não configurado.';
  const { error } = await supabase.rpc('superadmin_definir_subscricao', {
    alvo,
    novo_plano: plano,
    novo_preco: precoMensal,
    novo_estado: estado,
    proxima: proximaCobranca ?? null,
    notas_txt: notas ?? null,
  });
  return error?.message ?? null;
}
