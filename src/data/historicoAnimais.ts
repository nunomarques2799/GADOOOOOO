/**
 * Histórico do efetivo — quem saiu, porquê, quando e por ordem de quem.
 * ------------------------------------------------------------------
 * Lógica pura (sem React, sem rede) para poder ser testada.
 *
 * A lista de Animais mostra o efetivo VIVO. Tudo o que sai dele — falecido,
 * vendido ou eliminado — continua guardado e passa a viver aqui. É um registo
 * de auditoria, não um caixote do lixo: a pergunta a que responde é "quem tirou
 * este animal da lista, e quando", que numa exploração com trabalhadores é uma
 * pergunta a sério.
 *
 * Ordena pelo INSTANTE DO REGISTO (`saidaEm`), não pela data da saída
 * (`dataSaida`). São coisas diferentes e a diferença é o ponto: um animal que
 * morreu em março e só foi registado hoje pertence ao topo desta lista, porque
 * o que aqui se está a ver é o rasto do que as pessoas fizeram na app.
 */

import type { Animal, EstadoAnimal } from './types';

/** Os três motivos por que um animal deixa de estar no efetivo. */
export type MotivoSaida = Exclude<EstadoAnimal, 'ativo'>;

export const MOTIVOS: { valor: MotivoSaida; label: string }[] = [
  { valor: 'falecido', label: 'Falecidos' },
  { valor: 'vendido', label: 'Vendidos' },
  { valor: 'eliminado', label: 'Eliminados' },
];

/** O que se lê de cada motivo, no singular, dentro de uma frase. */
export const rotuloMotivo: Record<MotivoSaida, string> = {
  falecido: 'Falecido',
  vendido: 'Vendido',
  eliminado: 'Eliminado',
};

export interface LinhaHistorico {
  animal: Animal;
  motivo: MotivoSaida;
  /** O dia a que a saída diz respeito (ISO, só data). */
  dataSaida?: string;
  /** O instante em que ficou registada na app (ISO com hora). */
  registadoEm?: string;
  /** Id de quem a registou. O nome resolve-se fora daqui (`nomesEquipa.ts`). */
  registadoPor?: string;
  /** Nota livre: causa da morte, comprador, matadouro. */
  nota?: string;
}

export type FiltroHistorico = {
  exploracaoId?: string;
  motivo?: MotivoSaida;
  /** Pesquisa por nome ou brinco. */
  texto?: string;
};

/** Um animal fora do efetivo? (`estado` ausente conta como ativo). */
export function saiuDoEfetivo(a: Animal): boolean {
  return !!a.estado && a.estado !== 'ativo';
}

/**
 * O histórico, do registo mais recente para o mais antigo.
 *
 * O desempate por `dataSaida` cobre os registos antigos, feitos antes de haver
 * `saidaEm` guardado: sem ele caíam todos para o fim por ordem aleatória, o que
 * numa lista que se lê de cima para baixo parece dados corrompidos.
 */
export function historicoDoEfetivo(animais: Animal[], f: FiltroHistorico = {}): LinhaHistorico[] {
  const q = f.texto?.trim().toLowerCase() ?? '';

  const linhas = animais
    .filter((a) => saiuDoEfetivo(a))
    .filter((a) => !f.exploracaoId || a.exploracaoId === f.exploracaoId)
    .filter((a) => !f.motivo || a.estado === f.motivo)
    .filter((a) => {
      if (!q) return true;
      return [a.nome, a.numeroIdentificacao].some((c) => c?.toLowerCase().includes(q));
    })
    .map<LinhaHistorico>((a) => ({
      animal: a,
      motivo: a.estado as MotivoSaida,
      dataSaida: a.dataSaida,
      registadoEm: a.saidaEm,
      registadoPor: a.saidaPor,
      nota: a.motivoSaida,
    }));

  return linhas.sort((x, y) => {
    const ax = x.registadoEm ?? x.dataSaida ?? '';
    const ay = y.registadoEm ?? y.dataSaida ?? '';
    return ay.localeCompare(ax) || (x.animal.nome ?? '').localeCompare(y.animal.nome ?? '', 'pt');
  });
}

/** Quantos há de cada motivo, para os chips não oferecerem listas vazias. */
export function contarPorMotivo(
  animais: Animal[],
  f: Omit<FiltroHistorico, 'motivo'> = {},
): Record<MotivoSaida, number> {
  const conta: Record<MotivoSaida, number> = { falecido: 0, vendido: 0, eliminado: 0 };
  for (const l of historicoDoEfetivo(animais, f)) conta[l.motivo]++;
  return conta;
}
