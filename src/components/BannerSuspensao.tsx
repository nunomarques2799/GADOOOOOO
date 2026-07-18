import { View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { colors, spacing } from '@/theme';

/**
 * Aviso de conta suspensa. Ao contrário do banner de atualização, este NÃO se
 * dispensa: enquanto a conta estiver suspensa nada se grava, e um criador que
 * fechasse o aviso ficaria a tentar registar animais sem perceber porquê.
 *
 * A suspensão corta a escrita, nunca a leitura — o efetivo continua todo à
 * vista e a cópia de segurança continua a funcionar (ver
 * `supabase/schema_suspensao.sql`). Por isso o texto fala em consultar, não
 * em recuperar acesso.
 */
export function BannerSuspensao() {
  const { contaSuspensa, isAdminEmAlguma } = useMembros();
  if (!contaSuspensa) return null;

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: colors.warning }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="lock-clock" size="lg" color={colors.warning} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Conta suspensa — só consulta</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {isAdminEmAlguma
              ? 'Pode ver e exportar tudo o que já registou, mas de momento não é possível gravar alterações. Fale connosco para reativar a conta.'
              : 'Pode consultar os dados desta exploração, mas não gravar alterações. A conta do responsável pela exploração está suspensa.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}
