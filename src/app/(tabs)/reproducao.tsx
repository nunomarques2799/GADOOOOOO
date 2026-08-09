import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StatCard } from '@/components/StatCard';
import { Badge, Card, EmptyState, FAB, Icon, type IconName, Text } from '@/components/ui';
import { PrazosReproducao } from '@/data/constants';
import { formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import {
  aguardamDiagnostico,
  faseMeta,
  porFase,
  prestesAParir,
  resumoReproducao,
  semCobricaoAposParto,
  type FaseReprodutiva,
  type LinhaReproducao,
} from '@/data/reproducao';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, shadow, spacing } from '@/theme';

/**
 * Reprodução — as três perguntas que um criador de bovinos faz todas as
 * semanas, cada uma com a lista de quem lhes responde.
 *
 *   quem está para parir? .......... para preparar o parque e vigiar
 *   quem falta diagnosticar? ....... para juntar a visita do veterinário
 *   quem está parada desde o parto?  para não perder o ano
 *
 * As três são CALCULADAS a partir dos eventos registados (ver `reproducao.ts`),
 * não de um campo que alguém tenha de manter atualizado à mão. Registar a
 * cobrição e o diagnóstico é o único trabalho; as listas saem daí.
 *
 * Porque é que este ecrã existe em vez de mais alertas: os alertas dizem o que
 * está em atraso, um a um, misturados com prazos legais e vacinas. Aqui vê-se o
 * REBANHO — quantas estão prenhes, quantas paradas, como vai o intervalo entre
 * partos. É a diferença entre uma lista de recados e saber como corre o ano.
 */
/**
 * O que cada número do resumo abre. "Cobertas" leva as duvidosas com ela —
 * é o que o cartão conta, e é a mesma situação vista do curral: foi ao touro e
 * ainda não se sabe.
 */
type GrupoFases = { titulo: string; fases: FaseReprodutiva[] };

/**
 * FUNÇÃO e não constante: os títulos passam pelo `t()`, e uma tabela de módulo
 * resolvia-os no import, congelando a língua de arranque (ver AGENTS.md).
 */
function grupos(): Record<'gestantes' | 'cobertas' | 'vazias', GrupoFases> {
  return {
    gestantes: { titulo: t('repro.gestantes'), fases: ['gestante'] },
    cobertas: { titulo: t('repro.cobertas'), fases: ['coberta', 'duvidosa'] },
    vazias: { titulo: t('repro.vazias'), fases: ['vazia'] },
  };
}

