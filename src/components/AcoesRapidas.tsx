import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickAction } from '@/components/QuickAction';
import { Folha, Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { useFinancas } from '@/data/useFinancas';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * As ações rápidas — o que se regista sem ter de procurar o ecrã.
 * ------------------------------------------------------------------
 * A lista vive aqui, e não no Início, porque tem agora DOIS sítios a mostrá-la:
 * a grelha do Início e a folha do botão "+" no meio da barra de baixo. Enquanto
 * estava escrita no ecrã do Início, acrescentar uma ação ao "+" era copiá-la —
 * e duas listas que se copiam separam-se no primeiro dia em que uma muda.
 *
 * As permissões decidem quem vê o quê, como em todo o lado: quem não pode
 * marcar eventos não vê "Marcar evento", e um botão que o servidor iria recusar
 * é pior do que botão nenhum.
 */

export type AcaoRapida = {
  chave: string;
  icon: IconName;
  label: string;
  /** Frase curta a dizer o que é. Só a folha do "+" a mostra — na grelha do
   *  Início não há largura para ela, e lá o ícone e o rótulo chegam. */
  descricao: string;
  cor: string;
  tinta: string;
  rota: Href;
};

/**
 * O que esta pessoa pode registar, aqui e agora.
 *
 * As cores são lidas DENTRO do hook (e não numa tabela no topo do módulo)
 * porque seguem a paleta que o criador escolheu — uma constante de módulo
 * congelava o verde de origem numa app azul (ver `theme/tokens.ts`).
 */
export function useAcoesRapidas(): AcaoRapida[] {
  const { podeEmAlguma, contaSuspensa } = useMembros();
  const { podeRegistarDespesa } = useFinancas();

  const podeMarcarEventos = podeEmAlguma('marcarEventos');
  const podeRegistarAnimais = !contaSuspensa && podeEmAlguma('editarAnimais');
  const podeTratar = podeEmAlguma('registarTratamentos');

  return useMemo(() => {
    const lista: AcaoRapida[] = [];

    // A ordem e as cores são as do guia de estilo: o animal novo à cabeça (é a
    // ação da casa, e vai cheia da cor da marca na folha do Registar), depois
    // o que se faz a um animal, depois o que se marca e o que se paga. Cada
    // cor é a do significado: ocre para a reprodução, verde-azulado para a
    // saúde, terracota para o dinheiro que sai.
    if (podeRegistarAnimais) {
      lista.push({
        chave: 'animal',
        // O brinco, e não um "+": o "+" é o que TODAS as ações fazem (todas
        // acrescentam alguma coisa), por isso não distinguia esta de nenhuma
        // outra. O brinco é também o ícone dos Animais na barra de baixo.
        icon: 'tag-outline',
        label: t('acao.animal'),
        descricao: t('acao.animalDesc'),
        cor: colors.primary,
        tinta: colors.primaryTint,
        rota: '/animal/novo',
      });
    }

    if (podeTratar) {
      lista.push(
        {
          chave: 'parto',
          icon: 'heart-outline',
          label: t('acao.parto'),
          descricao: t('acao.partoDesc'),
          cor: colors.warning,
          tinta: colors.warningTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Parto' } },
        },
        // A vacinação é o registo que mais vezes se faz a um lote inteiro — a
        // campanha da língua azul num dia, o cercado todo.
        {
          chave: 'vacinacao',
          icon: 'needle',
          label: t('acao.vacinacao'),
          descricao: t('acao.vacinacaoDesc'),
          cor: colors.saude,
          tinta: colors.saudeTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Vacinação' } },
        },
        {
          chave: 'medicamento',
          icon: 'pill',
          label: t('acao.medicamento'),
          descricao: t('acao.medicamentoDesc'),
          cor: colors.saude,
          tinta: colors.saudeTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Medicamento' } },
        },
        {
          chave: 'cobricao',
          // O guia desenha duas alianças; a biblioteca de ícones só tem um anel
          // de noivado, que não diz nada sobre gado. O ♀♂ diz.
          icon: 'gender-male-female',
          label: t('acao.cobricao'),
          descricao: t('acao.cobricaoDesc'),
          cor: colors.warning,
          tinta: colors.warningTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Cobrição' } },
        },
        {
          chave: 'pesagem',
          icon: 'scale',
          label: t('acao.pesagem'),
          descricao: t('acao.pesagemDesc'),
          cor: colors.primaryDark,
          tinta: colors.primaryTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Pesagem' } },
        },
      );
    }

    // Marcar um evento é o que se faz assim que se combina alguma coisa ao
    // telefone, e é a única ação rápida que não precisa de ter um animal à
    // frente.
    if (podeMarcarEventos) {
      lista.push({
        chave: 'evento',
        icon: 'calendar-plus',
        label: t('acao.evento'),
        descricao: t('acao.eventoDesc'),
        cor: colors.primaryDark,
        tinta: colors.primaryTint,
        rota: '/agenda/novo',
      });
    }

    // A despesa é o registo mais frequente de todos — a ração, o gasóleo, a
    // fatura da luz — e é a única coisa financeira que o trabalhador faz.
    if (podeRegistarDespesa) {
      lista.push({
        chave: 'despesa',
        icon: 'currency-eur',
        label: t('acao.despesa'),
        descricao: t('acao.despesaDesc'),
        cor: colors.danger,
        tinta: colors.dangerTint,
        rota: '/movimento/novo',
      });
    }

    return lista;
  }, [podeMarcarEventos, podeRegistarAnimais, podeTratar, podeRegistarDespesa]);
}

/** A grelha de dois por linha do Início. */
export function GrelhaAcoesRapidas() {
  const router = useRouter();
  const acoes = useAcoesRapidas();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {acoes.map((a) => (
        <QuickAction
          key={a.chave}
          icon={a.icon}
          label={a.label}
          color={a.cor}
          tint={a.tinta}
          onPress={() => router.push(a.rota)}
        />
      ))}
    </View>
  );
}

