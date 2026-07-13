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

import { abrirBd, inicializarBd } from './db/database';
import {
  carregarTudo,
  carregarUtilizador,
  eliminarAnimal as bdEliminarAnimal,
  guardarAnimal,
  guardarEvento,
  guardarExploracao,
} from './db/repository';
import { computeAlertas } from './helpers';
import {
  animaisSeed,
  eventosSeed,
  exploracoesSeed,
  terrenosSeed,
  utilizadorSeed,
} from './seed';
import type {
  Alerta,
  Animal,
  Evento,
  Exploracao,
  Meteorologia,
  Terreno,
  Utilizador,
} from './types';
import { fetchMeteorologia, type LocalMeteo } from './weather';

/**
 * A persistência SQLite (expo-sqlite) só corre em iOS/Android. Na web,
 * onde não há motor nativo, a app usa os dados de exemplo em memória —
 * suficiente para pré-visualizar os ecrãs no browser.
 */
const USA_BD = Platform.OS !== 'web';

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

/** Coordenadas de recurso (Idanha-a-Nova) se a exploração não tiver terrenos com GPS. */
const LOCAL_FALLBACK: LocalMeteo = { latitude: 39.92, longitude: -7.24, local: 'Idanha-a-Nova' };

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

/** Carrega o estado inicial: da BD no nativo, dos dados de exemplo na web. */
function carregarSnapshot(): Snapshot {
  if (!USA_BD) {
    return {
      utilizador: utilizadorSeed,
      exploracoes: exploracoesSeed,
      terrenos: terrenosSeed,
      animais: animaisSeed,
      eventos: eventosSeed,
    };
  }
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
  // ações
  addAnimal: (a: Omit<Animal, 'id'>) => Animal;
  updateAnimal: (id: string, patch: Partial<Animal>) => void;
  deleteAnimal: (id: string) => void;
  addExploracao: (e: Omit<Exploracao, 'id' | 'utilizadorId'>) => Exploracao;
  addEvento: (e: Omit<Evento, 'id'>) => Evento;
  recarregarMeteo: () => void;
};

const Ctx = createContext<GadoContext | null>(null);

export function GadoProvider({ children }: { children: ReactNode }) {
  // Carrega a BD/seed uma única vez (padrão de inicialização preguiçosa).
  const bootRef = useRef<Snapshot | null>(null);
  if (bootRef.current === null) bootRef.current = carregarSnapshot();
  const boot = bootRef.current;

  const [utilizador] = useState<Utilizador>(boot.utilizador);
  const [exploracoes, setExploracoes] = useState<Exploracao[]>(boot.exploracoes);
  const [terrenos] = useState<Terreno[]>(boot.terrenos);
  const [animais, setAnimais] = useState<Animal[]>(boot.animais);
  const [eventos, setEventos] = useState<Evento[]>(boot.eventos);

  // Espelho sempre atual do efetivo, para ler dentro das ações sem o incluir nas dependências.
  const animaisRef = useRef(animais);
  animaisRef.current = animais;

  const [meteorologia, setMeteorologia] = useState<Meteorologia>(meteorologiaFallback);
  const [meteoEstado, setMeteoEstado] = useState<MeteoEstado>('a-carregar');

  const alertas = useMemo(() => computeAlertas(animais), [animais]);

  /** Executa uma escrita na BD apenas no nativo (na web é no-op). */
  const gravar = useCallback((fn: (db: SQLiteDatabase) => void) => {
    if (USA_BD) fn(abrirBd());
  }, []);

  /* ---- Meteorologia real (Open-Meteo) ---- */

  const localMeteo = useMemo<LocalMeteo>(() => {
    const terreno = terrenos.find((t) => t.latitude != null && t.longitude != null);
    const nomeLocal = exploracoes[0]?.localizacao?.split(',')[0]?.trim();
    if (terreno?.latitude != null && terreno.longitude != null) {
      return { latitude: terreno.latitude, longitude: terreno.longitude, local: nomeLocal || terreno.nome };
    }
    return LOCAL_FALLBACK;
  }, [terrenos, exploracoes]);

  const recarregarMeteo = useCallback(() => {
    const controlador = new AbortController();
    setMeteoEstado('a-carregar');
    fetchMeteorologia(localMeteo, controlador.signal)
      .then((m) => {
        setMeteorologia(m);
        setMeteoEstado('atual');
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== 'AbortError') setMeteoEstado('offline');
      });
    return controlador;
  }, [localMeteo]);

  useEffect(() => {
    const controlador = recarregarMeteo();
    return () => controlador.abort();
  }, [recarregarMeteo]);

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

  /* ---- Ações (escrevem na BD e atualizam o estado) ---- */

  const addAnimal = useCallback(
    (a: Omit<Animal, 'id'>) => {
      const novo: Animal = { ...a, id: novoId('an') };
      gravar((db) => guardarAnimal(db, novo));
      setAnimais((prev) => [novo, ...prev]);
      return novo;
    },
    [gravar],
  );

  const updateAnimal = useCallback(
    (id: string, patch: Partial<Animal>) => {
      const atual = animaisRef.current.find((a) => a.id === id);
      if (!atual) return;
      const atualizado: Animal = { ...atual, ...patch };
      gravar((db) => guardarAnimal(db, atualizado));
      setAnimais((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
    },
    [gravar],
  );

  const deleteAnimal = useCallback(
    (id: string) => {
      gravar((db) => bdEliminarAnimal(db, id));
      setAnimais((prev) => prev.filter((a) => a.id !== id));
      setEventos((prev) => prev.filter((e) => e.animalId !== id));
    },
    [gravar],
  );

  const addExploracao = useCallback(
    (e: Omit<Exploracao, 'id' | 'utilizadorId'>) => {
      const nova: Exploracao = { ...e, id: novoId('exp'), utilizadorId: utilizador.id };
      gravar((db) => guardarExploracao(db, nova));
      setExploracoes((prev) => [...prev, nova]);
      return nova;
    },
    [gravar, utilizador.id],
  );

  const addEvento = useCallback(
    (e: Omit<Evento, 'id'>) => {
      const novo: Evento = { ...e, id: novoId('ev') };
      gravar((db) => guardarEvento(db, novo));
      setEventos((prev) => [novo, ...prev]);
      return novo;
    },
    [gravar],
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
      addEvento,
      recarregarMeteo,
    }),
    [
      utilizador, exploracoes, terrenos, animais, eventos, alertas,
      meteorologia, meteoEstado,
      exploracaoById, animalById, terrenoById, animaisByExploracao,
      terrenosByExploracao, eventosByAnimal, addAnimal, updateAnimal,
      deleteAnimal, addExploracao, addEvento, recarregarMeteo,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGado(): GadoContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGado deve ser usado dentro de <GadoProvider>');
  return ctx;
}
