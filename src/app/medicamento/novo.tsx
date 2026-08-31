import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { FormularioMedicamento } from '@/components/FormularioMedicamento';
import { EmptyState, Header } from '@/components/ui';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { colors } from '@/theme';

export default function NovoMedicamentoScreen() {
  /**
   * O `codigo` chega de quem leu uma caixa na aba das Existências. Vai em cru
   * (é o que a câmara devolveu) e não já interpretado: quem sabe o que ele quer
   * dizer é o formulário, e mandar o significado pela rota obrigava a repetir
   * essa decisão nos dois sítios.
   */
  const { exploracaoId, codigo } = useLocalSearchParams<{
    exploracaoId?: string;
    codigo?: string;
  }>();
  const { exploracoes } = useGado();

  const alvo =
    exploracaoId && exploracoes.some((e) => e.id === exploracaoId)
      ? exploracaoId
      : exploracoes[0]?.id;

  if (!alvo) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('existencias.darEntrada')} />
        <EmptyState
          icon="barn"
          title={t('formTerreno.semExploracoesTitulo')}
          message={t('formLote.semExploracoesMensagem')}
        />
      </View>
    );
  }

  return <FormularioMedicamento exploracaoId={alvo} codigoLido={codigo} />;
}
