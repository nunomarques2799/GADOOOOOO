import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Icon, type IconName, Text } from '@/components/ui';
import { exportarAnimaisExcel, importacaoDisponivel } from '@/data/animalExcelFicheiro';
import { avisar, confirmar } from '@/data/avisos';
import {
  csvAnimais,
  csvEventos,
  guardarFicheiro,
  guardarRelatorio,
  hojeISO,
  htmlRelatorioPrazos,
  imprimirRelatorio,
} from '@/data/exportar';
import { formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNotas, type Nota } from '@/data/notas';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, sizes, spacing } from '@/theme';

const TITULO_PRAZOS = 'Relatório de prazos — Gestão de Gado';

/**
 * Documentos: tudo o que ENTRA e SAI da app em ficheiro (importar animais de
 * Excel, exportar animais/eventos, relatórios) e as NOTAS do utilizador.
 * As exportações vieram das Definições, para o que é ficheiro viver num sítio só.
 */
export default function DocumentosScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { animais, eventos, exploracoes, terrenos, alertas } = useGado();
  const { contaSuspensa } = useMembros();
  const notasApi = useNotas();

  const naWeb = Platform.OS === 'web';

  async function exportar(nomeFicheiro: string, conteudo: string) {
    try {
      await guardarFicheiro(nomeFicheiro, conteudo);
    } catch (e) {
      avisar('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    }
  }

  function imprimirPrazos() {
    const ok = imprimirRelatorio(TITULO_PRAZOS, htmlRelatorioPrazos(alertas));
    if (!ok) avisar('Indisponível', 'A impressão do relatório está disponível na versão de computador.');
  }

  async function descarregarPrazos() {
    const r = await guardarRelatorio(TITULO_PRAZOS, htmlRelatorioPrazos(alertas), `prazos-${hojeISO()}`);
    if (r.estado === 'guardado' || r.estado === 'cancelado') return;
    if (r.estado === 'html') {
      avisar(
        'Relatório descarregado',
        'Guardámos o relatório como página web. Para o ter em PDF, abra-o e use Imprimir → Guardar como PDF.',
      );
      return;
    }
    if (r.estado === 'indisponivel') {
      avisar('Indisponível', 'Descarregar o relatório está disponível na versão de computador.');
      return;
    }
    avisar('Não foi possível guardar', r.motivo);
  }

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
        contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ ...coluna, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="display">Documentos</Text>
          <Text variant="body" color={colors.textSecondary}>
            Importar, exportar e as suas notas
          </Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* Importar — só web/Electron (o telemóvel não escolhe ficheiros sem build nativo) */}
          {naWeb && !contaSuspensa ? (
            <Grupo titulo="IMPORTAR">
              <Linha
                icon="microsoft-excel"
                label="Importar animais de Excel"
                onPress={() => router.push('/animal/importar')}
                last
              />
            </Grupo>
          ) : null}

          {/* Exportar e relatórios (vindos das Definições) */}
          <Grupo titulo="EXPORTAR E RELATÓRIOS">
            {naWeb ? (
              <Linha
                icon="microsoft-excel"
                label="Exportar animais (Excel)"
                trailing={String(animais.length)}
                onPress={() => exportarAnimaisExcel(animais)}
              />
            ) : null}
            <Linha
              icon="cow"
              label="Exportar animais (CSV)"
              trailing={String(animais.length)}
              onPress={() =>
                void exportar(`animais-${hojeISO()}.csv`, csvAnimais(animais, exploracoes, terrenos))
              }
            />
            <Linha
              icon="calendar-text-outline"
              label="Exportar eventos (CSV)"
              trailing={String(eventos.length)}
              onPress={() => void exportar(`eventos-${hojeISO()}.csv`, csvEventos(eventos, animais))}
            />
            <Linha
              icon="printer-outline"
              label="Imprimir relatório de prazos"
              trailing={String(alertas.length)}
              onPress={imprimirPrazos}
            />
            <Linha
              icon="file-download-outline"
              label="Descarregar relatório (PDF)"
              trailing={String(alertas.length)}
              onPress={() => void descarregarPrazos()}
            />
            <Linha
              icon="file-export-outline"
              label="Exportar para o iDigital"
              trailing="Fase 2"
              onPress={() =>
                avisar(
                  'Ainda em desenvolvimento',
                  'A exportação para o iDigital chega numa próxima versão. Entretanto pode usar o "Descarregar relatório (PDF)" ou o "Exportar animais".',
                )
              }
              last
            />
          </Grupo>

          {/* Notas */}
          <SeccaoNotas notas={notasApi} />
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Notas
 * ------------------------------------------------------------------ */

type Rascunho = { id?: string; titulo: string; texto: string };

function SeccaoNotas({ notas }: { notas: ReturnType<typeof useNotas> }) {
  const [editor, setEditor] = useState<Rascunho | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  async function guardar() {
    if (!editor || aGuardar) return;
    if (!editor.texto.trim() && !editor.titulo.trim()) {
      avisar('Nota vazia', 'Escreva alguma coisa antes de guardar.');
      return;
    }
    setAGuardar(true);
    try {
      await notas.guardarNota({ id: editor.id, titulo: editor.titulo, texto: editor.texto });
      setEditor(null);
    } catch (e) {
      avisar(
        'Não foi possível guardar',
        e instanceof Error ? `${e.message}\n\nAs notas precisam de ligação para gravar.` : String(e),
      );
    } finally {
      setAGuardar(false);
    }
  }

  function eliminar() {
    const id = editor?.id;
    if (!id) return;
    confirmar(
      'Eliminar nota',
      'Tem a certeza? Esta ação não pode ser anulada.',
      () => {
        void (async () => {
          try {
            await notas.eliminarNota(id);
            setEditor(null);
          } catch (e) {
            avisar('Não foi possível eliminar', e instanceof Error ? e.message : String(e));
          }
        })();
      },
      { rotuloConfirmar: 'Eliminar', destrutivo: true },
    );
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.xs,
          marginLeft: spacing.xs,
        }}>
        <Text variant="label" color={colors.textSecondary} style={{ flex: 1 }}>
          NOTAS
        </Text>
        {notas.aCarregar ? (
          <Text variant="caption" color={colors.textMuted}>
            a carregar…
          </Text>
        ) : null}
      </View>

      {notas.notas.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
            <Icon name="note-text-outline" size="lg" color={colors.textMuted} />
            <Text variant="secondary" color={colors.textSecondary} center>
              Ainda não tem notas. Guarde aqui o que precisar de ter à mão — contactos,
              lembretes, o que quiser.
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {notas.notas.map((n) => (
            <CartaoNota
              key={n.id}
              nota={n}
              onPress={() => setEditor({ id: n.id, titulo: n.titulo ?? '', texto: n.texto })}
            />
          ))}
        </View>
      )}

      <Button
        label="Nova nota"
        icon="plus"
        variant="secondary"
        onPress={() => setEditor({ titulo: '', texto: '' })}
        style={{ marginTop: spacing.sm }}
      />

      <Modal
        visible={editor !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditor(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditor(null)} accessibilityLabel="Fechar" />
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              padding: spacing.lg,
              gap: spacing.sm,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="h3" style={{ flex: 1 }}>
                {editor?.id ? 'Editar nota' : 'Nova nota'}
              </Text>
              <Pressable
                onPress={() => setEditor(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Fechar">
                <Icon name="close" size="lg" color={colors.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              value={editor?.titulo ?? ''}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, titulo: t } : e))}
              placeholder="Título (opcional)"
              placeholderTextColor={colors.textMuted}
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.md,
                height: sizes.input,
                fontFamily: 'Nunito_700Bold',
                fontSize: 17,
                color: colors.text,
              }}
            />
            <TextInput
              value={editor?.texto ?? ''}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, texto: t } : e))}
              placeholder="Escreva a sua nota…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={{
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: radii.md,
                backgroundColor: colors.surface,
                padding: spacing.md,
                minHeight: 160,
                fontFamily: 'Nunito_500Medium',
                fontSize: 16,
                color: colors.text,
              }}
            />

            <Button
              label={aGuardar ? 'A guardar…' : 'Guardar nota'}
              icon="check"
              loading={aGuardar}
              onPress={() => void guardar()}
            />
            {editor?.id ? (
              <Button label="Eliminar nota" icon="trash-can-outline" variant="danger" onPress={eliminar} />
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CartaoNota({ nota, onPress }: { nota: Nota; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={nota.titulo || 'Nota'}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card>
        <Text variant="bodyStrong" numberOfLines={1}>
          {nota.titulo || 'Sem título'}
        </Text>
        {nota.texto.trim() ? (
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: 2 }}>
            {nota.texto}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
          {formatDataPt(nota.atualizadoEm)}
        </Text>
      </Card>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ *
 *  Grupo / Linha (mesmo desenho das Definições)
 * ------------------------------------------------------------------ */

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
