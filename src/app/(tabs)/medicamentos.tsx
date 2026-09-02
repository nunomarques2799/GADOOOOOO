import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartaoIntroducao } from '@/components/CartaoIntroducao';
import { LeitorCodigo } from '@/components/LeitorCodigo';
import { Badge, Card, EmptyState, FAB, Icon, type IconName, Text } from '@/components/ui';
import { destinoDoCodigo } from '@/data/codigos';
import { etiquetasImprimiveis, imprimirEtiquetas } from '@/data/etiquetas';
import { descarregarTabelaExcel, excelDisponivel } from '@/data/excelFicheiro';
import { hojeISO } from '@/data/exportar';
import { formatDataPt, formatEuro } from '@/data/helpers';
import {
  formatQuantidade,
  lotesComEstado,
  tabelaExistencias,
  type EstadoLote,
} from '@/data/medicamentos';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

/**
 * Existências — o que há na arrecadação, lote a lote.
 *
 * Não é um armazém: é o REGISTO DE MEDICAMENTOS, que em Portugal é obrigação
 * legal. O que a lei quer saber é o que entrou, de que lote, com que validade e
 * onde foi parar — e por isso uma linha aqui é um frasco que se comprou, não um
 * produto com uma quantidade a subir e a descer (ver `types.ts`).
 *
 * O que resta de cada um NÃO está guardado em lado nenhum: é a quantidade que
 * entrou menos o que os tratamentos gastaram. Fica sempre igual à soma dos
 * registos, que é a única resposta que se defende à frente de um inspetor.
 */
