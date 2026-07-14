import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Badge, Button, Card, Chip, EmptyState, Header, Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import {
  definirSubscricao,
  historicoSubscricao,
  listarExploracoesDoCliente,
  obterCliente,
  type ClienteResumo,
  type EstadoSubscricao,
  type EventoHistorico,
  type ExploracaoResumo,
} from '@/data/superadminApi';
import { colors, radii, sizes, shadow, spacing } from '@/theme';

const planos = ['Basico', 'Standard', 'Pro'];
const estadosSub: { valor: EstadoSubscricao; label: string; icon: IconName }[] = [
  { valor: 'trial', label: 'Trial', icon: 'clock-outline' },
  { valor: 'ativa', label: 'Ativa', icon: 'check-circle' },
  { valor: 'atrasada', label: 'Atrasada', icon: 'alert' },
  { valor: 'cancelada', label: 'Cancelada', icon: 'close-circle' },
];

export default function ClienteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { aprovarCliente, bloquearCliente } = useMembros();

  const [cliente, setCliente] = useState<ClienteResumo | null>(null);
  const [exploracoes, setExploracoes] = useState<ExploracaoResumo[]>([]);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Form subscrição
  const [plano, setPlano] = useState('Basico');
  const [preco, setPreco] = useState('0');
  const [estadoSub, setEstadoSub] = useState<EstadoSubscricao>('trial');
  const [notas, setNotas] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setACarregar(true);
    setErro(null);
    try {
      const [c, exps, hist] = await Promise.all([
        obterCliente(id),
        listarExploracoesDoCliente(id),
        historicoSubscricao(id),
      ]);
      setCliente(c);
      setExploracoes(exps);
      setHistorico(hist);
      if (c) {
        setPlano(c.plano ?? 'Basico');
        setPreco(String(c.precoMensal ?? 0));
        setEstadoSub(c.estadoSubscricao ?? 'trial');
      }
    } catch (e: unknown) {
      setErro((e as Error).message ?? 'Erro ao obter dados.');
    } finally {
      setACarregar(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function guardarSubscricao() {
    if (!id) return;
    setAGuardar(true);
    setErro(null);
    setOkMsg(null);
    const precoNum = Number(preco.replace(',', '.')) || 0;
    const e = await definirSubscricao(id, plano, precoNum, estadoSub, undefined, notas.trim() || undefined);
    setAGuardar(false);
    if (e) {
      setErro(e);
      return;
    }
    setOkMsg('Subscrição atualizada.');
    await carregar();
  }

  async function alternarEstado() {
    if (!cliente) return;
    setErro(null);
    const e = cliente.estado === 'pendente'
      ? await aprovarCliente(cliente.userId)
      : await bloquearCliente(cliente.userId);
    if (e) {
      setErro(e);
      return;
    }
    await carregar();
  }

  if (aCarregar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Cliente" />
        <View style={{ padding: spacing.lg }}>
          <Text variant="body" color={colors.textSecondary}>A carregar…</Text>
        </View>
      </View>
    );
  }

  if (!cliente) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Cliente" />
        <EmptyState icon="account-off-outline" title="Cliente não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  const iniciais = cliente.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Cliente" actionIcon="refresh" onAction={carregar} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge }}>
        {/* Cabeçalho do cliente */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.pill,
                backgroundColor: cliente.estado === 'ativo' ? colors.primaryTint : colors.warningTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text variant="h2" color={cliente.estado === 'ativo' ? colors.primaryDark : colors.warning}>{iniciais || '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={1}>{cliente.nome}</Text>
              <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>{cliente.email}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
                <Badge
                  tone={cliente.estado === 'ativo' ? 'success' : 'warning'}
                  icon={cliente.estado === 'ativo' ? 'check-circle' : 'clock-outline'}
                  label={cliente.estado === 'ativo' ? 'Ativo' : 'Pendente'}
                />
                {cliente.nif ? <Badge tone="neutral" icon="card-account-details-outline" label={`NIF ${cliente.nif}`} /> : null}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              label={cliente.estado === 'ativo' ? 'Bloquear' : 'Aprovar'}
              icon={cliente.estado === 'ativo' ? 'block-helper' : 'check'}
              variant={cliente.estado === 'ativo' ? 'ghost' : 'primary'}
              onPress={alternarEstado}
            />
          </View>
        </Card>

        {/* Stats */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Efetivo</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatBox icon="barn" valor={cliente.nExploracoes} label="Explorações" />
          <StatBox icon="grass" valor={cliente.nTerrenos} label="Terrenos" tint={colors.success} />
          <StatBox icon="cow" valor={cliente.nAnimais} label="Animais" tint={colors.caprino} />
        </View>

        {/* Explorações — clicáveis para drill-down */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Explorações</Text>
        {exploracoes.length === 0 ? (
          <Card><Text variant="body" color={colors.textSecondary}>Este cliente ainda não criou explorações.</Text></Card>
        ) : (
          exploracoes.map((e) => (
            <Card
              key={e.id}
              style={{ marginBottom: spacing.sm }}
              onPress={() => router.push(`/inspecionar/exploracao/${e.id}`)}
              accessibilityLabel={`Ver dados de ${e.nome}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radii.md,
                    backgroundColor: colors.primaryTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="barn" size="md" color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>{e.nome}</Text>
                  <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                    {e.marcaExploracao}{e.localizacao ? ` · ${e.localizacao}` : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', marginRight: spacing.xs }}>
                  <Text variant="bodyStrong">{e.nAnimais}</Text>
                  <Text variant="caption" color={colors.textMuted}>animais</Text>
                </View>
                <Icon name="chevron-right" size="md" color={colors.textMuted} />
              </View>
            </Card>
          ))
        )}

        {/* Subscrição */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Subscrição</Text>
        <Card>
          <Text variant="label" style={{ marginBottom: spacing.xs }}>Plano</Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
            {planos.map((p) => (
              <Chip key={p} label={p} icon="star-outline" selected={plano === p} onPress={() => setPlano(p)} />
            ))}
          </View>

          <Text variant="label" style={{ marginBottom: spacing.xs }}>Preço mensal (€)</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              height: sizes.input,
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.md,
              marginBottom: spacing.md,
            }}>
            <Icon name="cash" size="md" color={colors.textMuted} />
            <TextInput
              value={preco}
              onChangeText={setPreco}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
            />
            <Text variant="body" color={colors.textMuted}>€/mês</Text>
          </View>

          <Text variant="label" style={{ marginBottom: spacing.xs }}>Estado</Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
            {estadosSub.map((s) => (
              <Chip
                key={s.valor}
                label={s.label}
                icon={s.icon}
                selected={estadoSub === s.valor}
                onPress={() => setEstadoSub(s.valor)}
              />
            ))}
          </View>

          <Text variant="label" style={{ marginBottom: spacing.xs }}>Notas internas</Text>
          <View
            style={{
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              marginBottom: spacing.md,
            }}>
            <TextInput
              value={notas}
              onChangeText={setNotas}
              placeholder="Ex: acordou desconto 20% até setembro"
              placeholderTextColor={colors.textMuted}
              multiline
              style={{
                fontFamily: 'Nunito_500Medium',
                fontSize: 16,
                color: colors.text,
                minHeight: 60,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {okMsg ? (
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.xs,
                alignItems: 'center',
                backgroundColor: colors.successTint,
                padding: spacing.sm,
                borderRadius: radii.md,
                marginBottom: spacing.sm,
              }}>
              <Icon name="check-circle" size="sm" color={colors.success} />
              <Text variant="secondary" color={colors.success} style={{ flex: 1 }}>{okMsg}</Text>
            </View>
          ) : null}

          {erro ? (
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.xs,
                alignItems: 'center',
                backgroundColor: colors.dangerTint,
                padding: spacing.sm,
                borderRadius: radii.md,
                marginBottom: spacing.sm,
              }}>
              <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
              <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>{erro}</Text>
            </View>
          ) : null}

          <Button label="Guardar subscrição" icon="check" onPress={guardarSubscricao} loading={aGuardar} />
        </Card>

        {/* Histórico de subscrição */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>Histórico</Text>
        {historico.length === 0 ? (
          <Card><Text variant="body" color={colors.textSecondary}>Ainda sem eventos.</Text></Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {historico.map((h, i) => (
                <View
                  key={h.id}
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: i < historico.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}>
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: radii.pill,
                      backgroundColor: corDoEvento(h.tipo) + '22',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    <Icon name={iconeDoEvento(h.tipo)} size="sm" color={corDoEvento(h.tipo)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{legendaEvento(h.tipo)}</Text>
                    <Text variant="secondary" color={colors.textSecondary}>
                      {h.plano ?? '—'}
                      {h.precoMensal != null ? ` · ${h.precoMensal.toFixed(0)}€/mês` : ''}
                      {h.estado ? ` · ${h.estado}` : ''}
                    </Text>
                    {h.notas ? (
                      <Text variant="caption" color={colors.textMuted}>{h.notas}</Text>
                    ) : null}
                  </View>
                  <Text variant="caption" color={colors.textMuted}>{formatDataHora(h.em)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function iconeDoEvento(tipo: string): IconName {
  if (tipo === 'criado') return 'plus-circle';
  if (tipo === 'estado_mudou') return 'sync';
  if (tipo === 'preco_mudou') return 'cash';
  if (tipo === 'plano_mudou') return 'star';
  if (tipo === 'eliminado') return 'trash-can-outline';
  return 'pencil-outline';
}

function corDoEvento(tipo: string): string {
  if (tipo === 'criado') return colors.success;
  if (tipo === 'eliminado') return colors.danger;
  if (tipo === 'estado_mudou') return colors.info;
  return colors.primary;
}

function legendaEvento(tipo: string): string {
  if (tipo === 'criado') return 'Subscrição criada';
  if (tipo === 'estado_mudou') return 'Mudou de estado';
  if (tipo === 'preco_mudou') return 'Preço alterado';
  if (tipo === 'plano_mudou') return 'Plano alterado';
  if (tipo === 'eliminado') return 'Subscrição eliminada';
  return 'Atualizada';
}

function formatDataHora(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function StatBox({
  icon,
  valor,
  label,
  tint = colors.primary,
}: {
  icon: IconName;
  valor: number;
  label: string;
  tint?: string;
}) {
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          padding: spacing.md,
          alignItems: 'center',
          gap: 2,
        },
        shadow.sm,
      ]}>
      <Icon name={icon} size={26} color={tint} />
      <Text variant="h2">{valor}</Text>
      <Text variant="caption" color={colors.textMuted}>{label}</Text>
    </View>
  );
}
