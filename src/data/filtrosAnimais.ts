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
import type { Alerta, AlertaGravidade, Animal, Especie, Finalidade, Sexo } from './types';

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
  // Idade negativa (relógio do aparelho desacertado, data vinda de fora) é a
  // única forma de não cair em faixa nenhuma. O recurso é a primeira faixa, não
  // a última: um animal recém-nascido classificado como "mais de 8 anos"
  // desaparecia do filtro onde o criador o ia procurar.
  if (meses < 0) return 'cria';
  // O limite superior é exclusivo; um animal de 24 meses certos é "adulto".
  const f = FAIXAS.find(({ meses: [de, ate] }) => meses >= de && meses < ate);
  return f?.valor ?? 'velho';
}

/** Valor especial para "animais sem terreno atribuído". */
export const SEM_TERRENO = '__sem-terreno__';

export type Filtros = {
  /**
   * Só os animais desta exploração. Ao contrário dos outros, este filtro está
   * SEMPRE à vista no ecrã (chips no topo da lista, não escondido na folha de
   * filtros): quem tem duas explorações passa o dia a alternar entre elas, e
   * isso não pode custar dois toques.
   */
  exploracaoId?: string;
  especie?: Especie;
  sexo?: Sexo;
  raca?: string;
  cor?: string;
  finalidade?: Finalidade;
  /** Id do terreno, ou `SEM_TERRENO`. */
  terrenoId?: string;
  idade?: FaixaIdade;
  /** true = cobertas (com parto previsto); false = não cobertas. */
  prenhe?: boolean;
  /** Só animais sem brinco — os que geram o alerta de identificação. */
  semBrinco?: boolean;
  /** `true` = com qualquer alerta; uma categoria = só alertas dessa. */
  alerta?: true | Alerta['categoria'];
  /** Mostrar também falecidos e vendidos. */
  incluirSaidos?: boolean;
  /** Pesquisa por nome, brinco, raça, pelagem ou número. */
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
  if (f.idade) n++;
  if (f.prenhe !== undefined) n++;
  if (f.semBrinco) n++;
  if (f.alerta) n++;
  // `incluirSaidos`, `texto` e `exploracaoId` não contam: o primeiro ALARGA a
  // lista em vez de a estreitar, e os outros dois já se veem no ecrã (a
  // pesquisa escrita na caixa, a exploração no chip aceso). Contá-los punha o
  // botão de filtros a anunciar "1" por causa de algo que está à vista.
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
    // Um animal ELIMINADO nunca aparece nesta lista, nem com o arquivo ligado.
    // O registo continua na base (histórico, genealogia, auditoria) mas quem
    // carregou em "Eliminar" pediu para não o voltar a ver aqui — devolvê-lo
    // com um chip de filtro fazia do gesto uma sugestão. Vê-se no ecrã
    // "Histórico do efetivo", que é onde ele passa a viver.
    if (a.estado === 'eliminado') return false;

    // O arquivo depois: sem esta guarda, um animal vendido passava por
    // qualquer outro filtro e voltava a aparecer no meio do efetivo.
    const saiu = !!a.estado && a.estado !== 'ativo';
    if (saiu && !f.incluirSaidos) return false;

    if (f.exploracaoId && a.exploracaoId !== f.exploracaoId) return false;
    if (f.especie && a.especie !== f.especie) return false;
    if (f.sexo && a.sexo !== f.sexo) return false;
    if (f.finalidade && a.finalidade !== f.finalidade) return false;
    if (f.raca && normalizar(a.raca ?? '') !== normalizar(f.raca)) return false;
    if (f.cor && normalizar(a.corPelagem ?? '') !== normalizar(f.cor)) return false;

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
      // O número do animal na exploração entra na pesquisa: quem numera o gado
      // procura-o por aí ("a 12"), e não pelos catorze dígitos do brinco.
      const campos = [a.nome, a.numeroIdentificacao, a.raca, a.corPelagem, a.numeroCasa];
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

/* ------------------------------------------------------------------ *
 *  Ordenação
 * ------------------------------------------------------------------ */

/**
 * Por que ordem a lista mostra os animais.
 *
 * Não há "registados há pouco": o `id` é um UUID aleatório (não conta o tempo)
 * e o animal só guarda `atualizadoEm`, que muda a cada edição — ordenar por ele
 * dava "mexidos há pouco", não "registados há pouco", e punha no topo o animal
 * que se acabou de corrigir em vez do que se acabou de criar. A idade é o eixo
 * de que o criador fala ("a bezerra nova", "a vaca velha"), e por isso é o que
 * fica.
 */
export type Ordenacao = 'nome' | 'alertas' | 'novos' | 'velhos';

export const ORDENACOES: { valor: Ordenacao; label: string }[] = [
  { valor: 'nome', label: 'Nome (A→Z)' },
  { valor: 'alertas', label: 'Com alertas primeiro' },
  { valor: 'novos', label: 'Mais novos' },
  { valor: 'velhos', label: 'Mais velhos' },
];

export const ORDENACAO_OMISSAO: Ordenacao = 'nome';

/** O texto por que se compara na ordem alfabética — nome, ou o brinco se não tiver. */
function chaveNome(a: Animal): string {
  return a.nome ?? a.numeroIdentificacao ?? '';
}

/**
 * O pior alerta de cada animal, como número (3 = urgente … 0 = nenhum). É isto
 * que põe o vencido acima do "esta semana" quando se ordena por alertas — a
 * mesma escala de gravidade do resto da app.
 */
export function mapaGravidade(alertas: Alerta[]): Map<string, number> {
  const rank: Record<AlertaGravidade, number> = { urgente: 3, aviso: 2, info: 1 };
  const m = new Map<string, number>();
  for (const al of alertas) {
    if (!al.animalId) continue;
    const r = rank[al.gravidade];
    if (r > (m.get(al.animalId) ?? 0)) m.set(al.animalId, r);
  }
  return m;
}

/**
 * Ordena SEM alterar o array recebido (`filtrarAnimais` já devolve um novo, mas
 * um `.sort()` por cima dele mutava-o na mesma, e o React Compiler não gosta).
 *
 * O nome é o critério de desempate de todas as ordens: dois animais com a mesma
 * idade, ou os dois sem alertas, saem por ordem alfabética — nunca numa ordem
 * que muda de render para render, que dá a sensação de a lista "saltar".
 */
export function ordenarAnimais(
  animais: Animal[],
  ordenacao: Ordenacao,
  gravidadePorAnimal: Map<string, number>,
): Animal[] {
  const porNome = (a: Animal, b: Animal) => chaveNome(a).localeCompare(chaveNome(b), 'pt');
  // Nascido antes = mais velho. Datas ISO comparam-se como texto, mas passar
  // por número trata as inválidas (NaN) sem as pôr no topo.
  const nasc = (a: Animal) => new Date(a.dataNascimento).getTime() || 0;

  const copia = [...animais];
  switch (ordenacao) {
    case 'alertas':
      return copia.sort((a, b) => {
        const ga = gravidadePorAnimal.get(a.id) ?? 0;
        const gb = gravidadePorAnimal.get(b.id) ?? 0;
        return gb - ga || porNome(a, b);
      });
    case 'novos':
      return copia.sort((a, b) => nasc(b) - nasc(a) || porNome(a, b));
    case 'velhos':
      return copia.sort((a, b) => nasc(a) - nasc(b) || porNome(a, b));
    default:
      return copia.sort(porNome);
  }
}

/** Valores distintos de um campo, sem repetir e por ordem alfabética. */
function juntar(animais: Animal[], f: (a: Animal) => string | undefined): string[] {
  const vistas = new Map<string, string>();
  for (const a of animais) {
    const v = f(a)?.trim();
    if (!v) continue;
    const k = normalizar(v);
    if (!vistas.has(k)) vistas.set(k, v);
  }
  return [...vistas.values()].sort((x, y) => x.localeCompare(y, 'pt'));
}

/** O que cada grupo de filtros ainda tem para oferecer. */
export type Facetas = {
  especies: Especie[];
  sexos: Sexo[];
  racas: string[];
  cores: string[];
  finalidades: Finalidade[];
  /** Ids de terreno, mais `SEM_TERRENO` se houver animais soltos. */
  terrenoIds: string[];
  idades: FaixaIdade[];
  /** Quais das duas hipóteses de cobrição ainda devolvem fêmeas. */
  prenhez: boolean[];
  semBrinco: boolean;
  categoriasAlerta: Alerta['categoria'][];
  /** Quantos animais do arquivo passariam nos filtros atuais. */
  nSaidos: number;
};

/** Junta o valor já escolhido, para nunca ficar um filtro que não se desliga. */
function comEscolhido<T>(valores: T[], escolhido: T | undefined): T[] {
  if (escolhido === undefined || valores.includes(escolhido)) return valores;
  return [...valores, escolhido];
}

/**
 * As opções de cada grupo, calculadas sobre os OUTROS filtros ativos.
 *
 * Um filtro que não devolve nada é pior do que inútil: numa exploração só de
 * bovinos machos, oferecer "Fêmeas" é prometer animais que não existem, e quem
 * lá toca fica com uma lista vazia sem perceber o que fez de errado. Por isso
 * cada grupo mostra só o que ainda dá resultado — escolher "Bovinos" faz o
 * "Fêmeas" desaparecer se nenhum bovino for fêmea.
 *
 * Cada grupo é calculado com o SEU próprio filtro de fora ("faceting excluding
 * self"). Sem isso, escolher "Fêmeas" apagava o chip "Machos" — a lista já só
 * tem fêmeas — e trancava o criador na escolha que acabou de fazer, sem forma
 * de a trocar sem primeiro a limpar.
 */
export function facetasDisponiveis(
  animais: Animal[],
  f: Filtros,
  idsComAlerta: Map<string, Set<Alerta['categoria']>>,
): Facetas {
  /** O efetivo que sobra ignorando um dos filtros. */
  const sem = (chave: keyof Filtros) =>
    filtrarAnimais(animais, { ...f, [chave]: undefined }, idsComAlerta);

  const porEspecie = sem('especie');
  const porSexo = sem('sexo');
  const porRaca = sem('raca');
  const porCor = sem('cor');
  const porFinalidade = sem('finalidade');
  const porTerreno = sem('terrenoId');
  const porIdade = sem('idade');
  const porPrenhe = sem('prenhe');
  const porBrinco = sem('semBrinco');
  const porAlerta = sem('alerta');

  const categorias = new Set<Alerta['categoria']>();
  for (const a of porAlerta) {
    for (const c of idsComAlerta.get(a.id) ?? []) categorias.add(c);
  }

  // O arquivo é o único que ALARGA a lista: conta-se quantos animais saídos
  // entrariam se fosse ligado, para o chip não prometer um número que os
  // outros filtros já excluíram.
  const saidos = filtrarAnimais(animais, { ...f, incluirSaidos: true }, idsComAlerta).filter(
    (a) => !!a.estado && a.estado !== 'ativo',
  );

  return {
    especies: comEscolhido(juntar(porEspecie, (a) => a.especie) as Especie[], f.especie),
    sexos: comEscolhido(juntar(porSexo, (a) => a.sexo) as Sexo[], f.sexo),
    racas: comEscolhido(juntar(porRaca, (a) => a.raca), f.raca),
    cores: comEscolhido(juntar(porCor, (a) => a.corPelagem), f.cor),
    finalidades: comEscolhido(
      juntar(porFinalidade, (a) => a.finalidade) as Finalidade[],
      f.finalidade,
    ),
    terrenoIds: comEscolhido(
      [
        ...new Set(porTerreno.map((a) => a.terrenoId ?? SEM_TERRENO)),
      ],
      f.terrenoId,
    ),
    idades: comEscolhido([...new Set(porIdade.map(faixaDe))], f.idade),
    prenhez: comEscolhido(
      [true, false].filter((p) =>
        porPrenhe.some((a) => a.sexo === 'Fêmea' && !!a.dataPrevistaParto === p),
      ),
      f.prenhe,
    ),
    semBrinco: f.semBrinco || porBrinco.some((a) => !a.numeroIdentificacao),
    categoriasAlerta: comEscolhido(
      [...categorias].sort(),
      f.alerta === true ? undefined : f.alerta,
    ),
    nSaidos: saidos.length,
  };
}

/** Rótulo curto de cada categoria de alerta, para os chips do filtro. */
export const rotuloCategoriaAlerta: Record<Alerta['categoria'], string> = {
  identificacao: 'Identificação',
  snira: 'SNIRA',
  parto: 'Partos',
  reproducao: 'Reprodução',
  medicamento: 'Medicamentos',
  vacinacao: 'Vacinação',
  // Nunca aparece nos chips: os alertas de existências não têm animal, por isso
  // não entram no `mapaAlertas` e nenhum animal os traz. Fica aqui porque o
  // `Record` os pede todos, e porque uma entrada em falta é um erro de
  // compilação no dia em que alguém os ligar a um animal.
  existencias: 'Existências',
};
