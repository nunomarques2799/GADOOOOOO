/**
 * Contexto de acesso: perfil, membros/roles e superadmin.
 * ------------------------------------------------------------------
 * Hierarquia:
 *   1. Superadmin (dono da plataforma) — aprova clientes pendentes.
 *   2. Cliente (perfil `ativo`) — cria explorações; é admin delas.
 *   3. Trabalhador / veterinário — só entra via CÓDIGO DE CONVITE
 *      gerado pelo admin de uma exploração.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { acessoTerminou } from './acessoTemporario';
import { useAuth } from './auth';
import { cacheDisponivel, guardarAcesso, lerAcesso } from './cacheLocal';
import { carregarNomesEquipa, esquecerNomesEquipa } from './nomesEquipa';
import {
  CAPACIDADES_GERIVEIS,
  podeConsultar,
  podeEscrever,
  type Capacidade,
  type CapacidadeLeitura,
  type PermissoesMembro,
} from './permissoes';
import { supabase, supabaseConfigurado } from './supabase';
import { SEM_NOME } from './trabalhadores';
import type {
  Convite,
  EstadoPerfil,
  MembroExploracao,
  RoleMembro,
  UtilizadorPendente,
} from './types';

type MembrosContext = {
  aCarregar: boolean;
  /** Os vínculos que valem AGORA. Os que já passaram do prazo não entram. */
  membros: MembroExploracao[];
  /**
   * Os vínculos cujo prazo já passou. Não dão acesso nenhum — servem para a app
   * poder dizer "o seu acesso a esta exploração terminou" a quem, de outra
   * forma, encontrava a app vazia e sem explicação nenhuma.
   */
  membrosExpirados: MembroExploracao[];
  /**
   * A pessoa TINHA acesso e já não tem: só lhe restam vínculos expirados. É o
   * caso do veterinário depois da visita — conta criada, exploração nenhuma.
   */
  acessoExpirado: boolean;
  isSuperadmin: boolean;
  estadoPerfil: EstadoPerfil | null;
  /** Devolve o role do utilizador nesta exploração (ou undefined). */
  roleEm: (exploracaoId: string) => RoleMembro | undefined;
  /** Ajustes de permissões do próprio utilizador nesta exploração, se houver. */
  permissoesEm: (exploracaoId: string) => PermissoesMembro | undefined;
  /**
   * true se o utilizador pode exercer esta capacidade nesta exploração.
   * Usar para esconder controlos que o servidor iria recusar — ver
   * `permissoes.ts`, que espelha as políticas RLS.
   */
  pode: (exploracaoId: string | undefined, capacidade: Capacidade) => boolean;
  /**
   * true se o utilizador pode CONSULTAR isto. Separado de `pode` porque uma
   * conta suspensa deixa de escrever mas continua a poder ler — ver
   * `podeConsultar` em `permissoes.ts`.
   *
   * Sem exploração indicada, responde por qualquer uma onde a pessoa seja
   * membro: os ecrãs transversais (Finanças) mostram o conjunto, e exigir uma
   * exploração fecharia o ecrã a quem tem várias.
   */
  podeVer: (exploracaoId: string | undefined, capacidade: CapacidadeLeitura) => boolean;
  /**
   * true se o utilizador pode exercer a capacidade em PELO MENOS UMA das suas
   * explorações. Para ecrãs que não estão dentro de uma delas (o botão de
   * registar despesa no ecrã Finanças, por exemplo), onde `pode(undefined, …)`
   * responderia sempre que não.
   */
  podeEmAlguma: (capacidade: Capacidade) => boolean;
  /**
   * true se a conta está suspensa (superadmin bloqueou, ou ainda não aprovou):
   * a app fica só de leitura. Espelha `pode_escrever_em()` no Supabase.
   */
  contaSuspensa: boolean;
  /** true se o utilizador é admin de pelo menos uma exploração. */
  isAdminEmAlguma: boolean;
  /** Recarrega perfil + membros a partir do Supabase. */
  recarregar: () => Promise<void>;

  /* ---- Superadmin ---- */
  listarPendentes: () => Promise<UtilizadorPendente[]>;
  aprovarCliente: (userId: string) => Promise<string | null>;
  bloquearCliente: (userId: string) => Promise<string | null>;

  /* ---- Cliente admin (por exploração) ---- */
  listarConvites: (exploracaoId: string) => Promise<Convite[]>;
  criarConvite: (
    exploracaoId: string,
    role: RoleMembro,
    descricao?: string,
    /** Quanto tempo o CÓDIGO pode ser usado. */
    validadeHoras?: number,
    /** Quanto tempo o ACESSO dura depois de o código ser usado. */
    acessoHoras?: number,
  ) => Promise<{ codigo?: string; erro?: string }>;
  /**
   * Muda o prazo de acesso de alguém da equipa. `horas` a `null` tira o prazo
   * (acesso permanente); `0` termina-o já. Devolve a razão da recusa ou `null`.
   */
  definirPrazoDeAcesso: (membroId: string, horas: number | null) => Promise<string | null>;
  removerConvite: (codigo: string) => Promise<string | null>;
  listarMembrosDe: (exploracaoId: string) => Promise<
    (MembroExploracao & { nome: string })[]
  >;
  removerMembro: (membroId: string) => Promise<string | null>;
  /**
   * Grava o que esta pessoa pode alterar nesta exploração. Substitui os ajustes
   * anteriores — o que não vier fica a seguir o papel. Devolve a razão da recusa
   * ou `null` se ficou gravado.
   */
  definirPermissoes: (
    membroId: string,
    permissoes: PermissoesMembro,
  ) => Promise<string | null>;

  /* ---- Qualquer user autenticado ---- */
  resgatarConvite: (codigo: string) => Promise<string | null>;
};

