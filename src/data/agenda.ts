/**
 * Agenda — os eventos que as pessoas marcam. Lógica pura, sem React e sem rede.
 * ------------------------------------------------------------------
 * Não confundir com `Evento` (em `types.ts`), que é o que JÁ ACONTECEU a um
 * animal: a vacina que se deu, o parto que houve, a pesagem que se fez. Esta é
 * a outra metade — o que ESTÁ MARCADO para a exploração: a feira de quinta, a
 * entrega da ração, o dia de carregar para o matadouro. Uma olha para trás e
 * faz o histórico clínico; a outra olha para a frente e faz a semana.
 *
 * As contas de dias vivem aqui, à parte do hook (`useAgenda.ts`), pela mesma
 * razão que as do `calendario.ts`: um erro de um dia num calendário só se
 * descobre na virada do mês, ou na mudança da hora, e é aí que já não há quem o
 * apanhe. Aqui apanha-o um teste.
 */

import { minutosDaHora } from './acessoTemporario';
import { chaveDia } from './calendario';

export type EventoAgenda = {
  id: string;
  exploracaoId: string;
  /** Quem o marcou. É por ele que se decide quem o pode alterar. */
  criadoPor: string;
  titulo: string;
  descricao?: string;
  /** O dia, em ISO curto (`aaaa-mm-dd`). Sem hora — ver `hora`. */
  dia: string;
  /**
   * A hora (`hh:mm`), ou ausente para o dia inteiro.
   *
   * Opcional porque "dia 12 há feira" é um evento completo: obrigar a uma hora
   * punha lá 00:00 e o calendário passava a anunciar a feira à meia-noite.
   */
  hora?: string;
  /** Toda a equipa vê (`true`) ou só quem o marcou (`false`). */
  publico: boolean;
  criadoEm: string;
};

/** O que se envia para gravar um evento — novo (sem `id`) ou já existente. */
export type EntradaEvento = {
  id?: string;
  exploracaoId: string;
  titulo: string;
  descricao?: string;
  /** ISO curto `aaaa-mm-dd`. */
  dia: string;
  hora?: string;
  publico: boolean;
};

/**
 * O que está errado no evento, em palavras — ou `null` se está pronto.
 *
 * Uma frase por engano, como no resto da app: "falta o título" e "a hora não se
 * percebe" pedem correções diferentes, e um "preenchimento inválido" deixava
 * quem escreve a adivinhar em qual dos campos mexer.
 */
export function problemaComEvento(
  titulo: string,
  dia: string | null,
  hora: string,
): string | null {
  if (!titulo.trim()) return 'Escreva o que é — "Feira", "Entrega da ração", o que for.';
  if (titulo.trim().length > 120) return 'O título é demasiado comprido. Ponha o resto na descrição.';
  if (!dia) return 'Escreva o dia (dd/mm/aaaa).';
  // A hora é opcional; escrita, tem de se perceber. Uma hora meio escrita
  // ("18:") gravada em silêncio dava um evento marcado para hora nenhuma, que o
  // calendário mostrava como se hora tivesse.
  if (hora.trim() && minutosDaHora(hora) === null) {
    return 'Escreva a hora como 09:00, ou deixe em branco.';
  }
  return null;
}

/** Os eventos agrupados pelo dia a que pertencem, já ordenados dentro do dia. */
export function agruparEventosPorDia(eventos: EventoAgenda[]): Map<string, EventoAgenda[]> {
  const m = new Map<string, EventoAgenda[]>();
  for (const e of eventos) {
    const lista = m.get(e.dia);
    if (lista) lista.push(e);
    else m.set(e.dia, [e]);
  }
  // Dentro do dia, por hora. Os que NÃO têm hora ficam à frente: são do dia
  // inteiro, e enfiá-los no meio da tarde por causa de um `undefined` a ordenar
  // como texto dava uma lista que não se lia de cima a baixo.
  for (const lista of m.values()) {
    lista.sort((a, b) => {
      if (!a.hora && !b.hora) return a.titulo.localeCompare(b.titulo, 'pt');
      if (!a.hora) return -1;
      if (!b.hora) return 1;
      return a.hora.localeCompare(b.hora);
    });
  }
  return m;
}

/**
 * "Hoje", "Amanhã", "Ontem" — ou vazio para os outros dias.
 *
 * Devolve vazio e não o dia por extenso porque quem chama junta as duas coisas
 * ("Hoje, 3 de agosto"), e uma função que às vezes devolve um nome e às vezes
 * uma data completa obrigava cada sítio a adivinhar qual das duas recebeu.
 */
export function rotuloDoDia(dia: string, hoje: Date = new Date()): string {
  if (dia === chaveDia(hoje)) return 'Hoje';
  const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1);
  if (dia === chaveDia(amanha)) return 'Amanhã';
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  if (dia === chaveDia(ontem)) return 'Ontem';
  return '';
}

/**
 * O dia vizinho, em chave ISO curta: `passo` de -1 é o anterior.
 *
 * Passa pelo construtor com ano/mês/dia separados, e é ele que trata das viradas
 * de mês, de ano e do 29 de fevereiro. Somar um dia à string com aritmética de
 * texto seria mais curto e falhava em todos esses sítios.
 */
export function diaVizinho(dia: string, passo: number): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  return chaveDia(new Date(ano, mes - 1, d + passo));
}
