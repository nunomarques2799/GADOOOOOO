import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, type IconName, Text } from '@/components/ui';
import { useNotificacoes } from '@/data/notificacoes';
import { suportaNotificacoes, temPermissao } from '@/data/notificacoesLocais';
import { useGado } from '@/data/store';
import {
  deveMostrar,
  esconderTutorial,
  passosTutorial,
  progresso,
  tutorialEscondido,
  type ChavePasso,
  type Passo,
} from '@/data/tutorial';
import { colors, radii, spacing } from '@/theme';

/** Para onde leva cada passo, e com que ícone aparece. */
const PASSO_META: Record<ChavePasso, { icon: IconName; rota: Href }> = {
  exploracao: { icon: 'barn', rota: '/exploracao/nova' },
  animal: { icon: 'cow', rota: '/animal/novo' },
  avisos: { icon: 'bell-ring-outline', rota: '/conta/notificacoes' },
};

/**
 * O guia de primeiros passos, no topo do Início.
 * ------------------------------------------------------------------
 * Uma conta nova é uma sequência de ecrãs vazios; isto dá-lhe um fio. Mostra os
 * passos por ordem, marca sozinho os que já estão feitos (lidos dos dados — um
 * animal registado noutro aparelho conta na mesma) e aponta o próximo. Some
 * quando está tudo feito, ou quando o criador o esconde — e volta pela Ajuda.
 *
 * A lógica de que passos existem e quais estão feitos é pura e testada
 * (`data/tutorial.ts`); aqui só se liga aos dados e à navegação.
 */
export function PainelPrimeirosPassos() {
  const router = useRouter();
  const { exploracoes, animais } = useGado();
  const { preferencias } = useNotificacoes();

  // Só se recalcula quando o painel monta ou os dados mudam; a permissão do
  // sistema é assíncrona, por isso começa por `false` e corrige-se a seguir.
  const [permitido, setPermitido] = useState(false);
  useEffect(() => {
    if (suportaNotificacoes) void temPermissao().then(setPermitido);
  }, []);

  // Esconder é uma decisão do momento — guardá-la em estado faz o painel sumir
  // sem recarregar a app.
  const [escondido, setEscondido] = useState(() => tutorialEscondido());

  const passos = passosTutorial({
    temExploracoes: exploracoes.length > 0,
    temAnimais: animais.length > 0,
    avisosLigados: preferencias.noTelemovel && permitido,
    suportaAvisos: suportaNotificacoes,
  });

  if (!deveMostrar(passos, escondido)) return null;

  const { feitos, total } = progresso(passos);
  // O próximo por fazer é o que leva a ação em destaque — um passo de cada vez,
  // para não pedir tudo ao mesmo tempo a quem está a começar.
  const proximo = passos.find((p) => !p.feito);

  function esconder() {
    esconderTutorial();
    setEscondido(true);
  }

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="flag-checkered" size="lg" color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Vamos começar</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {feitos} de {total} feito{feitos === 1 ? '' : 's'}
          </Text>
        </View>
        <Pressable
          onPress={esconder}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Esconder o guia de primeiros passos"
          style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}>
          <Text variant="caption" color={colors.textMuted}>
            Esconder
          </Text>
        </Pressable>
      </View>

      {/* Barra de progresso — proporção dos passos já feitos. */}
      <View
        style={{
          height: 8,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceSunken,
          marginTop: spacing.sm,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${(feitos / total) * 100}%`,
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
          }}
        />
      </View>

      <View style={{ marginTop: spacing.sm }}>
        {passos.map((p) => (
          <LinhaPasso
            key={p.chave}
            passo={p}
            destaque={!p.feito && p.chave === proximo?.chave}
            onPress={() => router.push(PASSO_META[p.chave].rota)}
          />
        ))}
      </View>
    </Card>
  );
}

function LinhaPasso({
  passo,
  destaque,
  onPress,
}: {
  passo: Passo;
  destaque: boolean;
  onPress: () => void;
}) {
  const meta = PASSO_META[passo.chave];

  return (
    <Pressable
      // Um passo já feito não leva a lado nenhum — o toque fica para o que falta.
      onPress={passo.feito ? undefined : onPress}
      disabled={passo.feito}
      accessibilityRole="button"
      accessibilityState={{ disabled: passo.feito }}
      accessibilityLabel={`${passo.titulo}. ${passo.feito ? 'Feito' : passo.descricao}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: destaque ? spacing.sm : 0,
          borderRadius: radii.md,
          backgroundColor: destaque ? colors.primaryTint : 'transparent',
        },
        pressed && !passo.feito && { opacity: 0.7 },
      ]}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: passo.feito ? colors.successTint : colors.surfaceSunken,
        }}>
        <Icon
          name={passo.feito ? 'check' : meta.icon}
          size="md"
          color={passo.feito ? colors.success : colors.primary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="bodyStrong"
          color={passo.feito ? colors.textMuted : colors.text}
          style={passo.feito ? { textDecorationLine: 'line-through' } : undefined}>
          {passo.titulo}
        </Text>
        {!passo.feito ? (
          <Text variant="secondary" color={colors.textSecondary}>
            {passo.descricao}
          </Text>
        ) : null}
      </View>
      {!passo.feito ? <Icon name="chevron-right" size="md" color={colors.textMuted} /> : null}
    </Pressable>
  );
}
