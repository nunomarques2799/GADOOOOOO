/**
 * O que a pessoa vem cá fazer — declarado no momento em que cria a conta.
 * ------------------------------------------------------------------
 * Quem cria conta na Terrabovina não entra toda pela mesma porta:
 *
 *   - o **dono** de uma exploração espera pela aprovação do administrador e
 *     depois cria a sua exploração;
 *   - o **trabalhador** e o **veterinário** nunca são aprovados por ninguém —
 *     entram com um CÓDIGO DE CONVITE que o dono lhes dá (ver `membros.tsx`).
 *
 * Sem esta pergunta, os três caíam no mesmo ecrã de espera e o trabalhador
 * ficava à espera de uma aprovação que nunca chega, com o código no bolso.
 *
 * A escolha vive no `user_metadata` da conta (é lá que já vive o nome). Não dá
 * permissões nenhumas — quem decide isso é a RLS, a partir do papel gravado em
 * `membro_exploracao`. Serve só para a app saber o que mostrar a seguir, e por
 * isso pode ser lida sem desconfiança: no pior caso mostra o ecrã errado a
 * quem o editou à mão.
 */

import type { IconName } from '@/components/ui';

export type Intencao = 'dono' | 'trabalhador' | 'veterinario';

export type IntencaoMeta = {
  id: Intencao;
  rotulo: string;
  icone: IconName;
  /** O que acontece a seguir a criar a conta — é isso que a escolha decide. */
  descricao: string;
  /** true se o acesso desta pessoa vem de um código dado por um cliente. */
  precisaCodigo: boolean;
};

export const INTENCOES: readonly IntencaoMeta[] = [
  {
    id: 'dono',
    rotulo: 'Dono de exploração',
    icone: 'barn',
    descricao: 'Tenho animais meus para registar. A conta é aprovada pelo administrador.',
    precisaCodigo: false,
  },
  {
    id: 'trabalhador',
    rotulo: 'Trabalhador',
    icone: 'account-hard-hat',
    descricao: 'Trabalho numa exploração de outra pessoa. Entro com um código de convite.',
    precisaCodigo: true,
  },
  {
    id: 'veterinario',
    rotulo: 'Veterinário',
    icone: 'medical-bag',
    descricao: 'Presto assistência a explorações. Entro com um código de convite.',
    precisaCodigo: true,
  },
] as const;

export function intencaoMeta(id: Intencao): IntencaoMeta {
  // O `find` nunca falha para um `Intencao` válido; o `?? INTENCOES[0]` existe
  // para o tipo de retorno não ficar opcional e obrigar cada sítio a tratar um
  // caso que não acontece.
  return INTENCOES.find((i) => i.id === id) ?? INTENCOES[0];
}

/**
 * A intenção guardada na conta, se lá estiver e for uma das que conhecemos.
 *
 * O `user_metadata` é JSON livre que o próprio utilizador pode escrever
 * (`auth.updateUser`), por isso nada do que vem de lá se aceita sem olhar:
 * um valor desconhecido vale o mesmo que não ter escolhido nada.
 */
export function lerIntencao(metadata: unknown): Intencao | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const valor = (metadata as Record<string, unknown>).intencao;
  return INTENCOES.some((i) => i.id === valor) ? (valor as Intencao) : undefined;
}

/** true se esta pessoa entra por código de convite, e não por aprovação. */
export function entraPorCodigo(intencao: Intencao | undefined): boolean {
  return !!intencao && intencaoMeta(intencao).precisaCodigo;
}
