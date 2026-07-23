import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimalRow } from '@/components/AnimalRow';
import { FolhaFiltros, type Disponivel } from '@/components/FolhaFiltros';
import { Button, Chip, EmptyState, FAB, Icon, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import {
  contarAtivos,
  FAIXAS,
  filtrarAnimais,
  mapaAlertas,
  rotuloCategoriaAlerta,
  SEM_TERRENO,
  valoresPresentes,
  type Filtros,
} from '@/data/filtrosAnimais';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

export default function AnimaisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { animais, alertas, terrenos, terrenoById } = useGado();
  // Com a conta suspensa nada se grava — o formulário só levaria a um erro no
  // fim. O papel não se verifica aqui porque a exploração ainda não está
  // escolhida (é o formulário que a pede); isso fica para o `guardar`.
  const { contaSuspensa } = useMembros();

  const [filtros, setFiltros] = useState<Filtros>({});
  const [folhaAberta, setFolhaAberta] = useState(false);

  const porAnimal = useMemo(() => mapaAlertas(alertas), [alertas]);

  const ativos = useMemo(
    () => animais.filter((a) => !a.estado || a.estado === 'ativo'),
    [animais],
  );
  const nSaidos = animais.length - ativos.length;

  // As opções saem do efetivo ATIVO: oferecer uma raça que só existe em
  // animais vendidos dava um filtro que devolve zero sem explicação.
  const presentes = useMemo(() => valoresPresentes(ativos), [ativos]);

  const disponivel = useMemo<Disponivel>(
    () => ({
      ...presentes,
      terrenos: terrenos.filter((t) => ativos.some((a) => a.terrenoId === t.id)),
      temSemTerreno: ativos.some((a) => !a.terrenoId),
      categoriasAlerta: [...new Set(alertas.map((a) => a.categoria))].sort(),
      temSaidos: nSaidos,
    }),
    [presentes, terrenos, ativos, alertas, nSaidos],
  );

  const lista = useMemo(
    () =>
      filtrarAnimais(animais, filtros, porAnimal).sort((a, b) =>
        (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(
          b.nome ?? b.numeroIdentificacao ?? '',
          'pt',
        ),
      ),
    [animais, filtros, porAnimal],
  );

  const nAtivos = contarAtivos(filtros);
  const temPesquisa = !!filtros.texto?.trim();

  /** Etiquetas do que está a filtrar, para se poder tirar uma a uma. */
  const etiquetas = useMemo(() => {
    const out: { chave: string; label: string; limpar: () => void }[] = [];
    const tirar = (k: keyof Filtros) => () => setFiltros((f) => ({ ...f, [k]: undefined }));

    if (filtros.especie) out.push({ chave: 'especie', label: especieMeta[filtros.especie].plural, limpar: tirar('especie') });
    if (filtros.sexo) out.push({ chave: 'sexo', label: filtros.sexo === 'Fêmea' ? 'Fêmeas' : 'Machos', limpar: tirar('sexo') });
    if (filtros.prenhe !== undefined) out.push({ chave: 'prenhe', label: filtros.prenhe ? 'Cobertas' : 'Não cobertas', limpar: tirar('prenhe') });
    if (filtros.idade) out.push({ chave: 'idade', label: FAIXAS.find((f) => f.valor === filtros.idade)?.label ?? '', limpar: tirar('idade') });
    if (filtros.raca) out.push({ chave: 'raca', label: filtros.raca, limpar: tirar('raca') });
    if (filtros.cor) out.push({ chave: 'cor', label: filtros.cor, limpar: tirar('cor') });
    if (filtros.finalidade) out.push({ chave: 'finalidade', label: filtros.finalidade, limpar: tirar('finalidade') });
    if (filtros.casa) out.push({ chave: 'casa', label: `Casa ${filtros.casa}`, limpar: tirar('casa') });
    if (filtros.terrenoId) {
      const nome = filtros.terrenoId === SEM_TERRENO ? 'Sem terreno' : (terrenoById(filtros.terrenoId)?.nome ?? 'Terreno');
      out.push({ chave: 'terreno', label: nome, limpar: tirar('terrenoId') });
    }
    if (filtros.alerta) {
      const label = filtros.alerta === true ? 'Com alertas' : rotuloCategoriaAlerta[filtros.alerta];
      out.push({ chave: 'alerta', label, limpar: tirar('alerta') });
    }
    if (filtros.semBrinco) out.push({ chave: 'semBrinco', label: 'Sem brinco', limpar: tirar('semBrinco') });
    if (filtros.incluirSaidos) out.push({ chave: 'arquivo', label: 'Com arquivo', limpar: tirar('incluirSaidos') });
    return out;
  }, [filtros, terrenoById]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        // numColumns não muda a quente — a key força a lista a remontar
        // quando se passa de telemóvel (pilha) para desktop (grelha).
        key={desktop ? 'grelha' : 'pilha'}
        data={lista}
        keyExtractor={(a) => a.id}
        numColumns={desktop ? 2 : 1}
        columnWrapperStyle={desktop ? { gap: spacing.sm } : undefined}
        renderItem={({ item }) =>
          desktop ? (
            <View style={{ flex: 1 }}>
              <AnimalRow animal={item} />
            </View>
          ) : (
            <AnimalRow animal={item} />
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: desktop ? layout.conteudoDesktop : undefined,
          alignSelf: 'center',
          paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text variant="display">Animais</Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                {/* Quando há filtros, o que interessa é quantos deles se está a
                    ver — o total do efetivo passa a ser a segunda pergunta. */}
                {nAtivos > 0 || temPesquisa
                  ? `${lista.length} de ${ativos.length}`
                  : `${ativos.length} no efetivo`}
              </Text>
            </View>

            {/* Pesquisa + botão de filtros */}
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  backgroundColor: colors.surface,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  height: 52,
                }}>
                <Icon name="magnify" size="md" color={colors.textMuted} />
                <TextInput
                  value={filtros.texto ?? ''}
                  onChangeText={(t) => setFiltros((f) => ({ ...f, texto: t }))}
                  placeholder="Nome, brinco, raça ou casa"
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    fontFamily: 'Nunito_500Medium',
                    fontSize: 16,
                    color: colors.text,
                  }}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>
              <Pressable
                onPress={() => setFolhaAberta(true)}
                accessibilityRole="button"
                accessibilityLabel={
                  nAtivos > 0 ? `Filtros, ${nAtivos} ativos` : 'Filtros'
                }
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: spacing.md,
                    height: 52,
                    borderRadius: radii.pill,
                    borderWidth: 1,
                    borderColor: nAtivos > 0 ? colors.primary : colors.border,
                    backgroundColor: nAtivos > 0 ? colors.primaryTint : colors.surface,
                  },
                  pressed && { opacity: 0.8 },
                ]}>
                <Icon
                  name="filter-variant"
                  size="md"
                  color={nAtivos > 0 ? colors.primary : colors.textMuted}
                />
                {nAtivos > 0 ? (
                  <Text variant="bodyStrong" color={colors.primaryDark}>
                    {nAtivos}
                  </Text>
                ) : null}
              </Pressable>
            </View>

            {/* Importar de Excel — só web/Electron, onde há seletor de ficheiros.
                No telemóvel a lista continua a registar-se com o "Registar". */}
            {Platform.OS === 'web' && !contaSuspensa ? (
              <View style={{ alignItems: 'flex-start', marginBottom: spacing.sm }}>
                <Button
                  label="Importar de Excel"
                  icon="microsoft-excel"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => router.push('/animal/importar')}
                />
              </View>
            ) : null}

            {/* O que está a filtrar, para se tirar sem reabrir a folha */}
            {etiquetas.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}>
                {etiquetas.map((e) => (
                  <Chip key={e.chave} label={e.label} icon="close" selected onPress={e.limpar} />
                ))}
                {etiquetas.length > 1 ? (
                  <Pressable
                    onPress={() => setFiltros({ texto: filtros.texto })}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar todos os filtros"
                    style={({ pressed }) => [
                      { justifyContent: 'center', paddingHorizontal: spacing.xs },
                      pressed && { opacity: 0.6 },
                    ]}>
                    <Text variant="bodyStrong" color={colors.danger}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cow-off"
            title="Nenhum animal encontrado"
            message={
              nAtivos > 0 || temPesquisa
                ? 'Experimente ajustar a pesquisa ou os filtros.'
                : 'Ainda não há animais registados. Comece por adicionar o primeiro.'
            }
            actionLabel={
              nAtivos > 0 || temPesquisa
                ? 'Limpar filtros'
                : contaSuspensa
                  ? undefined
                  : 'Registar animal'
            }
            onAction={
              nAtivos > 0 || temPesquisa
                ? () => setFiltros({})
                : () => router.push('/animal/novo')
            }
          />
        }
      />

      <FolhaFiltros
        aberto={folhaAberta}
        filtros={filtros}
        disponivel={disponivel}
        total={lista.length}
        onFechar={() => setFolhaAberta(false)}
        onMudar={setFiltros}
        onLimpar={() => setFiltros({ texto: filtros.texto })}
      />

      {contaSuspensa ? null : (
        <FAB label="Registar" onPress={() => router.push('/animal/novo')} />
      )}
    </View>
  );
}
