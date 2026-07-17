import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, Icon, type IconName, Text } from '@/components/ui';
import { PrazosLegais, especieMeta, especies, sexos } from '@/data/constants';
import { formatDataCurta, formatDataPt, idadeDias, idadeExtenso, isoDaysAgo } from '@/data/helpers';
import { rotuloAnimal } from '@/data/genealogia';
import { useGado } from '@/data/store';
import type { Animal, Especie, Sexo } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

const opcoesData = [
  { label: 'Hoje', dias: 0 },
  { label: 'Ontem', dias: 1 },
  { label: 'Há 1 semana', dias: 7 },
  { label: '~1 ano', dias: 365 },
  { label: '~2 anos', dias: 730 },
  { label: '~5 anos', dias: 1826 },
];

const MS_MES = 30.44 * 86_400_000;

/** Converte "dd/mm/aaaa" (ou dd-mm-aaaa) numa data ISO, ou null se inválida. */
function parseDataPt(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  // Rejeita datas impossíveis (ex.: 31/02) e datas no futuro.
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  if (d.getTime() > Date.now()) return null;
  return d.toISOString();
}

/** Ids de todos os descendentes de um animal — não podem ser seus progenitores. */
function idsDescendentes(animais: Animal[], raizId: string): Set<string> {
  const out = new Set<string>();
  const fila = [raizId];
  while (fila.length > 0) {
    const atual = fila.shift()!;
    for (const a of animais) {
      if ((a.maeId === atual || a.paiId === atual) && !out.has(a.id)) {
        out.add(a.id);
        fila.push(a.id);
      }
    }
  }
  return out;
}

/**
 * Formulário reutilizável para registar/editar um animal. Sem `animal` cria um
 * novo; com `animal` edita o existente.
 */
