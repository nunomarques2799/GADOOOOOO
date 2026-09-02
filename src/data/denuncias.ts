/**
 * A fila de moderação, do lado de cá.
 * ------------------------------------------------------------------
 * Contas e formatos das denúncias (lógica pura, testada). O que precisa de
 * rede está no `denunciasApi.ts`, e a divisão é a mesma do `chat.ts` /
 * `useChat.ts`.
 *
 * PORQUE É QUE ISTO EXISTE
 *
 * A diretriz 1.2 da Apple exige três coisas a quem deixa pessoas escrever umas
 * às outras: denunciar, bloquear, e ALGUÉM A AGIR. As duas primeiras estão na
 * app desde a fase 1; esta é a terceira. Sem um ecrã que leia a fila, o botão
 * de denunciar era teatro e a revisão não passava.
 *
 * O QUE ESTE MÓDULO NÃO TOCA
 *
 * As conversas dos clientes não se leem, e o `schema_chat.sql` é o único
 * ficheiro de schema sem `eh_superadmin()` nas políticas justamente por isso.
 * A ÚNICA porta é esta: a linha que alguém COPIOU para a fila ao carregar em
 * "denunciar", com as três mensagens anteriores que o servidor juntou. Não há
 * aqui forma de abrir a conversa de onde ela veio, e não é esquecimento.
 *
 * O texto deste ecrã fica em português e não passa pelo `t()`: o painel de
 * superadmin não se traduz (ver AGENTS.md).
 */

import type { TipoMensagem } from './chat';

export type EstadoDenuncia = 'aberta' | 'tratada';

/**
 * Uma das mensagens anteriores, como o servidor a copiou.
 *
 * Tudo é opcional menos o que se desenha: a primeira versão do
 * `denunciar_mensagem` (schema 35) não copiava o `tipo`, e uma denúncia dessa
 * altura tem de continuar a abrir. Ver `lerContexto`.
 */
export type MensagemDoContexto = {
  autor?: string;
  texto: string;
  tipo: TipoMensagem;
  criadoEm?: string;
};

export type Denuncia = {
  id: string;
  /** Ausente quando a mensagem original já foi apagada pelo tempo. */
  mensagemId?: string;
  conversaId?: string;
  /** Ausente quando a conta já não existe (`on delete set null`). */
  denunciadoPor?: string;
  autorDenunciado?: string;
  /** A cópia do que foi escrito. Vazia quando o que foi denunciado é um ficheiro. */
  textoCopia: string;
  tipo: TipoMensagem;
  /** O caminho no bucket `chat`, quando é fotografia ou áudio. */
  anexo?: string;
  contexto: MensagemDoContexto[];
  motivo?: string;
  criadoEm: string;
  estado: EstadoDenuncia;
  tratadoEm?: string;
  notaSuperadmin?: string;
};

/** Quantos caracteres cabem na nota que fica a dizer o que se decidiu. */
export const MAX_NOTA = 500;

/**
 * Os tipos que a base aceita. Uma linha antiga (ou uma coluna `tipo` a nulo,
 * que é o que as denúncias do schema 35 têm) conta como texto: é o que ela
 * era antes de haver anexos.
 */
const TIPOS: readonly TipoMensagem[] = ['texto', 'foto', 'audio', 'local', 'sondagem'];

export function lerTipo(valor: unknown): TipoMensagem {
  return TIPOS.includes(valor as TipoMensagem) ? (valor as TipoMensagem) : 'texto';
}

/**
 * O `contexto` é uma coluna `jsonb` e chega como veio da base: sem tipos e sem
 * garantias. É lido com desconfiança porque uma denúncia mal formada não pode
 * ser uma denúncia que não abre, e este ecrã é o último sítio onde se quer um
 * erro em vez do que alguém pediu para ser lido.
 */
export function lerContexto(bruto: unknown): MensagemDoContexto[] {
  if (!Array.isArray(bruto)) return [];
  const linhas: MensagemDoContexto[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    linhas.push({
      autor: typeof o.autor === 'string' ? o.autor : undefined,
      texto: typeof o.texto === 'string' ? o.texto : '',
      tipo: lerTipo(o.tipo),
      criadoEm: typeof o.criado_em === 'string' ? o.criado_em : undefined,
    });
  }
  return linhas;
}

/**
 * Por onde se começa: as abertas primeiro, e dentro de cada grupo a mais
 * recente no topo.
 *
 * A ordem não é a da lista de clientes (por data) de propósito: aqui há
 * trabalho por fazer e trabalho já feito, e misturá-los obrigava a procurar o
 * que falta no meio do que já foi tratado.
 */
