import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Card, Icon, type IconName, Text } from '@/components/ui';
import { acessoTerminou, rotuloPrazo } from '@/data/acessoTemporario';
import { formatDataHora } from '@/data/helpers';
import { legendaRole } from '@/data/permissoes';
import { listarMembrosDaExploracao, type MembroDaExploracao } from '@/data/superadminApi';
import { iniciais } from '@/data/trabalhadores';
import type { RoleMembro } from '@/data/types';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

const ICONE_PAPEL: Record<RoleMembro, IconName> = {
  supervisor: 'account-tie',
  admin: 'shield-crown',
  veterinario: 'medical-bag',
  trabalhador: 'account-hard-hat',
};

/**
 * Quem trabalha nesta exploração — no painel do superadmin.
 * ------------------------------------------------------------------
 * O painel mostrava o cliente, as explorações dele, os terrenos e os animais, e
 * não mostrava as PESSOAS. Quando o criador telefona a dizer "o veterinário não
 * consegue registar a vacina", as duas perguntas são "ainda tem acesso?" e "com
 * que papel?" — e não havia onde as responder sem abrir a base de dados à mão.
 *
 * Os vínculos já expirados aparecem esbatidos e com a hora a que caíram, em vez
 * de desaparecerem: "não está na lista" e "esteve até ontem às 18h" levam a
 * conversas diferentes, e é quase sempre a segunda que explica a chamada.
 */
export function EquipaDaExploracao({
  exploracaoId,
  nomeExploracao,
}: {
  exploracaoId: string;
  nomeExploracao?: string;
}) {
  const [membros, setMembros] = useState<MembroDaExploracao[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(null);
    try {
      setMembros(await listarMembrosDaExploracao(exploracaoId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setACarregar(false);
    }
  }, [exploracaoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (aCarregar && membros.length === 0) {
    return (
      <Card style={{ marginBottom: spacing.sm }}>
        <Text variant="secondary" color={colors.textSecondary}>
          A carregar a equipa…
        </Text>
      </Card>
    );
  }

  if (erro) {
    return (
      <Card style={{ backgroundColor: colors.dangerTint, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Icon name="alert-circle-outline" size="md" color={colors.danger} />
          <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
            {erro}
          </Text>
        </View>
      </Card>
    );
  }

  // Fora o dono: ele é o cliente, e o painel inteiro já é sobre ele. Contá-lo
  // como "1 pessoa na equipa" numa exploração onde não há mais ninguém dava a
  // entender que havia alguém contratado.
  const equipa = membros.filter((m) => m.role !== 'admin');

  if (equipa.length === 0) {
    return (
      <Card style={{ marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="account-off-outline" size="md" color={colors.textMuted} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            Sem trabalhadores nem veterinários
            {nomeExploracao ? ` em ${nomeExploracao}` : ''}. Só o dono.
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card padded={false} style={{ marginBottom: spacing.sm }}>
      <View style={{ paddingHorizontal: spacing.md }}>
        {equipa.map((m, i) => (
          <LinhaMembro key={m.membroId} membro={m} ultimo={i === equipa.length - 1} />
        ))}
      </View>
    </Card>
  );
}

function LinhaMembro({ membro, ultimo }: { membro: MembroDaExploracao; ultimo: boolean }) {
  // As cores lêem-se aqui dentro, no render (ver DESIGN_SYSTEM.md).
  const cor = membro.role === 'veterinario' ? colors.info : colors.warning;
  const terminou = acessoTerminou(membro.expiraEm);
  const ajustada = membro.permissoes && Object.keys(membro.permissoes).length > 0;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: colors.border,
        opacity: terminou ? 0.6 : 1,
      }}>
      <Avatar
        initials={iniciais(membro.nome)}
        size={40}
        background={colors.surfaceSunken}
        foreground={cor}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {membro.nome}
        </Text>
        {/* O email é o que identifica a conta quando o criador telefona. */}
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {membro.email}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 2,
            flexWrap: 'wrap',
          }}>
          <Icon name={ICONE_PAPEL[membro.role]} size="xs" color={cor} />
          <Text variant="caption" color={cor}>
            {legendaRole(membro.role)}
          </Text>
          {ajustada ? (
            <>
              <Icon name="tune-variant" size="xs" color={colors.warning} />
              <Text variant="caption" color={colors.warning}>
                permissões ajustadas
              </Text>
            </>
          ) : null}
        </View>
        {membro.expiraEm ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Icon
              name={terminou ? 'clock-alert-outline' : 'clock-outline'}
              size="xs"
              color={terminou ? colors.danger : colors.warning}
            />
            <Text
              variant="caption"
              color={terminou ? colors.danger : colors.warning}
              style={{ flex: 1 }}
              numberOfLines={2}>
              {rotuloPrazo(membro.expiraEm, formatDataHora)}
            </Text>
          </View>
        ) : null}
      </View>
      {terminou ? <Badge tone="danger" icon="lock-outline" label={t('gaveta.semAcesso')} /> : null}
    </View>
  );
}
