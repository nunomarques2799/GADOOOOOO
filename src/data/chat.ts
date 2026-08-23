/**
 * As conversas: lógica pura, sem React e sem rede.
 * ------------------------------------------------------------------
 * O que precisa de servidor e de estado está em `useChat.ts`; aqui fica o que
 * se pode testar sem nada montado, que é a divisão de sempre (`agenda.ts` /
 * `useAgenda.ts`, `financas.ts` / `useFinancas.ts`).
 *
 * O modelo está explicado por inteiro em `supabase/schema_chat.sql`. O resumo:
 * há um GRUPO por exploração (dono e trabalhadores, sem o veterinário) e
 * conversas PRIVADAS entre duas pessoas que partilhem uma exploração. Nada
 * disto se cria à mão: o grupo nasce com a exploração e a privada nasce da
 * primeira vez que alguém escreve à outra pessoa.
 */

import { diaIso } from './helpers';
import { t } from '@/i18n';

import type { RoleMembro } from './types';

export type TipoConversa = 'grupo' | 'privada';

export type Conversa = {
  id: string;
  tipo: TipoConversa;
  /** Só nos grupos, e só se o dono lhe tiver dado um. Ver `tituloDaConversa`. */
  nome?: string;
  /** Só nos grupos. */
  exploracaoId?: string;
  /** Só nas privadas: o id de quem está do outro lado. */
  outro?: string;
  ultimaEm: string;
  ultimoTexto?: string;
  ultimoAutor?: string;
  ultimoApagado: boolean;
  naoLidas: number;
  silenciada: boolean;
  /**
   * Ainda sou membro ativo? Falso a quem o dono removeu do grupo: continua a
   * ver o que apanhou e não escreve mais nada.
   */
  ativa: boolean;
};

export type Mensagem = {
  id: string;
  conversaId: string;
  /** Ausente quando a conta de quem escreveu já não existe. */
  autor?: string;
  texto: string;
  /**
   * A hora do SERVIDOR. Enquanto a mensagem está na fila deste aparelho é a
   * hora local, e corrige-se quando ela chega lá (ver a coluna `criado_em` em
   * `supabase/schema_chat.sql`, que explica porque não é o cliente a escrevê-la).
   */
  criadoEm: string;
  apagadaEm?: string;
  /**
   * Escrita sem rede: está na fila e ainda não saiu deste aparelho. Só existe
   * do lado de cá (a coluna não existe na base).
   */
  porEnviar?: boolean;
};

export type PessoaChat = {
  id: string;
  nome: string;
  /** O papel na exploração partilhada. Vazio quando já não há nenhuma. */
  papel: RoleMembro | '';
};

export type MembroConversa = PessoaChat & { saiu: boolean };

/** O teto por mensagem. É o mesmo que a restrição da coluna `texto` aceita. */
export const MAX_TEXTO = 2000;

/** Ao fim de quanto tempo as mensagens desaparecem (ver o schema). */
export const MESES_ATE_APAGAR = 6;

/**
 * O que falta para a mensagem poder ser enviada, ou `null` se está pronta.
 *
 * Repetido no servidor de propósito, como no `apoio.ts`: o daqui existe para
 * não se ir ao servidor por nada, o de lá é o que vale.
 */
export function problemaComTexto(texto: string): string | null {
  const limpo = texto.trim();
  if (!limpo) return t('chat.erroVazia');
  if (limpo.length > MAX_TEXTO) return t('chat.erroComprida', { n: MAX_TEXTO });
  return null;
}

/**
 * O nome que a conversa mostra.
 *
 * O grupo nasce sem nome nenhum e chama-se como a exploração: copiar o nome
 * para dentro da conversa obrigava a mantê-lo alinhado para sempre com o
 * outro, e uma exploração que mudasse de nome ficava com um grupo a chamar-se
 * como ela se chamava antes.
 */
export function tituloDaConversa(
  c: Conversa,
  nomeDe: (id?: string) => string | undefined,
  nomeExploracao: (id?: string) => string | undefined,
): string {
  if (c.tipo === 'privada') return nomeDe(c.outro) ?? t('chat.utilizadorRemovido');
  return c.nome?.trim() || nomeExploracao(c.exploracaoId) || t('chat.grupoSemNome');
}

/**
 * A linha por baixo do nome, na lista: quem escreveu e o quê.
 *
 * Sem autor nenhum quando a conversa é privada (só lá estão duas pessoas e
 * saber quem falou não acrescenta nada), com autor quando é o grupo.
 */
