import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CartaoIntroducao } from '@/components/CartaoIntroducao';
import { FolhaPermissoes } from '@/components/FolhaPermissoes';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Icon, Text } from '@/components/ui';
import { acessoTerminou, rotuloPrazo } from '@/data/acessoTemporario';
import { useAuth } from '@/data/auth';
import { formatDataHora } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import { useToasts } from '@/data/toasts';
import {
  agruparTrabalhadores,
  contarPorPapel,
  iniciais,
  resumoVinculos,
  type EquipaExploracao,
  type Trabalhador,
} from '@/data/trabalhadores';
import type { Convite, RoleMembro } from '@/data/types';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Trabalhadores: quem trabalha nas minhas explorações, todos num sítio.
 * ------------------------------------------------------------------
 * A equipa geria-se dentro de cada exploração (`/exploracao/equipa/[id]`), o
 * que respondia a "quem anda nesta quinta?" mas nunca a "quem trabalha para
 * mim?" — com duas explorações era preciso abrir duas listas e juntá-las de
 * cabeça, e o mesmo trabalhador aparecia nas duas como se fossem dois homens.
 *
 * Este ecrã junta-as por PESSOA (ver `trabalhadores.ts`). Gerir continua a ser
 * na exploração: convidar e remover mexem numa exploração concreta, e duplicar
 * esses botões aqui era duplicar as regras de quem pode o quê.
 */
