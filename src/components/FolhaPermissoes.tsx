import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Icon, type IconName, Text } from '@/components/ui';
import {
  exigeFinancasAtivas,
  explicacaoCapacidade,
  legendaCapacidade,
  legendaRole,
  permissoesEfetivas,
  rolePode,
  type Capacidade,
  type PermissoesMembro,
} from '@/data/permissoes';
import type { Trabalhador, Vinculo } from '@/data/trabalhadores';
import type { RoleMembro } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

const ICONE_CAPACIDADE: Record<Capacidade, IconName> = {
  editarExploracao: 'barn',
  eliminarExploracao: 'delete-alert-outline',
  gerirEquipa: 'account-multiple',
  gerirTerrenos: 'grass',
  editarAnimais: 'cow',
  eliminarAnimais: 'delete-outline',
  registarSaida: 'exit-run',
  registarDespesa: 'cash-minus',
  registarReceita: 'cash-plus',
  registarCustoTratamento: 'needle',
};

/**
 * O que uma pessoa da equipa pode alterar — por exploração.
 * ------------------------------------------------------------------
 * O papel (trabalhador / veterinário) dá um conjunto de partida, e é ele que
 * manda enquanto ninguém tocar em nada. Esta folha serve para as exceções, que
 * numa exploração a sério são a regra: o vizinho que só vem à ordenha não tem
 * de poder apagar animais, e o veterinário de confiança pode bem mudar o gado
 * de terreno.
 *
 * Guardar escreve o conjunto todo de uma vez (ver `definirPermissoes`), e o
 * servidor decide pela mesma tabela — as políticas de RLS de
 * `supabase/schema_permissoes.sql` leem esta coluna. Sem essa parte, isto seria
 * uma folha de interruptores que esconde botões e não impede nada.
 */
