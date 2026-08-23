/**
 * As conversas ligadas ao servidor: estado, leitura, escrita e tempo real.
 * ------------------------------------------------------------------
 * As contas e os formatos vivem no `chat.ts` (lógica pura, testada); aqui fica
 * o que precisa de React, de rede e de uma subscrição aberta. É a mesma
 * divisão do `agenda.ts` / `useAgenda.ts`.
 *
 * TRÊS DECISÕES QUE EXPLICAM O RESTO
 *
 * 1. UMA LOJA DE MÓDULO, e não um Provider nem um `useState` dentro do hook.
 *    O contador de mensagens por ler aparece na barra de baixo, que está
 *    montada em todos os ecrãs, e a conversa aberta é outro ecrã por cima
 *    dela: com estado por hook, o número da barra só mudava quando alguém lhe
 *    desse a volta. Foi o erro que a agenda já tinha dado (ver o cabeçalho da
 *    loja no `useAgenda.ts`).
 *
 * 2. A ESCRITA É OTIMISTA E TEM FILA, ao contrário da agenda e dos documentos.
 *    Marcar uma reunião faz-se à mesa, com rede; mandar um recado faz-se no
 *    curral, e a app tem de o aceitar mesmo sem ligação. A mensagem aparece
 *    logo com a marca de "por enviar" e sai assim que houver rede. Uma
 *    mensagem que só se pudesse escrever com rede era uma mensagem que quem
 *    anda no campo escreveria noutra app.
 *
 * 3. UMA SÓ SUBSCRIÇÃO DE TEMPO REAL para a app inteira, aos inserts de
 *    `mensagem`. A RLS filtra-a por sessão (só chega o que esta pessoa podia
 *    ler de qualquer maneira), portanto a mesma subscrição serve o contador da
 *    barra e a conversa aberta. Uma por ecrã dava tantas ligações abertas
 *    quantos ecrãs, e o plano tem um teto.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  mesclarMensagens,
  ordenarConversas,
  totalNaoLidas,
  type Conversa,
  type MembroConversa,
  type Mensagem,
  type PessoaChat,
} from './chat';
import { armazenamentoDisponivel, guardar, ler } from './armazenamento';
import { useAuth } from './auth';
import { CHAVES, pareceErroDeRede } from './cacheLocal';
import { supabase, supabaseConfigurado } from './supabase';

import type { RoleMembro } from './types';

/**
 * Quantas mensagens de cada conversa ficam guardadas no aparelho.
 *
 * Chega para reabrir a conversa sem rede e ver o que se combinou. O resto está
 * no servidor e vem quando houver ligação: o que se guarda aqui é para poder
 * LER offline, não um segundo arquivo a manter.
 */
const MAX_CACHE = 60;

/** Quantas mensagens se pedem de cada vez ao abrir uma conversa. */
const PAGINA = 60;

/* ------------------------------------------------------------------ *
 *  Tipos das linhas do servidor
 * ------------------------------------------------------------------ */

type LinhaConversa = {
  c_id: string;
  c_tipo: 'grupo' | 'privada';
  c_nome: string | null;
  c_exploracao: string | null;
  c_outro: string | null;
  c_ultima_em: string;
  c_ultimo_texto: string | null;
  c_ultimo_autor: string | null;
  c_ultimo_apagado: boolean | null;
  c_nao_lidas: number | null;
  c_silenciada: boolean | null;
  c_ativa: boolean | null;
};

type LinhaMensagem = {
  id: string;
  conversa_id: string;
  autor: string | null;
  texto: string;
  criado_em: string;
  apagada_em: string | null;
};

function toConversa(r: LinhaConversa): Conversa {
  return {
    id: r.c_id,
    tipo: r.c_tipo,
    nome: r.c_nome?.trim() || undefined,
    exploracaoId: r.c_exploracao ?? undefined,
    outro: r.c_outro ?? undefined,
    ultimaEm: r.c_ultima_em,
    ultimoTexto: r.c_ultimo_texto ?? undefined,
    ultimoAutor: r.c_ultimo_autor ?? undefined,
    ultimoApagado: r.c_ultimo_apagado === true,
    naoLidas: r.c_nao_lidas ?? 0,
    silenciada: r.c_silenciada === true,
    ativa: r.c_ativa !== false,
  };
}

