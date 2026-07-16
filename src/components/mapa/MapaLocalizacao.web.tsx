import { createElement, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { colors, radii } from '@/theme';

import { mapaHtml } from './mapaHtml';
import type { MapaLocalizacaoProps } from './MapaLocalizacao';

/**
 * Versão web (Electron/browser) do mapa de satélite. Na web, react-native-web
 * renderiza sobre react-dom, por isso usamos um <iframe> real (createElement)
 * e ouvimos as mensagens que o Leaflet envia via window.postMessage.
 */
export function MapaLocalizacao({
  latitude,
  longitude,
  selecionavel = false,
  onEscolher,
  altura = 220,
}: MapaLocalizacaoProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const onEscolherRef = useRef(onEscolher);
  onEscolherRef.current = onEscolher;

  const html = useMemo(
    () => mapaHtml({ latitude, longitude, selecionavel }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecionavel, latitude == null, longitude == null],
  );

  useEffect(() => {
    function aoReceber(e: MessageEvent) {
      // Só aceita mensagens vindas do nosso próprio iframe.
      if (frameRef.current && e.source !== frameRef.current.contentWindow) return;
      try {
        const msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (msg?.type === 'pin' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
          onEscolherRef.current?.(msg.lat, msg.lng);
        }
      } catch {
        // ignora
      }
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, []);

  const iframe = createElement('iframe', {
    ref: frameRef,
    srcDoc: html,
    style: {
      width: '100%',
      height: '100%',
      border: '0',
      display: 'block',
    },
    // Sandbox permissivo o suficiente para scripts e rede (tiles).
    sandbox: 'allow-scripts allow-same-origin',
    title: 'Mapa do terreno',
  });

  return (
    <View
      style={{
        height: altura,
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceSunken,
      }}>
      {iframe}
    </View>
  );
}