const Ctx = createContext<MembrosContext | null>(null);

type RowMembro = {
  id: string;
  user_id: string;
  exploracao_id: string;
  role: RoleMembro;
  criado_em?: string | null;
  permissoes?: Record<string, unknown> | null;
  expira_em?: string | null;
};

function toMembro(r: RowMembro): MembroExploracao {
  return {
    id: r.id,
    userId: r.user_id,
    exploracaoId: r.exploracao_id,
    role: r.role,
    criadoEm: r.criado_em ?? undefined,
    permissoes: limparPermissoes(r.permissoes),
    expiraEm: r.expira_em ?? undefined,
  };
}

/** As colunas de `membro_exploracao` que a app lê. */
const COLUNAS_MEMBRO = 'id, user_id, exploracao_id, role, criado_em, permissoes, expira_em';

/**
 * A coluna `permissoes` como a app a quer: só capacidades ajustáveis, só
 * verdadeiro/falso.
 *
 * É jsonb livre no Postgres e chega da rede (e da cache local, que é um
 * ficheiro que se pode editar à mão). Uma chave desconhecida ou um valor que não
 * seja booleano viraria uma permissão a mais ou a menos calada — aqui é
 * simplesmente ignorada, e o que fica sem ajuste segue o papel.
 */
function limparPermissoes(bruto: unknown): PermissoesMembro | undefined {
  if (!bruto || typeof bruto !== 'object') return undefined;
  const limpo: PermissoesMembro = {};
  for (const c of CAPACIDADES_GERIVEIS) {
    const v = (bruto as Record<string, unknown>)[c];
    if (typeof v === 'boolean') limpo[c] = v;
  }
  return Object.keys(limpo).length > 0 ? limpo : undefined;
}

type RowConvite = {
  codigo: string;
  exploracao_id: string;
  role: RoleMembro;
  criado_por: string;
  criado_em?: string | null;
  expira_em?: string | null;
  acesso_horas?: number | null;
  usado_por?: string | null;
  usado_em?: string | null;
  descricao?: string | null;
};

function toConvite(r: RowConvite): Convite {
  return {
    codigo: r.codigo,
    exploracaoId: r.exploracao_id,
    role: r.role,
    criadoPor: r.criado_por,
    criadoEm: r.criado_em ?? undefined,
    expiraEm: r.expira_em ?? undefined,
    acessoHoras: r.acesso_horas ?? undefined,
    usadoPor: r.usado_por ?? undefined,
    usadoEm: r.usado_em ?? undefined,
    descricao: r.descricao ?? undefined,
  };
}

