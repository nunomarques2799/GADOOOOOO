/**
 * Aviso de nova versão da app desktop (Windows).
 * ------------------------------------------------------------------
 * Só corre dentro do Electron (app desktop). No telemóvel/web fica inerte.
 *
 * Compara o COMMIT deste build (EXPO_PUBLIC_BUILD_SHA, injetado no CI) com o
 * commit anunciado no corpo do GitHub Release. Commits diferentes = há versão
 * nova. É exato: não depende de relógios nem de janelas de tolerância.
 *
 * Builds antigos (anteriores a esta mudança) não têm commit gravado; para esses
 * mantém-se a comparação por datas, que exige que o ZIP seja mais recente do que
 * o build por uma margem — ver MARGEM_MS.
 *
 * Não instala nada — apenas avisa. A distribuição continua a ser o mesmo ZIP.
 */

import { useEffect, useState } from 'react';

const REPO = 'nunomarques2799/GADOOOOOO';
const API_RELEASE = `https://api.github.com/repos/${REPO}/releases/tags/windows`;

/** Página do site com o botão de descarregar e as instruções. */
export const URL_DESCARREGAR = 'https://gestaogado.netlify.app/#descarregar';

/** Commit em que este build foi gerado. Injetado pelo CI no export. */
const BUILD_SHA = process.env.EXPO_PUBLIC_BUILD_SHA;

/** Data em que este build foi gerado (ISO). Injetada pelo CI no export. */
const BUILD_TIME = process.env.EXPO_PUBLIC_BUILD_TIME;

/**
 * Só usada no recurso por datas (builds sem commit gravado): margem para o
 * intervalo entre exportar o build e publicar o ZIP no MESMO arranque do CI.
 * Evita que a versão acabada de instalar se anuncie como desatualizada — mas
 * também cega o aviso quando duas publicações ficam a menos de meia hora uma da
 * outra, que é a razão de o commit ser agora o critério principal.
 */
const MARGEM_MS = 30 * 60 * 1000;

/** true se a app está a correr dentro do Electron (app desktop). */
function ehDesktop(): boolean {
  return typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent);
}

/** Lê o commit anunciado no corpo do Release (linha "commit: <sha>"). */
function shaDoCorpo(corpo?: string): string | undefined {
  return corpo?.match(/commit:\s*([0-9a-f]{7,40})/i)?.[1];
}

/** Devolve true quando há uma versão desktop mais recente publicada. */
export function useAtualizacaoDesktop(): boolean {
  const [disponivel, setDisponivel] = useState(false);

  useEffect(() => {
    if (!ehDesktop()) return;
    if (!BUILD_SHA && !BUILD_TIME) return;

    let cancelado = false;
    (async () => {
      try {
        const resp = await fetch(API_RELEASE, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!resp.ok) return;
        const dados = (await resp.json()) as {
          body?: string;
          published_at?: string;
          assets?: { name: string; updated_at: string }[];
        };

        // Critério principal: o commit publicado difere do que está instalado.
        const shaPublicado = shaDoCorpo(dados.body);
        if (BUILD_SHA && shaPublicado) {
          if (!cancelado && shaPublicado !== BUILD_SHA) setDisponivel(true);
          return;
        }

        // Recurso para builds sem commit gravado: comparação por datas.
        if (!BUILD_TIME) return;
        const buildMs = Date.parse(BUILD_TIME);
        if (Number.isNaN(buildMs)) return;
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
