/**
 * As apresentações de separador — "para que serve este ecrã", à primeira vez.
 * ------------------------------------------------------------------
 * O guia do Início (`tutorial.ts`) leva pelo caminho essencial, mas há
 * separadores que ninguém pediu para abrir e que não se explicam pelo nome.
 * Trabalhadores é o caso: quem lá chega vê uma lista vazia e não fica a saber
 * que ali se convida gente com um código, nem que é ali que se decide o que
 * cada pessoa pode mexer.
 *
 * Isto é o registo de quem já viu o quê, à parte do ecrã para se poder testar e
 * para a Ajuda o poder repor de uma vez. O cartão é
 * `components/CartaoIntroducao.tsx`.
 *
 * Guardado no aparelho (KV síncrono, como o resto das preferências): é uma
 * apresentação, não um dado da exploração — vê-se uma vez em cada aparelho e
 * não vale uma ida ao servidor.
 */

import { guardar as guardarKv, ler as lerKv } from './armazenamento';

export type ChaveIntroducao = 'trabalhadores';

/** Todas as que existem — é o que a reposição percorre. */
export const CHAVES_INTRODUCAO: ChaveIntroducao[] = ['trabalhadores'];

const chaveKv = (chave: ChaveIntroducao) => `gado.intro.${chave}.v1`;

export function introducaoVista(chave: ChaveIntroducao): boolean {
  try {
    return lerKv(chaveKv(chave)) === '1';
  } catch {
    // Sem armazenamento, mais vale explicar outra vez do que nunca explicar.
    return false;
  }
}

export function marcarIntroducaoVista(chave: ChaveIntroducao): void {
  guardarKv(chaveKv(chave), '1');
}

/**
 * Volta a mostrar todas as apresentações.
 *
 * Anda a par de `reporTutorial()`: quem pede para rever os primeiros passos
 * está a pedir para lhe explicarem a app outra vez, e deixar os separadores de
 * fora dava-lhe metade do que pediu.
 */
export function reporIntroducoes(): void {
  for (const chave of CHAVES_INTRODUCAO) guardarKv(chaveKv(chave), '0');
}
