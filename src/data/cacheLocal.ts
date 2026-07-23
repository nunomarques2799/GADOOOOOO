/**
 * Cache local + fila de sincronização (outbox) para funcionamento offline.
 * ------------------------------------------------------------------
 * Com sessão Supabase, os dados são gravados aqui para poderem ser consultados
 * e editados sem rede — no campo/no mato. As alterações feitas offline entram
 * numa fila e são enviadas ao Supabase quando a ligação volta.
 *
 * Funciona em TODAS as plataformas: no telemóvel por cima do SQLite e na
 * web/Electron por cima do `localStorage` (ver `armazenamento.ts` e
 * `armazenamento.web.ts`). Até 2026-07-18 isto dependia diretamente do
 * `localStorage`, que não existe em React Native — o resultado era que no
 * Android, com sessão iniciada, não havia cache NEM SQLite e cada gravação
 * exigia rede, apesar de a app prometer "funciona sem internet".
 */

import { armazenamentoDisponivel, guardar, ler, remover } from './armazenamento';
import type { Animal, Evento, Exploracao, Movimento, Terreno } from './types';

/** Instantâneo dos dados guardados localmente (mesma forma que o Snapshot). */
export type DadosGado = {
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
  movimentos: Movimento[];
};

export type Entidade = 'exploracao' | 'terreno' | 'animal' | 'evento' | 'movimento';

/** Operação por sincronizar: gravar (upsert) ou eliminar uma entidade. */
export type OpPendente =
  | {
      op: 'upsert';
      entidade: Entidade;
      dados: Exploracao | Terreno | Animal | Evento | Movimento;
    }
  | { op: 'delete'; entidade: Entidade; id: string };

/**
 * Porque é que a operação não passou. Muda a mensagem e o que se pode fazer:
 *   - `recusada` — o servidor disse que não (RLS, validação). Não há volta.
 *   - `conflito` — outra pessoa alterou o mesmo registo enquanto estávamos
 *     sem rede. A alteração dela está lá; a nossa é que se perdeu.
 */
export type MotivoFalha = 'recusada' | 'conflito';

/** Uma operação que o servidor não aceitou, guardada para o criador a ver. */
export type OpFalhada = {
  op: OpPendente;
  /** Mensagem do servidor (RLS, validação, conflito) tal como veio. */
  erro: string;
  /** Momento em que a tentativa falhou, em ISO. */
  em: string;
  /** Ausente nos registos gravados antes de esta distinção existir. */
  motivo?: MotivoFalha;
};

/**
 * Quem sou e a que explorações pertenço, tal como o servidor respondeu da
 * última vez. Guardado porque isto decide se a app abre — e sem ele, arrancar
 * sem rede fazia parecer que o utilizador não tinha acesso a nada.
 */
export type AcessoLocal = {
  estadoPerfil: 'pendente' | 'ativo';
  isSuperadmin: boolean;
  membros: unknown[];
};

/**
 * Referência do projeto Supabase a que esta app está ligada — o `wkax…` de
 * `https://wkax….supabase.co`. As chaves da cache levam-na à frente.
 *
 * Até 2026-07-23 não levavam, e o efeito só se vê quando existem dois
 * ambientes: o mesmo `localhost:8081` que outrora falou com PRODUÇÃO guarda a
 * cache em `gado.cache.v1`; trocar o `.env` para o projeto de testes não mexe
 * nessa chave, e a app de testes abre a mostrar o efetivo real — 28 animais,
 * as explorações de quem usa a app a sério — por baixo da faixa roxa que jura
 * que aqueles dados não são reais. É o contrário do que a faixa promete.
 *
 * Sem projeto configurado fica 'local', que é o caso da app sem Supabase.
 */
const PROJETO =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\./)?.[1] ?? 'local';

/**
 * As chaves onde tudo isto vive. Exportadas por causa dos testes: escritas à
 * mão, ficavam a apontar para as antigas assim que o prefixo mudasse, e um
 * teste que prepara uma chave que ninguém lê passa a verificar o vazio.
 */
export const CHAVES = {
  cache: `gado.${PROJETO}.cache.v1`,
  outbox: `gado.${PROJETO}.outbox.v1`,
  falhadas: `gado.${PROJETO}.falhadas.v1`,
  acesso: `gado.${PROJETO}.acesso.v1`,
} as const;

