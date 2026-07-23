/**
 * Filtros da lista de animais — lógica pura, sem React.
 * ------------------------------------------------------------------
 * Vive à parte do ecrã por duas razões. A primeira é poder ser testada: são
 * dez condições que se combinam, e um erro numa delas não rebenta nada — só
 * esconde animais, que é o pior tipo de falha nesta app (o criador conclui que
 * perdeu o registo, não que o filtro está mal).
 *
 * A segunda é a regra do efetivo: por omissão a lista mostra só os animais
 * ATIVOS. Os falecidos e vendidos continuam na base para a genealogia
 * funcionar, e só aparecem com o arquivo ligado — se essa decisão andasse
 * espalhada pelos filtros, mais tarde ou mais cedo um deles esquecia-se dela e
 * punha animais mortos no meio do efetivo.
 */

import { idadeDias } from './helpers';
import { normalizar } from './racas';
import type { Alerta, Animal, Especie, Finalidade, Sexo } from './types';

/** Faixas etárias. Em meses, que é como o criador fala das idades. */
export type FaixaIdade = 'cria' | 'jovem' | 'adulto' | 'velho';

export const FAIXAS: { valor: FaixaIdade; label: string; meses: [number, number] }[] = [
  { valor: 'cria', label: 'Até 6 meses', meses: [0, 6] },
  { valor: 'jovem', label: '6 meses a 2 anos', meses: [6, 24] },
  { valor: 'adulto', label: '2 a 8 anos', meses: [24, 96] },
  { valor: 'velho', label: 'Mais de 8 anos', meses: [96, Infinity] },
];

const MESES_DIA = 30.44;

export function faixaDe(animal: Animal): FaixaIdade {
  const meses = idadeDias(animal.dataNascimento) / MESES_DIA;
  // O limite superior é exclusivo; um animal de 24 meses certos é "adulto".
  const f = FAIXAS.find(({ meses: [de, ate] }) => meses >= de && meses < ate);
  return f?.valor ?? 'velho';
}

/** Valor especial para "animais sem terreno atribuído". */
export const SEM_TERRENO = '__sem-terreno__';

export type Filtros = {
  especie?: Especie;
  sexo?: Sexo;
  raca?: string;
  cor?: string;
  finalidade?: Finalidade;
  /** Id do terreno, ou `SEM_TERRENO`. */
  terrenoId?: string;
  casa?: string;
  idade?: FaixaIdade;
  /** true = cobertas (com parto previsto); false = não cobertas. */
  prenhe?: boolean;
  /** Só animais sem brinco — os que geram o alerta de identificação. */
  semBrinco?: boolean;
  /** `true` = com qualquer alerta; uma categoria = só alertas dessa. */
  alerta?: true | Alerta['categoria'];
  /** Mostrar também falecidos e vendidos. */
  incluirSaidos?: boolean;
  /** Pesquisa por nome, brinco, raça ou casa. */
  texto?: string;
};

export const FILTROS_VAZIOS: Filtros = {};

/** Quantos filtros estão a limitar a lista (para o botão mostrar o número). */
export function contarAtivos(f: Filtros): number {
  let n = 0;
  if (f.especie) n++;
  if (f.sexo) n++;
  if (f.raca) n++;
  if (f.cor) n++;
  if (f.finalidade) n++;
  if (f.terrenoId) n++;
  if (f.casa) n++;
  if (f.idade) n++;
  if (f.prenhe !== undefined) n++;
  if (f.semBrinco) n++;
  if (f.alerta) n++;
  // `incluirSaidos` e `texto` não contam: o primeiro ALARGA a lista em vez de
  // a estreitar, e o segundo já se vê escrito na própria caixa de pesquisa.
  return n;
}

/**
 * Aplica os filtros. `idsComAlerta` mapeia animal → categorias de alerta
 * pendentes, calculado uma vez pelo ecrã (ver `mapaAlertas`).
 */
