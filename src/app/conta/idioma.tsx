import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Header, Icon, Screen, Text } from '@/components/ui';
import { idiomaAtual, IDIOMAS, mudarIdioma, NOME_DO_IDIOMA, t, type Idioma } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * A língua da app.
 *
 * Ecrã próprio, como o das cores, e pela mesma razão mecânica: escolher
 * RECARREGA a app (ver `src/i18n/idioma.ts`). Uma escolha que faz o ecrã
 * desaparecer e voltar tem de ser deliberada — num interruptor solto na lista
 * de definições, um toque a mais parecia uma avaria.
 */
export default function IdiomaScreen() {
  const [escolhido, setEscolhido] = useState<Idioma>(idiomaAtual());
  /** Ficou gravado mas a app não recarregou (acontece em desenvolvimento). */
  const [porAplicar, setPorAplicar] = useState(false);

  async function escolher(id: Idioma) {
    if (id === escolhido && !porAplicar) return;
    setEscolhido(id);
    const recarregou = await mudarIdioma(id);
    // Se recarregou, este componente já não existe para ver isto. Se não,
    // é preciso dizer que a escolha ficou — senão fica-se a olhar para uma app
    // que não mudou de língua, sem saber se resultou.
    setPorAplicar(!recarregou);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('idioma.titulo')} />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {t('idioma.explicacao')}
        </Text>

        <Card padded={false}>
          <View style={{ paddingHorizontal: spacing.md }}>
            {IDIOMAS.map((id, i) => {
              const ativo = escolhido === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => void escolher(id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={NOME_DO_IDIOMA[id]}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      // Alvo grande: é uma lista de duas linhas usada com o
                      // polegar, e o público-alvo é idoso.
                      minHeight: 64,
                      borderBottomWidth: i < IDIOMAS.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radii.pill,
                      backgroundColor: ativo ? colors.primaryTint : colors.surfaceSunken,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon
                      name="translate"
                      size="md"
                      color={ativo ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <Text
                    variant={ativo ? 'bodyStrong' : 'body'}
                    color={ativo ? colors.primaryDark : colors.text}
                    style={{ flex: 1 }}>
                    {NOME_DO_IDIOMA[id]}
                  </Text>
                  {ativo ? <Icon name="check" size="md" color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: porAplicar ? colors.warningTint : colors.infoTint,
            borderRadius: radii.md,
            padding: spacing.md,
            marginTop: spacing.md,
          }}>
          <Icon
            name={porAplicar ? 'alert-outline' : 'information'}
            size="md"
            color={porAplicar ? colors.warning : colors.info}
          />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {porAplicar ? t('idioma.porAplicar') : t('idioma.aRecarregar')}
          </Text>
        </View>

        {/* O que NÃO muda de língua, dito antes de alguém estranhar. Os tipos de
            registo e as raças são valores gravados nas fichas — ver o cabeçalho
            de `src/i18n/textos.ts`. */}
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md }}>
          {t('idioma.domínioEmPortugues')}
        </Text>
      </Screen>
    </View>
  );
}
