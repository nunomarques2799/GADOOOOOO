import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorExploracao } from '@/components/SeletorExploracao';
import { Avatar, Badge, Card, EmptyState, Header, Icon, type IconName, Text } from '@/components/ui';
import { acessoTerminou } from '@/data/acessoTemporario';
import { formatDataHora } from '@/data/helpers';
import {
  contarHistorico,
  juntarHistorico,
  quantoEsteve,
  rotuloFim,
  type EntradaHistorico,
  type SaidaEquipa,
  type VinculoExpirado,
} from '@/data/historicoEquipa';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import { iniciais } from '@/data/trabalhadores';
import type { RoleMembro } from '@/data/types';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, spacing } from '@/theme';

const ICONE_PAPEL: Record<RoleMembro, IconName> = {
  admin: 'shield-crown',
  veterinario: 'medical-bag',
  trabalhador: 'account-hard-hat',
};

/**
 * Histórico da equipa — quem já teve acesso e já não tem.
 * ------------------------------------------------------------------
 * A aba Trabalhadores responde a «quem cá anda». Isto responde à outra metade:
 * «quem cá andou». Sem ela, o veterinário da semana passada e o ajudante da
 * campanha do ano passado eram gente que tinha desaparecido da app sem deixar
 * rasto — e a pergunta que se faz sobre eles («ele chegou a ter acesso a isto?»,
 * «quando é que saiu?») não tinha onde ser respondida.
 *
 * Junta duas coisas que acabam da mesma maneira e se desfazem de forma
 * diferente (ver `data/historicoEquipa.ts`):
 *
 *   · O PRAZO CAIU — o vínculo está lá, só sem tempo. Reabre-se com um toque,
 *     na equipa da exploração, e é para lá que a linha leva.
 *   · SAIU DA EQUIPA — o vínculo foi apagado. Para voltar é preciso um código
 *     novo, e a linha di-lo em vez de prometer um botão que não existe.
 *
 * As saídas vêm do servidor, escritas por gatilho (ver
 * `supabase/schema_historico_equipa.sql`): a app não as escreve nem as apaga.
 */
