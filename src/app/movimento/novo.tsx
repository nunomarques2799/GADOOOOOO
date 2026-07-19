import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { avisar } from '@/data/avisos';
import { Button, Chip, EmptyState, Header, Icon, type IconName, Screen, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { formatDataPt, isoDaysAgo, paraEuro } from '@/data/helpers';
import { useGado } from '@/data/store';
import { useFinancas } from '@/data/useFinancas';
import type { CategoriaDespesa, CategoriaReceita, Direcao } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/**
 * Ordem pensada para quem regista, não por alfabeto: a alimentação é o que
 * aparece mais vezes numa exploração de gado, por isso vem primeiro e poupa
 * um scroll em quase todos os registos.
 */
const CATEGORIAS_DESPESA: { valor: CategoriaDespesa; icon: IconName }[] = [
  { valor: 'Alimentação', icon: 'silo' },
  { valor: 'Sanidade', icon: 'needle' },
  { valor: 'Energia e combustível', icon: 'lightning-bolt' },
  { valor: 'Água', icon: 'water' },
  { valor: 'Rendas e terrenos', icon: 'file-document-outline' },
  { valor: 'Máquinas e reparações', icon: 'wrench-outline' },
  { valor: 'Mão-de-obra', icon: 'account-hard-hat' },
  { valor: 'Taxas e seguros', icon: 'shield-check-outline' },
  { valor: 'Compra de animais', icon: 'cart-outline' },
  { valor: 'Outras despesas', icon: 'dots-horizontal' },
];

const CATEGORIAS_RECEITA: { valor: CategoriaReceita; icon: IconName }[] = [
  { valor: 'Venda de animais', icon: 'cash-plus' },
  { valor: 'Leite e produtos', icon: 'bottle-soda-outline' },
  { valor: 'Apoios e subsídios', icon: 'hand-coin-outline' },
  { valor: 'Outras receitas', icon: 'dots-horizontal' },
];

const opcoesData = [
  { label: 'Hoje', dias: 0 },
  { label: 'Ontem', dias: 1 },
  { label: 'Há 1 semana', dias: 7 },
  { label: 'Há 1 mês', dias: 30 },
];

export default function NovoMovimentoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { exploracoes, animais, terrenos, addMovimento } = useGado();

  const params = useLocalSearchParams<{
    direcao?: string;
    exploracaoId?: string;
    animalId?: string;
  }>();

  const [exploracaoId, setExploracaoId] = useState<string | undefined>(
    params.exploracaoId ?? (exploracoes.length === 1 ? exploracoes[0].id : undefined),
  );
  const [direcao, setDirecao] = useState<Direcao>(
    params.direcao === 'receita' ? 'receita' : 'despesa',
  );
  const [categoria, setCategoria] = useState<string>('Alimentação');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [diasAtras, setDiasAtras] = useState(0);
  const [animalId, setAnimalId] = useState<string | undefined>(params.animalId);
  const [terrenoId, setTerrenoId] = useState<string | undefined>(undefined);
  const [aGravar, setAGravar] = useState(false);

  const {
    ativas,
    podeRegistarReceita: podeReceita,
    podeRegistarDespesa: podeDespesa,
  } = useFinancas(exploracaoId);

  // Um trabalhador não lança receitas: se a exploração escolhida não lho
  // permite, o formulário volta a despesa em vez de o deixar preencher tudo
  // para o servidor recusar no fim — e, offline, só na sincronização seguinte.
  const direcaoEfetiva: Direcao = direcao === 'receita' && !podeReceita ? 'despesa' : direcao;

  const categorias = direcaoEfetiva === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const categoriaValida = categorias.some((c) => c.valor === categoria)
    ? categoria
    : categorias[0].valor;

  const data = isoDaysAgo(diasAtras);
  const valorNum = paraEuro(valor);

  const animaisDaExploracao = useMemo(
    () =>
      animais
        .filter((a) => a.exploracaoId === exploracaoId)
        .sort((a, b) =>
          (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(
            b.nome ?? b.numeroIdentificacao ?? '',
          ),
        ),
    [animais, exploracaoId],
  );
  const terrenosDaExploracao = useMemo(
    () => terrenos.filter((t) => t.exploracaoId === exploracaoId),
    [terrenos, exploracaoId],
  );

  const valido =
    !!exploracaoId &&
    Number.isFinite(valorNum) &&
    valorNum > 0 &&
    descricao.trim().length > 0 &&
    (direcaoEfetiva === 'receita' ? podeReceita : podeDespesa);

  async function guardar() {
    if (!exploracaoId || !valido || aGravar) return;
    setAGravar(true);
    try {
      await addMovimento({
        exploracaoId,
        direcao: direcaoEfetiva,
        categoria: categoriaValida as CategoriaDespesa | CategoriaReceita,
        valor: valorNum,
        data,
        descricao: descricao.trim(),
        contraparte: contraparte.trim() || undefined,
        animalId,
        terrenoId,
      });
      // `back()` sozinho não chega: quem abre este ecrã por link direto (a app
      // instalada, um atalho) não tem histórico para onde voltar, e o botão
      // ficava preso em "A gravar…" com o movimento já gravado.
      if (router.canGoBack()) router.back();
      else router.replace('/financas');
    } catch (e) {
      // A recusa vem do servidor (RLS) e tem de aparecer: o movimento já foi
      // mostrado como gravado, e desaparecer em silêncio é o pior dos casos.
      avisar('Não foi possível gravar', e instanceof Error ? e.message : String(e));
      setAGravar(false);
    }
  }

  const corDirecao = direcaoEfetiva === 'receita' ? colors.success : colors.danger;

  // Alcançável por link direto (a app instalada guarda URLs) mesmo depois de o
  // dono desligar a gestão financeira. Sem esta guarda, o formulário abria e a
  // gravação só falhava no fim — ou, offline, na sincronização seguinte.
  if (!ativas) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Registar movimento" />
        <Screen>
          <EmptyState
            icon="cash-off"
            title="Gestão financeira desligada"
            message="Esta conta não usa a app para registar despesas e receitas. Quem gere a exploração pode ligá-la em Perfil → Gestão financeira."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={direcaoEfetiva === 'receita' ? 'Registar receita' : 'Registar despesa'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.huge * 2,
        }}>
        {/* Exploração — só se houver mais do que uma */}
        {exploracoes.length > 1 ? (
          <Field label="Exploração" obrigatorio>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {exploracoes.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nome}
                  icon="barn"
                  selected={exploracaoId === e.id}
                  onPress={() => {
                    setExploracaoId(e.id);
                    setAnimalId(undefined);
                    setTerrenoId(undefined);
                  }}
                />
              ))}
            </View>
          </Field>
        ) : null}

        {/* Despesa ou receita — só quem pode lançar receitas vê a escolha */}
        {podeReceita ? (
          <Field label="Tipo de movimento" obrigatorio>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <BigToggle
                label="Despesa"
                icon="cash-minus"
                cor={colors.danger}
                selected={direcaoEfetiva === 'despesa'}
                onPress={() => setDirecao('despesa')}
              />
              <BigToggle
                label="Receita"
                icon="cash-plus"
                cor={colors.success}
                selected={direcaoEfetiva === 'receita'}
                onPress={() => setDirecao('receita')}
              />
            </View>
          </Field>
        ) : null}

        <Field label="Categoria" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {categorias.map((c) => (
              <Chip
                key={c.valor}
                label={c.valor}
                icon={c.icon}
                selected={categoriaValida === c.valor}
                onPress={() => setCategoria(c.valor)}
              />
            ))}
          </View>
        </Field>

        <Field label="Valor (€)" obrigatorio>
          <TextField
            value={valor}
            onChangeText={setValor}
            placeholder="Ex: 860"
            icon="cash"
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Descrição" obrigatorio>
          <TextField
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Ração — 40 sacos"
            icon="note-text-outline"
          />
        </Field>

        <Field label="Data" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {opcoesData.map((o) => (
              <Chip
                key={o.dias}
                label={o.label}
                selected={diasAtras === o.dias}
                onPress={() => setDiasAtras(o.dias)}
              />
            ))}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.xs,
            }}>
            <Icon name="calendar-check" size="sm" color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              {formatDataPt(data)}
            </Text>
          </View>
        </Field>

        <Field label={direcaoEfetiva === 'receita' ? 'Comprador' : 'Fornecedor'} opcional>
          <TextField
            value={contraparte}
            onChangeText={setContraparte}
            placeholder="Ex: Agro-Nisa"
            icon="store-outline"
            autoCapitalize="words"
          />
        </Field>

        {/* Imputação — opcional de propósito: a conta da luz não tem animal */}
        {animaisDaExploracao.length > 0 ? (
          <Field label="Animal" opcional>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {animaisDaExploracao.map((a) => (
                <Chip
                  key={a.id}
                  label={a.nome ?? a.numeroIdentificacao ?? 'Sem nome'}
                  icon={especieMeta[a.especie].icon}
                  selected={animalId === a.id}
                  onPress={() => setAnimalId(animalId === a.id ? undefined : a.id)}
                />
              ))}
            </View>
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
              Só se este movimento for mesmo de um animal. Deixe em branco para custos da
              exploração inteira.
            </Text>
          </Field>
        ) : null}

        {terrenosDaExploracao.length > 0 ? (
          <Field label="Terreno" opcional>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {terrenosDaExploracao.map((t) => (
                <Chip
                  key={t.id}
                  label={t.nome}
                  icon="grass"
                  selected={terrenoId === t.id}
                  onPress={() => setTerrenoId(terrenoId === t.id ? undefined : t.id)}
                />
              ))}
            </View>
          </Field>
        ) : null}

        {!podeReceita ? (
          <Aviso texto="Pode registar despesas. As receitas — vendas, subsídios — são lançadas por quem gere a exploração." />
        ) : null}
      </ScrollView>

      <View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          shadow.lg,
        ]}>
        <Button
          label={aGravar ? 'A gravar…' : 'Guardar movimento'}
          icon="check"
          onPress={guardar}
          disabled={!valido || aGravar}
        />
        {valorNum > 0 && Number.isFinite(valorNum) ? (
          <Text
            variant="caption"
            color={corDirecao}
            style={{ marginTop: spacing.xs, textAlign: 'center' }}>
            {direcaoEfetiva === 'receita' ? 'Entra' : 'Sai'} {valor.replace('.', ',')} €
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Componentes locais (mesmo estilo de evento/novo.tsx)
 * ------------------------------------------------------------------ */

function Field({
  label,
  obrigatorio,
  opcional,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: spacing.xs,
        }}>
        <Text variant="label">{label}</Text>
        {obrigatorio ? (
          <Text variant="label" color={colors.danger}>
            *
          </Text>
        ) : null}
        {opcional ? (
          <Text variant="caption" color={colors.textMuted}>
            opcional
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function TextField({
  value,
  onChangeText,
  placeholder,
  icon,
  autoCapitalize,
  keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: IconName;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: sizes.input,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={{
          flex: 1,
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 17,
          color: colors.text,
        }}
      />
    </View>
  );
}

function BigToggle({
  label,
  icon,
  cor,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  cor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flex: 1,
          height: sizes.button,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? cor : colors.border,
          backgroundColor: selected ? cor : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={icon} size="md" color={selected ? colors.onPrimary : cor} />
      <Text
        variant="button"
        color={selected ? colors.onPrimary : colors.textSecondary}
        style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'flex-start',
        backgroundColor: colors.infoTint,
        borderRadius: radii.md,
        padding: spacing.sm,
        marginBottom: spacing.lg,
      }}>
      <Icon name="information" size="md" color={colors.info} />
      <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}
