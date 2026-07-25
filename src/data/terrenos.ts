/**
 * Terrenos arrumados por exploração.
 * ------------------------------------------------------------------
 * Lógica pura (sem React), para se poder testar: é o que o separador Terrenos
 * mostra, e a ordem das coisas é a única forma de encontrar um terreno numa
 * lista de vinte.
 *
 * A lista era ordenada por exploração e depois por nome, mas corrida, sem
 * separação: numa conta com duas quintas, os terrenos de uma acabavam e os da
 * outra começavam a meio do ecrã, sem nada a dizer onde. Quem lá chegasse a
 * rolar não tinha como saber a que exploração pertencia o terreno que estava a
 * ver — a única pista era a linha pequena por baixo do nome, em cada cartão.
 */

import type { Terreno } from './types';

/** O mínimo que se precisa de saber de uma exploração para a intitular. */
export type ExploracaoNomeada = { id: string; nome: string };

export type GrupoTerrenos = {
  /** `undefined` no grupo dos órfãos (ver abaixo). */
  exploracaoId?: string;
  /** O que aparece no cabeçalho do grupo. */
  nome: string;
  terrenos: Terreno[];
};

/**
 * O nome do grupo que recolhe terrenos cuja exploração não está carregada.
 *
 * Acontece com a cache fria (os terrenos chegam antes das explorações) e depois
 * de a exploração ser apagada noutro aparelho. Sem este grupo, esses terrenos
 * desapareciam da lista — que é pior do que os mostrar sem nome.
 */
export const SEM_EXPLORACAO = 'Sem exploração';

/**
 * Um grupo por exploração, pela ordem do nome, com os terrenos por nome dentro
 * de cada um.
 *
 * As explorações SEM terrenos também vêm (com a lista vazia), de propósito: é
 * assim que se vê que falta registar o terreno de uma delas, e é onde o ecrã
 * pode oferecer criá-lo. Uma lista que só mostra o que já existe não deixa
 * reparar no que falta.
 */
export function agruparTerrenosPorExploracao(
  terrenos: Terreno[],
  exploracoes: ExploracaoNomeada[],
): GrupoTerrenos[] {
  const porId = new Map<string, Terreno[]>();
  for (const t of terrenos) {
    const lista = porId.get(t.exploracaoId);
    if (lista) lista.push(t);
    else porId.set(t.exploracaoId, [t]);
  }

  const porNome = (a: Terreno, b: Terreno) => a.nome.localeCompare(b.nome, 'pt');

  const grupos: GrupoTerrenos[] = [...exploracoes]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    .map((e) => ({
      exploracaoId: e.id,
      nome: e.nome,
      terrenos: (porId.get(e.id) ?? []).sort(porNome),
    }));

  const conhecidas = new Set(exploracoes.map((e) => e.id));
  const orfaos = terrenos.filter((t) => !conhecidas.has(t.exploracaoId)).sort(porNome);
  if (orfaos.length > 0) {
    grupos.push({ nome: SEM_EXPLORACAO, terrenos: orfaos });
  }

  return grupos;
}

/**
 * Parte uma lista em linhas de `colunas` elementos.
 *
 * O desenho de desktop mostra os terrenos a dois, e uma lista por secções não
 * tem o `numColumns` das listas simples. Em vez disso, cada "item" da secção é
 * uma LINHA — e é aqui que ela se faz, para o ecrã não ter de contar índices.
 */
export function emLinhas<T>(lista: T[], colunas: number): T[][] {
  if (colunas <= 1) return lista.map((x) => [x]);
  const linhas: T[][] = [];
  for (let i = 0; i < lista.length; i += colunas) {
    linhas.push(lista.slice(i, i + colunas));
  }
  return linhas;
}
