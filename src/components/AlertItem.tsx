import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon, type IconName, IconBadge, Text } from '@/components/ui';
import { podeDispensar } from '@/data/dispensados';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

const gravidadeMeta: Record<AlertaGravidade, { cor: string; tinte: string }> = {
  urgente: { cor: colors.danger, tinte: colors.dangerTint },
  aviso: { cor: colors.warning, tinte: colors.warningTint },
  info: { cor: colors.info, tinte: colors.infoTint },
};

const categoriaIcone: Record<Alerta['categoria'], IconName> = {
  identificacao: 'tag-outline',
  snira: 'cloud-upload-outline',
  parto: 'baby-bottle-outline',
  medicamento: 'medical-bag',
  vacinacao: 'needle',
};

function prazoLabel(dias?: number): string {
  if (dias === undefined) return '';
  if (dias < 0) return 'Em atraso';
  if (dias === 0) return 'Hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}

export function AlertItem({
  alerta,
  divider,
  onDispensar,
}: {
  alerta: Alerta;
  divider?: boolean;
  /** Se vier, mostra o botão de calar (só para alertas sem prazo a correr). */
  onDispensar?: (a: Alerta) => void;
}) {
  const router = useRouter();
  const g = gravidadeMeta[alerta.gravidade];
  // Estes alertas não têm contagem decrescente, por isso a coluna da direita
  // está vazia — o botão de calar ocupa o lugar do prazo em vez de disputar
  // largura com ele (que parte em duas linhas com a letra do sistema grande).
  const podeCalar = !!onDispensar && podeDispensar(alerta);

  return (
    // A linha é uma View e não um Pressable: o botão de calar tem de ser IRMÃO
    // do de abrir o animal, não filho. Aninhados, a web gerava um <button>
    // dentro de outro <button> (HTML inválido, erro de hidratação) e os
    // leitores de ecrã anunciavam um só controlo com duas ações.
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      }}>
      <Pressable
        onPress={() => alerta.animalId && router.push(`/animal/${alerta.animalId}`)}
        accessibilityRole="button"
        accessibilityLabel={`${alerta.titulo}. ${alerta.descricao}`}
        style={({ pressed }) => [
          {
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
          },
          pressed && { opacity: 0.6 },
        ]}>
        <IconBadge
          name={categoriaIcone[alerta.categoria]}
          color={g.cor}
          background={g.tinte}
          size={44}
          iconSize={22}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {alerta.titulo}
          </Text>
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={2}>
            {alerta.descricao}
          </Text>
        </View>
        {/* O prazo é curto e tem de se ler de uma vez — não encolhe nem parte
            ("5 dias" saía em duas linhas quando a letra do sistema era grande). */}
        {podeCalar ? null : (
          <View style={{ alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
            <Text variant="caption" color={g.cor} numberOfLines={1}>
              {prazoLabel(alerta.diasRestantes)}
            </Text>
            <Icon name="chevron-right" size="sm" color={colors.textMuted} />
          </View>
        )}
      </Pressable>

      {podeCalar ? (
        <Pressable
          onPress={() => onDispensar?.(alerta)}
          accessibilityRole="button"
          accessibilityLabel={`Dispensar aviso: ${alerta.titulo}`}
          accessibilityHint="Deixa de mostrar este aviso. Volta se a situação se agravar."
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
              flexShrink: 0,
            },
            pressed && { opacity: 0.6 },
          ]}>
          <Icon name="bell-off-outline" size="md" color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}
