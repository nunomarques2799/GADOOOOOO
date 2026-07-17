import type { ReactNode } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, radii, sizes, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Etiqueta + wrapper de campo de formulário — o mesmo desenho dos ecrãs de
 * nova exploração/animal, extraído para os novos ecrãs (Editar dados,
 * Notificações, Ajuda) não terem de o reinventar cada um à sua maneira.
 */
export function Field({
  label,
  obrigatorio,
  opcional,
  ajuda,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  opcional?: boolean;
  /** Nota curta por baixo do campo (ex: "usado só para avisos"). */
  ajuda?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: spacing.xs,
        }}>
        <Text variant="label">{label}</Text>
        {obrigatorio ? (
          <Text variant="label" color={colors.danger}>
            *
          </Text>
        ) : null}
        {opcional ? (
          <Text variant="caption" color={colors.textMuted}>
            opcional
          </Text>
        ) : null}
      </View>
      {children}
      {ajuda ? (
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
          {ajuda}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  icon,
  autoCapitalize = 'sentences',
  keyboardType,
  autoComplete,
  editable = true,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: IconName;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: 'email' | 'name' | 'off';
  /** Campos só de leitura ficam esbatidos e ignoram o teclado. */
  editable?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        height: sizes.input,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: editable ? colors.surface : colors.surfaceAlt,
        paddingHorizontal: spacing.md,
      }}>
      {icon ? <Icon name={icon} size="md" color={colors.textMuted} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        editable={editable}
        style={{
          flex: 1,
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 17,
          color: editable ? colors.text : colors.textSecondary,
        }}
      />
    </View>
  );
}
