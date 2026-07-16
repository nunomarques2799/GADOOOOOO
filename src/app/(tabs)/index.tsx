import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertItem } from '@/components/AlertItem';
import { BannerAtualizacao } from '@/components/BannerAtualizacao';
import { ExploracaoRow } from '@/components/ExploracaoRow';
import { QuickAction } from '@/components/QuickAction';
import { StatCard } from '@/components/StatCard';
import { Avatar, Badge, Card, Icon, SectionHeader, Text } from '@/components/ui';
import { dataExtensa, saudacao } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { colors, radii, spacing } from '@/theme';

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSuperadmin } = useMembros();
  const { utilizador, exploracoes, terrenos, animais, alertas, online, pendentesSinc } = useGado();

  // Superadmin não gere gado — vai direto para o painel de clientes.
  if (isSuperadmin) return <Redirect href="/(superadmin)/clientes" />;

  const primeiroNome = utilizador.nome.split(' ')[0];
  const iniciais = utilizador.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  const urgentes = alertas.filter((a) => a.gravidade === 'urgente').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
        {/* Cabeçalho verde */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.xxxl + spacing.lg,
            paddingHorizontal: spacing.lg,
            borderBottomLeftRadius: radii.xl,
            borderBottomRightRadius: radii.xl,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLg" color={colors.textOnDarkMuted}>
                {saudacao()},
              </Text>
              <Text variant="display" color={colors.textOnDark} numberOfLines={1}>
                {primeiroNome}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="calendar-blank" size={14} color={colors.textOnDarkMuted} />
                <Text variant="secondary" color={colors.textOnDarkMuted}>
                  {dataExtensa()}
                </Text>
              </View>
            </View>
            <Avatar
              initials={iniciais}
              size={54}
              background="rgba(255,255,255,0.18)"
              foreground={colors.textOnDark}
            />
          </View>
        </LinearGradient>

        {/* Conteúdo */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xxxl }}>
          {/* Aviso de nova versão — só na app desktop quando há atualização */}
          <BannerAtualizacao />

          {/* Estado de sincronização — só aparece offline ou com pendentes */}
          {!online || pendentesSinc > 0 ? (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon
                  name={online ? 'cloud-sync-outline' : 'cloud-off-outline'}
                  size="lg"
                  color={online ? colors.info : colors.warning}
                />
                <Text variant="body" style={{ flex: 1 }}>
                  {online
                    ? `A sincronizar ${pendentesSinc} alteração${pendentesSinc > 1 ? 'ões' : ''}…`
                    : pendentesSinc > 0
                      ? `Sem ligação. ${pendentesSinc} alteração${pendentesSinc > 1 ? 'ões' : ''} guardada${pendentesSinc > 1 ? 's' : ''} — envio automático quando houver rede.`
                      : 'Sem ligação. Está a trabalhar offline; os dados estão guardados no dispositivo.'}
                </Text>
              </View>
            </Card>
          ) : null}

          {/* Alertas */}
          <SectionHeader
            title="Precisa da sua atenção"
            actionLabel="Ver todos"
            onAction={() => router.push('/alertas')}
          />
          {alertas.length === 0 ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="check-circle" size="lg" color={colors.success} />
                <Text variant="body" style={{ flex: 1 }}>
                  Tudo em dia. Não há prazos a cumprir.
                </Text>
              </View>
            </Card>
          ) : (
            <Card padded={false}>
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                {urgentes > 0 ? (
                  <Badge
                    tone="danger"
                    icon="alert"
                    label={`${urgentes} urgente${urgentes > 1 ? 's' : ''}`}
                    style={{ marginVertical: spacing.xs }}
                  />
                ) : null}
                {alertas.slice(0, 3).map((a, i) => (
                  <AlertItem key={a.id} alerta={a} divider={i < Math.min(alertas.length, 3) - 1} />
                ))}
              </View>
            </Card>
          )}

          {/* Estatísticas */}
          <SectionHeader title="Resumo" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatCard
              icon="cow"
              value={animais.length}
              label="Animais"
              onPress={() => router.push('/animais')}
            />
            <StatCard
              icon="barn"
              value={exploracoes.length}
              label="Explorações"
              tint={colors.caprino}
              onPress={() => router.push('/exploracoes')}
            />
            <StatCard icon="grass" value={terrenos.length} label="Terrenos" tint={colors.success} />
          </View>

          {/* Explorações — meteorologia dentro de cada uma */}
          <SectionHeader
            title="As minhas explorações"
            actionLabel="Ver todas"
            onAction={() => router.push('/exploracoes')}
          />
          {exploracoes.length === 0 ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon name="barn" size="lg" color={colors.primary} />
                <Text variant="body" style={{ flex: 1 }}>
                  Ainda não tem explorações. Crie uma para começar a registar animais.
                </Text>
              </View>
            </Card>
          ) : (
            exploracoes.slice(0, 3).map((e) => <ExploracaoRow key={e.id} exploracao={e} />)
          )}

          {/* Ações rápidas */}
          <SectionHeader title="Ações rápidas" />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <QuickAction icon="plus-circle" label="Novo animal" onPress={() => router.push('/animal/novo')} />
            <QuickAction
              icon="baby-bottle-outline"
              label="Parto"
              color={colors.info}
              tint={colors.infoTint}
              onPress={() => router.push({ pathname: '/evento/novo', params: { tipo: 'Parto' } })}
            />
            <QuickAction
              icon="medical-bag"
              label="Medicamento"
              color={colors.danger}
              tint={colors.dangerTint}
              onPress={() => router.push({ pathname: '/evento/novo', params: { tipo: 'Medicamento' } })}
            />
            <QuickAction
              icon="scale"
              label="Pesagem"
              color={colors.warning}
              tint={colors.warningTint}
              onPress={() => router.push({ pathname: '/evento/novo', params: { tipo: 'Pesagem' } })}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
