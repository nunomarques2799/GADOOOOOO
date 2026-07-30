/**
 * O registo de quem alterou o quê — a leitura do lado da app.
 * ------------------------------------------------------------------
 * O dono passou a poder dar acesso à exploração a trabalhadores e a
 * veterinários, e passou a não ter forma nenhuma de saber o que é que eles lá
 * fizeram. Um animal com a data mudada, um terreno renomeado, uma despesa
 * lançada — tudo aparecia como se tivesse acontecido sozinho.
 *
 * Quem escreve as linhas são os triggers de `supabase/schema_atividade.sql`,
 * nunca o cliente: numa app offline-first o telemóvel decide o que envia, e um
 * registo em que o registado escolhe o autor não regista nada. O que está aqui
 * é só a leitura — o pedido e as regras de apresentação, à parte do ecrã para
 * poderem ser testadas.
 *
 * Não tem cache local de propósito. Tudo o resto na app tem, porque tudo o
 * resto é preciso no campo sem rede; isto responde a uma pergunta que só se faz
 * de vez em quando, e uma cópia guardada no aparelho de quem foi auditado seria
 * a única coisa nesta funcionalidade que ele conseguia mexer.
 */

import { formatDataHora } from './helpers';
import { supabase } from './supabase';

/** As tabelas que ficam registadas. Espelha o `check` da coluna, no servidor. */
export type TabelaAtividade = 'animal' | 'evento' | 'terreno' | 'movimento';

export type AcaoAtividade = 'criou' | 'alterou' | 'removeu';

export type Atividade = {
  id: number;
  /** Quando aconteceu (ISO). */
  em: string;
  exploracaoId: string;
  /** Quem. Ausente se a conta foi apagada entretanto. */
  userId?: string;
  tabela: TabelaAtividade;
  registoId?: string;
  acao: AcaoAtividade;
  /** A frase montada no servidor: "Vaca 'Malhada'", "Despesa de 120 € · ração". */
  resumo: string;
};

type LinhaAtividade = {
  id: number;
  em: string;
  exploracao_id: string;
  user_id?: string | null;
  tabela: TabelaAtividade;
  registo_id?: string | null;
  acao: AcaoAtividade;
  resumo?: string | null;
};

/**
 * Quantas linhas se pedem de uma vez.
 *
 * Não há paginação: a pergunta é "o que se passou por cá ultimamente", e quem
 * quer ir mais atrás do que as últimas duzentas alterações está a fazer outra
 * coisa — para a qual isto nunca seria a ferramenta certa. Um limite alto sem
 * paginação seria uma lista que demora a abrir e que ninguém desce até ao fim.
 */
export const LIMITE_ATIVIDADE = 200;

/**
 * As últimas alterações nas explorações a que a pessoa tem acesso.
 *
 * A RLS é que decide o que volta (`supabase/schema_atividade.sql`): o dono vê
 * tudo o que se passou nas suas, e cada pessoa vê o que ela própria fez. Sem
 * servidor devolve vazio, que é o mesmo que o ecrã mostra em modo local.
 */
export async function carregarAtividade(
  exploracaoId?: string,
  limite = LIMITE_ATIVIDADE,
): Promise<Atividade[]> {
  if (!supabase) return [];
  let consulta = supabase
    .from('registo_atividade')
    .select('id, em, exploracao_id, user_id, tabela, registo_id, acao, resumo')
    .order('em', { ascending: false })
    .limit(limite);
  if (exploracaoId) consulta = consulta.eq('exploracao_id', exploracaoId);

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return ((data ?? []) as LinhaAtividade[]).map((l) => ({
    id: l.id,
    em: l.em,
    exploracaoId: l.exploracao_id,
    userId: l.user_id ?? undefined,
    tabela: l.tabela,
    registoId: l.registo_id ?? undefined,
    acao: l.acao,
    resumo: l.resumo ?? '',
  }));
}

/* ---------------- Apresentação (lógica pura) ---------------- */

