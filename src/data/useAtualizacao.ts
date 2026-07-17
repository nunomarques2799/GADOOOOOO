/**
 * Atualização da app desktop (Windows).
 * ------------------------------------------------------------------
 * O processo Electron procura versões novas no GitHub Release e descarrega-as
 * em fundo (ver desktop/main.js). Quando uma fica pronta, avisa por esta ponte
 * e a app mostra o banner: o utilizador clica em "Atualizar agora", a app
 * instala e reabre já na versão nova — sem descarregar nada à mão.
 *
 * A ponte só existe dentro do Electron (desktop/preload.js). No telemóvel e na
 * web fica tudo inerte, que é o que se quer: aí não há nada para atualizar.
 */

import { useCallback, useEffect, useState } from 'react';

/** API exposta pelo preload do Electron. */
type PonteAtualizacao = {
  estado: () => Promise<boolean>;
  instalar: () => Promise<boolean>;
  aoFicarPronta: (callback: () => void) => () => void;
};

function ponte(): PonteAtualizacao | undefined {
  return (globalThis as { gadoAtualizacao?: PonteAtualizacao }).gadoAtualizacao;
}

export type EstadoAtualizacao = {
  /** Há uma versão nova descarregada, à espera de instalar? */
  pronta: boolean;
  /** Instala e reinicia a app. */
  instalar: () => void;
};

export function useAtualizacaoDesktop(): EstadoAtualizacao {
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    const p = ponte();
    if (!p) return; // web/telemóvel — nada a fazer

    let cancelado = false;

    // Pode já ter sido descarregada antes deste ecrã abrir.
    void p.estado().then((ja) => {
      if (ja && !cancelado) setPronta(true);
    });

    // ...ou ficar pronta com a app aberta.
    const deixarDeOuvir = p.aoFicarPronta(() => {
      if (!cancelado) setPronta(true);
    });

    return () => {
      cancelado = true;
      deixarDeOuvir();
    };
  }, []);

  const instalar = useCallback(() => {
    void ponte()?.instalar();
  }, []);

  return { pronta, instalar };
}
