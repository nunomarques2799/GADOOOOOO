import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import { colors, spacing } from '@/theme';

/**
 * "Houve alterações que não ficaram gravadas."
 * ------------------------------------------------------------------
 * Estas são as piores notícias que a app tem para dar, e até aqui eram as mais
 * escondidas: a lista das alterações recusadas pelo servidor só existia em
 * Definições → Sincronização, três toques para dentro e ainda por baixo do
 * botão "Mais" da barra de separadores. Ninguém vai lá sem motivo — e o motivo
 * é precisamente o que não se sabe que existe.
 *
 * Cada uma destas alterações já foi anunciada ao criador como gravada (o toast
 * verde aparece quando a escrita entra na fila, que é o que faz a app funcionar
 * sem rede). Quando a sincronização a leva ao servidor e ele a recusa — sem
 * permissão para aquela exploração, ou porque outra pessoa mexeu no mesmo
 * registo primeiro — a vacina que ele deu no campo deixou de existir. Se isso
 * não aparecer no primeiro ecrã, não aparece em sítio nenhum.
 *
 * Não se dispensa aqui: o "Esquecer esta lista" fica no ecrã da sincronização,
 * depois de se ver o que falhou. Um X neste cartão seria a forma mais rápida de
 * apagar a única cópia da má notícia.
 */
export function BannerNaoGravado() {
  const router = useRouter();
  const { falhadas } = useGado();

  if (falhadas.length === 0) return null;

  const varias = falhadas.length > 1;
  // Um conflito significa que a alteração se perdeu para a versão de outra
  // pessoa; uma recusa significa que nunca entrou. A diferença muda o que o
  // criador tem de fazer a seguir, por isso conta-se logo aqui.
  const conflitos = falhadas.filter((f) => f.motivo === 'conflito').length;

  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1.5, borderColor: colors.danger }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <Icon name="alert-circle-outline" size="lg" color={colors.danger} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">
            {falhadas.length} alteraç{varias ? 'ões' : 'ão'} não ficou
            {varias ? 'ram' : ''} gravada{varias ? 's' : ''}
          </Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {conflitos === falhadas.length
              ? 'Outra pessoa mexeu nos mesmos registos primeiro. Veja o que está em falta e volte a registar o que ainda fizer sentido.'
              : 'O servidor não as aceitou. Veja quais foram — o que se registou nelas não está guardado.'}
          </Text>
        </View>
      </View>
      <Button
        label="Ver o que falhou"
        icon="clipboard-alert-outline"
        variant="secondary"
        onPress={() => router.push('/conta/sincronizacao')}
        style={{ marginTop: spacing.sm }}
      />
    </Card>
  );
}
