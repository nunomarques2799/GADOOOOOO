import { useRouter } from 'expo-router';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimalRow } from '@/components/AnimalRow';
import { FolhaFiltros } from '@/components/FolhaFiltros';
import { Button, Chip, EmptyState, FAB, Icon, type IconName, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import {
  contarAtivos,
  facetasDisponiveis,
  FAIXAS,
  filtrarAnimais,
  mapaAlertas,
  mapaGravidade,
  ordenarAnimais,
  ORDENACAO_OMISSAO,
  ordenacoes,
  rotuloCategoriaAlerta,
  SEM_TERRENO,
  type Filtros,
  type Ordenacao,
} from '@/data/filtrosAnimais';
import { saiuDoEfetivo } from '@/data/historicoAnimais';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Uma fila de chips que NÃO se empilha no telemóvel.
 *
 * Em `flexWrap` — que é como estas duas filas estavam — cada chip que não cabe
 * salta para a linha de baixo. Com quatro explorações de nomes compridos
 * ("Herdade do Vale Escuro") dava uma linha por exploração, mais três linhas de
 * ordenação por baixo: seis linhas de botões entre o título e o primeiro
 * animal, num ecrã onde cabem cinco. Era o "encavalitado" — não estava nada
 * sobreposto, estava tudo empilhado.
 *
 * A rolar na horizontal, ocupa uma linha e só uma, custe o que custar o nome da
 * quinta. Em desktop mantém-se o `flexWrap`: lá há largura para tudo caber, e
 * uma fila que rola quando não precisa esconde opções sem razão.
 */
function LinhaChips({
  children,
  desktop,
  antes,
}: {
  children: ReactNode;
  desktop: boolean;
  /** Fica colado ao início da fila e rola com ela (o rótulo "Ordenar:"). */
  antes?: ReactNode;
}) {
  if (desktop) {
    return (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: spacing.xs,
          marginBottom: spacing.sm,
        }}>
        {antes}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Sem isto, tocar num chip a meio de um arrasto escolhia-o.
      keyboardShouldPersistTaps="handled"
      style={{ marginBottom: spacing.sm }}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        // Folga no fim para o último chip não ficar colado à margem e para se
        // perceber que a fila continua.
        paddingRight: spacing.lg,
      }}>
      {antes}
      {children}
    </ScrollView>
  );
}

/** Ícone de cada ordem, à parte da lista pura (que não conhece ícones). */
const ICONE_ORDEM: Record<Ordenacao, IconName> = {
  nome: 'sort-alphabetical-ascending',
  alertas: 'alert-circle-outline',
  novos: 'sort-clock-descending-outline',
  velhos: 'sort-clock-ascending-outline',
};