export default function HistoricoEquipaScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { exploracoes } = useGado();
  const { pode, listarMembrosDe, listarSaidasDaEquipa } = useMembros();
  // Vindo da equipa de uma exploração, já se sabe qual é a que interessa.
  const { exploracao: exploracaoInicial } = useLocalSearchParams<{ exploracao?: string }>();

  const [saidas, setSaidas] = useState<SaidaEquipa[]>([]);
  const [expirados, setExpirados] = useState<VinculoExpirado[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exploracaoId, setExploracaoId] = useState<string | undefined>(exploracaoInicial);

  // Só as explorações que se gerem: nas outras o servidor não devolve nem a
  // equipa nem o histórico dela.
  const minhas = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'gerirEquipa')),
    [exploracoes, pode],
  );

  /**
   * O que faz este ecrã voltar a perguntar, escrito como TEXTO e não como a
   * lista — a mesma armadilha da aba Trabalhadores: `minhas` é um array novo a
   * cada render, e um efeito que dependa dele pede a lista em ciclo.
   */
  const chaveExploracoes = useMemo(() => minhas.map((e) => e.id).join('|'), [minhas]);
  const minhasRef = useRef(minhas);
  minhasRef.current = minhas;

  const carregar = useCallback(async () => {
    const lista = minhasRef.current;
    if (lista.length === 0) {
      setSaidas([]);
      setExpirados([]);
      setACarregar(false);
      return;
    }
    setACarregar(true);
    setErro(null);
    try {
      const [historico, equipas] = await Promise.all([
        listarSaidasDaEquipa(lista.map((e) => e.id)),
        Promise.all(
          lista.map(async (e) => ({ exploracaoId: e.id, membros: await listarMembrosDe(e.id) })),
        ),
      ]);
      setSaidas(historico);
      setExpirados(
        equipas.flatMap(({ exploracaoId: expId, membros }) =>
          membros
            // O dono nunca expira, e os que ainda têm acesso pertencem à lista
            // de quem cá anda — não a esta.
            .filter((m) => m.role !== 'admin' && m.expiraEm && acessoTerminou(m.expiraEm))
            .map<VinculoExpirado>((m) => ({
              membroId: m.id,
              exploracaoId: expId,
              userId: m.userId,
              nome: m.nome,
              role: m.role,
              criadoEm: m.criadoEm,
              expiraEm: m.expiraEm as string,
            })),
        ),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
    // `chaveExploracoes` está aqui de propósito (ver acima); o `minhasRef` traz
    // sempre a lista atual.
  }, [chaveExploracoes, listarMembrosDe, listarSaidasDaEquipa]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomeExploracao = useCallback(
    (id: string) => minhas.find((e) => e.id === id)?.nome ?? 'Exploração',
    [minhas],
  );

  const todas = useMemo(
    () => juntarHistorico(saidas, expirados, nomeExploracao),
    [saidas, expirados, nomeExploracao],
  );

  const entradas = useMemo(
    () => (exploracaoId ? todas.filter((e) => e.exploracaoId === exploracaoId) : todas),
    [todas, exploracaoId],
  );

  const conta = useMemo(() => contarHistorico(entradas), [entradas]);

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('histEquipa.titulo')} actionIcon="refresh" onAction={carregar} />
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
            Quem já teve acesso às suas explorações e já não tem: os veterinários
            cujo prazo acabou e as pessoas que saíram da equipa.
          </Text>

          {erro ? (
            <Card style={{ backgroundColor: colors.dangerTint }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Icon name="alert-circle-outline" size="lg" color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" color={colors.danger}>
                    Não foi possível carregar o histórico
                  </Text>
                  <Text variant="secondary" color={colors.textSecondary}>
                    {erro}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {minhas.length > 1 ? (
            <SeletorExploracao
              exploracoes={minhas}
              valor={exploracaoId}
              onEscolher={setExploracaoId}
            />
          ) : null}

          {entradas.length > 0 ? (
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {conta.expirados > 0 ? (
                  <Badge
                    tone="warning"
                    icon="clock-alert-outline"
                    label={
                      conta.expirados === 1
                        ? '1 com o prazo acabado'
                        : `${conta.expirados} com o prazo acabado`
                    }
                  />
                ) : null}
                {conta.saidos > 0 ? (
                  <Badge
                    tone="neutral"
                    icon="account-off-outline"
                    label={conta.saidos === 1 ? '1 saiu da equipa' : `${conta.saidos} saíram da equipa`}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {minhas.length === 0 ? (
            <EmptyState
              icon="account-off-outline"
              title={t('equipa.semEquipaTitulo')}
              message={t('histEquipa.semEquipaMensagem')}
            />
          ) : aCarregar && entradas.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                A carregar o histórico…
              </Text>
            </Card>
          ) : entradas.length === 0 ? (
            <EmptyState
              icon="account-clock-outline"
              title={t('histEquipa.vazioTitulo')}
              message={t('histEquipa.vazioMensagem')}
            />
          ) : (
            <Card padded={false}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {entradas.map((e, i) => (
                  <Linha
                    key={e.chave}
                    entrada={e}
                    mostrarExploracao={minhas.length > 1 && !exploracaoId}
                    ultimo={i === entradas.length - 1}
                    onReabrir={
                      e.tipo === 'expirado'
                        ? () => router.push(`/exploracao/equipa/${e.exploracaoId}`)
                        : undefined
                    }
                  />
                ))}
              </View>
            </Card>
          )}

          {entradas.length > 0 ? (
            <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
              O que cada um chegou a alterar continua no registo de alterações,
              mesmo depois de sair.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Linha({
  entrada,
  mostrarExploracao,
  ultimo,
  onReabrir,
}: {
  entrada: EntradaHistorico;
  mostrarExploracao: boolean;
  ultimo: boolean;
  /** Só em quem ainda tem vínculo: leva à equipa, onde se lhe dá mais tempo. */
  onReabrir?: () => void;
}) {
  // As cores lêem-se aqui dentro, no render (ver DESIGN_SYSTEM.md).
  const cor = entrada.role === 'veterinario' ? colors.info : colors.warning;
  const esteve = quantoEsteve(entrada);

  const conteudo = (
    <>
      <Avatar
        initials={iniciais(entrada.nome)}
        size={44}
        background={colors.surfaceSunken}
        foreground={cor}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {entrada.nome}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={ICONE_PAPEL[entrada.role]} size="sm" color={cor} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
            {legendaRole(entrada.role)}
            {mostrarExploracao ? ` · ${entrada.nomeExploracao}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <Icon
            name={entrada.tipo === 'expirado' ? 'clock-alert-outline' : 'account-off-outline'}
            size="xs"
            color={entrada.tipo === 'expirado' ? colors.warning : colors.textMuted}
          />
          <Text
            variant="caption"
            color={entrada.tipo === 'expirado' ? colors.warning : colors.textMuted}
            style={{ flex: 1 }}
            numberOfLines={2}>
            {rotuloFim(entrada, formatDataHora)}
            {esteve ? ` · ${esteve}` : ''}
          </Text>
        </View>
        {/* A diferença que decide o que fazer a seguir, dita por extenso. Sem
            ela, as duas linhas parecem a mesma coisa e quem quer o veterinário
            de volta gera um código novo por nada. */}
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
          {entrada.tipo === 'expirado'
            ? 'Continua na equipa. Toque para lhe dar mais tempo.'
            : 'Já não está na equipa. Para voltar precisa de um código novo.'}
        </Text>
      </View>
      {entrada.tipo === 'expirado' ? (
        <Icon name="chevron-right" size="md" color={colors.textMuted} />
      ) : null}
    </>
  );

  const estilo = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: ultimo ? 0 : 1,
    borderBottomColor: colors.border,
  } as const;

  // Quem saiu não é tocável: não há para onde levar. Um `Pressable` que não faz
  // nada dá a entender que há mais alguma coisa para ver — e não há.
  if (!onReabrir) return <View style={estilo}>{conteudo}</View>;

  return (
    <Pressable
      onPress={onReabrir}
      accessibilityRole="button"
      accessibilityLabel={`${entrada.nome}, ${rotuloFim(entrada, formatDataHora).toLowerCase()}`}
      accessibilityHint={t('histEquipa.toqueParaEquipa')}
      style={({ pressed }) => [estilo, pressed && { opacity: 0.6 }]}>
      {conteudo}
    </Pressable>
  );
}
