import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, Icon, type IconName, Text } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { formatDataPt, isoDaysAgo, isoInDays, paraEuro } from '@/data/helpers';
import { useGado } from '@/data/store';
import type { EventoTipo, Sexo } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/* ------------------------------------------------------------------ *
 *  Tipos de evento cobertos por este formulário
 * ------------------------------------------------------------------ */

const REGISTAVEIS = ['Parto', 'Vacinação', 'Medicamento', 'Pesagem'] as const;
type Registavel = (typeof REGISTAVEIS)[number];

const META: Record<Registavel, { icon: IconName; cor: string; titulo: string }> = {
  Parto: { icon: 'baby-bottle-outline', cor: colors.info, titulo: 'Registar parto' },
  Vacinação: { icon: 'needle', cor: colors.primary, titulo: 'Registar vacina' },
  Medicamento: { icon: 'medical-bag', cor: colors.danger, titulo: 'Registar medicamento' },
  Pesagem: { icon: 'scale', cor: colors.warning, titulo: 'Registar pesagem' },
};

const opcoesData = [
  { label: 'Hoje', dias: 0 },
  { label: 'Ontem', dias: 1 },
  { label: 'Há 2 dias', dias: 2 },
  { label: 'Há 1 semana', dias: 7 },
];

const VACINAS_COMUNS = ['Língua azul', 'Brucelose', 'Clostridioses', 'Carbúnculo'];
const VIAS = ['Injetável', 'Oral', 'Tópica', 'Intramamária'];
const PROXIMA_DOSE = ['3 meses', '6 meses', '12 meses'];
const SEGURANCA_DIAS = [0, 7, 10, 14, 28];

/** Converte "20,5" ou "20.5" num número; NaN se inválido. */
function paraNumero(txt: string): number {
  return parseFloat(txt.replace(',', '.'));
}

