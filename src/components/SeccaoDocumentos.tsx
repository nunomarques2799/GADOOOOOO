import { useMemo, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  FolhaComTeclado,
  Icon,
  Text,
  TextField,
} from '@/components/ui';
import { avisar, confirmar } from '@/data/avisos';
import {
  CATEGORIAS_DOCUMENTO,
  CATEGORIA_OMISSAO,
  explicacaoCategoria,
  filtrarPorCategoria,
  iconeCategoria,
  problemaComDocumento,
  tamanhoLegivel,
  type CategoriaDocumento,
  type Documento,
} from '@/data/documentos';
import {
  escolherDocumento,
  fotografarDocumento,
  suportaCamera,
  type FicheiroEscolhido,
} from '@/data/ficheiroDocumento';
import { formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import type { UseDocumentos } from '@/data/useDocumentos';
import { colors, radii, spacing } from '@/theme';

/**
 * Os documentos guardados na exploração — faturas, guias, papéis.
 * ------------------------------------------------------------------
 * A outra metade do separador: até aqui só saíam ficheiros (exportações,
 * relatórios) e havia notas de texto. Isto é o que ENTRA e fica.
 *
 * O ficheiro vive no Supabase Storage, e não numa coluna como a foto do animal
 * — ver o cabeçalho de `supabase/schema_documentos.sql` para o porquê. Aqui,
 * o que se vê é sempre a mesma coisa: um nome, uma gaveta e uma data.
 */
export function SeccaoDocumentos({ api }: { api: UseDocumentos }) {
  const { exploracoes } = useGado();
  const { pode, contaSuspensa } = useMembros();
  const toast = useToasts();

  const [gaveta, setGaveta] = useState<CategoriaDocumento | undefined>(undefined);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [aAbrir, setAAbrir] = useState<string | null>(null);

  // Só as explorações onde esta pessoa pode mesmo guardar. Sem o filtro, o
  // formulário oferecia uma exploração que a RLS ia recusar no fim.
  const disponiveis = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'editarAnimais')),
    [exploracoes, pode],
  );
  const podeGuardar = !contaSuspensa && disponiveis.length > 0;

  const visiveis = useMemo(
    () => filtrarPorCategoria(api.documentos, gaveta),
    [api.documentos, gaveta],
  );

  /** Abre o seletor, prepara a imagem e mostra o formulário do nome/gaveta. */
  async function escolher(comCamera: boolean) {
    try {
      const r = comCamera ? await fotografarDocumento() : await escolherDocumento();
      if (r.estado === 'sem-permissao') {
        avisar(
          'Sem acesso',
          comCamera
            ? 'A app precisa de autorização para usar a câmara. Pode dá-la nas definições do telemóvel.'
            : 'A app precisa de autorização para ver as suas fotografias.',
        );
        return;
      }
      if (r.estado === 'cancelado') return;
      setRascunho({
        ficheiro: r.ficheiro,
        titulo: '',
        categoria: CATEGORIA_OMISSAO,
        exploracaoId: disponiveis[0]?.id,
      });
    } catch (e) {
      toast.erro('Não foi possível preparar a imagem', mensagemDeErro(e));
    }
  }

  /**
   * Abre o documento.
   *
   * Uma ligação assinada e de prazo curto, pedida na hora — o bucket é privado
   * e não há URL fixo. `Linking.openURL` serve as duas plataformas: no
   * navegador abre noutro separador, no telemóvel no visualizador do sistema.
   */
  async function abrir(d: Documento) {
    if (aAbrir) return;
    setAAbrir(d.id);
    try {
      const url = await api.ligacaoPara(d);
      await Linking.openURL(url);
    } catch (e) {
      toast.erro('Não foi possível abrir', mensagemDeErro(e));
    } finally {
      setAAbrir(null);
    }
  }

  function eliminar(d: Documento) {
    confirmar(
      'Eliminar documento',
      `Vai apagar "${d.titulo}" e a imagem que lhe está guardada. Não há como voltar atrás.`,
      () => {
        void (async () => {
          try {
            await api.eliminarDocumento(d.id);
            toast.sucesso('Documento eliminado', d.titulo);
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
          OS SEUS DOCUMENTOS
        </Text>
        {api.aCarregar ? (
          <Text variant="caption" color={colors.textMuted}>
            a carregar…
          </Text>
        ) : null}
      </View>

      {/* As gavetas. Só aparecem com documentos que dê para filtrar — com dois
          papéis guardados, quatro chips são mais botões do que conteúdo. */}
      {api.documentos.length > 2 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.xs,
            marginBottom: spacing.sm,
          }}>
          <Chip
            label={`Todos (${api.documentos.length})`}
            selected={gaveta === undefined}
            onPress={() => setGaveta(undefined)}
          />
          {CATEGORIAS_DOCUMENTO.map((c) => {
            const quantos = api.documentos.filter((d) => d.categoria === c).length;
            if (quantos === 0) return null;
            return (
              <Chip
                key={c}
                label={`${c} (${quantos})`}
                icon={iconeCategoria(c)}
                selected={gaveta === c}
                onPress={() => setGaveta(gaveta === c ? undefined : c)}
              />
            );
          })}
        </View>
      ) : null}

      {api.erro ? (
        <Card style={{ backgroundColor: colors.dangerTint, marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Icon name="alert-circle-outline" size="md" color={colors.danger} />
            <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
              Não foi possível ir buscar os documentos. Está a ver o que ficou guardado da
              última vez. ({api.erro})
            </Text>
          </View>
        </Card>
      ) : null}

      {visiveis.length === 0 ? (
        <Card>
          <View style={{ alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
            <Icon name="file-image-outline" size="lg" color={colors.textMuted} />
            <Text variant="secondary" color={colors.textSecondary} center>
              {gaveta
                ? `Nada guardado em "${gaveta}".`
                : 'Ainda não guardou nenhum documento. Fotografe uma fatura, uma guia ou um recibo e fica aqui — na exploração, e não no telemóvel.'}
            </Text>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {visiveis.map((d) => (
            <CartaoDocumento
              key={d.id}
              documento={d}
              aAbrir={aAbrir === d.id}
              onAbrir={() => void abrir(d)}
              onEliminar={() => eliminar(d)}
            />
          ))}
        </View>
      )}

      {podeGuardar ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          {suportaCamera ? (
            <Button
              label="Fotografar"
              icon="camera-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void escolher(true)}
            />
          ) : null}
          <Button
            label={suportaCamera ? 'Da galeria' : 'Guardar documento'}
            icon={suportaCamera ? 'image-outline' : 'plus'}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => void escolher(false)}
          />
        </View>
      ) : (
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          {contaSuspensa
            ? 'Com a conta por regularizar pode consultar os documentos, mas não guardar novos.'
            : 'Guardar documentos é de quem tem uma exploração a cargo.'}
        </Text>
      )}

      <FolhaNovoDocumento
        rascunho={rascunho}
        exploracoes={disponiveis}
        onMudar={setRascunho}
        onFechar={() => setRascunho(null)}
        onGuardar={api.carregarDocumento}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Cartão de um documento
 * ------------------------------------------------------------------ */

function CartaoDocumento({
  documento,
  aAbrir,
  onAbrir,
  onEliminar,
}: {
  documento: Documento;
  aAbrir: boolean;
  onAbrir: () => void;
  onEliminar: () => void;
}) {
  return (
    <Card padded={false}>
      {/* A linha é uma View com dois Pressable IRMÃOS e não um dentro do outro:
          aninhados, a web gerava um <button> dentro de outro (HTML inválido) e
          os leitores de ecrã anunciavam um só controlo com duas ações. É a
          mesma nota do `AlertItem`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing.sm }}>
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${documento.titulo}`}
          accessibilityHint="Abre a imagem guardada"
          style={({ pressed }) => [
            {
              flex: 1,
              minWidth: 0,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
            },
            pressed && { opacity: 0.6 },
          ]}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radii.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.primaryTint,
            }}>
            <Icon
              name={aAbrir ? 'progress-download' : iconeCategoria(documento.categoria)}
              size="md"
              color={colors.primaryDark}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="bodyStrong" numberOfLines={2}>
              {documento.titulo}
            </Text>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {documento.categoria} · {formatDataPt(documento.criadoEm)}
              {documento.tamanho ? ` · ${tamanhoLegivel(documento.tamanho)}` : ''}
            </Text>
          </View>
          <Icon name="open-in-new" size="sm" color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={onEliminar}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${documento.titulo}`}
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed && { opacity: 0.6 },
          ]}>
          <Icon name="trash-can-outline" size="md" color={colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 *  Folha de "guardar este documento"
 * ------------------------------------------------------------------ */

type Rascunho = {
  ficheiro: FicheiroEscolhido;
  titulo: string;
  categoria: CategoriaDocumento;
  exploracaoId?: string;
};

/**
 * Abre DEPOIS de a imagem estar escolhida e preparada, e não antes.
 *
 * A ordem importa: perguntar o nome e a gaveta primeiro obrigava a escrevê-los
 * outra vez de cada vez que o seletor de ficheiros fosse cancelado — que, com o
 * dedo e a apanhar a fotografia certa no meio da galeria, é as vezes que forem
 * precisas.
 */
function FolhaNovoDocumento({
  rascunho,
  exploracoes,
  onMudar,
  onFechar,
  onGuardar,
}: {
  rascunho: Rascunho | null;
  exploracoes: { id: string; nome: string }[];
  onMudar: (r: Rascunho | null) => void;
  onFechar: () => void;
  onGuardar: UseDocumentos['carregarDocumento'];
}) {
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const toast = useToasts();

  async function guardar() {
    if (!rascunho || aGuardar) return;
    const problema = problemaComDocumento(rascunho.titulo, rascunho.ficheiro.tamanho);
    if (problema) {
      setErro(problema);
      return;
    }
    if (!rascunho.exploracaoId) {
      setErro('Escolha a exploração a que este documento pertence.');
      return;
    }
    setAGuardar(true);
    setErro(null);
    try {
      await onGuardar({
        exploracaoId: rascunho.exploracaoId,
        titulo: rascunho.titulo,
        categoria: rascunho.categoria,
        ficheiro: rascunho.ficheiro,
      });
      toast.sucesso('Documento guardado', rascunho.titulo.trim());
      onFechar();
    } catch (e) {
      const razao = mensagemDeErro(e);
      setErro(razao);
      toast.erro('Documento não guardado', razao);
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Modal visible={rascunho !== null} animationType="slide" transparent onRequestClose={onFechar}>
      <FolhaComTeclado>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel="Fechar" />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingTop: spacing.lg,
            maxHeight: '90%',
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.sm,
            }}>
            <Text variant="h3" style={{ flex: 1 }}>
              Guardar documento
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing.xxl,
              gap: spacing.md,
            }}>
            <Card style={{ backgroundColor: colors.successTint }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="image-check-outline" size="lg" color={colors.success} />
                <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                  Imagem pronta{rascunho ? ` · ${tamanhoLegivel(rascunho.ficheiro.tamanho)}` : ''}.
                  Falta dizer o que é e em que gaveta fica.
                </Text>
              </View>
            </Card>

            <View>
              <Text variant="label" style={{ marginBottom: spacing.xs }}>
                O que é
              </Text>
              <TextField
                value={rascunho?.titulo ?? ''}
                onChangeText={(t) => onMudar(rascunho ? { ...rascunho, titulo: t } : rascunho)}
                placeholder="Ex: Fatura da ração de julho"
                icon="file-document-outline"
              />
            </View>

            <View>
              <Text variant="label" style={{ marginBottom: spacing.xs }}>
                Gaveta
              </Text>
              <View style={{ gap: spacing.xs }}>
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => onMudar(rascunho ? { ...rascunho, categoria: c } : rascunho)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rascunho?.categoria === c }}
                    accessibilityLabel={`${c}. ${explicacaoCategoria(c)}`}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        padding: spacing.md,
                        borderRadius: radii.md,
                        borderWidth: rascunho?.categoria === c ? 2 : 1,
                        borderColor:
                          rascunho?.categoria === c ? colors.primary : colors.border,
                        backgroundColor:
                          rascunho?.categoria === c ? colors.primaryTint : colors.surface,
                      },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <Icon
                      name={iconeCategoria(c)}
                      size="md"
                      color={rascunho?.categoria === c ? colors.primaryDark : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="bodyStrong"
                        color={rascunho?.categoria === c ? colors.primaryDark : colors.text}>
                        {c}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {explicacaoCategoria(c)}
                      </Text>
                    </View>
                    {rascunho?.categoria === c ? (
                      <Icon name="check-circle" size="md" color={colors.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>

            {exploracoes.length > 1 ? (
              <View>
                <Text variant="label" style={{ marginBottom: spacing.xs }}>
                  Exploração
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                  {exploracoes.map((e) => (
                    <Chip
                      key={e.id}
                      label={e.nome}
                      icon="barn"
                      selected={rascunho?.exploracaoId === e.id}
                      onPress={() =>
                        onMudar(rascunho ? { ...rascunho, exploracaoId: e.id } : rascunho)
                      }
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {erro ? (
              <Card style={{ backgroundColor: colors.dangerTint }}>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Icon name="alert-circle-outline" size="md" color={colors.danger} />
                  <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                    {erro}
                  </Text>
                </View>
              </Card>
            ) : null}

            <Button
              label={aGuardar ? 'A guardar…' : 'Guardar documento'}
              icon="check"
              loading={aGuardar}
              disabled={aGuardar}
              onPress={() => void guardar()}
            />

            {Platform.OS !== 'web' ? (
              <Text variant="caption" color={colors.textMuted} center>
                Guardar um documento precisa de ligação — a imagem sobe para a sua conta.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </FolhaComTeclado>
    </Modal>
  );
}
