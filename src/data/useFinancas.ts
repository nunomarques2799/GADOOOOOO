/**
 * O que esta pessoa pode fazer com dinheiro, aqui e agora.
 * ------------------------------------------------------------------
 * Existe para juntar num só sítio as DUAS condições que decidem tudo o que é
 * financeiro, e que vivem em provedores diferentes:
 *
 *   1. o INTERRUPTOR da conta (`Exploracao.financasAtivas`, no `useGado`) —
 *      nem todos os criadores querem a contabilidade dentro desta app;
 *   2. o PAPEL de quem está a usar (`useMembros`) — o trabalhador lança
 *      despesas, o veterinário só o custo do tratamento, o dono vê tudo.
 *
 * Sem este hook, cada ecrã teria de se lembrar de as verificar às duas. Bastava
 * um esquecer-se do interruptor para mostrar um botão que o servidor recusa —
 * e uma recusa feita offline só aparece na sincronização, quando o criador já
 * julga que gravou.
 */

import { useMemo } from 'react';

import { useMembros } from './membros';
import { exigeFinancasAtivas } from './permissoes';
import { useGado } from './store';
import type { Capacidade, CapacidadeLeitura } from './permissoes';

export type AcessoFinanceiro = {
  /** A gestão económica está ligada? */
  ativas: boolean;
  /** Pode lançar despesas (ração, energia, rendas…)? */
  podeRegistarDespesa: boolean;
  /** Pode lançar receitas (vendas, leite, subsídios)? */
  podeRegistarReceita: boolean;
  /** Pode pôr o custo (€) numa vacinação ou medicamento? */
  podeRegistarCustoTratamento: boolean;
  /** Pode abrir o ecrã Finanças? */
  podeVerFinancas: boolean;
  /** Pode ver o balanço na ficha de um animal? */
  podeVerBalancoAnimal: boolean;
  /** É dono de alguma exploração, logo pode ligar/desligar o interruptor? */
  podeLigarDesligar: boolean;
};

/**
 * Com `exploracaoId`, responde sobre essa exploração. Sem ele, responde sobre
 * a conta: o interruptor é de conta, portanto basta uma exploração o ter
 * ligado para as finanças existirem para esta pessoa.
 */
export function useFinancas(exploracaoId?: string): AcessoFinanceiro {
  const { exploracoes } = useGado();
  const { pode, podeVer, podeEmAlguma } = useMembros();

  return useMemo(() => {
    const ativas = exploracaoId
      ? (exploracoes.find((e) => e.id === exploracaoId)?.financasAtivas ?? false)
      : exploracoes.some((e) => e.financasAtivas);

    // O interruptor desligado tira a capacidade a toda a gente, dono incluído:
    // quem não quer contabilidade na app não a quer nem para si.
    const comInterruptor = (capacidade: Capacidade, temPapel: boolean) =>
      temPapel && (!exigeFinancasAtivas(capacidade) || ativas);

    const consulta = (capacidade: CapacidadeLeitura) =>
      podeVer(exploracaoId, capacidade) && (!exigeFinancasAtivas(capacidade) || ativas);

    // Sem exploração indicada a pergunta é "em alguma das minhas?", que é o que
    // faz sentido nos ecrãs que não estão dentro de uma (o ecrã Finanças, o
    // atalho do início). Ver `podeEmAlguma` em `membros.tsx`.
    const papel = (capacidade: Capacidade) =>
      exploracaoId ? pode(exploracaoId, capacidade) : podeEmAlguma(capacidade);

    return {
      ativas,
      podeRegistarDespesa: comInterruptor('registarDespesa', papel('registarDespesa')),
      podeRegistarReceita: comInterruptor('registarReceita', papel('registarReceita')),
      podeRegistarCustoTratamento: comInterruptor(
        'registarCustoTratamento',
        papel('registarCustoTratamento'),
      ),
      podeVerFinancas: consulta('verFinancas'),
      podeVerBalancoAnimal: consulta('verBalancoAnimal'),
      // Ligar não pode depender do interruptor — desligá-lo uma vez tornaria
      // impossível voltar atrás. Depende de ser dono: usa-se
      // `editarExploracao`, que só o admin tem, e que no modo local/demo
      // devolve true (não há equipa, quem está no aparelho é o dono).
      podeLigarDesligar: podeEmAlguma('editarExploracao'),
    };
  }, [exploracoes, exploracaoId, pode, podeVer, podeEmAlguma]);
}
