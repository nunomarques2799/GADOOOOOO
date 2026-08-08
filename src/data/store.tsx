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

import type { DadosAnimalImportado } from './animalExcel';
import { useAuth } from './auth';
import { abrirBd, inicializarBd } from './db/database';
import {
  carregarTudo,
  carregarUtilizador,
  eliminarAnimal as bdEliminarAnimal,
  eliminarExploracao as bdEliminarExploracao,
  eliminarMedicamento as bdEliminarMedicamento,
  eliminarMovimento as bdEliminarMovimento,
  eliminarTerreno as bdEliminarTerreno,
  guardarAnimal,
  guardarEvento,
  guardarExploracao,
  guardarMedicamento,
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
import { computeAlertas } from './alertas';
import { filtrarAlertas, useNotificacoes } from './notificacoes';
import {
  animaisSeed,
  eventosSeed,
  exploracoesSeed,
  medicamentosSeed,
  movimentosSeed,
  terrenosSeed,
  utilizadorSeed,
} from './seed';
import { supabaseConfigurado } from './supabase';
import {
  carregarTudoSupabase,
  definirFinancasAtivas as definirFinancasAtivasSupabase,
  definirExistenciasAtivas as definirExistenciasAtivasSupabase,
  eConflito,
  mensagemLegivel,
  eliminarAnimalSupabase,
  eliminarExploracaoSupabase,
  eliminarMedicamentoSupabase,
  eliminarMovimentoSupabase,
  eliminarTerrenoSupabase,
  upsertAnimalSupabase,
  upsertEventoSupabase,
  upsertExploracaoSupabase,
  upsertMedicamentoSupabase,
  upsertMovimentoSupabase,
  upsertTerrenoSupabase,
} from './supabaseRepo';
import type {
  Alerta,
  Animal,
  EstadoAnimal,
  Evento,
  Exploracao,
  Medicamento,
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
      case 'medicamento':
        return eliminarMedicamentoSupabase(op.id);
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
    case 'medicamento':
      return upsertMedicamentoSupabase(op.dados as Medicamento);
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
  medicamentos: Medicamento[];
};

/** Snapshot inicial síncrono (SQLite local ou seed). */
function snapshotSincrono(): Snapshot {
  if (USA_SQLITE_LOCAL) {
    const db = inicializarBd();
    const { exploracoes, terrenos, animais, eventos, movimentos, medicamentos } = carregarTudo(db);
    return {
      utilizador: carregarUtilizador(db) ?? utilizadorSeed,
      exploracoes,
      terrenos,
      animais,
      eventos,
      movimentos,
      medicamentos,
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
      medicamentos: medicamentosSeed,
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
    medicamentos: [],
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
  /**
   * Os lotes que entraram na arrecadação. Toda a equipa os vê — o veterinário
   * incluído, que precisa deles para escolher o frasco que está a usar. O que
   * RESTA de cada um não está aqui: calcula-se com os eventos (ver
   * `medicamentos.ts`).
   */
  medicamentos: Medicamento[];
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
  medicamentoById: (id: string) => Medicamento | undefined;
  medicamentosByExploracao: (id: string) => Medicamento[];
  // ações (async quando batem no Supabase; devolvem o objeto criado)
  addAnimal: (a: Omit<Animal, 'id'>) => Promise<Animal>;
  /**
   * Importa vários animais de uma vez (ex.: de um ficheiro Excel) para uma
   * exploração. Faz um único acréscimo ao estado — não N — e só depois envia
   * cada um ao servidor. Devolve quantos entraram e as recusas do servidor
   * (erros de rede não contam: esses ficam na fila e sincronizam mais tarde).
   */
  importarAnimais: (
    exploracaoId: string,
    novos: DadosAnimalImportado[],
  ) => Promise<{ criados: number; falhas: { rotulo: string; erro: string }[] }>;
  updateAnimal: (id: string, patch: Partial<Animal>) => Promise<void>;
  /**
   * Elimina um animal: tira-o das listas marcando-o como `eliminado`, sem
   * apagar o registo nem o histórico. Fica guardado quem o fez e quando, para
   * o ecrã "Histórico do efetivo" o poder mostrar.
   */
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
   * Corrige um evento já registado. Nasceu para a marcação de comunicado ao
   * SNIRA — que é uma alteração a um registo que já existe, não um registo
   * novo — e serve qualquer correção pontual.
   *
   * `comunicadoEm` NÃO se passa aqui: quem a escreve é o gatilho do servidor
   * (ver `supabase/schema_snira.sql`). O que se manda daqui é a intenção
   * (`comunicadoSnira`), e a data vem na sincronização seguinte.
   */
  updateEvento: (id: string, patch: Partial<Evento>) => Promise<void>;
  /**
   * Liga ou desliga a gestão económica em toda a conta. Desligar ESCONDE, não
   * apaga: nenhum movimento é removido e religar devolve as contas intactas.
   */
  definirFinancasAtivas: (ativas: boolean) => Promise<void>;
  /** Liga/desliga o registo de medicamentos (a aba Existências) em toda a conta. */
  definirExistenciasAtivas: (ativas: boolean) => Promise<void>;
  addMovimento: (m: Omit<Movimento, 'id'>) => Promise<Movimento>;
  updateMovimento: (id: string, patch: Partial<Movimento>) => Promise<void>;
  deleteMovimento: (id: string) => Promise<void>;
  /**
   * Dá entrada de um lote na arrecadação. Com a gestão económica ligada e
   * `lancarDespesa`, lança também a despesa correspondente — comprar
   * medicamento é dinheiro que sai, e obrigar a escrevê-lo duas vezes era a
   * garantia de que as contas ficariam a faltar-lhe uma parte.
   */
  addMedicamento: (
    m: Omit<Medicamento, 'id'>,
    opcoes?: { lancarDespesa?: boolean },
  ) => Promise<Medicamento>;
  updateMedicamento: (id: string, patch: Partial<Medicamento>) => Promise<void>;
  deleteMedicamento: (id: string) => Promise<void>;
  /**
   * Envia o que está na fila e volta a ler do servidor.
   *
   * Devolve se conseguiu LER do servidor: é o que permite a quem puxou a lista
   * para atualizar saber que continua a ver os dados do aparelho, em vez de
   * ficar a olhar para uma lista que não mudou sem saber porquê.
   */
  recarregar: () => Promise<boolean>;
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
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>(boot.medicamentos);

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
  const medicamentosRef = useRef(medicamentos);
  medicamentosRef.current = medicamentos;

  // Todos os alertas possíveis; as preferências do utilizador (ecrã
  // "Notificações e alertas") filtram categorias e antecedência, e o que o
  // criador mandou calar sai por cima disso.
  const { preferencias: prefsNotif } = useNotificacoes();
  const [dispensas, setDispensas] = useState<Dispensas>(() =>
    cacheDisponivel ? lerDispensas() : {},
  );

  const alertasBrutos = useMemo(() => {
    // Os lotes das explorações com o registo de medicamentos DESLIGADO não
    // geram avisos de validade nem de "está a acabar". Filtra-se aqui, e não
    // dentro do `computeAlertas`, para o cálculo dos alertas continuar a ser
    // lógica pura que não sabe o que é um interruptor de conta.
    //
    // Por exploração e não por conta: o interruptor é de conta, mas espelha-se
    // em cada exploração, e um trabalhador pode andar numa quinta que o tem
    // ligado e noutra que não.
    const comExistencias = new Set(
      exploracoes.filter((e) => e.existenciasAtivas).map((e) => e.id),
    );
    return computeAlertas(
      animais,
      eventos,
      medicamentos.filter((m) => comExistencias.has(m.exploracaoId)),
    );
  }, [animais, eventos, medicamentos, exploracoes]);

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

  /*
   * O agendamento dos avisos do telemóvel esteve AQUI e mudou-se para
   * `components/AgendadorAvisos.tsx`.
   *
   * Não foi arrumação: os avisos passaram a incluir o fim do acesso, que vem do
   * `useMembros()`, e o `membros.tsx` chega a este ficheiro por um caminho
   * indireto (`membros` → `nomesEquipa` → `store`). Importá-lo aqui fechava o
   * ciclo. O agendador é um componente montado dentro deste provider, onde os
   * três contextos já existem.
   *
   * Continua a haver UM só: o `agendar()` cancela tudo antes de agendar, e dois
   * a correr apagavam o trabalho um do outro.
   */

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
      guardarCache({ exploracoes, terrenos, animais, eventos, movimentos, medicamentos });
    }
  }, [usaSupabase, exploracoes, terrenos, animais, eventos, movimentos, medicamentos]);

  /** Puxa a verdade do servidor. Devolve false (mantendo a cache) se falhar. */
  const puxarDoServidor = useCallback(async (): Promise<boolean> => {
    try {
      const snap = await carregarTudoSupabase();
      setExploracoes(snap.exploracoes);
      setTerrenos(snap.terrenos);
      setAnimais(snap.animais);
      setEventos(snap.eventos);
      setMovimentos(snap.movimentos);
      setMedicamentos(snap.medicamentos);
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

  /**
   * Esvazia a fila por ordem e, se conseguir, puxa a verdade do servidor.
   *
   * Devolve se ficou com os dados do servidor. `false` cobre três coisas
   * diferentes que dão o mesmo resultado para quem está a olhar: sem rede, o
   * servidor recusou a leitura, ou a fila não esvaziou. Sem sessão Supabase
   * devolve `true` — não há servidor nenhum de quem estar à espera, e chamar a
   * isso "sem ligação" seria mentir a quem trabalha em modo offline.
   */
  const sincronizar = useCallback(async () => {
    if (!usaSupabase || !cacheDisponivel) return true;
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
        return false; // continua offline — tenta na próxima vez
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
    // O estado de ligação segue o RESULTADO da leitura, não o facto de a fila
    // ter esvaziado. Marcar `online` antes de puxar escondia a única falha que
    // interessa: com o servidor a recusar a leitura, a app ficava a mostrar a
    // cache — dados antigos, ou nenhuns — a dizer que estava tudo bem. Sem
    // aviso, sem erro, e sem nada que distinga isso de uma conta mesmo vazia.
    // Agora aparece o cartão de "sem ligação" do ecrã Início, que é o que dá ao
    // criador alguma coisa em que reparar.
    const leu = await puxarDoServidor();
    setOnline(leu);
    return leu;
  }, [usaSupabase, puxarDoServidor]);

  /** Recarrega tudo do Supabase (envia pendentes + puxa o servidor). */
  const recarregar = useCallback(async () => sincronizar(), [sincronizar]);

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
  const medicamentoById = useCallback(
    (id: string) => medicamentos.find((m) => m.id === id),
    [medicamentos],
  );
  const medicamentosByExploracao = useCallback(
    (id: string) => medicamentos.filter((m) => m.exploracaoId === id),
    [medicamentos],
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

  const importarAnimais = useCallback(
    async (
      exploracaoId: string,
      novos: DadosAnimalImportado[],
    ): Promise<{ criados: number; falhas: { rotulo: string; erro: string }[] }> => {
      const comId: Animal[] = novos.map((a) => ({ ...a, id: novoId(), exploracaoId }));
      // Um só acréscimo, não um por animal: uma folha com centenas de linhas
      // provocaria centenas de re-renders se cada um chamasse `addAnimal`.
      setAnimais((prev) => [...comId, ...prev]);

      if (!usaSupabase) {
        gravarSqlite((db) => comId.forEach((a) => guardarAnimal(db, a)));
        return { criados: comId.length, falhas: [] };
      }

      const falhas: { rotulo: string; erro: string }[] = [];
      let criados = 0;
      for (const a of comId) {
        try {
          // `empurrar` mete os erros de REDE na fila (devolve sem lançar) — esses
          // sincronizam depois e contam como criados. Só os erros lógicos (RLS,
          // validação) chegam ao catch: aí tira-se o animal do ecrã, que de outra
          // forma ficava a aparentar gravado sem nunca existir no servidor.
          await empurrar({ op: 'upsert', entidade: 'animal', dados: a });
          criados++;
        } catch (e) {
          setAnimais((prev) => prev.filter((x) => x.id !== a.id));
          falhas.push({
            rotulo: a.nome ?? a.numeroIdentificacao ?? a.id,
            erro: e instanceof Error ? e.message : String(e),
          });
        }
      }
      return { criados, falhas };
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
      // Eliminar MARCA, não apaga: o registo fica na base com o histórico e a
      // genealogia intactos, e sai das listas do dia a dia (ver
      // `supabase/schema_auditoria.sql`). O que aqui se faz é a mesma marcação,
      // já no ecrã, para o animal desaparecer da lista sem esperar pela rede.
      const antes = animaisRef.current.find((a) => a.id === id);
      if (!antes) return;

      const agora = new Date().toISOString();
      const marcado: Animal = {
        ...antes,
        estado: 'eliminado',
        terrenoId: undefined, // deixa de ocupar um terreno
        dataSaida: antes.dataSaida ?? agora.slice(0, 10),
        // Previsão otimista: quem manda nestes dois campos é o trigger do
        // servidor, e a sincronização seguinte traz os valores dele por cima.
        // Escrevê-los aqui serve só para o histórico ter autor enquanto se
        // está offline, em vez de uma linha anónima que aparece e muda depois.
        saidaPor: utilizador.id,
        saidaEm: agora,
      };
      setAnimais((prev) => prev.map((a) => (a.id === id ? marcado : a)));

      if (!usaSupabase) {
        gravarSqlite((db) => bdEliminarAnimal(db, id, utilizador.id));
        return;
      }
      try {
        await empurrar({ op: 'delete', entidade: 'animal', id });
      } catch (e) {
        // A recusa é possível (falta de permissão, conta suspensa) e sem
        // reposição o animal ficava marcado no ecrã até à sincronização
        // seguinte, que o devolvia ao efetivo sem uma palavra.
        setAnimais((prev) => prev.map((a) => (a.id === id ? antes : a)));
        throw e; // quem chamou mostra a razão da recusa
      }
    },
    [usaSupabase, gravarSqlite, empurrar, utilizador.id],
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
        // Previsão otimista de quem registou (o trigger do servidor corrige-a
        // na sincronização) — ver `deleteAnimal` e `schema_auditoria.sql`.
        saidaPor: utilizador.id,
        saidaEm: new Date().toISOString(),
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
        // A morte e a saída são das quatro coisas que a lei manda comunicar ao
        // SNIRA em sete dias. Nasce marcado como POR COMUNICAR — o `false` é o
        // que o põe na lista do ecrã "Comunicar ao SNIRA" e faz o prazo começar
        // a contar. Deixá-lo indefinido obrigava o criador a lembrar-se sozinho
        // de que tinha ali uma comunicação a fazer, que é exatamente o trabalho
        // que esta app existe para lhe tirar da cabeça.
        comunicadoSnira: false,
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
              descricao: motivo?.trim() ? `Venda: ${motivo.trim()}` : 'Venda de animal',
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
        // A auditoria da saída vai com ela: deixar cá o autor de uma saída que
        // já não existe seria um registo a descrever o que não aconteceu.
        saidaPor: undefined,
        saidaEm: undefined,
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
      // Guarda TUDO o que a cascata vai levar, para poder repor se o servidor
      // recusar — é a mesma rede de segurança do `deleteAnimal`, e aqui pesa
      // mais do que em qualquer outro sítio: a recusa é provável (só o admin
      // elimina, e uma conta suspensa não elimina nada) e o que desaparece do
      // ecrã é a exploração inteira, com terrenos, efetivo, histórico e
      // dinheiro. Sem isto, o criador via tudo sumir por trás da mensagem de
      // erro e só a sincronização seguinte lho devolvia — sem uma palavra.
      const exploracaoRemovida = exploracoesRef.current.find((e) => e.id === id);
      const terrenosRemovidos = terrenosRef.current.filter((t) => t.exploracaoId === id);
      const animaisDaExploracao = animaisRef.current.filter((a) => a.exploracaoId === id);
      const animaisRemovidos = new Set(animaisDaExploracao.map((a) => a.id));
      const eventosRemovidos = eventosRef.current.filter((e) => animaisRemovidos.has(e.animalId));
      const movimentosRemovidos = movimentosRef.current.filter((m) => m.exploracaoId === id);

      // Cascata local (funciona offline). O servidor faz a sua própria cascata.
      setEventos((prev) => prev.filter((e) => !animaisRemovidos.has(e.animalId)));
      setMovimentos((prev) => prev.filter((m) => m.exploracaoId !== id));
      setAnimais((prev) => prev.filter((a) => a.exploracaoId !== id));
      setTerrenos((prev) => prev.filter((t) => t.exploracaoId !== id));
      setExploracoes((prev) => prev.filter((e) => e.id !== id));

      if (!usaSupabase) {
        gravarSqlite((db) => bdEliminarExploracao(db, id));
        return;
      }
      try {
        const enviado = await empurrar({ op: 'delete', entidade: 'exploracao', id });
        if (enviado) await puxarDoServidor();
      } catch (e) {
        if (exploracaoRemovida) setExploracoes((prev) => [...prev, exploracaoRemovida]);
        if (terrenosRemovidos.length > 0) setTerrenos((prev) => [...prev, ...terrenosRemovidos]);
        if (animaisDaExploracao.length > 0)
          setAnimais((prev) => [...animaisDaExploracao, ...prev]);
        if (eventosRemovidos.length > 0) setEventos((prev) => [...eventosRemovidos, ...prev]);
        if (movimentosRemovidos.length > 0)
          setMovimentos((prev) => [...movimentosRemovidos, ...prev]);
        throw e; // quem chamou mostra a razão da recusa
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
      // Guarda o terreno e os animais que a cascata local desafeta dele: só
      // quem gere terrenos pode eliminá-los, e a recusa só se sabe depois. Sem
      // reposição, o terreno sumia do ecrã e o efetivo aparecia "sem terreno"
      // até à sincronização seguinte — de onde voltava tudo, sem explicação.
      const terrenoRemovido = terrenosRef.current.find((t) => t.id === id);
      const animaisDesafetados = animaisRef.current.filter((a) => a.terrenoId === id);

      setAnimais((prev) => prev.map((a) => (a.terrenoId === id ? { ...a, terrenoId: undefined } : a)));
      setTerrenos((prev) => prev.filter((t) => t.id !== id));

      if (!usaSupabase) {
        gravarSqlite((db) => bdEliminarTerreno(db, id));
        return;
      }
      try {
        await empurrar({ op: 'delete', entidade: 'terreno', id });
      } catch (e) {
        if (terrenoRemovido) setTerrenos((prev) => [...prev, terrenoRemovido]);
        if (animaisDesafetados.length > 0) {
          const repor = new Map(animaisDesafetados.map((a) => [a.id, a]));
          setAnimais((prev) => prev.map((a) => repor.get(a.id) ?? a));
        }
        throw e; // quem chamou mostra a razão da recusa
      }
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

  const updateEvento = useCallback(
    async (id: string, patch: Partial<Evento>): Promise<void> => {
      const atual = eventosRef.current.find((e) => e.id === id);
      if (!atual) return;
      const atualizado: Evento = { ...atual, ...patch, id, animalId: atual.animalId };
      setEventos((prev) => prev.map((e) => (e.id === id ? atualizado : e)));
      if (usaSupabase) {
        try {
          await empurrar({ op: 'upsert', entidade: 'evento', dados: atualizado });
        } catch (e) {
          // Repõe o que estava. Sem isto, uma marcação de "comunicado ao SNIRA"
          // recusada pela RLS ficava a dizer que sim no ecrã, e o alerta que
          // avisava do prazo desaparecia com ela — que é exatamente o pior
          // resultado possível numa lista cuja única função é não deixar
          // esquecer um prazo legal.
          setEventos((prev) => prev.map((ev) => (ev.id === id ? atual : ev)));
          throw e;
        }
      } else {
        gravarSqlite((db) => guardarEvento(db, atualizado));
      }
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

  /** O mesmo, para o registo de medicamentos. Ver `definirFinancasAtivas`. */
  const definirExistenciasAtivas = useCallback(
    async (ativas: boolean): Promise<void> => {
      setExploracoes((prev) => prev.map((e) => ({ ...e, existenciasAtivas: ativas })));

      if (usaSupabase) {
        const erro = await definirExistenciasAtivasSupabase(ativas);
        if (erro) {
          setExploracoes((prev) => prev.map((e) => ({ ...e, existenciasAtivas: !ativas })));
          throw new Error(mensagemLegivel(erro));
        }
        await puxarDoServidor();
        return;
      }
      gravarSqlite((db) => {
        exploracoesRef.current.forEach((e) =>
          guardarExploracao(db, { ...e, existenciasAtivas: ativas }),
        );
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

  /* ---- Existências de medicamentos ---- */

  const addMedicamento = useCallback(
    async (
      m: Omit<Medicamento, 'id'>,
      opcoes?: { lancarDespesa?: boolean },
    ): Promise<Medicamento> => {
      const novo: Medicamento = { ...m, id: novoId(), criadoPor: m.criadoPor ?? utilizador.id };

      /**
       * Comprar medicamento é dinheiro que sai. A despesa nasce aqui, com o
       * lote, em vez de ficar à espera de o criador se lembrar de a lançar
       * outra vez no ecrã das Finanças — e é `Sanidade` porque é lá que ela
       * pertence nas contas da exploração.
       *
       * Quem decide se ela é lançada é quem chama: só o faz se a gestão
       * económica estiver ligada E esta pessoa puder registar despesas. O store
       * não repete essa pergunta (é do `useFinancas`), mas também não inventa a
       * despesa sozinho — sem `lancarDespesa`, entra só o lote.
       */
      const despesa: Movimento | undefined =
        opcoes?.lancarDespesa && typeof novo.custo === 'number' && novo.custo > 0
          ? {
              id: novoId(),
              exploracaoId: novo.exploracaoId,
              direcao: 'despesa',
              categoria: 'Sanidade',
              valor: novo.custo,
              data: novo.dataCompra,
              descricao: novo.lote?.trim()
                ? `${novo.nome} · lote ${novo.lote.trim()}`
                : novo.nome,
              contraparte: novo.fornecedor,
              criadoPor: utilizador.id,
            }
          : undefined;

      setMedicamentos((prev) => [novo, ...prev]);
      if (despesa) setMovimentos((prev) => [despesa, ...prev]);

      if (!usaSupabase) {
        gravarSqlite((db) => {
          guardarMedicamento(db, novo);
          if (despesa) guardarMovimento(db, despesa);
        });
        return novo;
      }

      try {
        await empurrar({ op: 'upsert', entidade: 'medicamento', dados: novo });
      } catch (e) {
        setMedicamentos((prev) => prev.filter((x) => x.id !== novo.id));
        if (despesa) setMovimentos((prev) => prev.filter((x) => x.id !== despesa.id));
        throw e;
      }

      if (despesa) {
        try {
          await empurrar({ op: 'upsert', entidade: 'movimento', dados: despesa });
        } catch (e) {
          // O lote FICA — deu entrada e é isso que interessa à arrecadação. O
          // que se desfaz é só a despesa, e quem chamou mostra a razão: um
          // lançamento a aparecer nas contas sem existir no servidor era pior
          // do que não haver lançamento nenhum.
          setMovimentos((prev) => prev.filter((x) => x.id !== despesa.id));
          throw e;
        }
      }
      return novo;
    },
    [usaSupabase, gravarSqlite, empurrar, utilizador.id],
  );

  const updateMedicamento = useCallback(
    async (id: string, patch: Partial<Medicamento>): Promise<void> => {
      const atual = medicamentosRef.current.find((m) => m.id === id);
      if (!atual) return;
      const atualizado: Medicamento = { ...atual, ...patch, id, exploracaoId: atual.exploracaoId };
      setMedicamentos((prev) => prev.map((m) => (m.id === id ? atualizado : m)));
      if (usaSupabase) {
        try {
          await empurrar({ op: 'upsert', entidade: 'medicamento', dados: atualizado });
        } catch (e) {
          setMedicamentos((prev) => prev.map((m) => (m.id === id ? atual : m)));
          throw e;
        }
      } else {
        gravarSqlite((db) => guardarMedicamento(db, atualizado));
      }
    },
    [usaSupabase, gravarSqlite, empurrar],
  );

  const deleteMedicamento = useCallback(
    async (id: string): Promise<void> => {
      const removido = medicamentosRef.current.find((m) => m.id === id);
      // Os tratamentos que saíram deste lote FICAM: aconteceram. O que se perde
      // é a ligação ao frasco — é o `on delete set null` do servidor, feito
      // também aqui para o ecrã não ficar com registos a apontar para um lote
      // que já não existe enquanto a sincronização não chega.
      const desligados = eventosRef.current.filter((e) => e.medicamentoId === id);
      setEventos((prev) =>
        prev.map((e) => (e.medicamentoId === id ? { ...e, medicamentoId: undefined } : e)),
      );
      setMedicamentos((prev) => prev.filter((m) => m.id !== id));

      if (!usaSupabase) {
        gravarSqlite((db) => bdEliminarMedicamento(db, id));
        return;
      }
      try {
        await empurrar({ op: 'delete', entidade: 'medicamento', id });
      } catch (e) {
        if (removido) setMedicamentos((prev) => [removido, ...prev]);
        if (desligados.length > 0) {
          const repor = new Map(desligados.map((ev) => [ev.id, ev]));
          setEventos((prev) => prev.map((ev) => repor.get(ev.id) ?? ev));
        }
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
      medicamentos,
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
      medicamentoById,
      medicamentosByExploracao,
      addAnimal,
      importarAnimais,
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
      updateEvento,
      definirFinancasAtivas,
      definirExistenciasAtivas,
      addMovimento,
      updateMovimento,
      deleteMovimento,
      addMedicamento,
      updateMedicamento,
      deleteMedicamento,
      recarregar,
    }),
    [
      utilizador, exploracoes, terrenos, animais, eventos, movimentos, medicamentos, alertas,
      alertasDispensados, dispensarAlerta, reativarAlerta,
      online, erroSincronizacao, pendentesSinc, falhadas, limparFalhadas,
      exploracaoById, animalById, terrenoById, animaisByExploracao,
      animaisByExploracaoIncluindoSaidos,
      terrenosByExploracao, eventosByAnimal, movimentosByAnimal,
      movimentosByExploracao, medicamentoById, medicamentosByExploracao,
      addAnimal, importarAnimais, updateAnimal,
      deleteAnimal, marcarSaida, reativarAnimal,
      addExploracao, updateExploracao, deleteExploracao,
      addTerreno, updateTerreno, deleteTerreno, addEvento, updateEvento,
      definirFinancasAtivas,
      definirExistenciasAtivas,
      addMovimento, updateMovimento, deleteMovimento,
      addMedicamento, updateMedicamento, deleteMedicamento,
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
