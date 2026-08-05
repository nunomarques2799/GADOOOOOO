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
      toast.sucesso('Ficheiro descarregado', `${nomeFicheiro} · ${quantos}`);
    } catch (e) {
      toast.erro('Não foi possível descarregar', mensagemDeErro(e));
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
            <Text variant="display">Documentos</Text>
            <Text variant="body" color={colors.textSecondary}>
              Importar, exportar e as suas notas
            </Text>
          </View>
          <View style={coluna}>
            <EmptyState
              icon="lock-outline"
              title="Documentos reservados à exploração"
              message="Importar e exportar o efetivo é de quem tem a exploração a cargo. Pode continuar a consultar os animais e a registar o que fizer a cada um."
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
          <Text variant="display">Documentos</Text>
          <Text variant="body" color={colors.textSecondary}>
            Guardar papéis, importar, exportar e as suas notas
          </Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* À primeira vez, o que é este separador. "Documentos" parece uma
              gaveta de ficheiros, e é por aqui que se traz o efetivo inteiro de
              um Excel — o atalho que poupa uma tarde de escrita à mão a quem
              não faz ideia de que ele existe. */}
          <CartaoIntroducao
            chave="documentos"
            icon="file-document-multiple-outline"
            titulo="Para que serve este separador"
            pontos={[
              'Guarde aqui os papéis que recebe: fotografe a fatura da ração, a guia de circulação ou o recibo do veterinário e ficam arrumados por gaveta, na exploração e não no telemóvel.',
              'Se já tem os animais escritos num ficheiro Excel, pode trazê-los todos de uma vez em vez de os escrever um a um.',
              'Daqui também leva os seus dados para fora: a lista de animais em Excel, e relatórios de prazos para imprimir ou entregar.',
              'As notas são suas e só suas: servem para o que não cabe na ficha de um animal — combinações, telefones, o que ficou por fazer.',
              'Importar e exportar ficheiros só funciona no computador. Guardar documentos e as notas funcionam também no telemóvel.',
            ]}
          />


          {/* O SNIRA vem PRIMEIRO, e fora do grupo das exportações: não é um
              ficheiro que se leva, é trabalho que tem prazo legal a correr. O
              número ao lado é o que falta comunicar — quando é zero, a linha
              continua lá a dizer que está tudo em dia.

              Funciona no telemóvel, ao contrário de tudo o resto deste ecrã: a
              lista lê-se e marca-se sem precisar de disco. Só levar a folha em
              Excel ou em papel é que é do computador. */}
          <Grupo titulo="OBRIGAÇÕES">
            <Linha
              icon="cloud-upload-outline"
              label="Comunicar ao SNIRA"
              trailing={
                porComunicar === 0 ? 'em dia' : String(porComunicar)
              }
              onPress={() => router.push('/snira')}
              last
            />
          </Grupo>

          {/* Importar — só web/Electron (o telemóvel não escolhe ficheiros sem build nativo) */}
          {comFicheiros && !contaSuspensa ? (
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
            {comFicheiros ? (
              <>
                <Linha
                  icon="microsoft-excel"
                  label="Exportar animais (Excel)"
                  trailing={String(exportaveis.length)}
                  onPress={() =>
                    descarregar(
                      `animais-${hojeISO()}.xlsx`,
                      `${exportaveis.length} ${exportaveis.length === 1 ? 'animal' : 'animais'}`,
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
                  label="Exportar eventos (Excel)"
                  trailing={String(eventos.length)}
                  onPress={() =>
                    descarregar(
                      `eventos-${hojeISO()}.xlsx`,
                      `${eventos.length} ${eventos.length === 1 ? 'registo' : 'registos'}`,
                      () =>
                        descarregarTabelaExcel(
                          `eventos-${hojeISO()}.xlsx`,
                          'Eventos',
                          tabelaEventos(eventos, animais),
                        ),
                    )
                  }
                />
                {/* Imprimir e PDF juntos: escolhe-se o que sai e só depois o destino. */}
                <Linha
                  icon="printer-outline"
                  label="Relatório de prazos (imprimir ou PDF)"
                  trailing={String(alertas.length)}
                  onPress={() => setRelatorioAberto(true)}
                />
              </>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}>
                <Icon name="laptop" size="lg" color={colors.info} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">Ficheiros são do computador</Text>
                  <Text variant="secondary" color={colors.textSecondary}>
                    Exportar para Excel, imprimir e guardar relatórios em PDF faz-se na app
                    de computador ou no site da app: é lá que há onde guardar os ficheiros.
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
      avisar('Nota vazia', 'Escreva alguma coisa antes de guardar.');
      return;
    }
    setAGuardar(true);
    try {
      await notas.guardarNota({ id: editor.id, titulo: editor.titulo, texto: editor.texto });
      toast.sucesso(editor.id ? 'Nota guardada' : 'Nota criada', editor.titulo.trim() || undefined);
      setEditor(null);
    } catch (e) {
      // Fica a interromper: ao contrário do resto da app, as notas NÃO têm fila
      // de sincronização — sem ligação o texto perde-se, e isso tem de ser lido
      // antes de se fechar a folha.
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
            toast.sucesso('Nota eliminada');
            setEditor(null);
          } catch (e) {
            toast.erro('Não foi possível eliminar', mensagemDeErro(e));
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
              Ainda não tem notas. Guarde aqui o que precisar de ter à mão: contactos,
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
        <FolhaComTeclado>
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