export function resumoDaUltima(
  c: Conversa,
  meuId: string,
  nomeDe: (id?: string) => string | undefined,
): string {
  if (!c.ultimoTexto) return t('chat.semMensagens');
  const texto = c.ultimoApagado ? t('chat.mensagemApagada') : c.ultimoTexto;
  if (c.ultimoAutor === meuId) return t('chat.euDisse', { texto });
  if (c.tipo === 'privada') return texto;
  const nome = nomeDe(c.ultimoAutor) ?? t('chat.utilizadorRemovido');
  return `${primeiroNome(nome)}: ${texto}`;
}

/** "João Carlos Silva" → "João". A lista é estreita e o nome inteiro não cabe. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

/** "João Ferreira" → "JF". Duas letras é o que cabe no círculo do avatar. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/**
 * O papel por extenso. É uma FUNÇÃO e não uma tabela de módulo porque o `t()`
 * tem de ser lido dentro do render (ver o AGENTS.md): numa tabela, ficava
 * congelado na língua do arranque.
 */
export function rotuloPapel(papel: RoleMembro | ''): string {
  if (papel === 'admin') return t('papel.dono');
  if (papel === 'trabalhador') return t('papel.trabalhador');
  if (papel === 'veterinario') return t('papel.veterinario');
  return '';
}

/**
 * Junta duas listas de mensagens sem repetir e por ordem de chegada.
 *
 * Faz falta porque as mensagens entram por três portas ao mesmo tempo: o que
 * se lê do servidor, o que chega pelo tempo real e o que este aparelho acabou
 * de escrever. Sem passar tudo por aqui, uma mensagem enviada por mim aparecia
 * duas vezes (a minha e a que o tempo real me devolve).
 */
export function mesclarMensagens(atuais: Mensagem[], novas: Mensagem[]): Mensagem[] {
  const porId = new Map<string, Mensagem>();
  for (const m of atuais) porId.set(m.id, m);
  for (const m of novas) {
    const antiga = porId.get(m.id);
    // Quando a que chega é a versão do SERVIDOR de uma que estava na fila, ela
    // substitui a local por inteiro: o `porEnviar` tem de desaparecer, e um
    // `{...antiga, ...m}` deixava-o lá (a nova não traz a chave para o apagar).
    porId.set(m.id, antiga?.porEnviar && !m.porEnviar ? { ...m } : { ...antiga, ...m });
  }
  return [...porId.values()].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

export type BlocoDeDia = { dia: string; mensagens: Mensagem[] };

/**
 * As mensagens agrupadas por dia, para o separador com a data.
 *
 * O dia sai do `diaIso` e não de contas com horas: um dia é o dia LOCAL de
 * quem está a ler, e as contas em horas erram sempre que há mudança de hora
 * ou fusos pelo meio.
 */
export function agruparPorDia(mensagens: Mensagem[]): BlocoDeDia[] {
  const blocos: BlocoDeDia[] = [];
  for (const m of mensagens) {
    const dia = diaIso(m.criadoEm);
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.mensagens.push(m);
    else blocos.push({ dia, mensagens: [m] });
  }
  return blocos;
}

/** "Hoje", "Ontem", ou a data. O separador entre os dias da conversa. */
export function rotuloDoDia(dia: string, agora = new Date()): string {
  const hoje = diaIso(agora);
  if (dia === hoje) return t('chat.hoje');
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (dia === diaIso(ontem)) return t('chat.ontem');
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

/** "09:25". A hora a que a mensagem foi escrita, no fuso de quem lê. */
export function horaCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Quantas mensagens por ler ao todo. É o número que a barra mostra. */
export function totalNaoLidas(conversas: Conversa[]): number {
  return conversas.reduce((soma, c) => soma + (c.silenciada ? 0 : c.naoLidas), 0);
}

/** Só se apaga o que se escreveu, e só uma vez. */
export function podeApagarMensagem(m: Mensagem, meuId: string): boolean {
  return !!m.autor && m.autor === meuId && !m.apagadaEm && !m.porEnviar;
}

/**
 * Só se denuncia o que os outros escreveram.
 *
 * Denunciar a própria mensagem não quer dizer nada, e uma mensagem já apagada
 * também não: quem a apagou fez o que a denúncia ia pedir.
 */
export function podeDenunciarMensagem(m: Mensagem, meuId: string): boolean {
  return !!m.autor && m.autor !== meuId && !m.apagadaEm && !m.porEnviar;
}

/** As conversas pela ordem em que a lista as mostra: a mais recente à cabeça. */
export function ordenarConversas(conversas: Conversa[]): Conversa[] {
  return [...conversas].sort((a, b) => b.ultimaEm.localeCompare(a.ultimaEm));
}
