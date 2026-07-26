import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { Card, EmptyState, Header, Icon, Screen, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { useFinancas } from '@/data/useFinancas';
import { useGado } from '@/data/store';
import { colors, radii, spacing } from '@/theme';

/**
 * Ligar/desligar o registo tradicional por casa e número.
 *
 * Ecrã próprio, como o da gestão financeira, porque a escolha precisa de ser
 * explicada: muda o formulário de toda a equipa, e quem já registou casas tem
 * de saber que desligar não lhes toca.
 */
export default function CasaDefinicaoScreen() {
  const { exploracoes, animais, definirCasaAtiva } = useGado();
  // Reutiliza a mesma régua das finanças: quem pode editar a exploração é o
  // dono, e é dele a decisão de como a equipa regista os animais.
  const { podeLigarDesligar } = useFinancas();
  const [aGuardar, setAGuardar] = useState(false);

  const ativa = exploracoes.some((e) => e.casaAtiva);
  const comCasa = useMemo(
    () => animais.filter((a) => a.casa || a.numeroCasa).length,
    [animais],
  );

  async function alternar(valor: boolean) {
    if (aGuardar) return;
    setAGuardar(true);
    try {
      await definirCasaAtiva(valor);
    } catch (e) {
      avisar('Não foi possível guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setAGuardar(false);
    }
  }

  if (!podeLigarDesligar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Registo por casa" />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title="Só quem gere a exploração"
            message="Esta definição pertence ao dono da exploração. Fale com ele se precisar de registar os animais por casa."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Registo por casa" />
      <Screen>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radii.pill,
                backgroundColor: ativa ? colors.successTint : colors.surfaceSunken,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="home-outline" size="lg" color={ativa ? colors.success : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">Casa e número</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                {ativa ? 'Ligado' : 'Desligado'}
              </Text>
            </View>
            <Switch
              value={ativa}
              onValueChange={alternar}
              disabled={aGuardar}
              accessibilityLabel="Registo por casa e número"
              trackColor={{ false: colors.borderStrong, true: colors.success }}
              thumbColor={colors.white}
            />
          </View>
        </Card>

        <Text variant="h3" style={{ marginBottom: spacing.sm }}>
          O que isto é
        </Text>
        <Card padded={false} style={{ marginBottom: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <Linha
              icon="home-outline"
              titulo="Como sempre se fez"
              texto="Muitos animais são conhecidos pela casa e pelo número — “Casa do Monte, 12” — desde antes de haver brincos. Ligado, o formulário do animal passa a pedir os dois campos."
              divider
            />
            <Linha
              icon="filter-outline"
              titulo="Dá para procurar e filtrar"
              texto="Com campos próprios, a casa entra na pesquisa e nos filtros da lista de animais. Escrita no nome ou nas notas, não entrava."
              divider
            />
            <Linha
              icon="tag-outline"
              titulo="Não substitui o brinco"
              texto="A identificação oficial (SIA) continua a ser o brinco, e os prazos legais contam a partir dele. A casa anda a par, não em vez."
            />
          </View>
        </Card>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: colors.infoTint,
            borderRadius: radii.md,
            padding: spacing.md,
          }}>
          <Icon name="information" size="md" color={colors.info} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {comCasa > 0
              ? `Desligar não apaga nada. Os ${comCasa} animais que já têm casa continuam a mostrá-la na ficha, e os campos voltam a aparecer se ligar outra vez.`
              : 'Desligar apenas esconde os dois campos do formulário. O que registar fica sempre guardado.'}
          </Text>
        </View>

        <Text
          variant="caption"
          color={colors.textMuted}
          style={{ marginTop: spacing.md, textAlign: 'center' }}>
          Esta definição vale para todas as suas explorações.
        </Text>
      </Screen>
    </View>
  );
}

function Linha({
  icon,
  titulo,
  texto,
  divider,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  titulo: string;
  texto: string;
  divider?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
        paddingVertical: spacing.md,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      }}>
      <Icon name={icon} size="md" color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{titulo}</Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {texto}
        </Text>
      </View>
    </View>
  );
}