function toMensagem(r: LinhaMensagem): Mensagem {
  return {
    id: r.id,
    conversaId: r.conversa_id,
    autor: r.autor ?? undefined,
    texto: r.texto,
    criadoEm: r.criado_em,
    apagadaEm: r.apagada_em ?? undefined,
  };
}

/** UUID v4, para a mensagem já ter id antes de sair do aparelho. */
function novoId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ------------------------------------------------------------------ *
 *  Cache local (espelho para ler offline)
 * ------------------------------------------------------------------ */

type Guardado = {
  conversas: Conversa[];
  mensagens: Record<string, Mensagem[]>;
};

function lerCache(): Guardado {
  const bruto = ler(CHAVES.chat);
  if (!bruto) return { conversas: [], mensagens: {} };
  try {
    const g = JSON.parse(bruto) as Partial<Guardado>;
    return {
      conversas: Array.isArray(g.conversas) ? g.conversas : [],
      mensagens: g.mensagens && typeof g.mensagens === 'object' ? g.mensagens : {},
    };
  } catch {
    return { conversas: [], mensagens: {} };
  }
}

function guardarCache(): void {
  if (!armazenamentoDisponivel) return;
  // Só as últimas de cada conversa. Sem este corte, a cache crescia com a
  // conversa e o arranque ia ficando mais lento sem ninguém dar por isso.
  const cortadas: Record<string, Mensagem[]> = {};
  for (const [id, lista] of Object.entries(instantaneo.mensagens)) {
    cortadas[id] = lista.slice(-MAX_CACHE);
  }
  guardar(
    CHAVES.chat,
    JSON.stringify({ conversas: instantaneo.conversas, mensagens: cortadas } satisfies Guardado),
  );
}

/* ---- A fila do que ainda não saiu deste aparelho ---- */

type PorEnviar = { id: string; conversaId: string; texto: string; criadoEm: string };

