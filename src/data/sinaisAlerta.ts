/**
 * Os pontos coloridos que a lista de animais põe no retrato de cada cabeça.
 * ------------------------------------------------------------------
 * A lista já sabia ORDENAR por alertas, mas não sabia MOSTRÁ-LOS: para saber
 * porque é que um animal estava no topo era preciso abrir a ficha. Quem percorre
 * o efetivo de manhã quer o contrário — ver de relance quem precisa de alguma
 * coisa, e de que tipo de coisa se trata.
 *
 * Três sinais e não sete: uma bolinha por categoria dava sete cores num retrato
 * de 52px, e sete cores não se decoram. Estes três são as três perguntas
 * diferentes que o criador faz ao efetivo:
 *
 *   legal ....... o Estado está à espera de alguma coisa (brinco, SNIRA)
 *   reproducao .. o ciclo da fêmea pede uma decisão (parto, cobrição)
 *   saude ....... o animal pede um tratamento (vacina, medicamento)
 *
 * A cor NUNCA decide sozinha: a lista traz uma legenda escrita por cima e, ao
 * abrir a ficha, cada alerta aparece por palavras. Um em cada doze homens não
 * distingue o vermelho do âmbar, e o utilizador de referência tem 82 anos e usa
 * o telemóvel ao sol.
 */

import type { Alerta } from './types';

export type Sinal = 'legal' | 'reproducao' | 'saude';

/** Pela ordem em que aparecem no retrato e na legenda: o mais grave primeiro. */
export const SINAIS: Sinal[] = ['legal', 'reproducao', 'saude'];

const SINAL_DA_CATEGORIA: Record<Alerta['categoria'], Sinal | undefined> = {
  identificacao: 'legal',
  snira: 'legal',
  parto: 'reproducao',
  reproducao: 'reproducao',
  medicamento: 'saude',
  vacinacao: 'saude',
  // As existências são da arrecadação e não de um animal: nunca chegam aqui
  // (ver `mapaAlertas`). Fica declarado porque o `Record` os pede todos, e é
  // isso que faz o `tsc` apanhar uma categoria nova que ninguém mapeou.
  existencias: undefined,
};

/**
 * Que sinais mostrar a um animal, sem repetir e por ordem de gravidade.
 *
 * Recebe as categorias já calculadas pelo ecrã (`mapaAlertas`), e não a lista
 * de alertas: numa lista de trezentos animais, procurar os alertas de cada um
 * era percorrer o array todo trezentas vezes.
 */
export function sinaisDe(categorias: ReadonlySet<Alerta['categoria']> | undefined): Sinal[] {
  if (!categorias || categorias.size === 0) return [];
  const encontrados = new Set<Sinal>();
  for (const c of categorias) {
    const s = SINAL_DA_CATEGORIA[c];
    if (s) encontrados.add(s);
  }
  return SINAIS.filter((s) => encontrados.has(s));
}
