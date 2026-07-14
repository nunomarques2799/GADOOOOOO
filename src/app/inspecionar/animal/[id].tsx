import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, EmptyState, Header, Icon, IconBadge, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { formatDataPt, idadeExtenso } from '@/data/helpers';
import { listarEventosDoAnimal } from '@/data/superadminApi';
import { supabase } from '@/data/supabase';
import type { Animal, Evento } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

/** Inspeção read-only dum animal específico. */
export default function InspecionarAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id || !supabase) return;
    setACarregar(true);
    setErro(null);
    try {
      // O superadmin tem RLS-passthrough para animal (via eh_superadmin()).
      const { data } = await supabase.from('animal').select('*').eq('id', id).maybeSingle();
      const evs = await listarEventosDoAnimal(id);
      if (data) {
        type Row = Record<string, unknown>;
        const r = data as Row;
        setAnimal({
          id: String(r.id),
          exploracaoId: String(r.exploracao_id),
          terrenoId: (r.terreno_id as string) ?? undefined,
          maeId: (r.mae_id as string) ?? undefined,
          paiId: (r.pai_id as string) ?? undefined,
          nome: (r.nome as string) ?? undefined,
          especie: r.especie as Animal['especie'],
          sexo: r.sexo as Animal['sexo'],
          dataNascimento: String(r.data_nascimento),
          raca: (r.raca as string) ?? undefined,
          corPelagem: (r.cor_pelagem as string) ?? undefined,
          numeroIdentificacao: (r.numero_identificacao as string) ?? undefined,
          dataIdentificacao: (r.data_identificacao as string) ?? undefined,
          tipoIdentificacao: (r.tipo_identificacao as string) ?? undefined,
          fotografia: (r.fotografia as string) ?? undefined,
          fimIntervaloSeguranca: (r.fim_intervalo_seguranca as string) ?? undefined,
          dataPrevistaParto: (r.data_prevista_parto as string) ?? undefined,
          comunicadoSnira: (r.comunicado_snira as boolean) ?? undefined,
        });
      }
      setEventos(evs);
    } catch (e: unknown) {
      setErro((e as Error).message ?? 'Erro ao carregar.');
    } finally {
      setACarregar(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (aCarregar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Animal" />
        <View style={{ padding: spacing.lg }}>
          <Text variant="body" color={colors.textSecondary}>A carregar…</Text>
        </View>
      </View>
    );
  }

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Animal" />
        <EmptyState icon="cow-off" title="Animal não encontrado" message={erro ?? 'Este registo não existe.'} />
      </View>
    );
  }

  const meta = especieMeta[animal.especie];
  const sexoCor = animal.sexo === 'Fêmea' ? '#C2568A' : '#3B7BC4';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={animal.nome ?? 'Animal'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge }}>
        {/* Cabeçalho */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={64} iconSize={36} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text variant="h2" numberOfLines={1}>{animal.nome ?? 'Sem nome'}</Text>
                <Icon name={animal.sexo === 'Fêmea' ? 'gender-female' : 'gender-male'} size={18} color={sexoCor} />
              </View>
              <Text variant="secondary" color={colors.textSecondary}>
                {animal.raca ?? animal.especie} · {idadeExtenso(animal.dataNascimento)}
              </Text>
              {animal.numeroIdentificacao ? (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                  {animal.numeroIdentificacao}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Ficha */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Ficha</Text>
        <Card padded={false}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <Linha label="Espécie" valor={animal.especie} />
            <Linha label="Sexo" valor={animal.sexo} />
            <Linha label="Nascimento" valor={formatDataPt(animal.dataNascimento)} />
            <Linha label="Raça" valor={animal.raca ?? '—'} />
            <Linha label="Cor" valor={animal.corPelagem ?? '—'} />
            <Linha label="Brinco (SIA)" valor={animal.numeroIdentificacao ?? 'Sem brinco'} />
            <Linha label="Identificado em" valor={animal.dataIdentificacao ? formatDataPt(animal.dataIdentificacao) : '—'} />
            <Linha label="SNIRA comunicado" valor={animal.comunicadoSnira ? 'Sim' : 'Não'} />
            <Linha label="Prox. parto" valor={animal.dataPrevistaParto ? formatDataPt(animal.dataPrevistaParto) : '—'} last />
          </View>
        </Card>

        {/* Eventos */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Eventos ({eventos.length})
        </Text>
        {eventos.length === 0 ? (
          <Card><Text variant="body" color={colors.textSecondary}>Sem eventos registados.</Text></Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {eventos.map((e, i) => (
                <View
                  key={e.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: i < eventos.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radii.pill,
                      backgroundColor: colors.primaryTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name="calendar-check" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                      <Text variant="bodyStrong">{e.tipo}</Text>
                      <Text variant="caption" color={colors.textMuted}>{formatDataPt(e.data)}</Text>
                    </View>
                    <Text variant="body" color={colors.textSecondary}>{e.descricao}</Text>
                    {e.detalhe ? (
                      <Text variant="caption" color={colors.textMuted}>{e.detalhe}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function Linha({ label, valor, last }: { label: string; valor: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        gap: spacing.sm,
      }}>
      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>{label}</Text>
      <Text variant="bodyStrong">{valor}</Text>
    </View>
  );
}
