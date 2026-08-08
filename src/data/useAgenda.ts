/**
 * A agenda ligada ao servidor — estado, leitura e escrita.
 * ------------------------------------------------------------------
 * As contas de dias e as validações vivem no `agenda.ts` (lógica pura,
 * testada); aqui fica só o que precisa de React e de rede. É a mesma divisão de
 * `financas.ts` / `useFinancas.ts`.
 *
 * SINCRONIZAÇÃO. Segue o modelo das notas (`notas.ts`) e não a maquinaria de
 * outbox do gado (`store.tsx`): a fonte de verdade é o Supabase e a cache local
 * é só um espelho para ler offline. A escrita é PESSIMISTA — grava-se no
 * servidor e só depois no ecrã.
 *
 * É uma decisão, não uma falta: marcar um evento é planear, e planeia-se à mesa
 * com rede, não no meio do curral. Fingir que gravou offline para depois o
 * evento não estar lá na véspera da feira é pior do que dizer "isto precisa de
 * ligação" no momento em que se carrega no botão. O que continua a valer sem
 * rede é a LEITURA: o calendário abre com o que estiver na cache.
 *
 * O veterinário não tem agenda nenhuma — nem a vê nem escreve nela. Quem o
 * garante é a RLS (`tem_agenda()` em `supabase/schema_agenda.sql`); o que está
 * em `permissoes.ts` serve só para lhe não mostrar botões que o servidor vai
 * recusar.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

import { agruparEventosPorDia, type EntradaEvento, type EventoAgenda } from './agenda';
import { armazenamentoDisponivel, guardar, ler } from './armazenamento';
import { useAuth } from './auth';
import { CHAVES } from './cacheLocal';
import { supabase, supabaseConfigurado } from './supabase';

const CHAVE_CACHE = CHAVES.agenda;

/** UUID v4 — o formato que a coluna `id` do Postgres espera. */
function novoId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* ---- Cache local (espelho para leitura offline) ---- */

