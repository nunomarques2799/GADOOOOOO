import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeletorAnimais } from '@/components/SeletorAnimais';
import {
  Button,
  CampoData,
  Chip,
  EcraComTeclado,
  EmptyState,
  Header,
  Icon,
  type IconName,
  Screen,
  Text,
} from '@/components/ui';
import { carregarHistoricoDe, frase, type Atividade } from '@/data/atividade';
import { avisar, confirmar } from '@/data/avisos';
import {
  formatDataCurta,
  formatDataHora,
  formatDataPt,
  formatEuro,
  isoDaysAgo,
  paraEuro,
  parseDataPt,
} from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useFinancas } from '@/data/useFinancas';
import type { CategoriaDespesa, CategoriaReceita, Direcao, Movimento } from '@/data/types';
import { t, type ChaveTexto } from '@/i18n';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/**
 * Ordem pensada para quem regista, não por alfabeto: a alimentação é o que
 * aparece mais vezes numa exploração de gado, por isso vem primeiro e poupa
 * um scroll em quase todos os registos.
 */
const CATEGORIAS_DESPESA: { valor: CategoriaDespesa; icon: IconName }[] = [
  { valor: 'Alimentação', icon: 'silo' },
  { valor: 'Sanidade', icon: 'needle' },
  { valor: 'Energia e combustível', icon: 'lightning-bolt' },
  { valor: 'Água', icon: 'water' },
  { valor: 'Rendas e terrenos', icon: 'file-document-outline' },
  { valor: 'Máquinas e reparações', icon: 'wrench-outline' },
  { valor: 'Mão-de-obra', icon: 'account-hard-hat' },
  { valor: 'Taxas e seguros', icon: 'shield-check-outline' },
  { valor: 'Compra de animais', icon: 'cart-outline' },
  { valor: 'Outras despesas', icon: 'dots-horizontal' },
];

const CATEGORIAS_RECEITA: { valor: CategoriaReceita; icon: IconName }[] = [
  { valor: 'Venda de animais', icon: 'cash-plus' },
  { valor: 'Leite e produtos', icon: 'bottle-soda-outline' },
  { valor: 'Apoios e subsídios', icon: 'hand-coin-outline' },
  { valor: 'Outras receitas', icon: 'dots-horizontal' },
];

/** Atalhos da data. Guardam a CHAVE, e quem desenha é que traduz. */
const opcoesData: { chave: ChaveTexto; dias: number }[] = [
  { chave: 'formAnimal.hoje', dias: 0 },
  { chave: 'formAnimal.ontem', dias: 1 },
  { chave: 'formAnimal.ha1Semana', dias: 7 },
  { chave: 'formMovimento.ha1Mes', dias: 30 },
];

/**
 * Formulário de despesa/receita — o mesmo para registar e para corrigir.
 * ------------------------------------------------------------------
 * Com `movimento`, edita; sem ele, cria. É a mesma decisão que já valia para o
 * animal, a exploração e o terreno (ver `FormularioAnimal` e companhia): dois
 * ecrãs quase iguais eram a garantia de que uma correção feita num deles não
 * chegava ao outro.
 *
 * A EXPLORAÇÃO NÃO SE MUDA NA EDIÇÃO. Passar um lançamento de uma quinta para
 * a outra não é corrigir um erro de escrita — é tirar dinheiro de umas contas e
 * pô-lo noutras, e a RLS avalia a permissão sobre a linha ANTIGA. Quem se
 * enganou na exploração elimina e volta a lançar, que é o que deixa rasto.
 */
