import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Header, Icon, Screen, Text } from '@/components/ui';
import { avisar, confirmar } from '@/data/avisos';
import { t } from '@/i18n';
import {
  colors,
  FAMILIAS,
  paletasDe,
  PALETAS,
  radii,
  spacing,
  type Paleta,
  type PaletaId,
} from '@/theme';
import { mudarPaleta, paletaGuardada } from '@/theme/preferencia';

/**
 * Escolher o aspeto da app.
 *
 * Mostra cada paleta desenhada com as SUAS cores — um cabeçalho, um cartão,
 * um botão — em vez de uma bolinha de cor. Quem tem 82 anos e pouca vista não
 * decide por um ponto de 20px; decide por ver a app como ela vai ficar.
 *
 * A troca recarrega a app (ver `theme/preferencia.ts`), por isso pergunta-se
 * primeiro: um ecrã que se fecha sozinho sem aviso parece uma avaria.
 */
export default function AparenciaScreen() {
  const [escolhida, setEscolhida] = useState<PaletaId>(() => paletaGuardada());
  const [aAplicar, setAAplicar] = useState(false);

  function escolher(p: Paleta) {
    if (aAplicar || p.id === escolhida) return;
    confirmar(
      `Mudar para "${p.nome}"?`,
      t('aspeto.vaiRecarregar'),
      () => {
        void aplicar(p);
      },
      { rotuloConfirmar: t('aspeto.mudar') },
    );
  }

  async function aplicar(p: Paleta) {
    setAAplicar(true);
    setEscolhida(p.id);
    const recarregou = await mudarPaleta(p.id);
    if (!recarregou) {
      // Acontece em ambiente de desenvolvimento e se o navegador bloquear o
      // recarregamento. A escolha ficou gravada — o que falta é dizê-lo, em
      // vez de deixar o criador a olhar para uma app da mesma cor.
      avisar(
        t('idioma.escolhaGuardada'),
        `A app fica com o aspeto "${p.nome}" da próxima vez que a abrir.`,
      );
      setAAplicar(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('aspeto.titulo')} />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {PALETAS.length} maneiras de a app se apresentar. Só muda o aspeto: os animais,
          os alertas e os registos ficam exatamente como estão.
        </Text>

        {/* Por famílias de cor: quem quer "um azul" salta direto ao sítio em
            vez de percorrer vinte cartões à procura. */}
        {FAMILIAS.map((familia) => (
          <View key={familia}>
            <Text
              variant="label"
              color={colors.textSecondary}
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              {familia.toUpperCase()}
            </Text>
            {paletasDe(familia).map((p) => (
              <CartaoPaleta
                key={p.id}
                paleta={p}
                selecionada={p.id === escolhida}
                onPress={() => escolher(p)}
              />
            ))}
          </View>
        ))}

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: colors.infoTint,
            borderRadius: radii.md,
            padding: spacing.md,
            marginTop: spacing.xs,
          }}>
          <Icon name="information" size="md" color={colors.info} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {t('aspeto.coresDosAvisos')}
            amarelo "esta semana" e o azul informação. É assim que se reconhecem de
            relance.
          </Text>
        </View>

        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: spacing.md, textAlign: 'center' }}>
          A escolha fica na sua conta: os outros aparelhos onde entrar passam a
          abrir com estas cores.
        </Text>
      </Screen>
    </View>
  );
}

/**
 * Uma paleta desenhada com as suas próprias cores.
 *
 * Nada aqui usa `colors` para o miolo da amostra — se usasse, todas as
 * amostras apareciam iguais, com a paleta que está ativa.
 */
function CartaoPaleta({
  paleta,
  selecionada,
  onPress,
}: {
  paleta: Paleta;
  selecionada: boolean;
  onPress: () => void;
}) {
  // `cor` e não `t`: o `t` é a função de tradução importada em cima, e o nome
  // antigo tapava-a dentro deste componente.
  const cor = paleta.tokens;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={`${paleta.nome}. ${paleta.descricao}`}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      <Card
        padded={false}
        style={{
          marginBottom: spacing.md,
          borderWidth: selecionada ? 3 : 1,
          borderColor: selecionada ? colors.primary : colors.border,
          overflow: 'hidden',
        }}>
        {/* Amostra: o cabeçalho, um cartão e um botão, como na app a sério */}
        <View style={{ backgroundColor: cor.background, padding: spacing.sm }}>
          <View
            style={{
              backgroundColor: cor.headerTo,
              borderRadius: radii.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
            <Icon name="cow" size="sm" color={cor.onPrimary} />
            <Text variant="caption" color={cor.onPrimary}>
              Terrabovina
            </Text>
          </View>

          <View
            style={{
              backgroundColor: cor.surface,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: cor.border,
              padding: spacing.sm,
              marginTop: spacing.xs,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={cor.text}>
                {t('aspeto.exemploAnimal')}
              </Text>
              <Text variant="caption" color={cor.textMuted}>
                {t('aspeto.exemploRaca')}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: cor.primaryTint,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.xs,
                paddingVertical: 3,
              }}>
              <Text variant="caption" color={cor.primaryDark}>
                {t('docs.emDia')}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: cor.primary,
              borderRadius: radii.sm,
              paddingVertical: spacing.xs,
              marginTop: spacing.xs,
              alignItems: 'center',
            }}>
            <Text variant="caption" color={cor.onPrimary}>
              {t('animais.registarAnimal')}
            </Text>
          </View>
        </View>

        {/* Nome e estado */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            padding: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{paleta.nome}</Text>
            <Text variant="secondary" color={colors.textSecondary}>
              {paleta.descricao}
            </Text>
          </View>
          {selecionada ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.primaryTint,
                borderRadius: radii.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
              }}>
              <Icon name="check-circle" size="sm" color={colors.primary} />
              <Text variant="caption" color={colors.primaryDark}>
                A usar
              </Text>
            </View>
          ) : (
            <Icon name="circle-outline" size="md" color={colors.textMuted} />
          )}
        </View>
      </Card>
    </Pressable>
  );
}
