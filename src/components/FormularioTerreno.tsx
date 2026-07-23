import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, Icon, type IconName, Text } from '@/components/ui';
import { MapaLocalizacao } from '@/components/mapa/MapaLocalizacao';
import { avisar, confirmar } from '@/data/avisos';
import { tiposTerreno, tipoTerrenoMeta } from '@/data/constants';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import type { Terreno, TipoTerreno } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/** Formulário reutilizável para criar/editar terreno de uma exploração. */
export function FormularioTerreno({
  terreno,
  exploracaoId,
}: {
  terreno?: Terreno;
  exploracaoId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addTerreno, updateTerreno, deleteTerreno, exploracaoById } = useGado();
  const { pode } = useMembros();

  const editar = !!terreno;
  const podeEliminar = pode(exploracaoId, 'gerirTerrenos');
  const [nome, setNome] = useState(terreno?.nome ?? '');
  const [tipo, setTipo] = useState<TipoTerreno>(terreno?.tipo ?? 'Pastagem');
  const [area, setArea] = useState(terreno?.area != null ? String(terreno.area) : '');
  const [descricao, setDescricao] = useState(terreno?.descricao ?? '');
  const [latitude, setLatitude] = useState(terreno?.latitude != null ? String(terreno.latitude) : '');
  const [longitude, setLongitude] = useState(terreno?.longitude != null ? String(terreno.longitude) : '');
  const [manual, setManual] = useState(false);
  const [erroGuardar, setErroGuardar] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);

  const exploracao = exploracaoById(exploracaoId);
  const valido = nome.trim().length > 0;

  function parseNum(s: string): number | undefined {
    const t = s.trim().replace(',', '.');
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }

  const latNum = parseNum(latitude);
  const lngNum = parseNum(longitude);
  const temCoords = latNum != null && lngNum != null;

  function limparLocalizacao() {
    setLatitude('');
    setLongitude('');
  }

  // Esperar pela gravação antes de sair do ecrã: sem o `await`, uma recusa do
  // servidor (RLS — um veterinário não gere terrenos — ou conflito de versão)
  // ficava numa promessa sem dono e a app voltava atrás como se tivesse
  // gravado. Offline não muda nada: a escrita entra na fila e isto devolve já.
  async function guardar() {
    if (!valido || aGravar) return;
    setErroGuardar(null);
    setAGravar(true);
    const dados = {
      nome: nome.trim(),
      tipo,
      area: parseNum(area),
      descricao: descricao.trim() || undefined,
      latitude: latNum,
      longitude: lngNum,
    };
    try {
      if (editar && terreno) {
        await updateTerreno(terreno.id, dados);
      } else {
        await addTerreno({ ...dados, exploracaoId });
      }
      router.back();
    } catch (e) {
      setErroGuardar(e instanceof Error ? e.message : 'Não foi possível guardar o terreno.');
      setAGravar(false);
    }
  }

  function confirmarEliminar() {
    if (!terreno) return;
    const executar = async () => {
      try {
        await deleteTerreno(terreno.id);
        router.back();
      } catch (e) {
        avisar('Não foi possível eliminar', e instanceof Error ? e.message : String(e));
      }
    };
    confirmar(
      'Eliminar terreno',
      `Vai eliminar "${terreno.nome}". Os animais lá afetos ficarão sem terreno.`,
      () => void executar(),
      { rotuloConfirmar: 'Eliminar', destrutivo: true },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={editar ? 'Editar terreno' : 'Novo terreno'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Exploração: {exploracao?.nome ?? '—'}
        </Text>

        <Field label="Nome" obrigatorio>
          <TextField
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Lameiro Grande"
            icon="map-marker"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Tipo" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {tiposTerreno.map((t) => (
              <Chip
                key={t}
                label={t}
                icon={tipoTerrenoMeta[t].icon}
                selected={tipo === t}
                onPress={() => setTipo(t)}
              />
            ))}
          </View>
        </Field>

        <Field label="Área (hectares)" opcional>
          <TextField
            value={area}
            onChangeText={setArea}
            placeholder="Ex: 4.2"
            icon="ruler-square"
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Descrição" opcional>
          <TextField
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Poço e bebedouro a norte"
            icon="note-text-outline"
            multiline
          />
        </Field>

        <Text variant="label" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
          Localização no mapa{' '}
          <Text variant="caption" color={colors.textMuted}>opcional — para direções e meteorologia</Text>
        </Text>
        <MapaLocalizacao
          latitude={latNum}
          longitude={lngNum}
          selecionavel
          altura={240}
          onEscolher={(lat, lng) => {
            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));
          }}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            marginTop: spacing.xs,
          }}>
          <Icon name={temCoords ? 'map-marker-check' : 'map-marker-question'} size="sm" color={temCoords ? colors.primary : colors.textMuted} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {temCoords
              ? `Marcado: ${latNum!.toFixed(5)}, ${lngNum!.toFixed(5)}`
              : 'Toque no mapa para marcar o terreno.'}
          </Text>
          {temCoords ? (
            <Pressable onPress={limparLocalizacao} hitSlop={8} accessibilityRole="button" accessibilityLabel="Limpar localização">
              <Text variant="bodyStrong" color={colors.danger}>Limpar</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => setManual((m) => !m)}
          hitSlop={6}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
          <Icon name={manual ? 'chevron-up' : 'chevron-down'} size="sm" color={colors.textSecondary} />
          <Text variant="secondary" color={colors.textSecondary}>Introduzir coordenadas manualmente</Text>
        </Pressable>

        {manual ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Latitude</Text>
              <TextField
                value={latitude}
                onChangeText={setLatitude}
                placeholder="39.92"
                icon="latitude"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Longitude</Text>
              <TextField
                value={longitude}
                onChangeText={setLongitude}
                placeholder="-7.24"
                icon="longitude"
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        ) : null}

        {editar && podeEliminar ? (
          <Button
            label="Eliminar terreno"
            icon="trash-can-outline"
            variant="danger"
            onPress={confirmarEliminar}
            style={{ marginTop: spacing.xl }}
          />
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
        {erroGuardar ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.sm,
            }}>
            <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
            <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
              {erroGuardar}
            </Text>
          </View>
        ) : null}
        <Button
          label={editar ? 'Guardar alterações' : 'Criar terreno'}
          icon="check"
          onPress={guardar}
          disabled={!valido || aGravar}
          loading={aGravar}
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
          <Text variant="caption" color={colors.textMuted}>opcional</Text>
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
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
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
          minHeight: multiline ? 56 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}