function lerFila(): PorEnviar[] {
  const bruto = ler(CHAVES.chatFila);
  if (!bruto) return [];
  try {
    const arr = JSON.parse(bruto) as PorEnviar[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarFila(fila: PorEnviar[]): void {
  if (armazenamentoDisponivel) guardar(CHAVES.chatFila, JSON.stringify(fila));
}

/* ---- Avisar de mensagens novas (preferência da conta, neste aparelho) ---- */

function lerAvisos(): boolean {
  return ler(CHAVES.chatAjustes) !== 'nao';
}

export function definirAvisosDeMensagens(ativo: boolean): void {
  if (armazenamentoDisponivel) guardar(CHAVES.chatAjustes, ativo ? 'sim' : 'nao');
  definir({ avisar: ativo });
}

/* ------------------------------------------------------------------ *
 *  A loja
 * ------------------------------------------------------------------ */

type Instantaneo = {
  conversas: Conversa[];
  /** Por conversa, da mais antiga para a mais recente. */
  mensagens: Record<string, Mensagem[]>;
  pessoas: PessoaChat[];
  aCarregar: boolean;
  erro: string | null;
  avisar: boolean;
};

const inicial = armazenamentoDisponivel ? lerCache() : { conversas: [], mensagens: {} };

let instantaneo: Instantaneo = {
  conversas: inicial.conversas,
  mensagens: inicial.mensagens,
  pessoas: [],
  aCarregar: false,
  erro: null,
  avisar: armazenamentoDisponivel ? lerAvisos() : true,
};

const ouvintes = new Set<() => void>();

function definir(parcial: Partial<Instantaneo>): void {
  instantaneo = { ...instantaneo, ...parcial };
  for (const o of ouvintes) o();
}

function subscrever(o: () => void): () => void {
  ouvintes.add(o);
  return () => {
    ouvintes.delete(o);
  };
}

const instantaneoAtual = () => instantaneo;

/**
 * Quem sou eu, para o tempo real saber se a mensagem que chegou é minha.
 *
 * Numa variável de módulo porque o `on(...)` do canal é chamado de fora do
 * React e não tem por onde ler um hook.
 */
let meuId = '';

/**
 * De quem são as conversas que estão EM MEMÓRIA.
 *
 * Arranca no dono da cache do disco, que é de quem o `instantaneo` acabou de
 * ler. Serve para apanhar a troca de conta: o `limparCache()` do `auth.tsx`
 * limpa o disco, mas este módulo já foi importado e continuaria com a lista
 * do anterior no ecrã até o servidor responder. É o mesmo engano que já se fez
 * com os ambientes (ver `gado-cache-por-projeto`), e num chat seria mostrar
 * conversas de outra pessoa.
 */
let donoEmMemoria = armazenamentoDisponivel ? (ler(CHAVES.dono) ?? '') : '';

/** A conversa que está ABERTA no ecrã, se alguma. */
let conversaAberta: string | null = null;

/** Marca (ou desmarca) a conversa aberta. Chamado pelo ecrã da conversa. */
export function definirConversaAberta(id: string | null): void {
  conversaAberta = id;
}

/* ---- Aviso de mensagem nova (o toast, enquanto não há push) ---- */

type AoChegar = (m: Mensagem, c?: Conversa) => void;
const aoChegar = new Set<AoChegar>();

/**
 * Avisa quando chega uma mensagem que merece um aviso à frente de quem está a
 * usar a app: de outra pessoa, numa conversa que não está aberta e não está
 * silenciada. Quem se subscreve é o `AnfitriaoMensagens`, montado na raiz.
 *
 * Isto NÃO é notificação: a app tem de estar aberta. A notificação a sério
 * (com a app fechada) é push, precisa de servidor e de um build novo, e é a
 * fase seguinte deste trabalho.
 */
export function subscreverMensagemNova(cb: AoChegar): () => void {
  aoChegar.add(cb);
  return () => {
    aoChegar.delete(cb);
  };
}

/* ------------------------------------------------------------------ *
 *  Servidor
 * ------------------------------------------------------------------ */

function ligado(): boolean {
  return supabaseConfigurado && !!supabase && !!meuId;
}

/** A lista de conversas, com a contagem do que falta ler. */
async function puxarConversas(): Promise<void> {
  if (!ligado() || !supabase) {
    definir({ aCarregar: false });
    return;
  }
  definir({ aCarregar: true });
  try {
    const { data, error } = await supabase.rpc('minhas_conversas');
    if (error) throw new Error(error.message);
    const lista = ordenarConversas(((data ?? []) as LinhaConversa[]).map(toConversa));
    definir({ conversas: lista, erro: null, aCarregar: false });
    guardarCache();
  } catch (e) {
    // Fica o que está em cache: o chat continua a abrir e a ler-se sem rede.
    definir({ erro: e instanceof Error ? e.message : String(e), aCarregar: false });
  }
  void escoarFila();
}

/** Com quem posso começar uma conversa nova. */
async function puxarPessoas(): Promise<void> {
  if (!ligado() || !supabase) return;
  const { data, error } = await supabase.rpc('pessoas_para_conversar');
  if (error) return;
  const lista = ((data ?? []) as { u_id: string; u_nome: string; u_papel: string }[]).map((r) => ({
    id: r.u_id,
    nome: r.u_nome,
    papel: (r.u_papel || '') as RoleMembro | '',
  }));
  definir({ pessoas: lista });
}

/** As mensagens de uma conversa (as últimas `PAGINA`). */
async function puxarMensagens(conversaId: string): Promise<void> {
  if (!ligado() || !supabase) return;
  const { data, error } = await supabase
    .from('mensagem')
    .select('id, conversa_id, autor, texto, criado_em, apagada_em')
    .eq('conversa_id', conversaId)
    .order('criado_em', { ascending: false })
    .limit(PAGINA);
  if (error) return;
  const vindas = ((data ?? []) as LinhaMensagem[]).map(toMensagem);
  guardarMensagens(conversaId, vindas);
}

/** Junta mensagens à conversa e guarda. */
function guardarMensagens(conversaId: string, novas: Mensagem[]): void {
  const atuais = instantaneo.mensagens[conversaId] ?? [];
  definir({
    mensagens: { ...instantaneo.mensagens, [conversaId]: mesclarMensagens(atuais, novas) },
  });
  guardarCache();
}

/* ---- A fila ---- */

/**
 * Tenta enviar o que está à espera. Corre ao abrir a app, depois de cada
 * leitura com sucesso e sempre que o tempo real dá sinal de vida (uma
 * mensagem que chega é a prova de que há ligação).
 *
 * Uma mensagem recusada pelo SERVIDOR (a pessoa saiu do grupo, o prazo do
 * veterinário acabou) sai da fila: repeti-la para sempre era encher a fila com
 * uma coisa que nunca vai passar. Uma que falhou por REDE fica.
 */
let aEscoar = false;

async function escoarFila(): Promise<void> {
  if (aEscoar || !ligado() || !supabase) return;
  const fila = lerFila();
  if (fila.length === 0) return;
  aEscoar = true;
  const ficam: PorEnviar[] = [];
  const recusadas: PorEnviar[] = [];
  try {
    for (const p of fila) {
      // Sem `criado_em`: a hora é do servidor (ver a coluna, no
      // `schema_chat.sql`). Uma mensagem que esteve dois dias na fila fica com
      // a hora a que saiu daqui, que é a hora a que os outros a leram.
      const { error } = await supabase.from('mensagem').insert({
        id: p.id,
        conversa_id: p.conversaId,
        autor: meuId,
        texto: p.texto,
      });
      if (!error) continue;
      if (pareceErroDeRede(error.message)) ficam.push(p);
      else recusadas.push(p);
    }
  } finally {
    aEscoar = false;
  }
  guardarFila(ficam);

  // As que passaram deixam de estar "por enviar"; as recusadas saem do ecrã,
  // senão ficavam ali para sempre a parecer que iam sair a qualquer momento.
  const idsRecusados = new Set(recusadas.map((r) => r.id));
  const idsFicam = new Set(ficam.map((r) => r.id));
  const mensagens: Record<string, Mensagem[]> = {};
  for (const [conv, lista] of Object.entries(instantaneo.mensagens)) {
    mensagens[conv] = lista
      .filter((m) => !idsRecusados.has(m.id))
      .map((m) => (m.porEnviar && !idsFicam.has(m.id) ? { ...m, porEnviar: undefined } : m));
  }
  definir({ mensagens });
  guardarCache();
  if (recusadas.length > 0) void puxarConversas();
}

/** Quantas mensagens deste aparelho estão à espera de rede. */
export function porEnviarNaFila(): number {
  return armazenamentoDisponivel ? lerFila().length : 0;
}

/* ------------------------------------------------------------------ *
 *  Tempo real
 * ------------------------------------------------------------------ */

let canal: { unsubscribe: () => void } | null = null;

/** Quantos `useChat()` estão montados. O canal vive enquanto houver um. */
let montados = 0;

function ligarTempoReal(): void {
  if (canal || !ligado() || !supabase) return;
  canal = supabase
    .channel('chat-mensagens')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensagem' },
      (payload: { new: LinhaMensagem }) => {
        const m = toMensagem(payload.new);
        aplicarChegada(m);
      },
    )
    .subscribe();
}

function desligarTempoReal(): void {
  canal?.unsubscribe();
  canal = null;
}

/**
 * O que fazer com uma mensagem que acabou de chegar.
 *
 * A lista de conversas é atualizada AQUI em vez de se pedir outra vez ao
 * servidor: uma mensagem por segundo numa conversa animada dava um pedido por
 * segundo, e tudo o que a lista precisa de saber vem dentro da própria
 * mensagem. O pedido só se faz quando chega algo de uma conversa que este
 * aparelho ainda não conhece, que é o caso de alguém abrir uma privada nova.
 */
function aplicarChegada(m: Mensagem): void {
  const minha = m.autor === meuId;
  const conhecida = instantaneo.conversas.find((c) => c.id === m.conversaId);

  guardarMensagens(m.conversaId, [m]);

  if (!conhecida) {
    void puxarConversas();
  } else {
    const aberta = conversaAberta === m.conversaId;
    const conversas = ordenarConversas(
      instantaneo.conversas.map((c) =>
        c.id === m.conversaId
          ? {
              ...c,
              ultimaEm: m.criadoEm,
              ultimoTexto: m.texto,
              ultimoAutor: m.autor,
              ultimoApagado: false,
              naoLidas: minha || aberta ? c.naoLidas : c.naoLidas + 1,
            }
          : c,
      ),
    );
    definir({ conversas });
    guardarCache();
    // Com a conversa aberta à frente dos olhos, ler é imediato.
    if (aberta && !minha) void marcarLido(m.conversaId);
  }

  if (
    !minha &&
    instantaneo.avisar &&
    conversaAberta !== m.conversaId &&
    !conhecida?.silenciada
  ) {
    for (const cb of aoChegar) cb(m, conhecida);
  }

  // Chegou alguma coisa, logo há rede: boa altura para despachar o que ficou.
  void escoarFila();
}

/* ------------------------------------------------------------------ *
 *  Ações
 * ------------------------------------------------------------------ */

/**
 * Marca a conversa como lida até agora.
 *
 * Pelo RPC e não por um `update`: quem escreve o `lido_ate` é o servidor, com
 * a hora dele. Com a hora do telemóvel, um aparelho adiantado dava por lidas
 * mensagens que ainda não tinham chegado.
 */
export async function marcarLido(conversaId: string): Promise<void> {
  const conversas = instantaneo.conversas.map((c) =>
    c.id === conversaId ? { ...c, naoLidas: 0 } : c,
  );
  definir({ conversas });
  guardarCache();
  if (!ligado() || !supabase) return;
  await supabase.rpc('marcar_conversa_lida', { conv: conversaId });
}

export type UseChat = {
  conversas: Conversa[];
  pessoas: PessoaChat[];
  aCarregar: boolean;
  erro: string | null;
  naoLidas: number;
  avisar: boolean;
  recarregar: () => Promise<void>;
  /** Abre (ou reabre) a conversa privada com alguém. Devolve o id. */
  abrirCom: (outro: string) => Promise<string>;
  silenciar: (conversaId: string, valor: boolean) => Promise<void>;
  mudarNome: (conversaId: string, nome: string) => Promise<void>;
  membrosDe: (conversaId: string) => Promise<MembroConversa[]>;
  removerDoGrupo: (conversaId: string, quem: string) => Promise<void>;
  reporNoGrupo: (conversaId: string, quem: string) => Promise<void>;
  bloquear: (outro: string) => Promise<void>;
  desbloquear: (outro: string) => Promise<void>;
  bloqueados: () => Promise<string[]>;
};

/**
 * O estado das conversas, partilhado por todos os ecrãs que o usam.
 *
 * Montar este hook é o que liga o tempo real: basta um ecrã (a barra de baixo
 * conta) para a app inteira ficar a receber.
 */
export function useChat(): UseChat {
  const { sessao } = useAuth();
  const userId = sessao?.user?.id ?? '';
  meuId = userId;

  const { conversas, pessoas, aCarregar, erro, avisar } = useSyncExternalStore(
    subscrever,
    instantaneoAtual,
    instantaneoAtual,
  );

  useEffect(() => {
    if (!userId) {
      desligarTempoReal();
      return;
    }
    if (donoEmMemoria !== userId) {
      donoEmMemoria = userId;
      definir({ conversas: [], mensagens: {}, pessoas: [], erro: null });
    }
    void puxarConversas();
    void puxarPessoas();
    // O canal é da APP e não deste hook: fechá-lo na limpeza deixava a app sem
    // tempo real de cada vez que uma conversa se fechasse (o ecrã da conversa
    // também monta este hook). Conta-se quantos estão montados e fecha-se
    // quando não sobra nenhum, que é o que acontece ao sair da conta.
    montados += 1;
    ligarTempoReal();
    return () => {
      montados -= 1;
      if (montados <= 0) desligarTempoReal();
    };
  }, [userId]);

  const abrirCom = useCallback(async (outro: string): Promise<string> => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { data, error } = await supabase.rpc('abrir_conversa', { outro });
    if (error) throw new Error(error.message);
    await puxarConversas();
    return data as string;
  }, []);

  const silenciar = useCallback(async (conversaId: string, valor: boolean) => {
    const conversas = instantaneo.conversas.map((c) =>
      c.id === conversaId ? { ...c, silenciada: valor } : c,
    );
    definir({ conversas });
    guardarCache();
    if (!ligado() || !supabase) return;
    const { error } = await supabase
      .from('conversa_membro')
      .update({ silenciada: valor })
      .eq('conversa_id', conversaId)
      .eq('user_id', meuId);
    if (error) throw new Error(error.message);
  }, []);

  const mudarNome = useCallback(async (conversaId: string, nome: string) => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { error } = await supabase.rpc('mudar_nome_do_grupo', { conv: conversaId, novo: nome });
    if (error) throw new Error(error.message);
    await puxarConversas();
  }, []);

  const membrosDe = useCallback(async (conversaId: string): Promise<MembroConversa[]> => {
    if (!ligado() || !supabase) return [];
    const { data, error } = await supabase.rpc('membros_da_conversa', { conv: conversaId });
    if (error) throw new Error(error.message);
    return ((data ?? []) as { u_id: string; u_nome: string; u_papel: string; u_saiu: boolean }[]).map(
      (r) => ({
        id: r.u_id,
        nome: r.u_nome,
        papel: (r.u_papel || '') as RoleMembro | '',
        saiu: r.u_saiu,
      }),
    );
  }, []);

  const removerDoGrupo = useCallback(async (conversaId: string, quem: string) => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { error } = await supabase.rpc('remover_do_grupo', { conv: conversaId, quem });
    if (error) throw new Error(error.message);
  }, []);

  const reporNoGrupo = useCallback(async (conversaId: string, quem: string) => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { error } = await supabase.rpc('repor_no_grupo', { conv: conversaId, quem });
    if (error) throw new Error(error.message);
  }, []);

  const bloquear = useCallback(async (outro: string) => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { error } = await supabase
      .from('bloqueio')
      .insert({ bloqueador: meuId, bloqueado: outro });
    if (error) throw new Error(error.message);
    await puxarPessoas();
    await puxarConversas();
  }, []);

  const desbloquear = useCallback(async (outro: string) => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { error } = await supabase
      .from('bloqueio')
      .delete()
      .eq('bloqueador', meuId)
      .eq('bloqueado', outro);
    if (error) throw new Error(error.message);
    await puxarPessoas();
    await puxarConversas();
  }, []);

  const bloqueados = useCallback(async (): Promise<string[]> => {
    if (!ligado() || !supabase) return [];
    const { data, error } = await supabase.from('bloqueio').select('bloqueado');
    if (error) return [];
    return ((data ?? []) as { bloqueado: string }[]).map((r) => r.bloqueado);
  }, []);

  const naoLidas = useMemo(() => totalNaoLidas(conversas), [conversas]);

  return {
    conversas,
    pessoas,
    aCarregar,
    erro,
    naoLidas,
    avisar,
    recarregar: puxarConversas,
    abrirCom,
    silenciar,
    mudarNome,
    membrosDe,
    removerDoGrupo,
    reporNoGrupo,
    bloquear,
    desbloquear,
    bloqueados,
  };
}