export function FolhaPermissoes({
  pessoa,
  aberto,
  onFechar,
  onGuardar,
  financasAtivasEm,
  onAbrirEquipa,
}: {
  pessoa: Trabalhador;
  aberto: boolean;
  onFechar: () => void;
  /** Grava e devolve a razão da recusa, ou `null` se ficou gravado. */
  onGuardar: (membroId: string, permissoes: PermissoesMembro) => Promise<string | null>;
  /** A gestão económica está ligada nesta exploração? */
  financasAtivasEm: (exploracaoId: string) => boolean;
  /** Levar ao ecrã da equipa desta exploração (convidar, remover). */
  onAbrirEquipa: (exploracaoId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [indice, setIndice] = useState(0);
  /**
   * O rascunho por vínculo, com o `membroId` à frente.
   *
   * Uma pessoa pode andar em duas explorações com permissões diferentes; sem a
   * chave, mudar de exploração nos chips levava os interruptores da anterior
   * atrás e gravava-os na errada.
   */
  const [rascunhos, setRascunhos] = useState<Record<string, PermissoesMembro>>({});
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vinculo: Vinculo | undefined = pessoa.vinculos[indice] ?? pessoa.vinculos[0];

  const rascunho = useMemo<PermissoesMembro>(
    () => (vinculo ? (rascunhos[vinculo.membroId] ?? vinculo.permissoes ?? {}) : {}),
    [rascunhos, vinculo],
  );

  const linhas = useMemo(
    () => (vinculo ? permissoesEfetivas(vinculo.role, rascunho) : []),
    [vinculo, rascunho],
  );

  // O que o servidor recusaria de qualquer forma não se mostra: com a gestão
  // económica desligada não há despesas nem receitas para ninguém, nem para o
  // dono (ver `schema_financas_opcional.sql`).
  const visiveis = useMemo(
    () =>
      linhas.filter(
        (l) =>
          !exigeFinancasAtivas(l.capacidade)
          || (vinculo ? financasAtivasEm(vinculo.exploracaoId) : false),
      ),
    [linhas, vinculo, financasAtivasEm],
  );

  const mexido = vinculo ? rascunhos[vinculo.membroId] !== undefined : false;
  const temAjustes = visiveis.some((l) => l.ajustada);

  function alternar(capacidade: Capacidade, valor: boolean) {
    if (!vinculo) return;
    setErro(null);
    setRascunhos((r) => {
      const atual = r[vinculo.membroId] ?? vinculo.permissoes ?? {};
      const seguinte = { ...atual };
      // Voltar ao que o papel dá TIRA o ajuste em vez de o gravar igual: assim,
      // no dia em que a regra do papel mudar, esta pessoa acompanha-a.
      if (rolePode(vinculo.role, capacidade) === valor) delete seguinte[capacidade];
      else seguinte[capacidade] = valor;
      return { ...r, [vinculo.membroId]: seguinte };
    });
  }

  function reporPapel() {
    if (!vinculo) return;
    setErro(null);
    setRascunhos((r) => ({ ...r, [vinculo.membroId]: {} }));
  }

  async function guardar() {
    if (!vinculo || aGuardar) return;
    setAGuardar(true);
    setErro(null);
    const razao = await onGuardar(vinculo.membroId, rascunho);
    setAGuardar(false);
    if (razao) {
      setErro(razao);
      return;
    }
    onFechar();
  }

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel="Fechar" />
        <View
          style={[
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingTop: spacing.md,
              maxHeight: '90%',
            },
            shadow.lg,
          ]}>
          {/* Cabeçalho: de quem estamos a falar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.sm,
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="h3" numberOfLines={1}>
                {pessoa.nome}
              </Text>
              <Text variant="secondary" color={colors.textSecondary}>
                O que pode alterar {vinculo ? `em ${vinculo.nomeExploracao}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar">
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            {/* Em que exploração — só se a pessoa entrar em mais do que uma */}
            {pessoa.vinculos.length > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}>
                {pessoa.vinculos.map((v, i) => (
                  <Chip
                    key={v.membroId}
                    label={v.nomeExploracao}
                    icon="barn"
                    selected={i === indice}
                    onPress={() => {
                      setIndice(i);
                      setErro(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {!vinculo ? (
              <Card>
                <Text variant="body" color={colors.textSecondary}>
                  Esta pessoa já não está ligada a nenhuma das suas explorações.
                </Text>
              </Card>
            ) : vinculo.role === 'admin' ? (
              <Card>
                <Text variant="bodyStrong">Dono da exploração</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  Quem é dono pode tudo, e isso não se ajusta: sem isto, uma exploração podia
                  ficar sem ninguém que lhe consiga mexer.
                </Text>
              </Card>
            ) : (
              <>
                <ResumoPapel role={vinculo.role} />

                {visiveis.map((l) => (
                  <LinhaCapacidade
                    key={l.capacidade}
                    capacidade={l.capacidade}
                    valor={l.pode}
                    ajustada={l.ajustada}
                    onMudar={(v) => alternar(l.capacidade, v)}
                  />
                ))}

                {temAjustes ? (
                  <Button
                    label="Repor o que o papel dá"
                    icon="restore"
                    variant="secondary"
                    onPress={reporPapel}
                    style={{ marginTop: spacing.sm }}
                  />
                ) : null}

                <Pressable
                  onPress={() => onAbrirEquipa(vinculo.exploracaoId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir a equipa de ${vinculo.nomeExploracao}`}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: spacing.md,
                    },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="account-multiple" size="sm" color={colors.primary} />
                  <Text variant="secondary" color={colors.primary} style={{ flex: 1 }}>
                    Remover da equipa de {vinculo.nomeExploracao}
                  </Text>
                  <Icon name="chevron-right" size="sm" color={colors.primary} />
                </Pressable>
              </>
            )}

            {erro ? (
              <Card style={{ backgroundColor: colors.dangerTint, marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Icon name="alert-circle-outline" size="md" color={colors.danger} />
                  <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                    {erro}
                  </Text>
                </View>
              </Card>
            ) : null}
          </ScrollView>

          {vinculo && vinculo.role !== 'admin' ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: insets.bottom + spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
              }}>
              <Button
                label={mexido ? 'Guardar permissões' : 'Fechar'}
                icon={mexido ? 'check' : 'close'}
                onPress={mexido ? guardar : onFechar}
                loading={aGuardar}
                disabled={aGuardar}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** Uma linha: o nome da capacidade, o que muda, e o interruptor. */
function LinhaCapacidade({
  capacidade,
  valor,
  ajustada,
  onMudar,
}: {
  capacidade: Capacidade;
  valor: boolean;
  /** Diferente do que o papel dá — marcado, para se ver o que foi mexido. */
  ajustada: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: valor ? colors.successTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={ICONE_CAPACIDADE[capacidade]}
            size="md"
            color={valor ? colors.success : colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
              {legendaCapacidade(capacidade)}
            </Text>
            {ajustada ? (
              <Text variant="caption" color={colors.warning}>
                ALTERADO
              </Text>
            ) : null}
          </View>
          <Text variant="secondary" color={colors.textSecondary}>
            {explicacaoCapacidade(capacidade)}
          </Text>
        </View>
        <Switch
          value={valor}
          onValueChange={onMudar}
          accessibilityLabel={legendaCapacidade(capacidade)}
          trackColor={{ false: colors.borderStrong, true: colors.success }}
          thumbColor={colors.white}
        />
      </View>
    </Card>
  );
}

/**
 * Uma linha a dizer de onde vêm os valores de partida.
 *
 * A diferença entre os dois papéis não é óbvia para quem convida — e é a
 * pergunta que se faz aqui, com os interruptores à frente.
 */
function ResumoPapel({ role }: { role: RoleMembro }) {
  return (
    <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primaryTint }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Icon
          name={role === 'veterinario' ? 'medical-bag' : 'account-hard-hat'}
          size="md"
          color={colors.primaryDark}
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={colors.primaryDark}>
            {legendaRole(role)}
          </Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {role === 'veterinario'
              ? 'De início trata dos animais: fichas, vacinas, medicamentos e certificar uma morte. Não mexe em terrenos nem nas contas.'
              : 'De início faz o maneio todo: animais, terrenos, saídas e as despesas que traz do armazém. Não mexe nas receitas nem na equipa.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}
