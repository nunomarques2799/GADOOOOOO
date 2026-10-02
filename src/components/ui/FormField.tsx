import { useState, type ReactNode } from 'react';
import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, fontFamily, radii, sizes, spacing } from '@/theme';

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
  multiline = false,
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
  /**
   * Cresce com o texto, para notas e observações. O `height` fixo passa a
   * `minHeight` e o ícone sobe para o topo — alinhado ao meio de um campo de
   * quatro linhas ficava a flutuar a meio do parágrafo.
   */
  multiline?: boolean;
}) {
  // O campo onde se está a escrever leva a linha da cor da marca, como no guia:
  // num formulário comprido, é o que diz onde vai cair a próxima letra.
  const [focado, setFocado] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: spacing.xs,
        ...(multiline ? { minHeight: sizes.input } : { height: sizes.input }),
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: focado ? colors.primary : colors.border,
        backgroundColor: editable ? colors.surface : colors.surfaceAlt,
        paddingHorizontal: spacing.md,
        paddingVertical: multiline ? spacing.sm : 0,
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
        multiline={multiline}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        textAlignVertical={multiline ? 'top' : undefined}
        style={{
          flex: 1,
          fontFamily: fontFamily.medium,
          fontSize: 17,
          color: editable ? colors.text : colors.textSecondary,
          paddingTop: multiline ? 2 : 0,
          minHeight: multiline ? 48 : undefined,
        }}
      />
    </View>
  );
}