export default function TrabalhadoresScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { sessao } = useAuth();
  const { exploracoes } = useGado();
  const {
    pode,
    listarMembrosDe,
    listarConvites,
    definirPermissoes,
    definirPrazoDeAcesso,
    definirFimDeAcesso,
    aCarregar: aCarregarAcesso,
  } = useMembros();
  const toast = useToasts();

  // Só as explorações onde se pode gerir equipa: nas outras o servidor não
  // devolve a lista de membros, e mostrar a secção vazia parecia uma equipa
  // vazia em vez de "isto não é seu".
  const minhas = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'gerirEquipa')),
    [exploracoes, pode],
  );

  const [equipas, setEquipas] = useState<EquipaExploracao[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);
  /** Quem está com a folha de permissões aberta (pelo id de utilizador). */
  const [aAjustar, setAAjustar] = useState<string | undefined>(undefined);

  /**
   * O que faz este ecrã ir buscar a equipa outra vez, escrito como TEXTO e não
   * como a lista.
   *
   * `minhas` é um array novo a cada render (o `pode` que o filtra pertence ao
   * contexto), e um efeito que dependa dele volta a pedir a equipa a cada
   * re-render — um pedido por render, em ciclo. Com a chave, só uma exploração
   * nova, ou um nome mudado, é que manda perguntar de novo.
   */
  const chaveExploracoes = useMemo(
    () => minhas.map((e) => `${e.id}:${e.nome}`).join('|'),
    [minhas],
  );
  const minhasRef = useRef(minhas);
  minhasRef.current = minhas;

  const carregar = useCallback(async () => {
    const lista = minhasRef.current;
    if (lista.length === 0) {
      setEquipas([]);
      setConvites([]);
      setACarregar(false);
      return;
    }
    setACarregar(true);
    setErro(null);
    try {
      const resultados = await Promise.all(
        lista.map(async (e) => ({
          exploracaoId: e.id,
          nomeExploracao: e.nome,
          membros: await listarMembrosDe(e.id),
          convites: await listarConvites(e.id),
        })),
      );
      setEquipas(resultados.map(({ convites: _c, ...resto }) => resto));
      setConvites(resultados.flatMap((r) => r.convites));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
    // `chaveExploracoes` está aqui de propósito: é ele que decide quando vale a
    // pena voltar a perguntar (ver acima). O `minhasRef` traz sempre a lista atual.
  }, [chaveExploracoes, listarMembrosDe, listarConvites]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(
    () => (exploracaoId ? equipas.filter((e) => e.exploracaoId === exploracaoId) : equipas),
    [equipas, exploracaoId],
  );

  // Fora o próprio: um dono não é um dos seus trabalhadores.
  const pessoas = useMemo(
    () => agruparTrabalhadores(visiveis, { excluirUserId: sessao?.user.id }),
    [visiveis, sessao?.user.id],
  );
  const conta = useMemo(() => contarPorPapel(pessoas), [pessoas]);

  const convitesPorUsar = useMemo(
    () =>
      convites.filter(
        (c) =>
          !c.usadoPor
          && (!c.expiraEm || new Date(c.expiraEm) > new Date())
          && (!exploracaoId || c.exploracaoId === exploracaoId),
      ),
    [convites, exploracaoId],
  );

  /** A exploração para onde mandar quem quer convidar ou remover alguém. */
  const exploracaoDeGestao = exploracaoId ?? minhas[0]?.id;

  /** A pessoa cuja folha de permissões está aberta, já com os vínculos atuais. */
  const pessoaAAjustar = useMemo(
    () => pessoas.find((p) => p.userId === aAjustar),
    [pessoas, aAjustar],
  );

  /**
   * Grava as permissões e diz o que aconteceu. Recarrega a lista a seguir: os
   * vínculos que alimentam a folha vêm daqui, e sem isto reabri-la mostrava os
   * interruptores como estavam antes de gravar.
   */
  async function guardarPermissoes(
    membroId: string,
    permissoes: Parameters<typeof definirPermissoes>[1],
  ): Promise<string | null> {
    const razao = await definirPermissoes(membroId, permissoes);
    if (razao) return razao;
    toast.sucesso('Permissões guardadas', pessoaAAjustar?.nome);
    await carregar();
    return null;
  }

  /**
   * Mais tempo, sem prazo, ou acabou aqui.
   *
   * Recarrega a lista a seguir pela mesma razão das permissões: é dela que sai o
   * `expiraEm` que a folha mostra, e sem isto o prazo escrito continuava a ser o
   * antigo enquanto a folha estivesse aberta — logo a seguir a ter sido mudado.
   */
  async function mudarPrazo(membroId: string, horas: number | null): Promise<string | null> {
    const razao = await definirPrazoDeAcesso(membroId, horas);
    if (razao) {
      toast.erro('O tempo de acesso não mudou', razao);
      return razao;
    }
    toast.sucesso(
      horas === null ? 'Acesso sem prazo' : horas === 0 ? 'Acesso terminado' : 'Acesso prolongado',
      pessoaAAjustar?.nome,
    );
    await carregar();
    return null;
  }

  async function marcarFim(membroId: string, fimIso: string): Promise<string | null> {
    const razao = await definirFimDeAcesso(membroId, fimIso);
    if (razao) {
      toast.erro('O tempo de acesso não mudou', razao);
      return razao;
    }
    toast.sucesso('Acesso marcado', `${pessoaAAjustar?.nome ?? ''} · até ${formatDataHora(fimIso)}`);
    await carregar();
    return null;
  }

  // A mesma coluna dos outros separadores de lista (Animais, Terrenos,
  // Explorações). Este ecrã usava a coluna ESTREITA, que é a dos ecrãs de
  // leitura: no computador dava um bloco mais apertado do que os vizinhos, com
  // o título encostado à esquerda e o botão de atualizar a setecentos píxeis
  // dele, e o estado vazio centrado no meio dos dois. Nada estava desalinhado
  // por si; era o conjunto que não pertencia ao mesmo ecrã.
  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoDesktop : undefined,
    alignSelf: 'center',
    paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={aCarregar} onRefresh={() => void carregar()} />
        }
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.huge,
        }}>
        {/* Cabeçalho igual ao dos outros separadores: título em grande, uma
            linha a dizer o que ali está, e a ação à direita na mesma linha do
            título (é onde os Animais põem a contagem). */}
        <View style={{ ...coluna, paddingTop: insets.top + spacing.md, marginBottom: spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}>
            <Text variant="display" style={{ flexShrink: 1 }}>
              Trabalhadores
            </Text>
            <Pressable
              onPress={() => void carregar()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Atualizar lista"
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  marginBottom: 6,
                },
                pressed && { opacity: 0.6 },
              ]}>
              <Icon name="refresh" size="md" color={colors.primary} />
              <Text variant="bodyStrong" color={colors.primary}>
                Atualizar
              </Text>
            </Pressable>
          </View>
          <Text variant="body" color={colors.textSecondary}>
            Quem trabalha nas suas explorações
          </Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* À primeira vez, o que é este separador. Sem isto, quem o abria via
              uma lista vazia e não ficava a saber que é aqui que se convida
              gente, nem que é aqui que se decide o que cada um pode mexer. */}
          <CartaoIntroducao
            chave="trabalhadores"
            icon="account-hard-hat"
            titulo="Para que serve este separador"
            pontos={[
              'Aqui estão as pessoas a quem deu acesso à sua exploração: trabalhadores e veterinários. Quem não está nesta lista não vê nada do que registou.',
              'Convida-se com um código: a pessoa instala a app, escreve o código e fica logo ligada à sua exploração — não precisa de saber a sua palavra-passe.',
              'Cada um só mexe no que lhe compete: o trabalhador aponta o que faz no dia a dia, o veterinário regista tratamentos.',
              'Toque numa pessoa para ver e mudar ao certo o que ela pode alterar. Ao veterinário pode dar acesso até ao dia e hora que quiser, findos os quais ele sai sozinho.',
              'No registo de alterações vê o que cada um mexeu e a que horas — quem registou um animal, quem mudou um terreno, quem lançou uma despesa.',
            ]}
          />

          {/* O registo de alterações. Fica em cima e não escondido no fim: é a
              pergunta que se faz sobre a equipa logo a seguir a "quem é que cá
              anda?", e mandar procurá-la no fundo do ecrã era escondê-la. */}
          {minhas.length > 0 ? (
            <Button
              label="Ver o registo de alterações"
              icon="history"
              variant="secondary"
              onPress={() => router.push('/atividade')}
            />
          ) : null}

          {/* E quem já cá NÃO anda. A lista de cima mostra a equipa de hoje; a
              pergunta que ela não responde — «e o veterinário do mês passado?»
              — é a que leva aqui. */}
          {minhas.length > 0 ? (
            <Button
              label="Ver quem já cá esteve"
              icon="account-clock-outline"
              variant="secondary"
              onPress={() => router.push('/equipa/historico')}
            />
          ) : null}

          {/* Por exploração, à vista e não escondido, como nos Animais */}
          {minhas.length > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Chip
                label="Todas"
                icon="barn"
                selected={exploracaoId === undefined}
                onPress={() => setExploracaoId(undefined)}
              />
              {minhas.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nome}
                  selected={exploracaoId === e.id}
                  onPress={() => setExploracaoId(exploracaoId === e.id ? undefined : e.id)}
                />
              ))}
            </View>
          ) : null}

          {erro ? (
            <Card style={{ backgroundColor: colors.dangerTint }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Icon name="alert-circle-outline" size="lg" color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" color={colors.danger}>
                    Não foi possível carregar a equipa
                  </Text>
                  <Text variant="secondary" color={colors.textSecondary}>
                    {erro}
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {/* Resumo: quantos são e de que tipo */}
          {pessoas.length > 0 ? (
            <Card>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {conta.trabalhador > 0 ? (
                  <Badge
                    tone="warning"
                    icon="account-hard-hat"
                    label={`${conta.trabalhador} trabalhador${conta.trabalhador > 1 ? 'es' : ''}`}
                  />
                ) : null}
                {conta.veterinario > 0 ? (
                  <Badge
                    tone="info"
                    icon="medical-bag"
                    label={`${conta.veterinario} veterinário${conta.veterinario > 1 ? 's' : ''}`}
                  />
                ) : null}
                {conta.admin > 0 ? (
                  <Badge
                    tone="success"
                    icon="shield-crown"
                    label={`${conta.admin} dono${conta.admin > 1 ? 's' : ''}`}
                  />
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* A lista */}
          {minhas.length === 0 ? (
            <EmptyState
              icon="account-hard-hat"
              title="Sem equipa para gerir"
              message="Só o dono de uma exploração vê e convida a equipa. Se entrou por convite, fale com quem o convidou."
            />
          ) : aCarregar && pessoas.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                A carregar a equipa…
              </Text>
            </Card>
          ) : pessoas.length === 0 ? (
            <EmptyState
              icon="account-plus-outline"
              title="Ainda não tem trabalhadores"
              message="Convide alguém com um código: ele entra na app e fica logo ligado à sua exploração, a ver os animais e a registar o que faz."
              actionLabel={exploracaoDeGestao ? 'Convidar alguém' : undefined}
              onAction={
                exploracaoDeGestao
                  ? () => router.push(`/exploracao/equipa/${exploracaoDeGestao}`)
                  : undefined
              }
            />
          ) : (
            <Card padded={false}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {pessoas.map((p, i) => (
                  <LinhaPessoa
                    key={p.userId}
                    pessoa={p}
                    ultimo={i === pessoas.length - 1}
                    // Tocar na pessoa abre o que ela pode alterar — é a pergunta
                    // que se faz nesta lista. Convidar e remover continuam a ser
                    // na equipa da exploração, com a ligação lá dentro.
                    onPress={() => setAAjustar(p.userId)}
                  />
                ))}
              </View>
            </Card>
          )}

          {/* Convites à espera de quem os use */}
          {convitesPorUsar.length > 0 ? (
            <View>
              <Text
                variant="label"
                color={colors.textSecondary}
                style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
                CONVITES À ESPERA ({convitesPorUsar.length})
              </Text>
              <Card padded={false}>
                <View style={{ paddingHorizontal: spacing.md }}>
                  {convitesPorUsar.map((c, i) => (
                    <Pressable
                      key={c.codigo}
                      onPress={() => router.push(`/exploracao/equipa/${c.exploracaoId}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Convite ${c.codigo}`}
                      style={({ pressed }) => [
                        {
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.sm,
                          paddingVertical: spacing.sm,
                          borderBottomWidth: i < convitesPorUsar.length - 1 ? 1 : 0,
                          borderBottomColor: colors.border,
                        },
                        pressed && { opacity: 0.6 },
                      ]}>
                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 4,
                          borderRadius: radii.sm,
                          backgroundColor: colors.primaryTint,
                        }}>
                        <Text variant="bodyStrong" color={colors.primaryDark} style={{ letterSpacing: 2 }}>
                          {c.codigo}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body">{legendaRole(c.role)}</Text>
                        <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                          {nomeDe(minhas, c.exploracaoId)}
                          {c.descricao ? ` · ${c.descricao}` : ''}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size="md" color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </Card>
            </View>
          ) : null}

          {/* Convidar — a gestão continua a ser dentro da exploração */}
          {exploracaoDeGestao && pessoas.length > 0 ? (
            <Button
              label={
                minhas.length > 1 && exploracaoId
                  ? `Convidar para ${nomeDe(minhas, exploracaoId)}`
                  : 'Convidar trabalhador ou veterinário'
              }
              icon="account-multiple-plus"
              variant="secondary"
              onPress={() => router.push(`/exploracao/equipa/${exploracaoDeGestao}`)}
            />
          ) : null}

          {pessoas.length > 0 ? (
            <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
              Toque numa pessoa para escolher o que ela pode alterar na app.
              {minhas.length > 1 && !exploracaoId
                ? ' Para convidar ou remover numa exploração à escolha, toque nela em cima.'
                : ''}
            </Text>
          ) : null}

          {aCarregarAcesso ? (
            <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
              A confirmar os seus acessos…
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Montada só quando é preciso: fora disso não há folha nenhuma a manter
          rascunhos de permissões de alguém que já não está na lista. */}
      {pessoaAAjustar ? (
        <FolhaPermissoes
          aberto
          pessoa={pessoaAAjustar}
          onFechar={() => setAAjustar(undefined)}
          onGuardar={guardarPermissoes}
          onMudarPrazo={mudarPrazo}
          onMarcarFim={marcarFim}
          financasAtivasEm={(id) => !!exploracoes.find((e) => e.id === id)?.financasAtivas}
          onAbrirEquipa={(id) => {
            setAAjustar(undefined);
            router.push(`/exploracao/equipa/${id}`);
          }}
          onVerAtividade={(userId) => {
            setAAjustar(undefined);
            router.push(`/atividade?pessoa=${userId}`);
          }}
        />
      ) : null}
    </View>
  );
}

/** Nome da exploração, para as legendas. */
function nomeDe(lista: { id: string; nome: string }[], id: string): string {
  return lista.find((e) => e.id === id)?.nome ?? 'Exploração';
}

const ICONE_PAPEL: Record<RoleMembro, 'shield-crown' | 'medical-bag' | 'account-hard-hat'> = {
  admin: 'shield-crown',
  veterinario: 'medical-bag',
  trabalhador: 'account-hard-hat',
};

function LinhaPessoa({
  pessoa,
  ultimo,
  onPress,
}: {
  pessoa: Trabalhador;
  ultimo: boolean;
  onPress: () => void;
}) {
  // As cores lêem-se aqui dentro, no render (ver DESIGN_SYSTEM.md).
  const cor =
    pessoa.papelPrincipal === 'admin'
      ? colors.primary
      : pessoa.papelPrincipal === 'veterinario'
        ? colors.info
        : colors.warning;

  const ajustada = pessoa.vinculos.some(
    (v) => v.permissoes && Object.keys(v.permissoes).length > 0,
  );

  /**
   * O prazo mais próximo do fim, entre os vínculos que o têm.
   *
   * Com várias explorações, é esse que interessa: é o primeiro a fechar-se, e
   * mostrar o mais distante dava a entender que a pessoa continua a ter acesso
   * a tudo até lá. Quem tem vínculos sem prazo nenhum não mostra linha.
   */
  const prazo = (() => {
    const comPrazo = pessoa.vinculos.filter((v) => v.expiraEm);
    if (comPrazo.length === 0) return null;
    const proximo = comPrazo.sort((a, b) => (a.expiraEm ?? '').localeCompare(b.expiraEm ?? ''))[0];
    const terminou = acessoTerminou(proximo.expiraEm);
    const texto = rotuloPrazo(proximo.expiraEm, formatDataHora);
    return {
      terminou,
      texto: pessoa.vinculos.length > 1 ? `${proximo.nomeExploracao}: ${texto}` : texto,
    };
  })();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pessoa.nome}, ${legendaRole(pessoa.papelPrincipal).toLowerCase()}`}
      accessibilityHint="Toque para escolher o que esta pessoa pode alterar"
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          borderBottomWidth: ultimo ? 0 : 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Avatar initials={iniciais(pessoa.nome)} size={48} background={colors.surfaceSunken} foreground={cor} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {pessoa.nome}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name={ICONE_PAPEL[pessoa.papelPrincipal]} size="sm" color={cor} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }} numberOfLines={2}>
            {resumoVinculos(pessoa)}
          </Text>
        </View>
        {/* Quem tem permissões mexidas dá sinal na lista: sem isto, a única
            forma de saber que uma pessoa está fora do que o papel dá era abrir
            a folha de cada uma, uma a uma. */}
        {ajustada ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Icon name="tune-variant" size="xs" color={colors.warning} />
            <Text variant="caption" color={colors.warning}>
              Permissões ajustadas
            </Text>
          </View>
        ) : null}
        {/* O prazo de acesso, quando existe. É a informação que decide se ainda
            vale a pena telefonar-lhe: um veterinário cujo acesso caiu ontem não
            consegue registar o que quer que seja. */}
        {prazo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Icon
              name={prazo.terminou ? 'clock-alert-outline' : 'clock-outline'}
              size="xs"
              color={prazo.terminou ? colors.danger : colors.warning}
            />
            <Text
              variant="caption"
              color={prazo.terminou ? colors.danger : colors.warning}
              style={{ flex: 1 }}
              numberOfLines={2}>
              {prazo.texto}
            </Text>
          </View>
        ) : null}
      </View>
      <Icon name="tune-variant" size="md" color={colors.textMuted} />
    </Pressable>
  );
}
