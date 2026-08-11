import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import {
  definirAnfitriaoAvisos,
  type PedidoAviso,
  type PedidoConfirmacao,
} from '@/data/avisos';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * Onde as perguntas e os avisos da app aparecem. Um só sítio (ver `_layout.tsx`).
 * ------------------------------------------------------------------
 * Irmão do `AnfitriaoToasts`, e a divisão entre os dois é a de sempre: o toast
 * confirma o que já aconteceu e desaparece sozinho; isto PÁRA a app e espera
 * uma resposta. Serve o que tem de ser lido antes de continuar — e, sobretudo,
 * o que não tem volta.
 *
 * Substitui os diálogos do sistema (ver `data/avisos.ts`). O que se ganha, além
 * do aspeto: o botão que elimina é vermelho e diz "Eliminar" em vez de "OK", o
 * texto pode ser comprido sem ficar ilegível, e a pergunta aparece no meio do
 * ecrã — não numa barra agarrada ao topo da janela, que na app de computador
 * ficava longe do dedo e parecia um erro do navegador.
 *
 * Fechar pelo fundo ou pelo botão do sistema é sempre CANCELAR: quem tocou fora
 * não respondeu à pergunta, e a ação destrutiva não pode acontecer por omissão.
 *
 * O `Modal` só existe enquanto houver pergunta — ver a nota do `if (!pedido)`
 * mais abaixo, que é o que o põe POR CIMA das folhas da app.
 */
type Pedido =
  | ({ tipo: 'aviso' } & PedidoAviso)
  | ({ tipo: 'confirmacao' } & PedidoConfirmacao);

export function AnfitriaoAvisos() {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const anfitriao = useMemo(
    () => ({
      avisar: (p: PedidoAviso) => setPedido({ tipo: 'aviso', ...p }),
      confirmar: (p: PedidoConfirmacao) => setPedido({ tipo: 'confirmacao', ...p }),
    }),
    [],
  );

  useEffect(() => {
    definirAnfitriaoAvisos(anfitriao);
    // Ao desmontar volta-se aos diálogos do sistema, em vez de ficar um
    // anfitrião morto a receber pedidos que ninguém desenha.
    return () => definirAnfitriaoAvisos(null);
  }, [anfitriao]);

  const fechar = useCallback(() => setPedido(null), []);

  const responder = useCallback(() => {
    // Fecha ANTES de executar: quem confirma quase sempre navega a seguir
    // (`router.dismissTo` depois de eliminar), e a folha ainda aberta por cima
    // do ecrã novo ficava lá presa.
    setPedido(null);
    if (pedido?.tipo === 'confirmacao') pedido.aoConfirmar();
  }, [pedido]);

  /**
   * Sem pergunta não há `Modal` NENHUM montado — e é isso que faz a pergunta
   * aparecer por cima e não por baixo.
   *
   * O `Modal` da web (react-native-web) desenha-se num `<div>` que é criado e
   * pendurado no `body` quando o componente MONTA, não quando fica visível, e
   * nenhum deles leva `z-index`: quem está mais abaixo no documento é quem fica
   * à frente. Este anfitrião monta no arranque da app (`_layout.tsx`), portanto
   * o `div` dele era sempre o primeiro — e qualquer folha aberta depois (a das
   * permissões, a dos filtros) tapava-o. O resultado era uma pergunta invisível
   * atrás da folha, com a app à espera de uma resposta que não se conseguia
   * dar: os chips de "Reabrir 4 horas" deixavam de fazer o que quer que fosse.
   *
   * Montado só à chegada do pedido, o `div` é o último do documento e a
   * pergunta fica à frente de tudo o que estiver aberto. No Android é o mesmo
   * pela mesma ordem (o `Modal` é um diálogo, e o último a ser mostrado fica em
   * cima).
   */
  if (!pedido) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fechar}>
      <Pressable
        onPress={fechar}
        accessibilityLabel={t('comum.fechar')}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}>
        {/* Um `Pressable` sem ação por dentro: é o que impede o toque no cartão
            de chegar ao fundo e fechar a pergunta sem resposta. */}
        <Pressable
          onPress={() => {}}
          accessibilityViewIsModal
          style={[
            {
              width: '100%',
              maxWidth: 460,
              maxHeight: '85%',
              backgroundColor: colors.surface,
              borderRadius: radii.xl,
              padding: spacing.lg,
            },
            shadow.lg,
          ]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginBottom: spacing.sm,
            }}>
            <Icon
              name={
                pedido.tipo === 'confirmacao' && pedido.destrutivo
                  ? 'alert-circle'
                  : 'information'
              }
              size="lg"
              color={
                pedido.tipo === 'confirmacao' && pedido.destrutivo
                  ? colors.danger
                  : colors.primary
              }
            />
            <Text variant="h2" style={{ flex: 1 }}>
              {pedido.titulo}
            </Text>
          </View>

          {/* Rola quando é preciso: a confirmação de eliminar um animal
              explica o que acontece à genealogia e ao histórico, e num
              telemóvel com a letra ampliada isso não cabe num ecrã. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingBottom: spacing.md }}>
            <Text variant="body" color={colors.textSecondary}>
              {pedido.mensagem}
            </Text>
          </ScrollView>

          {pedido.tipo === 'aviso' ? (
            <Button label={t('avisos.entendido')} icon="check" onPress={fechar} />
          ) : (
            // Em coluna, e o confirmar em BAIXO: a ação sem volta é a que
            // exige mais um instante de leitura, e não a que fica debaixo
            // do dedo de quem vinha a tocar sem ler.
            <View style={{ gap: spacing.sm }}>
              <Button label={t('comum.cancelar')} variant="ghost" onPress={fechar} />
              <Button
                label={pedido.rotuloConfirmar}
                icon={pedido.destrutivo ? 'trash-can-outline' : 'check'}
                variant={pedido.destrutivo ? 'danger' : 'primary'}
                onPress={responder}
              />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
