import { Linking, Platform, View } from 'react-native';

import { Button } from '@/components/ui';
import { spacing } from '@/theme';

/**
 * Botões "Como chegar" para uma localização (lat/lng). Abrem a app de mapas
 * escolhida — no telemóvel abre a app nativa; no desktop/web abre no browser.
 * Pensado para um veterinário ou trabalhador poder navegar até ao terreno.
 */
export function BotoesDirecoes({
  latitude,
  longitude,
  nome,
}: {
  latitude: number;
  longitude: number;
  nome?: string;
}) {
  const ll = `${latitude},${longitude}`;
  const rotulo = encodeURIComponent(nome ?? 'Terreno');

  const abrir = (url: string) => {
    Linking.openURL(url).catch(() => {
      /* sem app/handler disponível — falha silenciosa */
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Button
        label="Google Maps"
        icon="google-maps"
        variant="secondary"
        onPress={() => abrir(`https://www.google.com/maps/dir/?api=1&destination=${ll}`)}
      />
      <Button
        label="Waze"
        icon="navigation-variant"
        variant="secondary"
        onPress={() => abrir(`https://waze.com/ul?ll=${ll}&navigate=yes`)}
      />
      {Platform.OS === 'ios' ? (
        <Button
          label="Mapas (Apple)"
          icon="map-outline"
          variant="secondary"
          onPress={() => abrir(`https://maps.apple.com/?daddr=${ll}&q=${rotulo}`)}
        />
      ) : null}
    </View>
  );
}