/**
 * A folha do botão "+" da barra de baixo.
 *
 * Em grelha de dois cartões por linha, como no guia de estilo: cada um com o
 * ícone na cor do significado, o nome e a frase que o explica (é ela que evita
 * a dúvida entre "Vacinação" e "Medicamento" a quem abre isto pela primeira
 * vez). O primeiro, o animal novo, vai cheio da cor da marca. Alvos grandes:
 * usa-se com o polegar, de pé no campo.
 *
 * Num ecrã estreito (ou com a letra do sistema no máximo) dois cartões lado a
 * lado partiam "Medicamento" a meio; aí passa a um por linha.
 */
export function FolhaAcoesRapidas({
  aberto,
  onFechar,
}: {
  aberto: boolean;
  onFechar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const acoes = useAcoesRapidas();
  const { width, fontScale } = useWindowDimensions();
  // A largura útil (sem as margens da folha), a dividir pela letra ampliada.
  const duasColunas = (Math.min(width, 560) - spacing.lg * 2) / Math.max(1, fontScale) >= 320;

  return (
    <Folha
      visivel={aberto}
      onFechar={onFechar}
      estilo={[
        {
          backgroundColor: colors.background,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
          paddingTop: spacing.sm,
          paddingHorizontal: spacing.lg,
          // 90% e não 80%: num iPhone mais pequeno (ou com a letra grande) as
          // oito ações não cabiam em 80% e a última aparecia cortada a meio.
          maxHeight: '90%',
        },
        shadow.lg,
      ]}>
      {/* A pega: diz que isto é uma folha por cima do ecrã, que desce. */}
      <View
        style={{
          alignSelf: 'center',
          width: 48,
          height: 5,
          borderRadius: radii.pill,
          backgroundColor: colors.borderStrong,
          marginBottom: spacing.md,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="display">{t('nav.registar')}</Text>
          <Text variant="bodyLg" color={colors.textSecondary}>
            {t('registar.pergunta')}
          </Text>
        </View>
        <Pressable
          onPress={onFechar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('comum.fechar')}
          style={({ pressed }) => [
            {
              width: 52,
              height: 52,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            },
            pressed && { opacity: 0.7 },
          ]}>
          <Icon name="close" size="lg" color={colors.text} />
        </Pressable>
      </View>

      {acoes.length === 0 ? (
        <Text
          variant="body"
          color={colors.textSecondary}
          style={{ paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.md }}>
          {t('acao.semPermissao')}
        </Text>
      ) : (
        // A margem de baixo (a da barra do iPhone) vive DENTRO da lista, e não
        // na folha: quando as ações não cabem, a lista rola por cima dela, em
        // vez de a última linha ficar cortada com um vazio parado por baixo.
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            paddingBottom: insets.bottom + spacing.md,
          }}>
          {acoes.map((a, i) => {
            const cheio = i === 0 && a.chave === 'animal';
            return (
              <Pressable
                key={a.chave}
                onPress={() => {
                  onFechar();
                  router.push(a.rota);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${a.label}. ${a.descricao}`}
                style={({ pressed }) => [
                  {
                    // Duas por linha: metade, menos metade do intervalo.
                    flexBasis: duasColunas ? '48%' : '100%',
                    flexGrow: 1,
                    minHeight: duasColunas ? 156 : 0,
                    padding: spacing.md,
                    gap: spacing.sm,
                    borderRadius: radii.lg,
                    borderWidth: 1,
                    borderColor: cheio ? colors.primary : colors.border,
                    backgroundColor: cheio ? colors.primary : colors.surface,
                    flexDirection: duasColunas ? 'column' : 'row',
                    alignItems: duasColunas ? 'flex-start' : 'center',
                  },
                  pressed && { opacity: 0.8 },
                ]}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radii.md,
                    backgroundColor: cheio ? 'rgba(255,255,255,0.14)' : a.tinta,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name={a.icon} size="md" color={cheio ? colors.onPrimary : a.cor} />
                </View>
                <View style={{ flex: duasColunas ? undefined : 1, gap: 2 }}>
                  <Text variant="h3" color={cheio ? colors.onPrimary : colors.text}>
                    {a.label}
                  </Text>
                  <Text variant="secondary" color={cheio ? colors.textOnDarkMuted : colors.textSecondary}>
                    {a.descricao}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Folha>
  );
}
