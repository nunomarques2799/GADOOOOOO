import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { useExistencias } from '@/data/useExistencias';
import { useFinancas } from '@/data/useFinancas';
import { VERSAO_APP } from '@/data/versao';
import { idiomaAtual, NOME_DO_IDIOMA, t } from '@/i18n';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, paletaPorId, spacing } from '@/theme';
import { paletaGuardada } from '@/theme/preferencia';

/**
 * Tudo o que se CONFIGURA e tudo o que se EXPORTA.
 *
 * Separado do Perfil de propósito: o Perfil respondia a "quem sou eu" e a
 * "como é que a app funciona" ao mesmo tempo, e a lista tinha crescido ao
 * ponto de as duas coisas se estorvarem — terminar sessão ficava a seguir a
 * exportar CSV. Aqui ficam as opções; lá fica a conta.
 */
export default function DefinicoesScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { configurado } = useAuth();
  const {
    ativas: financasAtivas,
    podeLigarDesligar: podeLigarFinancas,
  } = useFinancas();
  const {
    ativas: existenciasAtivas,
    podeLigarDesligar: podeLigarExistencias,
  } = useExistencias();

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={{ ...coluna, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="display">{t('nav.definicoes')}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {t('definicoes.subtitulo')}
          </Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* O que a app regista */}
          <Grupo titulo={t('definicoes.grupoRegista')}>
            {podeLigarFinancas ? (
              <Linha
                icon="cash-multiple"
                label={t('definicoes.financas')}
                trailing={financasAtivas ? t('comum.ligada') : t('comum.desligada')}
                onPress={() => router.push('/conta/financas')}
              />
            ) : null}
            {podeLigarExistencias ? (
              <Linha
                icon="package-variant-closed"
                label={t('definicoes.existencias')}
                trailing={existenciasAtivas ? t('comum.ligado') : t('comum.desligado')}
                onPress={() => router.push('/conta/existencias')}
              />
            ) : null}
            {/* O "Registo por casa e número" era aqui. Passou a um campo
                "Número" sempre presente na ficha do animal, opcional: um
                interruptor para mostrar um campo de texto que quem não usa
                deixa vazio era uma decisão a pedir por nada. */}
            <Linha
              icon="bell-outline"
              label={t('definicoes.notificacoes')}
              onPress={() => router.push('/conta/notificacoes')}
              last
            />
          </Grupo>

          {/* Como a app se apresenta */}
          <Grupo titulo={t('definicoes.grupoAspeto')}>
            <Linha
              icon="palette-outline"
              label={t('definicoes.cores')}
              trailing={paletaPorId(paletaGuardada()).nome}
              onPress={() => router.push('/conta/aparencia')}
            />
            {/* O idioma vive no ASPETO e não num grupo só dele: é uma escolha
                sobre como a app se apresenta, como as cores, e um grupo com uma
                linha só era um título a mais para ler. */}
            <Linha
              icon="translate"
              label={t('definicoes.idioma')}
              trailing={NOME_DO_IDIOMA[idiomaAtual()]}
              onPress={() => router.push('/conta/idioma')}
              last
            />
          </Grupo>

          {/* Dados e cópias */}
          {configurado ? (
            <Grupo titulo={t('definicoes.grupoDados')}>
              <Linha
                icon="cloud-sync-outline"
                label={t('definicoes.sincronizacao')}
                onPress={() => router.push('/conta/sincronizacao')}
                last
              />
            </Grupo>
          ) : null}

          {/* Sobre */}
          <Grupo titulo={t('definicoes.grupoSobre')}>
            <Linha
              icon="help-circle-outline"
              label={t('definicoes.ajuda')}
              onPress={() => router.push('/conta/ajuda')}
            />
            <Linha
              icon="shield-account-outline"
              label={t('definicoes.privacidade')}
              onPress={() => void Linking.openURL('https://terrabovina.pt/privacidade')}
              last
            />
          </Grupo>

          <Text variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.xs }}>
            {t('definicoes.versao', { v: VERSAO_APP })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View>
      <Text
        variant="label"
        color={colors.textSecondary}
        style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
        {titulo}
      </Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function Linha({
  icon,
  label,
  trailing,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  trailing?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icon} size="md" color={colors.primary} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      {trailing ? (
        <Text variant="caption" color={colors.textMuted}>
          {trailing}
        </Text>
      ) : null}
      <Icon name="chevron-right" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}
