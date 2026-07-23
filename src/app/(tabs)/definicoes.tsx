import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Icon, type IconName, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { avisar } from '@/data/avisos';
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
import { useFinancas } from '@/data/useFinancas';
import { VERSAO_APP } from '@/data/versao';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, spacing } from '@/theme';

const TITULO_PRAZOS = 'Relatório de prazos — Gestão de Gado';

/**
 * Tudo o que se CONFIGURA e tudo o que se EXPORTA.
 *
 * Separado do Perfil de propósito: o Perfil respondia a "quem sou eu" e a
 * "como é que a app funciona" ao mesmo tempo, e a lista tinha crescido ao
 * ponto de as duas coisas se estorvarem — terminar sessão ficava a seguir a
 * exportar CSV. Aqui ficam as opções; lá fica a conta.
 */
export default function DefinicoesScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { animais, eventos, exploracoes, terrenos, alertas } = useGado();
  const { configurado } = useAuth();
  const {
    ativas: financasAtivas,
    podeLigarDesligar: podeLigarFinancas,
  } = useFinancas();

  const casaAtiva = exploracoes.some((e) => e.casaAtiva);

  async function exportar(nomeFicheiro: string, conteudo: string) {
    try {
      await guardarFicheiro(nomeFicheiro, conteudo);
    } catch (e) {
      avisar('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    }
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
          <Text variant="display">Definições</Text>
          <Text variant="body" color={colors.textSecondary}>
            Como a app funciona para si
          </Text>
        </View>

        <View style={{ ...coluna, gap: spacing.md }}>
          {/* O que a app regista */}
          <Grupo titulo="O QUE A APP REGISTA">
            {podeLigarFinancas ? (
              <Linha
                icon="cash-multiple"
                label="Gestão financeira"
                trailing={financasAtivas ? 'Ligada' : 'Desligada'}
                onPress={() => router.push('/conta/financas')}
              />
            ) : null}
            {podeLigarFinancas ? (
              <Linha
                icon="home-outline"
                label="Registo por casa e número"
                trailing={casaAtiva ? 'Ligado' : 'Desligado'}
                onPress={() => router.push('/conta/casa')}
              />
            ) : null}
            <Linha
              icon="bell-outline"
              label="Notificações e alertas"
              onPress={() => router.push('/conta/notificacoes')}
              last
            />
          </Grupo>

          {/* Exportar e relatórios */}
          <Grupo titulo="EXPORTAR E RELATÓRIOS">
            <Linha
              icon="cow"
              label="Exportar animais (CSV)"
              trailing={String(animais.length)}
              onPress={() =>
                void exportar(`animais-${hojeISO()}.csv`, csvAnimais(animais, exploracoes, terrenos))
              }
            />
            <Linha
              icon="calendar-text-outline"
              label="Exportar eventos (CSV)"
              trailing={String(eventos.length)}
              onPress={() => void exportar(`eventos-${hojeISO()}.csv`, csvEventos(eventos, animais))}
            />
            <Linha
              icon="printer-outline"
              label="Imprimir relatório de prazos"
              trailing={String(alertas.length)}
              onPress={imprimirPrazos}
            />
            <Linha
              icon="file-download-outline"
              label="Descarregar relatório (PDF)"
              trailing={String(alertas.length)}
              onPress={() => void descarregarPrazos()}
            />
            <Linha
              icon="file-export-outline"
              label="Exportar para o iDigital"
              trailing="Fase 2"
              onPress={() =>
                avisar(
                  'Ainda em desenvolvimento',
                  'A exportação para o iDigital chega numa próxima versão. Entretanto pode usar o "Descarregar relatório (PDF)" ou o "Exportar animais (CSV)".',
                )
              }
              last
            />
          </Grupo>

          {/* Dados e cópias */}
          {configurado ? (
            <Grupo titulo="DADOS">
              <Linha
                icon="cloud-sync-outline"
                label="Sincronização e cópia de segurança"
                onPress={() => router.push('/conta/sincronizacao')}
                last
              />
            </Grupo>
          ) : null}

          {/* Sobre */}
          <Grupo titulo="SOBRE">
            <Linha
              icon="help-circle-outline"
              label="Ajuda e apoio"
              onPress={() => router.push('/conta/ajuda')}
            />
            <Linha
              icon="shield-account-outline"
              label="Privacidade e termos"
              onPress={() => void Linking.openURL('https://gestaogado.netlify.app/privacidade')}
              last
            />
          </Grupo>

          <Text variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.xs }}>
            Gestão de Gado · versão {VERSAO_APP}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View>
      <Text
        variant="label"
        color={colors.textSecondary}
        style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
        {titulo}
      </Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function Linha({
  icon,
  label,
  trailing,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  trailing?: string;
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
      <Icon name={icon} size="md" color={colors.primary} />
      <Text variant="body" style={{ flex: 1 }}>
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