const CHAVE_CACHE = CHAVES.cache;
const CHAVE_OUTBOX = CHAVES.outbox;
const CHAVE_FALHADAS = CHAVES.falhadas;
const CHAVE_ACESSO = CHAVES.acesso;

/**
 * As chaves de antes de existirem ambientes. Só se herdam em PRODUÇÃO, e só
 * uma vez: é lá que estão os dados de quem já tinha a app instalada, incluindo
 * a fila de escritas por enviar — apagá-las às cegas era perder trabalho feito
 * offline. Em testes ficam quietas onde estão: não são para ali chamadas, e
 * mexer nelas podia estragar a cache da app de produção que partilha este
 * `localhost`.
 */
const LEGADO: [string, string][] = [
  ['gado.cache.v1', CHAVE_CACHE],
  ['gado.outbox.v1', CHAVE_OUTBOX],
  ['gado.falhadas.v1', CHAVE_FALHADAS],
  ['gado.acesso.v1', CHAVE_ACESSO],
];

let herdado = false;

/**
 * Corre uma vez, à primeira leitura — e não ao importar o módulo: o
 * armazenamento pode ainda não estar de pé, e um efeito no topo do ficheiro
 * dispara antes de quem o usa ter oportunidade de o preparar.
 */
function herdarLegado(): void {
  if (herdado) return;
  herdado = true;
  if (!armazenamentoDisponivel || process.env.EXPO_PUBLIC_AMBIENTE === 'dev') return;
  for (const [antiga, nova] of LEGADO) {
    const valor = ler(antiga);
    if (valor != null && ler(nova) == null) guardar(nova, valor);
  }
}

/** Teto da lista de falhadas — é um registo para ler, não um arquivo. */
const MAX_FALHADAS = 50;

/** true se há armazenamento local persistente. */
export const cacheDisponivel = armazenamentoDisponivel;

/** Lê o último instantâneo guardado, ou null se ainda não houver. */
export function lerCache(): DadosGado | null {
  herdarLegado();
  const bruto = ler(CHAVE_CACHE);
  if (!bruto) return null;
  try {
    const d = JSON.parse(bruto) as Partial<DadosGado>;
    // Uma cache gravada por uma versão anterior da app não traz as listas que
    // entretanto nasceram (`movimentos`). Sem estas omissões, o primeiro
    // arranque depois de atualizar rebentava a ler `.length` de undefined —
    // e é justamente o arranque em que ainda não houve resposta do servidor.
    return {
      exploracoes: d.exploracoes ?? [],
      terrenos: d.terrenos ?? [],
      animais: d.animais ?? [],
      eventos: d.eventos ?? [],
      movimentos: d.movimentos ?? [],
    };
  } catch {
    return null;
  }
}

/** Grava o instantâneo completo (chamado sempre que os dados mudam). */
export function guardarCache(dados: DadosGado): void {
  guardar(CHAVE_CACHE, JSON.stringify(dados));
}

/** Fila de operações à espera de envio ao Supabase (por ordem). */
export function lerOutbox(): OpPendente[] {
  herdarLegado();
  const bruto = ler(CHAVE_OUTBOX);
  if (!bruto) return [];
  try {
    const ops = JSON.parse(bruto) as OpPendente[];
    // Um valor corrompido não pode passar por fila: o store itera sobre isto.
    return Array.isArray(ops) ? ops : [];
  } catch {
    return [];
  }
}

export function guardarOutbox(ops: OpPendente[]): void {
  guardar(CHAVE_OUTBOX, JSON.stringify(ops));
}

/** Acrescenta uma operação ao fim da fila e devolve o novo total pendente. */
export function adicionarOutbox(op: OpPendente): number {
  const ops = [...lerOutbox(), op];
  guardarOutbox(ops);
  return ops.length;
}

/* ------------------------------------------------------------------ *
 *  Acesso (perfil + membros) — para a app abrir sem rede
 * ------------------------------------------------------------------ */

/** Último acesso conhecido, ou null se nunca chegou a haver um. */
export function lerAcesso(): AcessoLocal | null {
  herdarLegado();
  const bruto = ler(CHAVE_ACESSO);
  if (!bruto) return null;
  try {
    const a = JSON.parse(bruto) as AcessoLocal;
    // Um valor corrompido não pode virar acesso: melhor não saber nada do que
    // afirmar 'ativo' ou 'superadmin' a partir de lixo.
    if (!a || (a.estadoPerfil !== 'ativo' && a.estadoPerfil !== 'pendente')) return null;
    return { ...a, membros: Array.isArray(a.membros) ? a.membros : [] };
  } catch {
    return null;
  }
}

