import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Header, Icon, type IconName, Text } from '@/components/ui';
import { avisar, confirmar } from '@/data/avisos';
import {
  CATEGORIAS,
  iconeCategoria,
  rotuloCategoria,
  useNotificacoes,
  type Categoria,
} from '@/data/notificacoes';
import { pedirPermissao, suportaNotificacoes, temPermissao } from '@/data/notificacoesLocais';
import { definirSom, somLigado, somSucesso } from '@/data/som';
import { useGado } from '@/data/store';
import { definirVibracao, vibracaoLigada, vibrarSucesso } from '@/data/vibrar';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Escolher o que aparece em "Precisa da sua atenção" e com que antecedência.
 * Alertas vencidos ou urgentes passam sempre — não deixaríamos o utilizador
 * esconder um prazo legal por engano.
 */
export default function NotificacoesScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { preferencias, definirAtiva, definirAntecedencia, repor } = useNotificacoes();

  function pedirReposicao() {
    confirmar(
      t('notif.reporTitulo'),
      t('notif.reporMensagem'),
      repor,
      { rotuloConfirmar: t('notif.repor') },
    );
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('definicoes.notificacoes')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={conteudo}>
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
              <Icon name="information-outline" size="md" color={colors.info} />
              <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                {t('notif.explicacao')}
              </Text>
            </View>
          </Card>

          <AvisoNoTelemovel />

          <VibracaoAoGravar />

          <SomAoGravar />

          {CATEGORIAS.map((c) => (
            <LinhaCategoria
              key={c}
              categoria={c}
              ativa={preferencias.ativa[c]}
              antecedencia={preferencias.antecedenciaDias[c]}
              onAtivaChange={(v) => definirAtiva(c, v)}
              onAntecedenciaChange={(d) => definirAntecedencia(c, d)}
            />
          ))}

          <AvisosDispensados />

          <Button
            label={t('notif.reporRecomendacoes')}
            icon="restart"
            variant="ghost"
            onPress={pedirReposicao}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Interruptor dos avisos no telemóvel. A permissão do sistema é pedida no
 * momento em que o criador liga isto — nunca no arranque da app, onde um
 * diálogo do sistema aparece antes de se perceber o que a app faz e a maior
 * parte das pessoas recusa por reflexo.
 */
function AvisoNoTelemovel() {
  const { preferencias, definirNoTelemovel } = useNotificacoes();
  const [permitido, setPermitido] = useState<boolean | null>(null);

  useEffect(() => {
    if (!suportaNotificacoes) return;
    void temPermissao().then(setPermitido);
  }, []);

  // Na web/Electron não há nada para agendar: a app está aberta à frente do
  // criador e a lista de alertas já faz o trabalho.
  if (!suportaNotificacoes) return null;

  async function alternar(v: boolean) {
    if (!v) {
      definirNoTelemovel(false);
      return;
    }
    const ok = permitido || (await pedirPermissao());
    setPermitido(ok);
    definirNoTelemovel(ok);
    if (!ok) {
      avisar(
        t('notif.autorizacaoRecusada'),
        t('notif.autorizacaoRecusadaTexto'),
      );
    }
  }

  const ligado = preferencias.noTelemovel && permitido !== false;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: ligado ? colors.primaryTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={ligado ? 'bell-ring-outline' : 'bell-off-outline'}
            size="md"
            color={ligado ? colors.primary : colors.textMuted}
          />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {t('notif.avisarNoTelemovel')}
        </Text>
        <Switch
          value={ligado}
          onValueChange={(v) => void alternar(v)}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.white}
          accessibilityLabel={t('notif.avisarNoTelemovel')}
        />
      </View>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
        {ligado
          ? t('notif.avisarLigado')
          : t('notif.avisarDesligado')}
      </Text>
    </Card>
  );
}

/**
 * Vibrar ao gravar.
 *
 * Fica nesta página porque é a mesma pergunta das outras — "como é que a app me
 * avisa" — e não uma questão de aspeto. A preferência é do APARELHO (como a
 * paleta), não da conta: quem trabalha com luvas quer isto ligado no telemóvel
 * dele e não tem nada a dizer sobre o computador da secretária.
 *
 * Ligar dispara uma vibração de propósito: é a única forma de perceber o que se
 * acabou de ligar sem ir gravar alguma coisa para experimentar.
 */
function VibracaoAoGravar() {
  const [ligada, setLigada] = useState(() => vibracaoLigada());

  function alternar(v: boolean) {
    definirVibracao(v);
    setLigada(v);
    if (v) vibrarSucesso();
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: ligada ? colors.primaryTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={ligada ? 'vibrate' : 'vibrate-off'}
            size="md"
            color={ligada ? colors.primary : colors.textMuted}
          />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {t('notif.vibrar')}
        </Text>
        <Switch
          value={ligada}
          onValueChange={alternar}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.white}
          accessibilityLabel={t('notif.vibrar')}
        />
      </View>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
        {ligada
          ? t('notif.vibrarLigado')
          : t('notif.vibrarDesligado')}
      </Text>
    </Card>
  );
}

