import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Chip, FolhaComTeclado, Icon, Text, TextField } from '@/components/ui';
import {
  CATEGORIAS_DOCUMENTO,
  explicacaoCategoria,
  iconeCategoria,
  problemaComDocumento,
  tamanhoLegivel,
  type CategoriaDocumento,
} from '@/data/documentos';
import type { FicheiroEscolhido } from '@/data/ficheiroDocumento';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import type { UseDocumentos } from '@/data/useDocumentos';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/** O que está a ser guardado, enquanto a folha está aberta. */
export type RascunhoDocumento = {
  ficheiro: FicheiroEscolhido;
  titulo: string;
  categoria: CategoriaDocumento;
  publico: boolean;
  exploracaoId?: string;
};

/**
 * "O que é isto e onde fica" — a folha que aparece depois de a imagem estar
 * escolhida.
 * ------------------------------------------------------------------
 * A ordem importa: perguntar o nome e a gaveta primeiro obrigava a escrevê-los
 * outra vez de cada vez que o seletor de ficheiros fosse cancelado — que, com o
 * dedo e a apanhar a fotografia certa no meio da galeria, é as vezes que forem
 * precisas.
 *
 * Vive à parte porque tem dois donos: a lista de pastas (onde a gaveta se
 * escolhe) e a página de uma pasta (onde já vem escolhida).
 */
export function FolhaGuardarDocumento({
  rascunho,
  exploracoes,
  onMudar,
  onFechar,
  onGuardar,
}: {
  rascunho: RascunhoDocumento | null;
  exploracoes: { id: string; nome: string }[];
  onMudar: (r: RascunhoDocumento | null) => void;
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
      setErro(t('guardarDoc.escolhaExploracao'));
      return;
    }
    setAGuardar(true);
    setErro(null);
    try {
      await onGuardar({
        exploracaoId: rascunho.exploracaoId,
        titulo: rascunho.titulo,
        categoria: rascunho.categoria,
        publico: rascunho.publico,
        ficheiro: rascunho.ficheiro,
      });
      toast.sucesso(t('guardarDoc.guardado'), rascunho.titulo.trim());
      onFechar();
    } catch (e) {
      const razao = mensagemDeErro(e);
      setErro(razao);
      toast.erro(t('guardarDoc.semGuardar'), razao);
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <Modal visible={rascunho !== null} animationType="slide" transparent onRequestClose={onFechar}>
      <FolhaComTeclado>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel={t('comum.fechar')} />
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
              {t('guardarDoc.titulo')}
            </Text>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
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
                  {t('guardarDoc.imagemPronta')}
                  {rascunho ? ` · ${tamanhoLegivel(rascunho.ficheiro.tamanho)}` : ''}
                  {`. ${t('guardarDoc.faltaDizer')}`}
                </Text>
              </View>
            </Card>

            <View>
              <Text variant="label" style={{ marginBottom: spacing.xs }}>
                {t('guardarDoc.oQueE')}
              </Text>
              <TextField
                value={rascunho?.titulo ?? ''}
                onChangeText={(t) => onMudar(rascunho ? { ...rascunho, titulo: t } : rascunho)}
                placeholder={t('gaveta.exTitulo')}
                icon="file-document-outline"
              />
            </View>

            <EscolhaVisibilidade
              publico={rascunho?.publico ?? true}
              onMudar={(v) => onMudar(rascunho ? { ...rascunho, publico: v } : rascunho)}
            />

            <View>
              <Text variant="label" style={{ marginBottom: spacing.xs }}>
                {t('gaveta.gaveta')}
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
                        borderColor: rascunho?.categoria === c ? colors.primary : colors.border,
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
                  {t('formAnimal.exploracao')}
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
              label={aGuardar ? t('comum.aGuardar') : t('guardarDoc.titulo')}
              icon="check"
              loading={aGuardar}
              disabled={aGuardar}
              onPress={() => void guardar()}
            />

            {Platform.OS !== 'web' ? (
              <Text variant="caption" color={colors.textMuted} center>
                {t('guardarDoc.precisaLigacao')}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </FolhaComTeclado>
    </Modal>
  );
}

/**
 * Quem vê este documento.
 *
 * Duas opções escritas por extenso, e não um interruptor com "público" ao lado:
 * o que muda é quem lê aquilo, e essa é a decisão que não pode ficar por
 * perceber. É o mesmo desenho da agenda, de propósito — a pergunta é a mesma e
 * a resposta tem o mesmo peso.
 */
export function EscolhaVisibilidade({
  publico,
  onMudar,
}: {
  publico: boolean;
  onMudar: (publico: boolean) => void;
}) {
  return (
    <View>
      <Text variant="label" style={{ marginBottom: spacing.xs }}>
        {t('guardarDoc.quemVe')}
      </Text>
      <View style={{ gap: spacing.sm }}>
        <Opcao
          icone="account-group"
          titulo={t('guardarDoc.todaEquipa')}
          descricao={t('guardarDoc.todaEquipaDescricao')}
          escolhida={publico}
          onPress={() => onMudar(true)}
        />
        <Opcao
          icone="lock-outline"
          titulo={t('guardarDoc.soEu')}
          descricao={t('guardarDoc.soEuDescricao')}
          escolhida={!publico}
          onPress={() => onMudar(false)}
        />
      </View>
      {/* Dito uma vez, aqui, e não em cada documento: o veterinário nunca vê
          NENHUM, e isso não é a escolha que se está a fazer nesta linha. */}
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
        {t('guardarDoc.vetsNaoVeem')}
      </Text>
    </View>
  );
}

function Opcao({
  icone,
  titulo,
  descricao,
  escolhida,
  onPress,
}: {
  icone: 'account-group' | 'lock-outline';
  titulo: string;
  descricao: string;
  escolhida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhida }}
      accessibilityLabel={`${titulo}. ${descricao}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radii.md,
          borderWidth: escolhida ? 2 : 1,
          borderColor: escolhida ? colors.primary : colors.border,
          backgroundColor: escolhida ? colors.primaryTint : colors.surface,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icone} size="md" color={escolhida ? colors.primaryDark : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={escolhida ? colors.primaryDark : colors.text}>
          {titulo}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {descricao}
        </Text>
      </View>
      <Icon
        name={escolhida ? 'check-circle' : 'circle-outline'}
        size="md"
        color={escolhida ? colors.primary : colors.textMuted}
      />
    </Pressable>
  );
}
