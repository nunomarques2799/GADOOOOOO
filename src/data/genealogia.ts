import type { Animal } from './types';

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