/**
 * Som ao gravar.
 *
 * Ao lado da vibração porque é a mesma pergunta — "como é que a app me avisa" —
 * e porque os dois se completam: o telemóvel no bolso sente-se, o computador da
 * secretária ouve-se. Também esta preferência é do APARELHO e não da conta.
 *
 * Ligar toca o som de propósito, pela mesma razão que ligar a vibração vibra: é
 * a única forma de saber o que se acabou de ligar sem ir gravar alguma coisa só
 * para experimentar. E é também assim que se percebe que a app instalada ainda
 * não o traz — ver o cabeçalho de `data/som.ts`.
 */
function SomAoGravar() {
  const [ligado, setLigado] = useState(() => somLigado());

  function alternar(v: boolean) {
    definirSom(v);
    setLigado(v);
    if (v) somSucesso();
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: ligado ? colors.primaryTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={ligado ? 'volume-high' : 'volume-off'}
            size="md"
            color={ligado ? colors.primary : colors.textMuted}
          />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {t('notif.som')}
        </Text>
        <Switch
          value={ligado}
          onValueChange={alternar}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.white}
          accessibilityLabel={t('notif.som')}
        />
      </View>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
        {ligado
          ? t('notif.somLigado')
          : t('notif.somDesligado')}
      </Text>
    </Card>
  );
}

/**
 * Avisos que o criador calou no ecrã de alertas. Sem uma forma de voltar
 * atrás, dispensar seria irreversível — e um toque enganado no botão de calar
 * faria desaparecer o aviso para sempre, sem sítio nenhum onde o procurar.
 */
function AvisosDispensados() {
  const { alertasDispensados, reativarAlerta } = useGado();

  if (alertasDispensados.length === 0) return null;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="bell-off-outline" size="md" color={colors.textSecondary} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {t('notif.dispensados')}
        </Text>
        <Text variant="secondary" color={colors.textMuted}>
          {alertasDispensados.length}
        </Text>
      </View>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
        {t('notif.dispensadosAjuda')}
      </Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        {alertasDispensados.map((a) => (
          <View
            key={a.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="secondary" style={{ flex: 1 }} numberOfLines={2}>
              {a.descricao}
            </Text>
            <Button
              label={t('notif.repor')}
              variant="ghost"
              fullWidth={false}
              onPress={() => reativarAlerta(a.id)}
            />
          </View>
        ))}
      </View>
    </Card>
  );
}

function LinhaCategoria({
  categoria,
  ativa,
  antecedencia,
  onAtivaChange,
  onAntecedenciaChange,
}: {
  categoria: Categoria;
  ativa: boolean;
  antecedencia: number;
  onAtivaChange: (v: boolean) => void;
  onAntecedenciaChange: (d: number) => void;
}) {
  const menos = () => onAntecedenciaChange(Math.max(1, antecedencia - 1));
  const mais = () => onAntecedenciaChange(Math.min(90, antecedencia + 1));

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: ativa ? colors.primaryTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={iconeCategoria[categoria] as IconName}
            size="md"
            color={ativa ? colors.primary : colors.textMuted}
          />
        </View>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {rotuloCategoria[categoria]}
        </Text>
        <Switch
          value={ativa}
          onValueChange={onAtivaChange}
          trackColor={{ true: colors.primary, false: colors.borderStrong }}
          thumbColor={colors.white}
          accessibilityLabel={`Notificações de ${rotuloCategoria[categoria]}`}
        />
      </View>

      {/* O seletor de antecedência só aparece com a categoria ligada — sem
          isso é escolher um número que não vai a lado nenhum. */}
      {ativa ? (
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Text variant="secondary" color={colors.textSecondary}>
            {t('notif.comecarAAvisar')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <BotaoRedondo icone="minus" onPress={menos} rotulo={t('notif.menosDias')} />
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.xs,
                borderRadius: radii.md,
                backgroundColor: colors.surfaceAlt,
              }}>
              <Text variant="h2">{antecedencia}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {antecedencia === 1 ? 'dia antes' : 'dias antes'}
              </Text>
            </View>
            <BotaoRedondo icone="plus" onPress={mais} rotulo={t('notif.maisDias')} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function BotaoRedondo({
  icone,
  onPress,
  rotulo,
}: {
  icone: IconName;
  onPress: () => void;
  rotulo: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: colors.borderStrong,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icone} size="md" color={colors.primary} />
    </Pressable>
  );
}
