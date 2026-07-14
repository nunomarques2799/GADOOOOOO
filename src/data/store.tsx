import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { useAuth } from './auth';
import { abrirBd, inicializarBd } from './db/database';
import {
  carregarTudo,
  carregarUtilizador,
  eliminarAnimal as bdEliminarAnimal,
  eliminarExploracao as bdEliminarExploracao,
  eliminarTerreno as bdEliminarTerreno,
  guardarAnimal,
  guardarEvento,
  guardarExploracao,
  guardarTerreno,
} from './db/repository';
import { computeAlertas } from './helpers';
import {
  animaisSeed,
  eventosSeed,
  exploracoesSeed,
  terrenosSeed,
  utilizadorSeed,
} from './seed';
import { supabaseConfigurado } from './supabase';
import {
  carregarTudoSupabase,
  eliminarAnimalSupabase,
  eliminarExploracaoSupabase,
  eliminarTerrenoSupabase,
  upsertAnimalSupabase,
  upsertEventoSupabase,
  upsertExploracaoSupabase,
  upsertTerrenoSupabase,
} from './supabaseRepo';
import type {
  Alerta,
  Animal,
  Evento,
  Exploracao,
  Meteorologia,
  Terreno,
  Utilizador,
} from './types';

/**
 * Persistência:
 *   - Com sessão Supabase iniciada → Supabase é a fonte da verdade.
 *   - Sem Supabase (offline puro) e no nativo → SQLite local (expo-sqlite).
 *   - Sem Supabase e na web → dados de exemplo em memória.
 */
const USA_SQLITE_LOCAL = Platform.OS !== 'web' && !supabaseConfigurado;

/** Gerador de ID simples (UUID v4 quando disponível). */
function novoId(prefixo = 'id'): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${prefixo}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Meteorologia de recurso — mostrada enquanto carrega ou se não houver rede. */
const meteorologiaFallback: Meteorologia = {
  local: 'Idanha-a-Nova',
  temperatura: 24,
  condicao: 'Sol com nuvens',
  icone: 'weather-partly-cloudy',
  humidade: 48,
  vento: 12,
  precipitacao: 0,
  maxima: 29,
  minima: 16,
  conselho: 'Bom dia para verificar os bebedouros — calor à tarde.',
};

/** Estado da obtenção de meteorologia — para a UI mostrar "offline" se falhar. */
export type MeteoEstado = 'a-carregar' | 'atual' | 'offline';

/** Instantâneo de todos os dados carregados no arranque (BD ou seed). */
type Snapshot = {
  utilizador: Utilizador;
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
};

/** Snapshot inicial síncrono (SQLite local ou seed). */
function snapshotSincrono(): Snapshot {
  if (USA_SQLITE_LOCAL) {
    const db = inicializarBd();
    const { exploracoes, terrenos, animais, eventos } = carregarTudo(db);
    return {
      utilizador: carregarUtilizador(db) ?? utilizadorSeed,
      exploracoes,
      terrenos,
      animais,
      eventos,
    };
  }
  // Web sem Supabase → seed em memória. Web com Supabase → vazio (carrega
  // depois em useEffect assíncrono).
  if (!supabaseConfigurado) {
    return {
      utilizador: utilizadorSeed,
      exploracoes: exploracoesSeed,
      terrenos: terrenosSeed,
      animais: animaisSeed,
      eventos: eventosSeed,
    };
  }
  return { utilizador: utilizadorSeed, exploracoes: [], terrenos: [], animais: [], eventos: [] };
}

type GadoContext = {
  utilizador: Utilizador;
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
  alertas: Alerta[];
  meteorologia: Meteorologia;
  meteoEstado: MeteoEstado;
  // seletores
  exploracaoById: (id: string) => Exploracao | undefined;
  animalById: (id: string) => Animal | undefined;
  terrenoById: (id: string) => Terreno | undefined;
  animaisByExploracao: (id: string) => Animal[];
  terrenosByExploracao: (id: string) => Terreno[];
  eventosByAnimal: (id: string) => Evento[];
  // ações (async quando batem no Supabase; devolvem o objeto criado)
  addAnimal: (a: Omit<Animal, 'id'>) => Promise<Animal>;
  updateAnimal: (id: string, patch: Partial<Animal>) => Promise<void>;
  deleteAnimal: (id: string) => Promise<void>;
  addExploracao: (e: Omit<Exploracao, 'id' | 'utilizadorId'>) => Promise<Exploracao>;
  updateExploracao: (id: string, patch: Partial<Exploracao>) => Promise<void>;
  deleteExploracao: (id: string) => Promise<void>;
  addTerreno: (t: Omit<Terreno, 'id'>) => Promise<Terreno>;
  updateTerreno: (id: string, patch: Partial<Terreno>) => Promise<void>;
  deleteTerreno: (id: string) => Promise<void>;
  addEvento: (e: Omit<Evento, 'id'>) => Promise<Evento>;
  recarregar: () => Promise<void>;
  recarregarMeteo: () => void;
};

const Ctx = createContext<GadoContext | null>(null);

