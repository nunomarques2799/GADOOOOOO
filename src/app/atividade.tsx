import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorExploracao } from '@/components/SeletorExploracao';
import { Avatar, Card, Chip, EmptyState, Header, Icon, type IconName, Text } from '@/components/ui';
import {
  agruparPorDia,
  autores,
  carregarAtividade,
  frase,
  horaDe,
  legendaTabela,
  type Atividade,
  type TabelaAtividade,
} from '@/data/atividade';
import { useAuth } from '@/data/auth';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { iniciais } from '@/data/trabalhadores';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Registo de alterações — o que a equipa mexeu, e quando.
 * ------------------------------------------------------------------
 * A resposta à única pergunta que não tinha resposta desde que a app passou a
 * ter mais do que uma pessoa dentro: «o veterinário esteve cá ontem, o que é
 * que ele alterou?».
 *
 * Chega-se aqui pela aba Trabalhadores. As linhas vêm do servidor
 * (`data/atividade.ts`), escritas por trigger — a app não tem como as forjar
 * nem como as esconder, que é o que faz isto valer alguma coisa.
 *
 * Por omissão mostra A EQUIPA, não o próprio: quem abre isto quer saber o que
 * os OUTROS fizeram, e as suas próprias alterações — que são a maioria, e ainda
 * mais no dia em que se importa um efetivo inteiro de um Excel — enterravam as
 * dos outros no fundo da lista. Fica um chip para as incluir.
 */
