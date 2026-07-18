/**
 * O que cada papel pode fazer dentro de uma exploração.
 * ------------------------------------------------------------------
 * Lógica pura, sem React e sem rede, para poder ser testada — é a tabela que
 * decide o que a interface mostra a cada pessoa.
 *
 * ESTA TABELA ESPELHA AS POLÍTICAS RLS de `supabase/schema_roles.sql`. O
 * servidor é quem manda: mesmo que um botão apareça por engano, a RLS recusa a
 * escrita. O objetivo aqui é o inverso — não deixar aparecer um botão que o
 * servidor vai recusar, porque uma recusa feita offline só se descobre na
 * sincronização, e até lá o criador julga que gravou.
 *
 * Ao mexer numa política do SQL, mexer também aqui (e no teste).
 */

import type { EstadoPerfil, RoleMembro } from './types';

export type Capacidade =
  /** Mudar nome, marca, NIF ou localização da exploração. */
  | 'editarExploracao'
  /** Apagar a exploração inteira, com terrenos, animais e histórico. */
  | 'eliminarExploracao'
  /** Convidar, listar e remover membros da equipa. */
  | 'gerirEquipa'
  /** Criar, editar e apagar terrenos. */
  | 'gerirTerrenos'
  /** Criar e editar animais, e registar eventos. */
  | 'editarAnimais'
  /** Apagar o registo de um animal e todo o seu histórico. */
  | 'eliminarAnimais'
  /** Marcar um animal como falecido ou vendido. */
  | 'registarSaida';

/**
 * O veterinário trata dos animais, não do património: mexe nas fichas e regista
 * eventos e saídas (certificar uma morte é ato veterinário), mas não apaga
 * registos nem toca em terrenos, na exploração ou na equipa.
 */
const PERMISSOES: Record<RoleMembro, readonly Capacidade[]> = {
  admin: [
    'editarExploracao',
    'eliminarExploracao',
    'gerirEquipa',
    'gerirTerrenos',
    'editarAnimais',
    'eliminarAnimais',
    'registarSaida',
  ],
  trabalhador: ['gerirTerrenos', 'editarAnimais', 'eliminarAnimais', 'registarSaida'],
  veterinario: ['editarAnimais', 'registarSaida'],
};

/** true se o papel dado pode exercer a capacidade. Sem papel, não pode nada. */
export function rolePode(role: RoleMembro | undefined, capacidade: Capacidade): boolean {
  if (!role) return false;
  return PERMISSOES[role].includes(capacidade);
}

/** Tudo o que decide se esta pessoa pode escrever, neste momento. */
export type ContextoAcesso = {
  /** Há projeto Supabase configurado? (falso no modo demo/offline puro) */
  supabaseConfigurado: boolean;
  /** Há sessão iniciada? */
  temSessao: boolean;
  isSuperadmin: boolean;
  /** Estado do perfil de quem está a agir. */
  estadoPerfil: EstadoPerfil | null;
  /** Papel de quem está a agir NESTA exploração. */
  role: RoleMembro | undefined;
};

/**
 * Decisão completa de escrita: modo da app + estado da conta + papel.
 * Espelha `pode_escrever_em()` + as políticas de `schema_suspensao.sql`.
 *
 * A ordem das perguntas importa e cada uma tem um modo de falhar próprio:
 * sem Supabase a app ficaria só de leitura; o superadmin ficaria fechado
 * fora das contas que precisa de assistir; e uma conta suspensa veria os
 * botões todos para depois cada gravação rebentar contra a RLS.
 */
export function podeEscrever(ctx: ContextoAcesso, capacidade: Capacidade): boolean {
  // Modo local/demo: não há equipa nem papéis — quem está no aparelho é o dono.
  if (!ctx.supabaseConfigurado || !ctx.temSessao) return true;
  if (ctx.isSuperadmin) return true;
  // Suspensa (ou ainda por aprovar): consulta sim, escrita não.
  if (ctx.estadoPerfil !== 'ativo') return false;
  return rolePode(ctx.role, capacidade);
}

/** Nome do papel para mostrar ao utilizador. */
export function legendaRole(role: RoleMembro): string {
  if (role === 'admin') return 'Dono';
  if (role === 'trabalhador') return 'Trabalhador';
  return 'Veterinário';
}
