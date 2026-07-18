/**
 * Gestão económica — deriva receitas, despesas e saldo a partir dos
 * eventos que carregam um `valor` (€). Nada é persistido aqui: os valores
 * já vivem nos próprios eventos (ver `types.ts`), este módulo só agrega.
 *
 * Convenção de sentido do dinheiro (o `valor` guardado é sempre positivo):
 *   - Venda ....................... receita (entra)
 *   - Compra / Vacinação / Medicamento  despesa (sai)
 *   - restantes tipos ............. sem impacto financeiro
 */

import { formatEuro } from './helpers';
import type { Animal, Evento, EventoTipo } from './types';

export type Direcao = 'receita' | 'despesa';

/** Categorias de dinheiro apresentadas no resumo. */
export type CategoriaFinanceira = 'Vendas' | 'Compras' | 'Vacinação' | 'Medicamentos';

const DIRECAO: Partial<Record<EventoTipo, Direcao>> = {
  Venda: 'receita',
  Compra: 'despesa',
  Vacinação: 'despesa',
  Medicamento: 'despesa',
};

const CATEGORIA: Partial<Record<EventoTipo, CategoriaFinanceira>> = {
  Venda: 'Vendas',
  Compra: 'Compras',
  Vacinação: 'Vacinação',
  Medicamento: 'Medicamentos',
};

/** Sentido financeiro de um evento (ou `undefined` se não mexe em dinheiro). */
export function direcaoDoEvento(tipo: EventoTipo): Direcao | undefined {
  return DIRECAO[tipo];
}

/** Um evento conta para as finanças? (tem sentido financeiro e um valor > 0) */
export function eventoTemValor(e: Evento): boolean {
  return direcaoDoEvento(e.tipo) !== undefined && typeof e.valor === 'number' && e.valor > 0;
}

export interface LinhaCategoria {
  categoria: CategoriaFinanceira;
  direcao: Direcao;
  total: number;
  contagem: number;
}

export interface ResumoFinanceiro {
  receitas: number;
  despesas: number;
  /** receitas − despesas (pode ser negativo). */
  saldo: number;
  categorias: LinhaCategoria[];
  /** Eventos com valor, mais recentes primeiro. */
  movimentos: Evento[];
}

/**
 * Constrói o resumo financeiro sobre um conjunto de eventos. Se
 * `animaisDaExploracao` for passado, considera apenas os eventos dos animais
 * dessa exploração (os eventos não guardam a exploração diretamente).
 */
export function resumoFinanceiro(
  eventos: Evento[],
  animaisDaExploracao?: Animal[],
): ResumoFinanceiro {
  const permitidos = animaisDaExploracao
    ? new Set(animaisDaExploracao.map((a) => a.id))
    : undefined;

  const relevantes = eventos.filter(
    (e) => eventoTemValor(e) && (!permitidos || permitidos.has(e.animalId)),
  );

  let receitas = 0;
  let despesas = 0;
  const porCategoria = new Map<CategoriaFinanceira, LinhaCategoria>();

  for (const e of relevantes) {
    const direcao = direcaoDoEvento(e.tipo)!;
    const categoria = CATEGORIA[e.tipo]!;
    const valor = e.valor!;

    if (direcao === 'receita') receitas += valor;
    else despesas += valor;

    const linha = porCategoria.get(categoria) ?? {
      categoria,
      direcao,
      total: 0,
      contagem: 0,
    };
    linha.total += valor;
    linha.contagem += 1;
    porCategoria.set(categoria, linha);
  }

  const ordemCat: CategoriaFinanceira[] = ['Vendas', 'Compras', 'Vacinação', 'Medicamentos'];
  const categorias = ordemCat
    .map((c) => porCategoria.get(c))
    .filter((l): l is LinhaCategoria => l !== undefined);

  const movimentos = [...relevantes].sort((a, b) => b.data.localeCompare(a.data));

  return { receitas, despesas, saldo: receitas - despesas, categorias, movimentos };
}

export interface BalancoAnimal {
  /** Total gasto com o animal (compra, vacinas, medicamentos). */
  custos: number;
  /** Total recebido (venda). */
  receita: number;
  /** receita − custos. */
  resultado: number;
  /** Há pelo menos um movimento com valor? */
  temDados: boolean;
}

/** Balanço económico de um único animal a partir dos seus eventos. */
export function balancoAnimal(eventosDoAnimal: Evento[]): BalancoAnimal {
  let custos = 0;
  let receita = 0;
  let temDados = false;
  for (const e of eventosDoAnimal) {
    if (!eventoTemValor(e)) continue;
    temDados = true;
    if (direcaoDoEvento(e.tipo) === 'receita') receita += e.valor!;
    else custos += e.valor!;
  }
  return { custos, receita, resultado: receita - custos, temDados };
}

/** Rótulo curto e com sinal para um movimento (ex.: `+1 350 €`, `−45 €`). */
export function rotuloMovimento(e: Evento): string {
  if (!eventoTemValor(e)) return '';
  const sinal = direcaoDoEvento(e.tipo) === 'receita' ? '+' : '−';
  return `${sinal}${formatEuro(e.valor!, 0)}`;
}
