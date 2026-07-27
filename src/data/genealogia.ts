import type { Animal, Evento } from './types';

/** Como um animal se relaciona com o que está imediatamente acima na árvore. */
export type Parentesco = 'Mãe' | 'Pai' | 'Filha' | 'Filho';

export type NoGenealogico = {
  animal: Animal;
  parentesco: Parentesco;
  /** Ramos seguintes: progenitores (para cima) ou crias (para baixo). */
  ramos: NoGenealogico[];
};

/** Nome pelo qual o criador reconhece o animal (nome → brinco → genérico). */
export function rotuloAnimal(a: Animal): string {
  return a.nome ?? a.numeroIdentificacao ?? 'Sem nome';
}

/** Crias diretas de um animal, das mais novas para as mais velhas. */
export function filhosDe(animais: Animal[], id: string): Animal[] {
  return animais
    .filter((a) => a.maeId === id || a.paiId === id)
    .sort((x, y) => new Date(y.dataNascimento).getTime() - new Date(x.dataNascimento).getTime());
}

/**
 * O que fica guardado quando este animal for eliminado, em texto, ou `null` se
 * não houver nada a dizer. Entra na confirmação, antes de a pessoa decidir.
 *
 * Isto já foi o contrário: `impedimentoParaEliminar`, que dizia porque é que o
 * botão NÃO funcionava. Enquanto eliminar fazia `delete`, a cascata levava os
 * eventos atrás — incluindo os que outra pessoa registou — e recusar era a
 * única defesa possível. Desde `supabase/schema_auditoria.sql` eliminar marca
 * em vez de apagar: não há o que defender, e o que era um impedimento passou a
 * ser uma informação. A contagem é a mesma; muda o que se faz com ela.
 */
export function historicoQueFicaGuardado(
  animal: Animal,
  eventos: Evento[],
  animais: Animal[],
): string | null {
  const nEventos = eventos.filter((e) => e.animalId === animal.id).length;
  const nCrias = filhosDe(animais, animal.id).length;

  const partes: string[] = [];
  if (nEventos > 0) {
    partes.push(nEventos === 1 ? 'um registo no histórico' : `${nEventos} registos no histórico`);
  }
  if (nCrias > 0) {
    partes.push(nCrias === 1 ? 'uma cria na genealogia' : `${nCrias} crias na genealogia`);
  }
  if (partes.length === 0) return null;

  return `Ficam guardados ${partes.join(' e ')}.`;
}

/**
 * Progenitores de um animal, recursivamente até `profundidade` gerações.
 * `visitados` corta ciclos se os dados vierem inconsistentes.
 */
export function ascendentesDe(
  animais: Animal[],
  animal: Animal,
  profundidade: number,
  visitados = new Set<string>(),
): NoGenealogico[] {
  if (profundidade <= 0 || visitados.has(animal.id)) return [];
  const seguintes = new Set(visitados).add(animal.id);

  const out: NoGenealogico[] = [];
  for (const [id, parentesco] of [
    [animal.maeId, 'Mãe'],
    [animal.paiId, 'Pai'],
  ] as const) {
    if (!id) continue;
    const progenitor = animais.find((a) => a.id === id);
    if (!progenitor || seguintes.has(progenitor.id)) continue;
    out.push({
      animal: progenitor,
      parentesco,
      ramos: ascendentesDe(animais, progenitor, profundidade - 1, seguintes),
    });
  }
  return out;
}

/** Crias de um animal, recursivamente até `profundidade` gerações. */
export function descendentesDe(
  animais: Animal[],
  animal: Animal,
  profundidade: number,
  visitados = new Set<string>(),
): NoGenealogico[] {
  if (profundidade <= 0 || visitados.has(animal.id)) return [];
  const seguintes = new Set(visitados).add(animal.id);

  return filhosDe(animais, animal.id)
    .filter((f) => !seguintes.has(f.id))
    .map((f) => ({
      animal: f,
      parentesco: f.sexo === 'Fêmea' ? ('Filha' as const) : ('Filho' as const),
      ramos: descendentesDe(animais, f, profundidade - 1, seguintes),
    }));
}
