import { Modal, Pressable, ScrollView, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * Quem é quem na Terrabovina, desenhado.
 * ------------------------------------------------------------------
 * A pergunta "o que veio cá fazer?" é a primeira coisa que a app faz a quem
 * cria conta, e é a que decide o caminho todo a seguir: esperar por aprovação,
 * ou pedir um código a alguém. Quem se engana aqui fica à espera de uma
 * aprovação que nunca chega, ou com um código que a conta não aceita.
 *
 * Quatro linhas de descrição, uma por baixo da outra, não chegam para isso: o
 * que falta perceber não é o que cada um FAZ, é quem convida quem. É por isso
 * que isto é um desenho e não mais texto. A árvore mostra as duas portas de
 * entrada da app (a exploração é sua, ou alguém lhe deu um código) e, debaixo
 * de cada uma, quem é que ela deixa entrar.
 *
 * A **Sociedade agrícola** aparece aqui e NÃO aparece na lista de escolhas do
 * registo, e é de propósito: é um plano que se combina connosco e o superadmin
 * é que o marca na conta (ver `supabase/schema_sociedade.sql`). Sem ela
 * desenhada, o "Líder de exploração" falava de uma sociedade que não estava em
 * lado nenhum, e ninguém percebia de onde vinha o código dele. O rótulo por
 * cima da caixa é que evita a procura por uma opção que não existe.
 */
export function ModalPapeis({ visivel, onFechar }: { visivel: boolean; onFechar: () => void }) {
  const desktop = useDesktop();

  return (
    <Modal
      visible={visivel}
      animationType={desktop ? 'fade' : 'slide'}
      transparent
      onRequestClose={onFechar}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: desktop ? 'center' : 'flex-end',
          padding: desktop ? spacing.xl : 0,
        }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onFechar}
          accessibilityLabel={t('comum.fechar')}
        />
        <View
          style={{
            backgroundColor: colors.background,
            // Os quatro cantos um a um: na web o atalho `borderRadius` e o
            // canto específico compilam para classes cuja ordem não é garantida.
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: desktop ? radii.xl : 0,
            borderBottomRightRadius: desktop ? radii.xl : 0,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            maxHeight: desktop ? '100%' : '92%',
            overflow: 'hidden',
            ...(desktop ? shadow.lg : null),
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingTop: desktop ? spacing.lg : spacing.md,
              paddingBottom: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}>
            <Icon name="account-group-outline" size="lg" color={colors.primary} />
            <Text variant="h3" style={{ flex: 1 }}>
              {t('papeis.titulo')}
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
              <Icon name="close" size="md" color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
            <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
              {t('papeis.intro')}
            </Text>

            {/* ---- Porta 1: a exploração é sua ---- */}
            <Etiqueta texto={t('papeis.aprovadoPorNos')} />
            <Caixa
              icone="barn"
              nome={t('intencao.dono')}
              descricao={t('papeis.donoFaz')}
            />
            <Convida>
              <Ramo
                icone="account-hard-hat"
                nome={t('intencao.trabalhador')}
                descricao={t('papeis.trabalhadorFaz')}
              />
              <Ramo
                icone="medical-bag"
                nome={t('intencao.veterinario')}
                descricao={t('papeis.veterinarioFaz')}
                ultimo
              />
            </Convida>

            {/* ---- Porta 2: a exploração é de uma sociedade ---- */}
            <Etiqueta texto={t('papeis.combinadoConnosco')} style={{ marginTop: spacing.xl }} />
            <Caixa
              icone="account-tie"
              nome={t('papeis.sociedade')}
              descricao={t('papeis.sociedadeFaz')}
              nota={t('papeis.naoSeEscolheAqui')}
            />
            <Convida>
              <Ramo
                icone="shield-crown"
                nome={t('intencao.lider')}
                descricao={t('papeis.liderFaz')}
                ultimo>
                {/* O líder também convida: é ele que corre a exploração todos
                    os dias, e a equipa dela é a equipa dele. */}
                <Convida>
                  <Ramo
                    icone="account-hard-hat"
                    nome={t('intencao.trabalhador')}
                    descricao={t('papeis.trabalhadorFaz')}
                  />
                  <Ramo
                    icone="medical-bag"
                    nome={t('intencao.veterinario')}
                    descricao={t('papeis.veterinarioFaz')}
                    ultimo
                  />
                </Convida>
              </Ramo>
            </Convida>

            {/* A frase mais útil do ecrã inteiro para quem está indeciso, e por
                isso fica no fim, onde a vista para. */}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                marginTop: spacing.xl,
                padding: spacing.md,
                borderRadius: radii.md,
                backgroundColor: colors.primaryTint,
              }}>
              <Icon name="lightbulb-on-outline" size="md" color={colors.primaryDark} />
              <Text variant="body" color={colors.primaryDark} style={{ flex: 1 }}>
                {t('papeis.qualEOMeuCaso')}
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** O rótulo por cima de cada caixa: como é que se entra por aquela porta. */
function Etiqueta({ texto, style }: { texto: string; style?: object }) {
  return (
    <Text
      variant="caption"
      color={colors.textMuted}
      style={[{ marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }, style]}>
      {texto}
    </Text>
  );
}

