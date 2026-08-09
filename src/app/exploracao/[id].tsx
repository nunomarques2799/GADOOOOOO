import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AnimalRow } from '@/components/AnimalRow';
import { WeatherCard } from '@/components/WeatherCard';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Header,
  Icon,
  type IconName,
  IconBadge,
  Screen,
  Text,
} from '@/components/ui';
import { tipoTerrenoMeta } from '@/data/constants';
import { mapaAlertas } from '@/data/filtrosAnimais';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import type { EstadoMeteo } from '@/data/useMeteorologia';
import { useMeteorologia } from '@/data/useMeteorologia';
import { colors, radii, shadow, spacing } from '@/theme';

export default function ExploracaoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { exploracaoById, terrenosByExploracao, animaisByExploracao, alertas } = useGado();
  const porAnimal = useMemo(() => mapaAlertas(alertas), [alertas]);
  const { roleEm, pode } = useMembros();
  const { meteo, estado, recarregar } = useMeteorologia(id);
  // Os controlos seguem as permissões do papel (ver `permissoes.ts`): um
  // veterinário não vê "editar" nem "adicionar terreno", porque o servidor
  // recusaria a gravação — e feita offline, essa recusa só apareceria na
  // sincronização, muito depois de a pessoa julgar que tinha guardado.
  const podeGerirEquipa = pode(id, 'gerirEquipa');
  const podeEditar = pode(id, 'editarExploracao');
  const podeGerirTerrenos = pode(id, 'gerirTerrenos');
  const podeRegistarAnimais = pode(id, 'editarAnimais');
  const meuRole = id ? roleEm(id) : undefined;

  const exploracao = exploracaoById(id);

  if (!exploracao) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Exploração" />
        <EmptyState icon="barn" title="Exploração não encontrada" message="Este registo já não existe." />
      </View>
    );
  }

  const terrenos = terrenosByExploracao(exploracao.id);
  const animais = animaisByExploracao(exploracao.id);
  const areaTotal = terrenos.reduce((s, t) => s + (t.area ?? 0), 0);
  const semTerreno = animais.filter(
    (a) => !a.terrenoId || !terrenos.some((t) => t.id === a.terrenoId),
  ).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={exploracao.nome}
        actionIcon={podeEditar ? 'pencil-outline' : undefined}
        onAction={
          podeEditar ? () => router.push(`/exploracao/editar/${exploracao.id}`) : undefined
        }
      />
      <Screen>
        {/* Hero */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ borderRadius: radii.xl, padding: spacing.lg }, shadow.md]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.lg,
                backgroundColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
              {exploracao.fotografia ? (
                <Image
                  source={{ uri: exploracao.fotografia }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              ) : (
                <Icon name="barn" size={38} color={colors.textOnDark} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h1" color={colors.textOnDark} numberOfLines={1}>
                {exploracao.nome}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="map-marker" size={14} color={colors.textOnDarkMuted} />
                <Text variant="secondary" color={colors.textOnDarkMuted} numberOfLines={1}>
                  {exploracao.localizacao ?? 'Sem localização'}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing.md,
              paddingTop: spacing.md,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.18)',
            }}>
            <HeroStat value={animais.length} label="Animais" />
            <HeroStat value={terrenos.length} label="Terrenos" />
            <HeroStat value={`${areaTotal.toFixed(1)} ha`} label="Área total" />
          </View>
        </LinearGradient>

        {/* Quem entrou por convite não é dono desta exploração e vê menos
            botões. Dizer o papel evita a pergunta "porque não consigo editar?" */}
        {meuRole && meuRole !== 'admin' ? (
          <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
            <Badge
              tone="info"
              icon={meuRole === 'veterinario' ? 'medical-bag' : 'account-hard-hat'}
              label={`Entrou como ${legendaRole(meuRole).toLowerCase()}`}
            />
          </View>
        ) : null}

        {/* Meteorologia local */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Meteorologia local
        </Text>
        {meteo ? (
          <WeatherCard meteo={meteo} estado={mapEstado(estado)} onRecarregar={recarregar} />
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon
                name={estado === 'sem-local' ? 'map-marker-off' : 'cloud-off-outline'}
                size="lg"
                color={colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body">
                  {estado === 'a-carregar'
                    ? 'A obter meteorologia…'
                    : estado === 'sem-local'
                    ? 'Sem localização definida.'
                    : 'Sem ligação à meteorologia.'}
                </Text>
                {estado === 'sem-local' ? (
                  <Text variant="secondary" color={colors.textSecondary}>
                    Edite a exploração e escreva a localização, ou marque no mapa onde ela fica.
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        )}

        {/* Dados oficiais */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Dados da exploração
        </Text>
        <Card>
          <InfoField icon="barcode" label="Marca de exploração" value={exploracao.marcaExploracao} />
          <InfoField icon="card-account-details-outline" label="NIF do detentor" value={exploracao.nifDetentor} last />
        </Card>

        {/* Terrenos */}
        <TituloSeccao
          titulo={`Terrenos (${terrenos.length})`}
          rotuloAdicionar={podeGerirTerrenos ? 'Adicionar terreno' : undefined}
          onAdicionar={() =>
            router.push({ pathname: '/terreno/novo', params: { exploracaoId: exploracao.id } })
          }
        />

        {terrenos.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Ainda não há terrenos nesta exploração.
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {terrenos.map((t, i) => {
                const meta = tipoTerrenoMeta[t.tipo ?? 'Outro'];
                // Quantos animais andam neste terreno. É a informação que dá
                // sentido à lista — sem ela, o criador tinha de entrar em cada
                // terreno para saber onde está o gado, e a soma dos cercados
                // nunca batia com o número do topo sem fazer as contas à mão.
                const nAnimais = animais.filter((a) => a.terrenoId === t.id).length;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push(`/terreno/${t.id}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.sm,
                        borderBottomWidth: i < terrenos.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border,
                      },
                      pressed && { opacity: 0.6 },
                    ]}>
                    {t.fotografia ? (
                      <Image
                        source={{ uri: t.fotografia }}
                        style={{ width: 44, height: 44, borderRadius: radii.md }}
                        contentFit="cover"
                      />
                    ) : (
                      <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={44} iconSize={22} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{t.nome}</Text>
                      <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                        {t.tipo ?? 'Outro'}
                        {t.area ? ` · ${t.area} ha` : ''}
                        {t.latitude != null && t.longitude != null ? ' · GPS' : ''}
                      </Text>
                    </View>
                    <Badge
                      tone={nAnimais > 0 ? 'brand' : 'neutral'}
                      icon="cow"
                      label={String(nAnimais)}
                    />
                    <Icon name="chevron-right" size="md" color={colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {/* Sem isto, as contagens dos terrenos não somavam o total do topo e
            não havia nada a explicar a diferença. É também o caminho mais curto
            para arrumar o gado que ficou por atribuir. */}
        {semTerreno > 0 && terrenos.length > 0 ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            {semTerreno} {semTerreno === 1 ? 'animal ainda sem terreno' : 'animais ainda sem terreno'}
            . Abra um terreno e use “Associar animais”.
          </Text>
        ) : null}

        {/* Animais */}
        <TituloSeccao
          titulo={`Animais (${animais.length})`}
          rotuloAdicionar={podeRegistarAnimais ? 'Registar animal' : undefined}
          onAdicionar={() =>
            router.push({ pathname: '/animal/novo', params: { exploracaoId: exploracao.id } })
          }
        />
        {animais.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Ainda não há animais nesta exploração.
            </Text>
          </Card>
        ) : (
          animais
            .slice(0, 4)
            .map((a) => (
              <AnimalRow
                key={a.id}
                animal={a}
                nomeTerreno={a.terrenoId ? terrenos.find((t) => t.id === a.terrenoId)?.nome : undefined}
                alertas={porAnimal.get(a.id)}
              />
            ))
        )}
        {animais.length > 4 ? (
          <Button
            label={`Ver todos os ${animais.length} animais`}
            variant="secondary"
            icon="cow"
            onPress={() => router.push('/animais')}
            style={{ marginTop: spacing.xs }}
          />
        ) : null}

        {/* ---- Gerir a exploração ----
         *
         * No FIM da página, e já não a meio dela. Estavam entre os dados
         * oficiais e a lista de terrenos, o que punha duas ações de
         * configuração — coisas que se fazem uma vez e depois raramente — a
         * cortar ao meio o que se vem aqui ver todos os dias: os terrenos e o
         * gado que anda em cada um. Aqui em baixo continuam a apanhar-se a
         * rolar, e quem só quer editar tem o lápis no cabeçalho.
         */}
        {podeEditar || podeGerirEquipa ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            <Text variant="label" color={colors.textSecondary} style={{ marginLeft: spacing.xs }}>
              GERIR
            </Text>
            {/* Editar — além do lápis no cabeçalho, que passa despercebido a
                quem não anda em apps todos os dias. */}
            {podeEditar ? (
              <Button
                label="Editar dados da exploração"
                icon="pencil-outline"
                variant="secondary"
                onPress={() => router.push(`/exploracao/editar/${exploracao.id}`)}
              />
            ) : null}
            {/* Equipa (só admin desta exploração) */}
            {podeGerirEquipa ? (
              <Button
                label="Gerir equipa e convites"
                icon="account-multiple-plus"
                variant="secondary"
                onPress={() => router.push(`/exploracao/equipa/${exploracao.id}`)}
              />
            ) : null}
          </View>
        ) : null}
      </Screen>
    </View>
  );
}

/** Converte o estado do hook para o que o WeatherCard espera (só sabe 3 estados). */
function mapEstado(e: EstadoMeteo): 'a-carregar' | 'atual' | 'offline' {
  if (e === 'atual') return 'atual';
  if (e === 'a-carregar') return 'a-carregar';
  return 'offline';
}

/**
 * Título de secção com o atalho para acrescentar à direita.
 *
 * Terrenos e animais acrescentam-se DAQUI, de dentro da exploração: chegar ao
 * mesmo sítio pela lista geral obrigava a escolher outra vez a exploração num
 * ecrã que já sabia qual era. Sem `rotuloAdicionar` (papel sem permissão) fica
 * só o título — um botão que o servidor iria recusar é pior do que nenhum.
 */
function TituloSeccao({
  titulo,
  rotuloAdicionar,
  onAdicionar,
}: {
  titulo: string;
  rotuloAdicionar?: string;
  onAdicionar: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginTop: spacing.xl,
        marginBottom: spacing.xs,
      }}>
      <Text variant="h3" style={{ flex: 1 }}>
        {titulo}
      </Text>
      {rotuloAdicionar ? (
        <Pressable
          onPress={onAdicionar}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={rotuloAdicionar}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="plus-circle" size="md" color={colors.primary} />
            <Text variant="bodyStrong" color={colors.primary}>
              Adicionar
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function HeroStat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h2" color={colors.textOnDark}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textOnDarkMuted}>
        {label}
      </Text>
    </View>
  );
}

function InfoField({
  icon,
  label,
  value,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}
