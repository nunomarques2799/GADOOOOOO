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

import type { RoleMembro } from './types';

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

/** Nome do papel para mostrar ao utilizador. */
export function legendaRole(role: RoleMembro): string {
  if (role === 'admin') return 'Dono';
  if (role === 'trabalhador') return 'Trabalhador';
  return 'Veterinário';
}