export function FormularioAnimal({ animal }: { animal?: Animal }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { animais, exploracoes, terrenosByExploracao, addAnimal, updateAnimal, deleteAnimal } = useGado();

  const editar = !!animal;

  const [especie, setEspecie] = useState<Especie>(animal?.especie ?? 'Bovino');
  const [sexo, setSexo] = useState<Sexo>(animal?.sexo ?? 'Fêmea');
  const [diasNasc, setDiasNasc] = useState<number | null>(animal ? null : 0);
  const [dataManual, setDataManual] = useState(animal ? formatDataCurta(animal.dataNascimento) : '');
  const [nome, setNome] = useState(animal?.nome ?? '');
  const [brinco, setBrinco] = useState(animal?.numeroIdentificacao ?? '');
  const [raca, setRaca] = useState(animal?.raca ?? '');
  const [corPelagem, setCorPelagem] = useState(animal?.corPelagem ?? '');
  const [exploracaoId, setExploracaoId] = useState(animal?.exploracaoId ?? exploracoes[0]?.id ?? '');
  const [terrenoId, setTerrenoId] = useState<string | undefined>(animal?.terrenoId);
  const [maeId, setMaeId] = useState<string | undefined>(animal?.maeId);
  const [paiId, setPaiId] = useState<string | undefined>(animal?.paiId);
  const [sniraManual, setSniraManual] = useState<boolean | null>(animal?.comunicadoSnira ?? null);
  const [erroGuardar, setErroGuardar] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const terrenos = useMemo(
    () => (exploracaoId ? terrenosByExploracao(exploracaoId) : []),
    [exploracaoId, terrenosByExploracao],
  );

  const dataManualIso = dataManual.trim() ? parseDataPt(dataManual) : null;
  const dataManualInvalida = dataManual.trim().length > 0 && !dataManualIso;
  const dataNascimento = dataManualIso ?? isoDaysAgo(diasNasc ?? 0);

  // Um progenitor tem de ser da mesma exploração e espécie, ter idade suficiente
  // à data do nascimento e não descender do próprio animal (evita ciclos).
  const excluidos = useMemo(
    () => (animal ? idsDescendentes(animais, animal.id) : new Set<string>()),
    [animais, animal],
  );

  const candidatos = useMemo(() => {
    const nascimento = new Date(dataNascimento).getTime();
    return (sexoProgenitor: Sexo, mesesMin: number) =>
      animais.filter((a) => {
        if (a.id === animal?.id || excluidos.has(a.id)) return false;
        if (a.exploracaoId !== exploracaoId) return false;
        if (a.especie !== especie || a.sexo !== sexoProgenitor) return false;
        return nascimento - new Date(a.dataNascimento).getTime() >= mesesMin * MS_MES;
      });
  }, [animais, animal?.id, excluidos, exploracaoId, especie, dataNascimento]);

  const maes = useMemo(
    () => candidatos('Fêmea', PrazosLegais.idadeMinMaeMeses),
    [candidatos],
  );
  const pais = useMemo(() => candidatos('Macho', PrazosLegais.idadeMinPaiMeses), [candidatos]);

  // Se o animal deixar de ser elegível (ex.: mudou a espécie), larga a escolha.
  const maeValida = maeId && maes.some((a) => a.id === maeId) ? maeId : undefined;
  const paiValido = paiId && pais.some((a) => a.id === paiId) ? paiId : undefined;

  const temBrinco = brinco.trim().length > 0;
  const recemNascido = idadeDias(dataNascimento) <= 30;
  const sniraComunicado = sniraManual ?? !recemNascido;

  function trocarExploracao(id: string) {
    if (id === exploracaoId) return;
    setExploracaoId(id);
    setTerrenoId(undefined);
    setMaeId(undefined);
    setPaiId(undefined);
  }

  async function guardar() {
    if (dataManualInvalida || aGuardar) return;
    if (!exploracaoId) {
      setErroGuardar('Escolha uma exploração para o animal.');
      return;
    }
    setErroGuardar(null);
    setAGuardar(true);
    try {
      // Animal recém-nascido → gera prazos SNIRA/identificação. Animal já
      // crescido (pré-existente, registado com data antiga) → assume-se já
      // regularizado, para não criar alertas de "comunicar nascimento" falsos.
      const dados = {
        exploracaoId,
        terrenoId,
        maeId: maeValida,
        paiId: paiValido,
        especie,
        sexo,
        dataNascimento,
        nome: nome.trim() || undefined,
        numeroIdentificacao: brinco.trim() || undefined,
        raca: raca.trim() || undefined,
        corPelagem: corPelagem.trim() || undefined,
        comunicadoSnira: temBrinco ? sniraComunicado : undefined,
        dataIdentificacao: temBrinco
          ? (animal?.dataIdentificacao ?? (recemNascido ? isoDaysAgo(0) : dataNascimento))
          : undefined,
      };
      if (animal) {
        await updateAnimal(animal.id, dados);
        router.back();
      } else {
        const novo = await addAnimal(dados);
        router.replace(`/animal/${novo.id}`);
      }
    } catch (e) {
      // Falha ao persistir (ex.: sem permissão para esta exploração). Mostra o
      // erro em vez de deixar o animal só no estado local (que nunca sincroniza).
      setErroGuardar(e instanceof Error ? e.message : 'Não foi possível guardar o animal.');
    } finally {
      setAGuardar(false);
    }
  }

  function confirmarEliminar() {
    if (!animal) return;
    const rotulo = rotuloAnimal(animal);
    const msg = `Eliminar "${rotulo}"? Esta ação não pode ser anulada.`;
    const executar = () => {
      void deleteAnimal(animal.id);
      router.dismissTo('/(tabs)/animais');
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg)) executar();
      return;
    }
    Alert.alert('Eliminar animal', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: executar },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={editar ? 'Editar animal' : 'Novo animal'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          {editar
            ? 'Altere o que precisar e guarde no fim.'
            : 'Preencha o essencial. Pode completar os restantes dados mais tarde.'}
        </Text>

        {/* Espécie */}
        <Field label="Espécie" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {especies.map((e) => (
              <Chip key={e} label={e} icon={especieMeta[e].icon} selected={especie === e} onPress={() => setEspecie(e)} />
            ))}
          </View>
        </Field>

        {/* Sexo */}
        <Field label="Sexo" obrigatorio>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {sexos.map((s) => (
              <BigToggle
                key={s}
                label={s}
                icon={s === 'Fêmea' ? 'gender-female' : 'gender-male'}
                selected={sexo === s}
                onPress={() => setSexo(s)}
              />
            ))}
          </View>
        </Field>

        {/* Data de nascimento */}
        <Field label="Data de nascimento" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {opcoesData.map((o) => (
              <Chip
                key={o.dias}
                label={o.label}
                selected={!dataManualIso && diasNasc === o.dias}
                onPress={() => {
                  setDiasNasc(o.dias);
                  setDataManual('');
                }}
              />
            ))}
          </View>

          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm, marginBottom: 4 }}>
            Ou data exata (dd/mm/aaaa) — útil para animais já crescidos
          </Text>
          <TextField
            value={dataManual}
            onChangeText={(t) => {
              setDataManual(t);
              if (t.trim()) setDiasNasc(null);
              else setDiasNasc(0);
            }}
            placeholder="Ex: 15/03/2021"
            icon="calendar-edit"
            keyboardType="number-pad"
          />
          {dataManualInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              Data inválida. Use o formato dd/mm/aaaa e uma data não futura.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
            <Icon name="calendar-check" size="sm" color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              {formatDataPt(dataNascimento)} · {idadeExtenso(dataNascimento)}
            </Text>
          </View>
        </Field>

        {/* Nome */}
        <Field label="Nome" opcional>
          <TextField value={nome} onChangeText={setNome} placeholder="Ex: Mimosa" icon="tag-heart-outline" />
        </Field>

        {/* Brinco */}
        <Field label="Nº de brinco (SIA)" opcional>
          <TextField
            value={brinco}
            onChangeText={setBrinco}
            placeholder="PT 0000 0000 0000"
            icon="tag-outline"
            autoCapitalize="characters"
          />
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            Se deixar vazio, criamos um alerta para identificar até aos 20 dias.
          </Text>
        </Field>

        {/* SNIRA — só faz sentido com brinco atribuído */}
        {temBrinco ? (
          <Field label="Nascimento comunicado ao SNIRA?">
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <BigToggle
                label="Já comunicado"
                icon="cloud-check-outline"
                selected={sniraComunicado}
                onPress={() => setSniraManual(true)}
              />
              <BigToggle
                label="Por comunicar"
                icon="cloud-alert"
                selected={!sniraComunicado}
                onPress={() => setSniraManual(false)}
              />
            </View>
          </Field>
        ) : null}

        {/* Raça e pelagem */}
        <Field label="Raça" opcional>
          <TextField value={raca} onChangeText={setRaca} placeholder="Ex: Mertolenga" icon="palette-outline" />
        </Field>

        <Field label="Cor da pelagem" opcional>
          <TextField value={corPelagem} onChangeText={setCorPelagem} placeholder="Ex: Malhada" icon="format-color-fill" />
        </Field>

        {/* Exploração */}
        <Field label="Exploração" obrigatorio>
          {exploracoes.length === 0 ? (
            <Text variant="secondary" color={colors.danger}>
              Ainda não tem explorações. Crie uma exploração antes de registar animais.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {exploracoes.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nome}
                  icon="barn"
                  selected={exploracaoId === e.id}
                  onPress={() => trocarExploracao(e.id)}
                />
              ))}
            </View>
          )}
        </Field>

        {/* Terreno */}
        {terrenos.length > 0 ? (
          <Field label="Terreno" opcional>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {terrenos.map((t) => (
                <Chip
                  key={t.id}
                  label={t.nome}
                  icon="map-marker"
                  selected={terrenoId === t.id}
                  onPress={() => setTerrenoId(terrenoId === t.id ? undefined : t.id)}
                />
              ))}
            </View>
          </Field>
        ) : null}

        {/* Genealogia */}
        <Text variant="label" style={{ marginBottom: spacing.xs }}>
          Genealogia
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          Só aparecem animais da mesma exploração e espécie com idade suficiente à data do nascimento.
        </Text>

        <SeletorProgenitor
          label="Mãe"
          icone="gender-female"
          candidatos={maes}
          selecionadoId={maeValida}
          onSelecionar={setMaeId}
          vazio="Não há fêmeas elegíveis registadas."
        />
        <SeletorProgenitor
          label="Pai"
          icone="gender-male"
          candidatos={pais}
          selecionadoId={paiValido}
          onSelecionar={setPaiId}
          vazio="Não há machos elegíveis registados."
        />

        {editar ? (
          <Button
            label="Eliminar animal"
            icon="trash-can-outline"
            variant="danger"
            onPress={confirmarEliminar}
            style={{ marginTop: spacing.xl }}
          />
        ) : null}
      </ScrollView>

      {/* Barra de gravar fixa */}
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
        {erroGuardar ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
            <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
              {erroGuardar}
            </Text>
          </View>
        ) : null}
        <Button
          label={editar ? 'Guardar alterações' : 'Guardar animal'}
          icon="check"
          onPress={guardar}
          disabled={dataManualInvalida || exploracoes.length === 0 || aGuardar}
        />
      </View>
    </View>
  );
}

