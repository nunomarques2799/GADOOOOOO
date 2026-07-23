import { useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';

import {
  Card,
  EmptyState,
  Header,
  Icon,
  IconBadge,
  Screen,
  Text,
} from '@/components/ui';
import { avisar } from '@/data/avisos';
import { especieMeta } from '@/data/constants';
import { idadeExtenso } from '@/data/helpers';
import { useGado } from '@/data/store';
import { colors, radii, spacing } from '@/theme';

/**
 * Associar / desassociar animais a um terreno. Lista os animais da exploração;
 * tocar num animal coloca-o (ou tira-o) deste terreno. Simples e direto para o
 * utilizador-alvo — sem confirmações intermédias, a alteração é imediata.
 */
export default function AssociarAnimaisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { terrenoById, exploracaoById, animaisByExploracao, terrenos, updateAnimal } = useGado();

  const terreno = id ? terrenoById(id) : undefined;

  if (!terreno) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Associar animais" />
        <EmptyState icon="map-marker" title="Terreno não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  const exploracao = exploracaoById(terreno.exploracaoId);
  const animais = animaisByExploracao(terreno.exploracaoId);
  const nomeTerreno = (tid?: string) => terrenos.find((t) => t.id === tid)?.nome;

  // O ecrã promete, no rodapé, que "as alterações são guardadas
  // automaticamente" — então uma recusa do servidor tem de aparecer. Sem o
  // `catch`, a marca de visto ficava no sítio e a promessa era falsa: o animal
  // aparecia neste terreno até à sincronização seguinte o pôr de volta.
  const alternar = async (animalId: string, dentro: boolean) => {
    try {
      await updateAnimal(animalId, { terrenoId: dentro ? undefined : terreno.id });
    } catch (e) {
      avisar('Não foi possível guardar', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Associar animais" />
      <Screen>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {exploracao?.nome ?? '—'} · toque num animal para o colocar ou tirar de{' '}
          <Text variant="bodyStrong">{terreno.nome}</Text>.
        </Text>

        {animais.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Esta exploração ainda não tem animais registados.
            </Text>
          </Card>
        ) : (
          animais.map((a) => {
            const dentro = a.terrenoId === terreno.id;
            const meta = especieMeta[a.especie];
            const noutro = a.terrenoId && !dentro ? nomeTerreno(a.terrenoId) : undefined;
            return (
              <Pressable
                key={a.id}
                onPress={() => void alternar(a.id, dentro)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: dentro }}
                accessibilityLabel={`${a.nome ?? 'Animal'} ${dentro ? 'neste terreno' : 'fora do terreno'}`}
                style={({ pressed }) => [{ marginBottom: spacing.sm }, pressed && { opacity: 0.7 }]}>
                <Card padded={false} style={dentro ? { borderWidth: 1.5, borderColor: colors.primary } : undefined}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }}>
                    <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={48} iconSize={26} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {a.nome ?? 'Sem nome'}
                      </Text>
                      <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                        {a.numeroIdentificacao ?? 'Sem brinco'} · {idadeExtenso(a.dataNascimento)}
                        {noutro ? ` · em ${noutro}` : ''}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: radii.pill,
                        borderWidth: 2,
                        borderColor: dentro ? colors.primary : colors.borderStrong,
                        backgroundColor: dentro ? colors.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {dentro ? <Icon name="check" size={18} color={colors.onPrimary} /> : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}

        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, textAlign: 'center' }}>
          As alterações são guardadas automaticamente.
        </Text>
      </Screen>
    </View>
  );
}
