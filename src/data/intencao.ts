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
import { t } from '@/i18n';

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

/**
 * As três respostas a "o que veio cá fazer?".
 *
 * FUNÇÃO e não constante: o rótulo e a descrição passam pelo `t()`, e uma
 * tabela criada no import ficava congelada na língua de arranque (a mesma
 * armadilha das cores, ver AGENTS.md). O `id` e o `precisaCodigo` é que não
 * mudam: são o que se grava e o que decide o caminho da conta.
 */
export function intencoes(): readonly IntencaoMeta[] {
  return [
    {
      id: 'dono',
      rotulo: t('intencao.dono'),
      icone: 'barn',
      descricao: t('intencao.donoDescricao'),
      precisaCodigo: false,
    },
    {
      id: 'trabalhador',
      rotulo: t('intencao.trabalhador'),
      icone: 'account-hard-hat',
      descricao: t('intencao.trabalhadorDescricao'),
      precisaCodigo: true,
    },
    {
      id: 'veterinario',
      rotulo: t('intencao.veterinario'),
      icone: 'medical-bag',
      descricao: t('intencao.veterinarioDescricao'),
      precisaCodigo: true,
    },
  ];
}

/** Os ids conhecidos, sem passar por texto nenhum. */
const IDS_INTENCAO = ['dono', 'trabalhador', 'veterinario'] as const;

export function intencaoMeta(id: Intencao): IntencaoMeta {
  // O `find` nunca falha para um `Intencao` válido; o `?? [0]` existe para o
  // tipo de retorno não ficar opcional e obrigar cada sítio a tratar um caso
  // que não acontece.
  const todas = intencoes();
  return todas.find((i) => i.id === id) ?? todas[0];
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
  return IDS_INTENCAO.some((i) => i === valor) ? (valor as Intencao) : undefined;
}

/** true se esta pessoa entra por código de convite, e não por aprovação. */
export function entraPorCodigo(intencao: Intencao | undefined): boolean {
  return !!intencao && intencaoMeta(intencao).precisaCodigo;
}
