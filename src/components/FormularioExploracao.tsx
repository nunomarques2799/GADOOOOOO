import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CampoLocalidade } from '@/components/CampoLocalidade';
import { Button, EcraComTeclado, EmptyState, Header, Icon, type IconName, Text } from '@/components/ui';
import { avisar, confirmar } from '@/data/avisos';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import type { Exploracao } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/** Formulário reutilizável para criar/editar exploração. */
export function FormularioExploracao({ exploracao }: { exploracao?: Exploracao }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addExploracao, updateExploracao, deleteExploracao } = useGado();
  const { pode, podeCriarExploracoes } = useMembros();
  const toast = useToasts();

  const editar = !!exploracao;
  const podeEliminar = pode(exploracao?.id, 'eliminarExploracao');
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
        toast.sucesso('Exploração guardada', nome.trim());
        router.back();
      } else {
        const nova = await addExploracao({
          nome: nome.trim(),
          marcaExploracao: marca.trim(),
          nifDetentor: nifDetentor.trim(),
          localizacao: localizacao.trim() || undefined,
        });
        toast.sucesso('Exploração criada', nova.nome);
        router.replace(`/exploracao/${nova.id}`);
      }
    } catch (e) {
      const razao = mensagemDeErro(e);
      setErroGuardar(razao);
      toast.erro(editar ? 'Exploração não guardada' : 'Exploração não criada', razao);
    } finally {
      setAGravar(false);
    }
  }

  function confirmarEliminar() {
    if (!exploracao) return;
    // Sair do ecrã antes de saber o resultado escondia as recusas: a app ia
    // para a lista de explorações e o criador ficava a pensar que tinha
    // eliminado. Aqui pesa mais do que noutro sítio qualquer — a cascata local
    // já apagou terrenos, animais e histórico do ecrã, e se o servidor recusar
    // é a sincronização seguinte que os traz de volta, sem explicação nenhuma.
    const executar = async () => {
      try {
        await deleteExploracao(exploracao.id);
        toast.sucesso('Exploração eliminada', exploracao.nome);
        router.replace('/exploracoes');
      } catch (e) {
        avisar('Não foi possível eliminar', mensagemDeErro(e));
      }
    };
    confirmar(
      'Eliminar exploração',
      `Vai eliminar "${exploracao.nome}", os seus terrenos, animais e histórico. Esta ação não pode ser desfeita.`,
      () => void executar(),
      { rotuloConfirmar: 'Eliminar', destrutivo: true },
    );
  }

  // Criar sem poder criar: o botão já não aparece em lado nenhum, mas a rota
  // continua declarada e um link guardado chega cá. Sem isto, o formulário
  // deixava preencher tudo e só rebentava no Guardar, com o "new row violates
  // row-level security policy" do servidor por cima do trabalho já escrito.
  if (!editar && !podeCriarExploracoes) {
    return (
      <EcraComTeclado>
        <Header title="Nova exploração" />
        <EmptyState
          icon="barn"
          title="Só quem tem a sua própria exploração"
          message="Entrou nesta app por convite de quem gere uma exploração, e é lá que trabalha. Para abrir uma exploração sua, crie uma conta própria."
        />
      </EcraComTeclado>
    );
  }

  return (
    <EcraComTeclado>
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
          <CampoLocalidade
            value={localizacao}
            onChangeText={setLocalizacao}
            placeholder="Ex: Idanha-a-Nova"
          />
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            Escreva o nome da terra e escolha da lista. É daqui que sai a meteorologia local.
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

        {editar && podeEliminar ? (
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
    </EcraComTeclado>
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
