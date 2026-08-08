/**
 * O registo de medicamentos está ligado? E quem o pode ligar?
 * ------------------------------------------------------------------
 * Irmão do `useFinancas.ts`, e pela mesma razão de existir: juntar num sítio só
 * as condições que decidem se a arrecadação aparece, em vez de as deixar cada
 * ecrã verificar por sua conta. Basta um esquecer-se para a app mostrar um
 * separador que o criador desligou.
 *
 * É MAIS SIMPLES do que o das finanças, e de propósito. As finanças têm
 * capacidades próprias por papel (`verFinancas`, `registarDespesa`…) porque o
 * dinheiro é assunto de quem manda; as existências não têm nem devem ter — o
 * trabalhador que vacina precisa de escolher o frasco de onde saiu a dose, e o
 * veterinário que trata precisa do mesmo. Aqui a única pergunta é se o dono
 * ligou a funcionalidade.
 */

import { useMemo } from 'react';

import { useMembros } from './membros';
import { useGado } from './store';

export type AcessoExistencias = {
  /** O registo de medicamentos está ligado? */
  ativas: boolean;
  /** É dono de alguma exploração, logo pode ligar/desligar o interruptor? */
  podeLigarDesligar: boolean;
  /** Pode dar entrada de lotes e corrigi-los? */
  podeGerir: boolean;
};

/**
 * Com `exploracaoId`, responde sobre essa exploração. Sem ele, responde sobre a
 * conta: o interruptor é de conta, portanto basta uma exploração o ter ligado
 * para a arrecadação existir para esta pessoa.
 */
export function useExistencias(exploracaoId?: string): AcessoExistencias {
  const { exploracoes } = useGado();
  const { pode, podeEmAlguma } = useMembros();

  return useMemo(() => {
    const ativas = exploracaoId
      ? (exploracoes.find((e) => e.id === exploracaoId)?.existenciasAtivas ?? false)
      : exploracoes.some((e) => e.existenciasAtivas);

    const papelGere = exploracaoId
      ? pode(exploracaoId, 'editarAnimais')
      : podeEmAlguma('editarAnimais');

    return {
      ativas,
      // Ligar não pode depender do interruptor — desligá-lo uma vez tornaria
      // impossível voltar atrás.
      podeLigarDesligar: podeEmAlguma('editarExploracao'),
      podeGerir: ativas && papelGere,
    };
  }, [exploracoes, exploracaoId, pode, podeEmAlguma]);
}
