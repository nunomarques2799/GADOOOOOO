import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, EmptyState, Header, Icon, IconBadge, Text } from '@/components/ui';
import { especieMeta, tipoTerrenoMeta } from '@/data/constants';
import { idadeExtenso } from '@/data/helpers';
import {
  listarAnimaisDaExploracao,
  listarTerrenosDaExploracao,
} from '@/data/superadminApi';
import type { Animal, Terreno } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

/**
 * Vista de "inspeção" (só leitura) que o superadmin usa para ver os dados
 * concretos de uma exploração dum cliente — sem se misturar com o modo
 * normal de gestão do próprio cliente.
 */
export default function InspecionarExploracaoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [terrenos, setTerrenos] = useState<Terreno[]>([]);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setACarregar(true);
    setErro(null);
    try {
      const [ts, as] = await Promise.all([
        listarTerrenosDaExploracao(id),
        listarAnimaisDaExploracao(id),
      ]);
      setTerrenos(ts);
      setAnimais(as);
    } catch (e: unknown) {
      setErro((e as Error).message ?? 'Erro ao carregar.');
    } finally {
      setACarregar(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const areaTotal = terrenos.reduce((s, t) => s + (t.area ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Inspecionar exploração" actionIcon="refresh" onAction={carregar} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge }}>
        {erro ? (
          <Card style={{ backgroundColor: colors.dangerTint, marginTop: spacing.md }}>
            <Text variant="body" color={colors.danger}>{erro}</Text>
          </Card>
        ) : null}

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <StatBox icon="grass" valor={terrenos.length} label="Terrenos" tint={colors.success} />
          <StatBox icon="cow" valor={animais.length} label="Animais" tint={colors.caprino} />
          <StatBox icon="ruler-square" valor={areaTotal.toFixed(1)} label="Hectares" />
        </View>

        {/* Terrenos */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Terrenos ({terrenos.length})
        </Text>
        {aCarregar && terrenos.length === 0 ? (
          <Card><Text variant="body" color={colors.textSecondary}>A carregar…</Text></Card>
        ) : terrenos.length === 0 ? (
          <Card><Text variant="body" color={colors.textSecondary}>Sem terrenos registados.</Text></Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {terrenos.map((t, i) => {
                const meta = tipoTerrenoMeta[t.tipo ?? 'Outro'];
                return (
                  <View
                    key={t.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      borderBottomWidth: i < terrenos.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}>
                    <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={40} iconSize={20} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{t.nome}</Text>
                      <Text variant="secondary" color={colors.textSecondary}>
                        {t.tipo ?? 'Outro'}
                        {t.area ? ` · ${t.area} ha` : ''}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Animais */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Animais ({animais.length})
        </Text>
        {animais.length === 0 ? (
          <EmptyState icon="cow-off" title="Sem animais" message="Esta exploração ainda não tem animais registados." />
        ) : (
          animais.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => router.push({ pathname: '/inspecionar/animal/[id]', params: { id: a.id } })}
              accessibilityRole="button"
              accessibilityLabel={a.nome ?? 'Animal'}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                },
                pressed && { opacity: 0.85 },
              ]}>
              <IconBadge
                name={especieMeta[a.especie].icon}
                color={especieMeta[a.especie].cor}
                background={colors.primaryTint}
                size={44}
                iconSize={24}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>{a.nome ?? 'Sem nome'}</Text>
                <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                  {a.numeroIdentificacao ?? 'Sem brinco'} · {a.raca ?? a.especie} · {idadeExtenso(a.dataNascimento)}
                </Text>
              </View>
              <Icon name="chevron-right" size="md" color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({
  icon,
  valor,
  label,
  tint = colors.primary,
}: {
  icon: 'grass' | 'cow' | 'ruler-square';
  valor: number | string;
  label: string;
  tint?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <Icon name={icon} size={22} color={tint} />
      <Text variant="h2" style={{ marginTop: 2 }}>{valor}</Text>
      <Text variant="caption" color={colors.textMuted}>{label}</Text>
    </View>
  );
}
