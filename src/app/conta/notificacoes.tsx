import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Header, Icon, type IconName, Text } from '@/components/ui';
import { confirmar } from '@/data/avisos';
import {
  CATEGORIAS,
  iconeCategoria,
  rotuloCategoria,
  useNotificacoes,
  type Categoria,
} from '@/data/notificacoes';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Escolher o que aparece em "Precisa da sua atenção" e com que antecedência.
 * Alertas vencidos ou urgentes passam sempre — não deixaríamos o utilizador
 * esconder um prazo legal por engano.
 */
export default function NotificacoesScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { preferencias, definirAtiva, definirAntecedencia, repor } = useNotificacoes();

  function pedirReposicao() {
    confirmar(
      'Repor as preferências',
      'Volta às definições recomendadas: todas as categorias ligadas, com antecedências pré-definidas.',
      repor,
      { rotuloConfirmar: 'Repor' },
    );
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Notificações e alertas" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={conteudo}>
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="information-outline" size="md" color={colors.info} />
              <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                Escolha que avisos aparecem no início. Prazos já vencidos ou urgentes
                aparecem sempre, mesmo que a categoria esteja desligada.
              </Text>
            </View>
          </Card>

          {CATEGORIAS.map((c) => (
            <LinhaCategoria
              key={c}
              categoria={c}
              ativa={preferencias.ativa[c]}
              antecedencia={preferencias.antecedenciaDias[c]}
              onAtivaChange={(v) => definirAtiva(c, v)}
              onAntecedenciaChange={(d) => definirAntecedencia(c, d)}
            />
          ))}

          <Button
            label="Repor recomendações"
            icon="restart"
            variant="ghost"
            onPress={pedirReposicao}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function LinhaCategoria({
  categoria,
  ativa,
  antecedencia,
  onAtivaChange,
  onAntecedenciaChange,
}: {
  categoria: Categoria;
  ativa: boolean;
  antecedencia: number;
  onAtivaChange: (v: boolean) => void;
  onAntecedenciaChange: (d: number) => void;
}) {
  const menos = () => onAntecedenciaChange(Math.max(1, antecedencia - 1));
  const mais = () => onAntecedenciaChange(Math.min(90, antecedencia + 1));

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: ativa ? colors.primaryTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={iconeCategoria[categoria] as IconName}
            size="md"
            color={ativa ? colors.primary : colors.textMuted}
          />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {rotuloCategoria[categoria]}
        </Text>
        <Switch
          value={ativa}
          onValueChange={onAtivaChange}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.white}
          accessibilityLabel={`Notificações de ${rotuloCategoria[categoria]}`}
        />
      </View>

      {/* O seletor de antecedência só aparece com a categoria ligada — sem
          isso é escolher um número que não vai a lado nenhum. */}
      {ativa ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Text variant="secondary" color={colors.textSecondary}>
            Começar a avisar
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <BotaoRedondo icone="minus" onPress={menos} rotulo="Menos dias" />
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.xs,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceAlt,
              }}>
              <Text variant="h2">{antecedencia}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {antecedencia === 1 ? 'dia antes' : 'dias antes'}
              </Text>
            </View>
            <BotaoRedondo icone="plus" onPress={mais} rotulo="Mais dias" />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function BotaoRedondo({
  icone,
  onPress,
  rotulo,
}: {
  icone: IconName;
  onPress: () => void;
  rotulo: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icone} size="md" color={colors.primary} />
    </Pressable>
  );
}
