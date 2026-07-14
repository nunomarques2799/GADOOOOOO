import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Header, Icon, type IconName, Text } from '@/components/ui';
import { useGado } from '@/data/store';
import type { Exploracao } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/** Formulário reutilizável para criar/editar exploração. */
export function FormularioExploracao({ exploracao }: { exploracao?: Exploracao }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addExploracao, updateExploracao, deleteExploracao } = useGado();

  const editar = !!exploracao;
  const [nome, setNome] = useState(exploracao?.nome ?? '');
  const [marca, setMarca] = useState(exploracao?.marcaExploracao ?? '');
  const [nifDetentor, setNif] = useState(exploracao?.nifDetentor ?? '');
  const [localizacao, setLocalizacao] = useState(exploracao?.localizacao ?? '');

  const valido = nome.trim().length > 0 && marca.trim().length > 0 && nifDetentor.trim().length > 0;

  const [erroGuardar, setErroGuardar] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);

  async function guardar() {
    if (!valido) return;
    setErroGuardar(null);
    setAGravar(true);
    try {
      if (editar && exploracao) {
        await updateExploracao(exploracao.id, {
          nome: nome.trim(),
          marcaExploracao: marca.trim(),
          nifDetentor: nifDetentor.trim(),
          localizacao: localizacao.trim() || undefined,
        });
        router.back();
      } else {
        const nova = await addExploracao({
          nome: nome.trim(),
          marcaExploracao: marca.trim(),
          nifDetentor: nifDetentor.trim(),
          localizacao: localizacao.trim() || undefined,
        });
        router.replace(`/exploracao/${nova.id}`);
      }
    } catch (e) {
      setErroGuardar((e as Error).message ?? 'Erro ao guardar.');
    } finally {
      setAGravar(false);
    }
  }

  function confirmarEliminar() {
    if (!exploracao) return;
    const executar = () => {
      deleteExploracao(exploracao.id);
      router.replace('/exploracoes');
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Eliminar a exploração "${exploracao.nome}" e todos os terrenos/animais associados?`)) {
        executar();
      }
      return;
    }
    Alert.alert(
      'Eliminar exploração',
      `Vai eliminar "${exploracao.nome}", os seus terrenos, animais e histórico. Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: executar },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={editar ? 'Editar exploração' : 'Nova exploração'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Dados oficiais da exploração pecuária. Todos os campos com * são obrigatórios.
        </Text>

        <Field label="Nome" obrigatorio>
          <TextField
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Monte do Avô"
            icon="barn"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Marca de exploração" obrigatorio>
          <TextField
            value={marca}
            onChangeText={setMarca}
            placeholder="PT 00 000 0000"
            icon="barcode"
            autoCapitalize="characters"
          />
        </Field>

        <Field label="NIF do detentor" obrigatorio>
          <TextField
            value={nifDetentor}
            onChangeText={setNif}
            placeholder="000 000 000"
            icon="card-account-details-outline"
            keyboardType="number-pad"
          />
        </Field>

        <Field label="Localização" opcional>
          <TextField
            value={localizacao}
            onChangeText={setLocalizacao}
            placeholder="Ex: Idanha-a-Nova, Castelo Branco"
            icon="map-marker"
            autoCapitalize="words"
          />
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            Usado para obter a meteorologia local.
          </Text>
        </Field>

        {erroGuardar ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: spacing.xs,
              backgroundColor: colors.dangerTint,
              padding: spacing.sm,
              borderRadius: radii.md,
              marginTop: spacing.md,
            }}>
            <Icon name="alert-circle-outline" size="sm" color={colors.danger} />
            <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>{erroGuardar}</Text>
          </View>
        ) : null}

        {editar ? (
          <Button
            label="Eliminar exploração"
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
          label={editar ? 'Guardar alterações' : 'Criar exploração'}
          icon="check"
          onPress={guardar}
          disabled={!valido}
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
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: IconName;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address';
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
