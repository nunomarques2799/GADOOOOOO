import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, Text } from '@/components/ui';
import { especieMeta, finalidadeMeta } from '@/data/constants';
import {
  contarAtivos,
  FAIXAS,
  rotuloCategoriaAlerta,
  SEM_TERRENO,
  type Facetas,
  type Filtros,
} from '@/data/filtrosAnimais';
import type { Terreno } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

/**
 * Folha com todos os filtros da lista de animais.
 *
 * Em folha, e não em linha no cabeçalho, porque são dez filtros: em chips
 * soltos empurravam a lista para fora do ecrã e o criador tinha de percorrer
 * meio ecrã de opções antes de ver o primeiro animal. Aqui o cabeçalho fica
 * com a pesquisa e um botão, e quem quer afinar abre.
 *
 * Os grupos encolhem à medida que se escolhe: cada um mostra só as opções que
 * ainda devolvem animais, tendo em conta o que já está filtrado (ver
 * `facetasDisponiveis`). Um grupo que fique com uma opção só desaparece —
 * escolhê-la não mudava nada.
 */
export function FolhaFiltros({
  aberto,
  filtros,
  facetas,
  terrenos,
  onFechar,
  onMudar,
  onLimpar,
  total,
}: {
  aberto: boolean;
  filtros: Filtros;
  facetas: Facetas;
  /** Todos os terrenos, para dar nome aos ids que as facetas devolvem. */
  terrenos: Terreno[];
  onFechar: () => void;
  onMudar: (f: Filtros) => void;
  onLimpar: () => void;
  /** Quantos animais a seleção atual devolve — mostrado no botão de fechar. */
  total: number;
}) {
  const insets = useSafeAreaInsets();

  /** Liga/desliga um valor: tocar no que já está escolhido limpa-o. */
  function alternar<K extends keyof Filtros>(chave: K, valor: Filtros[K]) {
    onMudar({ ...filtros, [chave]: filtros[chave] === valor ? undefined : valor });
  }

  const ativos = contarAtivos(filtros);

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel="Fechar filtros" />
        <View
          style={[
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingTop: spacing.md,
              maxHeight: '85%',
            },
            shadow.lg,
          ]}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.sm,
            }}>
            <Text variant="h3" style={{ flex: 1 }}>
              Filtrar animais
            </Text>
            {ativos > 0 ? (
              <Pressable
                onPress={onLimpar}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Limpar filtros">
                <Text variant="bodyStrong" color={colors.danger}>
                  Limpar
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={{ marginLeft: spacing.md }}>
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            {vale(facetas.especies, filtros.especie) ? (
              <Grupo titulo="Espécie">
                {facetas.especies.map((e) => (
                  <Chip
                    key={e}
                    label={especieMeta[e].plural}
                    icon={especieMeta[e].icon}
                    selected={filtros.especie === e}
                    onPress={() => alternar('especie', e)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.sexos, filtros.sexo) ? (
              <Grupo titulo="Sexo">
                {facetas.sexos.map((s) => (
                  <Chip
                    key={s}
                    label={s === 'Fêmea' ? 'Fêmeas' : 'Machos'}
                    icon={s === 'Fêmea' ? 'gender-female' : 'gender-male'}
                    selected={filtros.sexo === s}
                    onPress={() => alternar('sexo', s)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.prenhez, filtros.prenhe) ? (
              <Grupo titulo="Cobrição">
                {facetas.prenhez.map((p) => (
                  <Chip
                    key={String(p)}
                    label={p ? 'Cobertas' : 'Não cobertas'}
                    icon={p ? 'baby-bottle-outline' : 'minus-circle-outline'}
                    selected={filtros.prenhe === p}
                    onPress={() => alternar('prenhe', p)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.idades, filtros.idade) ? (
              <Grupo titulo="Idade">
                {/* Pela ordem das faixas, não pela ordem em que apareceram no
                    efetivo: uma escada de idades baralhada custa a ler. */}
                {FAIXAS.filter((f) => facetas.idades.includes(f.valor)).map((f) => (
                  <Chip
                    key={f.valor}
                    label={f.label}
                    selected={filtros.idade === f.valor}
                    onPress={() => alternar('idade', f.valor)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.racas, filtros.raca) ? (
              <Grupo titulo="Raça">
                {facetas.racas.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    selected={filtros.raca === r}
                    onPress={() => alternar('raca', r)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.cores, filtros.cor) ? (
              <Grupo titulo="Cor da pelagem">
                {facetas.cores.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={filtros.cor === c}
                    onPress={() => alternar('cor', c)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.finalidades, filtros.finalidade) ? (
              <Grupo titulo="Finalidade">
                {facetas.finalidades.map((f) => (
                  <Chip
                    key={f}
                    label={f}
                    icon={finalidadeMeta[f].icon}
                    selected={filtros.finalidade === f}
                    onPress={() => alternar('finalidade', f)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.casas, filtros.casa) ? (
              <Grupo titulo="Casa">
                {facetas.casas.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    icon="home-outline"
                    selected={filtros.casa === c}
                    onPress={() => alternar('casa', c)}
                  />
                ))}
              </Grupo>
            ) : null}

            {vale(facetas.terrenoIds, filtros.terrenoId) ? (
              <Grupo titulo="Terreno">
                {facetas.terrenoIds.map((id) => (
                  <Chip
                    key={id}
                    label={
                      id === SEM_TERRENO
                        ? 'Sem terreno'
                        : (terrenos.find((t) => t.id === id)?.nome ?? 'Terreno')
                    }
                    icon={id === SEM_TERRENO ? 'map-marker-off' : 'map-marker'}
                    selected={filtros.terrenoId === id}
                    onPress={() => alternar('terrenoId', id)}
                  />
                ))}
              </Grupo>
            ) : null}

            {facetas.categoriasAlerta.length > 0 ? (
              <Grupo titulo="Alertas">
                {/* "Todos" só vale a pena com mais do que uma categoria: com
                    uma só, seria o mesmo botão duas vezes. */}
                {facetas.categoriasAlerta.length > 1 ? (
                  <Chip
                    label="Todos"
                    icon="alert-circle-outline"
                    selected={filtros.alerta === true}
                    onPress={() => alternar('alerta', true)}
                  />
                ) : null}
                {facetas.categoriasAlerta.map((c) => (
                  <Chip
                    key={c}
                    label={rotuloCategoriaAlerta[c]}
                    selected={filtros.alerta === c}
                    onPress={() => alternar('alerta', c)}
                  />
                ))}
              </Grupo>
            ) : null}

            {facetas.semBrinco || facetas.nSaidos > 0 ? (
              <Grupo titulo="Outros">
                {facetas.semBrinco ? (
                  <Chip
                    label="Sem brinco"
                    icon="tag-off-outline"
                    selected={!!filtros.semBrinco}
                    onPress={() =>
                      onMudar({ ...filtros, semBrinco: !filtros.semBrinco || undefined })
                    }
                  />
                ) : null}
                {facetas.nSaidos > 0 ? (
                  <Chip
                    label={`Incluir arquivo (${facetas.nSaidos})`}
                    icon="archive-outline"
                    selected={!!filtros.incluirSaidos}
                    onPress={() =>
                      onMudar({ ...filtros, incluirSaidos: !filtros.incluirSaidos || undefined })
                    }
                  />
                ) : null}
              </Grupo>
            ) : null}

            {semNadaParaAfinar(facetas, filtros) ? (
              <Text variant="secondary" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
                Não há mais nada para afinar nesta lista.
              </Text>
            ) : null}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.sm,
              paddingBottom: insets.bottom + spacing.sm,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            }}>
            {/* O número no botão é o que evita fechar a folha e dar de caras
                com uma lista vazia sem perceber qual dos filtros a esvaziou. */}
            <Button
              label={
                total === 0
                  ? 'Nenhum animal corresponde'
                  : `Ver ${total} ${total === 1 ? 'animal' : 'animais'}`
              }
              icon="check"
              onPress={onFechar}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Vale a pena mostrar este grupo?
 *
 * Com uma opção só não vale: já está a ser cumprida por todos os animais da
 * lista, e escolhê-la não tirava nenhum. A exceção é o filtro que o criador já
 * escolheu — esse mostra-se sempre, senão a única forma de o desligar era pelo
 * "Limpar", que leva os outros à frente.
 */
function vale<T>(opcoes: T[], escolhido: T | undefined): boolean {
  return opcoes.length > 1 || escolhido !== undefined;
}

/** Nenhum grupo sobreviveu — a folha ficaria em branco sem uma explicação. */
function semNadaParaAfinar(f: Facetas, filtros: Filtros): boolean {
  return (
    !vale(f.especies, filtros.especie) &&
    !vale(f.sexos, filtros.sexo) &&
    !vale(f.prenhez, filtros.prenhe) &&
    !vale(f.idades, filtros.idade) &&
    !vale(f.racas, filtros.raca) &&
    !vale(f.cores, filtros.cor) &&
    !vale(f.casas, filtros.casa) &&
    !vale(f.finalidades, filtros.finalidade) &&
    !vale(f.terrenoIds, filtros.terrenoId) &&
    f.categoriasAlerta.length === 0 &&
    !f.semBrinco &&
    f.nSaidos === 0
  );
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="label" style={{ marginBottom: spacing.xs }}>
        {titulo}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{children}</View>
    </View>
  );
}
