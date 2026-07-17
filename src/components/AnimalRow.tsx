import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Badge, Card, Icon, IconBadge, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { idadeExtenso } from '@/data/helpers';
import { useGado } from '@/data/store';
import type { Animal } from '@/data/types';
import { colors, spacing } from '@/theme';

export function AnimalRow({ animal }: { animal: Animal }) {
  const router = useRouter();
  const { terrenoById } = useGado();
  const meta = especieMeta[animal.especie];
  const terreno = animal.terrenoId ? terrenoById(animal.terrenoId) : undefined;
  const semBrinco = animal.especie === 'Bovino' && !animal.numeroIdentificacao;
  const saiu = animal.estado === 'falecido' || animal.estado === 'vendido';

  const sexoCor = animal.sexo === 'Fêmea' ? '#C2568A' : '#3B7BC4';
  const sexoIcon = animal.sexo === 'Fêmea' ? 'gender-female' : 'gender-male';

  return (
    <Card
      onPress={() => router.push(`/animal/${animal.id}`)}
      accessibilityLabel={`${animal.nome ?? 'Animal'}, ${animal.especie}, ${idadeExtenso(animal.dataNascimento)}`}
      style={{ marginBottom: spacing.sm, opacity: saiu ? 0.7 : 1 }}
      padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }}>
        <View>
          <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={52} iconSize={30} />
          {semBrinco ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: colors.danger,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            />
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {animal.nome ?? 'Sem nome'}
            </Text>
            <Icon name={sexoIcon} size={16} color={sexoCor} />
            {animal.estado === 'falecido' ? (
              <Badge tone="neutral" icon="grave-stone" label="Falecido" />
            ) : null}
            {animal.estado === 'vendido' ? (
              <Badge tone="info" icon="cash" label="Vendido" />
            ) : null}
          </View>
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
            {animal.numeroIdentificacao ?? 'Sem brinco'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text variant="caption" color={colors.textMuted}>
              {animal.raca ?? animal.especie} · {idadeExtenso(animal.dataNascimento)}
            </Text>
            {terreno ? (
              <>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textMuted }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Icon name="map-marker" size={12} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {terreno.nome}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <Icon name="chevron-right" size="md" color={colors.textMuted} />
      </View>
    </Card>
  );
}
