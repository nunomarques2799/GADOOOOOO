/**
 * Quantas denúncias estão por tratar, partilhado pela app inteira.
 * ------------------------------------------------------------------
 * O número aparece em DOIS sítios que não são o mesmo ecrã: o ponto vermelho
 * na barra do painel de superadmin (que está montada sempre) e a lista de
 * denúncias (que é um ecrã por cima dela). Com `useState` dentro de um hook,
 * cada um ficava com a sua cópia e o ponto continuava aceso depois de a última
 * denúncia ser fechada, até alguém dar a volta à app.
 *
 * Por isso é uma loja de MÓDULO, como no `useChat.ts` e pela mesma razão
 * (ver o cabeçalho de lá, ponto 1).
 */

import { useSyncExternalStore } from 'react';

import { supabase } from './supabase';

let porTratar = 0;
const ouvintes = new Set<() => void>();

function subscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function instantaneo(): number {
  return porTratar;
}

/**
 * A conta que o ecrã das denúncias já sabe.
 *
 * Ele acabou de ler a fila inteira: perguntar outra vez ao servidor pelo mesmo
 * número seria uma segunda ida para uma resposta que já está na mão.
 */
export function definirPorTratar(n: number): void {
  if (n === porTratar) return;
  porTratar = n;
  for (const o of ouvintes) o();
}

/**
 * Perguntar ao servidor. É o que a barra faz ao abrir, antes de alguém entrar
 * na aba.
 *
 * Usa a RPC `denuncias_por_tratar()` (schema 35) em vez de contar a tabela:
 * ela devolve 0 a quem não é superadmin em vez de recusar, portanto uma sessão
 * normal que monte isto por engano não vê um erro na consola.
 *
 * Nunca lança: um ponto vermelho que não apareceu não pode partir a barra.
 */
export async function recarregarPorTratar(): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase.rpc('denuncias_por_tratar');
    if (error) return;
    definirPorTratar(typeof data === 'number' ? data : 0);
  } catch {
    /* fica para a próxima abertura */
  }
}

/** Quantas estão por tratar. Zero também quando ninguém perguntou ainda. */
export function useDenunciasPorTratar(): number {
  return useSyncExternalStore(subscrever, instantaneo, instantaneo);
}
