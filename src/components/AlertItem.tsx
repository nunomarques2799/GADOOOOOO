import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon, type IconName, IconBadge, Text } from '@/components/ui';
import { podeDispensar } from '@/data/dispensados';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { useEstreito } from '@/hooks/useEstreito';
import { t } from '@/i18n';
import { colors, radii, spacing, type } from '@/theme';

/**
 * A cor de cada gravidade. FUNÇÃO e não tabela de módulo: as cores com
 * significado mudam de tom numa paleta escura, e uma tabela criada no import
 * ficava com as do creme (ver `fixasEscuras` em `theme/tokens.ts`).
 */
function gravidadeMeta(g: AlertaGravidade): { cor: string; tinte: string } {
  if (g === 'urgente') return { cor: colors.danger, tinte: colors.dangerTint };
  if (g === 'aviso') return { cor: colors.warning, tinte: colors.warningTint };
  return { cor: colors.info, tinte: colors.infoTint };
}

/** Ícones de traço, nunca cheios (guia de estilo). */
const categoriaIcone: Record<Alerta['categoria'], IconName> = {
  identificacao: 'tag-outline',
  snira: 'file-document-outline',
  parto: 'heart-outline',
  reproducao: 'heart-pulse',
  medicamento: 'pill',
  vacinacao: 'needle',
  existencias: 'package-variant',
};

function prazoLabel(dias?: number): string {
  if (dias === undefined) return '';
  if (dias < 0) return t('alerta.emAtraso');
  if (dias === 0) return t('alerta.hoje');
  return t('alerta.dias', { n: dias });
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
  const estreito = useEstreito();
  const g = gravidadeMeta(alerta.gravidade);
  // Estes alertas não têm contagem decrescente, por isso a coluna da direita
  // está vazia — o botão de calar ocupa o lugar do prazo em vez de disputar
  // largura com ele (que parte em duas linhas com a letra do sistema grande).
  const podeCalar = !!onDispensar && podeDispensar(alerta);
  const prazo = podeCalar ? null : (
    <Text
      style={[type.mono, { color: g.cor, flexShrink: 0 }]}
      numberOfLines={1}
      maxFontSizeMultiplier={1.3}>
      {prazoLabel(alerta.diasRestantes)}
    </Text>
  );

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
        {/* O ícone num círculo da cor clara do significado (guia de estilo). */}
        <IconBadge
          name={categoriaIcone[alerta.categoria]}
          color={g.cor}
          background={g.tinte}
          size={estreito ? 40 : 48}
          iconSize={estreito ? 20 : 24}
          rounded
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={estreito ? 3 : 2}>
            {alerta.titulo}
          </Text>
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={2}>
            {alerta.descricao}
          </Text>
          {/* Num ecrã estreito o prazo desce para debaixo do texto: na coluna
              da direita roubava-lhe tanta largura que o título saía "Me di…". */}
          {estreito ? prazo : null}
        </View>
        {/* O prazo é curto e tem de se ler de uma vez — não encolhe nem parte
            ("5 dias" saía em duas linhas quando a letra do sistema era grande).
            Em letra mono, como os brincos: os algarismos alinham-se de aviso
            para aviso. */}
        {estreito ? null : prazo}
      </Pressable>

      {podeCalar ? (
        <Pressable
          onPress={() => onDispensar?.(alerta)}
          accessibilityRole="button"
          accessibilityLabel={`Dispensar aviso: ${alerta.titulo}`}
          accessibilityHint={t('alertas.dispensarAjuda')}
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