export default function NovoEventoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { animais, especieDe, addEvento, updateAnimal, animalById, eventosByAnimal } = useGadoAdaptado();

  const params = useLocalSearchParams<{ tipo?: string; animalId?: string }>();
  const tipoInicial: Registavel = (REGISTAVEIS as readonly string[]).includes(params.tipo ?? '')
    ? (params.tipo as Registavel)
    : 'Pesagem';

  const [tipo, setTipo] = useState<Registavel>(tipoInicial);
  const [animalId, setAnimalId] = useState<string | undefined>(params.animalId);
  const [diasAtras, setDiasAtras] = useState(0);

  // Parto
  const [tipoParto, setTipoParto] = useState<'Normal' | 'Distócico' | 'Cesariana'>('Normal');
  const [nCrias, setNCrias] = useState(1);
  const [criaViva, setCriaViva] = useState(true);
  const [sexoCria, setSexoCria] = useState<Sexo | undefined>(undefined);

  // Vacinação
  const [vacina, setVacina] = useState('');
  const [lote, setLote] = useState('');
  const [proximaDose, setProximaDose] = useState<string | undefined>(undefined);
  const [vetVacina, setVetVacina] = useState('');

  // Medicamento
  const [medicamento, setMedicamento] = useState('');
  const [dose, setDose] = useState('');
  const [via, setVia] = useState<string | undefined>(undefined);
  const [motivo, setMotivo] = useState('');
  const [seguranca, setSeguranca] = useState(0);
  const [vetMed, setVetMed] = useState('');

  // Pesagem
  const [peso, setPeso] = useState('');

  // Custo (€) — vacinação e medicamento
  const [custo, setCusto] = useState('');

  // Comum
  const [notas, setNotas] = useState('');

  const data = isoDaysAgo(diasAtras);
  const animal = animalId ? animalById(animalId) : undefined;

  // Lista para escolher o animal (só fêmeas quando é um parto).
  const animaisEscolha = useMemo(() => {
    const lista = tipo === 'Parto' ? animais.filter((a) => a.sexo === 'Fêmea') : animais;
    return [...lista].sort((a, b) =>
      (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(b.nome ?? b.numeroIdentificacao ?? ''),
    );
  }, [animais, tipo]);

  const pesoNum = paraNumero(peso);
  const valido =
    !!animalId &&
    (tipo === 'Parto' ||
      (tipo === 'Vacinação' && vacina.trim().length > 0) ||
      (tipo === 'Medicamento' && medicamento.trim().length > 0) ||
      (tipo === 'Pesagem' && Number.isFinite(pesoNum) && pesoNum > 0));

  /** Ganho médio diário desde a última pesagem registada, se existir. */
  function calcularGmd(kg: number): string | undefined {
    if (!animalId) return undefined;
    const ultima = eventosByAnimal(animalId).find((e) => e.tipo === 'Pesagem');
    if (!ultima) return undefined;
    const m = ultima.descricao.match(/([\d.,]+)\s*kg/i);
    if (!m) return undefined;
    const kgAnt = paraNumero(m[1]);
    if (!Number.isFinite(kgAnt)) return undefined;
    const dias = (new Date(data).getTime() - new Date(ultima.data).getTime()) / 86_400_000;
    if (dias < 1) return undefined;
    const gmd = (kg - kgAnt) / dias;
    return `GMD ${gmd.toFixed(2).replace('.', ',')} kg/dia`;
  }

  function guardar() {
    if (!animalId || !valido) return;

    let descricao = '';
    const partes: string[] = [];

    if (tipo === 'Parto') {
      const rotulo =
        tipoParto === 'Normal' ? 'normal' : tipoParto === 'Distócico' ? 'distócico' : 'por cesariana';
      descricao = `Parto ${rotulo} — ${nCrias} ${nCrias === 1 ? 'cria' : 'crias'}`;
      if (nCrias === 1 && sexoCria) partes.push(`cria ${sexoCria === 'Fêmea' ? 'fêmea' : 'macho'}`);
      partes.push(criaViva ? 'nado-vivo' : 'nado-morto');
    } else if (tipo === 'Vacinação') {
      descricao = `Vacina — ${vacina.trim()}`;
      if (lote.trim()) partes.push(`Lote ${lote.trim()}`);
      if (proximaDose) partes.push(`próxima em ${proximaDose}`);
      if (vetVacina.trim()) partes.push(`Vet. ${vetVacina.trim()}`);
    } else if (tipo === 'Medicamento') {
      descricao = `Medicamento — ${medicamento.trim()}`;
      if (dose.trim()) partes.push(`Dose ${dose.trim()}`);
      if (via) partes.push(via);
      if (motivo.trim()) partes.push(motivo.trim());
      if (vetMed.trim()) partes.push(`Vet. ${vetMed.trim()}`);
      if (seguranca > 0) partes.push(`segurança ${seguranca} dias`);
    } else {
      descricao = `Pesagem: ${peso.trim().replace('.', ',')} kg`;
      const gmd = calcularGmd(pesoNum);
      if (gmd) partes.push(gmd);
    }

    if (notas.trim()) partes.push(notas.trim());
    const detalhe = partes.join(' · ') || undefined;

    // Custo (€) — só faz sentido em vacinação/medicamento.
    let valor: number | undefined;
    if (tipo === 'Vacinação' || tipo === 'Medicamento') {
      const n = paraEuro(custo);
      if (Number.isFinite(n) && n > 0) valor = n;
    }

    addEvento({ animalId, tipo, data, descricao, detalhe, valor });

    // Efeitos secundários no animal
    if (tipo === 'Medicamento' && seguranca > 0) {
      updateAnimal(animalId, { fimIntervaloSeguranca: isoInDays(seguranca) });
    }
    if (tipo === 'Parto' && animal?.dataPrevistaParto) {
      updateAnimal(animalId, { dataPrevistaParto: undefined });
    }

    router.replace(`/animal/${animalId}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={META[tipo].titulo} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        {/* Tipo de evento */}
        <Field label="Tipo de registo" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {REGISTAVEIS.map((t) => (
              <TipoButton
                key={t}
                label={t}
                icon={META[t].icon}
                cor={META[t].cor}
                selected={tipo === t}
                onPress={() => setTipo(t)}
              />
            ))}
          </View>
        </Field>

        {/* Animal */}
        <Field label={tipo === 'Parto' ? 'Mãe (fêmea)' : 'Animal'} obrigatorio>
          {animal ? (
            <AnimalSelecionado
              icone={especieDe(animal.especie)}
              nome={animal.nome ?? 'Sem nome'}
              brinco={animal.numeroIdentificacao ?? 'Sem brinco'}
              onTrocar={() => setAnimalId(undefined)}
            />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {animaisEscolha.map((a) => (
                <Chip
                  key={a.id}
                  label={a.nome ?? a.numeroIdentificacao ?? 'Sem nome'}
                  icon={especieDe(a.especie)}
                  selected={false}
                  onPress={() => setAnimalId(a.id)}
                />
              ))}
              {animaisEscolha.length === 0 ? (
                <Text variant="secondary" color={colors.textMuted}>
                  Não há fêmeas registadas para associar a um parto.
                </Text>
              ) : null}
            </View>
          )}
        </Field>

        {/* Data */}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs }}>
            <Icon name="calendar-check" size="sm" color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              {formatDataPt(data)}
            </Text>
          </View>
        </Field>

        {/* ---- Campos específicos ---- */}
        {tipo === 'Parto' ? (
          <>
            <Field label="Tipo de parto" obrigatorio>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {(['Normal', 'Distócico', 'Cesariana'] as const).map((t) => (
                  <Chip key={t} label={t} selected={tipoParto === t} onPress={() => setTipoParto(t)} />
                ))}
              </View>
            </Field>
            <Field label="Número de crias" obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[1, 2, 3].map((n) => (
                  <BigToggle
                    key={n}
                    label={String(n)}
                    selected={nCrias === n}
                    onPress={() => {
                      setNCrias(n);
                      if (n > 1) setSexoCria(undefined);
                    }}
                  />
                ))}
              </View>
            </Field>
            <Field label="Resultado" obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <BigToggle label="Nado-vivo" icon="heart-pulse" selected={criaViva} onPress={() => setCriaViva(true)} />
                <BigToggle label="Nado-morto" icon="heart-broken" selected={!criaViva} onPress={() => setCriaViva(false)} />
              </View>
            </Field>
            {nCrias === 1 && criaViva ? (
              <Field label="Sexo da cria" opcional>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <BigToggle label="Fêmea" icon="gender-female" selected={sexoCria === 'Fêmea'} onPress={() => setSexoCria('Fêmea')} />
                  <BigToggle label="Macho" icon="gender-male" selected={sexoCria === 'Macho'} onPress={() => setSexoCria('Macho')} />
                </View>
              </Field>
            ) : null}
            <Aviso texto="Depois do parto, lembre-se de identificar a cria (brinco) até aos 20 dias e comunicar o nascimento ao SNIRA." />
          </>
        ) : null}

        {tipo === 'Vacinação' ? (
          <>
            <Field label="Vacina / doença" obrigatorio>
              <TextField value={vacina} onChangeText={setVacina} placeholder="Ex: Língua azul" icon="needle" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {VACINAS_COMUNS.map((v) => (
                  <Chip key={v} label={v} selected={vacina === v} onPress={() => setVacina(v)} />
                ))}
              </View>
            </Field>
            <Field label="Lote" opcional>
              <TextField value={lote} onChangeText={setLote} placeholder="Ex: 4471" icon="flask-outline" autoCapitalize="characters" />
            </Field>
            <Field label="Próxima dose" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {PROXIMA_DOSE.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={proximaDose === p}
                    onPress={() => setProximaDose(proximaDose === p ? undefined : p)}
                  />
                ))}
              </View>
            </Field>
            <Field label="Veterinário" opcional>
              <TextField value={vetVacina} onChangeText={setVetVacina} placeholder="Ex: Dr. Sousa" icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Medicamento' ? (
          <>
            <Field label="Medicamento" obrigatorio>
              <TextField value={medicamento} onChangeText={setMedicamento} placeholder="Ex: Antibiótico" icon="medical-bag" />
            </Field>
            <Field label="Dose" opcional>
              <TextField value={dose} onChangeText={setDose} placeholder="Ex: 20 ml" icon="cup-water" />
            </Field>
            <Field label="Via de administração" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {VIAS.map((v) => (
                  <Chip key={v} label={v} selected={via === v} onPress={() => setVia(via === v ? undefined : v)} />
                ))}
              </View>
            </Field>
            <Field label="Motivo" opcional>
              <TextField value={motivo} onChangeText={setMotivo} placeholder="Ex: Mastite" icon="clipboard-text-outline" />
            </Field>
            <Field label="Intervalo de segurança (dias)" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {SEGURANCA_DIAS.map((d) => (
                  <Chip
                    key={d}
                    label={d === 0 ? 'Nenhum' : `${d} dias`}
                    selected={seguranca === d}
                    onPress={() => setSeguranca(d)}
                  />
                ))}
              </View>
              {seguranca > 0 ? (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                  Não vender para abate até {formatDataPt(isoInDays(seguranca))}.
                </Text>
              ) : null}
            </Field>
            <Field label="Veterinário" opcional>
              <TextField value={vetMed} onChangeText={setVetMed} placeholder="Ex: Dr. Sousa" icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Pesagem' ? (
          <Field label="Peso (kg)" obrigatorio>
            <TextField value={peso} onChangeText={setPeso} placeholder="Ex: 520" icon="weight-kilogram" keyboardType="decimal-pad" />
          </Field>
        ) : null}

        {/* Custo — vacinação e medicamento (entra na gestão económica) */}
        {tipo === 'Vacinação' || tipo === 'Medicamento' ? (
          <Field label="Custo (€)" opcional>
            <TextField value={custo} onChangeText={setCusto} placeholder="Ex: 45" icon="cash" keyboardType="decimal-pad" />
          </Field>
        ) : null}

        {/* Notas — comum a todos */}
        <Field label="Notas" opcional>
          <TextField value={notas} onChangeText={setNotas} placeholder="Observações (opcional)" icon="note-text-outline" multiline />
        </Field>
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
        <Button label="Guardar registo" icon="check" onPress={guardar} disabled={!valido} />
      </View>
    </View>
  );
}

/**
 * Pequeno adaptador sobre useGado: expõe um seletor de ícone por espécie
 * para não repetir o mapa especieMeta em vários pontos do ecrã.
 */
function useGadoAdaptado() {
  const gado = useGado();
  return {
    ...gado,
    especieDe: (especie: keyof typeof especieMeta): IconName => especieMeta[especie].icon,
  };
}

/* ------------------------------------------------------------------ *
 *  Componentes locais de formulário (partilham o estilo de animal/novo)
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
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: IconName;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: spacing.xs,
        minHeight: sizes.input,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: multiline ? spacing.sm : 0,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          flex: 1,
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 17,
          color: colors.text,
          paddingTop: multiline ? 4 : 0,
          minHeight: multiline ? 48 : undefined,
        }}
      />
    </View>
  );
}

/** Cartão grande de escolha do tipo de evento (ícone + rótulo). */
function TipoButton({
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
          flexGrow: 1,
          flexBasis: '46%',
          minHeight: 64,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? cor : colors.border,
          backgroundColor: selected ? cor : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={icon} size="md" color={selected ? colors.onPrimary : cor} />
      <Text variant="button" color={selected ? colors.onPrimary : colors.textSecondary} style={{ fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Resumo do animal escolhido, com opção de trocar. */
function AnimalSelecionado({
  icone,
  nome,
  brinco,
  onTrocar,
}: {
  icone: IconName;
  nome: string;
  brinco: string;
  onTrocar: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: colors.primaryTint,
        padding: spacing.sm,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icone} size="md" color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{nome}</Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {brinco}
        </Text>
      </View>
      <Pressable onPress={onTrocar} accessibilityRole="button" accessibilityLabel="Trocar animal" hitSlop={8}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
          }}>
          <Icon name="swap-horizontal" size="sm" color={colors.primaryDark} />
          <Text variant="label" color={colors.primaryDark}>
            Trocar
          </Text>
        </View>
      </Pressable>
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
  icon?: IconName;
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
      {icon ? <Icon name={icon} size="md" color={selected ? colors.primary : colors.textMuted} /> : null}
      <Text variant="button" color={selected ? colors.primaryDark : colors.textSecondary} style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Nota informativa (contexto legal / boas práticas). */
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
