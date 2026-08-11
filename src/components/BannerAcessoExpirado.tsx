import { View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { acessoQuaseAFim, faltaParaExpirar, rotuloPrazo } from '@/data/acessoTemporario';
import { formatDataHora } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

/**
 * O prazo de acesso, dito a quem o tem: primeiro a avisar, depois a explicar.
 *
 * É o caso do veterinário: foi convidado para uma visita, o dono deu-lhe umas
 * horas, e passadas essas horas a app fica sem exploração nenhuma. Sem este
 * cartão, o que ele encontrava era uma app vazia — indistinguível de uma
 * avaria, de um convite mal usado ou de a conta ter sido apagada. Nenhuma
 * dessas suposições leva à ação certa, que é pedir um código novo a quem o
 * convidou.
 *
 * O aviso ANTES do fim é metade do valor: quem está a meio de registar uma
 * vacinação tem de saber que lhe faltam vinte minutos, não descobri-lo quando
 * a gravação for recusada.
 *
 * Não se dispensa, pela mesma razão do `BannerSuspensao`: enquanto for verdade,
 * é a única coisa no ecrã que explica o resto dele.
 */
export function BannerAcessoExpirado() {
  const { acessoExpirado, membrosExpirados, membros } = useMembros();

  // Terminado: o mais recente dos expirados é o que interessa. Se houver
  // vários, é a última porta que se fechou que a pessoa se lembra de ter aberta.
  const ultimoExpirado = [...membrosExpirados].sort((a, b) =>
    (b.expiraEm ?? '').localeCompare(a.expiraEm ?? ''),
  )[0];

  // A acabar: o mais próximo do fim, entre os que ainda valem.
  const aAcabar = membros
    .filter((m) => acessoQuaseAFim(m.expiraEm))
    .sort((a, b) => (a.expiraEm ?? '').localeCompare(b.expiraEm ?? ''))[0];

  if (acessoExpirado && ultimoExpirado) {
    return (
      <Aviso
        icone="clock-alert-outline"
        cor={colors.warning}
        titulo={t('banner.acessoTerminouTitulo')}
        texto={t('banner.acessoTerminouTexto')}
        rodape={rotuloPrazo(ultimoExpirado.expiraEm, formatDataHora)}
      />
    );
  }

  if (aAcabar) {
    return (
      <Aviso
        icone="clock-outline"
        cor={colors.info}
        titulo={`O seu acesso acaba em breve (${faltaParaExpirar(aAcabar.expiraEm)})`}
        texto={t('banner.acessoAcabaTexto')}
        rodape={rotuloPrazo(aAcabar.expiraEm, formatDataHora)}
      />
    );
  }

  return null;
}

function Aviso({
  icone,
  cor,
  titulo,
  texto,
  rodape,
}: {
  icone: 'clock-alert-outline' | 'clock-outline';
  cor: string;
  titulo: string;
  texto: string;
  rodape?: string;
}) {
  return (
    <Card style={{ marginBottom: spacing.md, borderWidth: 1, borderColor: cor }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={icone} size="lg" color={cor} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{titulo}</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {texto}
          </Text>
          {rodape ? (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
              {rodape}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