export default function MedicamentosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { medicamentos, eventos, exploracoes } = useGado();
  const { podeEmAlguma } = useMembros();
  const { controlo: controloAtualizar } = useAtualizarPuxando();
  const toast = useToasts();

  const podeGerir = podeEmAlguma('editarAnimais');
  const comFicheiros = Platform.OS === 'web' && excelDisponivel;

  const lotes = useMemo(() => lotesComEstado(medicamentos, eventos), [medicamentos, eventos]);

  /**
   * Três grupos, pela ordem em que interessam: o que se pode usar, o que está
   * a acabar ou a expirar (é o que se compra a seguir) e o que já não serve.
   *
   * Separar o "atenção" do "disponível" é o que faz o ecrã valer a pena: numa
   * lista única ordenada por validade, o frasco que expira daqui a três dias
   * ficava no topo com o mesmo aspeto de todos os outros.
   */
  const secoes = useMemo(() => {
    const fora = lotes.filter((l) => l.expirado || l.esgotado);
    const atencao = lotes.filter((l) => !l.expirado && !l.esgotado && (l.aExpirar || l.quaseVazio));
    const ok = lotes.filter((l) => !l.expirado && !l.esgotado && !l.aExpirar && !l.quaseVazio);
    return [
      { chave: 'atencao', titulo: t('existencias.aTratar'), icon: 'alert-outline' as IconName, cor: colors.warning, data: atencao },
      { chave: 'ok', titulo: t('existencias.disponivel'), icon: 'check-circle-outline' as IconName, cor: colors.success, data: ok },
      { chave: 'fora', titulo: t('existencias.foraDeUso'), icon: 'archive-outline' as IconName, cor: colors.textMuted, data: fora },
    ].filter((s) => s.data.length > 0);
  }, [lotes]);

  const primeiraGerivel = exploracoes.find((e) => podeGerir);

  const [leitorAberto, setLeitorAberto] = useState(false);

  /**
   * Ler uma caixa a partir da lista responde a uma pergunta diferente da do
   * formulário: ali é "dá entrada disto", aqui é "o que é isto que tenho na
   * mão?". Por isso o destino muda com o que se leu.
   *
   * A etiqueta que a app imprimiu, ou um Data Matrix cujo lote já está
   * registado, abrem a FICHA desse frasco: é o caminho para ver o que resta
   * dele à frente da prateleira. Todo o resto segue para uma entrada nova, com
   * o código em cru na rota, para o formulário decidir o que preenche (ver
   * `medicamento/novo.tsx`).
   */
  function aoLerCodigo(bruto: string) {
    setLeitorAberto(false);
    const destino = destinoDoCodigo(bruto, medicamentos, primeiraGerivel?.id);
    if (destino.tipo === 'lote') {
      router.push(`/medicamento/editar/${destino.medicamento.id}`);
      return;
    }
    router.push({
      pathname: '/medicamento/novo',
      params: { codigo: destino.codigo.bruto },
    });
  }

  function exportar() {
    try {
      descarregarTabelaExcel(
        `medicamentos-${hojeISO()}.xlsx`,
        t('existencias.registoMedicamentos'),
        tabelaExistencias(lotes),
      );
      toast.sucesso(t('existencias.descarregado'), t('existencias.nLotes', { n: lotes.length }));
    } catch (e) {
      toast.erro(t('existencias.semDescarga'), mensagemDeErro(e));
    }
  }

  /**
   * Só os lotes que ainda servem levam etiqueta. Imprimir a de um frasco
   * esgotado ou fora de validade é papel gasto num autocolante que vai ser
   * colado num caixote: o que ficou para trás continua na lista e no registo,
   * que é onde tem de estar.
   */
  const paraEtiquetar = useMemo(
    () => lotes.filter((l) => l.disponivel).map((l) => l.medicamento),
    [lotes],
  );

  function imprimir() {
    if (imprimirEtiquetas(paraEtiquetar, t('etiqueta.imprimirTodas'))) {
      toast.sucesso(
        t('etiqueta.aImprimir'),
        t('etiqueta.nEtiquetas', { n: paraEtiquetar.length }),
      );
    } else {
      toast.erro(t('etiqueta.semJanelaTitulo'), t('etiqueta.semJanela'));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={secoes}
        keyExtractor={(l) => l.medicamento.id}
        renderItem={({ item }) => (
          <LinhaLote lote={item} onPress={() => router.push(`/medicamento/editar/${item.medicamento.id}`)} />
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
            <Badge tone="neutral" label={String(section.data.length)} />
          </View>
        )}
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
          <View style={{ paddingTop: insets.top + spacing.md, gap: spacing.md }}>
            <View>
              <Text variant="display">{t('nav.existencias')}</Text>
              <Text variant="body" color={colors.textSecondary}>
                {lotes.length === 0
                  ? t('existencias.subtitulo')
                  : t('existencias.nLotesRegistados', { n: lotes.length })}
              </Text>
            </View>
            <CartaoIntroducao
              chave="medicamentos"
              icon="package-variant-closed"
              titulo={t('existencias.introTitulo')}
              pontos={[
                t('existencias.intro1'),
                t('existencias.intro2'),
                t('existencias.intro3'),
                t('existencias.intro4'),
              ]}
            />
            {/* Ler fica ACIMA de exportar, e do lado de dentro do cabeçalho:
                é a ação de quem está de pé na arrecadação com o frasco na mão,
                e exportar é a de quem está sentado a preparar uma inspeção. */}
            {podeGerir ? (
              <Card onPress={() => setLeitorAberto(true)} accessibilityLabel={t('existencias.lerCodigo')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="barcode-scan" size="md" color={colors.primary} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {t('existencias.lerCodigo')}
                  </Text>
                  <Icon name="chevron-right" size="sm" color={colors.textMuted} />
                </View>
              </Card>
            ) : null}
            {comFicheiros && lotes.length > 0 ? (
              <Card onPress={exportar} accessibilityLabel={t('existencias.exportar')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="microsoft-excel" size="md" color={colors.primary} />
                  <Text variant="body" style={{ flex: 1 }}>
                    {t('existencias.exportar')}
                  </Text>
                  <Icon name="chevron-right" size="sm" color={colors.textMuted} />
                </View>
              </Card>
            ) : null}
            {/* Imprimir só existe onde há impressora, tal como exportar: no
                telemóvel que anda no bolso pela vacada não há para onde. */}
            {etiquetasImprimiveis && podeGerir && paraEtiquetar.length > 0 ? (
              <Card onPress={imprimir} accessibilityLabel={t('etiqueta.imprimirTodas')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="printer" size="md" color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body">
                      {t('etiqueta.imprimirTodas')}
                    </Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {t('etiqueta.nEtiquetas', { n: paraEtiquetar.length })}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size="sm" color={colors.textMuted} />
                </View>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="package-variant-closed"
            title={t('existencias.vazioTitulo')}
            message={
              podeGerir ? t('existencias.vazioPodeGerir') : t('existencias.vazioSemPermissao')
            }
            actionLabel={podeGerir && primeiraGerivel ? t('existencias.darEntrada') : undefined}
            onAction={
              podeGerir && primeiraGerivel ? () => router.push('/medicamento/novo') : undefined
            }
          />
        }
      />
      {podeGerir && lotes.length > 0 ? (
        <FAB
          label={t('existencias.darEntrada')}
          onPress={() => router.push('/medicamento/novo')}
        />
      ) : null}

      <LeitorCodigo
        aberto={leitorAberto}
        titulo={t('leitor.titulo')}
        ajuda={t('leitor.ajuda')}
        onLer={aoLerCodigo}
        onFechar={() => setLeitorAberto(false)}
      />
    </View>
  );
}

function LinhaLote({ lote, onPress }: { lote: EstadoLote; onPress: () => void }) {
  const m = lote.medicamento;

  /** O estado em duas palavras, com a cor a dizer o mesmo à distância. */
  const estado = lote.expirado
    ? { texto: t('existencias.foraDeValidade'), cor: colors.danger }
    : lote.esgotado
      ? { texto: t('existencias.esgotado'), cor: colors.textMuted }
      : lote.aExpirar
        ? {
            texto: t('existencias.expiraEm', { n: lote.diasParaValidade ?? 0 }),
            cor: colors.warning,
          }
        : lote.quaseVazio
          ? { texto: t('existencias.aAcabar'), cor: colors.warning }
          : { texto: t('existencias.disponivel'), cor: colors.success };

  return (
    <Card onPress={onPress} accessibilityLabel={m.nome} style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon
          name={m.tipo === 'Vacina' ? 'needle' : 'medical-bag'}
          size="lg"
          color={m.tipo === 'Vacina' ? colors.primary : colors.danger}
        />
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {m.nome}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {m.lote?.trim()
              ? t('existencias.lote', { lote: m.lote.trim() })
              : t('existencias.semLote')}
            {m.validade ? ` · ${t('existencias.validade', { data: formatDataPt(m.validade) })}` : ''}
            {m.custo != null ? ` · ${formatEuro(m.custo, 0)}` : ''}
          </Text>
          {/* A barra é o que se lê de relance: quanto falta no frasco, sem ter
              de comparar dois números. */}
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.border,
              marginTop: 6,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width: `${Math.round(lote.fracaoRestante * 100)}%`,
                height: '100%',
                backgroundColor: estado.cor,
              }}
            />
          </View>
          <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: 4 }}>
            {t('existencias.restamDe', {
              resta: formatQuantidade(lote.resta, m.unidade),
              total: formatQuantidade(m.quantidade, m.unidade),
            })}
            {m.intervaloSegurancaDias > 0
              ? ` · ${t('existencias.seguranca', { n: m.intervaloSegurancaDias })}`
              : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="caption" color={estado.cor}>
            {estado.texto}
          </Text>
          <Icon name="chevron-right" size="sm" color={colors.textMuted} />
        </View>
      </View>
    </Card>
  );
}
