/**
 * Avisos curtos de "correu bem / não correu" — os toasts.
 * ------------------------------------------------------------------
 * Até aqui, uma gravação bem sucedida não dizia nada: o ecrã fechava-se e o
 * criador ficava a olhar para a lista à procura do animal que acabou de
 * registar. E as falhas ou apareciam num `Alert` que obriga a tocar em "OK"
 * (ver `avisos.ts`), ou — pior — só numa linha vermelha dentro de um
 * formulário que já tinha sido fechado, ou seja, em sítio nenhum.
 *
 * A diferença em relação ao `avisar()` é a intenção: o `Alert` interrompe e
 * exige resposta, e serve para o que o criador TEM de ler antes de continuar.
 * Isto passa por cima do ecrã, desaparece sozinho, e serve para confirmar o
 * que ele acabou de fazer. Confirmações que interrompem ensinam a tocar em
 * "OK" sem ler, o que estraga também os avisos a sério.
 *
 * A fila vive na raiz da app (ver `_layout.tsx`) para o aviso sobreviver ao
 * `router.back()` que quase sempre vem a seguir a uma gravação: quem manda a
 * mensagem já não está no ecrã quando ela aparece.
 */

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
import { AccessibilityInfo } from 'react-native';

import { vibrarErro, vibrarSucesso } from './vibrar';

export type TipoToast = 'sucesso' | 'erro' | 'info';

export type Toast = {
  id: number;
  tipo: TipoToast;
  /** Uma linha, no que aconteceu: "Animal registado". */
  mensagem: string;
  /** Segunda linha opcional — o nome do animal, a razão da recusa. */
  detalhe?: string;
};

/**
 * Quantos se veem ao mesmo tempo. Três é o que cabe sem tapar o ecrã; uma
 * importação de Excel que falhe linha a linha encheria a app de cartões.
 */
export const MAX_TOASTS = 3;

/**
 * Quanto tempo fica no ecrã. O erro fica muito mais tempo de propósito: tem
 * texto do servidor para ler e é a única cópia da má notícia — enquanto o
 * "gravado" é confirmação de algo que se vê logo na lista por baixo.
 */
export const DURACAO_MS: Record<TipoToast, number> = {
  sucesso: 3500,
  info: 4500,
  erro: 9000,
};

/**
 * Acrescenta à fila, respeitando o teto e juntando repetições.
 *
 * A junção é o que evita o cartão duplicado do toque duplo (e da gravação que
 * dispara o mesmo aviso duas vezes): a mensagem igual à última substitui-a, e
 * como leva id novo o tempo dela volta ao início.
 */
export function acrescentar(fila: Toast[], novo: Toast, max = MAX_TOASTS): Toast[] {
  const ultimo = fila[fila.length - 1];
  const repetido =
    ultimo && ultimo.tipo === novo.tipo
    && ultimo.mensagem === novo.mensagem
    && ultimo.detalhe === novo.detalhe;
  const base = repetido ? fila.slice(0, -1) : fila;
  // Os mais antigos saem primeiro: o que interessa é sempre o que acabou de
  // acontecer.
  return [...base, novo].slice(-max);
}

/** Tira um da fila (o tempo esgotou-se, ou o criador tocou nele). */
export function remover(fila: Toast[], id: number): Toast[] {
  return fila.filter((t) => t.id !== id);
}

/**
 * A razão de uma falha, em texto. As mensagens do Supabase já vêm traduzidas
 * para português por `mensagemLegivel()` (ver `supabaseRepo.ts`) antes de
 * chegarem aqui; isto é a última rede, para o caso de vir outra coisa.
 */
export function mensagemDeErro(e: unknown): string {
  // O `Error` trata-se à parte mesmo quando não traz mensagem: `String(erro)`
  // dava "Error:", que é pior do que não dizer nada — parece um erro do código
  // a quem só quer saber se ficou gravado.
  if (e instanceof Error) return e.message.trim() || SEM_RAZAO;
  const t = String(e ?? '').trim();
  return t || SEM_RAZAO;
}

const SEM_RAZAO = 'Ocorreu um erro inesperado.';

