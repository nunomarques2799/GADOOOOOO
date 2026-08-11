import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AlertItem } from '@/components/AlertItem';
import { CalendarioAlertas } from '@/components/CalendarioAlertas';
import { CartaoIntroducao } from '@/components/CartaoIntroducao';
import { SeletorExploracao } from '@/components/SeletorExploracao';
import { Card, EmptyState, Icon, type IconName, Screen, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { colors, radii, spacing } from '@/theme';

type Vista = 'lista' | 'calendario';

/**
 * Quantos avisos de cada grupo se desenham à primeira.
 *
 * Este ecrã vivia dentro de um ScrollView normal e desenhava TODOS os avisos de
 * uma vez: num efetivo grande são milhares de linhas montadas antes de o
 * separador aparecer, e o toque no "Alertas" ficava um par de segundos sem
 * resposta nenhuma. Com um teto por grupo o ecrã abre sempre no mesmo tempo,
 * seja qual for o tamanho do efetivo, e quem precisa de ver o resto carrega em
 * "Ver mais" — que é o gesto de quem já decidiu percorrer a lista toda.
 */
const MOSTRA_INICIAL = 15;

/** Quantos mais se acrescentam de cada vez. */
const MOSTRA_PASSO = 25;

export default function AlertasScreen() {
  const { alertas, exploracoes, dispensarAlerta } = useGado();
  const { controlo: controloAtualizar } = useAtualizarPuxando();
  const [vista, setVista] = useState<Vista>('lista');
  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);
  /** Grupos que o criador fechou (tocando no cabeçalho). */
  const [fechados, setFechados] = useState<Partial<Record<AlertaGravidade, boolean>>>({});
  /** Quantos de cada grupo estão à vista. */
  const [limites, setLimites] = useState<Partial<Record<AlertaGravidade, number>>>({});

  // Os grupos vivem aqui dentro (e não no topo do módulo) para lerem as cores
  // e os textos no render — ver `theme/paletas.ts` e `i18n/`.
  const grupos: { chave: AlertaGravidade; titulo: string; cor: string }[] = [
    { chave: 'urgente', titulo: t('alertas.urgente'), cor: colors.danger },
    { chave: 'aviso', titulo: t('alertas.estaSemana'), cor: colors.warning },
    { chave: 'info', titulo: t('alertas.aAcompanhar'), cor: colors.info },
  ];

  // Só vale a pena escolher exploração quando há mais do que uma. Com uma só,
  // o filtro seria um botão que não muda nada.
  const podeFiltrar = exploracoes.length > 1;

  const visiveis = useMemo(
    () => (exploracaoId ? alertas.filter((a) => a.exploracaoId === exploracaoId) : alertas),
    [alertas, exploracaoId],
  );

  // Separados de uma vez só, em vez de um `.filter()` por grupo dentro do
  // render: com milhares de avisos eram três voltas à lista a cada toque num
  // cabeçalho.
  const porGravidade = useMemo(() => {
    const m: Record<AlertaGravidade, Alerta[]> = { urgente: [], aviso: [], info: [] };
    for (const a of visiveis) m[a.gravidade].push(a);
    return m;
  }, [visiveis]);

  const nomeExploracao = exploracoes.find((e) => e.id === exploracaoId)?.nome;

  function alternarGrupo(chave: AlertaGravidade) {
    setFechados((f) => ({ ...f, [chave]: !f[chave] }));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen topInset refreshControl={controloAtualizar}>
        {/* Título como o dos outros separadores (grande e à esquerda), e não o
            `<Header>` dos ecrãs de detalhe que aqui esteve: num separador não
            há para onde o botão de voltar levar. */}
        <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
          <Text variant="display">{t('nav.alertas')}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {t('alertas.subtitulo')}
          </Text>
        </View>

        {/* À primeira vez, o que é este separador. O nome diz o assunto e não
            diz o trabalho: ninguém adivinha que os prazos são contados pela app
            a partir das datas dos animais, nem que alguns se podem calar. */}
        <View style={{ marginBottom: spacing.md }}>
          <CartaoIntroducao
            chave="alertas"
            icon="bell-ring-outline"
            titulo={t('alertas.introTitulo')}
            pontos={[
              t('alertas.intro1'),
              t('alertas.intro2'),
              t('alertas.intro3'),
              t('alertas.intro4'),
            ]}
          />
        </View>

        {/* Lista ou calendário */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            padding: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.surfaceSunken,
            marginBottom: spacing.md,
          }}>
          <Separador
            label={t('alertas.lista')}
            icon="format-list-bulleted"
            ativo={vista === 'lista'}
            onPress={() => setVista('lista')}
          />
          <Separador
            label={t('alertas.calendario')}
            icon="calendar-month-outline"
            ativo={vista === 'calendario'}
            onPress={() => setVista('calendario')}
          />
        </View>

        {/* Por exploração */}
        {podeFiltrar ? (
          <SeletorExploracao
            exploracoes={exploracoes}
            valor={exploracaoId}
            onEscolher={setExploracaoId}
            style={{ marginBottom: spacing.md }}
          />
        ) : null}

        {visiveis.length === 0 ? (
          <EmptyState
            icon="check-circle-outline"
            title={t('alertas.tudoEmDiaTitulo')}
            message={
              nomeExploracao
                ? t('alertas.tudoEmDiaNaExploracao', { nome: nomeExploracao })
                : t('alertas.tudoEmDiaMensagem')
            }
          />
        ) : vista === 'calendario' ? (
          <CalendarioAlertas alertas={visiveis} onDispensar={dispensarAlerta} />
        ) : (
          grupos.map((g) => {
            const doGrupo = porGravidade[g.chave];
            if (doGrupo.length === 0) return null;

            const fechado = !!fechados[g.chave];
            const limite = limites[g.chave] ?? MOSTRA_INICIAL;
            const aMostrar = fechado ? [] : doGrupo.slice(0, limite);
            const faltam = doGrupo.length - aMostrar.length;

            return (
              <View key={g.chave} style={{ marginBottom: spacing.lg }}>
                <Pressable
                  onPress={() => alternarGrupo(g.chave)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !fechado }}
                  // O `aria-expanded` a acompanhar o `accessibilityState`: no
                  // react-native-web desta versão o estado não chega ao DOM
                  // sozinho, e um leitor de ecrã anunciava os três cabeçalhos
                  // exatamente da mesma maneira, aberto ou fechado. É a mesma
                  // razão do `aria-checked` no `EcraLogin`.
                  aria-expanded={!fechado}
                  accessibilityLabel={`${g.titulo}, ${doGrupo.length}`}
                  accessibilityHint={
                    fechado ? t('alertas.abrirGrupoAjuda') : t('alertas.fecharGrupoAjuda')
                  }
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      // Alvo inteiro e generoso: fecha-se com o polegar, e é o
                      // gesto que se repete para chegar ao grupo de baixo.
                      minHeight: 48,
                      marginBottom: fechado ? 0 : spacing.sm,
                      marginTop: spacing.sm,
                    },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View
                    style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: g.cor }}
                  />
                  <Text variant="h3">{g.titulo}</Text>
                  <Text variant="secondary" color={colors.textMuted} style={{ flex: 1 }}>
                    ({doGrupo.length})
                  </Text>
                  <Icon
                    name={fechado ? 'chevron-down' : 'chevron-up'}
                    size="lg"
                    color={colors.textSecondary}
                  />
                </Pressable>

                {fechado ? null : (
                  <Card padded={false}>
                    <View style={{ paddingHorizontal: spacing.md }}>
                      {aMostrar.map((a, i) => (
                        <AlertItem
                          key={a.id}
                          alerta={a}
                          divider={i < aMostrar.length - 1}
                          onDispensar={dispensarAlerta}
                        />
                      ))}
                    </View>
                  </Card>
                )}

                {!fechado && faltam > 0 ? (
                  <Pressable
                    onPress={() =>
                      setLimites((l) => ({
                        ...l,
                        [g.chave]: (l[g.chave] ?? MOSTRA_INICIAL) + MOSTRA_PASSO,
                      }))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('alertas.verMais', { n: faltam })}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        minHeight: 48,
                        marginTop: spacing.xs,
                        borderRadius: radii.pill,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Icon name="chevron-down" size="md" color={colors.primaryDark} />
                    <Text variant="label" color={colors.primaryDark}>
                      {t('alertas.verMais', { n: faltam })}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}

/** Um dos dois lados do interruptor Lista / Calendário. */
function Separador({
  label,
  icon,
  ativo,
  onPress,
}: {
  label: string;
  icon: IconName;
  ativo: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          minHeight: 44,
          borderRadius: radii.pill,
          backgroundColor: ativo ? colors.surface : 'transparent',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="sm" color={ativo ? colors.primary : colors.textSecondary} />
      <Text variant="label" color={ativo ? colors.primaryDark : colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}