export default function ReproducaoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { animais, eventos } = useGado();
  const { podeEmAlguma } = useMembros();
  const { controlo: controloAtualizar } = useAtualizarPuxando();

  const podeRegistar = podeEmAlguma('registarTratamentos');
  /** O grupo que a folha está a mostrar, ou `undefined` se está fechada. */
  const [grupoAberto, setGrupoAberto] = useState<GrupoFases | undefined>(undefined);
  const linhasDoGrupo = useMemo(
    () => (grupoAberto ? porFase(animais, eventos, grupoAberto.fases) : []),
    [grupoAberto, animais, eventos],
  );

  const resumo = useMemo(() => resumoReproducao(animais, eventos), [animais, eventos]);

  const secoes = useMemo(() => {
    const parir = prestesAParir(animais, eventos);
    const diagnosticar = aguardamDiagnostico(animais, eventos);
    const paradas = semCobricaoAposParto(animais, eventos);
    return [
      {
        chave: 'parir',
        titulo: t('repro.prestesAParir'),
        icon: 'baby-bottle-outline' as IconName,
        cor: colors.info,
        vazio: t('repro.prestesAParirVazio'),
        // `acao` é o valor de DOMÍNIO que vai no `evento.tipo` (gravado na base
        // e usado nos filtros), por isso fica em português nas duas línguas;
        // `acaoRotulo` é o que se lê. Ver a nota do domínio no `textos.ts`.
        acao: undefined,
        acaoRotulo: undefined,
        data: parir,
      },
      {
        chave: 'diagnosticar',
        titulo: t('repro.aguardaDiagnostico'),
        icon: 'stethoscope' as IconName,
        cor: colors.warning,
        vazio: t('repro.aguardaDiagnosticoVazio', {
          dias: PrazosReproducao.diagnosticoAPartirDe,
        }),
        acao: 'Diagnóstico' as const,
        acaoRotulo: t('repro.diagnostico'),
        data: diagnosticar,
      },
      {
        chave: 'paradas',
        titulo: t('repro.paradas'),
        icon: 'alert-circle-outline' as IconName,
        cor: colors.danger,
        vazio: t('repro.paradasVazio', { dias: PrazosReproducao.cobrirApos }),
        acao: 'Cobrição' as const,
        acaoRotulo: t('repro.cobricao'),
        data: paradas,
      },
    ];
  }, [animais, eventos]);

  const nadaARegistar = resumo.elegiveis === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={secoes}
        keyExtractor={(l) => l.animal.id}
        renderItem={({ item, section }) => (
          <LinhaFemea
            linha={item}
            acao={section.acao}
            acaoRotulo={section.acaoRotulo}
            podeRegistar={podeRegistar}
            onAbrir={() => router.push(`/animal/${item.animal.id}`)}
            onRegistar={
              section.acao
                ? () =>
                    router.push({
                      pathname: '/evento/novo',
                      params: { tipo: section.acao, animalId: item.animal.id },
                    })
                : undefined
            }
          />
        )}
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingTop: spacing.md,
              paddingBottom: spacing.xs,
              backgroundColor: colors.background,
            }}>
            <Icon name={section.icon} size="sm" color={section.cor} />
            <Text variant="label" color={colors.textSecondary} style={{ flex: 1 }}>
              {section.titulo.toUpperCase()}
            </Text>
            <Badge
              tone={section.data.length === 0 ? 'neutral' : 'brand'}
              label={String(section.data.length)}
            />
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Card>
              <Text variant="secondary" color={colors.textSecondary}>
                {section.vazio}
              </Text>
            </Card>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        refreshControl={controloAtualizar}
        contentContainerStyle={{
          width: '100%',
          maxWidth: desktop ? layout.conteudoDesktop : undefined,
          alignSelf: 'center',
          paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md }}>
            <Text variant="display">{t('nav.reproducao')}</Text>
            <Text variant="body" color={colors.textSecondary}>
              {nadaARegistar
                ? t('repro.subtituloVazio')
                : t('repro.femeasEmIdade', { n: resumo.elegiveis })}
            </Text>
            {nadaARegistar ? null : <Resumo resumo={resumo} onAbrirFase={setGrupoAberto} />}
          </View>
        }
        ListEmptyComponent={
          nadaARegistar ? (
            <EmptyState
              icon="heart-pulse"
              title={t('repro.vazioTitulo')}
              message={t('repro.vazioMensagem')}
            />
          ) : null
        }
      />
      {podeRegistar && !nadaARegistar ? (
        <FAB
          label={t('repro.registarCobricao')}
          onPress={() => router.push({ pathname: '/evento/novo', params: { tipo: 'Cobrição' } })}
        />
      ) : null}

      {/* Quem são as do número em que se tocou. Montada só quando está aberta:
          fora disso não há folha nenhuma a guardar a fase de uma consulta
          anterior. */}
      <FolhaFase
        grupo={grupoAberto}
        linhas={linhasDoGrupo}
        onFechar={() => setGrupoAberto(undefined)}
        onAbrirAnimal={(id) => {
          setGrupoAberto(undefined);
          router.push(`/animal/${id}`);
        }}
      />
    </View>
  );
}

