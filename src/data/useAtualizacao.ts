/**
 * Aviso de nova versão da app desktop (Windows).
 * ------------------------------------------------------------------
 * Só corre dentro do Electron (app desktop). No telemóvel/web fica inerte.
 * Compara a data em que ESTE build foi gerado (EXPO_PUBLIC_BUILD_TIME, injetada
 * no CI durante o `expo export`) com a data do ZIP publicado no GitHub Release.
 * Se o ZIP for claramente mais recente, há uma versão nova para descarregar.
 *
 * Não instala nada — apenas avisa. A distribuição continua a ser o mesmo ZIP.
 */

import { useEffect, useState } from 'react';

const REPO = 'nunomarques2799/GADOOOOOO';
const API_RELEASE = `https://api.github.com/repos/${REPO}/releases/tags/windows`;

/** Página do site com o botão de descarregar e as instruções. */
export const URL_DESCARREGAR = 'https://gestaogado.netlify.app/#descarregar';

/** Data em que este build foi gerado (ISO). Injetada pelo CI no export. */
const BUILD_TIME = process.env.EXPO_PUBLIC_BUILD_TIME;

/**
 * Margem para o intervalo entre exportar o build e publicar o ZIP no MESMO
 * arranque do CI (poucos minutos). Só se considera "nova versão" se o ZIP for
 * mais recente do que o build por mais do que esta margem — evita que a própria
 * versão acabada de instalar se anuncie como desatualizada.
 */
const MARGEM_MS = 30 * 60 * 1000;

/** true se a app está a correr dentro do Electron (app desktop). */
function ehDesktop(): boolean {
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
}

/** Devolve true quando há uma versão desktop mais recente publicada. */
export function useAtualizacaoDesktop(): boolean {
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    if (!ehDesktop() || !BUILD_TIME) return;
    const buildMs = Date.parse(BUILD_TIME);
    if (Number.isNaN(buildMs)) return;

    let cancelado = false;
    (async () => {
      try {
        const resp = await fetch(API_RELEASE, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!resp.ok) return;
        const dados = (await resp.json()) as {
          published_at?: string;
          assets?: { name: string; updated_at: string }[];
        };
        const zip = dados.assets?.find((a) => /\.zip$/i.test(a.name));
        const quando = zip?.updated_at ?? dados.published_at;
        if (!quando) return;
        const releaseMs = Date.parse(quando);
        if (!Number.isNaN(releaseMs) && !cancelado && releaseMs - buildMs > MARGEM_MS) {
          setDisponivel(true);
        }
      } catch {
        /* offline ou API indisponível — não mostra nada */
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return disponivel;
}
