/**
 * Gestão económica — junta as duas origens de dinheiro numa só conta.
 * ------------------------------------------------------------------
 * Lógica pura (sem React, sem rede) para poder ser testada.
 *
 * As finanças de uma exploração vêm de dois sítios, e é preciso somar os dois
 * para o saldo não mentir:
 *
 *   1. EVENTOS com custo (`Evento.valor`) — o que se gastou COM UM ANIMAL:
 *      a compra, a vacina, o medicamento. São sempre despesas.
 *   2. MOVIMENTOS (`Movimento`) — tudo o resto: a ração, a eletricidade, o
 *      gasóleo, as rendas, e TODAS as receitas (vendas, leite, subsídios).
 *
 * Porquê separado: a fatura da luz não tem animal, e durante muito tempo esta
 * app só sabia contar dinheiro preso a um animal. Numa exploração de gado a
 * alimentação costuma ser o maior custo de todos — sem a origem 2, o ecrã
 * mostrava um saldo positivo a quem estava a perder dinheiro.
 *
 * O preço de VENDA vive no movimento, nunca no evento: é receita, e receitas
 * são só do dono (ver `permissoes.ts`). Uma coluna de tabela não se esconde a
 * uns membros e não a outros.
 */

import { formatEuro } from './helpers';
import type {
  Animal,
  CategoriaDespesa,
  CategoriaMovimento,
  Direcao,
  Evento,
  EventoTipo,
  Movimento,
} from './types';

export type { Direcao };

/**
 * Custo que cada tipo de evento representa. Um tipo fora deste mapa não mexe
 * em dinheiro (uma pesagem não custa nada), e `Venda` também não está cá — o
 * que se recebeu por ela é um movimento.
 */
const CATEGORIA_EVENTO: Partial<Record<EventoTipo, CategoriaDespesa>> = {
  Compra: 'Compra de animais',
  Vacinação: 'Sanidade',
  Medicamento: 'Sanidade',
};

/** Categoria de despesa de um evento, ou `undefined` se não mexe em dinheiro. */
export function categoriaDoEvento(tipo: EventoTipo): CategoriaDespesa | undefined {
  return CATEGORIA_EVENTO[tipo];
}

/** Sentido financeiro de um evento. Um evento com custo é sempre despesa. */
export function direcaoDoEvento(tipo: EventoTipo): Direcao | undefined {
  return categoriaDoEvento(tipo) ? 'despesa' : undefined;
}

/** Um evento conta para as finanças? (tem custo possível e um valor > 0) */
export function eventoTemValor(e: Evento): boolean {
  return (
    categoriaDoEvento(e.tipo) !== undefined && typeof e.valor === 'number' && e.valor > 0
  );
}

/* ------------------------------------------------------------------ *
 *  Lançamento — a forma normalizada em que tudo é contado
 * ------------------------------------------------------------------ */

/**
 * Uma linha de dinheiro, venha ela de um evento ou de um movimento. Existe
 * para o resto do módulo (e os dashboards) trabalharem sobre uma lista só, em
 * vez de repetirem a soma das duas origens em cada função.
 */
export interface Lancamento {
  id: string;
  data: string; // ISO
  direcao: Direcao;
  categoria: CategoriaMovimento;
  /** Euros, sempre positivo. O sinal vem da `direcao`. */
  valor: number;
  descricao: string;
  animalId?: string;
  origem: 'evento' | 'movimento';
}

/** Restringir a uma exploração: `animais` é o efetivo TODO, para se saber
 * quais dos eventos lhe pertencem (um evento só conhece o animal). */
export type FiltroExploracao = { exploracaoId: string; animais: Animal[] };

/**
 * Restringir a um CONJUNTO de explorações.
 *
 * Existe por causa do "Todas" do ecrã Finanças, que não quer dizer "tudo o que
 * está na app": quer dizer tudo aquilo cujas contas esta pessoa pode consultar.
 * Consultar contas é do dono (ver `permissoes.ts`), e quem é dono de uma
 * exploração e trabalhador de outra via as duas somadas no mesmo saldo — os
 * eventos com custo não são filtrados por papel, ao contrário dos movimentos.
 * Dois negócios num número só não são as contas de nenhum dos dois.
 *
 * Uma lista VAZIA não conta nada, e é de propósito: é a resposta certa a quem
 * não pode ver contas nenhumas.
 */
