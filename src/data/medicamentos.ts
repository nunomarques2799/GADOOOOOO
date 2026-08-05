/**
 * Existências — quanto resta de cada lote e o que já não se pode usar.
 * ------------------------------------------------------------------
 * Lógica pura, sem React e sem rede, para poder ser testada.
 *
 * O QUE RESTA NÃO ESTÁ GUARDADO. Calcula-se: a quantidade que o frasco trazia
 * menos a soma do que os eventos gastaram dele. Uma coluna a descontar teria de
 * ser mantida certa a partir de dois aparelhos que podem estar offline, e a
 * primeira gravação perdida deixava-a errada para sempre, sem ninguém saber a
 * partir de quando. Calculada, é sempre igual à soma dos registos — que é a
 * única definição de "quanto resta" que se defende à frente de um inspetor.
 */

import { PrazosExistencias } from './constants';
import { diaIso, diasAte } from './helpers';
import type { Evento, Medicamento } from './types';

export type EstadoLote = {
  medicamento: Medicamento;
  /** Soma do que os eventos gastaram deste lote. */
  usado: number;
  /** O que resta. Nunca negativo no ecrã — ver a nota em `estadoDoLote`. */
  resta: number;
  /** Entre 0 e 1. Serve o aviso de "está a acabar". */
  fracaoRestante: number;
  esgotado: boolean;
  quaseVazio: boolean;
  /** Ausente quando o lote não tem validade escrita. */
  diasParaValidade?: number;
  expirado: boolean;
  aExpirar: boolean;
  /** Dá para usar hoje? É o que decide se aparece na lista do tratamento. */
  disponivel: boolean;
};

/**
 * O estado de um lote, sabido já quanto se gastou dele.
 *
 * `resta` fica em zero e não negativo quando se registou mais do que o frasco
 * trazia. Isso acontece — alguém escreve 200 ml em vez de 20 — e mostrar "−180
 * ml" no ecrã não ajuda ninguém a perceber que se enganou a escrever. A conta
 * real fica em `usado`, que é onde se vê o disparate.
 */
function montar(m: Medicamento, usado: number): EstadoLote {
  const resta = Math.max(0, m.quantidade - usado);
  const fracaoRestante = m.quantidade > 0 ? resta / m.quantidade : 0;

  const diasParaValidade = m.validade ? diasAte(m.validade) : undefined;
  // `< 0` e não `<= 0`: um medicamento válido "até 31 de agosto" pode ser usado
  // no dia 31. É a leitura da bula, e a diferença é um dia inteiro de trabalho
  // a dizer que o frasco está estragado quando não está.
  const expirado = diasParaValidade != null && diasParaValidade < 0;
  const esgotado = resta <= 0;

  return {
    medicamento: m,
    usado,
    resta,
    fracaoRestante,
    esgotado,
    quaseVazio: !esgotado && fracaoRestante <= PrazosExistencias.fracaoQuaseVazio,
    diasParaValidade,
    expirado,
    aExpirar:
      !expirado &&
      diasParaValidade != null &&
      diasParaValidade <= PrazosExistencias.avisoValidadeDias,
    disponivel: !esgotado && !expirado,
  };
}

/** O estado de um lote, dados os eventos que saíram dele. */
export function estadoDoLote(m: Medicamento, eventos: Evento[]): EstadoLote {
  return montar(
    m,
    eventos.reduce(
      (soma, e) => (e.medicamentoId === m.id && e.quantidade ? soma + e.quantidade : soma),
      0,
    ),
  );
}

/**
 * Todos os lotes de uma exploração, já com o estado, pela ordem em que
 * interessam: primeiro o que se pode usar, e dentro disso o que expira antes —
 * porque é esse que se deve gastar a seguir. O que já não serve fica no fim.
 */
