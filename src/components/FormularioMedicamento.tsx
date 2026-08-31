import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EtiquetaQR } from '@/components/EtiquetaQR';
import { LeitorCodigo } from '@/components/LeitorCodigo';
import {
  Button,
  CampoData,
  Card,
  Chip,
  EcraComTeclado,
  Field,
  Header,
  Icon,
  Text,
  TextField,
} from '@/components/ui';
import { confirmar } from '@/data/avisos';
import { destinoDoCodigo, etiquetaDeLote, type DestinoDoCodigo } from '@/data/codigos';
import { etiquetasImprimiveis, imprimirEtiquetas } from '@/data/etiquetas';
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
  codigoLido,
}: {
  medicamento?: Medicamento;
  exploracaoId: string;
  /**
   * Um código já lido na aba das Existências, que trouxe a pessoa até aqui. É
   * tratado pelo MESMO caminho de uma leitura feita neste ecrã: assim só há uma
   * regra de o que se preenche, em vez de duas a envelhecer em separado.
   */
  codigoLido?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    addMedicamento,
    updateMedicamento,
    deleteMedicamento,
    eventos,
    medicamentos,
    exploracaoById,
  } = useGado();
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
  const [codigoBarras, setCodigoBarras] = useState(medicamento?.codigoBarras ?? '');
  const [leitorAberto, setLeitorAberto] = useState(false);
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

  /**
   * O que a leitura preenche, e sobretudo o que NÃO preenche.
   *
   * O lote e a validade (que só o Data Matrix traz) entram apenas em campo
   * VAZIO. Numa correção, o que já lá está foi escrito por alguém a olhar para
   * o frasco, e uma leitura não tem autoridade para o desfazer sem avisar.
   *
   * A identidade do produto só se copia a CRIAR. Reescrever o nome de um lote
   * já registado porque se apontou a câmara a outra caixa era o caminho mais
   * curto para o registo deixar de dizer a verdade, e o registo de medicamentos
   * é o que se mostra numa inspeção.
   *
   * E nunca entra nada do que muda de frasco para frasco: a quantidade, o custo
   * e a data da compra ficam por preencher de propósito (ver `data/codigos.ts`).
   */
  function aplicarLeitura(destino: DestinoDoCodigo) {
    const { codigo } = destino;
    setCodigoBarras(codigo.chave);
    if (codigo.lote && !lote.trim()) setLote(codigo.lote);
    if (codigo.validade && !validade.trim()) setValidade(formatDataCurta(codigo.validade));

    if (destino.tipo === 'produto' && !editar) {
      const conhecido = destino.produto;
      setNome(conhecido.nome);
      setTipo(conhecido.tipo);
      setUnidade(conhecido.unidade);
      setSeguranca(String(conhecido.intervaloSegurancaDias));
      if (conhecido.fornecedor) setFornecedor(conhecido.fornecedor);
      toast.sucesso(
        t('leitor.reconhecido'),
        t('leitor.reconhecidoTexto', { nome: conhecido.nome }),
      );
      return;
    }

    toast.sucesso(
      t('leitor.lido'),
      codigo.lote ? t('leitor.comLote', { lote: codigo.lote }) : t('leitor.novoTexto'),
    );
  }

  function aoLerCodigo(bruto: string) {
    setLeitorAberto(false);
    const destino = destinoDoCodigo(bruto, medicamentos, exploracaoId);

    /**
     * O código aponta para um frasco JÁ REGISTADO que não é este. É o engano
     * caro desta funcionalidade: dar entrada duas vezes do mesmo frasco põe a
     * arrecadação a dizer que há o dobro do que há, e ninguém dá por isso até
     * faltar medicamento.
     *
     * Pergunta-se em vez de se decidir, porque as duas respostas são legítimas:
     * há quem compre duas caixas do mesmo lote de uma vez. Seja qual for a
     * escolha, o formulário fica preenchido, para quem seguir em frente não
     * voltar à estaca zero.
     */
    if (destino.tipo === 'lote' && destino.medicamento.id !== medicamento?.id) {
      const alvo = destino.medicamento;
      confirmar(
        t('leitor.jaRegistadoTitulo'),
        t('leitor.jaRegistado', { nome: alvo.nome }),
        () => router.replace(`/medicamento/editar/${alvo.id}`),
        { rotuloConfirmar: t('leitor.abrirFicha') },
      );
    }

    aplicarLeitura(destino);
  }

  /**
   * A leitura que veio da aba das Existências, aplicada uma só vez.
   *
   * O `ref` é o que garante esse "uma só vez": sem ele, um render seguinte
   * voltava a escrever por cima do que a pessoa tivesse entretanto corrigido.
   */
  const jaAplicouCodigoDaRota = useRef(false);
  useEffect(() => {
    if (!codigoLido || jaAplicouCodigoDaRota.current) return;
    jaAplicouCodigoDaRota.current = true;
    aoLerCodigo(codigoLido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoLido]);

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
      codigoBarras: codigoBarras.trim() || undefined,
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

  function imprimirEtiqueta() {
    if (!medicamento) return;
    if (imprimirEtiquetas([medicamento], t('etiqueta.titulo'))) {
      toast.sucesso(t('etiqueta.aImprimir'), t('etiqueta.nEtiquetas', { n: 1 }));
    } else {
      toast.erro(t('etiqueta.semJanelaTitulo'), t('etiqueta.semJanela'));
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

        {/* O caminho que poupa escrever fica em CIMA de tudo. Um botão no fim
            do formulário chegava depois de a pessoa já ter escrito o que ele
            existe para evitar, e ninguém volta atrás para o usar. */}
        <Card padded style={{ marginBottom: spacing.md }}>
          {codigoBarras ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                marginBottom: spacing.sm,
              }}>
              <Icon name="barcode-scan" size="lg" color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t('formLote.codigoGuardado')}</Text>
                <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                  {codigoBarras}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setCodigoBarras('');
                  toast.sucesso(t('formLote.codigoTirado'), t('formLote.lerCodigo'));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('formLote.tirarCodigo')}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: spacing.xs })}>
                <Icon name="close-circle-outline" size="md" color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <Button
            label={codigoBarras ? t('formLote.lerOutro') : t('formLote.lerCodigo')}
            icon="barcode-scan"
            variant="secondary"
            onPress={() => setLeitorAberto(true)}
          />
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            {t('formLote.lerCodigoAjuda')}
          </Text>
        </Card>
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

        {/* A etiqueta só existe a EDITAR, e não é limitação: antes de guardar
            o lote ainda não tem identificador, e um QR que aponta para um lote
            que pode nunca chegar a existir é papel deitado fora. */}
        {editar ? (
          <Card padded style={{ marginBottom: spacing.md }}>
            <Text variant="h3" style={{ marginBottom: spacing.xs }}>
              {t('etiqueta.titulo')}
            </Text>
            <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              {t('etiqueta.ajuda')}
            </Text>
            <EtiquetaQR
              texto={etiquetaDeLote(medicamento.id)}
              legenda={lote.trim() ? `${nome} · ${lote.trim()}` : nome}
            />
            {etiquetasImprimiveis ? (
              <View style={{ marginTop: spacing.md }}>
                <Button
                  label={t('etiqueta.imprimir')}
                  icon="printer"
                  variant="secondary"
                  onPress={imprimirEtiqueta}
                />
              </View>
            ) : null}
          </Card>
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

      <LeitorCodigo
        aberto={leitorAberto}
        titulo={t('leitor.titulo')}
        ajuda={t('leitor.ajuda')}
        onLer={aoLerCodigo}
        onFechar={() => setLeitorAberto(false)}
      />
    </EcraComTeclado>
  );
}
