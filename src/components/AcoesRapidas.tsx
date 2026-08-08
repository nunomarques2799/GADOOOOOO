import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuickAction } from '@/components/QuickAction';
import { Icon, type IconName, Text } from '@/components/ui';
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

    // Em primeiro, e não no fim: marcar um evento é o que se faz assim que se
    // combina alguma coisa ao telefone, e é a única ação rápida que não precisa
    // de ter um animal à frente.
    if (podeMarcarEventos) {
      lista.push({
        chave: 'evento',
        icon: 'calendar-plus',
        label: t('acao.evento'),
        descricao: t('acao.eventoDesc'),
        cor: colors.primary,
        tinta: colors.primaryTint,
        rota: '/agenda/novo',
      });
    }

    if (podeRegistarAnimais) {
      lista.push({
        chave: 'animal',
        // A cara do animal, e não um "+": o "+" é o que TODAS as ações fazem
        // (todas acrescentam alguma coisa), por isso não distinguia esta de
        // nenhuma outra — e num painel de seis atalhos o ícone é a única coisa
        // que se lê de relance.
        icon: 'cow',
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
          icon: 'baby-bottle-outline',
          label: t('acao.parto'),
          descricao: t('acao.partoDesc'),
          cor: colors.info,
          tinta: colors.infoTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Parto' } },
        },
        // A vacinação é o registo que mais vezes se faz a um lote inteiro — a
        // campanha da língua azul num dia, o cercado todo.
        {
          chave: 'vacinacao',
          icon: 'needle',
          label: t('acao.vacinacao'),
          descricao: t('acao.vacinacaoDesc'),
          cor: colors.primary,
          tinta: colors.primaryTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Vacinação' } },
        },
        {
          chave: 'medicamento',
          icon: 'medical-bag',
          label: t('acao.medicamento'),
          descricao: t('acao.medicamentoDesc'),
          cor: colors.danger,
          tinta: colors.dangerTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Medicamento' } },
        },
        {
          chave: 'cobricao',
          icon: 'gender-male-female',
          label: t('acao.cobricao'),
          descricao: t('acao.cobricaoDesc'),
          cor: colors.primaryDark,
          tinta: colors.primaryTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Cobrição' } },
        },
        {
          chave: 'pesagem',
          icon: 'scale',
          label: t('acao.pesagem'),
          descricao: t('acao.pesagemDesc'),
          cor: colors.warning,
          tinta: colors.warningTint,
          rota: { pathname: '/evento/novo', params: { tipo: 'Pesagem' } },
        },
      );
    }

    // A despesa é o registo mais frequente de todos — a ração, o gasóleo, a
    // fatura da luz — e é a única coisa financeira que o trabalhador faz.
    if (podeRegistarDespesa) {
      lista.push({
        chave: 'despesa',
        icon: 'cash-minus',
        label: t('acao.despesa'),
        descricao: t('acao.despesaDesc'),
        cor: colors.success,
        tinta: colors.successTint,
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
 * Em lista e não em grelha: aqui há largura para a frase que explica cada ação,
 * e é ela que evita a dúvida entre "Vacinação" e "Medicamento" a quem abre isto
 * pela primeira vez. Alvos de 64px — usa-se com o polegar, de pé no campo.
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

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel={t('comum.fechar')} />
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text variant="h3" style={{ flex: 1 }}>
              {t('nav.registar')}
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          {acoes.length === 0 ? (
            <Text variant="body" color={colors.textSecondary} style={{ paddingVertical: spacing.md }}>
              {t('acao.semPermissao')}
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {acoes.map((a, i) => (
                <Pressable
                  key={a.chave}
                  onPress={() => {
                    onFechar();
                    router.push(a.rota);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      minHeight: 64,
                      borderBottomWidth: i < acoes.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: radii.md,
                      backgroundColor: a.tinta,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name={a.icon} size="md" color={a.cor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{a.label}</Text>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
                      {a.descricao}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size="md" color={colors.textMuted} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