export function lotesComEstado(
  medicamentos: Medicamento[],
  eventos: Evento[],
): EstadoLote[] {
  // Um só varrimento dos eventos, e não um por lote: numa exploração com anos
  // de histórico e vinte frascos, a diferença é vinte passagens por uma lista
  // de milhares de linhas.
  const usadoPorLote = new Map<string, number>();
  for (const e of eventos) {
    if (!e.medicamentoId || !e.quantidade) continue;
    usadoPorLote.set(e.medicamentoId, (usadoPorLote.get(e.medicamentoId) ?? 0) + e.quantidade);
  }

  return medicamentos
    .map((m) => montar(m, usadoPorLote.get(m.id) ?? 0))
    .sort((a, b) => {
      if (a.disponivel !== b.disponivel) return a.disponivel ? -1 : 1;
      // Sem validade escrita vai para o fim dos disponíveis: não há por onde
      // decidir que se gaste primeiro, e à frente dos que expiram escondia-os.
      const va = a.diasParaValidade ?? Number.POSITIVE_INFINITY;
      const vb = b.diasParaValidade ?? Number.POSITIVE_INFINITY;
      if (va !== vb) return va - vb;
      return a.medicamento.nome.localeCompare(b.medicamento.nome, 'pt');
    });
}

/**
 * Os lotes que se podem escolher para um tratamento agora: os desta
 * exploração, do tipo certo, com stock e dentro da validade.
 *
 * O expirado NÃO aparece de propósito. Podia aparecer a vermelho, com um aviso
 * — mas a lista do tratamento é usada com o animal preso no tronco e o telemóvel
 * numa mão, e é ali que se escolhe o que está mais à mão em vez de se ler. Quem
 * precisa mesmo de registar um tratamento de um lote fora de validade (porque
 * aconteceu, e o registo tem de dizer a verdade) corrige a validade no ecrã das
 * existências, que é onde essa decisão deve ser tomada de olhos abertos.
 */
export function lotesUtilizaveis(
  medicamentos: Medicamento[],
  eventos: Evento[],
  exploracaoId: string | undefined,
  tipo: Medicamento['tipo'],
): EstadoLote[] {
  if (!exploracaoId) return [];
  return lotesComEstado(
    medicamentos.filter((m) => m.exploracaoId === exploracaoId && m.tipo === tipo),
    eventos,
  ).filter((l) => l.disponivel);
}

/** Como se escreve uma quantidade: `20 ml`, `1,5 l`. */
export function formatQuantidade(valor: number, unidade: string): string {
  const arredondado = Math.round(valor * 100) / 100;
  return `${String(arredondado).replace('.', ',')} ${unidade}`;
}

/**
 * Como se refere um lote numa lista: nome, e o lote entre parênteses quando o
 * há. Dois frascos do mesmo antibiótico distinguem-se pelo lote e por mais
 * nada — sem ele a lista tinha duas linhas iguais.
 */
export function rotuloLote(m: Medicamento): string {
  return m.lote?.trim() ? `${m.nome} (lote ${m.lote.trim()})` : m.nome;
}

/**
 * O que sai no ficheiro do registo de medicamentos. É a folha que se mostra
 * numa inspeção: o que entrou, de que lote, e o que resta.
 */
export function tabelaExistencias(lotes: EstadoLote[]): {
  cabecalhos: string[];
  linhas: (string | number)[][];
} {
  return {
    cabecalhos: [
      'Nome',
      'Tipo',
      'Lote',
      'Validade',
      'Comprado',
      'Usado',
      'Resta',
      'Unidade',
      'Interv. segurança (dias)',
      'Fornecedor',
      'Data da compra',
      'Custo (€)',
      'Estado',
    ],
    linhas: lotes.map((l) => [
      l.medicamento.nome,
      l.medicamento.tipo,
      l.medicamento.lote ?? '',
      l.medicamento.validade ? diaIso(l.medicamento.validade) : '',
      l.medicamento.quantidade,
      l.usado,
      l.resta,
      l.medicamento.unidade,
      l.medicamento.intervaloSegurancaDias,
      l.medicamento.fornecedor ?? '',
      diaIso(l.medicamento.dataCompra),
      l.medicamento.custo ?? '',
      l.expirado
        ? 'Fora de validade'
        : l.esgotado
          ? 'Esgotado'
          : l.aExpirar
            ? 'A expirar'
            : l.quaseVazio
              ? 'A acabar'
              : 'Disponível',
    ]),
  };
}
