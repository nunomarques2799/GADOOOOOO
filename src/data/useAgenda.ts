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

import { useCallback, useEffect, useMemo, useState } from 'react';

import { agruparEventosPorDia, type EntradaEvento, type EventoAgenda } from './agenda';
import { armazenamentoDisponivel, guardar, ler } from './armazenamento';
import { useAuth } from './auth';
import { supabase, supabaseConfigurado } from './supabase';

const CHAVE_CACHE = 'gado.agenda.v1';

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

/**
 * Estado e ações da agenda. Como as notas, o estado vive no próprio hook: são
 * poucos consumidores e nenhum precisa de o partilhar com outro ramo da árvore.
 */
export function useAgenda(): UseAgenda {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;
  const userId = sessao?.user?.id ?? '';

  const [eventos, setEventos] = useState<EventoAgenda[]>(() =>
    armazenamentoDisponivel ? lerCache() : [],
  );
  const [aCarregar, setACarregar] = useState<boolean>(usaSupabase);
  const [erro, setErro] = useState<string | null>(null);

  const puxar = useCallback(async () => {
    if (!usaSupabase || !supabase) {
      setACarregar(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('evento_agenda')
        .select(COLUNAS)
        .order('dia', { ascending: true });
      if (error) throw new Error(error.message);
      const lista = ((data ?? []) as LinhaAgenda[]).map(toEvento);
      setEventos(lista);
      guardarCache(lista);
      setErro(null);
    } catch (e) {
      // Fica o que está em cache — o calendário continua a abrir sem rede.
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
  }, [usaSupabase]);

  useEffect(() => {
    void puxar();
  }, [puxar]);

  const guardarEvento = useCallback(
    async (entrada: EntradaEvento): Promise<EventoAgenda> => {
      const existente = entrada.id ? eventos.find((e) => e.id === entrada.id) : undefined;
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

      setEventos((prev) => {
        const novos = existente
          ? prev.map((e) => (e.id === evento.id ? evento : e))
          : [...prev, evento];
        guardarCache(novos);
        return novos;
      });
      return evento;
    },
    [eventos, usaSupabase, userId],
  );

  const eliminarEvento = useCallback(
    async (id: string): Promise<void> => {
      if (usaSupabase && supabase) {
        const { error } = await supabase.from('evento_agenda').delete().eq('id', id);
        if (error) throw new Error(error.message);
      }
      setEventos((prev) => {
        const novos = prev.filter((e) => e.id !== id);
        guardarCache(novos);
        return novos;
      });
    },
    [usaSupabase],
  );

  const porDia = useMemo(() => agruparEventosPorDia(eventos), [eventos]);

  return { eventos, aCarregar, erro, guardarEvento, eliminarEvento, recarregar: puxar, porDia };
}
