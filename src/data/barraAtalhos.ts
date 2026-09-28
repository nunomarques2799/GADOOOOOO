import { useSyncExternalStore } from 'react';

import { armazenamentoDisponivel, guardar, ler, remover } from './armazenamento';

/**
 * Os dois ATALHOS da barra de baixo do telemóvel, escolhidos pelo criador.
 *
 * A barra tem cinco lugares: Início | atalho | Registar | atalho | Mais. O
 * Início, o Registar e o Mais são fixos; os dois atalhos são de quem usa a app.
 * Eram sete lugares fixos (Início, Animais, Terrenos, Registar, Alertas, Chat,
 * Mais), e sete é demasiado para um ecrã de telemóvel: cada coluna ficava
 * estreita, os rótulos cortavam-se com a letra do sistema no máximo, e o que
 * um criador abre todos os dias não é o que outro abre. Quem não vive nas
 * Conversas não precisa delas na barra; quem vive, escolhe-as.
 *
 * O Início não se pode tirar (é para onde se volta), e o Mais também não: é por
 * ele que se chega a tudo o que não está na barra.
 *
 * A escolha fica no APARELHO, e não na conta como as cores: a barra só existe
 * no telemóvel (no computador há a barra lateral com tudo), e o que se quer à
 * mão num telemóvel não tem de ser o que se quer noutro.
 */

/** Por omissão: procurar um animal e ver o que está a arder. */
export const ATALHOS_OMISSAO = ['animais', 'alertas'] as const;

/**
 * Para quem SUPERVISIONA uma sociedade agrícola, as Explorações no lugar dos
 * Animais: o supervisor não regista animais nem lhes escreve tratamentos (ver
 * `permissoes.ts`), e o que abre a toda a hora é a lista de explorações.
 */
export const ATALHOS_OMISSAO_SUPERVISOR = ['exploracoes', 'alertas'] as const;

/** Nunca é um atalho: está sempre na barra, no primeiro lugar. */
const FIXO = 'index';

/**
 * Os dois atalhos que a barra mostra, a partir do que o criador escolheu.
 *
 * Tem de dar SEMPRE dois nomes diferentes que esta pessoa possa abrir, mesmo
 * quando a escolha guardada já não serve: as Finanças que se desligaram, a
 * equipa que deixou de gerir, um valor corrompido no armazenamento. Um lugar
 * que já não serve passa à omissão desse lugar; se ela estiver ocupada do
 * outro lado, à omissão do outro lugar (quem pôs os Alertas à esquerda fica com
 * os Animais à direita, e não com o que calhar primeiro na lista); e só no fim
 * ao primeiro destino livre. Nunca fica um buraco na barra.
 */
export function atalhosDaBarra(
  escolha: readonly (string | null | undefined)[] | null,
  disponiveis: readonly string[],
  omissao: readonly string[],
): string[] {
  const podem = disponiveis.filter((n) => n !== FIXO);
  const usados: string[] = [];
  const serve = (n: string | null | undefined): n is string =>
    !!n && podem.includes(n) && !usados.includes(n);

  for (let i = 0; i < 2; i++) {
    const candidato = [escolha?.[i], omissao[i], ...omissao, ...podem].find(serve);
    if (candidato) usados.push(candidato);
  }
  return usados;
}

/* ------------------------------------------------------------------ *
 *  Loja de módulo: a barra e o ecrã onde se escolhe são componentes
 *  diferentes, e um `useState` em cada um fazia a barra só mudar depois
 *  de reabrir a app (ver a nota do `useAgenda.ts`).
 * ------------------------------------------------------------------ */

const CHAVE = 'gado.barra.atalhos';

let carregada = false;
let escolha: string[] | null = null;
const ouvintes = new Set<() => void>();

function lerGuardada(): string[] | null {
  if (!armazenamentoDisponivel) return null;
  const bruto = ler(CHAVE);
  if (!bruto) return null;
  try {
    const v = JSON.parse(bruto) as unknown;
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  } catch {
    return null;
  }
}

function instantaneo(): string[] | null {
  if (!carregada) {
    escolha = lerGuardada();
    carregada = true;
  }
  return escolha;
}

function subscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function avisar(): void {
  for (const o of ouvintes) o();
}

/** O que o criador escolheu (`null` = nunca escolheu, vale a omissão). */
export function useAtalhosEscolhidos(): string[] | null {
  return useSyncExternalStore(subscrever, instantaneo, instantaneo);
}

/** Guarda os dois atalhos, pela ordem: o da esquerda e o da direita do Registar. */
export function definirAtalhos(atalhos: [string, string]): void {
  escolha = [...atalhos];
  carregada = true;
  if (armazenamentoDisponivel) guardar(CHAVE, JSON.stringify(escolha));
  avisar();
}

/** Volta à barra de origem. */
export function reporAtalhos(): void {
  escolha = null;
  carregada = true;
  if (armazenamentoDisponivel) remover(CHAVE);
  avisar();
}
