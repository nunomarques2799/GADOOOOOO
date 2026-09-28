import { Pressable, View } from 'react-native';

import { useDestinos, type Destino } from '@/components/destinosNavegacao';
import { Button, Card, Header, Icon, type IconName, Screen, Text } from '@/components/ui';
import {
  ATALHOS_OMISSAO,
  ATALHOS_OMISSAO_SUPERVISOR,
  atalhosDaBarra,
  definirAtalhos,
  reporAtalhos,
  useAtalhosEscolhidos,
} from '@/data/barraAtalhos';
import { useMembros } from '@/data/membros';
import { useToasts } from '@/data/toasts';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * Escolher os dois atalhos da barra de baixo (ver `barraAtalhos.ts`).
 *
 * Duas listas, uma por lugar, em vez de "escolha dois de uma lista": o lugar
 * importa (o da esquerda fica mais à mão para quem segura o telemóvel com a
 * direita), e uma escolha por lista é um toque por decisão, sem ter de
 * desmarcar nada primeiro. Escolher de um lado o que está do outro troca-os.
 */
export default function BarraScreen() {
  const destinos = useDestinos();
  const { isSupervisorEmAlguma } = useMembros();
  const escolha = useAtalhosEscolhidos();
  const toast = useToasts();

  const [esquerda, direita] = atalhosDaBarra(
    escolha,
    destinos.map((d) => d.nome),
    isSupervisorEmAlguma ? ATALHOS_OMISSAO_SUPERVISOR : ATALHOS_OMISSAO,
  );
  // O Início está sempre na barra: não é uma opção.
  const opcoes = destinos.filter((d) => d.nome !== 'index');
  const porNome = (n?: string) => destinos.find((d) => d.nome === n);

  function escolher(lado: 'esquerda' | 'direita', nome: string) {
    const atual = lado === 'esquerda' ? esquerda : direita;
    if (!esquerda || !direita || nome === atual) return;
    const [e, d] =
      lado === 'esquerda'
        ? [nome, nome === direita ? esquerda : direita]
        : [nome === esquerda ? direita : esquerda, nome];
    definirAtalhos([e, d]);
    toast.sucesso(t('barra.guardado'));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('barra.titulo')} />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {t('barra.explicacao')}
        </Text>

        <Previa esquerda={porNome(esquerda)} direita={porNome(direita)} />

        <Lista
          titulo={t('barra.esquerda')}
          opcoes={opcoes}
          escolhida={esquerda}
          onEscolher={(n) => escolher('esquerda', n)}
        />
        <Lista
          titulo={t('barra.direita')}
          opcoes={opcoes}
          escolhida={direita}
          onEscolher={(n) => escolher('direita', n)}
        />

        {escolha ? (
          <Button
            label={t('barra.repor')}
            variant="ghost"
            icon="restore"
            onPress={() => {
              reporAtalhos();
              toast.sucesso(t('barra.reposta'));
            }}
          />
        ) : null}

        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {t('barra.aparelho')}
        </Text>
      </Screen>
    </View>
  );
}

/** A barra como vai ficar, desenhada em pequeno por cima das escolhas. */
function Previa({ esquerda, direita }: { esquerda?: Destino; direita?: Destino }) {
  const lugar = (icon: IconName, label: string, fixo: boolean) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Icon name={icon} size={24} color={fixo ? colors.textMuted : colors.primary} />
      <Text
        variant="caption"
        color={fixo ? colors.textMuted : colors.primaryDark}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  return (
    <Card
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.xs,
      }}>
      {lugar('home-variant', t('nav.inicio'), true)}
      {esquerda ? lugar(esquerda.icon, t(esquerda.curto ?? esquerda.chave), false) : null}
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="plus" size={24} color={colors.onPrimary} />
        </View>
      </View>
      {direita ? lugar(direita.icon, t(direita.curto ?? direita.chave), false) : null}
      {lugar('dots-horizontal', t('nav.mais'), true)}
    </Card>
  );
}

function Lista({
  titulo,
  opcoes,
  escolhida,
  onEscolher,
}: {
  titulo: string;
  opcoes: Destino[];
  escolhida?: string;
  onEscolher: (nome: string) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        variant="label"
        color={colors.textSecondary}
        style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
        {titulo}
      </Text>
      <Card padded={false}>
        {opcoes.map((d, i) => {
          const sel = d.nome === escolhida;
          return (
            <Pressable
              key={d.nome}
              onPress={() => onEscolher(d.nome)}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={t(d.chave)}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  minHeight: 56,
                  paddingHorizontal: spacing.md,
                  borderBottomWidth: i < opcoes.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                },
                pressed && { opacity: 0.6 },
              ]}>
              <Icon name={d.icon} size="md" color={sel ? colors.primary : colors.textSecondary} />
              <Text
                variant={sel ? 'bodyStrong' : 'body'}
                color={sel ? colors.primaryDark : colors.text}
                style={{ flex: 1 }}>
                {t(d.chave)}
              </Text>
              <Icon
                name={sel ? 'radiobox-marked' : 'radiobox-blank'}
                size="md"
                color={sel ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}
