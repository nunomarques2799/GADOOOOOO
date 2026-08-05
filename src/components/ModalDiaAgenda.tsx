import { useMemo, useRef } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertItem } from '@/components/AlertItem';
import { Badge, Button, Card, Icon, Text } from '@/components/ui';
import { diaVizinho, rotuloDoDia, type EventoAgenda } from '@/data/agenda';
import { MESES } from '@/data/calendario';
import type { Alerta } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * O que há num dia — eventos marcados e prazos a vencer.
 * ------------------------------------------------------------------
 * Abre ao tocar num dia do calendário. Anda para o dia seguinte e para o
 * anterior de duas maneiras, porque são dois gestos diferentes e cada um é o
 * natural no seu sítio:
 *
 *   - as SETAS, que existem sempre. São o único caminho no computador (não há
 *     dedo para arrastar) e para quem usa leitor de ecrã.
 *   - o ARRASTAR para o lado, no telemóvel. É o gesto que já se faz em todos os
 *     calendários e ninguém precisa de o descobrir.
 *
 * O dia vazio ABRE na mesma, e é de propósito: com as setas chega-se lá de
 * qualquer maneira, e um modal que se fecha sozinho ao passar por um dia sem
 * nada era um modal que fugia enquanto se procurava.
 */
export function ModalDiaAgenda({
  dia,
  eventos,
  alertas,
  aberto,
  podeMarcar,
  onFechar,
  onMudarDia,
  onEditar,
  onNovo,
}: {
  /** O dia que está aberto, em ISO curto (`aaaa-mm-dd`). */
  dia: string;
  /** Os eventos DESTE dia, já ordenados por hora. */
  eventos: EventoAgenda[];
  /** Os prazos que caem NESTE dia. */
  alertas: Alerta[];
  aberto: boolean;
  /** Mostrar o botão de marcar um evento neste dia. */
  podeMarcar: boolean;
  onFechar: () => void;
  onMudarDia: (dia: string) => void;
  onEditar: (evento: EventoAgenda) => void;
  onNovo: (dia: string) => void;
}) {
  const insets = useSafeAreaInsets();

  /**
   * O dia vive no componente de cima, mas o gesto precisa do valor mais recente
   * sem se voltar a criar. Um `PanResponder` novo a cada render perdia o
   * arrastar a meio (o React trocava-lhe o `onMoveShouldSetPanResponder` por
   * baixo), e um preso ao primeiro render andava sempre a partir do mesmo dia.
   */
  const diaRef = useRef(dia);
  diaRef.current = dia;
  const mudarRef = useRef(onMudarDia);
  mudarRef.current = onMudarDia;

  const gestos = useMemo(
    () =>
      PanResponder.create({
        // Só assume o gesto quando ele é claramente HORIZONTAL e já andou o
        // suficiente: sem as duas condições, o arrastar roubava o scroll
        // vertical da lista de eventos, que é o gesto mais usado aqui dentro.
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -50) mudarRef.current(diaVizinho(diaRef.current, 1));
          else if (g.dx >= 50) mudarRef.current(diaVizinho(diaRef.current, -1));
        },
      }),
    [],
  );

  const titulo = tituloDoDia(dia);
  const nada = eventos.length === 0 && alertas.length === 0;

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
              paddingTop: spacing.sm,
              maxHeight: '85%',
            },
            shadow.lg,
          ]}
          {...gestos.panHandlers}>
          {/* Pega — diz que a folha se arrasta, antes de alguém tentar. */}
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: radii.pill,
              backgroundColor: colors.borderStrong,
              marginBottom: spacing.sm,
            }}
          />

          {/* Cabeçalho: dia anterior · o dia · dia seguinte */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
            }}>
            <Seta
              icon="chevron-left"
              label="Dia anterior"
              onPress={() => onMudarDia(diaVizinho(dia, -1))}
            />
            <View style={{ flex: 1 }}>
              <Text variant="h3" center numberOfLines={2}>
                {titulo}
              </Text>
              {!nada ? (
                <Text variant="caption" color={colors.textMuted} center>
                  {resumo(eventos.length, alertas.length)}
                </Text>
              ) : null}
            </View>
            <Seta
              icon="chevron-right"
              label="Dia seguinte"
              onPress={() => onMudarDia(diaVizinho(dia, 1))}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
            }}>
            {nada ? (
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="calendar-blank-outline" size="lg" color={colors.textMuted} />
                  <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
                    Nada marcado para este dia.
                  </Text>
                </View>
              </Card>
            ) : null}

            {eventos.length > 0 ? (
              <Card padded={false} style={{ marginBottom: spacing.md }}>
                <View style={{ paddingHorizontal: spacing.md }}>
                  {eventos.map((e, i) => (
                    <LinhaEvento
                      key={e.id}
                      evento={e}
                      divider={i < eventos.length - 1}
                      onPress={() => onEditar(e)}
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {alertas.length > 0 ? (
              <>
                <Text
                  variant="label"
                  color={colors.textSecondary}
                  style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
                  PRAZOS DESTE DIA
                </Text>
                <Card padded={false} style={{ marginBottom: spacing.md }}>
                  <View style={{ paddingHorizontal: spacing.md }}>
                    {alertas.map((a, i) => (
                      <AlertItem key={a.id} alerta={a} divider={i < alertas.length - 1} />
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {podeMarcar ? (
              <Button
                label="Marcar evento neste dia"
                icon="calendar-plus"
                variant="secondary"
                onPress={() => onNovo(dia)}
              />
            ) : null}

            {/* Diz-se aqui e não num tutorial: quem abre isto pela primeira vez
                não adivinha que a folha anda de lado. */}
            <Text
              variant="caption"
              color={colors.textMuted}
              center
              style={{ marginTop: spacing.md }}>
              Arraste para o lado, ou use as setas, para ver os outros dias.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** "Hoje, 3 de agosto" ou "12 de setembro de 2026". */
function tituloDoDia(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  const relativo = rotuloDoDia(dia);
  const anoAtual = new Date().getFullYear();
  // O ano só aparece quando não é o corrente: "3 de agosto de 2026" para um dia
  // desta semana é ruído no meio do título.
  const porExtenso = `${d} de ${MESES[mes - 1]}${ano === anoAtual ? '' : ` de ${ano}`}`;
  return relativo ? `${relativo}, ${porExtenso}` : porExtenso;
}

function resumo(eventos: number, alertas: number): string {
  const partes: string[] = [];
  if (eventos > 0) partes.push(`${eventos} ${eventos === 1 ? 'evento' : 'eventos'}`);
  if (alertas > 0) partes.push(`${alertas} ${alertas === 1 ? 'prazo' : 'prazos'}`);
  return partes.join(' · ');
}

function LinhaEvento({
  evento,
  divider,
  onPress,
}: {
  evento: EventoAgenda;
  divider: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${evento.titulo}${evento.hora ? `, às ${evento.hora}` : ', todo o dia'}`}
      accessibilityHint="Toque para ver ou alterar"
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      {/* A hora à esquerda, em coluna fixa: é por ela que se lê um dia de
          relance, e alinhada faz-se a leitura de cima a baixo sem procurar. */}
      <View style={{ width: 56, alignItems: 'center' }}>
        {evento.hora ? (
          <Text variant="bodyStrong" color={colors.primaryDark}>
            {evento.hora}
          </Text>
        ) : (
          <Icon name="calendar-today" size="md" color={colors.textMuted} />
        )}
        {!evento.hora ? (
          <Text variant="caption" color={colors.textMuted}>
            dia
          </Text>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {evento.titulo}
        </Text>
        {evento.descricao ? (
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={2}>
            {evento.descricao}
          </Text>
        ) : null}
        {/* Só o privado se marca. O público é o normal, e uma etiqueta em cada
            linha a dizer "público" não distinguia nada de nada. */}
        {!evento.publico ? (
          <Badge tone="neutral" icon="lock-outline" label="Só eu vejo" style={{ marginTop: 4 }} />
        ) : null}
      </View>
      <Icon name="chevron-right" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}

function Seta({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="lg" color={colors.primaryDark} />
    </Pressable>
  );
}