export type UseConversa = {
  conversa?: Conversa;
  mensagens: Mensagem[];
  aCarregar: boolean;
  enviar: (texto: string) => Promise<void>;
  apagar: (mensagemId: string) => Promise<void>;
  denunciar: (mensagemId: string, motivo?: string) => Promise<void>;
};

/** Uma conversa aberta: o que lá está escrito e o que se pode fazer nela. */
export function useConversa(conversaId: string): UseConversa {
  const { sessao } = useAuth();
  const userId = sessao?.user?.id ?? '';
  meuId = userId;

  const { conversas, mensagens: todas, aCarregar } = useSyncExternalStore(
    subscrever,
    instantaneoAtual,
    instantaneoAtual,
  );

  const conversa = conversas.find((c) => c.id === conversaId);
  const mensagens = useMemo(() => todas[conversaId] ?? [], [todas, conversaId]);

  useEffect(() => {
    if (!conversaId || !userId) return;
    definirConversaAberta(conversaId);
    void puxarMensagens(conversaId).then(() => marcarLido(conversaId));
    return () => {
      definirConversaAberta(null);
    };
  }, [conversaId, userId]);

  const enviar = useCallback(
    async (texto: string) => {
      const limpo = texto.trim();
      if (!limpo) return;
      const m: Mensagem = {
        id: novoId(),
        conversaId,
        autor: userId,
        texto: limpo,
        criadoEm: new Date().toISOString(),
        porEnviar: true,
      };
      // Aparece já no ecrã (ver a decisão 2, no cabeçalho).
      guardarMensagens(conversaId, [m]);

      if (!ligado() || !supabase) {
        guardarFila([...lerFila(), { id: m.id, conversaId, texto: limpo, criadoEm: m.criadoEm }]);
        return;
      }

      const { data, error } = await supabase
        .from('mensagem')
        .insert({ id: m.id, conversa_id: conversaId, autor: userId, texto: limpo })
        // A hora certa (a do servidor) vem de volta na mesma ida, para o balão
        // não ficar com a do telemóvel. Ver a coluna `criado_em` no schema.
        .select('id, conversa_id, autor, texto, criado_em, apagada_em')
        .single();

      if (!error) {
        const confirmada = data ? toMensagem(data as LinhaMensagem) : { ...m, porEnviar: undefined };
        guardarMensagens(conversaId, [confirmada]);
        return;
      }
      if (pareceErroDeRede(error.message)) {
        guardarFila([...lerFila(), { id: m.id, conversaId, texto: limpo, criadoEm: m.criadoEm }]);
        return;
      }
      // Recusada pelo servidor (saiu do grupo, prazo terminado, conta
      // suspensa). Sai do ecrã e a razão sobe para quem chamou.
      const lista = (instantaneo.mensagens[conversaId] ?? []).filter((x) => x.id !== m.id);
      definir({ mensagens: { ...instantaneo.mensagens, [conversaId]: lista } });
      guardarCache();
      throw new Error(error.message);
    },
    [conversaId, userId],
  );

  const apagar = useCallback(
    async (mensagemId: string) => {
      if (!ligado() || !supabase) throw new Error('sem ligação à conta');
      const quando = new Date().toISOString();
      const { error } = await supabase
        .from('mensagem')
        .update({ apagada_em: quando })
        .eq('id', mensagemId);
      if (error) throw new Error(error.message);
      const lista = (instantaneo.mensagens[conversaId] ?? []).map((m) =>
        m.id === mensagemId ? { ...m, apagadaEm: quando } : m,
      );
      definir({ mensagens: { ...instantaneo.mensagens, [conversaId]: lista } });
      guardarCache();
      void puxarConversas();
    },
    [conversaId],
  );

  const denunciar = useCallback(async (mensagemId: string, motivo?: string) => {
    if (!ligado() || !supabase) throw new Error('sem ligação à conta');
    const { error } = await supabase.rpc('denunciar_mensagem', {
      msg: mensagemId,
      motivo_txt: motivo ?? null,
    });
    if (error) throw new Error(error.message);
  }, []);

  return { conversa, mensagens, aCarregar, enviar, apagar, denunciar };
}

/**
 * Só o número por ler, para a barra de baixo.
 *
 * Existe à parte do `useChat()` para a barra não voltar a desenhar-se de cada
 * vez que uma mensagem entra numa conversa: o que ela mostra é um número, e é
 * só a esse que se subscreve.
 */
export function useNaoLidas(): number {
  return useSyncExternalStore(
    subscrever,
    () => totalNaoLidas(instantaneo.conversas),
    () => 0,
  );
}

/*
 * Não há `esquecerChat()`. Sair da conta já limpa isto por três caminhos que
 * existiam antes deste ficheiro: o `limparCache()` do `auth.tsx` apaga as duas
 * chaves do disco, o `donoEmMemoria` esvazia a memória à entrada da conta
 * seguinte, e a contagem de montados fecha o canal do tempo real quando o
 * último ecrã se desmonta. Uma quarta função a fazer o mesmo era mais um sítio
 * para alguém se esquecer de chamar.
 */
