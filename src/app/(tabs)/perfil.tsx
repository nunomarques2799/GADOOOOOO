import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorFoto } from '@/components/SeletorFoto';
import { Avatar, Badge, Button, Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { confirmar } from '@/data/avisos';
import { saiuDoEfetivo } from '@/data/historicoAnimais';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useFotoPerfil } from '@/data/useFotoPerfil';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, shadow, spacing } from '@/theme';

/**
 * Quem sou eu nesta app: a conta, os papéis e o que se pode fazer com ela.
 *
 * As opções de funcionamento (finanças, notificações, exportações)
 * mudaram-se para o ecrã Definições. Estavam aqui à mistura, e a lista tinha
 * crescido ao ponto de "Terminar sessão" vir a seguir a "Exportar CSV" — duas
 * coisas que não têm nada que ver uma com a outra.
 */
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { utilizador, animais, exploracoes, pendentesSinc } = useGado();
  const { utilizador: conta, sair, configurado } = useAuth();
  const { membros, isSuperadmin, estadoPerfil } = useMembros();
  const { foto, definirFoto } = useFotoPerfil();
  const toast = useToasts();

  /** A folha de escolher a fotografia. `null` = fechada. */
  const [aEscolherFoto, setAEscolherFoto] = useState<{ atual?: string } | null>(null);
  const [aGravarFoto, setAGravarFoto] = useState(false);

  /**
   * Grava a fotografia escolhida.
   *
   * Não fecha a folha antes de o servidor responder: sem ligação isto falha, e
   * fechar primeiro dava um avatar novo no ecrã que desaparecia no arranque
   * seguinte — a foto teria ficado só na cache deste aparelho.
   */
  async function guardarFoto(dataUri: string | undefined) {
    if (aGravarFoto) return;
    setAGravarFoto(true);
    try {
      await definirFoto(dataUri);
      toast.sucesso(dataUri ? 'Fotografia guardada' : 'Fotografia removida');
      setAEscolherFoto(null);
    } catch (e) {
      toast.erro('Não foi possível guardar a fotografia', mensagemDeErro(e));
    } finally {
      setAGravarFoto(false);
    }
  }

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

  // Com sessão iniciada, mostra os dados da conta; senão, o utilizador local.
  const nome = (conta?.user_metadata?.nome as string | undefined)?.trim() || utilizador.nome;
  const email = conta?.email ?? utilizador.email;
  const iniciais = (nome || email).split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  // Os papéis que esta pessoa tem, sem repetir: é o que explica por que razão
  // vê (ou não vê) certos botões, e não estava dito em lado nenhum.
  const papeis = [...new Set(membros.map((m) => m.role))];

  // Só os que estão no efetivo. Os que saíram vivem no Histórico do efetivo e
  // não entram na conta — ver o mesmo cálculo no ecrã Início.
  const noEfetivo = animais.filter((a) => !saiuDoEfetivo(a)).length;

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
              {/* A foto é o próprio avatar, e é tocável. Um botão "mudar
                  fotografia" numa lista mais abaixo não se encontrava: o sítio
                  onde se muda uma cara é a cara. */}
              {/* Sem exigir sessão: em modo local (o `.exe` sem chaves) o
                  `useFotoPerfil` guarda só na cache do aparelho, que é como o
                  resto da app se comporta aí — `podeEscrever` também devolve
                  `true` sem Supabase. Fechar isto era a única coisa da app a
                  pedir conta para funcionar. */}
              <Pressable
                onPress={() => setAEscolherFoto({ atual: foto })}
                accessibilityRole="button"
                accessibilityLabel={
                  foto ? 'Mudar a sua fotografia' : 'Escolher uma fotografia para si'
                }
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <View>
                  {foto ? (
                    <Image
                      source={{ uri: foto }}
                      style={{ width: 64, height: 64, borderRadius: radii.pill }}
                      contentFit="cover"
                    />
                  ) : (
                    <Avatar initials={iniciais} size={64} />
                  )}
                  {/* A marca da câmara diz que aquilo se toca. Sem ela, o
                      avatar parece um desenho e ninguém lhe mexe. */}
                  <View
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 24,
                      height: 24,
                      borderRadius: radii.pill,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: colors.surface,
                    }}>
                    <Icon name="camera" size={12} color={colors.onPrimary} />
                  </View>
                </View>
              </Pressable>
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
                  <Badge tone="brand" icon="cow" label={`${noEfetivo} animais`} />
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
                  valor="Por aprovar (só de leitura)"
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
              <Linha
                icon="logout"
                label="Terminar sessão"
                tint={colors.danger}
                onPress={confirmarSair}
                last
              />
            ) : null}
          </Card>

          {/*
            "Apagar a minha conta" NÃO entra no cartão de cima.
            Esteve lá, a um toque de distância do "Terminar sessão", e apagava a
            exploração inteira sem volta — foi por isso que saiu. Voltou porque
            a App Store obriga quem deixa criar conta a deixar apagá-la de
            dentro da app (diretriz 5.1.1(v)).
            O que muda é a distância: cartão à parte, no fim do ecrã, e daqui
            não se apaga nada — abre-se um ecrã que mostra o que se perde e pede
            uma palavra escrita à mão (`conta/apagar`).
            Ao superadmin não se mostra: é a conta que administra a plataforma,
            e a `apagar_a_minha_conta()` apagava-a com o mesmo à-vontade.
          */}
          {configurado && !isSuperadmin ? (
            <Card padded={false}>
              <Linha
                icon="delete-forever"
                label="Apagar a minha conta"
                tint={colors.danger}
                onPress={() => router.push('/conta/apagar')}
                last
              />
            </Card>
          ) : null}

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

      {/* Escolher a fotografia. Montada só quando está aberta: fora disso não
          há folha nenhuma a guardar o rascunho de uma escolha abandonada. */}
      <Modal
        visible={aEscolherFoto !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setAEscolherFoto(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setAEscolherFoto(null)}
            accessibilityLabel="Fechar"
          />
          <View
            style={[
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: radii.xl,
                borderTopRightRadius: radii.xl,
                padding: spacing.lg,
                paddingBottom: insets.bottom + spacing.lg,
                gap: spacing.md,
              },
              shadow.lg,
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="h3" style={{ flex: 1 }}>
                A sua fotografia
              </Text>
              <Pressable
                onPress={() => setAEscolherFoto(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Fechar">
                <Icon name="close" size="lg" color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* O mesmo seletor do animal e do terreno — ver `SeletorFoto`. A
                escolha só mexe no rascunho; quem grava é o botão de baixo. */}
            <SeletorFoto
              foto={aEscolherFoto?.atual}
              onMudar={(dataUri) => setAEscolherFoto({ atual: dataUri })}
              icone="account"
              assunto="da sua conta"
            />

            <Text variant="caption" color={colors.textMuted}>
              Por agora a fotografia é só sua: aparece aqui no Perfil e mais ninguém a vê.
            </Text>

            <Button
              label={aGravarFoto ? 'A guardar…' : 'Guardar'}
              icon="check"
              loading={aGravarFoto}
              disabled={aGravarFoto || aEscolherFoto?.atual === foto}
              onPress={() => void guardarFoto(aEscolherFoto?.atual)}
            />
          </View>
        </View>
      </Modal>
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
