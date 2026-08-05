import { useRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { mascaraHora, minutosDaHora } from '@/data/acessoTemporario';
import { colors, radii, sizes, spacing } from '@/theme';

import { estiloBotaoCalendario } from './campoDataEstilo';
import type { CampoHoraProps } from './CampoHora';
import { Icon } from './Icon';

/**
 * Campo de hora — versão WEB/Electron.
 * ------------------------------------------------------------------
 * O `@react-native-community/datetimepicker` não faz nada na web. O equivalente
 * é o `<input type="time">` do navegador, que na app de computador dá o mesmo
 * seletor do resto do sistema.
 *
 * Mesmo desenho da `CampoData.web.tsx`: o input fica invisível por cima do
 * botão do relógio, o texto continua a ser a fonte de verdade e o seletor só lá
 * escreve. Mesmo contrato da versão nativa.
 */
export function CampoHora({
  value,
  onChangeText,
  placeholder = 'hh:mm',
  icon = 'clock-outline',
  rotuloRelogio = 'Escolher a hora',
}: CampoHoraProps) {
  const naWeb = Platform.OS === 'web' && typeof document !== 'undefined';
  const inputRef = useRef<HTMLInputElement | null>(null);

  // O `<input type="time">` fala `hh:mm`, que é o mesmo que se escreve no
  // campo — mas só o aceita completo. Meia hora escrita ("18:") semeava-o com
  // lixo e o navegador limpava o campo por baixo dos dedos.
  const valorHora = minutosDaHora(value) === null ? '' : value.trim();

  function abrir() {
    const el = inputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') el.showPicker();
    else el.click();
  }

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
        backgroundColor: colors.surface,
        paddingLeft: spacing.md,
        paddingRight: 5, // o botão do relógio traz o seu próprio fundo
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(mascaraHora(t))}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
      />
      {naWeb ? (
        <Pressable
          onPress={abrir}
          accessibilityRole="button"
          accessibilityLabel={rotuloRelogio}
          hitSlop={8}
          style={({ pressed }) => [estiloBotaoCalendario(), pressed && { opacity: 0.6 }]}>
          <Icon name="clock-edit-outline" size="md" color={colors.primaryDark} />
          <input
            ref={inputRef}
            type="time"
            value={valorHora}
            onChange={(e) => {
              const v = e.target.value; // hh:mm (ou vazio se se limpou)
              if (!v) return;
              onChangeText(v.slice(0, 5));
            }}
            style={{
              position: 'absolute',
              right: 0,
              width: 1,
              height: 1,
              opacity: 0,
              border: 0,
              padding: 0,
            }}
            tabIndex={-1}
            aria-hidden
          />
        </Pressable>
      ) : null}
    </View>
  );
}