const NOME_TABELA: Record<TabelaAtividade, string> = {
  animal: 'Animal',
  evento: 'Registo',
  terreno: 'Terreno',
  movimento: 'Dinheiro',
};

const VERBO: Record<TabelaAtividade, Record<AcaoAtividade, string>> = {
  animal: { criou: 'Registou o animal', alterou: 'Alterou o animal', removeu: 'Tirou do efetivo' },
  evento: { criou: 'Registou', alterou: 'Alterou o registo', removeu: 'Apagou o registo' },
  terreno: { criou: 'Criou o terreno', alterou: 'Alterou o terreno', removeu: 'Apagou o terreno' },
  movimento: { criou: 'Lançou', alterou: 'Alterou', removeu: 'Apagou' },
};

/**
 * A linha em português: "Alterou o animal · Malhada".
 *
 * O verbo muda com a tabela porque «criou movimento» não é português e
 * «registou terreno» é ao lado do que se fez. São doze frases escritas à mão,
 * e é de propósito: uma fórmula genérica dava as doze erradas ao mesmo tempo.
 */
export function frase(a: Atividade): string {
  return VERBO[a.tabela][a.acao];
}

/** O que é isto, para a etiqueta ao lado da hora. */
export function legendaTabela(t: TabelaAtividade): string {
  return NOME_TABELA[t];
}

/**
 * As alterações agrupadas por DIA, do mais recente para trás.
 *
 * Por dia e não por hora: a pergunta é "o que se passou ontem", e uma lista
 * corrida de cem linhas com a data repetida em cada uma obriga a lê-las todas
 * para responder. O dia entra uma vez, em cima do grupo.
 */
export function agruparPorDia(
  lista: Atividade[],
): { dia: string; titulo: string; linhas: Atividade[] }[] {
  const grupos = new Map<string, Atividade[]>();
  for (const a of lista) {
    const dia = chaveDoDia(a.em);
    const existente = grupos.get(dia);
    if (existente) existente.push(a);
    else grupos.set(dia, [a]);
  }
  // A ordem vem da consulta (mais recente primeiro) e o `Map` guarda a ordem de
  // inserção — não se reordena aqui para não haver duas fontes de ordenação a
  // discordarem quando uma delas mudar.
  return [...grupos.entries()].map(([dia, linhas]) => ({
    dia,
    titulo: tituloDoDia(dia),
    linhas,
  }));
}

/** `aaaa-mm-dd` em hora local (ver `diaIso` nos helpers: UTC dava o dia errado à noite). */
function chaveDoDia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "Hoje", "Ontem", ou a data escrita. */
export function tituloDoDia(dia: string, agora: Date = new Date()): string {
  const hoje = chaveDoDia(agora.toISOString());
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (dia === hoje) return 'Hoje';
  if (dia === chaveDoDia(ontem.toISOString())) return 'Ontem';
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

/** A hora da alteração, só as horas e minutos (o dia já está no grupo). */
export function horaDe(iso: string): string {
  // `formatDataHora` dá "14/03 09:25"; aqui interessa a parte de trás.
  const texto = formatDataHora(iso);
  const partes = texto.split(' ');
  return partes[partes.length - 1] ?? texto;
}

/**
 * Quem aparece nos filtros, com quantas alterações fez cada um.
 *
 * Ordenado por quem mexeu mais, que é por quem se procura primeiro. Sem nome
 * conhecido, quem chama põe o que quiser no lugar — daqui só sai o id.
 */
export function autores(lista: Atividade[]): { userId: string; quantas: number }[] {
  const conta = new Map<string, number>();
  for (const a of lista) {
    if (!a.userId) continue;
    conta.set(a.userId, (conta.get(a.userId) ?? 0) + 1);
  }
  return [...conta.entries()]
    .map(([userId, quantas]) => ({ userId, quantas }))
    .sort((a, b) => b.quantas - a.quantas);
}
