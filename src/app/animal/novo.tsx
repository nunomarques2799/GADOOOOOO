import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Chip, Header, Icon, type IconName, Text } from '@/components/ui';
import { especieMeta, especies, sexos } from '@/data/constants';
import { formatDataPt, idadeDias, idadeExtenso, isoDaysAgo } from '@/data/helpers';
import { useGado } from '@/data/store';
import type { Especie, Sexo } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const opcoesData = [
  { label: 'Hoje', dias: 0 },
  { label: 'Ontem', dias: 1 },
  { label: 'Há 1 semana', dias: 7 },
  { label: '~1 ano', dias: 365 },
  { label: '~2 anos', dias: 730 },
  { label: '~5 anos', dias: 1826 },
];

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

export default function NovoAnimalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { exploracoes, terrenosByExploracao, addAnimal } = useGado();

  const [especie, setEspecie] = useState<Especie>('Bovino');
  const [sexo, setSexo] = useState<Sexo>('Fêmea');
  const [diasNasc, setDiasNasc] = useState<number | null>(0);
  const [dataManual, setDataManual] = useState('');
  const [nome, setNome] = useState('');
  const [brinco, setBrinco] = useState('');
  const [raca, setRaca] = useState('');
  const [exploracaoId, setExploracaoId] = useState(exploracoes[0]?.id ?? '');
  const [terrenoId, setTerrenoId] = useState<string | undefined>(undefined);
  const [erroGuardar, setErroGuardar] = useState<string | null>(null);

  const terrenos = useMemo(
    () => (exploracaoId ? terrenosByExploracao(exploracaoId) : []),
    [exploracaoId, terrenosByExploracao],
  );

  const dataManualIso = dataManual.trim() ? parseDataPt(dataManual) : null;
  const dataManualInvalida = dataManual.trim().length > 0 && !dataManualIso;
  const dataNascimento = dataManualIso ?? isoDaysAgo(diasNasc ?? 0);

  async function guardar() {
    if (dataManualInvalida) return;
    if (!exploracaoId) {
      setErroGuardar('Escolha uma exploração para o animal.');
      return;
    }
    setErroGuardar(null);
    try {
      // Animal recém-nascido → gera prazos SNIRA/identificação. Animal já
      // crescido (pré-existente, registado com data antiga) → assume-se já
      // regularizado, para não criar alertas de "comunicar nascimento" falsos.
      const recemNascido = idadeDias(dataNascimento) <= 30;
      const temBrinco = brinco.trim().length > 0;
      const novo = await addAnimal({
        exploracaoId,
        terrenoId,
        especie,
        sexo,
        dataNascimento,
        nome: nome.trim() || undefined,
        numeroIdentificacao: brinco.trim() || undefined,
        raca: raca.trim() || undefined,
        comunicadoSnira: temBrinco ? (recemNascido ? false : true) : undefined,
        dataIdentificacao: temBrinco ? (recemNascido ? isoDaysAgo(0) : dataNascimento) : undefined,
      });
      router.replace(`/animal/${novo.id}`);
    } catch (e) {
      // Falha ao persistir (ex.: sem permissão para esta exploração). Mostra o
      // erro em vez de deixar o animal só no estado local (que nunca sincroniza).
      setErroGuardar(e instanceof Error ? e.message : 'Não foi possível guardar o animal.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Novo animal" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Preencha o essencial. Pode completar os restantes dados mais tarde.
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

        {/* Raça */}
        <Field label="Raça" opcional>
          <TextField value={raca} onChangeText={setRaca} placeholder="Ex: Mertolenga" icon="palette-outline" />
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
                  onPress={() => {
                    setExploracaoId(e.id);
                    setTerrenoId(undefined);
                  }}
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
          label="Guardar animal"
          icon="check"
          onPress={guardar}
          disabled={dataManualInvalida || exploracoes.length === 0}
        />
      </View>
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
        {obrigatorio ? <Text variant="label" color={colors.danger}>*</Text> : null}
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
