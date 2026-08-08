import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, IconBadge, Text } from '@/components/ui';
import { confirmar } from '@/data/avisos';
import { tipoTerrenoMeta } from '@/data/constants';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import type { Animal, Terreno } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * Mudar o efetivo INTEIRO de um terreno para outro.
 * ------------------------------------------------------------------
 * A app já deixava mudar um animal de cercado — na ficha dele, ou tocando nele
 * em "Associar animais". O que faltava era a operação real: mudar o rebanho de
 * pasto é uma coisa que se faz a todos ao mesmo tempo, num dia, e ficava a
 * trezentos toques de distância. Quem tem 400 cabeças não faz isso na app —
 * deixa de as arrumar, e a partir daí a app deixa de saber onde anda o gado.
 *
 * O que isto NÃO é: uma transferência entre explorações. Só se oferecem os
 * terrenos da mesma exploração — mudar de exploração é uma venda ou uma
 * movimentação, que se comunica ao SNIRA e tem o seu próprio caminho.
 */
export function FolhaMoverAnimais({
  aberto,
  origem,
  destinos,
  animais,
  onFechar,
}: {
  aberto: boolean;
  origem: Terreno;
  /** Os outros terrenos da mesma exploração. */
  destinos: Terreno[];
  /** Os animais que estão neste terreno agora. */
  animais: Animal[];
  onFechar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { updateAnimal } = useGado();
  const toast = useToasts();
  const [aMover, setAMover] = useState(false);

  const total = animais.length;

  function pedirParaMover(destino: Terreno) {
    confirmar(
      'Mudar o gado de terreno?',
      `${total} ${total === 1 ? 'animal passa' : 'animais passam'} de ${origem.nome} para ${destino.nome}.`,
      () => void mover(destino),
      { rotuloConfirmar: 'Mudar' },
    );
  }

  async function mover(destino: Terreno) {
    if (aMover) return;
    setAMover(true);

    /*
     * Um a um, e não em paralelo. É a mesma razão do registo em massa em
     * `evento/novo.tsx`: por trás disto está uma fila de sincronização, e
     * quatrocentos pedidos ao mesmo tempo numa rede de campo são quatrocentas
     * hipóteses de falhar em vez de uma. Os que passam ficam gravados — um erro
     * a meio não desfaz o que já foi feito, e é por isso que a mensagem do fim
     * diz quantos passaram.
     */
    const falhados: string[] = [];
    let movidos = 0;
    for (const a of animais) {
      try {
        await updateAnimal(a.id, { terrenoId: destino.id });
        movidos++;
      } catch (e) {
        falhados.push(a.nome ?? a.numeroIdentificacao ?? 'Sem nome');
        // A razão do primeiro erro chega para explicar; guardar as 400 não.
        if (falhados.length === 1) toast.erro('Não foi possível mudar tudo', mensagemDeErro(e));
      }
    }

    setAMover(false);
    onFechar();

    if (movidos > 0 && falhados.length === 0) {
      toast.sucesso(
        `${movidos} ${movidos === 1 ? 'animal mudado' : 'animais mudados'}`,
        `${origem.nome} → ${destino.nome}`,
      );
    } else if (movidos > 0) {
      toast.erro(
        `Mudaram ${movidos} de ${total}`,
        `Ficaram por mudar: ${falhados.slice(0, 3).join(', ')}${falhados.length > 3 ? '…' : ''}`,
      );
    }
  }

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel="Fechar" />
        <View
          style={[
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              paddingHorizontal: spacing.lg,
              maxHeight: '80%',
            },
            shadow.lg,
          ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text variant="h3" style={{ flex: 1 }}>
              Mudar para que terreno?
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
            {aMover
              ? `A mudar ${total} ${total === 1 ? 'animal' : 'animais'}…`
              : `${total} ${total === 1 ? 'animal sai' : 'animais saem'} de ${origem.nome}.`}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {destinos.map((t, i) => {
              const meta = tipoTerrenoMeta[t.tipo ?? 'Outro'];
              return (
                <Pressable
                  key={t.id}
                  disabled={aMover}
                  onPress={() => pedirParaMover(t)}
                  accessibilityRole="button"
                  accessibilityLabel={t.nome}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      minHeight: 64,
                      borderBottomWidth: i < destinos.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    },
                    (pressed || aMover) && { opacity: 0.6 },
                  ]}>
                  <IconBadge
                    name={meta.icon}
                    color={meta.cor}
                    background={colors.primaryTint}
                    size={44}
                    iconSize={22}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{t.nome}</Text>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                      {t.tipo ?? 'Outro'}
                      {t.area ? ` · ${t.area} ha` : ''}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size="md" color={colors.textMuted} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
