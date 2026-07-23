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
import { AppState, Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { useAuth } from './auth';
import { abrirBd, inicializarBd } from './db/database';
import {
  carregarTudo,
  carregarUtilizador,
  eliminarAnimal as bdEliminarAnimal,
  eliminarExploracao as bdEliminarExploracao,
  eliminarMovimento as bdEliminarMovimento,
  eliminarTerreno as bdEliminarTerreno,
  guardarAnimal,
  guardarEvento,
  guardarExploracao,
  guardarMovimento,
  guardarTerreno,
} from './db/repository';
import {
  adicionarOutbox,
  cacheDisponivel,
  guardarCache,
  guardarOutbox,
  lerCache,
  lerFalhadas,
  lerOutbox,
  limparFalhadas as esquecerFalhadas,
  pareceErroDeRede,
  registarFalhada,
  type OpFalhada,
  type OpPendente,
} from './cacheLocal';
import {
  dispensar as marcarDispensado,
  filtrarDispensados,
  guardarDispensas,
  lerDispensas,
  limparObsoletas,
  reporDispensa,
  type Dispensas,
} from './dispensados';
import { computeAlertas } from './helpers';
import { filtrarAlertas, useNotificacoes } from './notificacoes';
import {
  agendar as agendarNotificacoes,
  cancelarTudo as cancelarNotificacoes,
  suportaNotificacoes,
} from './notificacoesLocais';
import {
  animaisSeed,
  eventosSeed,
  exploracoesSeed,
  movimentosSeed,
  terrenosSeed,
  utilizadorSeed,
} from './seed';
import { supabaseConfigurado } from './supabase';
import {
  carregarTudoSupabase,
  definirCasaAtiva as definirCasaAtivaSupabase,
  definirFinancasAtivas as definirFinancasAtivasSupabase,
  eConflito,
  mensagemLegivel,
  eliminarAnimalSupabase,
  eliminarExploracaoSupabase,
  eliminarMovimentoSupabase,
  eliminarTerrenoSupabase,
  upsertAnimalSupabase,
  upsertEventoSupabase,
  upsertExploracaoSupabase,
  upsertMovimentoSupabase,
  upsertTerrenoSupabase,
} from './supabaseRepo';
import type {
  Alerta,
  Animal,
  EstadoAnimal,
  Evento,
  Exploracao,
  Movimento,
  Terreno,
  Utilizador,
} from './types';

/**
 * Persistência:
 *   - Com sessão Supabase iniciada → offline-first: a cache local é a fonte
 *     para a UI; as escritas são otimistas e vão ao Supabase quando há rede, ou
 *     ficam numa fila (outbox) até a rede voltar. A cache assenta em SQLite no
 *     telemóvel e em `localStorage` na web/Electron (ver `armazenamento.ts`).
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
      case 'movimento':
        return eliminarMovimentoSupabase(op.id);
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
    case 'movimento':
      return upsertMovimentoSupabase(op.dados as Movimento);
  }
}

/**
 * Gerador de ID. Devolve sempre um UUID v4 — o formato que as colunas `id` do
 * Postgres (Supabase) esperam. Usa `crypto.randomUUID` quando existe e, em
 * ambientes sem ele, gera um UUID v4 válido à mão (não um id textual, que faria
 * o upsert falhar com erro de validação em vez de sincronizar).
 */
function novoId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Estado da obtenção de meteorologia (usado pelo WeatherCard por exploração). */
export type MeteoEstado = 'a-carregar' | 'atual' | 'offline';

/** Instantâneo de todos os dados carregados no arranque (BD ou seed). */
type Snapshot = {
  utilizador: Utilizador;
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
  movimentos: Movimento[];
};

/** Snapshot inicial síncrono (SQLite local ou seed). */
function snapshotSincrono(): Snapshot {
  if (USA_SQLITE_LOCAL) {
    const db = inicializarBd();
    const { exploracoes, terrenos, animais, eventos, movimentos } = carregarTudo(db);
    return {
      utilizador: carregarUtilizador(db) ?? utilizadorSeed,
      exploracoes,
      terrenos,
      animais,
      eventos,
      movimentos,
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
      movimentos: movimentosSeed,
    };
  }
  // Web/Electron com Supabase → arranca da cache local (funciona offline).
  // A sincronização com o servidor acontece depois, num useEffect.
  const cache = lerCache();
  if (cache) {
    return { utilizador: utilizadorSeed, ...cache };
  }
  return {
    utilizador: utilizadorSeed,
    exploracoes: [],
    terrenos: [],
    animais: [],
    eventos: [],
    movimentos: [],
  };
}

type GadoContext = {
  utilizador: Utilizador;
  exploracoes: Exploracao[];
  terrenos: Terreno[];
  animais: Animal[];
  eventos: Evento[];
  /**
   * Entradas e saídas de dinheiro da exploração. Atenção: com sessão Supabase
   * a RLS já filtrou isto por papel — um trabalhador recebe apenas o que ele
   * próprio lançou. Somar esta lista NÃO dá as contas da exploração a menos
   * que quem está a ver tenha `verFinancas` (ver `permissoes.ts`).
   */
  movimentos: Movimento[];
  alertas: Alerta[];
  /** Alertas que o criador mandou calar (ver `dispensados.ts`). */
  alertasDispensados: Alerta[];
  /** Cala um alerta sem prazo a correr. */
  dispensarAlerta: (a: Alerta) => void;
  /** Volta a mostrar um alerta dispensado. */
  reativarAlerta: (id: string) => void;
  /** Há ligação para sincronizar com o servidor? (offline-first) */
  online: boolean;
  /**
   * Porque é que a última leitura do servidor falhou, tal como o servidor a
   * explicou. `null` quando correu bem.
   *
   * A leitura falha em silêncio de propósito — é o que permite continuar a
   * mostrar a cache em vez de um ecrã de erro no meio do campo. Mas "em
   * silêncio" não pode querer dizer "sem forma nenhuma de saber": sem isto,
   * uma app a mostrar dados antigos era indistinguível de uma conta vazia, e
   * a única maneira de descobrir a razão era abrir as ferramentas do
   * programador. O ecrã de Sincronização mostra isto a quem for lá ver.
   */
  erroSincronizacao: string | null;
  /** Nº de alterações locais ainda por enviar ao Supabase. */
  pendentesSinc: number;
  /**
   * Alterações que o servidor recusou (falta de permissão, validação). Foram
   * feitas offline, mostradas como gravadas, e não voltam a ser tentadas —
   * o ecrã de Sincronização mostra-as para o criador saber o que se perdeu.
   */
  falhadas: OpFalhada[];
  /** Esquece a lista de recusadas (depois de o criador a ver). */
  limparFalhadas: () => void;
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
  movimentosByAnimal: (id: string) => Movimento[];
  movimentosByExploracao: (id: string) => Movimento[];
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
    /** Preço de venda em euros (só se aplica a `vendido`). */
    valor?: number,
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
  /**
   * Liga ou desliga a gestão económica em toda a conta. Desligar ESCONDE, não
   * apaga: nenhum movimento é removido e religar devolve as contas intactas.
   */
  definirFinancasAtivas: (ativas: boolean) => Promise<void>;
  /**
   * Liga ou desliga o registo por casa/número em toda a conta. Como as
   * finanças, desligar ESCONDE: nenhuma casa já escrita é apagada, e religar
   * devolve tudo como estava.
   */
  definirCasaAtiva: (ativa: boolean) => Promise<void>;
  addMovimento: (m: Omit<Movimento, 'id'>) => Promise<Movimento>;
  updateMovimento: (id: string, patch: Partial<Movimento>) => Promise<void>;
  deleteMovimento: (id: string) => Promise<void>;
  recarregar: () => Promise<void>;
};

const Ctx = createContext<GadoContext | null>(null);

export function GadoProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const usaSupabase = supabaseConfigurado && !!sessao;

  const bootRef = useRef<Snapshot | null>(null);
  if (bootRef.current === null) bootRef.current = snapshotSincrono();
  const boot = bootRef.current;

  // Com sessão Supabase, o perfil vem da conta autenticada — não do seed (que
  // só serve o modo offline/demo). Sem sessão, fica o utilizador local.
  const utilizador = useMemo<Utilizador>(() => {
    const u = sessao?.user;
    if (!u) return boot.utilizador;
    const nome = (u.user_metadata?.nome as string | undefined)?.trim();
    return { id: u.id, nome: nome || (u.email ?? boot.utilizador.nome), email: u.email ?? boot.utilizador.email };
  }, [sessao, boot.utilizador]);
  const [exploracoes, setExploracoes] = useState<Exploracao[]>(boot.exploracoes);
  const [terrenos, setTerrenos] = useState<Terreno[]>(boot.terrenos);
  const [animais, setAnimais] = useState<Animal[]>(boot.animais);
  const [eventos, setEventos] = useState<Evento[]>(boot.eventos);
  const [movimentos, setMovimentos] = useState<Movimento[]>(boot.movimentos);

  // Espelho sempre atual do efetivo, para ler dentro das ações sem o incluir nas dependências.
  const animaisRef = useRef(animais);
  animaisRef.current = animais;
  const exploracoesRef = useRef(exploracoes);
  exploracoesRef.current = exploracoes;
  const terrenosRef = useRef(terrenos);
  terrenosRef.current = terrenos;
  const eventosRef = useRef(eventos);
  eventosRef.current = eventos;
  const movimentosRef = useRef(movimentos);
  movimentosRef.current = movimentos;

  // Todos os alertas possíveis; as preferências do utilizador (ecrã
  // "Notificações e alertas") filtram categorias e antecedência, e o que o
  // criador mandou calar sai por cima disso.
  const { preferencias: prefsNotif } = useNotificacoes();
  const [dispensas, setDispensas] = useState<Dispensas>(() =>
    cacheDisponivel ? lerDispensas() : {},
  );

  const alertasBrutos = useMemo(() => computeAlertas(animais, eventos), [animais, eventos]);

  const alertas = useMemo(
    () => filtrarDispensados(filtrarAlertas(alertasBrutos, prefsNotif), dispensas),
    [alertasBrutos, prefsNotif, dispensas],
  );

  // Esquece dispensas de alertas que já não existem. O guarda do efetivo vazio
  // é essencial: com sessão Supabase e cache fria o primeiro render ainda não
  // tem animais, e sem ele apagaríamos todas as dispensas antes de os dados
  // chegarem do servidor.
  useEffect(() => {
    if (animais.length === 0) return;
    const limpo = limparObsoletas(dispensas, new Set(alertasBrutos.map((a) => a.id)));
    if (limpo) {
      guardarDispensas(limpo);
      setDispensas(limpo);
    }
  }, [alertasBrutos, dispensas, animais.length]);

  const dispensarAlerta = useCallback((a: Alerta) => {
    setDispensas((d) => marcarDispensado(d, a));
  }, []);

  const reativarAlerta = useCallback((id: string) => {
    setDispensas((d) => reporDispensa(d, id));
  }, []);

  // Os que estão calados neste momento — para o ecrã de notificações os poder
  // mostrar e o criador conseguir voltar atrás.
  const alertasDispensados = useMemo(() => {
    const visiveis = new Set(alertas.map((a) => a.id));
    return filtrarAlertas(alertasBrutos, prefsNotif).filter((a) => !visiveis.has(a.id));
  }, [alertasBrutos, prefsNotif, alertas]);

  /**
   * Reagenda os avisos do telemóvel sempre que os alertas mudam. O atraso
   * evita repetir o trabalho durante uma sincronização, que atualiza os dados
   * várias vezes seguidas — cancelar e reagendar dezenas de notificações a
   * cada passo seria trabalho deitado fora.
   */
  useEffect(() => {
    if (!suportaNotificacoes) return;
    const t = setTimeout(() => {
      if (prefsNotif.noTelemovel) void agendarNotificacoes(alertas, prefsNotif);
      else void cancelarNotificacoes();
    }, 2000);
    return () => clearTimeout(t);
  }, [alertas, prefsNotif]);

  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  );
  const [pendentesSinc, setPendentesSinc] = useState<number>(
    cacheDisponivel ? lerOutbox().length : 0,
  );
  const [falhadas, setFalhadas] = useState<OpFalhada[]>(
    cacheDisponivel ? lerFalhadas() : [],
  );
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(null);

  const limparFalhadas = useCallback(() => {
    esquecerFalhadas();
    setFalhadas([]);
  }, []);

  /** Escrita local SQLite (só no nativo sem Supabase). */
  const gravarSqlite = useCallback((fn: (db: SQLiteDatabase) => void) => {
    if (USA_SQLITE_LOCAL) fn(abrirBd());
  }, []);

  // Mantém a cache local sempre a espelhar o que está no ecrã, para reabrir
  // offline com os dados atuais. Só com Supabase + armazenamento disponível.
  useEffect(() => {
    if (usaSupabase && cacheDisponivel) {
      guardarCache({ exploracoes, terrenos, animais, eventos, movimentos });
    }
  }, [usaSupabase, exploracoes, terrenos, animais, eventos, movimentos]);

  /** Puxa a verdade do servidor. Devolve false (mantendo a cache) se falhar. */
  const puxarDoServidor = useCallback(async (): Promise<boolean> => {
    try {
      const snap = await carregarTudoSupabase();
      setExploracoes(snap.exploracoes);
      setTerrenos(snap.terrenos);
      setAnimais(snap.animais);
      setEventos(snap.eventos);
      setMovimentos(snap.movimentos);
      setErroSincronizacao(null);
      return true;
    } catch (e) {
      // Guarda-se a razão em vez de a deitar fora. Continuar a mostrar a cache
      // é a decisão certa — o criador está no campo e os dados dele são estes
      // — mas atirar o motivo ao lixo transformava qualquer falha de leitura
      // numa app calada e vazia, sem ninguém saber de onde partir.
      setErroSincronizacao(e instanceof Error ? e.message : String(e));
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
    // Mesma ordem que em `sincronizar`: um conflito nunca é falha de rede,
    // por muito que a mensagem fale de ligação. Pô-lo na fila só o faria
    // repetir-se sem fim.
    if (!eConflito(erro) && pareceErroDeRede(erro)) {
      setPendentesSinc(adicionarOutbox(op));
      setOnline(false);
      return false;
    }
    // Erro real de validação/RLS/conflito → mostra na UI. Sem o marcador
    // técnico à frente: quem lê isto é o criador, não o código.
    throw new Error(mensagemLegivel(erro));
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
      // O conflito é verificado ANTES da heurística de rede: a sua mensagem
      // fala de ligação, e `pareceErroDeRede` pesca por palavras. Sem esta
      // ordem, um conflito voltava à fila e ficava a repetir-se para sempre,
      // porque a versão do servidor nunca mais recuaria.
      if (erro && !eConflito(erro) && pareceErroDeRede(erro)) {
        setOnline(false);
        break; // continua offline — tenta na próxima vez
      }
      if (erro) {
        // Erro lógico (RLS, validação) ou conflito de versão: repetir daria o
        // mesmo e a fila ficava presa para sempre. Sai da fila, mas fica
        // registada — esta alteração já apareceu ao criador como gravada e não
        // pode sumir em silêncio. O estado local corrige-se sozinho no
        // `puxarDoServidor()` do fim, que traz a versão vencedora.
        registarFalhada(proxima, erro, eConflito(erro) ? 'conflito' : 'recusada');
        setFalhadas(lerFalhadas());
      }
      ops = resto;
      guardarOutbox(ops);
      setPendentesSinc(ops.length);
    }
    if (ops.length === 0) {
      // O estado de ligação segue o RESULTADO da leitura, não o facto de a
      // fila ter esvaziado. Marcar `online` antes de puxar escondia a única
      // falha que interessa: com o servidor a recusar a leitura, a app ficava
      // a mostrar a cache — dados antigos, ou nenhuns — a dizer que estava
      // tudo bem. Sem aviso, sem erro, e sem nada que distinga isso de uma
      // conta mesmo vazia. Agora aparece o cartão de "sem ligação" do ecrã
      // Início, que é o que dá ao criador alguma coisa em que reparar.
      const leu = await puxarDoServidor();
      setOnline(leu);
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

  // Sincroniza automaticamente quando a ligação à rede volta (web/Electron).
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

  /**
   * No telemóvel não há eventos `online`/`offline` — são do browser. O sinal
   * equivalente é a app voltar ao primeiro plano: é aí que o criador que esteve
   * sem rede no mato reabre a app já com sinal. Sem isto a fila só era esvaziada
   * no arranque, e as gravações feitas offline ficavam retidas até reiniciar.
   */
  useEffect(() => {
    if (!usaSupabase || Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void sincronizar();
    });
    return () => sub.remove();
  }, [usaSupabase, sincronizar]);

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
  const movimentosByAnimal = useCallback(
    (id: string) =>
      movimentos
        .filter((m) => m.animalId === id)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [movimentos],
  );
  const movimentosByExploracao = useCallback(
    (id: string) => movimentos.filter((m) => m.exploracaoId === id),
    [movimentos],
  );

  /* ---- Ações ---- */

  const addAnimal = useCallback(
    async (a: Omit<Animal, 'id'>): Promise<Animal> => {
      const novo: Animal = { ...a, id: novoId() };
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
      // Guarda o que se vai remover, para poder repor se o servidor recusar.
      // Ao contrário das outras escritas otimistas, aqui a recusa é provável:
      // o servidor não elimina animais com histórico (ver `schema_eliminar.sql`),
      // e sem reposição o animal desaparecia do ecrã à mesma, para só voltar na
      // sincronização seguinte — o criador via-o sumir e depois ressuscitar.
      const animalRemovido = animaisRef.current.find((a) => a.id === id);
      const eventosRemovidos = eventosRef.current.filter((e) => e.animalId === id);
      // Também os movimentos imputados: a recusa tem de repor TUDO o que a
      // cascata local mexeu. Sem isto, o animal voltava ao ecrã mas o dinheiro
      // que lhe estava imputado ficava órfão até à sincronização seguinte — e
      // no meio disso a ficha dele mostrava um balanço a menos.
      const movimentosDesligados = movimentosRef.current.filter((m) => m.animalId === id);

      setAnimais((prev) => prev.filter((a) => a.id !== id));
      setEventos((prev) => prev.filter((e) => e.animalId !== id));
      // O dinheiro fica, o animal é que sai: espelha o `on delete set null` da
      // coluna no servidor. Apagar os movimentos junto com o animal tirava
      // despesas já pagas da conta e mudava o saldo por causa de uma limpeza.
      setMovimentos((prev) =>
        prev.map((m) => (m.animalId === id ? { ...m, animalId: undefined } : m)),
      );

      if (!usaSupabase) {
        gravarSqlite((db) => bdEliminarAnimal(db, id));
        return;
      }
      try {
        await empurrar({ op: 'delete', entidade: 'animal', id });
      } catch (e) {
        if (animalRemovido) setAnimais((prev) => [animalRemovido, ...prev]);
        if (eventosRemovidos.length > 0) setEventos((prev) => [...eventosRemovidos, ...prev]);
        if (movimentosDesligados.length > 0) {
          const repor = new Map(movimentosDesligados.map((m) => [m.id, m]));
          setMovimentos((prev) => prev.map((m) => repor.get(m.id) ?? m));
        }
        throw e; // quem chamou mostra a razão da recusa
      }
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const marcarSaida = useCallback(
    async (
      id: string,
      estado: Exclude<EstadoAnimal, 'ativo'>,
      data: string,
      motivo?: string,
      valor?: number,
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
        id: novoId(),
        animalId: id,
        tipo,
        data,
        descricao,
        detalhe: motivo,
      };

      /**
       * O preço da venda é uma RECEITA, e receitas vivem em `movimento` — não
       * em `evento.valor`, que é sempre custo. Quem não pode lançar receitas
       * (trabalhador) não passa `valor`: a saída fica registada na mesma e o
       * preço entra depois, pelo dono. Ver `vendasSemPreco()` em `financas.ts`,
       * que é o que impede essa venda de se perder de vista.
       */
      const receita: Movimento | undefined =
        estado === 'vendido' && typeof valor === 'number' && valor > 0
          ? {
              id: novoId(),
              exploracaoId: atual.exploracaoId,
              direcao: 'receita',
              categoria: 'Venda de animais',
              valor,
              data,
              descricao: motivo?.trim() ? `Venda — ${motivo.trim()}` : 'Venda de animal',
              animalId: id,
              criadoPor: utilizador.id,
            }
          : undefined;

      setAnimais((prev) => prev.map((a) => (a.id === id ? atualizado : a)));
      setEventos((prev) => [evento, ...prev]);
      if (receita) setMovimentos((prev) => [receita, ...prev]);

      if (usaSupabase) {
        try {
          await empurrar({ op: 'upsert', entidade: 'animal', dados: atualizado });
          await empurrar({ op: 'upsert', entidade: 'evento', dados: evento });
          if (receita) await empurrar({ op: 'upsert', entidade: 'movimento', dados: receita });
        } catch (e) {
          // Uma saída são três escritas ligadas entre si. Se a primeira for
          // recusada, as outras nem chegam a ser tentadas — e sem esta
          // reposição o ecrã ficava a mostrar o animal como vendido, com um
          // evento de Venda e uma receita que não existem em lado nenhum. O
          // criador via o erro e, por trás dele, tudo com ar de gravado.
          setAnimais((prev) => prev.map((a) => (a.id === id ? atual : a)));
          setEventos((prev) => prev.filter((ev) => ev.id !== evento.id));
          if (receita) setMovimentos((prev) => prev.filter((m) => m.id !== receita.id));
          throw e;
        }
      } else {
        gravarSqlite((db) => {
          guardarAnimal(db, atualizado);
          guardarEvento(db, evento);
          if (receita) guardarMovimento(db, receita);
        });
      }
    },
    [usaSupabase, gravarSqlite, empurrar, utilizador.id],
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
      const nova: Exploracao = { ...e, id: novoId(), utilizadorId: utilizador.id };
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
      setMovimentos((prev) => prev.filter((m) => m.exploracaoId !== id));
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
      const novo: Terreno = { ...t, id: novoId() };
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
      const novo: Evento = { ...e, id: novoId() };
      setEventos((prev) => [novo, ...prev]);
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'evento', dados: novo });
      else gravarSqlite((db) => guardarEvento(db, novo));
      return novo;
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const definirFinancasAtivas = useCallback(
    async (ativas: boolean): Promise<void> => {
      // Otimista, para o interruptor responder no dedo mesmo com rede fraca.
      setExploracoes((prev) => prev.map((e) => ({ ...e, financasAtivas: ativas })));

      if (usaSupabase) {
        // Pelo RPC, não por upsert: `financas_ativas` é do servidor (escrever a
        // exploração inteira daqui arriscava desfazer alterações de outra
        // pessoa). O RPC muda o perfil e todas as explorações numa transação.
        const erro = await definirFinancasAtivasSupabase(ativas);
        if (erro) {
          // Repõe o que estava — um interruptor que fica ligado depois de o
          // servidor recusar é pior do que um que não mexe.
          setExploracoes((prev) => prev.map((e) => ({ ...e, financasAtivas: !ativas })));
          throw new Error(mensagemLegivel(erro));
        }
        await puxarDoServidor();
        return;
      }
      gravarSqlite((db) => {
        exploracoesRef.current.forEach((e) =>
          guardarExploracao(db, { ...e, financasAtivas: ativas }),
        );
      });
    },
    [usaSupabase, gravarSqlite, puxarDoServidor],
  );

  const definirCasaAtiva = useCallback(
    async (ativa: boolean): Promise<void> => {
      // Mesmo desenho que `definirFinancasAtivas`, e pelas mesmas razões:
      // otimista para o interruptor responder no dedo, pelo RPC porque a
      // coluna é do servidor, e a repor o que estava se o servidor recusar.
      setExploracoes((prev) => prev.map((e) => ({ ...e, casaAtiva: ativa })));

      if (usaSupabase) {
        const erro = await definirCasaAtivaSupabase(ativa);
        if (erro) {
          setExploracoes((prev) => prev.map((e) => ({ ...e, casaAtiva: !ativa })));
          throw new Error(mensagemLegivel(erro));
        }
        await puxarDoServidor();
        return;
      }
      gravarSqlite((db) => {
        exploracoesRef.current.forEach((e) => guardarExploracao(db, { ...e, casaAtiva: ativa }));
      });
    },
    [usaSupabase, gravarSqlite, puxarDoServidor],
  );

  const addMovimento = useCallback(
    async (m: Omit<Movimento, 'id'>): Promise<Movimento> => {
      // `criadoPor` fica com o utilizador atual para a UI o poder mostrar já;
      // no servidor quem manda é o default `auth.uid()` da coluna.
      const novo: Movimento = { ...m, id: novoId(), criadoPor: m.criadoPor ?? utilizador.id };
      setMovimentos((prev) => [novo, ...prev]); // otimista — aparece já, mesmo offline
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'movimento', dados: novo });
      else gravarSqlite((db) => guardarMovimento(db, novo));
      return novo;
    },
    [usaSupabase, gravarSqlite, empurrar, utilizador.id],
  );

  const updateMovimento = useCallback(
    async (id: string, patch: Partial<Movimento>): Promise<void> => {
      const atual = movimentosRef.current.find((m) => m.id === id);
      if (!atual) return;
      const atualizado: Movimento = { ...atual, ...patch, id, exploracaoId: atual.exploracaoId };
      setMovimentos((prev) => prev.map((m) => (m.id === id ? atualizado : m)));
      if (usaSupabase) await empurrar({ op: 'upsert', entidade: 'movimento', dados: atualizado });
      else gravarSqlite((db) => guardarMovimento(db, atualizado));
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const deleteMovimento = useCallback(
    async (id: string): Promise<void> => {
      // Guarda para repor: só o dono pode apagar movimentos, e a recusa da RLS
      // só se descobre ao sincronizar. Sem reposição, o lançamento sumia do
      // ecrã e voltava sozinho na sincronização seguinte.
      const removido = movimentosRef.current.find((m) => m.id === id);
      setMovimentos((prev) => prev.filter((m) => m.id !== id));
      if (!usaSupabase) {
        gravarSqlite((db) => bdEliminarMovimento(db, id));
        return;
      }
      try {
        await empurrar({ op: 'delete', entidade: 'movimento', id });
      } catch (e) {
        if (removido) setMovimentos((prev) => [removido, ...prev]);
        throw e;
      }
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
      movimentos,
      alertas,
      alertasDispensados,
      dispensarAlerta,
      reativarAlerta,
      online,
      erroSincronizacao,
      pendentesSinc,
      falhadas,
      limparFalhadas,
      exploracaoById,
      animalById,
      terrenoById,
      animaisByExploracao,
      animaisByExploracaoIncluindoSaidos,
      terrenosByExploracao,
      eventosByAnimal,
      movimentosByAnimal,
      movimentosByExploracao,
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
      definirFinancasAtivas,
      definirCasaAtiva,
      addMovimento,
      updateMovimento,
      deleteMovimento,
      recarregar,
    }),
    [
      utilizador, exploracoes, terrenos, animais, eventos, movimentos, alertas,
      alertasDispensados, dispensarAlerta, reativarAlerta,
      online, erroSincronizacao, pendentesSinc, falhadas, limparFalhadas,
      exploracaoById, animalById, terrenoById, animaisByExploracao,
      animaisByExploracaoIncluindoSaidos,
      terrenosByExploracao, eventosByAnimal, movimentosByAnimal,
      movimentosByExploracao, addAnimal, updateAnimal,
      deleteAnimal, marcarSaida, reativarAnimal,
      addExploracao, updateExploracao, deleteExploracao,
      addTerreno, updateTerreno, deleteTerreno, addEvento,
      definirFinancasAtivas, definirCasaAtiva,
      addMovimento, updateMovimento, deleteMovimento,
      recarregar,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGado(): GadoContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGado deve ser usado dentro de <GadoProvider>');
  return ctx;
}
