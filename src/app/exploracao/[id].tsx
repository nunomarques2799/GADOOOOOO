import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { AnimalRow } from '@/components/AnimalRow';
import {
  Button,
  Card,
  EmptyState,
  Header,
  Icon,
  type IconName,
  IconBadge,
  Screen,
  Text,
} from '@/components/ui';
import { tipoTerrenoMeta } from '@/data/constants';
import { useGado } from '@/data/store';
import { colors, radii, shadow, spacing } from '@/theme';

export default function ExploracaoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { exploracaoById, terrenosByExploracao, animaisByExploracao } = useGado();

  const exploracao = exploracaoById(id);

  if (!exploracao) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Exploração" />
        <EmptyState icon="barn" title="Exploração não encontrada" message="Este registo já não existe." />
      </View>
    );
  }

  const terrenos = terrenosByExploracao(exploracao.id);
  const animais = animaisByExploracao(exploracao.id);
  const areaTotal = terrenos.reduce((s, t) => s + (t.area ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={exploracao.nome} actionIcon="pencil-outline" onAction={() => {}} />
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
              <Icon name="barn" size={38} color={colors.textOnDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h1" color={colors.textOnDark} numberOfLines={1}>
                {exploracao.nome}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="map-marker" size={14} color={colors.textOnDarkMuted} />
                <Text variant="secondary" color={colors.textOnDarkMuted} numberOfLines={1}>
                  {exploracao.localizacao ?? 'Sem localização'}
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
            <HeroStat value={animais.length} label="Animais" />
            <HeroStat value={terrenos.length} label="Terrenos" />
            <HeroStat value={`${areaTotal.toFixed(1)} ha`} label="Área total" />
          </View>
        </LinearGradient>

        {/* Dados oficiais */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Dados da exploração
        </Text>
        <Card>
          <InfoField icon="barcode" label="Marca de exploração" value={exploracao.marcaExploracao} />
          <InfoField icon="card-account-details-outline" label="NIF do detentor" value={exploracao.nifDetentor} last />
        </Card>

        {/* Mapa (placeholder — Fase 1: flutter_map/Google Maps com polígonos) */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Mapa dos terrenos
        </Text>
        <Card padded={false}>
          <View
            style={{
              height: 150,
              borderRadius: radii.xl,
              backgroundColor: colors.surfaceSunken,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
            }}>
            <Icon name="map-outline" size={40} color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              Mapa com limites dos terrenos
            </Text>
          </View>
        </Card>

        {/* Terrenos */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Terrenos ({terrenos.length})
        </Text>
        {terrenos.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Ainda não há terrenos nesta exploração.
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {terrenos.map((t, i) => {
                const meta = tipoTerrenoMeta[t.tipo ?? 'Outro'];
                return (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      borderBottomWidth: i < terrenos.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}>
                    <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={44} iconSize={22} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{t.nome}</Text>
                      <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                        {t.tipo ?? 'Outro'}
                        {t.area ? ` · ${t.area} ha` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Animais */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Animais ({animais.length})
        </Text>
        {animais.slice(0, 4).map((a) => (
          <AnimalRow key={a.id} animal={a} />
        ))}
        {animais.length > 4 ? (
          <Button
            label={`Ver todos os ${animais.length} animais`}
            variant="secondary"
            icon="cow"
            onPress={() => router.push('/animais')}
            style={{ marginTop: spacing.xs }}
          />
        ) : null}
      </Screen>
    </View>
  );
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h2" color={colors.textOnDark}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textOnDarkMuted}>
        {label}
      </Text>
    </View>
  );
}

function InfoField({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}
