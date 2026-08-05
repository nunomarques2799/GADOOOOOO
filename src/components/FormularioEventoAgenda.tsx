import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';

import {
  Button,
  CampoData,
  CampoHora,
  Card,
  Chip,
  EcraComTeclado,
  EmptyState,
  Field,
  Header,
  Icon,
  Text,
  TextField,
} from '@/components/ui';
import { HORAS_SUGERIDAS } from '@/data/acessoTemporario';
import { problemaComEvento, type EntradaEvento, type EventoAgenda } from '@/data/agenda';
import { confirmar } from '@/data/avisos';
import { chaveDia } from '@/data/calendario';
import { formatDataCurta, parseDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { colors, radii, spacing } from '@/theme';

/**
 * Marcar (ou alterar) um evento da agenda.
 * ------------------------------------------------------------------
 * Um evento é quatro perguntas: o que é, quando, a que horas — se a hora
 * interessar — e quem o vê. Nada mais. O que faz falta a uma feira de gado é
 * caber num ecrã sem se rolar, escrito com o polegar, à porta do curral.
 *
 * A gravação é PESSIMISTA (ver o cabeçalho de `data/agenda.ts`): sem rede não
 * grava, e diz-o. Ao contrário dos animais e das despesas, isto não entra na
 * fila de sincronização — e um evento que se julgou marcado e não existe na
 * véspera da feira é pior do que um "isto precisa de ligação".
 */
export function FormularioEventoAgenda({
  evento,
  diaInicial,
  exploracaoInicial,
  guardarEvento,
  eliminarEvento,
}: {
  /** A editar. Ausente = a marcar de novo. */
  evento?: EventoAgenda;
  /** O dia com que o formulário abre (`aaaa-mm-dd`). Ausente = hoje. */
  diaInicial?: string;
  exploracaoInicial?: string;
  guardarEvento: (entrada: EntradaEvento) => Promise<EventoAgenda>;
  eliminarEvento: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const { exploracoes } = useGado();
  const { pode, podeEmAlguma } = useMembros();
  const toast = useToasts();

  const editar = !!evento;

  // Só as explorações onde esta pessoa pode mesmo marcar. Sem o filtro, o
  // veterinário que chegasse aqui por um link escolhia uma exploração da lista
  // e batia contra a RLS no Guardar.
  const disponiveis = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'marcarEventos')),
    [exploracoes, pode],
  );

  const [exploracaoId, setExploracaoId] = useState<string | undefined>(
    () =>
      evento?.exploracaoId
      ?? (exploracaoInicial && disponiveis.some((e) => e.id === exploracaoInicial)
        ? exploracaoInicial
        : disponiveis[0]?.id),
  );
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [descricao, setDescricao] = useState(evento?.descricao ?? '');
  const [dia, setDia] = useState(() =>
    formatDataCurta(diaParaIso(evento?.dia ?? diaInicial ?? chaveDia(new Date()))),
  );
  const [comHora, setComHora] = useState(!!evento?.hora);
  const [hora, setHora] = useState(evento?.hora ?? '09:00');
  const [publico, setPublico] = useState(evento?.publico ?? true);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const diaIso = parseDataPt(dia, { permitirFuturo: true });
  const problema = problemaComEvento(titulo, diaIso, comHora ? hora : '');

  async function guardar() {
    if (aGravar) return;
    if (problema) {
      setErro(problema);
      return;
    }
    if (!exploracaoId) {
      setErro('Escolha a exploração a que este evento pertence.');
      return;
    }
    setAGravar(true);
    setErro(null);
    try {
      await guardarEvento({
        id: evento?.id,
        exploracaoId,
        titulo,
        descricao,
        // A data vem do campo em português; a coluna quer `aaaa-mm-dd`. O
        // `parseDataPt` devolve um ISO completo, e é o `chaveDia` (hora LOCAL)
        // que o corta — cortar a string do ISO usava UTC e passava um evento
        // das 23h de dia 3 para dia 4 no verão.
        dia: chaveDia(diaIso as string),
        hora: comHora ? hora : undefined,
        publico,
      });
      toast.sucesso(editar ? 'Evento guardado' : 'Evento marcado', titulo.trim());
      router.back();
    } catch (e) {
      const razao = mensagemDeErro(e);
      setErro(razao);
      toast.erro(editar ? 'Evento não guardado' : 'Evento não marcado', razao);
    } finally {
      setAGravar(false);
    }
  }

  function eliminar() {
    if (!evento) return;
    confirmar(
      'Eliminar evento',
      `Vai apagar "${evento.titulo}" do calendário. Não apaga mais nada.`,
      () => {
        void (async () => {
          try {
            await eliminarEvento(evento.id);
            toast.sucesso('Evento eliminado', evento.titulo);
            router.back();
          } catch (e) {
            toast.erro('Não foi possível eliminar', mensagemDeErro(e));
          }
        })();
      },
      { rotuloConfirmar: 'Eliminar', destrutivo: true },
    );
  }

  // Quem não marca eventos em exploração nenhuma. A rota existe (o botão já não
  // aparece), e sem isto o veterinário que lá chegasse por um link preenchia o
  // formulário todo para o servidor o recusar no fim.
  if (!podeEmAlguma('marcarEventos')) {
    return (
      <EcraComTeclado>
        <Header title={editar ? 'Editar evento' : 'Novo evento'} />
        <EmptyState
          icon="lock-outline"
          title="O calendário é de quem trabalha na exploração"
          message="Marcar eventos é de quem tem a exploração a cargo e de quem lá trabalha todos os dias. Pode continuar a registar o que fizer a cada animal."
        />
      </EcraComTeclado>
    );
  }

  if (disponiveis.length === 0) {
    return (
      <EcraComTeclado>
        <Header title="Novo evento" />
        <EmptyState
          icon="barn"
          title="Sem explorações"
          message="Os eventos pertencem a uma exploração. Crie primeiro a sua."
        />
      </EcraComTeclado>
    );
  }

  return (
    <EcraComTeclado>
      <Header title={editar ? 'Editar evento' : 'Novo evento'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          O que aí vem: a feira, a entrega da ração, o dia de carregar. Fica no calendário
          do Início.
        </Text>

        <Field label="O que é" obrigatorio>
          <TextField
            value={titulo}
            onChangeText={setTitulo}
            placeholder="Ex: Feira de Idanha"
            icon="calendar-text-outline"
          />
        </Field>

        <Field label="Dia" obrigatorio>
          <CampoData
            value={dia}
            onChangeText={setDia}
            placeholder="dd/mm/aaaa"
            permitirFuturo
            rotuloCalendario="Escolher o dia do evento"
          />
        </Field>

        {/* A hora é opcional e por isso vem atrás de um interruptor: "dia 12 há
            feira" é um evento completo, e um campo de hora sempre à vista
            convidava a pôr lá 00:00 só para o preencher. */}
        <Field label="Horas">
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon
                name={comHora ? 'clock-outline' : 'calendar-today'}
                size="md"
                color={comHora ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{comHora ? 'A uma hora certa' : 'Todo o dia'}</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  {comHora
                    ? 'O calendário mostra a hora ao lado do evento.'
                    : 'Sem hora marcada — aparece no topo do dia.'}
                </Text>
              </View>
              <Switch
                value={comHora}
                onValueChange={setComHora}
                accessibilityLabel="Marcar uma hora"
                trackColor={{ false: colors.borderStrong, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            {comHora ? (
              <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                <CampoHora value={hora} onChangeText={setHora} rotuloRelogio="Escolher a hora" />
                <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                  {HORAS_SUGERIDAS.map((h) => (
                    <Chip key={h} label={h} selected={hora === h} onPress={() => setHora(h)} />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        </Field>

        {/* Quem vê. Duas opções escritas por extenso e não um interruptor com
            "público" ao lado: o que muda é quem lê aquilo, e essa é a decisão
            que não pode ficar por perceber. */}
        <Field label="Quem vê">
          <View style={{ gap: spacing.sm }}>
            <OpcaoVisibilidade
              icone="account-group"
              titulo="Toda a equipa"
              descricao="Quem trabalha nesta exploração vê este evento no calendário."
              escolhida={publico}
              onPress={() => setPublico(true)}
            />
            <OpcaoVisibilidade
              icone="lock-outline"
              titulo="Só eu"
              descricao="Fica guardado na sua conta. Mais ninguém o vê, nem o dono da exploração."
              escolhida={!publico}
              onPress={() => setPublico(false)}
            />
          </View>
        </Field>

        {disponiveis.length > 1 ? (
          <Field label="Exploração" obrigatorio>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
              {disponiveis.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nome}
                  icon="barn"
                  selected={exploracaoId === e.id}
                  onPress={() => setExploracaoId(e.id)}
                />
              ))}
            </View>
          </Field>
        ) : null}

        <Field label="Notas" opcional ajuda="O que mais precisar de ter à mão nesse dia.">
          <TextInput
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: levar a guia de circulação e os brincos de substituição"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={{
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: radii.md,
              backgroundColor: colors.surface,
              padding: spacing.md,
              minHeight: 100,
              fontFamily: 'Nunito_500Medium',
              fontSize: 16,
              color: colors.text,
            }}
          />
        </Field>

        {erro ? (
          <Card style={{ backgroundColor: colors.dangerTint, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Icon name="alert-circle-outline" size="md" color={colors.danger} />
              <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                {erro}
              </Text>
            </View>
          </Card>
        ) : null}

        <Button
          label={aGravar ? 'A guardar…' : editar ? 'Guardar' : 'Marcar evento'}
          icon="check"
          onPress={() => void guardar()}
          loading={aGravar}
          disabled={aGravar}
        />

        {editar ? (
          <Button
            label="Eliminar evento"
            icon="trash-can-outline"
            variant="danger"
            onPress={eliminar}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </ScrollView>
    </EcraComTeclado>
  );
}

/**
 * `aaaa-mm-dd` para o ISO completo que o `formatDataCurta` espera.
 *
 * Passa pelo construtor com ano/mês/dia separados e não por `new Date(iso)`:
 * essa lê "2026-08-03" como meia-noite UTC e, a oeste de Greenwich, devolvia
 * dia 2.
 */
function diaParaIso(dia: string): string {
  const [ano, mes, d] = dia.split('-').map(Number);
  return new Date(ano, (mes ?? 1) - 1, d ?? 1).toISOString();
}

function OpcaoVisibilidade({
  icone,
  titulo,
  descricao,
  escolhida,
  onPress,
}: {
  icone: 'account-group' | 'lock-outline';
  titulo: string;
  descricao: string;
  escolhida: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhida }}
      accessibilityLabel={`${titulo}. ${descricao}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radii.md,
          borderWidth: escolhida ? 2 : 1,
          borderColor: escolhida ? colors.primary : colors.border,
          backgroundColor: escolhida ? colors.primaryTint : colors.surface,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icone} size="md" color={escolhida ? colors.primaryDark : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={escolhida ? colors.primaryDark : colors.text}>
          {titulo}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {descricao}
        </Text>
      </View>
      <Icon
        name={escolhida ? 'check-circle' : 'circle-outline'}
        size="md"
        color={escolhida ? colors.primary : colors.textMuted}
      />
    </Pressable>
  );
}
