/**
 * Acesso com prazo — quanto tempo alguém fica ligado a uma exploração.
 * ------------------------------------------------------------------
 * Lógica pura (sem React, sem rede) para poder ser testada.
 *
 * Existe por causa do veterinário: é convidado para uma vinda, não para
 * sempre. O convite passa a levar consigo quantas horas o acesso dura, e a
 * coluna `membro_exploracao.expira_em` é quem decide — no servidor, dentro dos
 * helpers por onde toda a RLS passa (ver `supabase/schema_acesso_temporario.sql`).
 *
 * O que está aqui é o mesmo relógio, do lado da app: serve para NÃO mostrar
 * controlos que o servidor já não aceita, e para dizer às pessoas até quando
 * vale o que estão a ver. Quem manda continua a ser o servidor.
 */

/** Quanto tempo o acesso pode durar. Em horas, que é a unidade da coluna. */
export const DURACOES_ACESSO: { horas: number; label: string }[] = [
  { horas: 4, label: '4 horas' },
  { horas: 12, label: '12 horas' },
  { horas: 24, label: '1 dia' },
  { horas: 72, label: '3 dias' },
  { horas: 168, label: '1 semana' },
  { horas: 720, label: '1 mês' },
];

/** A duração oferecida por omissão a um veterinário: a visita de um dia. */
export const DURACAO_OMISSAO = 24;

/**
 * O acesso já terminou?
 *
 * Sem prazo (`undefined`) NUNCA expira — é o caso dos donos e dos
 * trabalhadores, e tratá-lo como expirado fechava a app a quase toda a gente.
 * Uma data que não se consegue ler também não expira, pela mesma razão: perante
 * dados estranhos, o lado seguro aqui é deixar ver (o servidor recusa na mesma
 * o que tiver de recusar) e não trancar alguém à porta por causa de um `null`
 * mal escrito.
 */
export function acessoTerminou(expiraEm?: string, agora: Date = new Date()): boolean {
  if (!expiraEm) return false;
  const fim = new Date(expiraEm).getTime();
  if (Number.isNaN(fim)) return false;
  return fim <= agora.getTime();
}

/** Falta pouco? (para avisar antes de o acesso cair, não depois) */
export function acessoQuaseAFim(
  expiraEm?: string,
  agora: Date = new Date(),
  horasDeAviso = 24,
): boolean {
  if (!expiraEm || acessoTerminou(expiraEm, agora)) return false;
  const fim = new Date(expiraEm).getTime();
  if (Number.isNaN(fim)) return false;
  return fim - agora.getTime() <= horasDeAviso * 3600_000;
}

/**
 * Quanto falta, em palavras: "faltam 3 horas", "falta 1 dia", "faltam 20 minutos".
 *
 * Devolve `null` sem prazo ou já terminado — quem chama decide o que dizer
 * nesses casos, que são frases diferentes ("Sem prazo", "Acesso terminado") e
 * não variações desta.
 */
export function faltaParaExpirar(expiraEm?: string, agora: Date = new Date()): string | null {
  if (!expiraEm || acessoTerminou(expiraEm, agora)) return null;
  const ms = new Date(expiraEm).getTime() - agora.getTime();
  if (Number.isNaN(ms)) return null;

  const minutos = Math.round(ms / 60_000);
  if (minutos < 60) return minutos === 1 ? 'falta 1 minuto' : `faltam ${minutos} minutos`;

  const horas = Math.round(ms / 3600_000);
  if (horas < 48) return horas === 1 ? 'falta 1 hora' : `faltam ${horas} horas`;

  const dias = Math.round(ms / 86_400_000);
  return `faltam ${dias} dias`;
}

/**
 * A linha que descreve o prazo de um vínculo, para a lista da equipa.
 *
 * `formatarData` entra de fora (é `formatDataHora` dos helpers) para este
 * módulo continuar sem dependências e testável com uma data fixa.
 */
export function rotuloPrazo(
  expiraEm: string | undefined,
  formatarData: (iso: string) => string,
  agora: Date = new Date(),
): string {
  if (!expiraEm) return 'Sem prazo';
  if (acessoTerminou(expiraEm, agora)) return `Acesso terminado a ${formatarData(expiraEm)}`;
  return `Acesso até ${formatarData(expiraEm)} (${faltaParaExpirar(expiraEm, agora)})`;
}

/** O rótulo de uma duração em horas ("4 horas", "3 dias"), para as confirmações. */
export function rotuloDuracao(horas: number): string {
  const conhecida = DURACOES_ACESSO.find((d) => d.horas === horas);
  if (conhecida) return conhecida.label;
  if (horas < 24) return horas === 1 ? '1 hora' : `${horas} horas`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}
