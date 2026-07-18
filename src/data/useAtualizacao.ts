/**
 * Atualizações da app — dois caminhos, um só banner.
 * ------------------------------------------------------------------
 * DESKTOP (Windows): o processo Electron procura versões novas no GitHub
 * Release e descarrega-as em fundo (ver desktop/main.js). Quando uma fica
 * pronta, avisa por esta ponte, o utilizador clica em "Atualizar agora" e a
 * app instala e reabre na versão nova.
 *
 * TELEMÓVEL (Android/iOS): EAS Update. Correções de JavaScript chegam sem
 * rebuild nem reinstalação do APK — o criador não tem de ir buscar um ficheiro
 * ao site outra vez. Só apanha alterações de JS: mexer em código nativo (um
 * plugin novo no app.json, uma permissão) continua a exigir build.
 *
 * A web não tem nada para atualizar (recarrega e já está), e ambos os
 * mecanismos ficam inertes aí. Quem consome isto é o `BannerAtualizacao`, que
 * não precisa de saber de onde veio a versão nova.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

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

/**
 * Espaço mínimo entre procuras no telemóvel. Sem isto, cada vez que a app
 * voltasse ao primeiro plano — o que num dia de trabalho são dezenas de vezes
 * — havia um pedido à rede. Meia hora chega de sobra para uma correção chegar
 * no mesmo dia, e poupa dados a quem anda no campo com rede fraca.
 */
const INTERVALO_PROCURA_MS = 30 * 60 * 1000;

/**
 * EAS Update no telemóvel. Procura no arranque e quando a app volta ao
 * primeiro plano; se houver versão nova, descarrega-a em silêncio e só então
 * levanta o banner — assim o botão "Atualizar agora" é instantâneo em vez de
 * deixar o criador à espera de um download.
 */
function useAtualizacaoOta(): EstadoAtualizacao {
  const [pronta, setPronta] = useState(false);
  const ultimaProcura = useRef(0);

  useEffect(() => {
    // Falso em Expo Go, no dev client e na web — não há updates para procurar.
    if (!Updates.isEnabled) return;

    let cancelado = false;

    const procurar = async () => {
      const agora = Date.now();
      if (agora - ultimaProcura.current < INTERVALO_PROCURA_MS) return;
      ultimaProcura.current = agora;
      try {
        const resultado = await Updates.checkForUpdateAsync();
        if (!resultado.isAvailable || cancelado) return;
        await Updates.fetchUpdateAsync();
        if (!cancelado) setPronta(true);
      } catch {
        // Sem rede, no monte. Não é erro nenhum que valha mostrar ao criador:
        // a app funciona à mesma e tenta outra vez quando houver sinal.
        ultimaProcura.current = 0;
      }
    };

    void procurar();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void procurar();
    });

    return () => {
      cancelado = true;
      sub.remove();
    };
  }, []);

  const instalar = useCallback(() => {
    void Updates.reloadAsync();
  }, []);

  return { pronta, instalar };
}

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

/**
 * O que o banner usa. Só um dos dois caminhos pode estar ativo de cada vez
 * (a ponte do Electron não existe no telemóvel, e o EAS Update não corre no
 * desktop), por isso basta devolver o que tiver versão pronta.
 */
export function useAtualizacao(): EstadoAtualizacao {
  const desktop = useAtualizacaoDesktop();
  const ota = useAtualizacaoOta();
  return desktop.pronta ? desktop : ota;
}
