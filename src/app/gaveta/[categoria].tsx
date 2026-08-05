import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  EscolhaVisibilidade,
  FolhaGuardarDocumento,
  type RascunhoDocumento,
} from '@/components/FolhaGuardarDocumento';
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  FolhaComTeclado,
  Header,
  Icon,
  Text,
  TextField,
} from '@/components/ui';
import { useAuth } from '@/data/auth';
import { avisar, confirmar } from '@/data/avisos';
import {
  CATEGORIAS_DOCUMENTO,
  categoriaValida,
  explicacaoCategoria,
  filtrarPorCategoria,
  iconeCategoria,
  tamanhoLegivel,
  type CategoriaDocumento,
  type Documento,
} from '@/data/documentos';
import { escolherDocumento, fotografarDocumento, suportaCamera } from '@/data/ficheiroDocumento';
import { formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useDocumentos } from '@/data/useDocumentos';
import { colors, radii, spacing } from '@/theme';

/**
 * Os documentos de uma gaveta.
 * ------------------------------------------------------------------
 * O separador Documentos mostra só as pastas; é aqui que os papéis estão e é
 * aqui que se lhes mexe. Cada linha diz QUEM o guardou e quem o pode ver — as
 * duas perguntas que se fazem sobre um papel que não se reconhece à primeira.
 */
