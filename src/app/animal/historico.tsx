import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { SeletorExploracao } from '@/components/SeletorExploracao';
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
  motivos,
  rotuloMotivo,
  type LinhaHistorico,
  type MotivoSaida,
} from '@/data/historicoAnimais';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { t, type ChaveTexto } from '@/i18n';
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

const ASPETO: Record<MotivoSaida, { icone: IconName; tom: Tone; chaveVerbo: ChaveTexto }> = {
  falecido: { icone: 'grave-stone', tom: 'neutral', chaveVerbo: 'ficha.morteRegistada' },
  vendido: { icone: 'cash', tom: 'info', chaveVerbo: 'ficha.vendaRegistada' },
  eliminado: { icone: 'trash-can-outline', tom: 'danger', chaveVerbo: 'ficha.eliminado' },
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
      <Header title={t('histAnimal.titulo')} />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {t('histAnimal.ajuda')}
        </Text>

        {podeEscolherExploracao ? (
          <SeletorExploracao
            exploracoes={exploracoes}
            valor={exploracaoId}
            onEscolher={setExploracaoId}
            style={{ marginBottom: spacing.sm }}
          />
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
              label={`${t('filtro.todos')} (${total})`}
              selected={motivo === undefined}
              onPress={() => setMotivo(undefined)}
            />
            {motivos().filter((m) => conta[m.valor] > 0).map((m) => (
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
              placeholder={t('histAnimal.procurar')}
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
            title={total === 0 ? t('histAnimal.vazioTitulo') : t('histAnimal.semFiltrosTitulo')}
            message={
              total === 0
                ? t('histAnimal.vazioMensagem')
                : t('histAnimal.semFiltrosMensagem')
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
    if (autor && quando) return t('histAnimal.porEQuando', { autor, quando });
    if (autor) return t('histAnimal.porQuem', { autor });
    if (quando) return t('histAnimal.quando', { quando });
    return t('histAnimal.semAutor');
  })();

  return (
    <Pressable
      onPress={() => router.push(`/animal/${animal.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${rotuloAnimal(animal)}, ${rotuloMotivo(motivo).toLowerCase()}. ${rasto}`}
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
          <Badge tone={aspeto.tom} icon={aspeto.icone} label={rotuloMotivo(motivo)} />
        </View>
        <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
          {t(aspeto.chaveVerbo)}
          {linha.dataSaida ? ` · ${formatDataPt(linha.dataSaida)}` : ''}
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
