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

/**
 * Um animal que não pertence à genealogia de ninguém.
 *
 * Eliminar quer dizer "isto foi registado por engano" — o animal não existiu, e
 * um animal que não existiu não é mãe nem filho de coisa nenhuma. Falecer e
 * vender é outra história: esses existiram, e a árvore tem de os manter, senão
 * uma vaca morta levava atrás a ascendência de todas as crias que deixou.
 *
 * É a única regra deste módulo, e está numa função só para não haver duas
 * versões dela: cada sítio que se esquecesse de a aplicar era um sítio onde o
 * engano voltava a aparecer.
 */
function foraDaGenealogia(a: Animal): boolean {
  return a.estado === 'eliminado';
}

/** Crias diretas de um animal, das mais novas para as mais velhas. */
export function filhosDe(animais: Animal[], id: string): Animal[] {
  return animais
    .filter((a) => !foraDaGenealogia(a) && (a.maeId === id || a.paiId === id))
    .sort((x, y) => new Date(y.dataNascimento).getTime() - new Date(x.dataNascimento).getTime());
}

/**
 * O progenitor de um animal, ou `undefined` se não houver um que conte.
 *
 * Existe para o ecrã do animal não ter de repetir a regra: um `maeId` que
 * aponta para um registo eliminado lê-se como "sem mãe registada", que é o que
 * de facto se passa depois de alguém dizer que aquele registo foi um engano.
 */
export function progenitorDe(
  animais: Animal[],
  id: string | undefined,
): Animal | undefined {
  if (!id) return undefined;
  const p = animais.find((a) => a.id === id);
  return p && !foraDaGenealogia(p) ? p : undefined;
}

/**
 * O que acontece ao resto quando este animal for eliminado, em frases, para a
 * confirmação as poder mostrar antes de a pessoa decidir.
 *
 * São duas coisas opostas, e é por isso que não cabem numa frase só:
 *   - o HISTÓRICO fica (eliminar deixou de apagar — ver `schema_auditoria.sql`);
 *   - a GENEALOGIA perde-se, porque um animal eliminado sai da árvore. Quem
 *     tinha este animal como mãe ou pai fica sem esse progenitor registado.
 *
 * A segunda é a que tem de ser lida antes, não depois: é a única consequência
 * desta ação que toca em registos de OUTROS animais.
 */
export function avisosDeEliminacao(
  animal: Animal,
  eventos: Evento[],
  animais: Animal[],
): string[] {
  const avisos: string[] = [];

  const nEventos = eventos.filter((e) => e.animalId === animal.id).length;
  if (nEventos > 0) {
    avisos.push(
      nEventos === 1
        ? 'Fica guardado um registo no histórico.'
        : `Ficam guardados ${nEventos} registos no histórico.`,
    );
  }

  const nCrias = filhosDe(animais, animal.id).length;
  if (nCrias > 0) {
    const ehMae = animal.sexo === 'Fêmea';
    avisos.push(
      nCrias === 1
        ? `Uma cria deixa de ter ${ehMae ? 'esta mãe' : 'este pai'} na árvore genealógica.`
        : `${nCrias} crias deixam de ter ${ehMae ? 'esta mãe' : 'este pai'} na árvore genealógica.`,
    );
  }

  return avisos;
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
    // `progenitorDe` deixa cair os eliminados, e com eles cai o ramo inteiro
    // que vinha por cima: uma ascendência que só existe através de um registo
    // feito por engano é ascendência inventada.
    const progenitor = progenitorDe(animais, id);
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
