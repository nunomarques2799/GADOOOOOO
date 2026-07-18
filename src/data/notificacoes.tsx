/**
 * Preferências de notificações.
 * ------------------------------------------------------------------
 * Que categorias de alerta o utilizador quer receber e com que antecedência
 * (em dias) começam a aparecer. O alerta em si continua a ser calculado por
 * computeAlertas; aqui só filtramos.
 *
 * Estas preferências são a fonte de verdade tanto para o ecrã "Precisa da sua
 * atenção" como para as notificações locais agendadas (`agendarNotificacoes`).
 *
 * Persistidas via `armazenamento.ts` (KV síncrono: SQLite no telemóvel,
 * localStorage na web). Até 2026-07-18 isto usava `window.localStorage`
 * diretamente — que não existe em React Native. O `?.` engolia a falha em
 * silêncio: no Android o criador ajustava as antecedências, fechava a app, e
 * voltava tudo ao valor de omissão sem nenhum erro visível.
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

import { guardar as guardarKv, ler as lerKv } from './armazenamento';
import type { Alerta } from './types';

/* ---- Categorias ---- */

/** Categorias que a app conhece (espelha `Alerta['categoria']`). */
export const CATEGORIAS = [
  'identificacao',
  'snira',
  'parto',
  'medicamento',
  'vacinacao',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const rotuloCategoria: Record<Categoria, string> = {
  identificacao: 'Identificação (brinco)',
  snira: 'Comunicação ao SNIRA',
  parto: 'Partos previstos',
  medicamento: 'Fim de tratamentos e intervalos de segurança',
  vacinacao: 'Vacinações',
};

export const iconeCategoria: Record<Categoria, string> = {
  identificacao: 'tag-outline',
  snira: 'cloud-upload-outline',
  parto: 'baby-bottle-outline',
  medicamento: 'medical-bag',
  vacinacao: 'needle',
};

/* ---- Preferências ---- */

export type Preferencias = {
  /** Se falso, esta categoria não aparece no ecrã de alertas. */
  ativa: Record<Categoria, boolean>;
  /** Dias de antecedência a partir dos quais o alerta começa a aparecer. */
  antecedenciaDias: Record<Categoria, number>;
  /** Avisar no telemóvel (notificação), além da lista dentro da app. */
  noTelemovel: boolean;
};

export const PREF_OMISSAO: Preferencias = {
  ativa: { identificacao: true, snira: true, parto: true, medicamento: true, vacinacao: true },
  // Faz sentido receber mais cedo o que tem prazo legal; o resto pode ficar
  // mais próximo do prazo para não encher a lista.
  antecedenciaDias: { identificacao: 20, snira: 10, parto: 14, medicamento: 5, vacinacao: 30 },
  // Ligado por omissão, mas sem efeito nenhum até o sistema dar autorização —
  // o diálogo de permissão só aparece quando o criador o pede no ecrã.
  noTelemovel: true,
};

const CHAVE = 'gado.preferencias-notificacoes.v1';

function ler(): Preferencias {
  const bruto = lerKv(CHAVE);
  if (!bruto) return PREF_OMISSAO;
  try {
    const p = JSON.parse(bruto) as Partial<Preferencias>;
    // Merge com omissão para sobreviver a categorias novas.
    return {
      ativa: { ...PREF_OMISSAO.ativa, ...(p.ativa ?? {}) },
      antecedenciaDias: { ...PREF_OMISSAO.antecedenciaDias, ...(p.antecedenciaDias ?? {}) },
      noTelemovel: p.noTelemovel ?? PREF_OMISSAO.noTelemovel,
    };
  } catch {
    return PREF_OMISSAO;
  }
}

function guardar(p: Preferencias) {
  // `guardarKv` já engole falhas de disco/quota: sem armazenamento persistente
  // a preferência continua ativa em memória e perde-se ao fechar. Não vale bloquear.
  guardarKv(CHAVE, JSON.stringify(p));
}

/* ---- Contexto para partilha entre store e ecrã ---- */

type Ctx = {
  preferencias: Preferencias;
  definirAtiva: (c: Categoria, ativa: boolean) => void;
  definirAntecedencia: (c: Categoria, dias: number) => void;
  definirNoTelemovel: (v: boolean) => void;
  repor: () => void;
};

const NotifCtx = createContext<Ctx | null>(null);

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState<Preferencias>(() => ler());

  useEffect(() => {
    guardar(preferencias);
  }, [preferencias]);

  const definirAtiva = useCallback((c: Categoria, ativa: boolean) => {
    setPreferencias((p) => ({ ...p, ativa: { ...p.ativa, [c]: ativa } }));
  }, []);

  const definirAntecedencia = useCallback((c: Categoria, dias: number) => {
    setPreferencias((p) => ({
      ...p,
      antecedenciaDias: { ...p.antecedenciaDias, [c]: dias },
    }));
  }, []);

  const definirNoTelemovel = useCallback((v: boolean) => {
    setPreferencias((p) => ({ ...p, noTelemovel: v }));
  }, []);

  const repor = useCallback(() => setPreferencias(PREF_OMISSAO), []);

  const valor = useMemo<Ctx>(
    () => ({ preferencias, definirAtiva, definirAntecedencia, definirNoTelemovel, repor }),
    [preferencias, definirAtiva, definirAntecedencia, definirNoTelemovel, repor],
  );

  return <NotifCtx.Provider value={valor}>{children}</NotifCtx.Provider>;
}

export function useNotificacoes(): Ctx {
  const ctx = useContext(NotifCtx);
  if (!ctx) throw new Error('useNotificacoes fora do NotificacoesProvider');
  return ctx;
}

/**
 * Aplica as preferências à lista de alertas: tira categorias desligadas e
 * limita cada uma à antecedência escolhida. Alertas vencidos ou urgentes
 * passam sempre — se ignorássemos, a preferência esconderia prazos legais.
 */
export function filtrarAlertas(alertas: Alerta[], p: Preferencias): Alerta[] {
  return alertas.filter((a) => {
    if (!p.ativa[a.categoria]) return false;
    if (a.gravidade === 'urgente') return true;
    const dias = a.diasRestantes;
    if (dias === undefined || dias <= 0) return true;
    return dias <= p.antecedenciaDias[a.categoria];
  });
}
