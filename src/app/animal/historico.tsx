import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  Badge,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  type IconName,
  IconBadge,
  Screen,
  Text,
  type Tone,
} from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { rotuloAnimal } from '@/data/genealogia';
import { formatDataHora, formatDataPt } from '@/data/helpers';
import {
  contarPorMotivo,
  historicoDoEfetivo,
  MOTIVOS,
  rotuloMotivo,
  type LinhaHistorico,
  type MotivoSaida,
} from '@/data/historicoAnimais';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { colors, radii, spacing } from '@/theme';

/**
 * Histórico do efetivo: quem saiu, porquê, quando e por ordem de quem.
 * ------------------------------------------------------------------
 * O contrário da lista de Animais, que só mostra o efetivo vivo. Aqui está
 * tudo o que saiu dele — falecido, vendido ou eliminado — e nenhum destes
 * registos foi apagado da base de dados.
 *
 * É um registo de AUDITORIA, e não um caixote do lixo com botão de recuperar:
 * numa exploração com trabalhadores, "quem tirou este animal da lista, e
 * quando" é uma pergunta a sério, e a resposta tem de estar escrita em vez de
 * depender da memória de quem lá estava.
 */

const ASPETO: Record<MotivoSaida, { icone: IconName; tom: Tone; verbo: string }> = {
  falecido: { icone: 'grave-stone', tom: 'neutral', verbo: 'Morte registada' },
  vendido: { icone: 'cash', tom: 'info', verbo: 'Venda registada' },
  eliminado: { icone: 'trash-can-outline', tom: 'danger', verbo: 'Eliminado' },
};

export default function HistoricoEfetivoScreen() {
  const { animais, exploracoes } = useGado();
  const { nomeDe } = useNomesEquipa();

  const [exploracaoId, setExploracaoId] = useState<string | undefined>(undefined);
  const [motivo, setMotivo] = useState<MotivoSaida | undefined>(undefined);
  const [texto, setTexto] = useState('');

  // Mesma regra do resto da app: com uma exploração só, a linha de chips não
  // decide nada e é espaço tirado à lista.
  const podeEscolherExploracao = exploracoes.length > 1;

  const conta = useMemo(
    () => contarPorMotivo(animais, { exploracaoId }),
    [animais, exploracaoId],
  );

  const linhas = useMemo(
    () => historicoDoEfetivo(animais, { exploracaoId, motivo, texto }),
    [animais, exploracaoId, motivo, texto],
  );

  const total = conta.falecido + conta.vendido + conta.eliminado;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Histórico do efetivo" />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Os animais que saíram do efetivo. Nenhum destes registos foi apagado: ficam aqui
          com o dia e o nome de quem os registou.
        </Text>

        {podeEscolherExploracao ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.xs,
              marginBottom: spacing.sm,
            }}>
            <Chip
              label="Todas"
              icon="barn"
              selected={exploracaoId === undefined}
              onPress={() => setExploracaoId(undefined)}
            />
            {exploracoes.map((e) => (
              <Chip
                key={e.id}
                label={e.nome}
                selected={exploracaoId === e.id}
                onPress={() => setExploracaoId(exploracaoId === e.id ? undefined : e.id)}
              />
            ))}
          </View>
        ) : null}

        {/* Motivo. Um motivo sem ninguém dentro não aparece: um chip que só
            pode dar lista vazia promete animais que não existem. */}
        {total > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.xs,
              marginBottom: spacing.sm,
            }}>
            <Chip
              label={`Todos (${total})`}
              selected={motivo === undefined}
              onPress={() => setMotivo(undefined)}
            />
            {MOTIVOS.filter((m) => conta[m.valor] > 0).map((m) => (
              <Chip
                key={m.valor}
                label={`${m.label} (${conta[m.valor]})`}
                icon={ASPETO[m.valor].icone}
                selected={motivo === m.valor}
                onPress={() => setMotivo(motivo === m.valor ? undefined : m.valor)}
              />
            ))}
          </View>
        ) : null}

        {total > 5 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: colors.surface,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              height: 52,
              marginBottom: spacing.md,
            }}>
            <Icon name="magnify" size="md" color={colors.textMuted} />
            <TextInput
              value={texto}
              onChangeText={setTexto}
              placeholder="Nome ou brinco"
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                fontFamily: 'Nunito_500Medium',
                fontSize: 16,
                color: colors.text,
              }}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}

        {linhas.length === 0 ? (
          <EmptyState
            icon="history"
            title={total === 0 ? 'Ainda não saiu nenhum animal' : 'Nada com esses filtros'}
            message={
              total === 0
                ? 'Quando marcar uma morte ou uma venda, ou eliminar um registo, o que aconteceu fica escrito aqui.'
                : 'Experimente outro motivo, outra exploração ou limpar a pesquisa.'
            }
          />
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {linhas.map((l, i) => (
                <LinhaSaida
                  key={l.animal.id}
                  linha={l}
                  autor={nomeDe(l.registadoPor)}
                  divider={i < linhas.length - 1}
                />
              ))}
            </View>
          </Card>
        )}
      </Screen>
    </View>
  );
}

/** Uma saída: o animal, o motivo, quando e por ordem de quem. */
function LinhaSaida({
  linha,
  autor,
  divider,
}: {
  linha: LinhaHistorico;
  autor?: string;
  divider: boolean;
}) {
  const router = useRouter();
  const { animal, motivo } = linha;
  const aspeto = ASPETO[motivo];

  /**
   * "Registado por Ana, ontem às 18:04".
   *
   * Sem autor não se inventa um: os registos anteriores a haver onde o guardar
   * ficaram sem ele, e escrever "por si" ou deixar em branco daria a mesma
   * frase a um registo conhecido e a um desconhecido. Uma auditoria que
   * adivinha não é uma auditoria.
   */
  const rasto = (() => {
    const quando = linha.registadoEm ? formatDataHora(linha.registadoEm) : undefined;
    if (autor && quando) return `Registado por ${autor}, ${quando}`;
    if (autor) return `Registado por ${autor}`;
    if (quando) return `Registado ${quando}`;
    return 'Sem registo de quem o fez';
  })();

  return (
    <Pressable
      onPress={() => router.push(`/animal/${animal.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${rotuloAnimal(animal)}, ${rotuloMotivo[motivo].toLowerCase()}. ${rasto}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <IconBadge
        name={especieMeta[animal.especie].icon}
        color={colors.textMuted}
        background={colors.surfaceSunken}
        size={44}
        iconSize={24}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {rotuloAnimal(animal)}
          </Text>
          <Badge tone={aspeto.tom} icon={aspeto.icone} label={rotuloMotivo[motivo]} />
        </View>
        <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
          {aspeto.verbo}
          {linha.dataSaida ? ` a ${formatDataPt(linha.dataSaida)}` : ''}
          {animal.numeroIdentificacao ? ` · ${animal.numeroIdentificacao}` : ''}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
          {rasto}
        </Text>
        {linha.nota ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
            {linha.nota}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size="md" color={colors.textMuted} />
    </Pressable>
  );
}
