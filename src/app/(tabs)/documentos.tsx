import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartaoIntroducao } from '@/components/CartaoIntroducao';
import { ModalRelatorioPrazos } from '@/components/ModalRelatorioPrazos';
import { SeccaoDocumentos } from '@/components/SeccaoDocumentos';
import { Button, Card, EmptyState, FolhaComTeclado, Icon, type IconName, Text } from '@/components/ui';
import { exportarAnimaisExcel } from '@/data/animalExcelFicheiro';
import { avisar, confirmar } from '@/data/avisos';
import { descarregarTabelaExcel, excelDisponivel } from '@/data/excelFicheiro';
import { hojeISO, tabelaEventos } from '@/data/exportar';
import { formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNotas, type Nota } from '@/data/notas';
import { comunicacoesPendentes } from '@/data/snira';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useDocumentos } from '@/data/useDocumentos';
import { t } from '@/i18n';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, sizes, spacing } from '@/theme';

/**
 * Documentos: tudo o que ENTRA e SAI da app em ficheiro (importar animais de
 * Excel, exportar animais/eventos, relatórios) e as NOTAS do utilizador.
 * As exportações vieram das Definições, para o que é ficheiro viver num sítio só.
 *
 * Tudo o que é ficheiro precisa de disco: no telemóvel não há, e em vez de
 * botões que não fazem nada diz-se que isto se faz no computador.
 */