export function FormularioMovimento({
  movimento,
  direcaoInicial,
  exploracaoIdInicial,
  animalIdInicial,
}: {
  movimento?: Movimento;
  direcaoInicial?: Direcao;
  exploracaoIdInicial?: string;
  animalIdInicial?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    utilizador, exploracoes, animais, terrenos, addMovimento, updateMovimento, deleteMovimento,
  } = useGado();
  const { pode } = useMembros();
  const toast = useToasts();

  const editar = !!movimento;

  const [exploracaoId, setExploracaoId] = useState<string | undefined>(
    movimento?.exploracaoId ?? exploracaoIdInicial ?? (exploracoes.length === 1 ? exploracoes[0].id : undefined),
  );
  const [direcao, setDirecao] = useState<Direcao>(
    movimento?.direcao ?? (direcaoInicial === 'receita' ? 'receita' : 'despesa'),
  );
  const [categoria, setCategoria] = useState<string>(movimento?.categoria ?? 'Alimentação');
  const [valor, setValor] = useState(movimento ? String(movimento.valor).replace('.', ',') : '');
  const [descricao, setDescricao] = useState(movimento?.descricao ?? '');
  const [contraparte, setContraparte] = useState(movimento?.contraparte ?? '');
  const [diasAtras, setDiasAtras] = useState(0);
  // Data escrita à mão / escolhida no calendário. Uma fatura de ração ou uma
  // venda podem ser de qualquer dia, não só dos atalhos recentes. Na edição
  // começa preenchida com a data que lá está — senão, abrir para corrigir o
  // valor e gravar mudava a data do lançamento para hoje, sem aviso.
  //
  // `formatDataCurta` e NÃO `formatDataPt`: o campo é dd/mm/aaaa, e o segundo
  // devolve "29 jul 2026" — que o `parseDataPt` não sabe ler. O ecrã abria com
  // "Data inválida" a vermelho por baixo de uma data que estava certa, e o
  // botão de guardar desativado.
  const [dataManual, setDataManual] = useState(
    movimento ? formatDataCurta(movimento.data) : '',
  );
  const [animalId, setAnimalId] = useState<string | undefined>(movimento?.animalId ?? animalIdInicial);
  const [terrenoId, setTerrenoId] = useState<string | undefined>(movimento?.terrenoId);
  const [aGravar, setAGravar] = useState(false);

  const {
    ativas,
    podeRegistarReceita: podeReceita,
    podeRegistarDespesa: podeDespesa,
  } = useFinancas(exploracaoId);

  /**
   * É o dono desta exploração?
   *
   * `editarExploracao` como pergunta: é a única capacidade que só o admin tem e
   * que o dono NÃO pode passar a mais ninguém (ver `CAPACIDADES_GERIVEIS`),
   * portanto é a que espelha de perto o `role_em(...) = 'admin'` das políticas
   * `movimento_update`/`movimento_delete`. Em modo local devolve true, que é o
   * certo: aí quem está no aparelho é o dono.
   */
  const souDono = pode(exploracaoId, 'editarExploracao');
  const souAutor = !movimento?.criadoPor || movimento.criadoPor === utilizador.id;

  /**
   * Corrigir é do dono e de quem lançou. Espelha `movimento_update`: o
   * trabalhador corrige o que lançou (o 450 € que era 45 €) e mais nada.
   */
  const podeEditar = !editar || souDono || (souAutor && podeDespesa);
  /** Apagar dinheiro da conta é só do dono — política `movimento_delete`. */
  const podeEliminar = editar && souDono;

  // Um trabalhador não lança receitas: se a exploração escolhida não lho
  // permite, o formulário volta a despesa em vez de o deixar preencher tudo
  // para o servidor recusar no fim — e, offline, só na sincronização seguinte.
  const direcaoEfetiva: Direcao = direcao === 'receita' && !podeReceita ? 'despesa' : direcao;

  const categorias = direcaoEfetiva === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
  const categoriaValida = categorias.some((c) => c.valor === categoria)
    ? categoria
    : categorias[0].valor;

  // A data escrita à mão manda sobre os atalhos; `parseDataPt` recusa o futuro,
  // que é o certo — um movimento regista o que já aconteceu.
  const dataManualIso = dataManual.trim() ? parseDataPt(dataManual) : null;
  const dataManualInvalida = dataManual.trim().length > 0 && !dataManualIso;
  const data = dataManualIso ?? isoDaysAgo(diasAtras);
  const valorNum = paraEuro(valor);

  const animaisDaExploracao = useMemo(
    () =>
      animais
        .filter((a) => a.exploracaoId === exploracaoId)
        .sort((a, b) =>
          (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(
            b.nome ?? b.numeroIdentificacao ?? '',
          ),
        ),
    [animais, exploracaoId],
  );
  const terrenosDaExploracao = useMemo(
    () => terrenos.filter((t) => t.exploracaoId === exploracaoId),
    [terrenos, exploracaoId],
  );

  const valido =
    !!exploracaoId &&
    podeEditar &&
    !dataManualInvalida &&
    Number.isFinite(valorNum) &&
    valorNum > 0 &&
    descricao.trim().length > 0 &&
    (direcaoEfetiva === 'receita' ? podeReceita : podeDespesa);

  async function guardar() {
    if (!exploracaoId || !valido || aGravar) return;
    setAGravar(true);
    const dados = {
      direcao: direcaoEfetiva,
      categoria: categoriaValida as CategoriaDespesa | CategoriaReceita,
      valor: valorNum,
      data,
      descricao: descricao.trim(),
      contraparte: contraparte.trim() || undefined,
      animalId,
      terrenoId,
    };
    try {
      if (movimento) await updateMovimento(movimento.id, dados);
      else await addMovimento({ ...dados, exploracaoId });

      toast.sucesso(
        editar
          ? t('formMovimento.guardado')
          : direcaoEfetiva === 'receita'
            ? t('formMovimento.receitaRegistada')
            : t('formMovimento.despesaRegistada'),
        `${formatEuro(valorNum)} · ${descricao.trim()}`,
      );
      // `back()` sozinho não chega: quem abre este ecrã por link direto (a app
      // instalada, um atalho) não tem histórico para onde voltar, e o botão
      // ficava preso em "A gravar…" com o movimento já gravado.
      if (router.canGoBack()) router.back();
      else router.replace('/financas');
    } catch (e) {
      // A recusa vem do servidor (RLS) e tem de aparecer: o movimento já foi
      // mostrado como gravado, e desaparecer em silêncio é o pior dos casos.
      toast.erro(
        editar
          ? t('formMovimento.semGuardar')
          : direcaoEfetiva === 'receita'
            ? t('formMovimento.receitaSemRegistar')
            : t('formMovimento.despesaSemRegistar'),
        mensagemDeErro(e),
      );
      setAGravar(false);
    }
  }

  function confirmarEliminar() {
    if (!movimento) return;
    // Não se sai do ecrã antes de saber o resultado: a lista já tirou o
    // lançamento do saldo, e se o servidor recusar é a sincronização seguinte
    // que o traz de volta — sem uma palavra a explicar porquê.
    const executar = async () => {
      try {
        await deleteMovimento(movimento.id);
        toast.sucesso(t('formMovimento.eliminado'), `${formatEuro(movimento.valor)} · ${movimento.descricao}`);
        if (router.canGoBack()) router.back();
        else router.replace('/financas');
      } catch (e) {
        avisar(t('comum.semEliminar'), mensagemDeErro(e));
      }
    };
    confirmar(
      t('formMovimento.eliminarMovimento'),
      `Vai apagar ${formatEuro(movimento.valor)} ("${movimento.descricao}") das contas da `
        + 'exploração. O saldo muda. Fica registado quem o apagou, mas o lançamento em si não '
        + 'se recupera.',
      () => void executar(),
      { rotuloConfirmar: t('comum.eliminar'), destrutivo: true },
    );
  }

  const corDirecao = direcaoEfetiva === 'receita' ? colors.success : colors.danger;
  const nomeExploracao = exploracoes.find((e) => e.id === exploracaoId)?.nome;

  // Alcançável por link direto (a app instalada guarda URLs) mesmo depois de o
  // dono desligar a gestão financeira. Sem esta guarda, o formulário abria e a
  // gravação só falhava no fim — ou, offline, na sincronização seguinte.
  if (!ativas) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('financas.registarMovimento')} />
        <Screen>
          <EmptyState
            icon="cash-off"
            title={t('financas.desligadaTitulo')}
            message={t('financas.desligadaMensagem')}
          />
        </Screen>
      </View>
    );
  }

  if (editar && !podeEditar) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('formMovimento.movimento')} />
        <Screen>
          <EmptyState
            icon="lock-outline"
            title={t('formMovimento.naoESeuTitulo')}
            message={t('formMovimento.naoESeuMensagem')}
          />
        </Screen>
      </View>
    );
  }

  return (
    <EcraComTeclado>
      <Header
        title={
          editar
            ? t('formMovimento.editar')
            : direcaoEfetiva === 'receita'
              ? t('formMovimento.registarReceita')
              : t('financas.registarDespesa')
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.huge * 2,
        }}>
        {/* Exploração — só se houver mais do que uma, e nunca na edição
            (ver o cabeçalho deste ficheiro). */}
        {editar ? (
          exploracoes.length > 1 ? (
            <Field label={t('formAnimal.exploracao')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Icon name="barn" size="md" color={colors.textMuted} />
                <Text variant="body" style={{ flex: 1 }}>
                  {nomeExploracao ?? t('ficha.semExploracao')}
                </Text>
              </View>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                {t('formMovimento.naoMudaExploracao')}
              </Text>
            </Field>
          ) : null
        ) : exploracoes.length > 1 ? (
          <Field label="Exploração" obrigatorio>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {exploracoes.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nome}
                  icon="barn"
                  selected={exploracaoId === e.id}
                  onPress={() => {
                    setExploracaoId(e.id);
                    setAnimalId(undefined);
                    setTerrenoId(undefined);
                  }}
                />
              ))}
            </View>
          </Field>
        ) : null}

        {/* Despesa ou receita — só quem pode lançar receitas vê a escolha */}
        {podeReceita ? (
          <Field label="Tipo de movimento" obrigatorio>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <BigToggle
                label="Despesa"
                icon="cash-minus"
                cor={colors.danger}
                selected={direcaoEfetiva === 'despesa'}
                onPress={() => setDirecao('despesa')}
              />
              <BigToggle
                label="Receita"
                icon="cash-plus"
                cor={colors.success}
                selected={direcaoEfetiva === 'receita'}
                onPress={() => setDirecao('receita')}
              />
            </View>
          </Field>
        ) : null}

        <Field label="Categoria" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {categorias.map((c) => (
              <Chip
                key={c.valor}
                label={c.valor}
                icon={c.icon}
                selected={categoriaValida === c.valor}
                onPress={() => setCategoria(c.valor)}
              />
            ))}
          </View>
        </Field>

        <Field label="Valor (€)" obrigatorio>
          <CampoTexto
            value={valor}
            onChangeText={setValor}
            placeholder="Ex: 860"
            icon="cash"
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Descrição" obrigatorio>
          <CampoTexto
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Ração, 40 sacos"
            icon="note-text-outline"
          />
        </Field>

        <Field label="Data" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {opcoesData.map((o) => (
              <Chip
                key={o.dias}
                label={t(o.chave)}
                // Com uma data escolhida à mão, nenhum atalho fica aceso.
                selected={!dataManualIso && diasAtras === o.dias}
                onPress={() => {
                  setDiasAtras(o.dias);
                  setDataManual('');
                }}
              />
            ))}
          </View>

          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm, marginBottom: 4 }}>
            {t('formMovimento.ouOutraData')}
          </Text>
          <CampoData
            value={dataManual}
            onChangeText={setDataManual}
            placeholder="Ex: 15/03/2026"
            rotuloCalendario={t('formMovimento.calendarioData')}
          />
          {dataManualInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              {t('formAnimal.dataInvalidaNaoFutura')}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.sm,
            }}>
            <Icon name="calendar-check" size="sm" color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              {formatDataPt(data)}
            </Text>
          </View>
        </Field>

        <Field label={direcaoEfetiva === 'receita' ? t('formMovimento.comprador') : t('formLote.fornecedor')} opcional>
          <CampoTexto
            value={contraparte}
            onChangeText={setContraparte}
            placeholder={t('formLote.exFornecedor')}
            icon="store-outline"
            autoCapitalize="words"
          />
        </Field>

        {/* Imputação — opcional de propósito: a conta da luz não tem animal.
            Pelo terreno, e não numa lista corrida: com 400 animais a parede de
            etiquetas empurrava o resto do formulário para fora do ecrã, e
            encontrar lá a vaca certa era pior do que não imputar nada. */}
        {animaisDaExploracao.length > 0 ? (
          <Field label={t('ficha.animal')} opcional>
            <SeletorAnimais
              animais={animaisDaExploracao}
              terrenos={terrenosDaExploracao}
              escolhidos={animalId ? [animalId] : []}
              onMudar={(ids) => setAnimalId(ids[0])}
            />
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
              {t('formMovimento.animalAjuda')}
            </Text>
          </Field>
        ) : null}

        {terrenosDaExploracao.length > 0 ? (
          <Field label={t('filtro.terreno')} opcional>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {terrenosDaExploracao.map((t) => (
                <Chip
                  key={t.id}
                  label={t.nome}
                  icon="grass"
                  selected={terrenoId === t.id}
                  onPress={() => setTerrenoId(terrenoId === t.id ? undefined : t.id)}
                />
              ))}
            </View>
          </Field>
        ) : null}

        {!podeReceita ? (
          <Aviso texto={t('formMovimento.soDespesas')} />
        ) : null}

        {/* Histórico de alterações — só na edição, e depois do formulário: é
            para consultar quando há dúvida, não para ler antes de corrigir. */}
        {movimento ? <HistoricoMovimento movimento={movimento} /> : null}

        {podeEliminar && movimento ? (
          <Button
            label={t('formMovimento.eliminarMovimento')}
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
          label={aGravar ? t('comum.aGuardar') : editar ? t('formAnimal.guardarAlteracoes') : t('formMovimento.guardarMovimento')}
          icon="check"
          onPress={guardar}
          disabled={!valido || aGravar}
        />
        {valorNum > 0 && Number.isFinite(valorNum) ? (
          <Text
            variant="caption"
            color={corDirecao}
            style={{ marginTop: spacing.xs, textAlign: 'center' }}>
            {direcaoEfetiva === 'receita' ? t('formMovimento.entra') : t('formMovimento.sai')} {valor.replace('.', ',')} €
          </Text>
        ) : null}
      </View>
    </EcraComTeclado>
  );
}

