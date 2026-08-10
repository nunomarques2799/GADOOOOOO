import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, TextInput, View } from 'react-native';

import { mascaraHora, minutosDaHora } from '@/data/acessoTemporario';
import { t } from '@/i18n';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

import { Button } from './Button';
import { estiloBotaoCalendario } from './campoDataEstilo';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Campo de hora, irmão do `CampoData`, com as mesmas duas formas de escrever.
 * ------------------------------------------------------------------
 * Continua a aceitar o texto `hh:mm` com a máscara (`mascaraHora`) — quem sabe
 * a hora escreve quatro dígitos e está feito. O botão do relógio ao lado abre o
 * seletor do sistema, que é o que serve a quem tem dificuldade em acertar
 * dígitos num teclado pequeno.
 *
 * A fonte de verdade é o texto, como no `CampoData`: o seletor só lá escreve, e
 * a validação (`minutosDaHora`) fica em quem usa o campo. Versão nativa; a
 * `.web.tsx` faz o mesmo com o `<input type="time">` do navegador.
 */
export type CampoHoraProps = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: IconName;
  /** Rótulo lido pelo leitor de ecrã no botão do relógio. */
  rotuloRelogio?: string;
};

export function CampoHora({
  value,
  onChangeText,
  placeholder = 'hh:mm',
  icon = 'clock-outline',
  rotuloRelogio = 'Escolher a hora',
}: CampoHoraProps) {
  const [aberto, setAberto] = useState(false);

  // Semente do seletor: a hora já escrita, ou a próxima hora certa. Abrir na
  // hora atual, com os minutos que calharem, dava prazos como "17:43".
  const minutos = minutosDaHora(value);
  const semente = new Date();
  if (minutos === null) semente.setHours(semente.getHours() + 1, 0, 0, 0);
  else semente.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);

  function aoMudar(evento: DateTimePickerEvent, data?: Date) {
    // Android fecha-se sozinho; iOS fica até ao "Concluído" (ver CampoData).
    if (Platform.OS !== 'ios') setAberto(false);
    if (evento.type === 'set' && data) {
      const p = (n: number) => String(n).padStart(2, '0');
      onChangeText(`${p(data.getHours())}:${p(data.getMinutes())}`);
    }
  }

  return (
    <View>
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
        <Pressable
          onPress={() => setAberto(true)}
          accessibilityRole="button"
          accessibilityLabel={rotuloRelogio}
          hitSlop={8}
          style={({ pressed }) => [estiloBotaoCalendario(), pressed && { opacity: 0.6 }]}>
          <Icon name="clock-edit-outline" size="md" color={colors.primaryDark} />
        </Pressable>
      </View>

      {aberto && Platform.OS !== 'ios' ? (
        <DateTimePicker value={semente} mode="time" is24Hour onChange={aoMudar} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
            onPress={() => setAberto(false)}
            accessibilityLabel={t('comum.fechar')}>
            <Pressable
              onPress={() => {}}
              style={[
                {
                  backgroundColor: colors.background,
                  borderTopLeftRadius: radii.xl,
                  borderTopRightRadius: radii.xl,
                  padding: spacing.lg,
                },
                shadow.lg,
              ]}>
              <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                Escolher hora
              </Text>
              <DateTimePicker
                value={semente}
                mode="time"
                is24Hour
                display="spinner"
                onChange={aoMudar}
                themeVariant="light"
                accentColor={colors.primary}
              />
              <Button
                label={t('comum.concluido')}
                icon="check"
                onPress={() => setAberto(false)}
                style={{ marginTop: spacing.sm }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