export function guardarAcesso(a: AcessoLocal): void {
  guardar(CHAVE_ACESSO, JSON.stringify(a));
}

/* ------------------------------------------------------------------ *
 *  Escritas recusadas pelo servidor
 * ------------------------------------------------------------------ */

/**
 * Uma operação que falhou por erro lógico (RLS, validação) não pode voltar à
 * fila — seria recusada outra vez, para sempre, e bloquearia tudo o que vem
 * atrás. Mas também não pode simplesmente desaparecer: a alteração já foi
 * mostrada ao criador como gravada. Fica aqui, para o ecrã de Sincronização a
 * mostrar e a pessoa saber o que se perdeu e porquê.
 */
export function lerFalhadas(): OpFalhada[] {
  herdarLegado();
  const bruto = ler(CHAVE_FALHADAS);
  if (!bruto) return [];
  try {
    const lista = JSON.parse(bruto) as OpFalhada[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

/** Regista uma falha e devolve o novo total. Mantém as mais recentes. */
export function registarFalhada(
  op: OpPendente,
  erro: string,
  motivo: MotivoFalha = 'recusada',
): number {
  const lista = [{ op, erro, em: new Date().toISOString(), motivo }, ...lerFalhadas()].slice(
    0,
    MAX_FALHADAS,
  );
  guardar(CHAVE_FALHADAS, JSON.stringify(lista));
  return lista.length;
}

/** Esquece as recusas (o criador já as viu). */
export function limparFalhadas(): void {
  remover(CHAVE_FALHADAS);
}

/** Descrição curta do que a operação tentava fazer, para mostrar na lista. */
export function descreverOp(op: OpPendente): string {
  const nomes: Record<Entidade, string> = {
    exploracao: 'Exploração',
    terreno: 'Terreno',
    animal: 'Animal',
    evento: 'Evento',
    movimento: 'Movimento',
  };
  const entidade = nomes[op.entidade];
  if (op.op === 'delete') return `Eliminar ${entidade.toLowerCase()}`;
  // Os nomes só existem nalgumas entidades; o evento identifica-se pelo tipo.
  const dados = op.dados as { nome?: string; tipo?: string };
  const rotulo = dados.nome ?? dados.tipo;
  return rotulo ? `${entidade}: ${rotulo}` : `Gravar ${entidade.toLowerCase()}`;
}

/**
 * Apaga os dados locais da conta. Chamado ao terminar sessão: sem isto, o
 * criador seguinte a entrar no mesmo dispositivo veria, durante o arranque, o
 * efetivo do anterior (a cache é lida antes de o servidor responder).
 */
export function limparCache(): void {
  remover(CHAVE_CACHE);
  remover(CHAVE_OUTBOX);
  remover(CHAVE_FALHADAS);
  // O acesso pertence à conta que saiu. Deixá-lo cá daria ao próximo a entrar
  // os papéis do anterior durante o arranque, antes de o servidor responder.
  remover(CHAVE_ACESSO);
}

/**
 * Heurística para distinguir falha de rede (offline → tentar mais tarde) de
 * um erro lógico do servidor (validação/RLS → não vale a pena repetir). Não
 * é infalível, mas os erros de rede do supabase-js trazem sempre "fetch"/
 * "network" na mensagem, e no offline o navigator.onLine costuma ser false.
 *
 * Em caso de dúvida é preferível classificar como rede: uma operação que fica
 * na fila é reenviada mais tarde, enquanto uma descartada perde o registo do
 * criador para sempre.
 */
export function pareceErroDeRede(msg: string): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = msg.toLowerCase();
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('failed to') ||
    m.includes('timeout') ||
    // "timed out" (com espaço) é a forma que o React Native devolve — só
    // "timeout" deixava passar um timeout genuíno para o ramo de erro lógico,
    // que DESCARTA a operação. Apanhado por teste, não em produção.
    m.includes('timed out') ||
    m.includes('connection') ||
    m.includes('unreachable') ||
    m.includes('econnreset') ||
    m.includes('conexão') ||
    m.includes('ligação') ||
    // React Native devolve estes quando o pedido morre sem resposta.
    m.includes('aborted') ||
    m.includes('sem ligação')
  );
}
