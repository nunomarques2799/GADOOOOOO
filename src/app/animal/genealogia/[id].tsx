import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, EmptyState, Header, Icon, IconBadge, Screen, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { ascendentesDe, descendentesDe, rotuloAnimal, type NoGenealogico } from '@/data/genealogia';
import { formatDataPt, idadeExtenso } from '@/data/helpers';
import { useGado } from '@/data/store';
import { colors, radii, shadow, spacing } from '@/theme';

/** Gerações mostradas para cada lado (pais/avós/bisavós e crias/netos/bisnetos). */
const GERACOES = 3;

export default function GenealogiaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { animais, animalById } = useGado();

  const animal = id ? animalById(id) : undefined;

  const ascendentes = useMemo(
    () => (animal ? ascendentesDe(animais, animal, GERACOES) : []),
    [animais, animal],
  );
  const descendentes = useMemo(
    () => (animal ? descendentesDe(animais, animal, GERACOES) : []),
    [animais, animal],
  );

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Árvore genealógica" />
        <EmptyState icon="cow-off" title="Animal não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  const meta = especieMeta[animal.especie];
  const totalCrias = descendentes.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Árvore genealógica" />
      <Screen>
        {/* Ascendentes — dos mais recentes (pais) para os mais antigos */}
        <Text variant="h3" style={{ marginBottom: spacing.xs }}>
          Ascendentes
        </Text>
        {ascendentes.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Ainda não há mãe nem pai registados para este animal.
            </Text>
            <Button
              label="Indicar mãe e pai"
              icon="pencil"
              variant="secondary"
              onPress={() => router.push(`/animal/editar/${animal.id}`)}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {ascendentes.map((no) => (
              <Ramo key={no.animal.id} no={no} />
            ))}
          </View>
        )}

        {/* O próprio animal, entre as duas metades da árvore */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            {
              borderRadius: radii.xl,
              padding: spacing.md,
              marginTop: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            },
            shadow.md,
          ]}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.pill,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={meta.icon} size={28} color={colors.textOnDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h3" color={colors.textOnDark}>
              {rotuloAnimal(animal)}
            </Text>
            <Text variant="secondary" color={colors.textOnDarkMuted}>
              {animal.especie} · {idadeExtenso(animal.dataNascimento)}
            </Text>
          </View>
        </LinearGradient>

        {/* Descendentes */}
        <Text variant="h3" style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
          Descendentes ({totalCrias})
        </Text>
        {totalCrias === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Este animal ainda não tem crias registadas. Ao registar uma cria, indique-o como mãe ou pai para
              aparecer aqui.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {descendentes.map((no) => (
              <Ramo key={no.animal.id} no={no} />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

/** Um animal da árvore e, indentados por baixo, os seus próprios ramos. */
function Ramo({ no }: { no: NoGenealogico }) {
  const router = useRouter();
  const meta = especieMeta[no.animal.especie];

  return (
    <View>
      <Card
        padded={false}
        onPress={() => router.push(`/animal/${no.animal.id}`)}
        accessibilityLabel={`${no.parentesco}: ${rotuloAnimal(no.animal)}`}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }}>
          <IconBadge name={meta.icon} color={meta.cor} background={colors.surfaceSunken} size={44} iconSize={24} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {rotuloAnimal(no.animal)}
            </Text>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {formatDataPt(no.animal.dataNascimento)} · {idadeExtenso(no.animal.dataNascimento)}
            </Text>
          </View>
          <Badge label={no.parentesco} tone="brand" />
          <Icon name="chevron-right" size="md" color={colors.textMuted} />
        </View>
      </Card>

      {no.ramos.length > 0 ? (
        <View
          style={{
            marginLeft: spacing.lg,
            marginTop: spacing.sm,
            paddingLeft: spacing.md,
            borderLeftWidth: 2,
            borderLeftColor: colors.border,
            gap: spacing.sm,
          }}>
          {no.ramos.map((filho) => (
            <Ramo key={filho.animal.id} no={filho} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