export default function GavetaScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ categoria?: string }>();
  const api = useDocumentos();
  const { exploracoes } = useGado();
  const { pode, contaSuspensa } = useMembros();
  const { sessao } = useAuth();
  const { nomeDe } = useNomesEquipa();
  const toast = useToasts();

  // O parâmetro vem do URL e pode ser o que for (link guardado, engano a
  // escrever). Um valor desconhecido cai em "Outros" em vez de dar ecrã vazio.
  const categoria: CategoriaDocumento = categoriaValida(params.categoria);

  const [rascunho, setRascunho] = useState<RascunhoDocumento | null>(null);
  const [aEditar, setAEditar] = useState<Documento | null>(null);
  const [aAbrir, setAAbrir] = useState<string | null>(null);

  const disponiveis = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'editarAnimais')),
    [exploracoes, pode],
  );
  const podeGuardar = !contaSuspensa && disponiveis.length > 0;

  const visiveis = useMemo(
    () => filtrarPorCategoria(api.documentos, categoria),
    [api.documentos, categoria],
  );

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
      // A gaveta já está escolhida: é a que se está a ver.
      setRascunho({
        ficheiro: r.ficheiro,
        titulo: '',
        categoria,
        publico: true,
        exploracaoId: disponiveis[0]?.id,
      });
    } catch (e) {
      toast.erro('Não foi possível preparar a imagem', mensagemDeErro(e));
    }
  }

  /**
   * Abre o documento. Uma ligação assinada e de prazo curto, pedida na hora — o
   * bucket é privado e não há URL fixo.
   */
  async function abrir(d: Documento) {
    if (aAbrir) return;
    setAAbrir(d.id);
    try {
      await Linking.openURL(await api.ligacaoPara(d));
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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={categoria} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.sm,
        }}>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>
          {explicacaoCategoria(categoria)}
        </Text>

        {visiveis.length === 0 ? (
          <EmptyState
            icon={iconeCategoria(categoria)}
            title="Gaveta vazia"
            message={
              podeGuardar
                ? 'Fotografe um papel e ele fica aqui — na exploração, e não no telemóvel.'
                : 'Ainda não há nada guardado nesta gaveta.'
            }
          />
        ) : (
          visiveis.map((d) => (
            <CartaoDocumento
              key={d.id}
              documento={d}
              autor={nomeDe(d.criadoPor)}
              souEu={!!d.criadoPor && d.criadoPor === sessao?.user?.id}
              aAbrir={aAbrir === d.id}
              onAbrir={() => void abrir(d)}
              onEditar={() => setAEditar(d)}
              onEliminar={() => eliminar(d)}
            />
          ))
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
              label={suportaCamera ? 'Da galeria' : 'Guardar nesta gaveta'}
              icon={suportaCamera ? 'image-outline' : 'plus'}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void escolher(false)}
            />
          </View>
        ) : null}
      </ScrollView>

      <FolhaGuardarDocumento
        rascunho={rascunho}
        exploracoes={disponiveis}
        onMudar={setRascunho}
        onFechar={() => setRascunho(null)}
        onGuardar={api.carregarDocumento}
      />

      {/* Montada só quando é preciso, e com `key` no id: o rascunho arranca do
          documento no PRIMEIRO render, e sem a chave abrir um segundo documento
          a seguir ao primeiro mostrava os valores do anterior. */}
      {aEditar ? (
        <FolhaEditarDocumento
          key={aEditar.id}
          documento={aEditar}
          onFechar={() => setAEditar(null)}
          onGuardar={api.atualizarDocumento}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Cartão de um documento
 * ------------------------------------------------------------------ */

function CartaoDocumento({
  documento,
  autor,
  souEu,
  aAbrir,
  onAbrir,
  onEditar,
  onEliminar,
}: {
  documento: Documento;
  /** Nome de quem o guardou, se for conhecido. */
  autor?: string;
  souEu: boolean;
  aAbrir: boolean;
  onAbrir: () => void;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  return (
    <Card padded={false}>
      {/* Os três controlos são IRMÃOS e não aninhados: na web, um <button>
          dentro de outro é HTML inválido e os leitores de ecrã anunciavam um só
          controlo com três ações. Mesma nota do `AlertItem`. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs }}>
        <Pressable
          onPress={onAbrir}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${documento.titulo}`}
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
            {/* Quem o guardou. "Guardado por si" e não o próprio nome: numa
                lista onde quase tudo é da mesma pessoa, o nome repetido em
                todas as linhas não distingue nada — o que distingue é a linha
                que NÃO é sua. */}
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {souEu ? 'Guardado por si' : autor ? `Guardado por ${autor}` : 'Autor desconhecido'}
              {' · '}
              {formatDataPt(documento.criadoEm)}
              {documento.tamanho ? ` · ${tamanhoLegivel(documento.tamanho)}` : ''}
            </Text>
            {/* Só o privado leva marca. O público é o normal, e uma etiqueta em
                cada linha a dizer "público" não distinguia nada de nada. */}
            {!documento.publico ? (
              <Badge
                tone="neutral"
                icon="lock-outline"
                label="Só eu vejo"
                style={{ marginTop: 4 }}
              />
            ) : null}
          </View>
          <Icon name="open-in-new" size="sm" color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={onEditar}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={`Alterar ${documento.titulo}`}
          style={({ pressed }) => [
            { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
            pressed && { opacity: 0.6 },
          ]}>
          <Icon name="pencil-outline" size="md" color={colors.primary} />
        </Pressable>

        <Pressable
          onPress={onEliminar}
          hitSlop={spacing.xs}
          accessibilityRole="button"
          accessibilityLabel={`Eliminar ${documento.titulo}`}
          style={({ pressed }) => [
            { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
            pressed && { opacity: 0.6 },
          ]}>
          <Icon name="trash-can-outline" size="md" color={colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 *  Folha de alterar um documento já guardado
 * ------------------------------------------------------------------ */

/**
 * Mudar o nome, a gaveta e quem vê — depois de já estar guardado.
 *
 * O FICHEIRO não se troca aqui: para isso apaga-se e carrega-se outro. Assim o
 * caminho no bucket nunca aponta para coisa diferente da que lá estava quando
 * alguém a viu pela última vez.
 */
function FolhaEditarDocumento({
  documento,
  onFechar,
  onGuardar,
}: {
  documento: Documento;
  onFechar: () => void;
  onGuardar: (
    id: string,
    campos: { titulo?: string; categoria?: CategoriaDocumento; publico?: boolean },
  ) => Promise<void>;
}) {
  const toast = useToasts();
  // O rascunho arranca do documento. Quem o repõe é a `key` de quem monta isto
  // (ver a nota lá em cima): o `useState` só lê o valor inicial uma vez.
  const [titulo, setTitulo] = useState(documento.titulo);
  const [categoria, setCategoria] = useState<CategoriaDocumento>(documento.categoria);
  const [publico, setPublico] = useState(documento.publico);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mexido =
    titulo.trim() !== documento.titulo
    || categoria !== documento.categoria
    || publico !== documento.publico;

  async function guardar() {
    if (aGuardar) return;
    if (!titulo.trim()) {
      setErro('O documento tem de ter um nome.');
      return;
    }
    setAGuardar(true);
    setErro(null);
    try {
      await onGuardar(documento.id, { titulo, categoria, publico });
      toast.sucesso('Documento alterado', titulo.trim());
      onFechar();
    } catch (e) {
      const razao = mensagemDeErro(e);
      setErro(razao);
      toast.erro('Não foi possível alterar', razao);
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onFechar}>
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
              Alterar documento
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
            <View>
              <Text variant="label" style={{ marginBottom: spacing.xs }}>
                O que é
              </Text>
              <TextField
                value={titulo}
                onChangeText={setTitulo}
                placeholder="Ex: Fatura da ração de julho"
                icon="file-document-outline"
              />
            </View>

            <EscolhaVisibilidade publico={publico} onMudar={setPublico} />

            <View>
              <Text variant="label" style={{ marginBottom: spacing.xs }}>
                Gaveta
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                {CATEGORIAS_DOCUMENTO.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    icon={iconeCategoria(c)}
                    selected={categoria === c}
                    onPress={() => setCategoria(c)}
                  />
                ))}
              </View>
            </View>

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
              label={aGuardar ? 'A guardar…' : mexido ? 'Guardar alterações' : 'Fechar'}
              icon={mexido ? 'check' : 'close'}
              loading={aGuardar}
              disabled={aGuardar}
              onPress={mexido ? () => void guardar() : onFechar}
            />

            <Text variant="caption" color={colors.textMuted} center>
              A imagem em si não se troca. Para isso, apague este documento e guarde outro.
            </Text>
          </ScrollView>
        </View>
      </FolhaComTeclado>
    </Modal>
  );
}