export function GadoProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;

  const bootRef = useRef<Snapshot | null>(null);
  if (bootRef.current === null) bootRef.current = snapshotSincrono();
  const boot = bootRef.current;

  const [utilizador] = useState<Utilizador>(boot.utilizador);
  const [exploracoes, setExploracoes] = useState<Exploracao[]>(boot.exploracoes);
  const [terrenos, setTerrenos] = useState<Terreno[]>(boot.terrenos);
  const [animais, setAnimais] = useState<Animal[]>(boot.animais);
  const [eventos, setEventos] = useState<Evento[]>(boot.eventos);

  // Espelho sempre atual do efetivo, para ler dentro das ações sem o incluir nas dependências.
  const animaisRef = useRef(animais);
  animaisRef.current = animais;
  const exploracoesRef = useRef(exploracoes);
  exploracoesRef.current = exploracoes;
  const terrenosRef = useRef(terrenos);
  terrenosRef.current = terrenos;

  const [meteorologia, setMeteorologia] = useState<Meteorologia>(meteorologiaFallback);
  const [meteoEstado, setMeteoEstado] = useState<MeteoEstado>('a-carregar');

  const alertas = useMemo(() => computeAlertas(animais), [animais]);

  /** Escrita local SQLite (só no nativo sem Supabase). */
  const gravarSqlite = useCallback((fn: (db: SQLiteDatabase) => void) => {
    if (USA_SQLITE_LOCAL) fn(abrirBd());
  }, []);

  /** Recarrega tudo do Supabase (usado após criar exploração/convite/aprovação). */
  const recarregar = useCallback(async () => {
    if (!usaSupabase) return;
    const snap = await carregarTudoSupabase();
    setExploracoes(snap.exploracoes);
    setTerrenos(snap.terrenos);
    setAnimais(snap.animais);
    setEventos(snap.eventos);
  }, [usaSupabase]);

  // Carrega do Supabase quando arranca com sessão iniciada.
  useEffect(() => {
    if (usaSupabase) void recarregar();
  }, [usaSupabase, recarregar]);

  /* ---- Meteorologia (ecrã principal — mantém como fallback global) ---- */

  const recarregarMeteo = useCallback(() => {
    // A meteorologia por exploração é obtida em useMeteorologia; aqui só
    // mantemos o estado para retro-compatibilidade dos consumers antigos.
    setMeteoEstado('atual');
  }, []);

  useEffect(() => {
    setMeteoEstado('atual');
  }, []);

  /* ---- Seletores ---- */

  const exploracaoById = useCallback(
    (id: string) => exploracoes.find((e) => e.id === id),
    [exploracoes],
  );
  const animalById = useCallback((id: string) => animais.find((a) => a.id === id), [animais]);
  const terrenoById = useCallback((id: string) => terrenos.find((t) => t.id === id), [terrenos]);
  const animaisByExploracao = useCallback(
    (id: string) => animais.filter((a) => a.exploracaoId === id),
    [animais],
  );
  const terrenosByExploracao = useCallback(
    (id: string) => terrenos.filter((t) => t.exploracaoId === id),
    [terrenos],
  );
  const eventosByAnimal = useCallback(
    (id: string) =>
      eventos
        .filter((e) => e.animalId === id)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [eventos],
  );

  /* ---- Ações ---- */

  const addAnimal = useCallback(
    async (a: Omit<Animal, 'id'>): Promise<Animal> => {
      const novo: Animal = { ...a, id: novoId('an') };
      if (usaSupabase) {
        const erro = await upsertAnimalSupabase(novo);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => guardarAnimal(db, novo));
      }
      setAnimais((prev) => [novo, ...prev]);
      return novo;
    },
    [usaSupabase, gravarSqlite],
  );

  const updateAnimal = useCallback(
    async (id: string, patch: Partial<Animal>): Promise<void> => {
      const atual = animaisRef.current.find((a) => a.id === id);
      if (!atual) return;
      const atualizado: Animal = { ...atual, ...patch };
      if (usaSupabase) {
        const erro = await upsertAnimalSupabase(atualizado);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => guardarAnimal(db, atualizado));
      }
      setAnimais((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
    },
    [usaSupabase, gravarSqlite],
  );

  const deleteAnimal = useCallback(
    async (id: string): Promise<void> => {
      if (usaSupabase) {
        const erro = await eliminarAnimalSupabase(id);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => bdEliminarAnimal(db, id));
      }
      setAnimais((prev) => prev.filter((a) => a.id !== id));
      setEventos((prev) => prev.filter((e) => e.animalId !== id));
    },
    [usaSupabase, gravarSqlite],
  );

  const addExploracao = useCallback(
    async (e: Omit<Exploracao, 'id' | 'utilizadorId'>): Promise<Exploracao> => {
      const nova: Exploracao = { ...e, id: novoId('exp'), utilizadorId: utilizador.id };
      if (usaSupabase) {
        const erro = await upsertExploracaoSupabase(nova);
        if (erro) throw new Error(erro);
        // O trigger no Supabase cria membro admin. Recarregamos para apanhar
        // o utilizador_id real (auth.uid) atribuído pelo default.
        await recarregar();
      } else {
        gravarSqlite((db) => guardarExploracao(db, nova));
        setExploracoes((prev) => [...prev, nova]);
      }
      return nova;
    },
    [usaSupabase, gravarSqlite, recarregar, utilizador.id],
  );

  const updateExploracao = useCallback(
    async (id: string, patch: Partial<Exploracao>): Promise<void> => {
      const atual = exploracoesRef.current.find((e) => e.id === id);
      if (!atual) return;
      const atualizada: Exploracao = { ...atual, ...patch, id, utilizadorId: atual.utilizadorId };
      if (usaSupabase) {
        const erro = await upsertExploracaoSupabase(atualizada);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => guardarExploracao(db, atualizada));
      }
      setExploracoes((prev) => prev.map((e) => (e.id === id ? atualizada : e)));
    },
    [usaSupabase, gravarSqlite],
  );

  const deleteExploracao = useCallback(
    async (id: string): Promise<void> => {
      if (usaSupabase) {
        const erro = await eliminarExploracaoSupabase(id);
        if (erro) throw new Error(erro);
        await recarregar();
        return;
      }
      gravarSqlite((db) => bdEliminarExploracao(db, id));
      const animaisRemovidos = new Set(
        animaisRef.current.filter((a) => a.exploracaoId === id).map((a) => a.id),
      );
      setEventos((prev) => prev.filter((e) => !animaisRemovidos.has(e.animalId)));
      setAnimais((prev) => prev.filter((a) => a.exploracaoId !== id));
      setTerrenos((prev) => prev.filter((t) => t.exploracaoId !== id));
      setExploracoes((prev) => prev.filter((e) => e.id !== id));
    },
    [usaSupabase, gravarSqlite, recarregar],
  );

  const addTerreno = useCallback(
    async (t: Omit<Terreno, 'id'>): Promise<Terreno> => {
      const novo: Terreno = { ...t, id: novoId('ter') };
      if (usaSupabase) {
        const erro = await upsertTerrenoSupabase(novo);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => guardarTerreno(db, novo));
      }
      setTerrenos((prev) => [...prev, novo]);
      return novo;
    },
    [usaSupabase, gravarSqlite],
  );

  const updateTerreno = useCallback(
    async (id: string, patch: Partial<Terreno>): Promise<void> => {
      const atual = terrenosRef.current.find((t) => t.id === id);
      if (!atual) return;
      const atualizado: Terreno = { ...atual, ...patch, id, exploracaoId: atual.exploracaoId };
      if (usaSupabase) {
        const erro = await upsertTerrenoSupabase(atualizado);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => guardarTerreno(db, atualizado));
      }
      setTerrenos((prev) => prev.map((t) => (t.id === id ? atualizado : t)));
    },
    [usaSupabase, gravarSqlite],
  );

  const deleteTerreno = useCallback(
    async (id: string): Promise<void> => {
      if (usaSupabase) {
        const erro = await eliminarTerrenoSupabase(id);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => bdEliminarTerreno(db, id));
      }
      setAnimais((prev) => prev.map((a) => (a.terrenoId === id ? { ...a, terrenoId: undefined } : a)));
      setTerrenos((prev) => prev.filter((t) => t.id !== id));
    },
    [usaSupabase, gravarSqlite],
  );

  const addEvento = useCallback(
    async (e: Omit<Evento, 'id'>): Promise<Evento> => {
      const novo: Evento = { ...e, id: novoId('ev') };
      if (usaSupabase) {
        const erro = await upsertEventoSupabase(novo);
        if (erro) throw new Error(erro);
      } else {
        gravarSqlite((db) => guardarEvento(db, novo));
      }
      setEventos((prev) => [novo, ...prev]);
      return novo;
    },
    [usaSupabase, gravarSqlite],
  );

  const value = useMemo<GadoContext>(
    () => ({
      utilizador,
      exploracoes,
      terrenos,
      animais,
      eventos,
      alertas,
      meteorologia,
      meteoEstado,
      exploracaoById,
      animalById,
      terrenoById,
      animaisByExploracao,
      terrenosByExploracao,
      eventosByAnimal,
      addAnimal,
      updateAnimal,
      deleteAnimal,
      addExploracao,
      updateExploracao,
      deleteExploracao,
      addTerreno,
      updateTerreno,
      deleteTerreno,
      addEvento,
      recarregar,
      recarregarMeteo,
    }),
    [
      utilizador, exploracoes, terrenos, animais, eventos, alertas,
      meteorologia, meteoEstado,
      exploracaoById, animalById, terrenoById, animaisByExploracao,
      terrenosByExploracao, eventosByAnimal, addAnimal, updateAnimal,
      deleteAnimal, addExploracao, updateExploracao, deleteExploracao,
      addTerreno, updateTerreno, deleteTerreno, addEvento,
      recarregar, recarregarMeteo,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGado(): GadoContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGado deve ser usado dentro de <GadoProvider>');
  return ctx;
}
