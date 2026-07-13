import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import type { MeteoEstado } from '@/data/store';
import type { Meteorologia } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

/** Cartão de meteorologia — bloco verde como na inspiração. */
export function WeatherCard({
  meteo,
  estado = 'atual',
  onRecarregar,
}: {
  meteo: Meteorologia;
  estado?: MeteoEstado;
  onRecarregar?: () => void;
}) {
  return (
    <LinearGradient
      colors={[colors.headerTo, colors.headerFrom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radii.xl, padding: spacing.lg }, shadow.md]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs }}>
            <Icon name="map-marker" size="sm" color={colors.textOnDarkMuted} />
            <Text variant="label" color={colors.textOnDarkMuted}>
              {meteo.local}
            </Text>
            <EstadoMeteo estado={estado} onRecarregar={onRecarregar} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 52, lineHeight: 58, color: colors.textOnDark }}>
              {meteo.temperatura}
            </Text>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 24, color: colors.textOnDark, marginTop: 6 }}>
              °C
            </Text>
          </View>
          <Text variant="bodyStrong" color={colors.textOnDark}>
            {meteo.condicao}
          </Text>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meteo.icone as IconName} size={72} color={colors.textOnDark} />
          <Text variant="caption" color={colors.textOnDarkMuted}>
            {meteo.maxima}° / {meteo.minima}°
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.18)',
        }}>
        <Metric icon="water-percent" label="Humidade" value={`${meteo.humidade}%`} />
        <Metric icon="weather-windy" label="Vento" value={`${meteo.vento} km/h`} />
        <Metric icon="weather-pouring" label="Precip." value={`${meteo.precipitacao} mm`} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.md,
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: radii.md,
          padding: spacing.sm,
        }}>
        <Icon name="information" size="sm" color={colors.textOnDark} />
        <Text variant="secondary" color={colors.textOnDark} style={{ flex: 1 }}>
          {meteo.conselho}
        </Text>
      </View>
    </LinearGradient>
  );
}

/** Indicador de estado da meteorologia junto ao local (a carregar / offline / atualizar). */
function EstadoMeteo({
  estado,
  onRecarregar,
}: {
  estado: MeteoEstado;
  onRecarregar?: () => void;
}) {
  if (estado === 'a-carregar') {
    return <ActivityIndicator size="small" color={colors.textOnDarkMuted} style={{ marginLeft: 2 }} />;
  }

  const offline = estado === 'offline';
  const conteudo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={offline ? 'cloud-off-outline' : 'refresh'} size={14} color={colors.textOnDarkMuted} />
      {offline ? (
        <Text variant="caption" color={colors.textOnDarkMuted}>
          Sem ligação
        </Text>
      ) : null}
    </View>
  );

  if (!onRecarregar) return offline ? conteudo : null;
  return (
    <Pressable
      onPress={onRecarregar}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Atualizar meteorologia"
      style={({ pressed }) => [{ marginLeft: 2 }, pressed && { opacity: 0.6 }]}>
      {conteudo}
    </Pressable>
  );
}

function Metric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Icon name={icon} size="sm" color={colors.textOnDarkMuted} />
      <Text variant="bodyStrong" color={colors.textOnDark}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textOnDarkMuted}>
        {label}
      </Text>
    </View>
  );
}
