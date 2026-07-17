/**
 * Preferências de notificações.
 * ------------------------------------------------------------------
 * Que categorias de alerta o utilizador quer receber e com que antecedência
 * (em dias) começam a aparecer. Guardadas em localStorage — o alerta em si
 * continua a ser calculado por computeAlertas; aqui só filtramos.
 *
 * Nota: hoje isto só afeta o que aparece no ecrã "Precisa da sua atenção".
 * Quando entrar as notificações push (expo-notifications), esta mesma
 * preferência é a fonte de verdade para decidir o quê e quando notificar.
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
};

export const PREF_OMISSAO: Preferencias = {
  ativa: { identificacao: true, snira: true, parto: true, medicamento: true, vacinacao: true },
  // Faz sentido receber mais cedo o que tem prazo legal; o resto pode ficar
  // mais próximo do prazo para não encher a lista.
  antecedenciaDias: { identificacao: 20, snira: 10, parto: 14, medicamento: 5, vacinacao: 30 },
};

const CHAVE = 'gado.preferencias-notificacoes.v1';

function ler(): Preferencias {
  if (typeof window === 'undefined') return PREF_OMISSAO;
  try {
    const bruto = window.localStorage?.getItem(CHAVE);
    if (!bruto) return PREF_OMISSAO;
    const p = JSON.parse(bruto) as Partial<Preferencias>;
    // Merge com omissão para sobreviver a categorias novas.
    return {
      ativa: { ...PREF_OMISSAO.ativa, ...(p.ativa ?? {}) },
      antecedenciaDias: { ...PREF_OMISSAO.antecedenciaDias, ...(p.antecedenciaDias ?? {}) },
    };
  } catch {
    return PREF_OMISSAO;
  }
}

function guardar(p: Preferencias) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(CHAVE, JSON.stringify(p));
  } catch {
    // Sem armazenamento persistente (modo privado, quota) — a preferência
    // continua ativa em memória; perde-se ao fechar a app. Não vale bloquear.
  }
}

/* ---- Contexto para partilha entre store e ecrã ---- */

type Ctx = {
  preferencias: Preferencias;
  definirAtiva: (c: Categoria, ativa: boolean) => void;
  definirAntecedencia: (c: Categoria, dias: number) => void;
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

  const repor = useCallback(() => setPreferencias(PREF_OMISSAO), []);

  const valor = useMemo<Ctx>(
    () => ({ preferencias, definirAtiva, definirAntecedencia, repor }),
    [preferencias, definirAtiva, definirAntecedencia, repor],
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
