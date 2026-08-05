import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  IconBadge,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { idadeExtenso } from '@/data/helpers';
import { normalizar } from '@/data/racas';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import type { Animal } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

/** Quantos animais a lista mostra de cada vez. */
const PAGINA = 40;

/** Os quatro grupos por que se pode filtrar. */
type Grupo = 'todos' | 'neste' | 'sem' | 'outro';

const ROTULOS: Record<Grupo, string> = {
  todos: 'Todos',
  neste: 'Neste terreno',
  sem: 'Sem terreno',
  outro: 'Noutro terreno',
};

/**
 * Associar / desassociar animais a um terreno. Tocar num animal coloca-o (ou
 * tira-o) deste terreno — sem confirmações intermédias, a alteração é imediata.
 *
 * OS FILTROS SÃO O ECRÃ. Sem eles isto era o efetivo inteiro numa lista corrida:
 * com 400 animais, encontrar os que faltavam pôr no cercado obrigava a percorrer
 * tudo e a comparar cada linha com o visto do lado direito. As perguntas que se
 * fazem aqui são três — "quem está cá?", "quem é que não está em terreno
 * nenhum?" e "quem é que anda no cercado do lado?" — e cada uma é um botão.
 */
export default function AssociarAnimaisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { terrenoById, exploracaoById, animaisByExploracao, terrenos, updateAnimal } = useGado();
  const toast = useToasts();

  const [grupo, setGrupo] = useState<Grupo>('todos');
  const [procura, setProcura] = useState('');
  const [limite, setLimite] = useState(PAGINA);

  const terreno = id ? terrenoById(id) : undefined;
  const animais = useMemo(
    () => (terreno ? animaisByExploracao(terreno.exploracaoId) : []),
    [terreno, animaisByExploracao],
  );

  /** Quantos animais caem em cada grupo — vai nos botões, e é o que os torna úteis. */
  const contagem = useMemo(() => {
    const c = { todos: animais.length, neste: 0, sem: 0, outro: 0 };
    for (const a of animais) {
      if (a.terrenoId === terreno?.id) c.neste++;
      else if (!a.terrenoId) c.sem++;
      else c.outro++;
    }
    return c;
  }, [animais, terreno?.id]);

  /**
   * O que está à vista. A procura passa POR CIMA do grupo escolhido: quem
   * escreve o nome de um animal quer aquele animal, não quer adivinhar primeiro
   * em que grupo ele caiu.
   */
  const visiveis = useMemo(() => {
    const q = normalizar(procura.trim());
    if (q) {
      return animais.filter((a) =>
        [a.nome, a.numeroIdentificacao, a.raca, a.numeroCasa].some(
          (v) => v && normalizar(v).includes(q),
        ),
      );
    }
    if (grupo === 'neste') return animais.filter((a) => a.terrenoId === terreno?.id);
    if (grupo === 'sem') return animais.filter((a) => !a.terrenoId);
    if (grupo === 'outro') return animais.filter((a) => a.terrenoId && a.terrenoId !== terreno?.id);
    return animais;
  }, [animais, grupo, procura, terreno?.id]);

  const mostrados = visiveis.slice(0, limite);
  const porMostrar = visiveis.length - mostrados.length;

  if (!terreno) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Associar animais" />
        <EmptyState icon="map-marker" title="Terreno não encontrado" message="Este registo já não existe." />
      </View>
    );
  }

  const exploracao = exploracaoById(terreno.exploracaoId);
  const nomeTerreno = (tid?: string) => terrenos.find((t) => t.id === tid)?.nome;

  // O ecrã promete, no rodapé, que "as alterações são guardadas
  // automaticamente" — então uma recusa do servidor tem de aparecer. Sem o
  // `catch`, a marca de visto ficava no sítio e a promessa era falsa: o animal
  // aparecia neste terreno até à sincronização seguinte o pôr de volta.
  const alternar = async (animalId: string, dentro: boolean, rotulo: string) => {
    try {
      await updateAnimal(animalId, { terrenoId: dentro ? undefined : terreno.id });
      // Sem aviso, a única prova de que ficou gravado era o visto — que aparece
      // logo, mesmo quando a gravação ainda não chegou ao servidor.
      toast.sucesso(dentro ? `Tirado de ${terreno.nome}` : `Colocado em ${terreno.nome}`, rotulo);
    } catch (e) {
      toast.erro('Não foi possível guardar', mensagemDeErro(e));
    }
  };

  function escolherGrupo(g: Grupo) {
    setGrupo(g);
    setProcura('');
    setLimite(PAGINA);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Associar animais" />
      <Screen>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {exploracao?.nome ?? 'Sem exploração'} · toque num animal para o colocar ou tirar de{' '}
          <Text variant="bodyStrong">{terreno.nome}</Text>.
        </Text>

        {animais.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Esta exploração ainda não tem animais registados.
            </Text>
          </Card>
        ) : (
          <>
            {/* Os filtros. Um grupo vazio não aparece — seria um botão que abre
                uma lista em branco. O "Todos" fica sempre. */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: spacing.xs,
                marginBottom: spacing.sm,
              }}>
              {(['todos', 'neste', 'sem', 'outro'] as const)
                .filter((g) => g === 'todos' || contagem[g] > 0)
                .map((g) => (
                  <Chip
                    key={g}
                    label={`${ROTULOS[g]} (${contagem[g]})`}
                    icon={
                      g === 'neste'
                        ? 'check-circle-outline'
                        : g === 'sem'
                          ? 'map-marker-off-outline'
                          : g === 'outro'
                            ? 'map-marker'
                            : 'format-list-bulleted'
                    }
                    selected={!procura.trim() && grupo === g}
                    onPress={() => escolherGrupo(g)}
                  />
                ))}
            </View>

            {/* Com efetivo grande, escrever três letras do nome é mais rápido
                do que qualquer filtro. */}
            {animais.length > 8 ? (
              <View style={{ marginBottom: spacing.md }}>
                <TextField
                  value={procura}
                  onChangeText={(t) => {
                    setProcura(t);
                    setLimite(PAGINA);
                  }}
                  placeholder="Procurar por nome, brinco, raça ou número"
                  icon="magnify"
                />
              </View>
            ) : null}

            {visiveis.length === 0 ? (
              <Card>
                <Text variant="body" color={colors.textSecondary}>
                  {procura.trim()
                    ? `Nenhum animal corresponde a “${procura.trim()}”.`
                    : 'Não há animais neste grupo.'}
                </Text>
              </Card>
            ) : null}

            {mostrados.map((a) => (
              <LinhaAnimal
                key={a.id}
                animal={a}
                dentro={a.terrenoId === terreno.id}
                noutro={
                  a.terrenoId && a.terrenoId !== terreno.id ? nomeTerreno(a.terrenoId) : undefined
                }
                onPress={() =>
                  void alternar(
                    a.id,
                    a.terrenoId === terreno.id,
                    a.nome ?? a.numeroIdentificacao ?? 'Sem nome',
                  )
                }
              />
            ))}

            {/* A lista parava sem o dizer: com 400 animais, desenhar tudo de uma
                vez deixava o ecrã lento a abrir e a rolar. */}
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
          </>
        )}

        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, textAlign: 'center' }}>
          As alterações são guardadas automaticamente.
        </Text>
      </Screen>
    </View>
  );
}

function LinhaAnimal({
  animal,
  dentro,
  noutro,
  onPress,
}: {
  animal: Animal;
  dentro: boolean;
  noutro?: string;
  onPress: () => void;
}) {
  const meta = especieMeta[animal.especie];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: dentro }}
      accessibilityLabel={`${animal.nome ?? 'Animal'} ${dentro ? 'neste terreno' : 'fora do terreno'}`}
      style={({ pressed }) => [{ marginBottom: spacing.sm }, pressed && { opacity: 0.7 }]}>
      <Card padded={false} style={dentro ? { borderWidth: 1.5, borderColor: colors.primary } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }}>
          <IconBadge name={meta.icon} color={meta.cor} background={colors.primaryTint} size={48} iconSize={26} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {animal.nome ?? 'Sem nome'}
            </Text>
            <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
              {animal.numeroIdentificacao ?? 'Sem brinco'} · {idadeExtenso(animal.dataNascimento)}
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
}
