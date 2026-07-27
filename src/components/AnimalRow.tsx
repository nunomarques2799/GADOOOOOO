import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { View } from 'react-native';

import { Badge, Card, Icon, IconBadge, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { idadeExtenso } from '@/data/helpers';
import type { Animal } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

/**
 * Uma linha da lista de animais.
 *
 * `nomeTerreno` vem já resolvido de fora, e não de um `useGado()` aqui dentro:
 * numa lista de trezentos animais eram trezentas subscrições ao store, e cada
 * sincronização remexia a lista toda (ver `animais.tsx`, onde o nome se resolve
 * uma vez só). O `memo` fecha o ciclo — sem novas props, a linha não volta a
 * desenhar-se quando é outra que muda.
 */
export const AnimalRow = memo(function AnimalRow({
  animal,
  nomeTerreno,
}: {
  animal: Animal;
  nomeTerreno?: string;
}) {
  const router = useRouter();
  const meta = especieMeta[animal.especie];
  const semBrinco = animal.especie === 'Bovino' && !animal.numeroIdentificacao;
  const saiu = animal.estado === 'falecido' || animal.estado === 'vendido';

  const femea = animal.sexo === 'Fêmea';
  const sexoCor = femea ? colors.femea : colors.macho;
  const sexoIcon = femea ? 'gender-female' : 'gender-male';

  return (
    <Card
      onPress={() => router.push(`/animal/${animal.id}`)}
      accessibilityLabel={`${animal.nome ?? 'Animal'}, ${animal.especie}, ${idadeExtenso(animal.dataNascimento)}`}
      style={{ marginBottom: spacing.sm, opacity: saiu ? 0.7 : 1 }}
      padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }}>
        <View>
          {/* Com foto, é o rosto do animal que aparece — é o que se reconhece
              de relance, ainda antes do nome. Sem foto, o fundo dá o sexo e o
              ícone dá a espécie pela forma (vaca, ovelha, cavalo). O anel na cor
              do sexo mantém-se nos dois casos, para não se perder essa leitura. */}
          {animal.fotografia ? (
            <Image
              source={{ uri: animal.fotografia }}
              style={{
                width: 52,
                height: 52,
                borderRadius: radii.pill,
                borderWidth: 2,
                borderColor: sexoCor,
                backgroundColor: femea ? colors.femeaTint : colors.machoTint,
              }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <IconBadge
              name={meta.icon}
              color={sexoCor}
              background={femea ? colors.femeaTint : colors.machoTint}
              size={52}
              iconSize={30}
            />
          )}
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
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {animal.raca ?? animal.especie} · {idadeExtenso(animal.dataNascimento)}
            </Text>
            {nomeTerreno ? (
              <>
                <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textMuted }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 }}>
                  <Icon name="map-marker" size={12} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {nomeTerreno}
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
});