function lerCache(): EventoAgenda[] {
  const bruto = ler(CHAVE_CACHE);
  if (!bruto) return [];
  try {
    const arr = JSON.parse(bruto) as EventoAgenda[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarCache(eventos: EventoAgenda[]): void {
  if (armazenamentoDisponivel) guardar(CHAVE_CACHE, JSON.stringify(eventos));
}

/* ---- Repositório Supabase ---- */

type LinhaAgenda = {
  id: string;
  exploracao_id: string;
  criado_por: string;
  titulo: string;
  descricao?: string | null;
  dia: string;
  hora?: string | null;
  publico?: boolean | null;
  criado_em?: string | null;
};

function toEvento(r: LinhaAgenda): EventoAgenda {
  return {
    id: r.id,
    exploracaoId: r.exploracao_id,
    criadoPor: r.criado_por,
    titulo: r.titulo,
    descricao: r.descricao ?? undefined,
    // A coluna é `date` e o PostgREST devolve-a já como "aaaa-mm-dd". Não passa
    // por `new Date()` de propósito: isso lê-a como meia-noite UTC e, a oeste de
    // Greenwich, devolvia o dia anterior meio ano por ano.
    dia: r.dia,
    // A coluna é `time`, e vem como "09:00:00". O calendário mostra "09:00".
    hora: r.hora ? r.hora.slice(0, 5) : undefined,
    publico: r.publico !== false,
    criadoEm: r.criado_em ?? new Date().toISOString(),
  };
}

const COLUNAS = 'id, exploracao_id, criado_por, titulo, descricao, dia, hora, publico, criado_em';

export type UseAgenda = {
  eventos: EventoAgenda[];
  aCarregar: boolean;
  /** Razão da última falha de leitura, ou `null`. */
  erro: string | null;
  guardarEvento: (entrada: EntradaEvento) => Promise<EventoAgenda>;
  eliminarEvento: (id: string) => Promise<void>;
  recarregar: () => Promise<void>;
  /** Os eventos agrupados por dia — é o que o calendário consome. */
  porDia: Map<string, EventoAgenda[]>;
};

/* ------------------------------------------------------------------ *
 *  Estado PARTILHADO por todos os `useAgenda()`
 * ------------------------------------------------------------------ *
 *
 * Vivia dentro do hook, com o argumento de que eram poucos consumidores e
 * nenhum precisava de o partilhar. Não era verdade, e dava um erro que se via:
 * marcar um evento em `/agenda/novo` gravava no `useAgenda()` DAQUELE ecrã, e o
 * Início — que tem o seu, montado desde o arranque e que não volta a montar
 * quando o formulário se fecha por cima dele — ficava com a lista antiga. O
 * evento novo só aparecia no calendário depois de puxar o ecrã para baixo.
 *
 * Uma loja de módulo com `useSyncExternalStore` resolve-o sem Provider nenhum:
 * a assinatura do hook não muda, e quem já o usa não sabe que mudou alguma
 * coisa — só passa a ver as gravações dos outros.
 */

type Instantaneo = {
  eventos: EventoAgenda[];
  aCarregar: boolean;
  erro: string | null;
};

let instantaneo: Instantaneo = {
  // Lido no arranque, como o resto das caches: o calendário abre já preenchido,
  // sem rede e sem esperar pelo servidor.
  eventos: armazenamentoDisponivel ? lerCache() : [],
  aCarregar: false,
  erro: null,
};

const ouvintes = new Set<() => void>();

/**
 * O instantâneo TEM de manter a mesma referência entre alterações — é assim que
 * o `useSyncExternalStore` sabe que nada mudou. Por isso trocamos o objeto
 * inteiro de uma vez, em vez de mexer nos campos.
 */
function definir(parcial: Partial<Instantaneo>): void {
  instantaneo = { ...instantaneo, ...parcial };
  for (const ouvinte of ouvintes) ouvinte();
}

function subscrever(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const instantaneoAtual = () => instantaneo;

/** Estado e ações da agenda, partilhados por todos os ecrãs que o usam. */
export function useAgenda(): UseAgenda {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;
  const userId = sessao?.user?.id ?? '';

  const { eventos, aCarregar, erro } = useSyncExternalStore(
    subscrever,
    instantaneoAtual,
    // No servidor (a web pré-renderizada) não há cache nenhuma para ler: serve
    // o mesmo instantâneo, que aí é o inicial.
    instantaneoAtual,
  );

  const puxar = useCallback(async () => {
    if (!usaSupabase || !supabase) {
      definir({ aCarregar: false });
      return;
    }
    // A marca de "a carregar" é posta AQUI e não no arranque do módulo: o
    // instantâneo inicial é criado ao importar, muito antes de se saber se há
    // sessão, e nascer em `true` deixava a app sem sessão à espera para sempre.
    definir({ aCarregar: true });
    try {
      const { data, error } = await supabase
        .from('evento_agenda')
        .select(COLUNAS)
        .order('dia', { ascending: true });
      if (error) throw new Error(error.message);
      const lista = ((data ?? []) as LinhaAgenda[]).map(toEvento);
      guardarCache(lista);
      definir({ eventos: lista, erro: null, aCarregar: false });
    } catch (e) {
      // Fica o que está em cache — o calendário continua a abrir sem rede.
      definir({ erro: e instanceof Error ? e.message : String(e), aCarregar: false });
    }
  }, [usaSupabase]);

  useEffect(() => {
    void puxar();
  }, [puxar]);

  const guardarEvento = useCallback(
    async (entrada: EntradaEvento): Promise<EventoAgenda> => {
      // Lido da loja e não do `eventos` do render: entre este ecrã abrir e o
      // botão ser tocado, outro pode ter gravado — e a versão do render estava
      // congelada no que havia à entrada.
      const existente = entrada.id
        ? instantaneo.eventos.find((e) => e.id === entrada.id)
        : undefined;
      const evento: EventoAgenda = {
        id: entrada.id ?? novoId(),
        exploracaoId: entrada.exploracaoId,
        criadoPor: existente?.criadoPor ?? userId,
        titulo: entrada.titulo.trim(),
        descricao: entrada.descricao?.trim() || undefined,
        dia: entrada.dia,
        hora: entrada.hora?.trim() || undefined,
        publico: entrada.publico,
        criadoEm: existente?.criadoEm ?? new Date().toISOString(),
      };

      // Pessimista: grava no servidor ANTES de mexer no ecrã (ver o cabeçalho).
      if (usaSupabase && supabase) {
        const { error } = await supabase.from('evento_agenda').upsert({
          id: evento.id,
          exploracao_id: evento.exploracaoId,
          // `criado_por` vai explícito e não pela coluna com default: num upsert
          // que ATUALIZA o default não corre, e o comportamento passava a
          // depender de o registo já lá estar ou não. A RLS confere-o de
          // qualquer maneira — ninguém marca eventos em nome de outro.
          criado_por: evento.criadoPor,
          titulo: evento.titulo,
          descricao: evento.descricao ?? null,
          dia: evento.dia,
          hora: evento.hora ?? null,
          publico: evento.publico,
          criado_em: evento.criadoEm,
        });
        if (error) throw new Error(error.message);
      }

      const novos = existente
        ? instantaneo.eventos.map((e) => (e.id === evento.id ? evento : e))
        : [...instantaneo.eventos, evento];
      guardarCache(novos);
      // É esta linha que faz o evento aparecer no calendário do Início sem ter
      // de refrescar: todos os `useAgenda()` montados são avisados.
      definir({ eventos: novos });
      return evento;
    },
    [usaSupabase, userId],
  );

  const eliminarEvento = useCallback(
    async (id: string): Promise<void> => {
      if (usaSupabase && supabase) {
        const { error } = await supabase.from('evento_agenda').delete().eq('id', id);
        if (error) throw new Error(error.message);
      }
      const novos = instantaneo.eventos.filter((e) => e.id !== id);
      guardarCache(novos);
      definir({ eventos: novos });
    },
    [usaSupabase],
  );

  const porDia = useMemo(() => agruparEventosPorDia(eventos), [eventos]);

  return { eventos, aCarregar, erro, guardarEvento, eliminarEvento, recarregar: puxar, porDia };
}
