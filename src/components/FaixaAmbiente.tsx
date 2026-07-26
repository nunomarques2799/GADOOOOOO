import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Icon, Text } from '@/components/ui';
import { ehDev } from '@/data/ambiente';
import { colors, spacing } from '@/theme';

/**
 * Faixa permanente no topo quando a app corre contra a base de dados de TESTES.
 *
 * Duas builds da app são visualmente idênticas — a que o criador tem instalada
 * e a que se usa para experimentar. A diferença está numa variável de ambiente
 * que não aparece em lado nenhum do ecrã. Sem esta faixa, o erro que mais custa
 * é trivial de cometer: apagar "os dados de teste" que afinal eram os dele.
 *
 * Em produção `ehDev` é falso e isto devolve os filhos intactos — não há faixa,
 * não há `View` a mais, não há um pixel de diferença.
 */

/** Referência do projeto Supabase (o subdomínio), para saber a QUAL está ligada. */
function refDoProjeto(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return 'sem Supabase';
  const encontrado = /https?:\/\/([^.]+)\./.exec(url);
  return encontrado ? encontrado[1] : url;
}

export function FaixaAmbiente({ children }: { children: ReactNode }) {
  if (!ehDev) return <>{children}</>;

  return (
    <SafeAreaInsetsContext.Consumer>
      {(insets) => (
        <View style={{ flex: 1, backgroundColor: colors.ambienteDev }}>
          <View
            style={{
              paddingTop: (insets?.top ?? 0) + spacing.xxs,
              paddingBottom: spacing.xxs,
              paddingHorizontal: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
            }}>
            <Icon name="flask-outline" size="sm" color={colors.onAmbienteDev} />
            <Text
              variant="label"
              color={colors.onAmbienteDev}
              numberOfLines={1}
              accessibilityLabel="Atenção: ambiente de testes. Estes dados não são reais.">
              TESTES · {refDoProjeto()}
            </Text>
          </View>
          {/* A faixa já consumiu a safe-area do topo. Sem isto, cada ecrã lá
              dentro voltava a reservá-la e abria um vazio por baixo da faixa. */}
          <SafeAreaInsetsContext.Provider
            value={{ top: 0, bottom: insets?.bottom ?? 0, left: insets?.left ?? 0, right: insets?.right ?? 0 }}>
            <View style={{ flex: 1 }}>{children}</View>
          </SafeAreaInsetsContext.Provider>
        </View>
      )}
    </SafeAreaInsetsContext.Consumer>
  );
}
