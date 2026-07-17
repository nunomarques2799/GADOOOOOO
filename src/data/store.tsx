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
import {
  adicionarOutbox,
  cacheDisponivel,
  guardarCache,
  guardarOutbox,
  lerCache,
  lerOutbox,
  pareceErroDeRede,
  type OpPendente,
} from './cacheLocal';
import { computeAlertas } from './helpers';
import { filtrarAlertas, useNotificacoes } from './notificacoes';
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
  EstadoAnimal,
  Evento,
  Exploracao,
  Meteorologia,
  Terreno,
  Utilizador,
} from './types';

/**
 * Persistência:
 *   - Com sessão Supabase iniciada → offline-first: a cache local (localStorage,
 *     na web/Electron) é a fonte para a UI; as escritas são otimistas e vão ao
 *     Supabase quando há rede, ou ficam numa fila (outbox) até a rede voltar.
 *   - Sem Supabase (offline puro) e no nativo → SQLite local (expo-sqlite).
 *   - Sem Supabase e na web → dados de exemplo em memória.
 */
const USA_SQLITE_LOCAL = Platform.OS !== 'web' && !supabaseConfigurado;

/** Envia uma operação da fila ao Supabase. Devolve msg de erro ou null. */
async function enviarOp(op: OpPendente): Promise<string | null> {
  if (op.op === 'delete') {
    switch (op.entidade) {
      case 'exploracao':
        return eliminarExploracaoSupabase(op.id);
      case 'terreno':
        return eliminarTerrenoSupabase(op.id);
      case 'animal':
        return eliminarAnimalSupabase(op.id);
      case 'evento':
        return null; // sem eliminação de eventos no domínio atual
    }
  }
  switch (op.entidade) {
    case 'exploracao':
      return upsertExploracaoSupabase(op.dados as Exploracao);
    case 'terreno':
      return upsertTerrenoSupabase(op.dados as Terreno);
    case 'animal':
      return upsertAnimalSupabase(op.dados as Animal);
    case 'evento':
      return upsertEventoSupabase(op.dados as Evento);
  }
}

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
  // Web sem Supabase → seed em memória.
  if (!supabaseConfigurado) {
    return {
      utilizador: utilizadorSeed,
      exploracoes: exploracoesSeed,
      terrenos: terrenosSeed,
      animais: animaisSeed,
      eventos: eventosSeed,
    };
  }
  // Web/Electron com Supabase → arranca da cache local (funciona offline).
  // A sincronização com o servidor acontece depois, num useEffect.
  const cache = lerCache();
  if (cache) {
    return { utilizador: utilizadorSeed, ...cache };
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
  /** Há ligação para sincronizar com o servidor? (offline-first) */
  online: boolean;
  /** Nº de alterações locais ainda por enviar ao Supabase. */
  pendentesSinc: number;
  // seletores
  exploracaoById: (id: string) => Exploracao | undefined;
  animalById: (id: string) => Animal | undefined;
  terrenoById: (id: string) => Terreno | undefined;
  /** Efetivo ativo da exploração (exclui falecidos/vendidos). */
  animaisByExploracao: (id: string) => Animal[];
  /** Todos os registos ligados a uma exploração, incluindo os que saíram. */
  animaisByExploracaoIncluindoSaidos: (id: string) => Animal[];
  terrenosByExploracao: (id: string) => Terreno[];
  eventosByAnimal: (id: string) => Evento[];
  // ações (async quando batem no Supabase; devolvem o objeto criado)
  addAnimal: (a: Omit<Animal, 'id'>) => Promise<Animal>;
  updateAnimal: (id: string, patch: Partial<Animal>) => Promise<void>;
  deleteAnimal: (id: string) => Promise<void>;
  /**
   * Marca um animal como falecido/vendido: guarda o estado no próprio registo
   * (para a árvore genealógica continuar completa) e cria automaticamente um
   * evento `Morte` ou `Venda`.
   */
  marcarSaida: (
    id: string,
    estado: Exclude<EstadoAnimal, 'ativo'>,
    data: string,
    motivo?: string,
  ) => Promise<void>;
  /** Anula uma saída — volta a colocar o animal como ativo. */
  reativarAnimal: (id: string) => Promise<void>;
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

  // Todos os alertas possíveis; as preferências do utilizador (ecrã
  // "Notificações e alertas") filtram categorias e antecedência.
  const { preferencias: prefsNotif } = useNotificacoes();
  const alertas = useMemo(
    () => filtrarAlertas(computeAlertas(animais, eventos), prefsNotif),
    [animais, eventos, prefsNotif],
  );

  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  );
  const [pendentesSinc, setPendentesSinc] = useState<number>(
    cacheDisponivel ? lerOutbox().length : 0,
  );

  /** Escrita local SQLite (só no nativo sem Supabase). */
  const gravarSqlite = useCallback((fn: (db: SQLiteDatabase) => void) => {
    if (USA_SQLITE_LOCAL) fn(abrirBd());
  }, []);

  // Mantém a cache local sempre a espelhar o que está no ecrã, para reabrir
  // offline com os dados atuais. Só com Supabase + armazenamento disponível.
  useEffect(() => {
    if (usaSupabase && cacheDisponivel) {
      guardarCache({ exploracoes, terrenos, animais, eventos });
    }
  }, [usaSupabase, exploracoes, terrenos, animais, eventos]);

  /** Puxa a verdade do servidor. Devolve false (mantendo a cache) se falhar. */
  const puxarDoServidor = useCallback(async (): Promise<boolean> => {
    try {
      const snap = await carregarTudoSupabase();
      setExploracoes(snap.exploracoes);
      setTerrenos(snap.terrenos);
      setAnimais(snap.animais);
      setEventos(snap.eventos);
      return true;
    } catch {
      return false; // offline — fica com o que está em cache
    }
  }, []);

  /**
   * Envia uma alteração ao Supabase. Se falhar por falta de rede, guarda-a na
   * fila para reenviar depois (não propaga erro — a UI já atualizou). Devolve
   * true se ficou efetivamente enviada. Erros lógicos do servidor propagam.
   */
  const empurrar = useCallback(async (op: OpPendente): Promise<boolean> => {
    if (!cacheDisponivel) {
      // Sem cache local (nativo): comportamento antigo — envia e propaga erro.
      const erro = await enviarOp(op);
      if (erro) throw new Error(erro);
      return true;
    }
    let erro: string | null = null;
    try {
      erro = await enviarOp(op);
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
    }
    if (!erro) {
      setOnline(true);
      return true;
    }
    if (pareceErroDeRede(erro)) {
      setPendentesSinc(adicionarOutbox(op));
      setOnline(false);
      return false;
    }
    throw new Error(erro); // erro real de validação/RLS → mostra na UI
  }, []);

  /** Esvazia a fila por ordem e, se conseguir, puxa a verdade do servidor. */
  const sincronizar = useCallback(async () => {
    if (!usaSupabase || !cacheDisponivel) return;
    let ops = lerOutbox();
    while (ops.length > 0) {
      const [proxima, ...resto] = ops;
      let erro: string | null = null;
      try {
        erro = await enviarOp(proxima);
      } catch (e) {
        erro = e instanceof Error ? e.message : String(e);
      }
      if (erro && pareceErroDeRede(erro)) {
        setOnline(false);
        break; // continua offline — tenta na próxima vez
      }
      // Sucesso, ou erro lógico (descarta a op para não bloquear a fila).
      ops = resto;
      guardarOutbox(ops);
      setPendentesSinc(ops.length);
    }
    if (ops.length === 0) {
      setOnline(true);
      await puxarDoServidor();
    }
  }, [usaSupabase, puxarDoServidor]);

  /** Recarrega tudo do Supabase (envia pendentes + puxa o servidor). */
  const recarregar = useCallback(async () => {
    await sincronizar();
  }, [sincronizar]);

  // Ao arrancar com sessão iniciada: sincroniza (envia pendentes + puxa servidor).
  useEffect(() => {
    if (usaSupabase) void sincronizar();
  }, [usaSupabase, sincronizar]);

  // Sincroniza automaticamente quando a ligação à rede volta.
  useEffect(() => {
    if (!usaSupabase || !cacheDisponivel) return;
    if (typeof window === 'undefined' || !window.addEventListener) return;
    const aoVoltar = () => {
      setOnline(true);
      void sincronizar();
    };
    const aoPerder = () => setOnline(false);
    window.addEventListener('online', aoVoltar);
    window.addEventListener('offline', aoPerder);
    return () => {
      window.removeEventListener('online', aoVoltar);
      window.removeEventListener('offline', aoPerder);
    };
  }, [usaSupabase, sincronizar]);

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
    (id: string) =>
      animais.filter(
        (a) => a.exploracaoId === id && (!a.estado || a.estado === 'ativo'),
      ),
    [animais],
  );
  const animaisByExploracaoIncluindoSaidos = useCallback(
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
      setAnimais((prev) => [novo, ...prev]); // otimista — aparece já, mesmo offline
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'animal', dados: novo });
      else gravarSqlite((db) => guardarAnimal(db, novo));
      return novo;
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const updateAnimal = useCallback(
    async (id: string, patch: Partial<Animal>): Promise<void> => {
      const atual = animaisRef.current.find((a) => a.id === id);
      if (!atual) return;
      const atualizado: Animal = { ...atual, ...patch };
      setAnimais((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'animal', dados: atualizado });
      else gravarSqlite((db) => guardarAnimal(db, atualizado));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const deleteAnimal = useCallback(
    async (id: string): Promise<void> => {
      setAnimais((prev) => prev.filter((a) => a.id !== id));
      setEventos((prev) => prev.filter((e) => e.animalId !== id));
      if (usaSupabase) await empurrar({ op: 'delete', entidade: 'animal', id });
      else gravarSqlite((db) => bdEliminarAnimal(db, id));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const marcarSaida = useCallback(
    async (
      id: string,
      estado: Exclude<EstadoAnimal, 'ativo'>,
      data: string,
      motivo?: string,
    ): Promise<void> => {
      const atual = animaisRef.current.find((a) => a.id === id);
      if (!atual) return;
      const atualizado: Animal = {
        ...atual,
        estado,
        dataSaida: data,
        motivoSaida: motivo,
        terrenoId: undefined, // deixa de ocupar um terreno
      };
      const tipo = estado === 'falecido' ? 'Morte' : 'Venda';
      const descricao =
        estado === 'falecido' ? 'Animal registado como falecido.' : 'Animal saiu por venda.';
      const evento: Evento = {
        id: novoId('ev'),
        animalId: id,
        tipo,
        data,
        descricao,
        detalhe: motivo,
      };
      setAnimais((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
      setEventos((prev) => [evento, ...prev]);
      if (usaSupabase) {
        await empurrar({ op: 'upsert', entidade: 'animal', dados: atualizado });
        await empurrar({ op: 'upsert', entidade: 'evento', dados: evento });
      } else {
        gravarSqlite((db) => {
          guardarAnimal(db, atualizado);
          guardarEvento(db, evento);
        });
      }
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const reativarAnimal = useCallback(
    async (id: string): Promise<void> => {
      const atual = animaisRef.current.find((a) => a.id === id);
      if (!atual) return;
      const atualizado: Animal = {
        ...atual,
        estado: 'ativo',
        dataSaida: undefined,
        motivoSaida: undefined,
      };
      setAnimais((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'animal', dados: atualizado });
      else gravarSqlite((db) => guardarAnimal(db, atualizado));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const addExploracao = useCallback(
    async (e: Omit<Exploracao, 'id' | 'utilizadorId'>): Promise<Exploracao> => {
      const nova: Exploracao = { ...e, id: novoId('exp'), utilizadorId: utilizador.id };
      setExploracoes((prev) => [...prev, nova]); // otimista
      if (usaSupabase) {
        const enviado = await empurrar({ op: 'upsert', entidade: 'exploracao', dados: nova });
        // O trigger no Supabase cria o membro admin e atribui o user_id real
        // (auth.uid). Puxa para apanhar esses valores — só se foi mesmo enviado.
        if (enviado) await puxarDoServidor();
      } else {
        gravarSqlite((db) => guardarExploracao(db, nova));
      }
      return nova;
    },
    [usaSupabase, gravarSqlite, empurrar, puxarDoServidor, utilizador.id],
  );

  const updateExploracao = useCallback(
    async (id: string, patch: Partial<Exploracao>): Promise<void> => {
      const atual = exploracoesRef.current.find((e) => e.id === id);
      if (!atual) return;
      const atualizada: Exploracao = { ...atual, ...patch, id, utilizadorId: atual.utilizadorId };
      setExploracoes((prev) => prev.map((e) => (e.id === id ? atualizada : e)));
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'exploracao', dados: atualizada });
      else gravarSqlite((db) => guardarExploracao(db, atualizada));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const deleteExploracao = useCallback(
    async (id: string): Promise<void> => {
      // Cascata local (funciona offline). O servidor faz a sua própria cascata.
      const animaisRemovidos = new Set(
        animaisRef.current.filter((a) => a.exploracaoId === id).map((a) => a.id),
      );
      setEventos((prev) => prev.filter((e) => !animaisRemovidos.has(e.animalId)));
      setAnimais((prev) => prev.filter((a) => a.exploracaoId !== id));
      setTerrenos((prev) => prev.filter((t) => t.exploracaoId !== id));
      setExploracoes((prev) => prev.filter((e) => e.id !== id));
      if (usaSupabase) {
        const enviado = await empurrar({ op: 'delete', entidade: 'exploracao', id });
        if (enviado) await puxarDoServidor();
      } else {
        gravarSqlite((db) => bdEliminarExploracao(db, id));
      }
    },
    [usaSupabase, gravarSqlite, empurrar, puxarDoServidor],
  );

  const addTerreno = useCallback(
    async (t: Omit<Terreno, 'id'>): Promise<Terreno> => {
      const novo: Terreno = { ...t, id: novoId('ter') };
      setTerrenos((prev) => [...prev, novo]);
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'terreno', dados: novo });
      else gravarSqlite((db) => guardarTerreno(db, novo));
      return novo;
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const updateTerreno = useCallback(
    async (id: string, patch: Partial<Terreno>): Promise<void> => {
      const atual = terrenosRef.current.find((t) => t.id === id);
      if (!atual) return;
      const atualizado: Terreno = { ...atual, ...patch, id, exploracaoId: atual.exploracaoId };
      setTerrenos((prev) => prev.map((t) => (t.id === id ? atualizado : t)));
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'terreno', dados: atualizado });
      else gravarSqlite((db) => guardarTerreno(db, atualizado));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const deleteTerreno = useCallback(
    async (id: string): Promise<void> => {
      setAnimais((prev) => prev.map((a) => (a.terrenoId === id ? { ...a, terrenoId: undefined } : a)));
      setTerrenos((prev) => prev.filter((t) => t.id !== id));
      if (usaSupabase) await empurrar({ op: 'delete', entidade: 'terreno', id });
      else gravarSqlite((db) => bdEliminarTerreno(db, id));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const addEvento = useCallback(
    async (e: Omit<Evento, 'id'>): Promise<Evento> => {
      const novo: Evento = { ...e, id: novoId('ev') };
      setEventos((prev) => [novo, ...prev]);
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'evento', dados: novo });
      else gravarSqlite((db) => guardarEvento(db, novo));
      return novo;
    },
    [usaSupabase, gravarSqlite, empurrar],
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
      online,
      pendentesSinc,
      exploracaoById,
      animalById,
      terrenoById,
      animaisByExploracao,
      animaisByExploracaoIncluindoSaidos,
      terrenosByExploracao,
      eventosByAnimal,
      addAnimal,
      updateAnimal,
      deleteAnimal,
      marcarSaida,
      reativarAnimal,
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
      meteorologia, meteoEstado, online, pendentesSinc,
      exploracaoById, animalById, terrenoById, animaisByExploracao,
      animaisByExploracaoIncluindoSaidos,
      terrenosByExploracao, eventosByAnimal, addAnimal, updateAnimal,
      deleteAnimal, marcarSaida, reativarAnimal,
      addExploracao, updateExploracao, deleteExploracao,
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
