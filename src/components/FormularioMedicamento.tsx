import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  CampoData,
  Chip,
  EcraComTeclado,
  Field,
  Header,
  Icon,
  Text,
  TextField,
} from '@/components/ui';
import { confirmar } from '@/data/avisos';
import { tiposMedicamento, unidadesMedicamento } from '@/data/constants';
import {
  diaIso,
  formatDataCurta,
  formatDataPt,
  paraEuro,
  parseDataPt,
} from '@/data/helpers';
import { estadoDoLote, formatQuantidade } from '@/data/medicamentos';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useFinancas } from '@/data/useFinancas';
import type { Medicamento, TipoMedicamento } from '@/data/types';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing } from '@/theme';

/** Converte "20,5" num número; undefined se vazio, NaN se inválido. */
function paraNumero(txt: string): number | undefined {
  const t = txt.trim().replace(',', '.');
  if (!t) return undefined;
  return Number(t);
}

/**
 * Dar entrada (ou corrigir) um lote na arrecadação.
 *
 * O que se pede é o que a lei quer no registo de medicamentos: produto, lote,
 * validade, quantidade e fornecedor. Tudo o resto é opcional — a folha tem de
 * poder ser preenchida em pé, com o frasco na outra mão.
 */
export function FormularioMedicamento({
  medicamento,
  exploracaoId,
}: {
  medicamento?: Medicamento;
  exploracaoId: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addMedicamento, updateMedicamento, deleteMedicamento, eventos, exploracaoById } =
    useGado();
  const { pode } = useMembros();
  const { podeRegistarDespesa } = useFinancas(exploracaoId);
  const toast = useToasts();

  const editar = !!medicamento;
  const podeGerir = pode(exploracaoId, 'editarAnimais');
  const podeEliminar = pode(exploracaoId, 'eliminarAnimais');

  const [nome, setNome] = useState(medicamento?.nome ?? '');
  const [tipo, setTipo] = useState<TipoMedicamento>(medicamento?.tipo ?? 'Medicamento');
  const [lote, setLote] = useState(medicamento?.lote ?? '');
  const [validade, setValidade] = useState(
    medicamento?.validade ? formatDataCurta(medicamento.validade) : '',
  );
  const [quantidade, setQuantidade] = useState(
    medicamento ? String(medicamento.quantidade).replace('.', ',') : '',
  );
  const [unidade, setUnidade] = useState(medicamento?.unidade ?? 'ml');
  const [seguranca, setSeguranca] = useState(
    String(medicamento?.intervaloSegurancaDias ?? 0),
  );
  const [fornecedor, setFornecedor] = useState(medicamento?.fornecedor ?? '');
  const [custo, setCusto] = useState(
    medicamento?.custo != null ? String(medicamento.custo).replace('.', ',') : '',
  );
  const [dataCompra, setDataCompra] = useState(
    formatDataCurta(medicamento?.dataCompra ?? new Date().toISOString()),
  );
  const [notas, setNotas] = useState(medicamento?.notas ?? '');
  const [aGravar, setAGravar] = useState(false);
  const [erroGuardar, setErroGuardar] = useState<string | null>(null);

  const exploracao = exploracaoById(exploracaoId);

  // A validade é o único campo de data que aponta para o FUTURO — e é a razão
  // de ser do `permitirFuturo`. Sem ele, escrever a validade de um frasco
  // comprado hoje era sempre "data inválida".
  const validadeIso = validade.trim() ? parseDataPt(validade, { permitirFuturo: true }) : null;
  const validadeInvalida = validade.trim().length > 0 && !validadeIso;
  const compraIso = parseDataPt(dataCompra);
  const compraInvalida = !compraIso;

  const quantidadeNum = paraNumero(quantidade);
  const segurancaNum = paraNumero(seguranca) ?? 0;
  const custoNum = custo.trim() ? paraEuro(custo) : undefined;

  const valido =
    nome.trim().length > 0 &&
    quantidadeNum != null &&
    Number.isFinite(quantidadeNum) &&
    quantidadeNum > 0 &&
    Number.isFinite(segurancaNum) &&
    segurancaNum >= 0 &&
    !validadeInvalida &&
    !compraInvalida;

  // O que já saiu deste lote — só na edição. É o que impede corrigir a
  // quantidade para menos do que já foi administrado sem dar por isso.
  const jaUsado = medicamento ? estadoDoLote(medicamento, eventos).usado : 0;
  const quantidadeAbaixoDoUsado =
    editar && quantidadeNum != null && Number.isFinite(quantidadeNum) && quantidadeNum < jaUsado;

  /**
   * Lançar a despesa junto com a entrada só faz sentido a criar: numa correção
   * o dinheiro já foi lançado da primeira vez, e repeti-lo duplicava a despesa
   * sem ninguém pedir.
   */
  const podeLancarDespesa = !editar && podeRegistarDespesa;
  const [lancarDespesa, setLancarDespesa] = useState(true);

  async function guardar() {
    if (!valido || aGravar) return;
    setErroGuardar(null);
    setAGravar(true);
    const dados = {
      exploracaoId,
      nome: nome.trim(),
      tipo,
      lote: lote.trim() || undefined,
      validade: validadeIso ? diaIso(validadeIso) : undefined,
      quantidade: quantidadeNum!,
      unidade,
      intervaloSegurancaDias: Math.round(segurancaNum),
      fornecedor: fornecedor.trim() || undefined,
      custo: custoNum != null && Number.isFinite(custoNum) && custoNum > 0 ? custoNum : undefined,
      dataCompra: diaIso(compraIso!),
      notas: notas.trim() || undefined,
    };

    try {
      if (editar) {
        await updateMedicamento(medicamento.id, dados);
        toast.sucesso(t('formLote.guardado'), dados.nome);
      } else {
        const comDespesa = podeLancarDespesa && lancarDespesa && dados.custo != null;
        await addMedicamento(dados, { lancarDespesa: comDespesa });
        toast.sucesso(
          t('formLote.entradaRegistada'),
          comDespesa
            ? `${dados.nome} · ${t('formLote.despesaLancada')}`
            : `${dados.nome} · ${formatQuantidade(dados.quantidade, dados.unidade)}`,
        );
      }
      router.back();
    } catch (e) {
      // Fica no ecrã com a razão à vista: ao contrário de quase tudo o resto,
      // aqui há dados escritos à mão que se perdiam se a app voltasse atrás.
      setErroGuardar(mensagemDeErro(e));
    } finally {
      setAGravar(false);
    }
  }

  function eliminar() {
    if (!medicamento) return;
    confirmar(
      t('formLote.eliminarLote'),
      jaUsado > 0
        ? t('formLote.eliminarComUso', { usado: formatQuantidade(jaUsado, medicamento.unidade) })
        : t('comum.semVoltaAtras'),
      () => {
        void (async () => {
          try {
            await deleteMedicamento(medicamento.id);
            toast.sucesso(t('formLote.eliminado'), medicamento.nome);
            router.back();
          } catch (e) {
            toast.erro(t('comum.semEliminar'), mensagemDeErro(e));
          }
        })();
      },
      { rotuloConfirmar: t('comum.eliminar'), destrutivo: true },
    );
  }

  if (!podeGerir) {
    return (
      <EcraComTeclado>
        <Header title={editar ? t('formLote.lote') : t('existencias.darEntrada')} />
        <View style={{ padding: spacing.lg }}>
          <Text variant="h3">{t('formLote.semPermissaoTitulo')}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
            {t('formLote.semPermissao')}
          </Text>
        </View>
      </EcraComTeclado>
    );
  }

  return (
    <EcraComTeclado>
      <Header title={editar ? t('formLote.lote') : t('existencias.darEntrada')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.huge * 2,
        }}>
        {exploracao ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
            {exploracao.nome}
          </Text>
        ) : null}

        <Field label={t('formTerreno.tipo')} obrigatorio>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {tiposMedicamento.map((t) => (
              <Chip key={t} label={t} selected={tipo === t} onPress={() => setTipo(t)} />
            ))}
          </View>
        </Field>

        <Field label={t('formLote.nomeProduto')} obrigatorio>
          <TextField
            value={nome}
            onChangeText={setNome}
            placeholder={t('formLote.exNome')}
            icon={tipo === 'Vacina' ? 'needle' : 'medical-bag'}
          />
        </Field>

        <Field label={t('formLote.lote')} opcional>
          <TextField
            value={lote}
            onChangeText={setLote}
            placeholder={t('formLote.exLote')}
            icon="barcode"
            autoCapitalize="characters"
          />
          {/* O lote é o que a lei quer rastreado, mas não se inventa: um frasco
              sem lote visível regista-se na mesma, e é melhor tê-lo sem lote do
              que não o ter. */}
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            {t('formLote.loteAjuda')}
          </Text>
        </Field>

        <Field label={t('formLote.validade')} opcional>
          <CampoData
            value={validade}
            onChangeText={setValidade}
            placeholder={t('formLote.exValidade')}
            rotuloCalendario={t('formLote.calendarioValidade')}
            permitirFuturo
          />
          {validadeInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              {t('formAnimal.dataInvalida')}
            </Text>
          ) : validadeIso ? (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
              A app avisa 30 dias antes de {formatDataPt(validadeIso)}.
            </Text>
          ) : null}
        </Field>

        <Field label={t('formLote.quantidade')} obrigatorio>
          <TextField
            value={quantidade}
            onChangeText={setQuantidade}
            placeholder={t('formLote.exQuantidade')}
            icon="beaker-outline"
            keyboardType="decimal-pad"
          />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: spacing.xs,
              marginTop: spacing.xs,
            }}>
            {unidadesMedicamento.map((u) => (
              <Chip key={u} label={u} selected={unidade === u} onPress={() => setUnidade(u)} />
            ))}
          </View>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            {t('formLote.quantidadeAjuda')}
          </Text>
          {quantidadeAbaixoDoUsado ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              {t('formLote.quantidadeAbaixo', { usado: formatQuantidade(jaUsado, unidade) })}
            </Text>
          ) : null}
        </Field>

        <Field label={t('evento.intervaloSeguranca')} opcional>
          <TextField
            value={seguranca}
            onChangeText={setSeguranca}
            placeholder={t('formLote.exSeguranca')}
            icon="clock-alert-outline"
            keyboardType="number-pad"
          />
          {/* É a razão de ser de metade disto: o formulário do tratamento
              passa a propor este número sozinho, e é ele que impede vender
              para abate um animal ainda dentro do prazo. */}
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
            {t('formLote.segurancaAjuda')}
          </Text>
        </Field>

        <Field label={t('formLote.fornecedor')} opcional>
          <TextField
            value={fornecedor}
            onChangeText={setFornecedor}
            placeholder={t('formLote.exFornecedor')}
            icon="storefront-outline"
            autoCapitalize="words"
          />
        </Field>

        <Field label={t('formLote.dataCompra')} obrigatorio>
          <CampoData
            value={dataCompra}
            onChangeText={setDataCompra}
            placeholder={t('formLote.exDataCompra')}
            rotuloCalendario={t('formLote.calendarioCompra')}
          />
          {compraInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              {t('formAnimal.dataInvalidaNaoFutura')}
            </Text>
          ) : null}
        </Field>

        {podeRegistarDespesa ? (
          <Field label={t('formLote.custoTotal')} opcional>
            <TextField
              value={custo}
              onChangeText={setCusto}
              placeholder={t('formLote.exCusto')}
              icon="cash"
              keyboardType="decimal-pad"
            />
            {podeLancarDespesa && custoNum != null && Number.isFinite(custoNum) && custoNum > 0 ? (
              <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
                <Chip
                  label={
                    lancarDespesa
                      ? t('formLote.lancaDespesa')
                      : t('formLote.naoLancaDespesa')
                  }
                  selected={lancarDespesa}
                  onPress={() => setLancarDespesa((v) => !v)}
                />
              </View>
            ) : null}
          </Field>
        ) : null}

        <Field label={t('evento.notas')} opcional>
          <TextField
            value={notas}
            onChangeText={setNotas}
            placeholder={t('evento.exNotas')}
            icon="note-text-outline"
            multiline
          />
        </Field>

        {erroGuardar ? (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.xs,
              backgroundColor: colors.dangerTint,
              borderRadius: radii.md,
              padding: spacing.sm,
              marginBottom: spacing.md,
            }}>
            <Icon name="alert-circle-outline" size="md" color={colors.danger} />
            <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
              {erroGuardar}
            </Text>
          </View>
        ) : null}

        {editar && podeEliminar ? (
          <Button
            label={t('formLote.eliminarLote')}
            icon="trash-can-outline"
            variant="danger"
            onPress={eliminar}
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
          label={aGravar ? 'A guardar…' : editar ? 'Guardar alterações' : 'Registar entrada'}
          icon="check"
          loading={aGravar}
          onPress={() => void guardar()}
          disabled={!valido || aGravar}
        />
      </View>
    </EcraComTeclado>
  );
}
