import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GraficoBarras } from '@/components/GraficoBarras';
import { Badge, Card, EmptyState, Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import {
  listarClientes,
  metricasMensais,
  type ClienteResumo,
  type EstadoSubscricao,
  type MetricasMensais,
} from '@/data/superadminApi';
import { colors, radii, spacing } from '@/theme';

type Filtro = 'todos' | 'pendentes' | 'ativos';

export default function ClientesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { aprovarCliente } = useMembros();

  const [clientes, setClientes] = useState<ClienteResumo[]>([]);
  const [metricas, setMetricas] = useState<MetricasMensais[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aProcessar, setAProcessar] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(null);
    // Independentes: se as métricas falharem (ex: função ainda não atualizada),
    // ainda queremos ver a lista de clientes.
    const [csRes, msRes] = await Promise.allSettled([listarClientes(), metricasMensais(6)]);
    if (csRes.status === 'fulfilled') setClientes(csRes.value);
    else setErro((csRes.reason as Error).message ?? 'Erro a obter clientes.');
    if (msRes.status === 'fulfilled') setMetricas(msRes.value);
    else setMetricas([]);
    setACarregar(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function aprovarInline(userId: string) {
    setAProcessar(userId);
    const e = await aprovarCliente(userId);
    setAProcessar(null);
    if (e) {
      setErro(e);
      return;
    }
    await carregar();
  }

  const filtrados = useMemo(() => {
    if (filtro === 'pendentes') return clientes.filter((c) => c.estado === 'pendente');
    if (filtro === 'ativos') return clientes.filter((c) => c.estado === 'ativo');
    return clientes;
  }, [filtro, clientes]);

  const stats = useMemo(() => {
    const ativos = clientes.filter((c) => c.estado === 'ativo').length;
    const pendentes = clientes.filter((c) => c.estado === 'pendente').length;
    const mrr = clientes
      .filter((c) => c.estadoSubscricao === 'ativa')
      .reduce((s, c) => s + (c.precoMensal ?? 0), 0);
    return { ativos, pendentes, mrr };
  }, [clientes]);

  const churnMedio = useMemo(() => {
    if (metricas.length === 0) return 0;
    const meses = metricas.filter((m) => m.ativosFim > 0);
    if (meses.length === 0) return 0;
    return meses.reduce((s, m) => s + m.churnRate, 0) / meses.length;
  }, [metricas]);

  // LTV = ARPU / churn_rate; sem churn > 0, mostramos "—".
  const ltv = useMemo(() => {
    if (churnMedio <= 0 || stats.ativos === 0) return null;
    const arpu = stats.mrr / Math.max(stats.ativos, 1);
    return arpu / (churnMedio / 100);
  }, [churnMedio, stats.mrr, stats.ativos]);

  const nomesMes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const rotuloMes = (iso: string): string => {
    const d = new Date(iso);
    return nomesMes[d.getMonth()];
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.huge + 40 }}>
        {/* Cabeçalho */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.xxl,
            paddingHorizontal: spacing.lg,
            borderBottomLeftRadius: radii.xl,
            borderBottomRightRadius: radii.xl,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 }}>
            <Icon name="shield-crown" size={16} color={colors.textOnDarkMuted} />
            <Text variant="secondary" color={colors.textOnDarkMuted}>Painel do administrador</Text>
          </View>
          <Text variant="display" color={colors.textOnDark}>Clientes</Text>
          <Text variant="body" color={colors.textOnDarkMuted}>
            Aprovação, subscrições e detalhes por cliente.
          </Text>
        </LinearGradient>

        {/* KPIs */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: -spacing.xl }}>
          <StatKpi icon="account-group" valor={stats.ativos} legenda="Ativos" />
          <StatKpi icon="clock-outline" valor={stats.pendentes} legenda="Pendentes" tint={colors.warning} />
          <StatKpi icon="cash" valor={`${stats.mrr.toFixed(0)}€`} legenda="MRR" tint={colors.success} />
        </View>

        {/* Métricas mensais + LTV + churn */}
        {metricas.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md }}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm }}>
                <Text variant="h3">MRR — últimos 6 meses</Text>
                <Text variant="caption" color={colors.textMuted}>euros / mês</Text>
              </View>
              <GraficoBarras
                pontos={metricas.map((m) => ({
                  label: rotuloMes(m.mes),
                  valor: Math.round(m.mrr),
                  legenda: `${m.ativosFim}`,
                }))}
                formatValor={(v) => `${v}€`}
                cor={colors.primary}
              />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.xs, alignItems: 'center' }}>
                <Icon name="account-multiple" size={12} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted}>Nº abaixo do mês = ativos no fim do mês</Text>
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Card style={{ flex: 1 }}>
                <Text variant="label" color={colors.textSecondary}>Churn mensal (média)</Text>
                <Text variant="display" style={{ marginTop: 2 }}>{churnMedio.toFixed(1)}%</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {metricas[metricas.length - 1]?.cancelados ?? 0} cancelamento(s) este mês
                </Text>
              </Card>
              <Card style={{ flex: 1 }}>
                <Text variant="label" color={colors.textSecondary}>LTV estimado</Text>
                <Text variant="display" style={{ marginTop: 2 }}>
                  {ltv == null ? '—' : `${Math.round(ltv)}€`}
                </Text>
                <Text variant="caption" color={colors.textMuted}>ARPU ÷ churn</Text>
              </Card>
            </View>

            <Card>
              <Text variant="h3" style={{ marginBottom: spacing.xs }}>Novos vs cancelamentos</Text>
              <GraficoBarras
                pontos={metricas.map((m) => ({ label: rotuloMes(m.mes), valor: m.novos }))}
                cor={colors.success}
                altura={80}
                title="Novos"
              />
              <View style={{ height: spacing.sm }} />
              <GraficoBarras
                pontos={metricas.map((m) => ({ label: rotuloMes(m.mes), valor: m.cancelados }))}
                cor={colors.danger}
                altura={80}
                title="Cancelamentos"
              />
            </Card>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {/* Filtros */}
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
            <FiltroBtn label="Todos" ativo={filtro === 'todos'} onPress={() => setFiltro('todos')} count={clientes.length} />
            <FiltroBtn label="Pendentes" ativo={filtro === 'pendentes'} onPress={() => setFiltro('pendentes')} count={stats.pendentes} />
            <FiltroBtn label="Ativos" ativo={filtro === 'ativos'} onPress={() => setFiltro('ativos')} count={stats.ativos} />
          </View>

          {erro ? (
            <Card style={{ backgroundColor: colors.dangerTint, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Icon name="alert-circle-outline" size="md" color={colors.danger} />
                <Text variant="body" color={colors.danger} style={{ flex: 1 }}>{erro}</Text>
              </View>
            </Card>
          ) : null}

          {aCarregar ? (
            <Card><Text variant="body" color={colors.textSecondary}>A carregar…</Text></Card>
          ) : filtrados.length === 0 ? (
            <EmptyState
              icon="account-off-outline"
              title="Sem clientes"
              message={filtro === 'pendentes' ? 'Ninguém a aguardar aprovação.' : 'Ainda não há clientes.'}
            />
          ) : (
            filtrados.map((c) => (
              <ClienteCard
                key={c.userId}
                cliente={c}
                onPress={() => router.push(`/cliente/${c.userId}`)}
                onAprovar={() => aprovarInline(c.userId)}
                aProcessar={aProcessar === c.userId}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatKpi({
  icon,
  valor,
  legenda,
  tint = colors.primary,
}: {
  icon: IconName;
  valor: string | number;
  legenda: string;
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
        gap: 2,
      }}>
      <Icon name={icon} size="md" color={tint} />
      <Text variant="h2">{valor}</Text>
      <Text variant="caption" color={colors.textMuted}>{legenda}</Text>
    </View>
  );
}

function FiltroBtn({
  label,
  ativo,
  onPress,
  count,
}: {
  label: string;
  ativo: boolean;
  onPress: () => void;
  count: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: ativo ? colors.primary : colors.border,
          backgroundColor: ativo ? colors.primaryTint : colors.surface,
          alignItems: 'center',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Text variant="bodyStrong" color={ativo ? colors.primaryDark : colors.textSecondary}>
        {label} · {count}
      </Text>
    </Pressable>
  );
}

function ClienteCard({
  cliente,
  onPress,
  onAprovar,
  aProcessar,
}: {
  cliente: ClienteResumo;
  onPress: () => void;
  onAprovar: () => void;
  aProcessar: boolean;
}) {
  const iniciais = cliente.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <Card style={{ marginBottom: spacing.sm }} padded={false} onPress={onPress} accessibilityLabel={cliente.nome}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radii.pill,
              backgroundColor: cliente.estado === 'ativo' ? colors.primaryTint : colors.warningTint,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text variant="bodyStrong" color={cliente.estado === 'ativo' ? colors.primaryDark : colors.warning}>{iniciais || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={1}>{cliente.nome}</Text>
            <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>{cliente.email}</Text>
          </View>
          {cliente.estado === 'pendente' ? (
            <Badge tone="warning" icon="clock-outline" label="Pendente" />
          ) : (
            <BadgeSubscricao estado={cliente.estadoSubscricao} plano={cliente.plano} />
          )}
        </View>

        {cliente.estado === 'ativo' ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.lg,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}>
            <MiniStat icon="barn" valor={cliente.nExploracoes} label="explor." />
            <MiniStat icon="grass" valor={cliente.nTerrenos} label="terrenos" />
            <MiniStat icon="cow" valor={cliente.nAnimais} label="animais" />
            {cliente.precoMensal != null && cliente.precoMensal > 0 ? (
              <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                <Text variant="bodyStrong">{cliente.precoMensal.toFixed(0)}€/mês</Text>
                {cliente.proximaCobranca ? (
                  <Text variant="caption" color={colors.textMuted}>
                    Prox. {formatCurto(cliente.proximaCobranca)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={onAprovar}
            disabled={aProcessar}
            accessibilityRole="button"
            style={({ pressed }) => [
              {
                marginTop: spacing.xs,
                backgroundColor: colors.primary,
                borderRadius: radii.pill,
                paddingVertical: spacing.xs,
                alignItems: 'center',
                opacity: aProcessar ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}>
            <Text variant="button" color={colors.onPrimary}>
              {aProcessar ? 'A aprovar…' : 'Aprovar como cliente'}
            </Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function BadgeSubscricao({ estado, plano }: { estado?: EstadoSubscricao; plano?: string }) {
  if (!estado || estado === 'trial') return <Badge tone="neutral" icon="clock-outline" label={plano ?? 'Trial'} />;
  if (estado === 'ativa') return <Badge tone="brand" icon="check-circle" label={plano ?? 'Ativa'} />;
  if (estado === 'atrasada') return <Badge tone="warning" icon="alert" label="Atrasada" />;
  return <Badge tone="danger" icon="close-circle" label="Cancelada" />;
}

function MiniStat({ icon, valor, label }: { icon: IconName; valor: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size="sm" color={colors.primary} />
      <Text variant="bodyStrong">{valor}</Text>
      <Text variant="secondary" color={colors.textSecondary}>{label}</Text>
    </View>
  );
}

function formatCurto(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}
