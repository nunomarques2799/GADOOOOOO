import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioMovimento } from '@/components/FormularioMovimento';
import { EmptyState, Header, Screen } from '@/components/ui';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { colors } from '@/theme';

/**
 * Corrigir (ou apagar) um lançamento financeiro já registado.
 *
 * Chega-se aqui tocando na linha, no separador Finanças. Um 450 € que era 45 €
 * ficava lá para sempre: a única saída era apagar — o que ninguém podia fazer —
 * ou lançar um movimento ao contrário, que deixava as contas certas e o
 * histórico a mentir.
 */
export default function EditarMovimentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { movimentos } = useGado();

  const movimento = id ? movimentos.find((m) => m.id === id) : undefined;

  if (!movimento) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('formMovimento.movimento')} />
        <Screen>
          <EmptyState
            icon="cash-remove"
            title={t('formMovimento.naoEncontrado')}
            message={t('formMovimento.naoEncontradoMensagem')}
          />
        </Screen>
      </View>
    );
  }

  return <FormularioMovimento movimento={movimento} />;
}
