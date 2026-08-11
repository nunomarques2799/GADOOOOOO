import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartaoIntroducao } from '@/components/CartaoIntroducao';
import { Badge, Card, EmptyState, FAB, Icon, type IconName, Text } from '@/components/ui';
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