/**
 * Escolha de mãe/pai: mostra quem está escolhido e, quando há muitos animais,
 * um campo de procura para não encher o ecrã de opções.
 */
function SeletorProgenitor({
  label,
  icone,
  candidatos,
  selecionadoId,
  onSelecionar,
  vazio,
}: {
  label: string;
  icone: IconName;
  candidatos: Animal[];
  selecionadoId?: string;
  onSelecionar: (id: string | undefined) => void;
  vazio: string;
}) {
  const [procura, setProcura] = useState('');
  const LIMITE = 12;

  const filtrados = useMemo(() => {
    const q = procura.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter((a) => rotuloAnimal(a).toLowerCase().includes(q));
  }, [candidatos, procura]);

  const visiveis = filtrados.slice(0, LIMITE);
  const selecionado = candidatos.find((a) => a.id === selecionadoId);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
        <Icon name={icone} size="sm" color={colors.textMuted} />
        <Text variant="label" style={{ flex: 1 }}>
          {label}
        </Text>
        {selecionado ? (
          <Pressable
            onPress={() => onSelecionar(undefined)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Limpar ${label}`}>
            <Text variant="bodyStrong" color={colors.danger}>
              Limpar
            </Text>
          </Pressable>
        ) : (
          <Text variant="caption" color={colors.textMuted}>
            opcional
          </Text>
        )}
      </View>

      {candidatos.length === 0 ? (
        <Text variant="secondary" color={colors.textMuted}>
          {vazio}
        </Text>
      ) : (
        <>
          {candidatos.length > LIMITE ? (
            <View style={{ marginBottom: spacing.xs }}>
              <TextField value={procura} onChangeText={setProcura} placeholder="Procurar por nome ou brinco" icon="magnify" />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {visiveis.map((a) => (
              <Chip
                key={a.id}
                label={rotuloAnimal(a)}
                icon={especieMeta[a.especie].icon}
                selected={selecionadoId === a.id}
                onPress={() => onSelecionar(selecionadoId === a.id ? undefined : a.id)}
              />
            ))}
          </View>
          {filtrados.length > visiveis.length ? (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
              Mais {filtrados.length - visiveis.length} — use a procura para encontrar.
            </Text>
          ) : null}
          {filtrados.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>
              Nenhum animal corresponde a “{procura.trim()}”.
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
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
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        height: sizes.input,
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
        style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
      />
    </View>
  );
}

function BigToggle({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
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
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryTint : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={icon} size="md" color={selected ? colors.primary : colors.textMuted} />
      <Text variant="button" color={selected ? colors.primaryDark : colors.textSecondary} style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}
