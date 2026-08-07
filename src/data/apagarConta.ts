/**
 * O que se perde ao apagar a conta — lógica pura, sem React nem rede.
 * ------------------------------------------------------------------
 * Apagar a conta não custa o mesmo a toda a gente, e é essa diferença que tem
 * de estar no ecrã ANTES de alguém confirmar:
 *
 *   - quem ADMINISTRA uma exploração leva-a consigo. A cascata das chaves
 *     estrangeiras (`supabase/schema_seguranca.sql`) apaga terrenos, animais e
 *     eventos, e quem lá trabalhava fica sem acesso nenhum;
 *   - quem entrou por CÓDIGO (trabalhador, veterinário) só perde a sua ligação.
 *     A exploração continua a ser do dono e não se apaga um animal que seja.
 *
 * Dizer "isto é definitivo" às duas com a mesma frase é dizer de menos a uma e
 * a mais à outra. O cabeçalho de `supabase/schema_rgpd.sql` descreve a mesma
 * divisão do lado da base de dados, e é a `apagar_a_minha_conta()` que a
 * executa.
 *
 * O botão já existiu no Perfil, colado ao "Terminar sessão", e saiu de lá por
 * ser fácil de tocar por engano. Voltou noutro sítio porque a App Store obriga
 * quem deixa criar conta a deixar apagá-la de dentro da app (diretriz
 * 5.1.1(v)) — mas com esta conta feita à frente de quem decide, e atrás de uma
 * palavra escrita à mão.
 */

import type { RoleMembro } from './types';

/** O que o ecrã precisa de saber de uma exploração. */
export type ExploracaoResumo = {
  id: string;
  nome: string;
  /** A quem ela pertence. É quem a leva consigo ao apagar a conta. */
  utilizadorId: string;
};

/** Uma ligação a uma exploração, como o `membro_exploracao` a guarda. */
export type VinculoResumo = {
  exploracaoId: string;
  role: RoleMembro;
};

/** Uma exploração que desaparece com a conta. */
export type ExploracaoApagada = {
  id: string;
  nome: string;
  /** Quantos animais caem com ela. */
  animais: number;
};

/** Uma exploração que continua a existir; o que se perde é a entrada nela. */
export type AcessoPerdido = {
  id: string;
  nome: string;
  role: RoleMembro;
};

export type ConsequenciasApagamento = {
  exploracoesApagadas: ExploracaoApagada[];
  acessosPerdidos: AcessoPerdido[];
  /** Total de animais apagados — a soma das explorações que caem. */
  animais: number;
  /** true se isto apaga dados de produção, e não só uma ligação. */
  apagaDados: boolean;
};

/** Nome de reserva para uma exploração que a app conhece mas não tem em mão. */
const SEM_NOME = 'Exploração sem nome';

/**
 * O que desaparece se esta pessoa apagar a conta agora.
 *
 * A posse lê-se de DUAS fontes que se completam: o `utilizadorId` da
 * exploração (a verdade, e está na cache local mesmo sem rede) e o papel
 * `admin` no vínculo (que apanha uma exploração que a lista local ainda não
 * trouxe). Usar só uma delas mostrava a conta errada em momentos diferentes do
 * arranque — e uma conta a menos, num ecrã destes, é uma exploração que o
 * criador não sabia que ia perder.
 */
export function consequenciasDeApagar({
  utilizadorId,
  exploracoes,
  animais,
  membros,
}: {
  utilizadorId: string;
  exploracoes: readonly ExploracaoResumo[];
  animais: readonly { exploracaoId: string }[];
  membros: readonly VinculoResumo[];
}): ConsequenciasApagamento {
  const minhas = new Set<string>();
  for (const e of exploracoes) if (e.utilizadorId === utilizadorId) minhas.add(e.id);
  for (const m of membros) if (m.role === 'admin') minhas.add(m.exploracaoId);

  const animaisDe = new Map<string, number>();
  for (const a of animais) {
    animaisDe.set(a.exploracaoId, (animaisDe.get(a.exploracaoId) ?? 0) + 1);
  }

  const nomeDe = new Map(exploracoes.map((e) => [e.id, e.nome]));

  // Pela ordem da lista da app primeiro: é a ordem que o criador conhece dos
  // outros ecrãs. As que só aparecem nos vínculos vão a seguir, para não se
  // perderem por não estarem na cache.
  const conhecidas = exploracoes.filter((e) => minhas.has(e.id)).map((e) => e.id);
  const ordenadas = [...conhecidas, ...[...minhas].filter((id) => !nomeDe.has(id))];

  const exploracoesApagadas = ordenadas.map((id) => ({
    id,
    nome: nomeDe.get(id) ?? SEM_NOME,
    animais: animaisDe.get(id) ?? 0,
  }));

  // Um vínculo por exploração: a mesma pessoa não entra duas vezes na mesma
  // quinta, mas um `membros` recarregado a meio já trouxe linhas repetidas.
  const vistos = new Set<string>();
  const acessosPerdidos: AcessoPerdido[] = [];
  for (const m of membros) {
    if (minhas.has(m.exploracaoId) || vistos.has(m.exploracaoId)) continue;
    vistos.add(m.exploracaoId);
    acessosPerdidos.push({
      id: m.exploracaoId,
      nome: nomeDe.get(m.exploracaoId) ?? SEM_NOME,
      role: m.role,
    });
  }

  const totalAnimais = exploracoesApagadas.reduce((s, e) => s + e.animais, 0);

  return {
    exploracoesApagadas,
    acessosPerdidos,
    animais: totalAnimais,
    apagaDados: exploracoesApagadas.length > 0,
  };
}

/**
 * Quantas OUTRAS pessoas ficam sem acesso.
 *
 * Conta gente, não vínculos: o trabalhador que anda nas duas quintas que vão
 * cair é um homem que perde o emprego na app, não dois.
 */
export function pessoasAfetadas(
  utilizadorId: string,
  equipas: readonly { userId: string }[],
): number {
  const outros = new Set<string>();
  for (const m of equipas) if (m.userId !== utilizadorId) outros.add(m.userId);
  return outros.size;
}

/**
 * A palavra que se escreve à mão para o botão acordar.
 *
 * Não é segurança — quem quer apagar escreve-a — e também não é burocracia: é
 * o que separa um toque distraído de uma decisão. Um "tem a certeza?" com um
 * botão vermelho responde-se sem ler.
 */
export const PALAVRA_CONFIRMACAO = 'APAGAR';

/** true se o que está escrito no campo abre o botão. */
export function confirmacaoValida(texto: string): boolean {
  // Maiúsculas e espaços à volta não são a pergunta: quem escreveu " apagar "
  // percebeu o que lhe foi pedido, e o teclado do telemóvel corrige a primeira
  // letra sozinho.
  return texto.trim().toUpperCase() === PALAVRA_CONFIRMACAO;
}