/**
 * Diz a mensagem ao leitor de ecrã (TalkBack/VoiceOver).
 *
 * Só quando ele está ligado: no Android, chamar isto com o TalkBack desligado
 * não faz nada, mas na web o `react-native-web` cria um elemento vivo na página
 * a cada aviso, e não vale sujar o DOM por nada. A resposta ao
 * `isScreenReaderEnabled` chega depois do cartão aparecer, o que não tem
 * importância — o anúncio é uma segunda via, não a primeira.
 */
export function anunciar(texto: string): void {
  try {
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((ligado) => {
        if (ligado) AccessibilityInfo.announceForAccessibility(texto);
      })
      .catch(() => undefined);
  } catch {
    /* plataforma sem suporte — o cartão em si continua legível */
  }
}

type ToastsContext = {
  /** A fila, do mais antigo para o mais recente. */
  toasts: Toast[];
  /** "Animal registado." — verde, com visto. */
  sucesso: (mensagem: string, detalhe?: string) => void;
  /** "Não foi possível registar o animal." — vermelho, e fica mais tempo. */
  erro: (mensagem: string, detalhe?: string) => void;
  /** Nem bom nem mau: "Relatório aberto para impressão". */
  info: (mensagem: string, detalhe?: string) => void;
  dispensar: (id: number) => void;
};

const Ctx = createContext<ToastsContext | null>(null);

export function ToastsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const proximoId = useRef(1);
  const temporizadores = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dispensar = useCallback((id: number) => {
    const t = temporizadores.current.get(id);
    if (t) {
      clearTimeout(t);
      temporizadores.current.delete(id);
    }
    setToasts((f) => remover(f, id));
  }, []);

  const mostrar = useCallback(
    (tipo: TipoToast, mensagem: string, detalhe?: string) => {
      const id = proximoId.current++;
      setToasts((f) => acrescentar(f, { id, tipo, mensagem, detalhe }));

      // Sentir e ouvir, além de ver. Aqui, e não em cada ecrã: é este o sítio
      // por onde passa toda a ação que grava, apaga ou escreve um ficheiro.
      if (tipo === 'sucesso') vibrarSucesso();
      else if (tipo === 'erro') vibrarErro();

      // O cartão desaparece em segundos e a `accessibilityLiveRegion` só existe
      // no Android — sem este anúncio, quem usa o leitor de ecrã só ouvia o
      // aviso se por acaso o dedo lhe caísse em cima antes de ele sumir. É a
      // única cópia da má notícia (ver DURACAO_MS).
      anunciar(detalhe ? `${mensagem}. ${detalhe}` : mensagem);
      temporizadores.current.set(
        id,
        setTimeout(() => {
          temporizadores.current.delete(id);
          setToasts((f) => remover(f, id));
        }, DURACAO_MS[tipo]),
      );
    },
    [],
  );

  // Sem isto, um temporizador a correr durante um recarregamento da app (troca
  // de paleta, atualização web) tentava mexer em estado já desmontado.
  useEffect(
    () => () => {
      temporizadores.current.forEach((t) => clearTimeout(t));
      temporizadores.current.clear();
    },
    [],
  );

  const sucesso = useCallback(
    (m: string, d?: string) => mostrar('sucesso', m, d),
    [mostrar],
  );
  const erro = useCallback((m: string, d?: string) => mostrar('erro', m, d), [mostrar]);
  const info = useCallback((m: string, d?: string) => mostrar('info', m, d), [mostrar]);

  const value = useMemo<ToastsContext>(
    () => ({ toasts, sucesso, erro, info, dispensar }),
    [toasts, sucesso, erro, info, dispensar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Os avisos, para quem os manda e para quem os mostra.
 *
 * Devolve uma versão que não faz nada quando não há provider — e não um erro,
 * ao contrário de `useGado()`. Um aviso é acessório: um ecrã montado num teste,
 * ou fora da árvore da app, não pode rebentar por causa dele.
 */
export function useToasts(): ToastsContext {
  const ctx = useContext(Ctx);
  return ctx ?? VAZIO;
}

const VAZIO: ToastsContext = {
  toasts: [],
  sucesso: () => {},
  erro: () => {},
  info: () => {},
  dispensar: () => {},
};
