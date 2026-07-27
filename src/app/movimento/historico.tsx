import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  type IconName,
  Screen,
  Text,
} from '@/components/ui';
import { porOrdemDeRegisto, rotuloMovimento } from '@/data/financas';
import { formatDataHora, formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { useFinancas } from '@/data/useFinancas';
import type { Movimento } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

/** Quantos registos a lista mostra de cada vez. */
const PAGINA = 40;

/**
 * Histórico de registos financeiros: quem lançou o quê, e quando.
 * ------------------------------------------------------------------
 * A lista de Movimentos do ecrã Finanças responde a "o que se passou nas
 * contas" e ordena-se pela DATA DO LANÇAMENTO — a data da fatura, escrita à
 * mão. Este ecrã responde a outra pergunta, que numa exploração com equipa é
 * a que mais custa não ter: "quem esteve a mexer nisto, e quando". Por isso
 * ordena-se pelo instante em que a linha entrou na app.
 *
 * Uma despesa de janeiro lançada hoje aparece no fundo de uma lista e no topo
 * da outra. É esse o ponto de haver duas.
 */
export default function HistoricoMovimentosScreen() {
  const router = useRouter();
  const { movimentos, exploracoes, animalById } = useGado();
  const { podeVer } = useMembros();
  const { podeVerFinancas } = useFinancas();
  const { nomeDe } = useNomesEquipa();

  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);
  const [limite, setLimite] = useState(PAGINA);

  /** As explorações cujas contas esta pessoa pode consultar. */
  const consultaveis = useMemo(
    () => exploracoes.filter((e) => podeVer(e.id, 'verFinancas')),
    [exploracoes, podeVer],
  );
  const podeEscolher = consultaveis.length > 1;

  const lista = useMemo(() => {
    const ids = exploracaoId ? [exploracaoId] : consultaveis.map((e) => e.id);
    return porOrdemDeRegisto(movimentos, ids);
  }, [movimentos, exploracaoId, consultaveis]);

  const visiveis = lista.slice(0, limite);
  const porMostrar = lista.length - visiveis.length;

  // Mesma pergunta que fecha o separador Finanças: as contas são de quem gere a
  // exploração, e um histórico de auditoria ainda menos se abre a quem não as vê.
  if (!podeVerFinancas) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Histórico de registos" />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title="Contas reservadas ao dono"
            message="Só quem gere a exploração pode ver quem lançou cada movimento."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Histórico de registos" />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Cada lançamento pela ordem em que entrou na app, com o nome de quem o
          registou e a hora.
        </Text>

        {podeEscolher ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.xs,
              marginBottom: spacing.md,
            }}>
            <Chip
              label="Todas"
              icon="barn"
              selected={exploracaoId === undefined}
              onPress={() => {
                setExploracaoId(undefined);
                setLimite(PAGINA);
              }}
            />
            {consultaveis.map((e) => (
              <Chip
                key={e.id}
                label={e.nome}
                selected={exploracaoId === e.id}
                onPress={() => {
                  setExploracaoId(exploracaoId === e.id ? undefined : e.id);
                  setLimite(PAGINA);
                }}
              />
            ))}
          </View>
        ) : null}

        {lista.length === 0 ? (
          <EmptyState
            icon="history"
            title="Ainda não há registos"
            message="Assim que alguém lançar uma despesa ou uma receita, fica aqui escrito quem foi e a que horas."
          />
        ) : (
          <>
            <Card padded={false}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {visiveis.map((m, i) => (
                  <LinhaRegisto
                    key={m.id}
                    movimento={m}
                    autor={nomeDe(m.criadoPor)}
                    animal={m.animalId ? (animalById(m.animalId)?.nome ?? undefined) : undefined}
                    divider={i < visiveis.length - 1}
                    onPress={
                      m.animalId ? () => router.push(`/animal/${m.animalId}`) : undefined
                    }
                  />
                ))}
              </View>
            </Card>

            {porMostrar > 0 ? (
              <Pressable
                onPress={() => setLimite((n) => n + PAGINA)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingVertical: spacing.md,
                  },
                  pressed && { opacity: 0.6 },
                ]}>
                <Icon name="chevron-down" size="md" color={colors.primary} />
                <Text variant="bodyStrong" color={colors.primary}>
                  Ver mais {Math.min(PAGINA, porMostrar)} (faltam {porMostrar})
                </Text>
              </Pressable>
            ) : null}

            {/* Os eventos com custo (uma vacina, um medicamento) contam para o
                saldo mas não guardam autor nem instante de registo. Calá-lo
                daria um histórico com ar de completo que não é. */}
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              Só despesas e receitas lançadas em Finanças. O custo de uma vacina ou de um
              medicamento fica no histórico do animal, junto do tratamento.
            </Text>
          </>
        )}
      </Screen>
    </View>
  );
}

function LinhaRegisto({
  movimento,
  autor,
  animal,
  divider,
  onPress,
}: {
  movimento: Movimento;
  autor?: string;
  animal?: string;
  divider: boolean;
  onPress?: () => void;
}) {
  const receita = movimento.direcao === 'receita';
  const icone: IconName = receita ? 'cash-plus' : 'cash-minus';

  /**
   * "Ana, 14/03 09:25".
   *
   * Sem autor conhecido não se escreve um: os lançamentos anteriores à coluna
   * ficaram sem ele, e pôr ali o nome de quem está a ver seria uma auditoria a
   * inventar factos.
   */
  const rasto = (() => {
    const quando = movimento.criadoEm ? formatDataHora(movimento.criadoEm) : undefined;
    if (autor && quando) return `${autor} · ${quando}`;
    if (autor) return autor;
    if (quando) return `Registado ${quando}`;
    return 'Sem registo de quem o lançou';
  })();

  const conteudo = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.border,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.pill,
          backgroundColor: receita ? colors.successTint : colors.dangerTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icone} size="sm" color={receita ? colors.success : colors.danger} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {movimento.descricao || movimento.categoria}
        </Text>
        <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
          {rasto}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {movimento.categoria} · lançado a {formatDataPt(movimento.data)}
          {animal ? ` · ${animal}` : ''}
        </Text>
      </View>
      <Text variant="bodyStrong" color={receita ? colors.success : colors.danger}>
        {rotuloMovimento(movimento)}
      </Text>
    </View>
  );

  if (!onPress) return conteudo;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${movimento.descricao || movimento.categoria}. ${rasto}`}
      style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
      {conteudo}
    </Pressable>
  );
}
