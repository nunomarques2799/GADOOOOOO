import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors, radii } from '@/theme';

import { mapaHtml } from './mapaHtml';

export type MapaLocalizacaoProps = {
  latitude?: number;
  longitude?: number;
  /** Permite tocar no mapa para colocar/mover o pino. */
  selecionavel?: boolean;
  /** Chamado quando o utilizador escolhe/move o pino (só em modo selecionável). */
  onEscolher?: (latitude: number, longitude: number) => void;
  altura?: number;
};

/**
 * Mapa de satélite (Leaflet + Esri) num WebView. Versão nativa (iOS/Android).
 * A versão web (Electron/browser) está em MapaLocalizacao.web.tsx.
 */
export function MapaLocalizacao({
  latitude,
  longitude,
  selecionavel = false,
  onEscolher,
  altura = 220,
}: MapaLocalizacaoProps) {
  const webRef = useRef<WebView>(null);
  // O HTML só se reconstrói quando muda o centro inicial ou o modo — mover o
  // pino depois disso é tratado dentro do próprio mapa, sem recarregar.
  const html = useMemo(
    () => mapaHtml({ latitude, longitude, selecionavel }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selecionavel, latitude == null, longitude == null],
  );

  function aoReceber(e: WebViewMessageEvent) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'pin' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
        onEscolher?.(msg.lat, msg.lng);
      }
    } catch {
      // ignora mensagens que não sejam JSON válido
    }
  }

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
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={aoReceber}
        javaScriptEnabled
        domStorageEnabled
        // Deixa o mapa gerir o toque (arrastar/zoom) mesmo dentro de ScrollView.
        nestedScrollEnabled
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}