/** A lista de quem está numa fase — o que os números do resumo abrem. */
function FolhaFase({
  grupo,
  linhas,
  onFechar,
  onAbrirAnimal,
}: {
  grupo?: GrupoFases;
  linhas: LinhaReproducao[];
  onFechar: () => void;
  onAbrirAnimal: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!grupo} animationType="slide" transparent onRequestClose={onFechar}>
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
              {grupo?.titulo} ({linhas.length})
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {linhas.map((l) => (
              // Sem `acao`: aqui está-se a CONSULTAR quem são, não a despachar
              // trabalho. O que há para fazer está nas listas do ecrã de trás,
              // cada uma com o seu botão.
              <LinhaFemea
                key={l.animal.id}
                linha={l}
                podeRegistar={false}
                onAbrir={() => onAbrirAnimal(l.animal.id)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Os números do rebanho. A taxa de gestação e o intervalo entre partos são as
 * duas contas que dizem se a reprodução vai bem — e nenhuma delas se via em
 * lado nenhum da app antes disto.
 */
function Resumo({
  resumo,
  onAbrirFase,
}: {
  resumo: ReturnType<typeof resumoReproducao>;
  onAbrirFase: (grupo: GrupoFases) => void;
}) {
  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      {/* Os três números abrem a lista de QUEM são. Antes eram só números: via-se
          "14 cobertas" e não havia por onde saber quais, que é a pergunta
          seguinte, sempre, e a app não a respondia em lado nenhum. As três
          listas de baixo respondem a "o que é preciso fazer", que é outra coisa:
          uma vaca coberta na semana passada não está em nenhuma delas, e ainda
          assim está coberta. */}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StatCard
          icon="check-circle-outline"
          label={t('repro.gestantes')}
          value={resumo.gestantes}
          tint={colors.success}
          onPress={resumo.gestantes > 0 ? () => onAbrirFase(grupos().gestantes) : undefined}
        />
        <StatCard
          icon="gender-male-female"
          label={t('repro.cobertas')}
          value={resumo.cobertas + resumo.duvidosas}
          tint={colors.info}
          onPress={
            resumo.cobertas + resumo.duvidosas > 0
              ? () => onAbrirFase(grupos().cobertas)
              : undefined
          }
        />
        <StatCard
          icon="circle-outline"
          label={t('repro.vazias')}
          value={resumo.vazias}
          tint={colors.textSecondary}
          onPress={resumo.vazias > 0 ? () => onAbrirFase(grupos().vazias) : undefined}
        />
      </View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('repro.taxaGestacao')}
            </Text>
            <Text variant="h2">{resumo.taxaGestacao}%</Text>
          </View>
          <View style={{ flex: 1.4 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t('repro.intervaloPartos')}
            </Text>
            {resumo.intervaloMedioPartos == null ? (
              // Ausente é honesto: com um ano de registos ainda não há duas
              // parições em quase ninguém, e inventar uma média a partir de uma
              // vaca só dava um número que parece medida e não é.
              <Text variant="secondary" color={colors.textSecondary}>
                {t('repro.semDoisPartos')}
              </Text>
            ) : (
              <Text
                variant="h2"
                color={
                  resumo.intervaloMedioPartos > PrazosReproducao.intervaloPartosAlvo
                    ? colors.warning
                    : colors.text
                }>
                {t('alerta.dias', { n: resumo.intervaloMedioPartos })}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </View>
  );
}

function LinhaFemea({
  linha,
  acao,
  acaoRotulo,
  podeRegistar,
  onAbrir,
  onRegistar,
}: {
  linha: LinhaReproducao;
  /** O `evento.tipo` que se vai gravar. Fica em português (valor de domínio). */
  acao?: 'Cobrição' | 'Diagnóstico';
  /** O mesmo, mas para ser lido em voz alta. */
  acaoRotulo?: string;
  podeRegistar: boolean;
  onAbrir: () => void;
  onRegistar?: () => void;
}) {
  const { animal, estado } = linha;
  const nome = animal.nome ?? animal.numeroIdentificacao ?? t('animais.semNome');

  /** A linha de baixo muda conforme a lista: cada uma responde à sua pergunta. */
  const contexto = (() => {
    if (estado.fase === 'gestante' && estado.dataPrevistaParto) {
      const dias = estado.diasParaParto ?? 0;
      const quando = formatDataPt(estado.dataPrevistaParto);
      return dias < 0
        ? `${t('repro.passouPrevisao', { n: Math.abs(dias) })} · ${quando}`
        : `${t('repro.faltam', { n: dias })} · ${quando}`;
    }
    if (estado.fase === 'coberta') {
      const base = t('repro.cobertaHa', { n: estado.diasNaFase });
      return estado.detalheCobricao ? `${base} · ${estado.detalheCobricao}` : base;
    }
    if (estado.fase === 'duvidosa') {
      return t('repro.diagInconclusivo', { n: estado.diasNaFase });
    }
    const base = t('repro.pariuHa', { n: estado.diasDesdeUltimoParto ?? 0 });
    return estado.partos > 1 ? `${base} · ${t('repro.nPartos', { n: estado.partos })}` : base;
  })();

  const comAcao = acao && podeRegistar && onRegistar;

  /*
   * Os dois toques são IRMÃOS e não um dentro do outro. Um `Pressable` de
   * "Registar" dentro de um cartão que também é `Pressable` compila em
   * `<button><button></button></button>`, que é HTML inválido: a web queixa-se
   * de erro de hidratação e o toque interior fica à sorte de qual dos dois
   * apanha o evento. Por isso o cartão NÃO é premível quando há ação — quem é
   * premível é a área do texto, ao lado do botão.
   */
  return (
    <Card padded={false} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel={nome}
          style={({ pressed }) => [
            { flex: 1, padding: spacing.md },
            pressed && { opacity: 0.7 },
          ]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {nome}
            </Text>
            <Badge tone="neutral" label={faseMeta(estado.fase).label} />
          </View>
          {animal.numeroIdentificacao && animal.nome ? (
            <Text variant="caption" color={colors.textMuted}>
              {animal.numeroIdentificacao}
            </Text>
          ) : null}
          <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: 2 }}>
            {contexto}
          </Text>
        </Pressable>

        {/* O atalho para registar o que falta, sem passar pela ficha. É a
            diferença entre esta lista ser um relatório e ser trabalho: o
            veterinário está à porta e o que se quer é lançar o diagnóstico. */}
        {comAcao ? (
          <Pressable
            onPress={onRegistar}
            accessibilityRole="button"
            accessibilityLabel={t('repro.registarEm', {
              acao: (acaoRotulo ?? '').toLowerCase(),
              nome,
            })}
            style={({ pressed }) => [
              {
                minWidth: 72,
                alignSelf: 'stretch',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderLeftWidth: 1,
                borderLeftColor: colors.border,
              },
              pressed && { opacity: 0.6 },
            ]}>
            <Icon
              name={acao === 'Cobrição' ? 'gender-male-female' : 'stethoscope'}
              size="lg"
              color={colors.primary}
            />
            <Text variant="caption" color={colors.primary}>
              {t('repro.registar')}
            </Text>
          </Pressable>
        ) : (
          <View style={{ paddingRight: spacing.md }}>
            <Icon name="chevron-right" size="md" color={colors.textMuted} />
          </View>
        )}
      </View>
    </Card>
  );
}