export type FiltroExploracoes = { exploracaoIds: string[]; animais: Animal[] };

/** Um dos dois: uma exploração, ou um conjunto delas. */
export type Filtro = FiltroExploracao | FiltroExploracoes;

/** As explorações que o filtro deixa passar, seja ele de uma ou de várias. */
function idsDoFiltro(filtro: Filtro): Set<string> {
  return new Set('exploracaoIds' in filtro ? filtro.exploracaoIds : [filtro.exploracaoId]);
}

/** Os animais que pertencem às explorações do filtro (um evento só sabe o animal). */
function animaisDoFiltro(filtro: Filtro): Set<string> {
  const ids = idsDoFiltro(filtro);
  return new Set(filtro.animais.filter((a) => ids.has(a.exploracaoId)).map((a) => a.id));
}

/**
 * Converte eventos e movimentos numa lista única, do mais recente para o mais
 * antigo. Sem `filtro`, conta tudo o que lhe for dado.
 */
export function lancamentos(
  eventos: Evento[],
  movimentos: Movimento[],
  filtro?: Filtro,
): Lancamento[] {
  // Nota: quando há filtro, estes conjuntos podem legitimamente ser vazios (uma
  // exploração ainda sem animais). Por isso a decisão é "há filtro?", nunca
  // "o conjunto tem elementos?" — a segunda deixava passar os eventos todos.
  const exploracoes = filtro ? idsDoFiltro(filtro) : undefined;
  const permitidos = filtro ? animaisDoFiltro(filtro) : undefined;

  const deEventos: Lancamento[] = eventos
    .filter((e) => eventoTemValor(e) && (!permitidos || permitidos.has(e.animalId)))
    .map((e) => ({
      id: e.id,
      data: e.data,
      direcao: 'despesa' as const,
      categoria: categoriaDoEvento(e.tipo)!,
      valor: e.valor!,
      descricao: e.descricao,
      animalId: e.animalId,
      origem: 'evento' as const,
    }));

  // Um movimento já sabe a que exploração pertence — a fatura da luz não tem
  // animal nenhum e continua a ser custo da exploração.
  const deMovimentos: Lancamento[] = movimentos
    .filter((m) => !exploracoes || exploracoes.has(m.exploracaoId))
    .map((m) => ({
      id: m.id,
      data: m.data,
      direcao: m.direcao,
      categoria: m.categoria,
      valor: m.valor,
      descricao: m.descricao,
      animalId: m.animalId,
      origem: 'movimento' as const,
    }));

  return [...deEventos, ...deMovimentos].sort((a, b) => b.data.localeCompare(a.data));
}

/* ------------------------------------------------------------------ *
 *  Períodos
 * ------------------------------------------------------------------ */

export type Periodo = 'mes' | 'ano' | 'tudo';

export const PERIODOS: { valor: Periodo; label: string }[] = [
  { valor: 'mes', label: 'Este mês' },
  { valor: 'ano', label: 'Este ano' },
  { valor: 'tudo', label: 'Tudo' },
];

