/**
 * Notas pessoais — o bloco de apontamentos de quem usa a app.
 * ------------------------------------------------------------------
 * Texto livre, por conta (não por exploração; a equipa não as vê). São o caso
 * mais simples de sincronização da app, por isso NÃO entram na maquinaria de
 * outbox/conflitos do gado (`store.tsx`): a fonte de verdade é o Supabase, e a
 * cache local (`armazenamento.ts`) é só um espelho para as ver offline.
 *
 * Escrita é PESSIMISTA de propósito: guarda-se primeiro no servidor e só depois
 * no ecrã. Sem sessão/Supabase (modo local/demo) fica só na cache. O que não se
 * faz é fingir que gravou offline e depois perder a nota na leitura seguinte —
 * uma nota que desaparece sem aviso é pior do que um "guarde quando tiver rede".
 */

import { useCallback, useEffect, useState } from 'react';

import { armazenamentoDisponivel, guardar, ler } from './armazenamento';
import { useAuth } from './auth';
import { supabase, supabaseConfigurado } from './supabase';

export type Nota = {
  id: string;
  titulo?: string;
  texto: string;
  criadoEm: string; // ISO
  atualizadoEm: string; // ISO
};

const CHAVE_NOTAS = 'gado.notas.v1';

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

function lerCache(): Nota[] {
  const bruto = ler(CHAVE_NOTAS);
  if (!bruto) return [];
  try {
    const arr = JSON.parse(bruto) as Nota[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function guardarCache(notas: Nota[]): void {
  if (armazenamentoDisponivel) guardar(CHAVE_NOTAS, JSON.stringify(notas));
}

/* ---- Repositório Supabase ---- */

type NotaRow = {
  id: string;
  titulo?: string | null;
  texto?: string | null;
  criado_em?: string | null;
  updated_at?: string | null;
};

function toNota(r: NotaRow): Nota {
  const agora = new Date().toISOString();
  return {
    id: r.id,
    titulo: r.titulo ?? undefined,
    texto: r.texto ?? '',
    criadoEm: r.criado_em ?? agora,
    atualizadoEm: r.updated_at ?? r.criado_em ?? agora,
  };
}

async function carregarNotasSupabase(): Promise<Nota[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('nota')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as NotaRow[]).map(toNota);
}

async function upsertNotaSupabase(n: Nota, userId: string): Promise<void> {
  if (!supabase) return;
  // `updated_at` fica ao trigger; `criado_em` preserva-se no upsert.
  const { error } = await supabase.from('nota').upsert({
    id: n.id,
    user_id: userId,
    titulo: n.titulo ?? null,
    texto: n.texto,
    criado_em: n.criadoEm,
  });
  if (error) throw new Error(error.message);
}

async function eliminarNotaSupabase(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('nota').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ---- Ordenação: mais recentes primeiro ---- */
function ordenar(notas: Nota[]): Nota[] {
  return [...notas].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export type EntradaNota = { id?: string; titulo?: string; texto: string };

export type UseNotas = {
  notas: Nota[];
  aCarregar: boolean;
  /** Motivo da última falha de leitura, ou null. */
  erro: string | null;
  /** Cria (sem `id`) ou atualiza (com `id`) uma nota. Devolve a nota gravada. */
  guardarNota: (entrada: EntradaNota) => Promise<Nota>;
  eliminarNota: (id: string) => Promise<void>;
  recarregar: () => Promise<void>;
};

/**
 * Estado e ações das notas do utilizador. Só há um consumidor (a aba
 * Documentos), por isso o estado vive no próprio hook — sem provider global.
 */
export function useNotas(): UseNotas {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;
  const userId = sessao?.user?.id ?? '';

  const [notas, setNotas] = useState<Nota[]>(() => (armazenamentoDisponivel ? lerCache() : []));
  const [aCarregar, setACarregar] = useState<boolean>(usaSupabase);
  const [erro, setErro] = useState<string | null>(null);

  const puxar = useCallback(async () => {
    if (!usaSupabase) {
      setACarregar(false);
      return;
    }
    try {
      const remotas = ordenar(await carregarNotasSupabase());
      setNotas(remotas);
      guardarCache(remotas);
      setErro(null);
    } catch (e) {
      // Mantém o que está em cache; guarda a razão para o ecrã a poder mostrar.
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
  }, [usaSupabase]);

  useEffect(() => {
    void puxar();
  }, [puxar]);

  const guardarNota = useCallback(
    async (entrada: EntradaNota): Promise<Nota> => {
      const agora = new Date().toISOString();
      const existente = entrada.id ? notas.find((n) => n.id === entrada.id) : undefined;
      const nota: Nota = {
        id: entrada.id ?? novoId(),
        titulo: entrada.titulo?.trim() || undefined,
        texto: entrada.texto,
        criadoEm: existente?.criadoEm ?? agora,
        atualizadoEm: agora,
      };
      // Pessimista: grava no servidor ANTES de mexer no ecrã. Se estiver sem
      // rede, o upsert falha e propaga — nada muda no ecrã, e quem chama mostra
      // "não foi possível guardar" em vez de perder a nota mais tarde.
      if (usaSupabase) await upsertNotaSupabase(nota, userId);

      setNotas((prev) => {
        const novas = existente
          ? prev.map((n) => (n.id === nota.id ? nota : n))
          : [nota, ...prev];
        const ordenadas = ordenar(novas);
        guardarCache(ordenadas);
        return ordenadas;
      });
      return nota;
    },
    [notas, usaSupabase, userId],
  );

  const eliminarNota = useCallback(
    async (id: string): Promise<void> => {
      if (usaSupabase) await eliminarNotaSupabase(id);
      setNotas((prev) => {
        const novas = prev.filter((n) => n.id !== id);
        guardarCache(novas);
        return novas;
      });
    },
    [usaSupabase],
  );

  return { notas, aCarregar, erro, guardarNota, eliminarNota, recarregar: puxar };
}
