/**
 * Quem já cá esteve — lógica pura, sem React nem rede.
 * ------------------------------------------------------------------
 * Uma pessoa deixa de ter acesso a uma exploração por dois caminhos, e eles não
 * são a mesma coisa:
 *
 *   · O PRAZO CAIU. É o veterinário depois da visita. O vínculo dele continua
 *     lá — o que acabou foi o relógio (ver `acessoTemporario.ts`). Basta dar-lhe
 *     mais horas e ele volta a entrar, sem código nenhum.
 *   · SAIU DA EQUIPA. Alguém o removeu, e o vínculo foi apagado. Para voltar
 *     tem de ser convidado outra vez. Isto fica guardado do lado do servidor,
 *     na tabela `equipa_historico` (ver `supabase/schema_historico_equipa.sql`).
 *
 * O ecrã mostra os dois juntos, por ordem do mais recente, porque a pergunta de
 * quem os procura é uma só: «quem é que teve acesso a isto, e até quando?».
 * O que os separa aparece na linha de cada um — e é o que decide se ainda dá
 * para reabrir a porta ou se é preciso uma chave nova.
 */

import type { RoleMembro } from './types';

/** Uma saída, como o servidor a guarda. */
export type SaidaEquipa = {
  /** Id da linha do histórico. */
  id: string;
  exploracaoId: string;
  /** Ausente quando a conta foi apagada entretanto. */
  userId?: string;
  /** O nome à hora da saída — o servidor guarda-o (ver o schema). */
  nome: string;
  role: RoleMembro;
  entrouEm?: string;
  saiuEm: string;
  saiuPor?: string;
  motivo: MotivoSaida;
};

export type MotivoSaida = 'removido' | 'saiu';

/** Um vínculo que ainda existe mas já não dá acesso: o prazo caiu. */
export type VinculoExpirado = {
  /** Id da linha de `membro_exploracao` — é o que se reabre. */
  membroId: string;
  exploracaoId: string;
  userId: string;
  nome: string;
  role: RoleMembro;
  criadoEm?: string;
  /** A hora a que o acesso caiu. */
  expiraEm: string;
};

export type EntradaHistorico = {
  /** Chave estável para a lista. */
  chave: string;
  /**
   * `expirado` — ainda tem vínculo, só lhe falta tempo: reabre-se.
   * `saiu` — já não tem vínculo nenhum: só volta com um convite novo.
   */
  tipo: 'expirado' | 'saiu';
  exploracaoId: string;
  nomeExploracao: string;
  userId?: string;
  nome: string;
  role: RoleMembro;
  /** Quando começou, se se souber. */
  entrouEm?: string;
  /** Quando deixou de ter acesso: a hora da saída, ou a hora a que o prazo caiu. */
  fimEm: string;
  /** Só faz sentido em quem saiu. */
  motivo?: MotivoSaida;
  /** Só em quem ainda tem vínculo — é por ele que se lhe dá mais tempo. */
  membroId?: string;
};

/**
 * As duas famílias numa só lista, do mais recente para trás.
 *
 * `nomeExploracao` entra de fora porque este módulo não conhece explorações —
 * quem chama tem-nas todas à mão e não vale a pena um segundo pedido por linha.
 */
export function juntarHistorico(
  saidas: SaidaEquipa[],
  expirados: VinculoExpirado[],
  nomeExploracao: (exploracaoId: string) => string,
): EntradaHistorico[] {
  const entradas: EntradaHistorico[] = [
    ...expirados.map<EntradaHistorico>((v) => ({
      chave: `expirado:${v.membroId}`,
      tipo: 'expirado',
      exploracaoId: v.exploracaoId,
      nomeExploracao: nomeExploracao(v.exploracaoId),
      userId: v.userId,
      nome: v.nome,
      role: v.role,
      entrouEm: v.criadoEm,
      fimEm: v.expiraEm,
      membroId: v.membroId,
    })),
    ...saidas.map<EntradaHistorico>((s) => ({
      chave: `saida:${s.id}`,
      tipo: 'saiu',
      exploracaoId: s.exploracaoId,
      nomeExploracao: nomeExploracao(s.exploracaoId),
      userId: s.userId,
      nome: s.nome,
      role: s.role,
      entrouEm: s.entrouEm,
      fimEm: s.saiuEm,
      motivo: s.motivo,
    })),
  ];

  // Do mais recente para trás: quem abre isto quer quase sempre a última coisa
  // que aconteceu ("o veterinário de ontem ainda dá para reabrir?").
  return entradas.sort((a, b) => b.fimEm.localeCompare(a.fimEm));
}

/**
 * O que aconteceu a esta pessoa, em palavras.
 *
 * `formatarData` entra de fora (é o `formatDataHora` dos helpers) para este
 * módulo continuar sem dependências e testável com uma data fixa.
 */
export function rotuloFim(
  entrada: EntradaHistorico,
  formatarData: (iso: string) => string,
): string {
  if (entrada.tipo === 'expirado') return `Acesso terminou a ${formatarData(entrada.fimEm)}`;
  if (entrada.motivo === 'saiu') return `Saiu da equipa a ${formatarData(entrada.fimEm)}`;
  return `Removido da equipa a ${formatarData(entrada.fimEm)}`;
}

/**
 * Quanto tempo esteve: "esteve 3 meses", "esteve 1 dia".
 *
 * Devolve `null` quando não se sabe quando entrou — as linhas mais antigas
 * podem não ter data de entrada, e um "esteve 0 dias" inventado é pior do que
 * não dizer nada.
 *
 * As contas são aproximadas de propósito (um mês vale 30 dias): isto responde a
 * "foi uma visita ou foi uma época?", não à folha de ponto.
 */
export function quantoEsteve(entrada: EntradaHistorico): string | null {
  if (!entrada.entrouEm) return null;
  const inicio = new Date(entrada.entrouEm).getTime();
  const fim = new Date(entrada.fimEm).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fim)) return null;
  const ms = fim - inicio;
  // Uma passagem que acabou antes de começar é engano de relógio, não uma
  // passagem de duração negativa.
  if (ms < 0) return null;

  const horas = Math.round(ms / 3_600_000);
  if (horas < 1) return 'esteve menos de uma hora';
  if (horas < 48) return horas === 1 ? 'esteve 1 hora' : `esteve ${horas} horas`;

  const dias = Math.round(ms / 86_400_000);
  if (dias < 60) return `esteve ${dias} dias`;

  const meses = Math.round(dias / 30);
  if (meses < 24) return `esteve ${meses} meses`;

  return `esteve ${Math.round(meses / 12)} anos`;
}

/** Quantos há de cada família, para a linha de resumo do topo. */
export function contarHistorico(entradas: EntradaHistorico[]): {
  expirados: number;
  saidos: number;
} {
  return {
    expirados: entradas.filter((e) => e.tipo === 'expirado').length,
    saidos: entradas.filter((e) => e.tipo === 'saiu').length,
  };
}