/** Uma das duas raízes da árvore: quem abre a exploração. */
function Caixa({
  icone,
  nome,
  descricao,
  nota,
}: {
  icone: IconName;
  nome: string;
  descricao: string;
  nota?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: colors.surface,
      }}>
      <Icon name={icone} size="lg" color={colors.primaryDark} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{nome}</Text>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: 2 }}>
          {descricao}
        </Text>
        {nota ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            {nota}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** "dá um código a", e por baixo os ramos de quem entra por ele. */
function Convida({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {/* O troço de linha que liga a caixa de cima a esta legenda. */}
        <View style={{ width: LARGURA_LINHA, alignItems: 'center' }}>
          <View style={{ width: 2, height: 14, backgroundColor: colors.primary }} />
        </View>
        <Text variant="caption" color={colors.textMuted}>
          {t('papeis.daUmCodigoA')}
        </Text>
      </View>
      {children}
    </View>
  );
}

/** A largura da coluna onde a linha da árvore corre. */
const LARGURA_LINHA = 24;

/**
 * As linhas da árvore são da cor da marca, e não do `border`.
 *
 * Com o `border` (que é o cinzento das molduras) o desenho ficou legível no
 * texto e invisível nas ligações: viam-se cinco caixas com nomes e não se via
 * quem convidava quem, que é a única coisa que este ecrã existe para mostrar.
 * A linha é o conteúdo aqui, não é arrumação.
 */

/**
 * Um ramo da árvore: a linha em cotovelo, o ícone e o que a pessoa faz.
 *
 * O `ultimo` não é enfeite: sem ele a linha vertical descia até ao fundo da
 * última linha e ficava um traço solto por baixo do último nome, com ar de
 * ramo cortado a meio.
 */
function Ramo({
  icone,
  nome,
  descricao,
  ultimo,
  children,
}: {
  icone: IconName;
  nome: string;
  descricao: string;
  ultimo?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: LARGURA_LINHA }}>
        {/* A vertical: até ao fim nos do meio, até ao cotovelo no último. */}
        <View
          style={{
            position: 'absolute',
            left: LARGURA_LINHA / 2 - 1,
            top: 0,
            width: 2,
            height: ultimo ? ALTURA_COTOVELO : '100%',
            backgroundColor: colors.primary,
          }}
        />
        {/* A horizontal do cotovelo. */}
        <View
          style={{
            position: 'absolute',
            left: LARGURA_LINHA / 2 - 1,
            top: ALTURA_COTOVELO,
            width: LARGURA_LINHA / 2 + 1,
            height: 2,
            backgroundColor: colors.primary,
          }}
        />
      </View>
      <View style={{ flex: 1, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
        {/* `flex-start` e não `center`: com o ícone centrado no bloco inteiro,
            uma descrição de duas linhas empurrava-o para baixo e o cotovelo
            (que é uma altura fixa) ia dar ao vazio ao lado do nome. Encostado
            ao topo, o centro do ícone cai sempre no `ALTURA_COTOVELO`. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Icon name={icone} size="md" color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{nome}</Text>
            <Text variant="secondary" color={colors.textSecondary}>
              {descricao}
            </Text>
          </View>
        </View>
        {children}
      </View>
    </View>
  );
}

/**
 * A que altura o cotovelo encontra o ícone do ramo.
 *
 * É o `paddingTop` do conteúdo mais metade da altura do ícone. Escrito à mão
 * porque não há como medir isto sem esperar pelo desenho, e uma linha que se
 * ajustasse depois de aparecer via-se a saltar.
 */
const ALTURA_COTOVELO = 20;