export default function AnimaisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { animais, alertas, terrenos, terrenoById, exploracoes } = useGado();
  // Com a conta suspensa nada se grava — o formulário só levaria a um erro no
  // fim. O PAPEL pergunta-se por `podeEmAlguma` e não por uma exploração
  // concreta: neste ecrã ela ainda não está escolhida (é o formulário que a
  // pede), mas quem não pode registar animais em NENHUMA das suas não tem que
  // ver o botão. Enquanto isto olhava só para a suspensão, o veterinário via o
  // "Registar" flutuante, carregava, e caía no ecrã de "a ficha é de quem gere
  // o efetivo" — um botão que existe para não levar a lado nenhum.
  const { contaSuspensa, podeEmAlguma } = useMembros();
  const podeRegistar = !contaSuspensa && podeEmAlguma('editarAnimais');
  const { controlo: controloAtualizar } = useAtualizarPuxando();

  const [filtros, setFiltros] = useState<Filtros>({});
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>(ORDENACAO_OMISSAO);

  // Escrever na pesquisa muda `filtros` a cada tecla, e é isso que faz correr o
  // `filtrarAnimais` + `facetasDisponiveis` + a ordenação. Num efetivo grande e
  // num telemóvel antigo, essa cascata a cada tecla arrastava a escrita. O
  // `useDeferredValue` deixa o texto aparecer já na caixa (lê `filtros`, sempre
  // atual) e adia só o recálculo pesado da lista, que apanha o valor mais
  // recente quando o dedo pára.
  const filtrosAdiados = useDeferredValue(filtros);

  const porAnimal = useMemo(() => mapaAlertas(alertas), [alertas]);
  const gravidade = useMemo(() => mapaGravidade(alertas), [alertas]);

  // Nome do terreno resolvido uma vez, num mapa, para cada `AnimalRow` não ir
  // buscar o seu ao store — trezentas linhas eram trezentas subscrições.
  const nomeTerrenoPorId = useMemo(
    () => new Map(terrenos.map((t) => [t.id, t.nome])),
    [terrenos],
  );

  /**
   * O efetivo com que a lista se compara — "3 de 28".
   *
   * Segue a exploração escolhida, e não a conta toda: com duas quintas, os 8
   * animais de uma apareciam como "8 de 28" e a conta lia-se como filtro mal
   * feito. A exploração não é um filtro como os outros — é o contexto em que se
   * está a olhar, e o total tem de ser o desse contexto.
   */
  const ativos = useMemo(
    () =>
      animais.filter(
        (a) =>
          !saiuDoEfetivo(a)
          && (!filtros.exploracaoId || a.exploracaoId === filtros.exploracaoId),
      ),
    [animais, filtros.exploracaoId],
  );

  /** Os que já saíram do efetivo, para o botão de histórico dizer quantos são. */
  const saidos = useMemo(
    () =>
      animais.filter(
        (a) =>
          saiuDoEfetivo(a)
          && (!filtros.exploracaoId || a.exploracaoId === filtros.exploracaoId),
      ),
    [animais, filtros.exploracaoId],
  );

  // As opções encolhem com o que já está filtrado: com "Bovinos" escolhido, o
  // sexo só oferece o que existe entre os bovinos. Depende dos `filtros`, por
  // isso recalcula-se a cada escolha — é o que faz as opções desaparecerem.
  const facetas = useMemo(
    () => facetasDisponiveis(animais, filtrosAdiados, porAnimal),
    [animais, filtrosAdiados, porAnimal],
  );

  const lista = useMemo(
    () => ordenarAnimais(filtrarAnimais(animais, filtrosAdiados, porAnimal), ordenacao, gravidade),
    [animais, filtrosAdiados, porAnimal, ordenacao, gravidade],
  );

  const nAtivos = contarAtivos(filtros);
  const temPesquisa = !!filtros.texto?.trim();
  /**
   * A lista está a mostrar menos do que o efetivo à vista?
   *
   * A exploração NÃO conta para isto — ela já mudou o `ativos` acima. Contá-la
   * punha "8 de 8" no topo de uma quinta com oito animais, e o estado vazio de
   * uma quinta ainda sem gado oferecia "limpar filtros" em vez de "registar".
   */
  const estreitada = nAtivos > 0 || temPesquisa;

  // Com uma exploração só, a linha de chips não decidia nada — ocupava espaço
  // no topo da lista e dizia sempre a mesma coisa.
  const podeEscolherExploracao = exploracoes.length > 1;

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
              <AnimalRow animal={item} nomeTerreno={item.terrenoId ? nomeTerrenoPorId.get(item.terrenoId) : undefined} />
            </View>
          ) : (
            <AnimalRow animal={item} nomeTerreno={item.terrenoId ? nomeTerrenoPorId.get(item.terrenoId) : undefined} />
          )
        }
        showsVerticalScrollIndicator={false}
        refreshControl={controloAtualizar}
        // Com efetivos grandes, desenhar a lista toda de uma vez trava o
        // primeiro render. Estes números dizem à FlatList para desenhar só o
        // que se vê e ir enchendo à medida que se desce.
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
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
              <Text variant="display">{t('nav.animais')}</Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 6 }}>
                {/* Quando há filtros, o que interessa é quantos deles se está a
                    ver — o total do efetivo passa a ser a segunda pergunta. */}
                {estreitada
                  ? t('animais.deTotal', { n: lista.length, total: ativos.length })
                  : t('animais.noEfetivo', { n: ativos.length })}
              </Text>
            </View>

            {/* Exploração à VISTA, sem abrir a folha de filtros: com duas ou
                mais explorações, "de que quinta são estes animais?" é a
                primeira pergunta de quem abre esta lista. */}
            {podeEscolherExploracao ? (
              <LinhaChips desktop={desktop}>
                <Chip
                  label={t('comum.todas')}
                  icon="barn"
                  selected={filtros.exploracaoId === undefined}
                  onPress={() => setFiltros((f) => ({ ...f, exploracaoId: undefined }))}
                />
                {exploracoes.map((e) => (
                  <Chip
                    key={e.id}
                    label={e.nome}
                    selected={filtros.exploracaoId === e.id}
                    onPress={() =>
                      setFiltros((f) => ({
                        ...f,
                        exploracaoId: f.exploracaoId === e.id ? undefined : e.id,
                      }))
                    }
                  />
                ))}
              </LinhaChips>
            ) : null}

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
                  placeholder={t('animais.procurar')}
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
                  nAtivos > 0 ? t('animais.filtrosAtivos', { n: nAtivos }) : t('animais.filtros')
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

            {/* Ordenar — à vista, e não escondido na folha de filtros: "mostra-me
                primeiro os que precisam de atenção" é um pedido do dia-a-dia,
                não uma configuração. Só aparece com animais que cheguem para a
                ordem fazer diferença. */}
            {ativos.length > 1 ? (
              <LinhaChips
                desktop={desktop}
                antes={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 }}>
                    <Icon name="sort" size="sm" color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>
                      {t('animais.ordenar')}
                    </Text>
                  </View>
                }>
                {ordenacoes().map((o) => (
                  <Chip
                    key={o.valor}
                    label={o.label}
                    icon={ICONE_ORDEM[o.valor]}
                    selected={ordenacao === o.valor}
                    onPress={() => setOrdenacao(o.valor)}
                  />
                ))}
              </LinhaChips>
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
                    onPress={() => setFiltros({ texto: filtros.texto, exploracaoId: filtros.exploracaoId })}
                    accessibilityRole="button"
                    accessibilityLabel={t('animais.limparTodos')}
                    style={({ pressed }) => [
                      { justifyContent: 'center', paddingHorizontal: spacing.xs },
                      pressed && { opacity: 0.6 },
                    ]}>
                    <Text variant="bodyStrong" color={colors.danger}>
                      {t('comum.limpar')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          /* Histórico do efetivo: quem saiu, porquê, quando e por ordem de
             quem. Só aparece quando há alguém lá dentro — num efetivo onde
             ainda ninguém saiu, é um botão que abre um ecrã vazio.

             NO FIM da lista, e já não no cabeçalho. É uma pergunta sobre o
             passado, e estava entre os filtros e o primeiro animal: num
             telemóvel, quem abria os Animais tinha de passar por ele — mais as
             duas filas de chips — antes de ver uma única cabeça de gado. Aqui
             encontra-se ao chegar ao fundo, que é quando a pergunta "e os que
             saíram?" faz sentido.

             O "Importar de Excel" esteve aqui e mudou-se para Documentos, que é
             onde vive tudo o que entra e sai da app em ficheiro. */
          saidos.length > 0 ? (
            <View style={{ alignItems: 'flex-start', marginTop: spacing.md }}>
              <Button
                label={t('animais.historico', { n: saidos.length })}
                icon="history"
                variant="secondary"
                fullWidth={false}
                onPress={() => router.push('/animal/historico')}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="cow-off"
            title={t('animais.vazioTitulo')}
            message={
              estreitada ? t('animais.vazioFiltrado') : t('animais.vazioSemNada')
            }
            actionLabel={
              estreitada
                ? t('animais.limparFiltros')
                : podeRegistar
                  ? t('animais.registarAnimal')
                  : undefined
            }
            onAction={estreitada ? () => setFiltros({}) : () => router.push('/animal/novo')}
          />
        }
      />

      <FolhaFiltros
        aberto={folhaAberta}
        filtros={filtros}
        facetas={facetas}
        terrenos={terrenos}
        total={lista.length}
        onFechar={() => setFolhaAberta(false)}
        onMudar={setFiltros}
        onLimpar={() => setFiltros({ texto: filtros.texto, exploracaoId: filtros.exploracaoId })}
      />

      {podeRegistar ? (
        <FAB label={t('animais.fab')} onPress={() => router.push('/animal/novo')} />
      ) : null}
    </View>
  );
}