/**
 * Quanto tempo se espera por uma resposta antes de desistir dela.
 *
 * Estas duas consultas decidem se a app abre. Enquanto não respondem, o ecrã
 * está à espera — e um pedido a um servidor inalcançável não falha: fica
 * pendurado. Sem prazo, "sem rede" e "servidor a demorar" tornam-se a mesma
 * coisa: uma app que nunca abre e não diz porquê.
 *
 * Quinze segundos é generoso para uma rede fraca de campo e curto que chegue
 * para não parecer avaria. Desistir aqui não perde nada: fica-se com o último
 * acesso conhecido, que é como a app já funciona offline.
 */
const PRAZO_MS = 15000;

/** O resultado do pedido, ou um erro de prazo se ele não vier a tempo. */
async function comPrazo<T>(
  pedido: PromiseLike<{ data: T; error: unknown }>,
): Promise<{ data: T | null; error: unknown }> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pedido,
      new Promise<{ data: null; error: unknown }>((resolve) => {
        temporizador = setTimeout(
          () => resolve({ data: null, error: new Error('Sem resposta do servidor.') }),
          PRAZO_MS,
        );
      }),
    ]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

export function MembrosProvider({ children }: { children: ReactNode }) {
  const { sessao } = useAuth();
  const userId = sessao?.user.id ?? null;

  // Arranca do último acesso conhecido, como o store faz com os dados. Sem
  // isto, abrir a app sem rede dava `membros: []` e `estadoPerfil: 'pendente'`,
  // e o `AppRouter` mandava o criador para o ecrã de "aguarda aprovação" em vez
  // da sua exploração — a promessa de funcionar sem internet caía logo no
  // portão, antes sequer de chegar à cache.
  const acessoInicial = cacheDisponivel ? lerAcesso() : null;

  /**
   * TODOS os vínculos, incluindo os que já expiraram. O que a app usa para
   * decidir o que mostrar é o `membros` derivado logo abaixo — os expirados
   * ficam à parte, para se poder explicar a quem os tem porque é que deixou de
   * ver a exploração, em vez de o deixar num ecrã vazio sem uma palavra.
   */
  const [todosMembros, setMembros] = useState<MembroExploracao[]>(
    (acessoInicial?.membros as MembroExploracao[] | undefined) ?? [],
  );
  /**
   * O instante por que se mede o prazo. Só muda quando um acesso cai (ver o
   * efeito mais abaixo) — não é um relógio a correr, que poria a app a
   * redesenhar-se a cada segundo sem nada mudar.
   */
  const [agora, setAgora] = useState(() => Date.now());
  const [isSuperadmin, setIsSuperadmin] = useState(acessoInicial?.isSuperadmin ?? false);
  const [estadoPerfil, setEstadoPerfil] = useState<EstadoPerfil | null>(
    acessoInicial?.estadoPerfil ?? null,
  );
  const [aCarregar, setACarregar] = useState(!acessoInicial);

  const recarregar = useCallback(async () => {
    if (!supabase || !userId) {
      setMembros([]);
      setIsSuperadmin(false);
      setEstadoPerfil(null);
      setACarregar(false);
      return;
    }
    setACarregar(true);

    // Perfil (estado + flag superadmin).
    const { data: perfil, error: erroPerfil } = await comPrazo(
      supabase
        .from('perfil')
        .select('estado, is_superadmin')
        .eq('id', userId)
        .maybeSingle(),
    );

    // Sem resposta do servidor (offline) fica-se com o que já se sabia. Tratar
    // a falha como "não tem perfil" transformava cada arranque sem rede numa
    // conta suspensa: app só de leitura e aviso de suspensão a mentir.
    if (erroPerfil) {
      setACarregar(false);
      return;
    }

    const perfilLinha = perfil as { estado?: EstadoPerfil; is_superadmin?: boolean } | null;
    const novoSuperadmin = !!perfilLinha?.is_superadmin;
    const novoEstado: EstadoPerfil = perfilLinha?.estado ?? 'pendente';
    setIsSuperadmin(novoSuperadmin);
    setEstadoPerfil(novoEstado);

    // Membros do próprio user (para saber a que explorações pertence).
    const { data: rows, error: erroMembros } = await comPrazo(
      supabase
        .from('membro_exploracao')
        .select(COLUNAS_MEMBRO)
        .eq('user_id', userId),
    );
    if (erroMembros) {
      setACarregar(false);
      return; // mesma razão: não apagar os membros por causa de uma falha de rede
    }
    const novosMembros = ((rows ?? []) as RowMembro[]).map(toMembro);
    setMembros(novosMembros);

    if (cacheDisponivel) {
      guardarAcesso({
        estadoPerfil: novoEstado,
        isSuperadmin: novoSuperadmin,
        membros: novosMembros,
      });
    }

    setACarregar(false);
  }, [userId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  /* ---------------- Prazo de acesso ---------------- */

  const membros = useMemo(
    () => todosMembros.filter((m) => !acessoTerminou(m.expiraEm, new Date(agora))),
    [todosMembros, agora],
  );

  const membrosExpirados = useMemo(
    () => todosMembros.filter((m) => acessoTerminou(m.expiraEm, new Date(agora))),
    [todosMembros, agora],
  );

  /**
   * Acorda no instante em que o acesso mais próximo cai.
   *
   * Sem isto, o veterinário com a app aberta continuava a ver a exploração
   * (e os botões dela) até fechar e reabrir — o servidor recusava-lhe tudo,
   * mas só depois de ele tentar. A promessa é que o acesso termina à hora
   * marcada, e quem a tem de cumprir no ecrã é isto.
   */
  useEffect(() => {
    const seguintes = todosMembros
      .map((m) => (m.expiraEm ? new Date(m.expiraEm).getTime() : Number.NaN))
      .filter((t) => Number.isFinite(t) && t > Date.now());
    if (seguintes.length === 0) return;
    // Um segundo depois, para não acordar no exato milissegundo e o relógio do
    // aparelho ainda dar o acesso por vivo.
    const espera = Math.min(...seguintes) - Date.now() + 1000;
    // O `setTimeout` guarda o atraso num inteiro de 32 bits: acima de ~24 dias
    // dá a volta e dispara logo, em ciclo. Prazos assim tão longos esperam pela
    // sincronização seguinte, que é a toda a hora.
    if (espera > 2_147_483_647) return;
    const t = setTimeout(() => setAgora(Date.now()), espera);
    return () => clearTimeout(t);
  }, [todosMembros, agora]);

  const roleEm = useCallback(
    (exploracaoId: string): RoleMembro | undefined =>
      membros.find((m) => m.exploracaoId === exploracaoId)?.role,
    [membros],
  );

  /** Os ajustes que o dono fez a ESTE utilizador nesta exploração. */
  const permissoesEm = useCallback(
    (exploracaoId: string): PermissoesMembro | undefined =>
      membros.find((m) => m.exploracaoId === exploracaoId)?.permissoes,
    [membros],
  );

  // A decisão em si vive em `permissoes.ts` (lógica pura, testada); aqui só se
  // reúne o contexto. Ver `podeEscrever` para o porquê de cada ramo.
  const contexto = useMemo(
    () => ({ supabaseConfigurado, temSessao: !!userId, isSuperadmin, estadoPerfil }),
    [userId, isSuperadmin, estadoPerfil],
  );

  const pode = useCallback(
    (exploracaoId: string | undefined, capacidade: Capacidade): boolean =>
      podeEscrever(
        {
          ...contexto,
          role: exploracaoId ? roleEm(exploracaoId) : undefined,
          permissoes: exploracaoId ? permissoesEm(exploracaoId) : undefined,
        },
        capacidade,
      ),
    [contexto, roleEm, permissoesEm],
  );

  const podeEmAlguma = useCallback(
    (capacidade: Capacidade): boolean => {
      // Sem membros (modo local/demo, ou ainda a carregar) a decisão é a mesma
      // que `pode` toma sem papel — deixa o modo demo funcionar sem equipa.
      if (membros.length === 0) return podeEscrever({ ...contexto, role: undefined }, capacidade);
      return membros.some((m) =>
        podeEscrever({ ...contexto, role: m.role, permissoes: m.permissoes }, capacidade),
      );
    },
    [contexto, membros],
  );

  const podeVer = useCallback(
    (exploracaoId: string | undefined, capacidade: CapacidadeLeitura): boolean => {
      if (exploracaoId) {
        return podeConsultar({ ...contexto, role: roleEm(exploracaoId) }, capacidade);
      }
      if (membros.length === 0) return podeConsultar({ ...contexto, role: undefined }, capacidade);
      return membros.some((m) => podeConsultar({ ...contexto, role: m.role }, capacidade));
    },
    [contexto, roleEm, membros],
  );

  /** true se a conta está suspensa (ou por aprovar): só pode ler. */
  const contaSuspensa =
    supabaseConfigurado && !!userId && !isSuperadmin && estadoPerfil !== 'ativo';

  const isAdminEmAlguma = useMemo(() => membros.some((m) => m.role === 'admin'), [membros]);

  // "Tinha e já não tem", que é diferente de "nunca teve": a quem nunca teve, a
  // app oferece criar uma exploração ou pedir um código; a quem expirou, o que
  // faz falta é dizer o que aconteceu.
  const acessoExpirado = membros.length === 0 && membrosExpirados.length > 0;

  /* ---------------- Superadmin ---------------- */

  const listarPendentes = useCallback(async (): Promise<UtilizadorPendente[]> => {
    if (!supabase) return [];
    // RPC SECURITY DEFINER (valida eh_superadmin no servidor). Substitui a
    // antiga view `utilizadores_pendentes`, que ignorava o RLS e expunha os
    // emails/NIF de todos os pendentes a qualquer utilizador autenticado.
    const { data, error } = await supabase.rpc('superadmin_listar_pendentes');
    if (error || !data) return [];
    return data as UtilizadorPendente[];
  }, []);

  const aprovarCliente = useCallback(async (uid: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.rpc('superadmin_aprovar_cliente', { alvo: uid });
    return error?.message ?? null;
  }, []);

  const bloquearCliente = useCallback(async (uid: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.rpc('superadmin_bloquear_cliente', { alvo: uid });
    return error?.message ?? null;
  }, []);

  /* ---------------- Convites (admin de exploração) ---------------- */

  const listarConvites = useCallback(async (exploracaoId: string): Promise<Convite[]> => {
    if (!supabase) return [];
    const { data } = await supabase
      .from('convite')
      .select(
        'codigo, exploracao_id, role, criado_por, criado_em, expira_em, acesso_horas, usado_por, usado_em, descricao',
      )
      .eq('exploracao_id', exploracaoId)
      .order('criado_em', { ascending: false });
    return ((data ?? []) as RowConvite[]).map(toConvite);
  }, []);

  const criarConvite = useCallback(
    async (
      exploracaoId: string,
      role: RoleMembro,
      descricao?: string,
      validadeHoras = 168,
      acessoHoras?: number,
    ): Promise<{ codigo?: string; erro?: string }> => {
      if (!supabase) return { erro: 'Supabase não configurado.' };
      const { data, error } = await supabase.rpc('criar_convite', {
        exp_id: exploracaoId,
        novo_role: role,
        descricao_txt: descricao ?? null,
        validade_horas: validadeHoras,
        // `null` e não `undefined`: o PostgREST omite as chaves indefinidas e
        // a função ficava a receber o valor por omissão — que é o mesmo `null`,
        // mas por acidente. Escrito assim, "sem prazo" é uma decisão.
        acesso_horas: acessoHoras ?? null,
      });
      if (error) return { erro: error.message };
      return { codigo: typeof data === 'string' ? data : undefined };
    },
    [],
  );

  const definirPrazoDeAcesso = useCallback(
    async (membroId: string, horas: number | null): Promise<string | null> => {
      if (!supabase) return 'Isto exige ligação à conta: a app está em modo local.';
      const { error } = await supabase.rpc('definir_prazo_de_acesso', {
        membro_id: membroId,
        horas,
      });
      if (error) return error.message;
      // O prazo pode ser o do próprio (um superadmin a assistir), e nesse caso
      // o que a app mostra tem de mudar já.
      await recarregar();
      return null;
    },
    [recarregar],
  );

  const removerConvite = useCallback(async (codigo: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.from('convite').delete().eq('codigo', codigo);
    return error?.message ?? null;
  }, []);

  const listarMembrosDe = useCallback(async (exploracaoId: string) => {
    if (!supabase) return [];
    const { data } = await supabase
      .from('membro_exploracao')
      .select(COLUNAS_MEMBRO)
      .eq('exploracao_id', exploracaoId);
    // Os nomes vêm por RPC e não por `perfil:user_id ( nome )` embutido: a
    // política `perfil_self_select` só deixa cada um ver o SEU perfil, por isso
    // o embutido devolvia vazio para toda a gente menos para o próprio — a lista
    // de Trabalhadores aparecia com um travessão em vez de cada nome.
    const nomes = await carregarNomesEquipa();
    return ((data ?? []) as RowMembro[]).map((r) => ({
      ...toMembro(r),
      nome: nomes[r.user_id] ?? SEM_NOME,
    }));
  }, []);

  const removerMembro = useCallback(async (membroId: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.from('membro_exploracao').delete().eq('id', membroId);
    // A equipa mudou: o mapa de nomes guardado deixa de estar certo.
    if (!error) esquecerNomesEquipa();
    return error?.message ?? null;
  }, []);

  const definirPermissoes = useCallback(
    async (membroId: string, permissoes: PermissoesMembro): Promise<string | null> => {
      if (!supabase) return 'Isto exige ligação à conta: a app está em modo local.';
      // Escreve-se o conjunto todo, não uma capacidade de cada vez: um pedido
      // por interruptor, numa rede de campo, deixava a pessoa com metade das
      // permissões gravadas e a outra metade não.
      //
      // Só as chaves ajustáveis vão para o servidor (a RLS aceitaria a coluna
      // inteira, mas há uma restrição na tabela que recusa chaves que não
      // conheça — e é melhor recusar aqui do que ver a gravação toda falhar).
      const limpo: PermissoesMembro = {};
      for (const c of CAPACIDADES_GERIVEIS) {
        const v = permissoes[c];
        if (typeof v === 'boolean') limpo[c] = v;
      }
      const { error } = await supabase
        .from('membro_exploracao')
        .update({ permissoes: limpo })
        .eq('id', membroId);
      if (error) return error.message;
      // O próprio pode estar a mudar as suas permissões noutra exploração (um
      // superadmin a assistir, por exemplo) — recarregar mantém o que a app
      // mostra igual ao que o servidor vai aceitar.
      await recarregar();
      return null;
    },
    [recarregar],
  );

  /* ---------------- Resgatar convite ---------------- */

  const resgatarConvite = useCallback(async (codigo: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.rpc('resgatar_convite', { codigo_txt: codigo.trim() });
    if (error) return error.message;
    esquecerNomesEquipa(); // entrou gente nova na equipa
    await recarregar();
    return null;
  }, [recarregar]);

  const value = useMemo<MembrosContext>(
    () => ({
      aCarregar,
      membros,
      membrosExpirados,
      acessoExpirado,
      isSuperadmin,
      estadoPerfil,
      roleEm,
      permissoesEm,
      pode,
      podeVer,
      podeEmAlguma,
      contaSuspensa,
      isAdminEmAlguma,
      recarregar,
      listarPendentes,
      aprovarCliente,
      bloquearCliente,
      listarConvites,
      criarConvite,
      removerConvite,
      listarMembrosDe,
      removerMembro,
      definirPermissoes,
      definirPrazoDeAcesso,
      resgatarConvite,
    }),
    [
      aCarregar, membros, membrosExpirados, acessoExpirado,
      isSuperadmin, estadoPerfil, roleEm, permissoesEm,
      pode, podeVer, podeEmAlguma,
      contaSuspensa, isAdminEmAlguma,
      recarregar, listarPendentes, aprovarCliente, bloquearCliente,
      listarConvites, criarConvite, removerConvite, listarMembrosDe,
      removerMembro, definirPermissoes, definirPrazoDeAcesso, resgatarConvite,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMembros(): MembrosContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMembros deve ser usado dentro de <MembrosProvider>');
  return ctx;
}