export function ordenarDenuncias(lista: Denuncia[]): Denuncia[] {
  return [...lista].sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'aberta' ? -1 : 1;
    return b.criadoEm.localeCompare(a.criadoEm);
  });
}

export function contarAbertas(lista: Denuncia[]): number {
  return lista.filter((d) => d.estado === 'aberta').length;
}

/** O nome do tipo, como se lê num cartão. */
export function rotuloTipo(tipo: TipoMensagem): string {
  if (tipo === 'foto') return 'Fotografia';
  if (tipo === 'audio') return 'Mensagem de voz';
  if (tipo === 'local') return 'Localização';
  if (tipo === 'sondagem') return 'Sondagem';
  return 'Mensagem escrita';
}

/**
 * O que foi denunciado, em uma linha.
 *
 * Uma fotografia sem legenda não tem texto nenhum para mostrar, e mostrar o
 * caminho do ficheiro seria pior do que não mostrar nada: quem lê isto está a
 * decidir se suspende uma conta, não a depurar o Storage. A legenda ganha à
 * palavra genérica quando existe, como na lista de conversas.
 */
export function resumoDoConteudo(d: Pick<Denuncia, 'tipo' | 'textoCopia'>): string {
  const limpo = d.textoCopia.trim();
  if (d.tipo === 'texto' || d.tipo === 'sondagem') return limpo || '(sem texto)';
  if (limpo) return limpo;
  return rotuloTipo(d.tipo);
}

/**
 * Todas as contas que este ecrã tem de saber nomear: quem denunciou, quem foi
 * denunciado, e quem escreveu as mensagens do contexto.
 *
 * Numa lista só, para o ecrã ir buscar os nomes de uma vez em vez de uma ida
 * por cartão. Sem repetidos e sem os que ficaram a nulo (conta apagada).
 */
export function pessoasEnvolvidas(lista: Denuncia[]): string[] {
  const ids = new Set<string>();
  for (const d of lista) {
    if (d.denunciadoPor) ids.add(d.denunciadoPor);
    if (d.autorDenunciado) ids.add(d.autorDenunciado);
    for (const c of d.contexto) if (c.autor) ids.add(c.autor);
  }
  return [...ids];
}

/** O que o painel sabe de uma conta envolvida numa denúncia. Vem do `perfil`. */
export type PessoaDenunciada = { nome?: string; telefone?: string };

/**
 * Como se chama esta pessoa, sabendo o que se sabe.
 *
 * Uma conta apagada deixa o campo a nulo (`on delete set null`) e um perfil
 * sem nome é possível desde sempre. Nos dois casos escreve-se o que se sabe em
 * vez de um espaço em branco, que num ecrã de moderação parece avaria.
 */
export function nomeDaPessoa(
  pessoas: Record<string, PessoaDenunciada>,
  id?: string,
): string {
  if (!id) return 'Conta apagada';
  const nome = pessoas[id]?.nome?.trim();
  return nome || 'Sem nome';
}

/**
 * Uma denúncia sobre um ficheiro é a única que precisa de ir ao Storage. E o
 * ficheiro só lá está enquanto a denúncia estiver ABERTA: assim que for
 * tratada, ela sai da exceção e a limpeza dos órfãos apaga-o (ver a política
 * `anexo_orfao_select` no `schema_chat_anexos.sql`).
 *
 * É por isso que este ecrã mostra o aviso de "vê-se agora, depois de tratada
 * pode desaparecer" e não deixa isso por descobrir.
 */
export function temFicheiroParaVer(d: Denuncia): boolean {
  return !!d.anexo && (d.tipo === 'foto' || d.tipo === 'audio');
}

/** Uma denúncia tratada volta a abrir; uma aberta trata-se. Nunca as duas. */
export function podeTratar(d: Denuncia): boolean {
  return d.estado === 'aberta';
}

export function podeReabrir(d: Denuncia): boolean {
  return d.estado === 'tratada';
}

/**
 * O que falta para a nota poder ser gravada, ou `null` se está pronta.
 *
 * A nota é opcional: fechar uma denúncia sem escrever nada é uma decisão
 * legítima ("não é nada"), e obrigar a justificar cada uma faria com que
 * nenhuma fosse fechada. O que não passa é uma nota maior do que a coluna.
 */
export function problemaComNota(nota: string): string | null {
  if (nota.length > MAX_NOTA) return `A nota não pode passar de ${MAX_NOTA} caracteres.`;
  return null;
}
