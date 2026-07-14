import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, Icon, type IconName, Text } from '@/components/ui';
import { tiposTerreno, tipoTerrenoMeta } from '@/data/constants';
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

  const editar = !!terreno;
  const [nome, setNome] = useState(terreno?.nome ?? '');
  const [tipo, setTipo] = useState<TipoTerreno>(terreno?.tipo ?? 'Pastagem');
  const [area, setArea] = useState(terreno?.area != null ? String(terreno.area) : '');
  const [descricao, setDescricao] = useState(terreno?.descricao ?? '');
  const [latitude, setLatitude] = useState(terreno?.latitude != null ? String(terreno.latitude) : '');
  const [longitude, setLongitude] = useState(terreno?.longitude != null ? String(terreno.longitude) : '');

  const exploracao = exploracaoById(exploracaoId);
  const valido = nome.trim().length > 0;

  function parseNum(s: string): number | undefined {
    const t = s.trim().replace(',', '.');
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }

  function guardar() {
    if (!valido) return;
    const dados = {
      nome: nome.trim(),
      tipo,
      area: parseNum(area),
      descricao: descricao.trim() || undefined,
      latitude: parseNum(latitude),
      longitude: parseNum(longitude),
    };
    if (editar && terreno) {
      updateTerreno(terreno.id, dados);
    } else {
      addTerreno({ ...dados, exploracaoId });
    }
    router.back();
  }

  function confirmarEliminar() {
    if (!terreno) return;
    const executar = () => {
      deleteTerreno(terreno.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Eliminar o terreno "${terreno.nome}"?`)) executar();
      return;
    }
    Alert.alert('Eliminar terreno', `Vai eliminar "${terreno.nome}". Os animais lá afetos ficarão sem terreno.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: executar },
    ]);
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
          Coordenadas GPS <Text variant="caption" color={colors.textMuted}>opcional — usadas para meteorologia</Text>
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
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

        {editar ? (
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
        <Button
          label={editar ? 'Guardar alterações' : 'Criar terreno'}
          icon="check"
          onPress={guardar}
          disabled={!valido}
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
