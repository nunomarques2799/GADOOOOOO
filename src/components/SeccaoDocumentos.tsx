import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  FolhaGuardarDocumento,
  type RascunhoDocumento,
} from '@/components/FolhaGuardarDocumento';
import { Button, Card, Icon, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import {
  CATEGORIAS_DOCUMENTO,
  CATEGORIA_OMISSAO,
  contarPorCategoria,
  explicacaoCategoria,
  iconeCategoria,
  type CategoriaDocumento,
} from '@/data/documentos';
import { escolherDocumento, fotografarDocumento, suportaCamera } from '@/data/ficheiroDocumento';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import type { UseDocumentos } from '@/data/useDocumentos';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * As GAVETAS dos documentos guardados.
 * ------------------------------------------------------------------
 * Isto era uma lista de todos os documentos, um a um, no meio do separador. Com
 * meia dúzia de faturas já era mais comprida do que tudo o resto junto, e o
 * separador — que também tem importar, exportar e as notas — passava a ser uma
 * pilha de papéis com o resto escondido por baixo.
 *
 * Passam a ser quatro pastas com a contagem. Os documentos vivem lá dentro, em
 * `/gaveta/[categoria]`, que é onde se lhes mexe: abrir, mudar o nome, mudar
 * quem os vê, apagar.
 */
export function SeccaoDocumentos({ api }: { api: UseDocumentos }) {
  const router = useRouter();
  const { exploracoes } = useGado();
  const { pode, contaSuspensa } = useMembros();
  const toast = useToasts();

  const [rascunho, setRascunho] = useState<RascunhoDocumento | null>(null);

  // Só as explorações onde esta pessoa pode mesmo guardar. Sem o filtro, a
  // folha oferecia uma exploração que a RLS ia recusar no fim.
  const disponiveis = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'editarAnimais')),
    [exploracoes, pode],
  );
  const podeGuardar = !contaSuspensa && disponiveis.length > 0;

  const contagem = useMemo(() => contarPorCategoria(api.documentos), [api.documentos]);

  /** Abre o seletor, prepara a imagem e mostra a folha do nome/gaveta. */
  async function escolher(comCamera: boolean, categoria: CategoriaDocumento) {
    try {
      const r = comCamera ? await fotografarDocumento() : await escolherDocumento();
      if (r.estado === 'sem-permissao') {
        avisar(
          t('gaveta.semAcesso'),
          comCamera
            ? t('gaveta.semCamara')
            : t('gaveta.semGaleria'),
        );
        return;
      }
      if (r.estado === 'cancelado') return;
      setRascunho({
        ficheiro: r.ficheiro,
        titulo: '',
        categoria,
        // Nasce PÚBLICO, que é o caso comum: a fatura da ração e a guia de
        // circulação são papéis da casa. Quem quer o contrário muda numa linha
        // que está à vista na mesma folha.
        publico: true,
        exploracaoId: disponiveis[0]?.id,
      });
    } catch (e) {
      toast.erro(t('gaveta.semImagem'), mensagemDeErro(e));
    }
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

      {/* As quatro pastas, sempre as quatro — mesmo vazias. Uma gaveta que só
          aparece depois de ter alguma coisa dentro não ensina onde arrumar o
          primeiro papel. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {CATEGORIAS_DOCUMENTO.map((c) => (
          <Pasta
            key={c}
            categoria={c}
            quantos={contagem[c]}
            onPress={() =>
              router.push({ pathname: '/gaveta/[categoria]', params: { categoria: c } })
            }
          />
        ))}
      </View>

      {podeGuardar ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
          {suportaCamera ? (
            <Button
              label={t('gaveta.fotografar')}
              icon="camera-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void escolher(true, CATEGORIA_OMISSAO)}
            />
          ) : null}
          <Button
            label={suportaCamera ? t('gaveta.daGaleria') : t('guardarDoc.titulo')}
            icon={suportaCamera ? 'image-outline' : 'plus'}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => void escolher(false, CATEGORIA_OMISSAO)}
          />
        </View>
      ) : (
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          {contaSuspensa
            ? t('seccaoDocs.contaSuspensa')
            : t('seccaoDocs.semPermissao')}
        </Text>
      )}

      <FolhaGuardarDocumento
        rascunho={rascunho}
        exploracoes={disponiveis}
        onMudar={setRascunho}
        onFechar={() => setRascunho(null)}
        onGuardar={api.carregarDocumento}
      />
    </View>
  );
}

/**
 * Uma gaveta.
 *
 * Duas por linha e não quatro: a quatro, o nome "Documentos pessoais" partia-se
 * em três linhas num telemóvel de 375px — e em quatro com a letra do sistema no
 * máximo, que é o cenário que esta app tem de aguentar.
 */
function Pasta({
  categoria,
  quantos,
  onPress,
}: {
  categoria: CategoriaDocumento;
  quantos: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${categoria}. ${
        quantos === 0
          ? t('seccaoDocs.vazia')
          : `${quantos} ${quantos === 1 ? 'documento' : 'documentos'}.`
      } ${explicacaoCategoria(categoria)}`}
      style={({ pressed }) => [
        {
          // `48%` e não `50%`: o `gap` do contentor soma-se à largura, e a dois
          // por linha exatos a segunda pasta descia para a linha seguinte.
          width: '48%',
          flexGrow: 1,
          padding: spacing.md,
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          gap: spacing.xs,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: quantos > 0 ? colors.primaryTint : colors.surfaceSunken,
          }}>
          <Icon
            name={iconeCategoria(categoria)}
            size="md"
            color={quantos > 0 ? colors.primaryDark : colors.textMuted}
          />
        </View>
        <Icon name="chevron-right" size="sm" color={colors.textMuted} />
      </View>
      <Text variant="bodyStrong" numberOfLines={2}>
        {categoria}
      </Text>
      <Text variant="caption" color={quantos > 0 ? colors.textSecondary : colors.textMuted}>
        {quantos === 0 ? t('seccaoDocs.vaziaCurto') : t('seccaoDocs.nDocumentos', { n: quantos })}
      </Text>
    </Pressable>
  );
}