/* ------------------------------------------------------------------ *
 *  Histórico de alterações deste lançamento
 * ------------------------------------------------------------------ */

/**
 * Quem criou, quem alterou e quando — vindo do servidor (`registo_atividade`),
 * escrito por trigger.
 *
 * A app NÃO guarda isto: as linhas são escritas pelo Postgres e ninguém as pode
 * mudar, nem sequer quem fez a alteração. Um histórico de edições montado pelo
 * cliente seria escrito pelo próprio auditado, e não valia nada.
 *
 * Não mostra o QUE mudou em cada campo — o trigger guarda uma frase-resumo da
 * linha, não um diff. Diz quem lhe mexeu e a que horas, que é a pergunta que se
 * faz quando um número não bate certo.
 */
function HistoricoMovimento({ movimento }: { movimento: Movimento }) {
  const { nomeDe } = useNomesEquipa();
  const [linhas, setLinhas] = useState<Atividade[]>([]);
  const [estado, setEstado] = useState<'a-carregar' | 'pronto' | 'erro'>('a-carregar');

  useEffect(() => {
    let vivo = true;
    carregarHistoricoDe('movimento', movimento.id)
      .then((l) => {
        if (!vivo) return;
        setLinhas(l);
        setEstado('pronto');
      })
      .catch(() => {
        if (vivo) setEstado('erro');
      });
    return () => {
      vivo = false;
    };
  }, [movimento.id]);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text variant="label" style={{ marginBottom: spacing.xs }}>
        {t('formMovimento.historicoAlteracoes')}
      </Text>
      <View
        style={{
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        }}>
        {estado === 'a-carregar' ? (
          <Text variant="secondary" color={colors.textMuted} style={{ paddingVertical: spacing.sm }}>
            A carregar…
          </Text>
        ) : estado === 'erro' ? (
          <Text variant="secondary" color={colors.textMuted} style={{ paddingVertical: spacing.sm }}>
            {t('formMovimento.semHistorico')}
          </Text>
        ) : linhas.length === 0 ? (
          <Text variant="secondary" color={colors.textMuted} style={{ paddingVertical: spacing.sm }}>
            {/* Vazio quer dizer duas coisas: um lançamento anterior ao registo
                de atividade, ou a app em modo local. Nenhuma delas é um erro,
                e prometer um histórico que não existe é pior do que dizê-lo. */}
            {t('formMovimento.semAlteracoes')}
          </Text>
        ) : (
          linhas.map((l, i) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                borderBottomWidth: i < linhas.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              }}>
              <Icon
                name={
                  l.acao === 'criou'
                    ? 'plus-circle-outline'
                    : l.acao === 'removeu'
                      ? 'trash-can-outline'
                      : 'pencil-outline'
                }
                size="md"
                color={
                  l.acao === 'criou'
                    ? colors.success
                    : l.acao === 'removeu'
                      ? colors.danger
                      : colors.info
                }
              />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {frase(l)} · {nomeDe(l.userId) ?? t('animais.semNome')}
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  {formatDataHora(l.em)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Componentes locais (mesmo estilo de evento/novo.tsx)
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
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: spacing.xs,
        }}>
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

function CampoTexto({
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
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minHeight: sizes.input,
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
        style={{
          flex: 1,
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 17,
          color: colors.text,
        }}
      />
    </View>
  );
}

function BigToggle({
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
          flex: 1,
          height: sizes.button,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? cor : colors.border,
          backgroundColor: selected ? cor : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={icon} size="md" color={selected ? colors.onPrimary : cor} />
      <Text
        variant="button"
        color={selected ? colors.onPrimary : colors.textSecondary}
        style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

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
