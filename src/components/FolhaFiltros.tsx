import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Icon, Text } from '@/components/ui';
import { especieMeta, finalidadeMeta } from '@/data/constants';
import {
  contarAtivos,
  FAIXAS,
  rotuloCategoriaAlerta,
  SEM_TERRENO,
  type Filtros,
} from '@/data/filtrosAnimais';
import type { Alerta, Especie, Finalidade, Terreno } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

/** O que existe no efetivo — só se oferece o que devolve resultados. */
export type Disponivel = {
  especies: Especie[];
  racas: string[];
  cores: string[];
  casas: string[];
  finalidades: Finalidade[];
  terrenos: Terreno[];
  categoriasAlerta: Alerta['categoria'][];
  temSemTerreno: boolean;
  temSaidos: number;
};

/**
 * Folha com todos os filtros da lista de animais.
 *
 * Em folha, e não em linha no cabeçalho, porque são dez filtros: em chips
 * soltos empurravam a lista para fora do ecrã e o criador tinha de percorrer
 * meio ecrã de opções antes de ver o primeiro animal. Aqui o cabeçalho fica
 * com a pesquisa e um botão, e quem quer afinar abre.
 *
 * Cada grupo só aparece se houver mais do que uma hipótese no efetivo: uma
 * exploração só de bovinos não precisa de ver um filtro de espécie, e um
 * filtro com uma opção só não filtra nada.
 */
export function FolhaFiltros({
  aberto,
  filtros,
  disponivel,
  onFechar,
  onMudar,
  onLimpar,
  total,
}: {
  aberto: boolean;
  filtros: Filtros;
  disponivel: Disponivel;
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
            {disponivel.especies.length > 1 ? (
              <Grupo titulo="Espécie">
                {disponivel.especies.map((e) => (
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

            <Grupo titulo="Sexo">
              <Chip
                label="Fêmeas"
                icon="gender-female"
                selected={filtros.sexo === 'Fêmea'}
                onPress={() => alternar('sexo', 'Fêmea')}
              />
              <Chip
                label="Machos"
                icon="gender-male"
                selected={filtros.sexo === 'Macho'}
                onPress={() => alternar('sexo', 'Macho')}
              />
            </Grupo>

            <Grupo titulo="Cobrição">
              <Chip
                label="Cobertas"
                icon="baby-bottle-outline"
                selected={filtros.prenhe === true}
                onPress={() => alternar('prenhe', true)}
              />
              <Chip
                label="Não cobertas"
                icon="minus-circle-outline"
                selected={filtros.prenhe === false}
                onPress={() => alternar('prenhe', false)}
              />
            </Grupo>

            <Grupo titulo="Idade">
              {FAIXAS.map((f) => (
                <Chip
                  key={f.valor}
                  label={f.label}
                  selected={filtros.idade === f.valor}
                  onPress={() => alternar('idade', f.valor)}
                />
              ))}
            </Grupo>

            {disponivel.racas.length > 1 ? (
              <Grupo titulo="Raça">
                {disponivel.racas.map((r) => (
                  <Chip
                    key={r}
                    label={r}
                    selected={filtros.raca === r}
                    onPress={() => alternar('raca', r)}
                  />
                ))}
              </Grupo>
            ) : null}

            {disponivel.cores.length > 1 ? (
              <Grupo titulo="Cor da pelagem">
                {disponivel.cores.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={filtros.cor === c}
                    onPress={() => alternar('cor', c)}
                  />
                ))}
              </Grupo>
            ) : null}

            {disponivel.finalidades.length > 1 ? (
              <Grupo titulo="Finalidade">
                {disponivel.finalidades.map((f) => (
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

            {disponivel.casas.length > 1 ? (
              <Grupo titulo="Casa">
                {disponivel.casas.map((c) => (
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

            {disponivel.terrenos.length > 0 ? (
              <Grupo titulo="Terreno">
                {disponivel.terrenos.map((t) => (
                  <Chip
                    key={t.id}
                    label={t.nome}
                    icon="map-marker"
                    selected={filtros.terrenoId === t.id}
                    onPress={() => alternar('terrenoId', t.id)}
                  />
                ))}
                {disponivel.temSemTerreno ? (
                  <Chip
                    label="Sem terreno"
                    icon="map-marker-off"
                    selected={filtros.terrenoId === SEM_TERRENO}
                    onPress={() => alternar('terrenoId', SEM_TERRENO)}
                  />
                ) : null}
              </Grupo>
            ) : null}

            {disponivel.categoriasAlerta.length > 0 ? (
              <Grupo titulo="Alertas">
                <Chip
                  label="Todos"
                  icon="alert-circle-outline"
                  selected={filtros.alerta === true}
                  onPress={() => alternar('alerta', true)}
                />
                {disponivel.categoriasAlerta.map((c) => (
                  <Chip
                    key={c}
                    label={rotuloCategoriaAlerta[c]}
                    selected={filtros.alerta === c}
                    onPress={() => alternar('alerta', c)}
                  />
                ))}
              </Grupo>
            ) : null}

            <Grupo titulo="Outros">
              <Chip
                label="Sem brinco"
                icon="tag-off-outline"
                selected={!!filtros.semBrinco}
                onPress={() => onMudar({ ...filtros, semBrinco: !filtros.semBrinco || undefined })}
              />
              {disponivel.temSaidos > 0 ? (
                <Chip
                  label={`Incluir arquivo (${disponivel.temSaidos})`}
                  icon="archive-outline"
                  selected={!!filtros.incluirSaidos}
                  onPress={() =>
                    onMudar({ ...filtros, incluirSaidos: !filtros.incluirSaidos || undefined })
                  }
                />
              ) : null}
            </Grupo>
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
