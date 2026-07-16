import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { AnimalRow } from '@/components/AnimalRow';
import { BotoesDirecoes } from '@/components/mapa/BotoesDirecoes';
import { MapaLocalizacao } from '@/components/mapa/MapaLocalizacao';
import {
  Button,
  Card,
  EmptyState,
  Header,
  Icon,
  Screen,
  Text,
} from '@/components/ui';
import { tipoTerrenoMeta } from '@/data/constants';
import { useGado } from '@/data/store';
import { colors, radii, shadow, spacing } from '@/theme';

export default function TerrenoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { terrenoById, exploracaoById, animais } = useGado();

  const terreno = id ? terrenoById(id) : undefined;

  if (!terreno) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Terreno" />
        <EmptyState icon="map-marker" title="Terreno não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  const meta = tipoTerrenoMeta[terreno.tipo ?? 'Outro'];
  const exploracao = exploracaoById(terreno.exploracaoId);
  const animaisNoTerreno = animais.filter((a) => a.terrenoId === terreno.id);
  const temCoords = terreno.latitude != null && terreno.longitude != null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={terreno.nome}
        actionIcon="pencil-outline"
        onAction={() => router.push(`/terreno/editar/${terreno.id}`)}
      />
      <Screen>
        {/* Hero */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ borderRadius: radii.xl, padding: spacing.lg }, shadow.md]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.lg,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name={meta.icon} size={38} color={colors.textOnDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h1" color={colors.textOnDark} numberOfLines={1}>
                {terreno.nome}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="barn" size={14} color={colors.textOnDarkMuted} />
                <Text variant="secondary" color={colors.textOnDarkMuted} numberOfLines={1}>
                  {exploracao?.nome ?? '—'}
                </Text>
              </View>
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
            <HeroStat value={terreno.tipo ?? 'Outro'} label="Tipo" />
            <HeroStat value={terreno.area != null ? `${terreno.area} ha` : '—'} label="Área" />
            <HeroStat value={animaisNoTerreno.length} label="Animais" />
          </View>
        </LinearGradient>

        {/* Mapa + direções */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Localização
        </Text>
        {temCoords ? (
          <>
            <MapaLocalizacao latitude={terreno.latitude} longitude={terreno.longitude} altura={200} />
            <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
              Como chegar ao terreno:
            </Text>
            <BotoesDirecoes latitude={terreno.latitude!} longitude={terreno.longitude!} nome={terreno.nome} />
          </>
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="map-marker-off" size="lg" color={colors.textMuted} />
              <Text variant="body" style={{ flex: 1 }}>
                Sem localização no mapa. Edite o terreno para marcar onde fica.
              </Text>
            </View>
          </Card>
        )}

        {/* Características */}
        {terreno.descricao ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
              Descrição
            </Text>
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                {terreno.descricao}
              </Text>
            </Card>
          </>
        ) : null}

        {/* Animais no terreno */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.xl,
            marginBottom: spacing.xs,
          }}>
          <Text variant="h3">Animais ({animaisNoTerreno.length})</Text>
        </View>

        {animaisNoTerreno.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Ainda não há animais neste terreno. Associe os que estão aqui.
            </Text>
          </Card>
        ) : (
          animaisNoTerreno.map((a) => <AnimalRow key={a.id} animal={a} />)
        )}

        <Button
          label="Associar animais"
          icon="cow"
          variant="secondary"
          onPress={() => router.push(`/terreno/animais/${terreno.id}`)}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h2" color={colors.textOnDark} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textOnDarkMuted}>
        {label}
      </Text>
    </View>
  );
}
