import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CampoLocalidade } from '@/components/CampoLocalidade';
import { MapaLocalizacao } from '@/components/mapa/MapaLocalizacao';
import { SeletorFoto } from '@/components/SeletorFoto';
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
  const {
    addExploracao, updateExploracao, deleteExploracao,
    terrenos, animais, eventos, movimentos,
  } = useGado();
  const { pode, podeCriarExploracoes } = useMembros();
  const toast = useToasts();

  const editar = !!exploracao;
  const podeEliminar = pode(exploracao?.id, 'eliminarExploracao');
  const [nome, setNome] = useState(exploracao?.nome ?? '');
  const [marca, setMarca] = useState(exploracao?.marcaExploracao ?? '');
  const [nifDetentor, setNif] = useState(exploracao?.nifDetentor ?? '');
  const [localizacao, setLocalizacao] = useState(exploracao?.localizacao ?? '');
  const [foto, setFoto] = useState<string | undefined>(exploracao?.fotografia);
  const [latitude, setLatitude] = useState<number | undefined>(exploracao?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(exploracao?.longitude);
  // O mapa fica fechado até se pedir: é um WebView com tiles de satélite, e
  // abrir sempre punha-o a descarregar imagens a quem só quer mudar o NIF.
  // Já marcado, abre de raiz — é o que confirma que o pino está no sítio certo.
  const [mapaAberto, setMapaAberto] = useState(exploracao?.latitude != null);

  const temCoords = latitude != null && longitude != null;

  const valido = nome.trim().length > 0 && marca.trim().length > 0 && nifDetentor.trim().length > 0;

  const [erroGuardar, setErroGuardar] = useState<string | null>(null);
  const [aGravar, setAGravar] = useState(false);

  async function guardar() {
    if (!valido) return;
    setErroGuardar(null);
    setAGravar(true);
    try {
      const dados = {
        nome: nome.trim(),
        marcaExploracao: marca.trim(),
        nifDetentor: nifDetentor.trim(),
        localizacao: localizacao.trim() || undefined,
        latitude,
        longitude,
        fotografia: foto,
      };
      if (editar && exploracao) {
        await updateExploracao(exploracao.id, dados);
        toast.sucesso('Exploração guardada', nome.trim());
        router.back();
      } else {
        const nova = await addExploracao(dados);
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

  /**
   * "3 terrenos, 11 animais, 47 registos e 13 movimentos" — os números do que a
   * cascata vai levar.
   *
   * Contados aqui e não escritos à mão: uma frase genérica ("e o histórico")
   * não dá a dimensão do que se perde, e é a dimensão que faz alguém parar.
   */
  function resumoDoQueSeVai(): string {
    if (!exploracao) return 'nada';
    const meusTerrenos = terrenos.filter((t) => t.exploracaoId === exploracao.id);
    const meusAnimais = animais.filter((a) => a.exploracaoId === exploracao.id);
    const ids = new Set(meusAnimais.map((a) => a.id));
    const meusEventos = eventos.filter((e) => ids.has(e.animalId));
    const meusMovimentos = movimentos.filter((m) => m.exploracaoId === exploracao.id);

    const partes = [
      `${meusTerrenos.length} ${meusTerrenos.length === 1 ? 'terreno' : 'terrenos'}`,
      `${meusAnimais.length} ${meusAnimais.length === 1 ? 'animal' : 'animais'}`,
      `${meusEventos.length} ${meusEventos.length === 1 ? 'registo' : 'registos'}`,
    ];
    // O dinheiro só se nomeia se existir: numa conta sem gestão económica
    // ligada, falar de despesas era assustar com uma coisa que não há.
    if (meusMovimentos.length > 0) {
      partes.push(
        `${meusMovimentos.length} ${
          meusMovimentos.length === 1 ? 'despesa ou receita' : 'despesas e receitas'
        }`,
      );
    }
    return partes.join(', ');
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
    // O aviso conta o que a cascata leva DE FACTO. Dizia "terrenos, animais e
    // histórico" e ficavam de fora o dinheiro e a equipa — que é precisamente o
    // que ninguém espera perder ao apagar uma exploração.
    confirmar(
      'Eliminar exploração',
      `Vai eliminar "${exploracao.nome}" e tudo o que está lá dentro: `
        + `${resumoDoQueSeVai()}. `
        + 'Leva também os animais que já tinham saído do efetivo, e com eles a '
        + 'genealogia. Esta ação não pode ser desfeita.',
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

  // E o mesmo para EDITAR. Faltava: o ramo acima só cobria a criação, portanto
  // um trabalhador ou um veterinário que chegasse a `/exploracao/editar/[id]`
  // encontrava o nome, a marca e o NIF da exploração de outra pessoa num
  // formulário aberto, pronto a gravar contra uma RLS que o ia recusar.
  if (editar && !pode(exploracao?.id, 'editarExploracao')) {
    return (
      <EcraComTeclado>
        <Header title="Editar exploração" />
        <EmptyState
          icon="lock-outline"
          title="A exploração é de quem a tem a cargo"
          message="O nome, a marca de exploração, o NIF e a localização são alterados por quem responde por ela. Continua a poder trabalhar nos animais e no que lhe compete."
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

        <SeletorFoto foto={foto} onMudar={setFoto} icone="barn" assunto="da exploração" forma="cartao" />

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
            Escreva o nome da terra e escolha da lista. Chega para a meteorologia local.
          </Text>

          {/* As duas maneiras de dizer onde é, e nenhuma obrigatória: o nome da
              terra, ou o sítio exato no mapa. Marcado o pino, é ele que manda na
              meteorologia — o nome de um concelho pode dar uma previsão a trinta
              quilómetros da quinta. */}
          <Pressable
            onPress={() => setMapaAberto((m) => !m)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ expanded: mapaAberto }}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
              pressed && { opacity: 0.6 },
            ]}>
            <Icon
              name={mapaAberto ? 'chevron-up' : 'map-marker-radius-outline'}
              size="md"
              color={colors.primary}
            />
            <Text variant="bodyStrong" color={colors.primary}>
              {mapaAberto
                ? 'Fechar o mapa'
                : temCoords
                  ? 'Ver no mapa'
                  : 'Ou marque no mapa onde fica'}
            </Text>
          </Pressable>

          {mapaAberto ? (
            <View style={{ marginTop: spacing.sm }}>
              <MapaLocalizacao
                latitude={latitude}
                longitude={longitude}
                selecionavel
                altura={280}
                onEscolher={(lat, lng) => {
                  setLatitude(Number(lat.toFixed(6)));
                  setLongitude(Number(lng.toFixed(6)));
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginTop: spacing.xs,
                }}>
                <Icon
                  name={temCoords ? 'map-marker-check' : 'map-marker-question'}
                  size="sm"
                  color={temCoords ? colors.primary : colors.textMuted}
                />
                <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                  {temCoords
                    ? `Marcado: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                    : 'Toque no mapa para marcar a exploração.'}
                </Text>
                {temCoords ? (
                  <Pressable
                    onPress={() => {
                      setLatitude(undefined);
                      setLongitude(undefined);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar a marca no mapa">
                    <Text variant="bodyStrong" color={colors.danger}>
                      Limpar
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
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
