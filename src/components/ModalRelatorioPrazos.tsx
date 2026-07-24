import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Icon, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import {
  FILTRO_PRAZOS_TUDO,
  ROTULO_CATEGORIA,
  ROTULO_GRAVIDADE,
  descricaoFiltroPrazos,
  filtrarAlertas,
  guardarRelatorio,
  hojeISO,
  htmlRelatorioPrazos,
  imprimirRelatorio,
  rotuloJanela,
  type FiltroPrazos,
  type JanelaPrazo,
} from '@/data/exportar';
import type { Alerta, AlertaGravidade, Exploracao } from '@/data/types';
import { colors, layout, radii, spacing } from '@/theme';

const TITULO = 'Relatório de prazos — Terrabovina';

const GRAVIDADES: AlertaGravidade[] = ['urgente', 'aviso', 'info'];
const CATEGORIAS: Alerta['categoria'][] = [
  'snira',
  'identificacao',
  'parto',
  'medicamento',
  'vacinacao',
];
const JANELAS: JanelaPrazo[] = ['todos', 'atraso', 7, 30];

/**
 * Escolher o que vai no relatório de prazos e depois imprimir ou guardar em PDF.
 * ------------------------------------------------------------------
 * Imprimir e descarregar eram duas linhas separadas no ecrã Documentos, o que
 * obrigava a decidir o formato ANTES de saber o que ia sair — e a escolher duas
 * vezes se se quisesse as duas coisas. Aqui escolhe-se primeiro o conteúdo (que
 * prazos) e só no fim o destino (papel ou ficheiro).
 *
 * Não há botão de "aplicar": a contagem no fundo muda a cada toque, para se ver
 * o que vai sair antes de gastar papel.
 */
export function ModalRelatorioPrazos({
  visivel,
  alertas,
  exploracoes,
  onFechar,
}: {
  visivel: boolean;
  alertas: Alerta[];
  exploracoes: Exploracao[];
  onFechar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [filtro, setFiltro] = useState<FiltroPrazos>(FILTRO_PRAZOS_TUDO);

  const escolhidos = useMemo(() => filtrarAlertas(alertas, filtro), [alertas, filtro]);
  const nomeExploracao = exploracoes.find((e) => e.id === filtro.exploracaoId)?.nome;

  // Com uma exploração só, os chips seriam uma linha que não muda nada.
  const podeEscolherExploracao = exploracoes.length > 1;

  function alternar<T>(lista: T[], valor: T): T[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  const html = () => htmlRelatorioPrazos(escolhidos, { nomeExploracao, filtro });

  function imprimir() {
    const ok = imprimirRelatorio(TITULO, html());
    if (!ok) {
      avisar('Indisponível', 'Imprimir o relatório está disponível na versão de computador.');
      return;
    }
    onFechar();
  }

  async function descarregar() {
    const r = await guardarRelatorio(TITULO, html(), `prazos-${hojeISO()}`);
    if (r.estado === 'cancelado') return;
    if (r.estado === 'guardado') {
      onFechar();
      return;
    }
    if (r.estado === 'html') {
      avisar(
        'Relatório descarregado',
        'Guardámos o relatório como página web. Para o ter em PDF, abra-o e use Imprimir → Guardar como PDF.',
      );
      onFechar();
      return;
    }
    if (r.estado === 'indisponivel') {
      avisar('Indisponível', 'Descarregar o relatório está disponível na versão de computador.');
      return;
    }
    avisar('Não foi possível guardar', r.motivo);
  }

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel="Fechar" />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            width: '100%',
            maxWidth: layout.conteudoEstreito,
            alignSelf: 'center',
            maxHeight: '90%',
          }}>
          {/* Cabeçalho */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.lg,
              paddingBottom: spacing.sm,
            }}>
            <Icon name="printer-outline" size="lg" color={colors.primary} />
            <Text variant="h3" style={{ flex: 1 }}>
              Relatório de prazos
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
            <Text variant="secondary" color={colors.textSecondary}>
              Escolha que prazos quer no relatório. No fim, imprima ou guarde em PDF.
            </Text>

            {podeEscolherExploracao ? (
              <Grupo titulo="EXPLORAÇÃO">
                <Chip
                  label="Todas"
                  icon="barn"
                  selected={filtro.exploracaoId === undefined}
                  onPress={() => setFiltro({ ...filtro, exploracaoId: undefined })}
                />
                {exploracoes.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.nome}
                    selected={filtro.exploracaoId === e.id}
                    onPress={() =>
                      setFiltro({
                        ...filtro,
                        exploracaoId: filtro.exploracaoId === e.id ? undefined : e.id,
                      })
                    }
                  />
                ))}
              </Grupo>
            ) : null}

            <Grupo titulo="PRAZO">
              {JANELAS.map((j) => (
                <Chip
                  key={String(j)}
                  label={rotuloJanela(j)}
                  selected={filtro.janela === j}
                  onPress={() => setFiltro({ ...filtro, janela: j })}
                />
              ))}
            </Grupo>

            <Grupo titulo="IMPORTÂNCIA — TODAS SE NÃO ESCOLHER">
              {GRAVIDADES.map((g) => (
                <Chip
                  key={g}
                  label={ROTULO_GRAVIDADE[g]}
                  selected={filtro.gravidades.includes(g)}
                  onPress={() =>
                    setFiltro({ ...filtro, gravidades: alternar(filtro.gravidades, g) })
                  }
                />
              ))}
            </Grupo>

            <Grupo titulo="ASSUNTO — TODOS SE NÃO ESCOLHER">
              {CATEGORIAS.map((c) => (
                <Chip
                  key={c}
                  label={ROTULO_CATEGORIA[c]}
                  selected={filtro.categorias.includes(c)}
                  onPress={() =>
                    setFiltro({ ...filtro, categorias: alternar(filtro.categorias, c) })
                  }
                />
              ))}
            </Grupo>

            {/* O que vai sair */}
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon
                  name={escolhidos.length > 0 ? 'file-check-outline' : 'file-remove-outline'}
                  size="lg"
                  color={escolhidos.length > 0 ? colors.success : colors.warning}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">
                    {escolhidos.length === 0
                      ? 'Nenhum prazo escolhido'
                      : `${escolhidos.length} prazo${escolhidos.length > 1 ? 's' : ''} no relatório`}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {nomeExploracao ? `${nomeExploracao} · ` : ''}
                    {descricaoFiltroPrazos(filtro)}
                  </Text>
                </View>
              </View>
            </Card>
          </ScrollView>

          {/* Destino: papel ou ficheiro */}
          <View
            style={{
              padding: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.sm,
            }}>
            <Button
              label="Imprimir"
              icon="printer-outline"
              disabled={escolhidos.length === 0}
              onPress={imprimir}
            />
            <Button
              label="Descarregar PDF"
              icon="file-download-outline"
              variant="secondary"
              disabled={escolhidos.length === 0}
              onPress={() => void descarregar()}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Um título de filtro com os seus chips a seguir. */
function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" color={colors.textSecondary}>
        {titulo}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{children}</View>
    </View>
  );
}
