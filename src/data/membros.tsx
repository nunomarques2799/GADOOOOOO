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

import { useAuth } from './auth';
import { cacheDisponivel, guardarAcesso, lerAcesso } from './cacheLocal';
import { podeEscrever, type Capacidade } from './permissoes';
import { supabase, supabaseConfigurado } from './supabase';
import type {
  Convite,
  EstadoPerfil,
  MembroExploracao,
  RoleMembro,
  UtilizadorPendente,
} from './types';

type MembrosContext = {
  aCarregar: boolean;
  membros: MembroExploracao[];
  isSuperadmin: boolean;
  estadoPerfil: EstadoPerfil | null;
  /** Devolve o role do utilizador nesta exploração (ou undefined). */
  roleEm: (exploracaoId: string) => RoleMembro | undefined;
  /**
   * true se o utilizador pode exercer esta capacidade nesta exploração.
   * Usar para esconder controlos que o servidor iria recusar — ver
   * `permissoes.ts`, que espelha as políticas RLS.
   */
  pode: (exploracaoId: string | undefined, capacidade: Capacidade) => boolean;
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
    validadeHoras?: number,
  ) => Promise<{ codigo?: string; erro?: string }>;
  removerConvite: (codigo: string) => Promise<string | null>;
  listarMembrosDe: (exploracaoId: string) => Promise<
    (MembroExploracao & { nome: string })[]
  >;
  removerMembro: (membroId: string) => Promise<string | null>;

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
};

function toMembro(r: RowMembro): MembroExploracao {
  return {
    id: r.id,
    userId: r.user_id,
    exploracaoId: r.exploracao_id,
    role: r.role,
    criadoEm: r.criado_em ?? undefined,
  };
}

type RowConvite = {
  codigo: string;
  exploracao_id: string;
  role: RoleMembro;
  criado_por: string;
  criado_em?: string | null;
  expira_em?: string | null;
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
    usadoPor: r.usado_por ?? undefined,
    usadoEm: r.usado_em ?? undefined,
    descricao: r.descricao ?? undefined,
  };
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

  const [membros, setMembros] = useState<MembroExploracao[]>(
    (acessoInicial?.membros as MembroExploracao[] | undefined) ?? [],
  );
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
    const { data: perfil, error: erroPerfil } = await supabase
      .from('perfil')
      .select('estado, is_superadmin')
      .eq('id', userId)
      .maybeSingle();

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
    const { data: rows, error: erroMembros } = await supabase
      .from('membro_exploracao')
      .select('id, user_id, exploracao_id, role, criado_em')
      .eq('user_id', userId);
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

  const roleEm = useCallback(
    (exploracaoId: string): RoleMembro | undefined =>
      membros.find((m) => m.exploracaoId === exploracaoId)?.role,
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
      podeEscrever({ ...contexto, role: exploracaoId ? roleEm(exploracaoId) : undefined }, capacidade),
    [contexto, roleEm],
  );

  /** true se a conta está suspensa (ou por aprovar): só pode ler. */
  const contaSuspensa =
    supabaseConfigurado && !!userId && !isSuperadmin && estadoPerfil !== 'ativo';

  const isAdminEmAlguma = useMemo(() => membros.some((m) => m.role === 'admin'), [membros]);

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
      .select('codigo, exploracao_id, role, criado_por, criado_em, expira_em, usado_por, usado_em, descricao')
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
    ): Promise<{ codigo?: string; erro?: string }> => {
      if (!supabase) return { erro: 'Supabase não configurado.' };
      const { data, error } = await supabase.rpc('criar_convite', {
        exp_id: exploracaoId,
        novo_role: role,
        descricao_txt: descricao ?? null,
        validade_horas: validadeHoras,
      });
      if (error) return { erro: error.message };
      return { codigo: typeof data === 'string' ? data : undefined };
    },
    [],
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
      .select('id, user_id, exploracao_id, role, criado_em, perfil:user_id ( nome )')
      .eq('exploracao_id', exploracaoId);
    type Row = RowMembro & { perfil?: { nome?: string } | null };
    return ((data ?? []) as Row[]).map((r) => ({
      ...toMembro(r),
      nome: r.perfil?.nome ?? '—',
    }));
  }, []);

  const removerMembro = useCallback(async (membroId: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.from('membro_exploracao').delete().eq('id', membroId);
    return error?.message ?? null;
  }, []);

  /* ---------------- Resgatar convite ---------------- */

  const resgatarConvite = useCallback(async (codigo: string): Promise<string | null> => {
    if (!supabase) return 'Supabase não configurado.';
    const { error } = await supabase.rpc('resgatar_convite', { codigo_txt: codigo.trim() });
    if (error) return error.message;
    await recarregar();
    return null;
  }, [recarregar]);

  const value = useMemo<MembrosContext>(
    () => ({
      aCarregar,
      membros,
      isSuperadmin,
      estadoPerfil,
      roleEm,
      pode,
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
      resgatarConvite,
    }),
    [
      aCarregar, membros, isSuperadmin, estadoPerfil, roleEm, pode, contaSuspensa, isAdminEmAlguma,
      recarregar, listarPendentes, aprovarCliente, bloquearCliente,
      listarConvites, criarConvite, removerConvite, listarMembrosDe,
      removerMembro, resgatarConvite,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMembros(): MembrosContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMembros deve ser usado dentro de <MembrosProvider>');
  return ctx;
}
