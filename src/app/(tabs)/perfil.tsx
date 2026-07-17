import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { avisar, confirmar } from '@/data/avisos';
import {
  csvAnimais,
  csvEventos,
  guardarFicheiro,
  guardarRelatorio,
  hojeISO,
  htmlRelatorioPrazos,
  imprimirRelatorio,
} from '@/data/exportar';
import { useGado } from '@/data/store';
import { VERSAO_APP } from '@/data/versao';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

const TITULO_PRAZOS = 'Relatório de prazos — Gestão de Gado';

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { utilizador, animais, eventos, exploracoes, terrenos, alertas } = useGado();
  const { utilizador: conta, sair, configurado, apagarConta } = useAuth();

  async function exportarAnimais() {
    await guardarFicheiro(`animais-${hojeISO()}.csv`, csvAnimais(animais, exploracoes, terrenos));
  }
  async function exportarEventos() {
    await guardarFicheiro(`eventos-${hojeISO()}.csv`, csvEventos(eventos, animais));
  }
  function imprimirPrazos() {
    const ok = imprimirRelatorio(TITULO_PRAZOS, htmlRelatorioPrazos(alertas));
    if (!ok) {
      avisar('Indisponível', 'A impressão do relatório está disponível na versão de computador.');
    }
  }

  async function descarregarPrazos() {
    const r = await guardarRelatorio(TITULO_PRAZOS, htmlRelatorioPrazos(alertas), `prazos-${hojeISO()}`);
    if (r.estado === 'guardado' || r.estado === 'cancelado') return; // o diálogo já falou por si
    if (r.estado === 'html') {
      avisar(
        'Relatório descarregado',
        'Guardámos o relatório como página web. Para o ter em PDF, abra-o e use Imprimir → Guardar como PDF. ' +
          'Na app de computador o relatório é guardado logo em PDF.',
      );
      return;
    }
    if (r.estado === 'indisponivel') {
      avisar('Indisponível', 'Descarregar o relatório está disponível na versão de computador.');
      return;
    }
    avisar('Não foi possível guardar', r.motivo);
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

  // Uma lista de opções não ganha em esticar por um ecrã largo — em desktop
  // fica numa coluna única centrada.
  const colunaPerfil = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* A lista de opções é mais alta do que a janela — sem ScrollView o fim
          (terminar sessão, apagar conta) ficava fora de alcance. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View
          style={{
            ...colunaPerfil,
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.lg,
          }}>
          <Text variant="display">Perfil</Text>
        </View>

        <View style={{ ...colunaPerfil, gap: spacing.md }}>
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
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                  <Badge tone="brand" icon="cow" label={`${animais.length} animais`} />
                  <Badge tone="neutral" icon="barn" label={`${exploracoes.length} explor.`} />
                </View>
              </View>
            </View>
          </Card>

          {/* Estado de sincronização (offline-first) */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.pill,
                  backgroundColor: colors.successTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon name="cloud-check-outline" size="md" color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Dados guardados no dispositivo</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  Funciona sem internet. Sincroniza quando houver rede.
                </Text>
              </View>
            </View>
          </Card>

          {/* Exportar e relatórios */}
          <View>
            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              EXPORTAR E RELATÓRIOS
            </Text>
            <Card padded={false}>
              <SettingRow
                icon="cow"
                label="Exportar animais (CSV)"
                trailing={String(animais.length)}
                onPress={exportarAnimais}
              />
              <SettingRow
                icon="calendar-text-outline"
                label="Exportar eventos (CSV)"
                trailing={String(eventos.length)}
                onPress={exportarEventos}
              />
              <SettingRow
                icon="printer-outline"
                label="Imprimir relatório de prazos"
                trailing={String(alertas.length)}
                onPress={imprimirPrazos}
              />
              <SettingRow
                icon="file-download-outline"
                label="Descarregar relatório (PDF)"
                trailing={String(alertas.length)}
                onPress={() => void descarregarPrazos()}
                last
              />
            </Card>
          </View>

          {/* Definições */}
          <Card padded={false}>
            <SettingRow
              icon="account-edit"
              label="Editar dados pessoais"
              onPress={() => router.push('/conta/editar')}
            />
            <SettingRow
              icon="cloud-sync-outline"
              label="Sincronização e cópia de segurança"
              onPress={() => router.push('/conta/sincronizacao')}
            />
            <SettingRow
              icon="file-export-outline"
              label="Exportar para o iDigital"
              trailing="Fase 2"
              onPress={() =>
                avisar(
                  'Ainda em desenvolvimento',
                  'A exportação para o iDigital chega numa próxima versão. Entretanto pode usar o "Descarregar relatório (PDF)" ou o "Exportar animais (CSV)".',
                )
              }
            />
            <SettingRow
              icon="bell-outline"
              label="Notificações e alertas"
              onPress={() => router.push('/conta/notificacoes')}
            />
            <SettingRow
              icon="shield-account-outline"
              label="Privacidade e termos"
              onPress={() => void Linking.openURL('https://gestaogado.netlify.app/privacidade')}
            />
            <SettingRow
              icon="help-circle-outline"
              label="Ajuda e apoio"
              onPress={() => router.push('/conta/ajuda')}
              last
            />
          </Card>

          {/* Conta — sessão e apagamento RGPD (só com Supabase/sessão) */}
          {configurado ? (
            <Card padded={false}>
              <SettingRow icon="logout" label="Terminar sessão" tint={colors.danger} onPress={sair} />
              <SettingRow
                icon="delete-outline"
                label="Apagar a minha conta"
                tint={colors.danger}
                onPress={confirmarApagarConta}
                last
              />
            </Card>
          ) : null}

          <Text variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.xs }}>
            Gestão de Gado · versão {VERSAO_APP}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function SettingRow({
  icon,
  label,
  trailing,
  tint = colors.text,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  trailing?: string;
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
      {trailing ? (
        <Text variant="caption" color={colors.textMuted}>
          {trailing}
        </Text>
      ) : null}
      <Icon name="chevron-right" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}
