import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExploracaoRow } from '@/components/ExploracaoRow';
import { EmptyState, FAB, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useVoltarAoTopo } from '@/data/voltarAoTopo';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

export default function ExploracoesScreen() {
  const refTopo = useVoltarAoTopo('exploracoes');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { exploracoes } = useGado();
  const { podeCriarExploracoes, roleEm, listarMembrosDe } = useMembros();
  const { controlo: controloAtualizar } = useAtualizarPuxando();

  /**
   * Quem corre cada exploração supervisionada, pelo nome.
   *
   * Só se pergunta pelas que EU supervisiono, e por duas razões: é a única
   * lista onde a resposta interessa (numa exploração minha, o líder sou eu), e
   * é a única onde a RLS ma dá — o `membro_self_select` só deixa ver a equipa a
   * quem é admin ou supervisor dela. Perguntar pelas outras era um pedido por
   * exploração para receber uma lista com uma linha, a minha.
   *
   * A chave é o id da exploração; o valor é o nome do líder, ou `''` quando
   * ainda não há nenhum.
   */
  const [lideres, setLideres] = useState<Record<string, string>>({});
  const idsSupervisionadas = exploracoes
    .filter((e) => roleEm(e.id) === 'supervisor')
    .map((e) => e.id);
  // Uma string e não o array: o array é novo a cada render e punha o efeito a
  // correr em ciclo.
  const chaveSupervisionadas = idsSupervisionadas.join(',');

  useEffect(() => {
    const ids = chaveSupervisionadas ? chaveSupervisionadas.split(',') : [];
    if (ids.length === 0) {
      setLideres({});
      return;
    }
    let vivo = true;
    void (async () => {
      const pares = await Promise.all(
        ids.map(async (id) => {
          try {
            const equipa = await listarMembrosDe(id);
            return [id, equipa.find((m) => m.role === 'admin')?.nome ?? ''] as const;
          } catch {
            // Sem rede fica-se sem a linha do líder, e não com uma a mentir que
            // não há nenhum: `undefined` faz a linha desaparecer.
            return [id, undefined] as const;
          }
        }),
      );
      if (!vivo) return;
      setLideres(
        Object.fromEntries(pares.filter((p): p is readonly [string, string] => p[1] !== undefined)),
      );
    })();
    return () => {
      vivo = false;
    };
  }, [chaveSupervisionadas, listarMembrosDe]);
  // Quem pode criar: perfil ativo E conta que não entrou por convite de outra
  // pessoa. A decisão vive em `permissoes.ts` (`podeCriarExploracao`) e espelha
  // a política `exploracao_ativo_insert` — a UI segue a RLS, não a contraria.
  //
  // Ser superadmin não conta para o perfil ativo: a política exige
  // `perfil_ativo()` e não abre exceção a ninguém. Enquanto isto dizia
  // `|| isSuperadmin`, uma conta superadmin ainda por aprovar via o botão
  // "Nova" e recebia, ao gravar, um "new row violates row-level security
  // policy" em cru — o erro que este ficheiro existe para evitar mostrar.
  const podeCriar = podeCriarExploracoes;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={refTopo}
        // Ver nota em animais.tsx: numColumns exige remontar a lista.
        key={desktop ? 'grelha' : 'pilha'}
        data={exploracoes}
        keyExtractor={(e) => e.id}
        numColumns={desktop ? 2 : 1}
        columnWrapperStyle={desktop ? { gap: spacing.sm } : undefined}
        renderItem={({ item }) =>
          desktop ? (
            <View style={{ flex: 1 }}>
              <ExploracaoRow exploracao={item} lider={lideres[item.id]} />
            </View>
          ) : (
            <ExploracaoRow exploracao={item} lider={lideres[item.id]} />
          )
        }
        showsVerticalScrollIndicator={false}
        refreshControl={controloAtualizar}
        contentContainerStyle={{
          width: '100%',
          maxWidth: desktop ? layout.conteudoDesktop : undefined,
          alignSelf: 'center',
          paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
          paddingBottom: spacing.huge + 40,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + spacing.md, marginBottom: spacing.md }}>
            <Text variant="display">{t('nav.exploracoes')}</Text>
            <Text variant="body" color={colors.textSecondary}>
              {t('exploracoes.subtitulo')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="barn"
            title={t('exploracoes.vazioTitulo')}
            message={
              podeCriar
                ? t('exploracoes.vazioPodeCriar')
                : t('exploracoes.vazioSemConvite')
            }
            actionLabel={podeCriar ? t('exploracoes.nova') : undefined}
            onAction={podeCriar ? () => router.push('/exploracao/nova') : undefined}
          />
        }
      />
      {podeCriar ? (
        <FAB label={t('exploracoes.fab')} onPress={() => router.push('/exploracao/nova')} />
      ) : null}
    </View>
  );
}
