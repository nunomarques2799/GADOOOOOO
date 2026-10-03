import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesktop } from '@/hooks/useDesktop';
import { t, type ChaveTexto } from '@/i18n';
import { colors, layout, radii, spacing } from '@/theme';

import { useDentroDePainel } from './EcraComTeclado';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * A palavra das ações que no telemóvel são só um ícone. No computador a ação
 * leva sempre a palavra; guarda-se a CHAVE e não o texto, para a língua ser a
 * de agora e não a do arranque (ver o AGENTS.md).
 */
const ROTULO_DO_ICONE: Partial<Record<IconName, ChaveTexto>> = {
  refresh: 'equipa.atualizar',
  'pencil-outline': 'comum.editar',
  'information-outline': 'chat.info',
};

function rotuloDoIcone(icone: IconName): string {
  const chave = ROTULO_DO_ICONE[icone];
  return chave ? t(chave) : t('comum.acao');
}

type Props = {
  title: string;
  /** Ícone da ação à direita (opcional). */
  actionIcon?: IconName;
  onAction?: () => void;
  /**
   * Com rótulo, a ação deixa de ser um círculo só com o ícone e passa a uma
   * pastilha com ícone e palavra ("✎ Editar"), como na ficha do guia. Um lápis
   * sozinho num círculo é um enigma para quem não usa telemóveis há anos.
   */
  actionLabel?: string;
  /** Cor de fundo — por omissão transparente sobre o fundo do ecrã. */
  background?: string;
};

/**
 * Cabeçalho de ecrã de detalhe/formulário: botão de voltar circular,
 * título centrado e ação opcional. Respeita a safe-area superior.
 */
export function Header({ title, actionIcon, onAction, actionLabel, background = 'transparent' }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const noPainel = useDentroDePainel();
  const acao =
    actionIcon && onAction ? (
      actionLabel || desktop ? (
        // No computador a ação leva sempre a palavra: há espaço, e um lápis
        // sozinho num círculo é um enigma para quem não usa computadores.
        <Pastilha icon={actionIcon} label={actionLabel ?? rotuloDoIcone(actionIcon)} onPress={onAction} />
      ) : (
        <CircleButton icon={actionIcon} onPress={onAction} label={t('comum.acao')} />
      )
    ) : null;

  /*
   * No computador o cabeçalho é o de uma PÁGINA, não o de um telemóvel.
   * ------------------------------------------------------------------
   * Um círculo com uma seta ao canto e um título pequeno ao centro é o desenho
   * de uma pilha de ecrãs no telemóvel. Num monitor, com a barra lateral à vista,
   * isso lia-se como uma app de telemóvel esticada. Aqui o voltar diz "Voltar"
   * por extenso, o título vai em Fraunces grande e à esquerda (como os títulos
   * dos separadores) e tudo alinha com a coluna do conteúdo que vem por baixo.
   */
  if (desktop) {
    return (
      <View style={{ backgroundColor: background, paddingHorizontal: noPainel ? spacing.lg : spacing.xxl }}>
        <View
          style={{
            width: '100%',
            maxWidth: layout.conteudoDesktop,
            alignSelf: 'center',
            paddingTop: spacing.xl,
            paddingBottom: title ? spacing.md : spacing.xs,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('comum.voltar')}
              hitSlop={6}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 2,
                  height: 40,
                  paddingLeft: spacing.xs,
                  paddingRight: spacing.md,
                  marginLeft: -spacing.xs,
                  borderRadius: radii.pill,
                  backgroundColor: hovered ? colors.surfaceSunken : 'transparent',
                },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon name="chevron-left" size="md" color={colors.textSecondary} />
              <Text variant="label" color={colors.textSecondary}>
                {t('comum.voltar')}
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {acao}
          </View>
          {title ? (
            <Text variant="h1" numberOfLines={2} style={{ marginTop: spacing.xs }}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.xs,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.xs,
        backgroundColor: background,
      }}>
      <CircleButton icon="chevron-left" onPress={() => router.back()} label={t('comum.voltar')} />
      <Text variant="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      {/* Do mesmo tamanho dos dois lados quando não há rótulo, para o título
          ficar mesmo ao centro. */}
      {acao ?? <View style={{ width: 46 }} />}
    </View>
  );
}

function CircleButton({
  icon,
  onPress,
  label,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: 46,
          height: 46,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="md" color={colors.text} />
    </Pressable>
  );
}

function Pastilha({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        {
          height: 46,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: spacing.md,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="sm" color={colors.text} />
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
