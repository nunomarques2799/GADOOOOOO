import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import {
  FILTRO_PRAZOS_TUDO,
  ROTULO_CATEGORIA,
  ROTULO_GRAVIDADE,
  descricaoFiltroPrazos,
  filtrarAlertas,
  filtroEstreita,
  guardarRelatorio,
  hojeISO,
  htmlRelatorioPrazos,
  imprimirRelatorio,
  rotuloJanela,
  type FiltroPrazos,
  type JanelaPrazo,
} from '@/data/exportar';
import { useToasts } from '@/data/toasts';
import type { Alerta, AlertaGravidade, Exploracao } from '@/data/types';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, shadow, spacing } from '@/theme';

const TITULO = 'Relatório de prazos · Terrabovina';

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
  const desktop = useDesktop();
  const toast = useToasts();
  const [filtro, setFiltro] = useState<FiltroPrazos>(FILTRO_PRAZOS_TUDO);

  const escolhidos = useMemo(() => filtrarAlertas(alertas, filtro), [alertas, filtro]);
  const nomeExploracao = exploracoes.find((e) => e.id === filtro.exploracaoId)?.nome;

  // Com uma exploração só, os chips seriam uma linha que não muda nada.
  const podeEscolherExploracao = exploracoes.length > 1;

  function alternar<T>(lista: T[], valor: T): T[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  const html = () => htmlRelatorioPrazos(escolhidos, { nomeExploracao, filtro });

  /** "3 prazos", para os avisos dizerem o que saiu e não só que saiu. */
  const quantos = `${escolhidos.length} ${escolhidos.length === 1 ? 'prazo' : 'prazos'}`;

  function imprimir() {
    const ok = imprimirRelatorio(TITULO, html());
    if (!ok) {
      avisar('Indisponível', 'Imprimir o relatório está disponível na versão de computador.');
      return;
    }
    toast.sucesso('Relatório aberto para impressão', quantos);
    onFechar();
  }

  async function descarregar() {
    const r = await guardarRelatorio(TITULO, html(), `prazos-${hojeISO()}`);
    if (r.estado === 'cancelado') return;
    if (r.estado === 'guardado') {
      toast.sucesso('Relatório guardado', quantos);
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
    // A folha fica aberta para se poder tentar outra vez, por isso o aviso não
    // precisa de interromper — só de aparecer.
    toast.erro('Relatório não guardado', r.motivo);
  }

  return (
    <Modal visible={visivel} animationType={desktop ? 'fade' : 'slide'} transparent onRequestClose={onFechar}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          // No computador é um diálogo ao meio do ecrã; no telemóvel sobe de
          // baixo, onde o polegar chega.
          justifyContent: desktop ? 'center' : 'flex-end',
          padding: desktop ? spacing.xl : 0,
        }}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onFechar}
          accessibilityLabel="Fechar"
        />
        <View
          style={{
            backgroundColor: colors.background,
            // Os quatro cantos um a um, sem o atalho `borderRadius`: na web, o
            // atalho e o canto específico compilam para classes CSS cuja ordem
            // não é garantida, e o canto de cima saía a zero.
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: desktop ? radii.xl : 0,
            borderBottomRightRadius: desktop ? radii.xl : 0,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            // O `maxHeight` sozinho não bastava: o ScrollView crescia com o
            // conteúdo e empurrava os botões para fora do ecrã (o "Descarregar
            // PDF" ficava cortado). Quem encolhe é o ScrollView, abaixo.
            maxHeight: desktop ? '100%' : '92%',
            overflow: 'hidden',
            ...(desktop ? shadow.lg : null),
          }}>
          {/* Cabeçalho */}
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
            <Icon name="printer-outline" size="lg" color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="h3">Relatório de prazos</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Escolha o que entra e, no fim, o destino
              </Text>
            </View>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md,
              gap: spacing.md,
            }}>
            {podeEscolherExploracao ? (
              <Grupo titulo="Exploração">
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

            <Grupo titulo="Prazo">
              {JANELAS.map((j) => (
                <Chip
                  key={String(j)}
                  label={rotuloJanela(j)}
                  selected={filtro.janela === j}
                  onPress={() => setFiltro({ ...filtro, janela: j })}
                />
              ))}
            </Grupo>

            <Grupo titulo="Importância" nota="todas, se não escolher">
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

            <Grupo titulo="Assunto" nota="todos, se não escolher">
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

            {filtroEstreita(filtro) ? (
              <Pressable
                onPress={() => setFiltro(FILTRO_PRAZOS_TUDO)}
                accessibilityRole="button"
                accessibilityLabel="Levar todos os prazos"
                style={({ pressed }) => [
                  { alignSelf: 'flex-start', paddingVertical: spacing.xs },
                  pressed && { opacity: 0.6 },
                ]}>
                <Text variant="bodyStrong" color={colors.primaryDark}>
                  Levar todos os prazos
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          {/* Destino: papel ou ficheiro. A contagem fica aqui, encostada aos
              botões — é a última coisa a ler antes de gastar papel. */}
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: (desktop ? 0 : insets.bottom) + spacing.lg,
              gap: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon
                name={escolhidos.length > 0 ? 'file-check-outline' : 'file-remove-outline'}
                size="md"
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

            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: spacing.sm }}>
              <View style={{ flex: desktop ? 1 : undefined }}>
                <Button
                  label="Imprimir"
                  icon="printer-outline"
                  disabled={escolhidos.length === 0}
                  onPress={imprimir}
                />
              </View>
              <View style={{ flex: desktop ? 1 : undefined }}>
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
        </View>
      </View>
    </Modal>
  );
}

/**
 * Um título de filtro com os seus chips a seguir. A `nota` explica o que
 * acontece se não se escolher nada — em letra pequena, e não a gritar dentro do
 * próprio título, que era o que fazia a janela parecer um formulário.
 */
function Grupo({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, flexWrap: 'wrap' }}>
        <Text variant="label" color={colors.textSecondary}>
          {titulo}
        </Text>
        {nota ? (
          <Text variant="caption" color={colors.textMuted}>
            {nota}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{children}</View>
    </View>
  );
}
