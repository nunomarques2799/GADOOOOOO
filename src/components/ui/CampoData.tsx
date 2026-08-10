import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, TextInput, View } from 'react-native';

import { t } from '@/i18n';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

import { Button } from './Button';
import { estiloBotaoCalendario } from './campoDataEstilo';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { formatDataCurta, mascaraDataPt, parseDataPt } from '@/data/helpers';

/**
 * Campo de data com as DUAS formas de escrever, e não uma em vez da outra.
 * ------------------------------------------------------------------
 * Continua a aceitar o texto `dd/mm/aaaa` com a máscara (`mascaraDataPt`) — é o
 * caminho mais rápido para quem sabe a data de cor. O que acrescenta é o botão
 * do calendário ao lado: para a data de nascimento de um animal já crescido, ou
 * a cobrição de há uns meses, escolher num calendário é menos erro do que
 * acertar oito dígitos num teclado numérico.
 *
 * A fonte de verdade continua a ser o texto: o picker só escreve nele
 * (`formatDataCurta`), e a validação (`parseDataPt`) fica em quem usa o campo,
 * exatamente como estava. Assim um campo com esta troca não muda em mais nada.
 *
 * Versão nativa; a `.web.tsx` faz o mesmo com o seletor do navegador.
 */
export type CampoDataProps = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  /** Ícone à esquerda. Por omissão o de escrever uma data. */
  icon?: IconName;
  /** Deixa escolher datas no futuro (ex.: parto previsto). Por omissão, não. */
  permitirFuturo?: boolean;
  /** Rótulo lido pelo leitor de ecrã no botão do calendário. */
  rotuloCalendario?: string;
};

export function CampoData({
  value,
  onChangeText,
  placeholder,
  icon = 'calendar-edit',
  permitirFuturo = false,
  rotuloCalendario = 'Escolher no calendário',
}: CampoDataProps) {
  const [aberto, setAberto] = useState(false);

  // Semente do picker: a data já escrita (mesmo futura, para não a recusar ao
  // reabrir), ou hoje. `permitirFuturo: true` aqui é só para LER o que está no
  // campo — o limite de escolha é o `maximumDate` abaixo.
  const iso = value.trim() ? parseDataPt(value, { permitirFuturo: true }) : null;
  const semente = iso ? new Date(iso) : new Date();
  const maxima = permitirFuturo ? undefined : new Date();

  function aoMudar(evento: DateTimePickerEvent, data?: Date) {
    // No Android o diálogo fecha-se sozinho (set ou dismissed); no iOS fica no
    // sítio até o "Concluído", para se poder rodar o ano com calma.
    if (Platform.OS !== 'ios') setAberto(false);
    if (evento.type === 'set' && data) onChangeText(formatDataCurta(data.toISOString()));
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
          // Estreito à direita: é onde encosta o botão do calendário, que já
          // traz o seu próprio fundo e alvo de toque.
          paddingRight: 5,
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
        <Pressable
          onPress={() => setAberto(true)}
          accessibilityRole="button"
          accessibilityLabel={rotuloCalendario}
          hitSlop={8}
          style={({ pressed }) => [estiloBotaoCalendario(), pressed && { opacity: 0.6 }]}>
          <Icon name="calendar-month" size="md" color={colors.primaryDark} />
        </Pressable>
      </View>

      {/* Android: o componente é o próprio diálogo, só existe enquanto aberto. */}
      {aberto && Platform.OS !== 'ios' ? (
        <DateTimePicker value={semente} mode="date" maximumDate={maxima} onChange={aoMudar} />
      ) : null}

      {/* iOS: calendário dentro de uma folha, com o "Concluído" a fechar. */}
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
                Escolher data
              </Text>
              <DateTimePicker
                value={semente}
                mode="date"
                display="inline"
                maximumDate={maxima}
                onChange={aoMudar}
                themeVariant="light"
                accentColor={colors.primary}
              />
              <Button label={t('comum.concluido')} icon="check" onPress={() => setAberto(false)} style={{ marginTop: spacing.sm }} />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