export function filtrarAnimais(
  animais: Animal[],
  f: Filtros,
  idsComAlerta: Map<string, Set<Alerta['categoria']>>,
): Animal[] {
  const q = f.texto ? normalizar(f.texto) : '';

  return animais.filter((a) => {
    // O arquivo primeiro: sem esta guarda, um animal vendido passava por
    // qualquer outro filtro e voltava a aparecer no meio do efetivo.
    const saiu = !!a.estado && a.estado !== 'ativo';
    if (saiu && !f.incluirSaidos) return false;

    if (f.especie && a.especie !== f.especie) return false;
    if (f.sexo && a.sexo !== f.sexo) return false;
    if (f.finalidade && a.finalidade !== f.finalidade) return false;
    if (f.raca && normalizar(a.raca ?? '') !== normalizar(f.raca)) return false;
    if (f.cor && normalizar(a.corPelagem ?? '') !== normalizar(f.cor)) return false;
    if (f.casa && normalizar(a.casa ?? '') !== normalizar(f.casa)) return false;

    if (f.terrenoId) {
      if (f.terrenoId === SEM_TERRENO) {
        if (a.terrenoId) return false;
      } else if (a.terrenoId !== f.terrenoId) {
        return false;
      }
    }

    if (f.idade && faixaDe(a) !== f.idade) return false;
    if (f.semBrinco && a.numeroIdentificacao) return false;

    if (f.prenhe !== undefined) {
      // A prenhez só se aplica a fêmeas. Sem isto, "não cobertas" devolvia o
      // rebanho inteiro com os machos à mistura — tecnicamente verdade,
      // inútil na prática.
      if (a.sexo !== 'Fêmea') return false;
      if (!!a.dataPrevistaParto !== f.prenhe) return false;
    }

    if (f.alerta) {
      const categorias = idsComAlerta.get(a.id);
      if (!categorias) return false;
      if (f.alerta !== true && !categorias.has(f.alerta)) return false;
    }

    if (q) {
      const campos = [a.nome, a.numeroIdentificacao, a.raca, a.corPelagem, a.casa];
      if (!campos.some((c) => c && normalizar(c).includes(q))) return false;
    }

    return true;
  });
}

/** Animal → categorias de alerta pendentes. */
export function mapaAlertas(alertas: Alerta[]): Map<string, Set<Alerta['categoria']>> {
  const m = new Map<string, Set<Alerta['categoria']>>();
  for (const al of alertas) {
    if (!al.animalId) continue;
    const s = m.get(al.animalId) ?? new Set<Alerta['categoria']>();
    s.add(al.categoria);
    m.set(al.animalId, s);
  }
  return m;
}

/**
 * Valores que existem mesmo no efetivo, para as escolhas não oferecerem
 * filtros que não devolvem nada. Uma lista de vinte raças onde só três têm
 * animais é uma lista de dezassete becos sem saída.
 */
export function valoresPresentes(animais: Animal[]): {
  racas: string[];
  cores: string[];
  casas: string[];
  especies: Especie[];
  finalidades: Finalidade[];
} {
  const juntar = (f: (a: Animal) => string | undefined) => {
    const vistas = new Map<string, string>();
    for (const a of animais) {
      const v = f(a)?.trim();
      if (!v) continue;
      const k = normalizar(v);
      if (!vistas.has(k)) vistas.set(k, v);
    }
    return [...vistas.values()].sort((x, y) => x.localeCompare(y, 'pt'));
  };

  return {
    racas: juntar((a) => a.raca),
    cores: juntar((a) => a.corPelagem),
    casas: juntar((a) => a.casa),
    especies: juntar((a) => a.especie) as Especie[],
    finalidades: juntar((a) => a.finalidade) as Finalidade[],
  };
}

/** Rótulo curto de cada categoria de alerta, para os chips do filtro. */
export const rotuloCategoriaAlerta: Record<Alerta['categoria'], string> = {
  identificacao: 'Identificação',
  snira: 'SNIRA',
  parto: 'Partos',
  medicamento: 'Medicamentos',
  vacinacao: 'Vacinação',
};
