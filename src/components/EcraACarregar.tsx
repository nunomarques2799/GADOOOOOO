import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { colors, radii, spacing } from '@/theme';

/**
 * O que se vê enquanto a app decide se há sessão e a que explorações se
 * pertence.
 *
 * Antes disto, esses dois momentos devolviam `null` — ou seja, ecrã BRANCO. Em
 * condições normais dura um piscar de olhos e ninguém repara. Mas as respostas
 * vinham do servidor sem prazo nenhum: com rede fraca no campo, ou com uma
 * sessão velha que o servidor já não aceita, o branco ficava lá para sempre e a
 * app parecia avariada. Sem menu, sem botão, sem uma palavra — só branco. Foi
 * exatamente assim que apareceu.
 *
 * Agora há sempre três coisas: sinal de vida, ao fim de algum tempo uma
 * explicação, e uma saída. Nunca um beco.
 */

/** Antes disto não se mostra nada: num arranque normal só daria um flash. */
const MOSTRAR_APOS_MS = 700;

/** A partir daqui já não é lentidão — é alguma coisa que não vai resolver. */
const DEMORA_DEMAIS_MS = 8000;

export function EcraACarregar({ mensagem }: { mensagem?: string }) {
  const { sair } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const [demora, setDemora] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisivel(true), MOSTRAR_APOS_MS);
    const t2 = setTimeout(() => setDemora(true), DEMORA_DEMAIS_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!visivel) return null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
      }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radii.pill,
          backgroundColor: colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="cow" size={40} color={colors.primary} />
      </View>

      <ActivityIndicator color={colors.primary} />

      <Text variant="body" color={colors.textSecondary} center>
        {mensagem ?? 'A abrir a Terrabovina…'}
      </Text>

      {demora ? (
        <View style={{ alignItems: 'center', gap: spacing.sm, maxWidth: 420 }}>
          <Text variant="secondary" color={colors.textMuted} center>
            Está a demorar mais do que o costume. Pode ser falta de rede — ou a sessão
            ter caducado e ser preciso entrar outra vez.
          </Text>
          <Button label="Terminar sessão e entrar de novo" icon="logout" onPress={sair} />
        </View>
      ) : null}
    </View>
  );
}