export default function AtividadeScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { sessao } = useAuth();
  const { exploracoes } = useGado();
  const { pode } = useMembros();
  const { nomeDe } = useNomesEquipa();
  // Vindo do cartão de uma pessoa (Trabalhadores → pessoa → registo), já se
  // sabe por quem se veio perguntar.
  const { pessoa: pessoaInicial } = useLocalSearchParams<{ pessoa?: string }>();

  const [linhas, setLinhas] = useState<Atividade[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);
  const [autorId, setAutorId] = useState<string | undefined>(pessoaInicial);
  const [incluirMe, setIncluirMe] = useState(false);

  const meuId = sessao?.user.id;

  // As explorações que se gerem: nas outras o servidor devolve só as linhas do
  // próprio, e um filtro por exploração que não filtra nada confunde mais do
  // que ajuda.
  const minhas = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'gerirEquipa')),
    [exploracoes, pode],
  );

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(null);
    try {
      setLinhas(await carregarAtividade());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** As pessoas que aparecem nos chips, já com nome. */
  const pessoas = useMemo(
    () =>
      autores(linhas)
        .filter((a) => a.userId !== meuId)
        .map((a) => ({ ...a, nome: nomeDe(a.userId) ?? 'Sem nome' })),
    [linhas, meuId, nomeDe],
  );

  const visiveis = useMemo(
    () =>
      linhas.filter((l) => {
        if (exploracaoId && l.exploracaoId !== exploracaoId) return false;
        if (autorId) return l.userId === autorId;
        if (!incluirMe && l.userId === meuId) return false;
        return true;
      }),
    [linhas, exploracaoId, autorId, incluirMe, meuId],
  );

  const dias = useMemo(() => agruparPorDia(visiveis), [visiveis]);

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('atividade.titulo')} actionIcon="refresh" onAction={carregar} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={aCarregar} onRefresh={() => void carregar()} />}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={coluna}>
          <Text variant="body" color={colors.textSecondary}>
            O que cada pessoa alterou nas suas explorações, e a que horas. Fica
            registado pelo servidor: ninguém o pode apagar nem mudar, nem sequer
            quem fez a alteração.
          </Text>

          {erro ? (
            <Card style={{ backgroundColor: colors.dangerTint }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Icon name="alert-circle-outline" size="lg" color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" color={colors.danger}>
                    Não foi possível carregar o registo
                  </Text>
                  <Text variant="secondary" color={colors.textSecondary}>
                    {erro}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Por exploração */}
          {minhas.length > 1 ? (
            <SeletorExploracao
              exploracoes={minhas}
              valor={exploracaoId}
              onEscolher={setExploracaoId}
            />
          ) : null}

          {/* Por pessoa */}
          {pessoas.length > 0 || meuId ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Chip
                label={t('atividade.aEquipa')}
                icon="account-multiple-outline"
                selected={autorId === undefined && !incluirMe}
                onPress={() => {
                  setAutorId(undefined);
                  setIncluirMe(false);
                }}
              />
              {pessoas.map((p) => (
                <Chip
                  key={p.userId}
                  label={`${p.nome} (${p.quantas})`}
                  selected={autorId === p.userId}
                  onPress={() => setAutorId(autorId === p.userId ? undefined : p.userId)}
                />
              ))}
              <Chip
                label={t('atividade.incluirMinhas')}
                icon="account-outline"
                selected={autorId === undefined && incluirMe}
                onPress={() => {
                  setAutorId(undefined);
                  setIncluirMe(true);
                }}
              />
            </View>
          ) : null}

          {aCarregar && linhas.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                A carregar o registo…
              </Text>
            </Card>
          ) : visiveis.length === 0 ? (
            <EmptyState
              icon="history"
              title={linhas.length === 0 ? 'Ainda não há alterações' : 'Nada com estes filtros'}
              message={
                linhas.length === 0
                  ? 'Assim que alguém da sua equipa registar ou alterar alguma coisa, aparece aqui com o dia e a hora.'
                  : 'Experimente escolher outra pessoa, outra exploração, ou incluir as suas próprias alterações.'
              }
            />
          ) : (
            dias.map((g) => (
              <View key={g.dia}>
                <Text
                  variant="label"
                  color={colors.textSecondary}
                  style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
                  {g.titulo.toUpperCase()} ({g.linhas.length})
                </Text>
                <Card padded={false}>
                  <View style={{ paddingHorizontal: spacing.md }}>
                    {g.linhas.map((a, i) => (
                      <Linha
                        key={a.id}
                        atividade={a}
                        nome={a.userId === meuId ? 'Você' : (nomeDe(a.userId) ?? 'Sem nome')}
                        exploracao={
                          minhas.length > 1 && !exploracaoId
                            ? minhas.find((e) => e.id === a.exploracaoId)?.nome
                            : undefined
                        }
                        ultimo={i === g.linhas.length - 1}
                      />
                    ))}
                  </View>
                </Card>
              </View>
            ))
          )}

          {visiveis.length > 0 ? (
            <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
              Mostram-se as alterações mais recentes. O que aconteceu a um animal
              em concreto vê-se no histórico dele.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const ICONE_TABELA: Record<TabelaAtividade, IconName> = {
  animal: 'cow',
  evento: 'clipboard-text-outline',
  terreno: 'grass',
  movimento: 'cash-multiple',
};

function Linha({
  atividade,
  nome,
  exploracao,
  ultimo,
}: {
  atividade: Atividade;
  nome: string;
  exploracao?: string;
  ultimo: boolean;
}) {
  // As cores lêem-se no render (ver DESIGN_SYSTEM.md).
  const cor =
    atividade.acao === 'removeu'
      ? colors.danger
      : atividade.acao === 'criou'
        ? colors.success
        : colors.info;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      <Avatar
        initials={iniciais(nome)}
        size={40}
        background={colors.surfaceSunken}
        foreground={colors.textSecondary}
      />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
            {nome}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {horaDe(atividade.em)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Icon name={ICONE_TABELA[atividade.tabela]} size="sm" color={cor} />
          <Text variant="secondary" color={cor}>
            {frase(atividade)}
          </Text>
        </View>
        <Text variant="body" numberOfLines={2}>
          {atividade.resumo}
        </Text>
        {exploracao ? (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 4,
              paddingHorizontal: spacing.xs,
              paddingVertical: 2,
              borderRadius: radii.sm,
              backgroundColor: colors.surfaceSunken,
            }}>
            <Text variant="caption" color={colors.textMuted}>
              {exploracao} · {legendaTabela(atividade.tabela)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