export default function DocumentosScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { animais, eventos, exploracoes, terrenos, alertas } = useGado();
  const { contaSuspensa, podeVer } = useMembros();
  const notasApi = useNotas();
  // Acima do desvio de "sem permissão" mais abaixo, como os outros hooks: um
  // `return` condicional pelo meio mudava a contagem de hooks entre renders (o
  // papel chega da cache e é corrigido pelo servidor logo a seguir).
  const documentosApi = useDocumentos();
  const toast = useToasts();

  const [relatorioAberto, setRelatorioAberto] = useState(false);

  const comFicheiros = Platform.OS === 'web' && excelDisponivel;

  // Os eliminados ficam de fora da exportação. O registo existe (é o que o
  // histórico do efetivo mostra), mas exportar animais que o criador tirou da
  // lista dava uma folha com mais linhas do que a app mostra em lado nenhum, e
  // uma contagem no botão que não batia certo com nada.
  const exportaveis = useMemo(
    () => animais.filter((a) => a.estado !== 'eliminado'),
    [animais],
  );

  const porComunicar = useMemo(
    () => comunicacoesPendentes(animais, eventos).length,
    [animais, eventos],
  );

  /**
   * Escreve um ficheiro e diz o que aconteceu.
   *
   * A escrita passa por um `<a download>` (ver `excelFicheiro.ts`): quando corre
   * bem, o browser guarda o ficheiro sem a app dar sinal nenhum, e quando o
   * browser bloqueia o download — ou a folha rebenta a meio — também não. Tocar
   * no botão e não ver nada era a mesma coisa nos dois casos.
   */
  function descarregar(nomeFicheiro: string, quantos: string, escrever: () => void) {
    try {
      escrever();
      toast.sucesso(t('docs.descarregado'), `${nomeFicheiro} · ${quantos}`);
    } catch (e) {
      toast.erro(t('docs.semDescarga'), mensagemDeErro(e));
    }
  }

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  // O separador já não aparece na barra a quem não tem isto (ver `(tabs)/
  // _layout.tsx`), mas a rota continua declarada — quem lá chegar por um link
  // guardado, pela barra lateral do computador ou pelo histórico do navegador
  // encontra o ecrã. Ele tem de se explicar em vez de mostrar o efetivo de
  // outra pessoa pronto a descarregar.
  if (!podeVer(undefined, 'verDocumentos')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + spacing.xxl }}>
          <View style={{ ...coluna, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="display">{t('nav.documentos')}</Text>
            <Text variant="body" color={colors.textSecondary}>
              {t('docs.subtituloSemAcesso')}
            </Text>
          </View>
          <View style={coluna}>
            <EmptyState
              icon="lock-outline"
              title={t('docs.semAcessoTitulo')}
              message={t('docs.semAcessoMensagem')}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: insets.bottom + spacing.xxl }}>
        <View style={{ ...coluna, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="display">{t('nav.documentos')}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {t('docs.subtitulo')}
          </Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* À primeira vez, o que é este separador. "Documentos" parece uma
              gaveta de ficheiros, e é por aqui que se traz o efetivo inteiro de
              um Excel: o atalho que poupa uma tarde de escrita à mão a quem não
              faz ideia de que ele existe. */}
          <CartaoIntroducao
            chave="documentos"
            icon="file-document-multiple-outline"
            titulo={t('docs.introTitulo')}
            pontos={[
              t('docs.intro1'),
              t('docs.intro2'),
              t('docs.intro3'),
              t('docs.intro4'),
              t('docs.intro5'),
            ]}
          />


          {/* O SNIRA vem PRIMEIRO, e fora do grupo das exportações: não é um
              ficheiro que se leva, é trabalho que tem prazo legal a correr. O
              número ao lado é o que falta comunicar — quando é zero, a linha
              continua lá a dizer que está tudo em dia.

              Funciona no telemóvel, ao contrário de tudo o resto deste ecrã: a
              lista lê-se e marca-se sem precisar de disco. Só levar a folha em
              Excel ou em papel é que é do computador. */}
          <Grupo titulo={t('docs.grupoObrigacoes')}>
            <Linha
              icon="cloud-upload-outline"
              label={t('docs.comunicarSnira')}
              trailing={porComunicar === 0 ? t('docs.emDia') : String(porComunicar)}
              onPress={() => router.push('/snira')}
              last
            />
          </Grupo>

          {/* Importar: só web/Electron (o telemóvel não escolhe ficheiros sem build nativo) */}
          {comFicheiros && !contaSuspensa ? (
            <Grupo titulo={t('docs.grupoImportar')}>
              <Linha
                icon="microsoft-excel"
                label={t('docs.importarAnimais')}
                onPress={() => router.push('/animal/importar')}
                last
              />
            </Grupo>
          ) : null}

          {/* Exportar e relatórios (vindos das Definições) */}
          <Grupo titulo={t('docs.grupoExportar')}>
            {comFicheiros ? (
              <>
                <Linha
                  icon="microsoft-excel"
                  label={t('docs.exportarAnimais')}
                  trailing={String(exportaveis.length)}
                  onPress={() =>
                    descarregar(
                      `animais-${hojeISO()}.xlsx`,
                      t('terrenos.nAnimais', { n: exportaveis.length }),
                      // `animais` (o efetivo TODO) no fim, e não só os
                      // exportáveis: é de lá que saem os nomes da mãe e do pai,
                      // e um progenitor já vendido não está na lista que sai na
                      // folha — sem isto, a coluna vinha vazia justamente nos
                      // animais mais antigos.
                      () => exportarAnimaisExcel(exportaveis, exploracoes, terrenos, animais),
                    )
                  }
                />
                <Linha
                  icon="calendar-text-outline"
                  label={t('docs.exportarEventos')}
                  trailing={String(eventos.length)}
                  onPress={() =>
                    descarregar(
                      `eventos-${hojeISO()}.xlsx`,
                      t('docs.nRegistos', { n: eventos.length }),
                      () =>
                        descarregarTabelaExcel(
                          `eventos-${hojeISO()}.xlsx`,
                          t('docs.eventos'),
                          tabelaEventos(eventos, animais),
                        ),
                    )
                  }
                />
                {/* Imprimir e PDF juntos: escolhe-se o que sai e só depois o destino. */}
                <Linha
                  icon="printer-outline"
                  label={t('docs.relatorioPrazos')}
                  trailing={String(alertas.length)}
                  onPress={() => setRelatorioAberto(true)}
                />
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}>
                <Icon name="laptop" size="lg" color={colors.info} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{t('docs.soNoComputador')}</Text>
                  <Text variant="secondary" color={colors.textSecondary}>
                    {t('docs.soNoComputadorDetalhe')}
                  </Text>
                </View>
              </View>
            )}
          </Grupo>

          {/* As gavetas dos papéis guardados, a seguir às exportações. Só as
              pastas: os documentos vivem dentro delas, em `/gaveta/[categoria]`
              — com meia dúzia de faturas, a lista aberta aqui era mais comprida
              do que tudo o resto do separador junto. */}
          <SeccaoDocumentos api={documentosApi} />

          {/* Notas */}
          <SeccaoNotas notas={notasApi} />
        </View>
      </ScrollView>

      <ModalRelatorioPrazos
        visivel={relatorioAberto}
        alertas={alertas}
        exploracoes={exploracoes}
        onFechar={() => setRelatorioAberto(false)}
      />
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
  const toast = useToasts();

  async function guardar() {
    if (!editor || aGuardar) return;
    if (!editor.texto.trim() && !editor.titulo.trim()) {
      avisar(t('notas.vaziaTitulo'), t('notas.vaziaMensagem'));
      return;
    }
    setAGuardar(true);
    try {
      await notas.guardarNota({ id: editor.id, titulo: editor.titulo, texto: editor.texto });
      toast.sucesso(
        editor.id ? t('notas.guardada') : t('notas.criada'),
        editor.titulo.trim() || undefined,
      );
      setEditor(null);
    } catch (e) {
      // Fica a interromper: ao contrário do resto da app, as notas NÃO têm fila
      // de sincronização. Sem ligação o texto perde-se, e isso tem de ser lido
      // antes de se fechar a folha.
      avisar(
        t('notas.semGravacao'),
        e instanceof Error ? `${e.message}\n\n${t('notas.precisamLigacao')}` : String(e),
      );
    } finally {
      setAGuardar(false);
    }
  }

  function eliminar() {
    const id = editor?.id;
    if (!id) return;
    confirmar(
      t('notas.eliminarTitulo'),
      t('comum.semVoltaAtras'),
      () => {
        void (async () => {
          try {
            await notas.eliminarNota(id);
            toast.sucesso(t('notas.eliminada'));
            setEditor(null);
          } catch (e) {
            toast.erro(t('comum.semEliminar'), mensagemDeErro(e));
          }
        })();
      },
      { rotuloConfirmar: t('comum.eliminar'), destrutivo: true },
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
          {t('notas.titulo')}
        </Text>
        {notas.aCarregar ? (
          <Text variant="caption" color={colors.textMuted}>
            {t('comum.aCarregar')}
          </Text>
        ) : null}
      </View>

      {notas.notas.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
            <Icon name="note-text-outline" size="lg" color={colors.textMuted} />
            <Text variant="secondary" color={colors.textSecondary} center>
              {t('notas.vazio')}
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
        label={t('notas.nova')}
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
        <FolhaComTeclado>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setEditor(null)}
            accessibilityLabel={t('comum.fechar')}
          />
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
                {editor?.id ? t('notas.editar') : t('notas.nova')}
              </Text>
              <Pressable
                onPress={() => setEditor(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('comum.fechar')}>
                <Icon name="close" size="lg" color={colors.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              value={editor?.titulo ?? ''}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, titulo: t } : e))}
              placeholder={t('notas.tituloOpcional')}
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
              placeholder={t('notas.placeholder')}
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
              label={aGuardar ? t('comum.aGuardar') : t('notas.guardar')}
              icon="check"
              loading={aGuardar}
              onPress={() => void guardar()}
            />
            {editor?.id ? (
              <Button
                label={t('notas.eliminarTitulo')}
                icon="trash-can-outline"
                variant="danger"
                onPress={eliminar}
              />
            ) : null}
          </View>
        </FolhaComTeclado>
      </Modal>
    </View>
  );
}

function CartaoNota({ nota, onPress }: { nota: Nota; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={nota.titulo || t('notas.uma')}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
      <Card>
        <Text variant="bodyStrong" numberOfLines={1}>
          {nota.titulo || t('notas.semTitulo')}
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
