import { useRef } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

import { colors, radii, sizes, spacing } from '@/theme';

import { Icon } from './Icon';
import type { CampoDataProps } from './CampoData';
import { diaIso, formatDataCurta, mascaraDataPt, parseDataPt } from '@/data/helpers';

/**
 * Campo de data — versão WEB/Electron.
 * ------------------------------------------------------------------
 * O `@react-native-community/datetimepicker` não faz nada na web (só avisa na
 * consola). O equivalente é o seletor nativo do navegador, o `<input
 * type="date">`, que na app de computador dá o calendário a que o criador está
 * habituado do resto do sistema.
 *
 * O `<input>` fica invisível por cima do botão do calendário: o texto continua
 * a ser a fonte de verdade (mesma máscara, mesma validação em quem usa o
 * campo), e o seletor só lá escreve. Mesmo contrato da versão nativa.
 */
export function CampoData({
  value,
  onChangeText,
  placeholder,
  icon = 'calendar-edit',
  permitirFuturo = false,
  rotuloCalendario = 'Escolher no calendário',
}: CampoDataProps) {
  // Só no browser real (a app de computador é web). No React Native Web dentro
  // de um teste não há `document`, e o input HTML não existe — mas aí também
  // não há quem clique.
  const naWeb = Platform.OS === 'web' && typeof document !== 'undefined';
  const inputRef = useRef<HTMLInputElement | null>(null);

  // O `<input type="date">` fala `aaaa-mm-dd`. A data já escrita semeia-o para
  // o calendário abrir no mês certo.
  const iso = value.trim() ? parseDataPt(value, { permitirFuturo: true }) : null;
  const valorIso = iso ? diaIso(iso) : '';
  const maxIso = permitirFuturo ? undefined : diaIso(new Date());

  function abrir() {
    const el = inputRef.current;
    if (!el) return;
    // `showPicker` abre o calendário sem precisar de foco; onde não existe,
    // um clique no input faz o mesmo.
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
        paddingHorizontal: spacing.md,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(mascaraDataPt(t))}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
      />
      {naWeb ? (
        <Pressable
          onPress={abrir}
          accessibilityRole="button"
          accessibilityLabel={rotuloCalendario}
          hitSlop={8}
          style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}>
          <Icon name="calendar-month" size="md" color={colors.primary} />
          {/* O input real, encostado ao botão e invisível: é ele que abre o
              calendário do navegador e recebe a escolha. */}
          <input
            ref={inputRef}
            type="date"
            max={maxIso}
            value={valorIso}
            onChange={(e) => {
              const v = e.target.value; // aaaa-mm-dd (ou vazio se se limpou)
              if (!v) return;
              const [ano, mes, dia] = v.split('-').map(Number);
              onChangeText(formatDataCurta(new Date(ano, mes - 1, dia, 12).toISOString()));
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