/** Chave `aaaa-mm` de uma data, em hora local (a mesma que o ecrã mostra). */
export function chaveMes(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Intervalo [inicio, fim[ de um período, a contar de `agora`. */
export function intervalo(periodo: Periodo, agora = new Date()): { de: Date; ate: Date } {
  if (periodo === 'mes') {
    return {
      de: new Date(agora.getFullYear(), agora.getMonth(), 1),
      ate: new Date(agora.getFullYear(), agora.getMonth() + 1, 1),
    };
  }
  if (periodo === 'ano') {
    return {
      de: new Date(agora.getFullYear(), 0, 1),
      ate: new Date(agora.getFullYear() + 1, 0, 1),
    };
  }
  return { de: new Date(0), ate: new Date(8.64e15) };
}

/** O mesmo período, deslocado uma casa para trás (mês ou ano anterior). */
export function intervaloAnterior(
  periodo: Periodo,
  agora = new Date(),
): { de: Date; ate: Date } {
  if (periodo === 'mes') {
    return intervalo('mes', new Date(agora.getFullYear(), agora.getMonth() - 1, 1));
  }
  if (periodo === 'ano') {
    return intervalo('ano', new Date(agora.getFullYear() - 1, 0, 1));
  }
  return { de: new Date(0), ate: new Date(0) }; // "tudo" não tem anterior
}

function dentro(l: Lancamento, de: Date, ate: Date): boolean {
  const t = new Date(l.data).getTime();
  return t >= de.getTime() && t < ate.getTime();
}

/** Filtra lançamentos por período. */
export function noPeriodo(
  lista: Lancamento[],
  periodo: Periodo,
  agora = new Date(),
): Lancamento[] {
  if (periodo === 'tudo') return lista;
  const { de, ate } = intervalo(periodo, agora);
  return lista.filter((l) => dentro(l, de, ate));
}

/* ------------------------------------------------------------------ *
 *  Resumo
 * ------------------------------------------------------------------ */

export interface LinhaCategoria {
  categoria: CategoriaMovimento;
  direcao: Direcao;
  total: number;
  contagem: number;
  /** Fatia desta categoria no total do seu sentido (0–100). */
  percentagem: number;
}

export interface ResumoFinanceiro {
  receitas: number;
  despesas: number;
  /** receitas − despesas (pode ser negativo). */
  saldo: number;
  /** Despesas por categoria, da maior para a menor. */
  categoriasDespesa: LinhaCategoria[];
  /** Receitas por categoria, da maior para a menor. */
  categoriasReceita: LinhaCategoria[];
  /** Todos os lançamentos considerados, mais recentes primeiro. */
  movimentos: Lancamento[];
}

/** Soma um conjunto de lançamentos já filtrado. */
export function resumo(lista: Lancamento[]): ResumoFinanceiro {
  let receitas = 0;
  let despesas = 0;
  const porCategoria = new Map<CategoriaMovimento, LinhaCategoria>();

  for (const l of lista) {
    if (l.direcao === 'receita') receitas += l.valor;
    else despesas += l.valor;

    const linha = porCategoria.get(l.categoria) ?? {
      categoria: l.categoria,
      direcao: l.direcao,
      total: 0,
      contagem: 0,
      percentagem: 0,
    };
    linha.total += l.valor;
    linha.contagem += 1;
    porCategoria.set(l.categoria, linha);
  }

  const ordenar = (direcao: Direcao, total: number) =>
    [...porCategoria.values()]
      .filter((l) => l.direcao === direcao)
      .map((l) => ({ ...l, percentagem: total > 0 ? (l.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

  return {
    receitas,
    despesas,
    saldo: receitas - despesas,
    categoriasDespesa: ordenar('despesa', despesas),
    categoriasReceita: ordenar('receita', receitas),
    movimentos: lista,
  };
}

/**
 * Resumo financeiro completo a partir das duas origens. Atalho para
 * `resumo(noPeriodo(lancamentos(...)))`, que é a sequência usada em todo o lado.
 */
export function resumoFinanceiro(
  eventos: Evento[],
  movimentos: Movimento[] = [],
  opcoes?: { filtro?: Filtro; periodo?: Periodo; agora?: Date },
): ResumoFinanceiro {
  const lista = lancamentos(eventos, movimentos, opcoes?.filtro);
  return resumo(noPeriodo(lista, opcoes?.periodo ?? 'tudo', opcoes?.agora));
}

/* ------------------------------------------------------------------ *
 *  Evolução mensal
 * ------------------------------------------------------------------ */

export interface BarraMes {
  /** `aaaa-mm`. */
  chave: string;
  /** Rótulo curto para o eixo (`Jul`). */
  rotulo: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

const MESES_CURTOS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/**
 * O mês por extenso, a partir da chave `aaaa-mm`: "Julho de 2026".
 *
 * O ano vai sempre: seis meses atravessam a passagem de ano (Nov, Dez, Jan…) e
 * "Dezembro" sozinho, num gráfico ao lado de "Janeiro", não diz de que ano é.
 */
export function nomeMes(chave: string): string {
  const [ano, mes] = chave.split('-');
  const nome = MESES_LONGOS[Number(mes) - 1];
  if (!nome || !ano) return chave;
  return `${nome} de ${ano}`;
}

/**
 * Últimos `n` meses (incluindo o atual), do mais antigo para o mais recente.
 * Meses sem movimento vêm a zero de propósito: um buraco no gráfico esconde
 * que naquele mês não se registou nada, que é informação.
 */
export function serieMensal(
  lista: Lancamento[],
  n = 6,
  agora = new Date(),
): BarraMes[] {
  const meses: BarraMes[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({
      chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      rotulo: MESES_CURTOS[d.getMonth()],
      receitas: 0,
      despesas: 0,
      saldo: 0,
    });
  }
  const porChave = new Map(meses.map((m) => [m.chave, m]));

  for (const l of lista) {
    const m = porChave.get(chaveMes(l.data));
    if (!m) continue;
    if (l.direcao === 'receita') m.receitas += l.valor;
    else m.despesas += l.valor;
  }
  for (const m of meses) m.saldo = m.receitas - m.despesas;
  return meses;
}

/* ------------------------------------------------------------------ *
 *  Comparação com o período anterior
 * ------------------------------------------------------------------ */

export interface Comparacao {
  receitas: number;
  despesas: number;
  receitasAntes: number;
  despesasAntes: number;
  /** Variação das despesas em %, ou `undefined` se antes não houve nada. */
  variacaoDespesas?: number;
  /** Variação das receitas em %, ou `undefined` se antes não houve nada. */
  variacaoReceitas?: number;
  /** Há período anterior com que comparar? (não há para o período "tudo") */
  disponivel: boolean;
}

/** Variação percentual; `undefined` quando a base é zero (não há % de nada). */
function variacao(agora: number, antes: number): number | undefined {
  if (antes === 0) return undefined;
  return ((agora - antes) / antes) * 100;
}

export function compararComAnterior(
  lista: Lancamento[],
  periodo: Periodo,
  agora = new Date(),
): Comparacao {
  const atual = resumo(noPeriodo(lista, periodo, agora));
  if (periodo === 'tudo') {
    return {
      receitas: atual.receitas,
      despesas: atual.despesas,
      receitasAntes: 0,
      despesasAntes: 0,
      disponivel: false,
    };
  }
  const { de, ate } = intervaloAnterior(periodo, agora);
  const antes = resumo(lista.filter((l) => dentro(l, de, ate)));
  return {
    receitas: atual.receitas,
    despesas: atual.despesas,
    receitasAntes: antes.receitas,
    despesasAntes: antes.despesas,
    variacaoDespesas: variacao(atual.despesas, antes.despesas),
    variacaoReceitas: variacao(atual.receitas, antes.receitas),
    disponivel: true,
  };
}

/* ------------------------------------------------------------------ *
 *  Por animal
 * ------------------------------------------------------------------ */

export interface BalancoAnimal {
  /** Total gasto com o animal (compra, vacinas, medicamentos, custos imputados). */
  custos: number;
  /** Total recebido (venda). */
  receita: number;
  /** receita − custos. */
  resultado: number;
  /** Há pelo menos um movimento com valor? */
  temDados: boolean;
}

/**
 * Balanço económico de um animal. Recebe os eventos DELE e (opcionalmente) os
 * movimentos que lhe foram imputados — a venda é um deles, por isso sem a
 * segunda lista um animal vendido parece dar sempre prejuízo.
 */
export function balancoAnimal(
  eventosDoAnimal: Evento[],
  movimentosDoAnimal: Movimento[] = [],
): BalancoAnimal {
  let custos = 0;
  let receita = 0;
  let temDados = false;

  for (const e of eventosDoAnimal) {
    if (!eventoTemValor(e)) continue;
    temDados = true;
    custos += e.valor!;
  }
  for (const m of movimentosDoAnimal) {
    temDados = true;
    if (m.direcao === 'receita') receita += m.valor;
    else custos += m.valor;
  }
  return { custos, receita, resultado: receita - custos, temDados };
}

export interface LinhaAnimal {
  animalId: string;
  custos: number;
  receita: number;
  resultado: number;
}

/**
 * Custo e resultado por animal, do que mais custou para o que menos custou.
 * Só entram animais com dinheiro associado — listar o efetivo todo a zeros
 * enterrava os poucos que interessam.
 */
export function porAnimal(lista: Lancamento[]): LinhaAnimal[] {
  const mapa = new Map<string, LinhaAnimal>();
  for (const l of lista) {
    if (!l.animalId) continue;
    const linha = mapa.get(l.animalId) ?? {
      animalId: l.animalId,
      custos: 0,
      receita: 0,
      resultado: 0,
    };
    if (l.direcao === 'receita') linha.receita += l.valor;
    else linha.custos += l.valor;
    mapa.set(l.animalId, linha);
  }
  return [...mapa.values()]
    .map((l) => ({ ...l, resultado: l.receita - l.custos }))
    .sort((a, b) => b.custos - a.custos);
}

/* ------------------------------------------------------------------ *
 *  Vendas por fechar
 * ------------------------------------------------------------------ */

/**
 * Vendas registadas sem preço. Acontece por desenho: o trabalhador que carrega
 * o animal para o camião regista a saída, mas não pode lançar receitas — o
 * preço fica para o dono. Sem esta lista, essas vendas ficavam invisíveis e as
 * receitas apareciam em baixo sem ninguém perceber porquê.
 *
 * O que fecha uma venda é uma receita de "Venda de animais", não qualquer
 * receita imputada ao animal: uma entrega de leite lançada na vaca dava a venda
 * dela por fechada, e o preço ficava a faltar sem aparecer em lado nenhum.
 *
 * `filtro` restringe às explorações que se está a ver (ver `Filtro`). Sem ele
 * conta tudo o que lhe for dado — que era o comportamento antigo, e punha o
 * cartão de aviso a falar de uma venda de outra quinta.
 */
export function vendasSemPreco(
  eventos: Evento[],
  movimentos: Movimento[],
  filtro?: Filtro,
): Evento[] {
  const permitidos = filtro ? animaisDoFiltro(filtro) : undefined;
  const comPreco = new Set(
    movimentos
      .filter((m) => m.direcao === 'receita' && m.categoria === 'Venda de animais' && m.animalId)
      .map((m) => m.animalId as string),
  );
  return eventos
    .filter(
      (e) =>
        e.tipo === 'Venda'
        && !comPreco.has(e.animalId)
        && (!permitidos || permitidos.has(e.animalId)),
    )
    .sort((a, b) => b.data.localeCompare(a.data));
}

/* ------------------------------------------------------------------ *
 *  Histórico de registos (auditoria)
 * ------------------------------------------------------------------ */

/**
 * Os movimentos por ordem de REGISTO, do mais recente para o mais antigo.
 *
 * É uma lista diferente da dos Movimentos, e de propósito. Aquela responde a
 * "o que se passou nas contas" e ordena-se pela data do lançamento — a data da
 * fatura, escrita à mão. Esta responde a "quem esteve a mexer nisto, e
 * quando", e por isso ordena-se pelo instante em que a linha entrou na app
 * (`criadoEm`, do servidor). Uma despesa de janeiro lançada hoje aparece no
 * fundo de uma e no topo da outra.
 *
 * Só movimentos: os eventos com custo não guardam autor nem instante de
 * registo, e inventar-lhes um punha metade da auditoria a mentir. Ficam de
 * fora, e o ecrã di-lo.
 */
export function porOrdemDeRegisto(
  movimentos: Movimento[],
  exploracaoIds?: string[],
): Movimento[] {
  const ids = exploracaoIds ? new Set(exploracaoIds) : undefined;
  return movimentos
    .filter((m) => !ids || ids.has(m.exploracaoId))
    .slice()
    .sort((a, b) => {
      // Sem `criadoEm` (registos anteriores à coluna, ou ainda por sincronizar)
      // vale a data do lançamento: é a melhor aproximação que existe, e deixá-los
      // cair para o fim por ordem aleatória parecia lista corrompida.
      const ax = a.criadoEm ?? a.data;
      const bx = b.criadoEm ?? b.data;
      return bx.localeCompare(ax) || a.descricao.localeCompare(b.descricao, 'pt');
    });
}

/* ------------------------------------------------------------------ *
 *  Rótulos
 * ------------------------------------------------------------------ */

/** Rótulo curto e com sinal para um lançamento (ex.: `+1 350 €`, `−45 €`). */
export function rotuloMovimento(l: Pick<Lancamento, 'direcao' | 'valor'>): string {
  return `${l.direcao === 'receita' ? '+' : '−'}${formatEuro(l.valor, 0)}`;
}
