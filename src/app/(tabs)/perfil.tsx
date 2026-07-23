import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { avisar, confirmar } from '@/data/avisos';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Quem sou eu nesta app: a conta, os papéis e o que se pode fazer com ela.
 *
 * As opções de funcionamento (finanças, casa, notificações, exportações)
 * mudaram-se para o ecrã Definições. Estavam aqui à mistura, e a lista tinha
 * crescido ao ponto de "Terminar sessão" vir a seguir a "Exportar CSV" — duas
 * coisas que não têm nada que ver uma com a outra.
 */
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { utilizador, animais, exploracoes, pendentesSinc } = useGado();
  const { utilizador: conta, sair, configurado, apagarConta } = useAuth();
  const { membros, isSuperadmin, estadoPerfil } = useMembros();

  /**
   * Terminar sessão apaga a cache local — incluindo alterações feitas offline
   * que ainda não chegaram ao servidor. Se houver alguma, avisa em vez de a
   * deixar desaparecer sem o criador dar por isso.
   */
  function confirmarSair() {
    if (pendentesSinc === 0) {
      void sair();
      return;
    }
    confirmar(
      'Ainda há alterações por enviar',
      `Tem ${pendentesSinc} alteração${pendentesSinc > 1 ? 'ões' : ''} guardada${pendentesSinc > 1 ? 's' : ''} neste ` +
        'aparelho que ainda não chegou ao servidor. Se terminar sessão agora, perde-se. ' +
        'Ligue-se à internet e espere pela sincronização, ou termine sessão à mesma.',
      () => void sair(),
      { rotuloConfirmar: 'Terminar à mesma', destrutivo: true },
    );
  }

  function confirmarApagarConta() {
    const executar = async () => {
      const erro = await apagarConta();
      if (erro) avisar('Erro', `Não foi possível apagar a conta: ${erro}`);
      // Em caso de sucesso, a sessão é limpa e o portão de auth volta ao login.
    };
    confirmar(
      'Apagar a minha conta',
      'Vai apagar a sua conta e TODOS os dados (explorações, animais, terrenos e histórico). ' +
        'Esta ação é permanente e não pode ser desfeita. Tem a certeza?',
      () => void executar(),
      { rotuloConfirmar: 'Apagar tudo', destrutivo: true },
    );
  }

  // Com sessão iniciada, mostra os dados da conta; senão, o utilizador local.
  const nome = (conta?.user_metadata?.nome as string | undefined)?.trim() || utilizador.nome;
  const email = conta?.email ?? utilizador.email;
  const iniciais = (nome || email).split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  // Os papéis que esta pessoa tem, sem repetir: é o que explica por que razão
  // vê (ou não vê) certos botões, e não estava dito em lado nenhum.
  const papeis = [...new Set(membros.map((m) => m.role))];

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={{ ...coluna, paddingTop: insets.top + spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="display">Perfil</Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* Cartão do utilizador */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar initials={iniciais} size={64} />
              <View style={{ flex: 1 }}>
                <Text variant="h2" numberOfLines={1}>
                  {nome}
                </Text>
                <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                  {email}
                </Text>
                {/* `flexWrap`: com a letra do sistema ampliada as etiquetas
                    não cabiam lado a lado e a última saía do ecrã. */}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.xs,
                    marginTop: spacing.xs,
                  }}>
                  <Badge tone="brand" icon="cow" label={`${animais.length} animais`} />
                  <Badge tone="neutral" icon="barn" label={`${exploracoes.length} explor.`} />
                </View>
              </View>
            </View>
          </Card>

          {/* O que esta conta é. Sem isto, um trabalhador que não veja o botão
              das receitas não tinha onde perceber porquê. */}
          <Card>
            <View style={{ gap: spacing.sm }}>
              <LinhaInfo
                icon={isSuperadmin ? 'shield-crown' : 'account-check-outline'}
                label="Tipo de conta"
                valor={isSuperadmin ? 'Administrador da plataforma' : 'Criador'}
              />
              {!isSuperadmin ? (
                <LinhaInfo
                  icon="badge-account-horizontal-outline"
                  label={papeis.length > 1 ? 'Os seus papéis' : 'O seu papel'}
                  valor={
                    papeis.length > 0
                      ? papeis.map(legendaRole).join(' · ')
                      : 'Sem exploração associada'
                  }
                />
              ) : null}
              {!isSuperadmin && estadoPerfil !== 'ativo' ? (
                <LinhaInfo
                  icon="clock-alert-outline"
                  label="Estado"
                  valor="Por aprovar — só de leitura"
                  tom={colors.warning}
                />
              ) : null}
            </View>
          </Card>

          {/* Dados pessoais e sessão */}
          <Card padded={false}>
            <Linha
              icon="account-edit"
              label="Editar dados pessoais"
              onPress={() => router.push('/conta/editar')}
              last={!configurado}
            />
            {configurado ? (
              <>
                <Linha
                  icon="logout"
                  label="Terminar sessão"
                  tint={colors.danger}
                  onPress={confirmarSair}
                />
                <Linha
                  icon="delete-outline"
                  label="Apagar a minha conta"
                  tint={colors.danger}
                  onPress={confirmarApagarConta}
                  last
                />
              </>
            ) : null}
          </Card>

          <Pressable
            onPress={() => router.push('/definicoes')}
            accessibilityRole="button"
            accessibilityLabel="Abrir definições"
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
            <Text variant="secondary" color={colors.primary} center>
              As opções da app estão em Definições
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function LinhaInfo({
  icon,
  label,
  valor,
  tom,
}: {
  icon: IconName;
  label: string;
  valor: string;
  tom?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icon} size="sm" color={tom ?? colors.primary} />
      </View>
      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text
        variant="bodyStrong"
        color={tom ?? colors.text}
        style={{ maxWidth: '55%', textAlign: 'right' }}>
        {valor}
      </Text>
    </View>
  );
}

function Linha({
  icon,
  label,
  tint = colors.text,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  tint?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icon} size="md" color={tint === colors.text ? colors.primary : tint} />
      <Text variant="body" color={tint} style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="chevron-right" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}
