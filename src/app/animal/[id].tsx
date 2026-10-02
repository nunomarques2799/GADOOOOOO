import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertItem } from '@/components/AlertItem';
import { RetratoAnimal } from '@/components/AnimalRow';
import {
  Badge,
  Button,
  CampoData,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  type IconName,
  IconBadge,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { chegadaDoVoo, useVooEmCurso } from '@/components/VooAnimal';
import { especieMeta, finalidadeMeta, GestacaoDias } from '@/data/constants';
import { confirmar } from '@/data/avisos';
import { filhosDe, progenitorDe, rotuloAnimal } from '@/data/genealogia';
import { balancoAnimal } from '@/data/financas';
import { diasAte, formatDataCurta, formatDataHora, formatDataPt, formatEuro, idadeExtenso, paraEuro, parseDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useEstreito } from '@/hooks/useEstreito';
import { estadoReprodutivo, faseMeta } from '@/data/reproducao';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useFinancas } from '@/data/useFinancas';
import type { EstadoAnimal, EventoTipo } from '@/data/types';
import { t } from '@/i18n';
import { colors, radii, spacing, type } from '@/theme';

const eventoIcone: Record<EventoTipo, IconName> = {
  Parto: 'baby-bottle-outline',
  Cobrição: 'gender-male-female',
  Diagnóstico: 'stethoscope',
  Vacinação: 'needle',
  Medicamento: 'medical-bag',
  Pesagem: 'scale',
  Movimentação: 'swap-horizontal',
  Compra: 'cart-outline',
  Venda: 'cash',
  Morte: 'grave-stone',
};

export default function AnimalDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    animais,
    animalById,
    terrenoById,
    exploracaoById,
    eventosByAnimal,
    movimentosByAnimal,
    alertas,
    marcarSaida,
    reativarAnimal,
  } = useGado();

  const { pode } = useMembros();
  const { nomeDe } = useNomesEquipa();
  const toast = useToasts();
  // O retrato grande: é para aqui que voa o da lista (ver `VooAnimal.tsx`).
  const retrato = useRef<View>(null);
  const vooEmCurso = useVooEmCurso(id);
  // Num ecrã estreito o nome vai para debaixo do retrato: ao lado dele, em
  // Fraunces grande, "Castanha" partia-se em "Cast / anha".
  const estreito = useEstreito();

  const animal = animalById(id);
  /**
   * Eliminado não é uma saída como as outras: as duas primeiras (falecido,
   * vendido) contam o que aconteceu ao ANIMAL, esta conta o que alguém fez ao
   * registo — que foi criado por engano.
   *
   * É por isso que a ficha de um animal eliminado é só de leitura, e a de um
   * falecido ou vendido não: corrigir a data de nascimento de uma vaca que
   * morreu no mês passado é trabalho normal, e o histórico dela ainda serve
   * para alguma coisa. Já mexer nos dados de um registo que se disse ser um
   * engano é dar-lhe vida outra vez, num sítio de onde ele já não devia voltar.
   */
  const eliminado = animal?.estado === 'eliminado';
  // Três perguntas e não uma. O veterinário regista o que fez ao animal e não
  // lhe toca na ficha nem o dá por morto ou vendido; o trabalhador e o dono
  // fazem as três coisas. Ver `permissoes.ts`.
  const podeEditar = pode(animal?.exploracaoId, 'editarAnimais') && !eliminado;
  const podeRegistarEvento = pode(animal?.exploracaoId, 'registarTratamentos');
  const podeRegistarSaida = pode(animal?.exploracaoId, 'registarSaida');

  // Acima do `return` do animal inexistente de propósito: os hooks têm de
  // correr sempre, na mesma ordem, ou o React perde o estado do ecrã.
  //
  // Quem não pode lançar receitas também não decide o preço — o trabalhador
  // regista a saída e o valor fica por preencher, para o dono o fechar depois
  // (aparece-lhe em Finanças como "venda sem preço"). Com a gestão económica
  // desligada, ninguém vê preço nenhum, nem o dono.
  const {
    ativas: financasAtivas,
    podeVerBalancoAnimal: podeVerBalanco,
    podeRegistarReceita: podeDefinirPreco,
  } = useFinancas(animal?.exploracaoId);

  // Formulário inline "Marcar saída" — só visível quando o utilizador o abre.
  const [saidaOpen, setSaidaOpen] = useState(false);
  const [saidaTipo, setSaidaTipo] = useState<Exclude<EstadoAnimal, 'ativo'>>('vendido');
  const [saidaData, setSaidaData] = useState(formatDataCurta(new Date().toISOString()));
  const [saidaMotivo, setSaidaMotivo] = useState('');
  const [saidaPreco, setSaidaPreco] = useState('');
  const [saidaErro, setSaidaErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('ficha.animal')} />
        <EmptyState icon="cow-off" title={t('ficha.naoEncontrado')} message={t('ficha.jaNaoExiste')} />
      </View>
    );
  }

  const meta = especieMeta[animal.especie];
  const terreno = animal.terrenoId ? terrenoById(animal.terrenoId) : undefined;
  const exploracao = exploracaoById(animal.exploracaoId);
  // `progenitorDe` e não `animalById`: um `maeId` que aponta para um registo
  // eliminado lê-se como "sem mãe registada", que é o que passa a ser verdade
  // depois de alguém dizer que aquele registo foi um engano.
  const mae = progenitorDe(animais, animal.maeId);
  const pai = progenitorDe(animais, animal.paiId);
  const crias = filhosDe(animais, animal.id);
  const eventos = eventosByAnimal(animal.id);
  const balanco = balancoAnimal(eventos, movimentosByAnimal(animal.id));
  // Devolve `nao-aplicavel` a machos, a jovens e a quem já saiu — e é isso que
  // esconde a secção inteira nesses casos.
  const reproducao = estadoReprodutivo(animal, eventos);
  const meusAlertas = alertas.filter((a) => a.animalId === animal.id);
  const saiu = !!animal.estado && animal.estado !== 'ativo';

  async function confirmarSaida() {
    const iso = parseDataPt(saidaData);
    if (!iso) {
      setSaidaErro(t('ficha.dataInvalida'));
      return;
    }
    setSaidaErro(null);
    setAGuardar(true);
    try {
      const preco = saidaTipo === 'vendido' && podeDefinirPreco ? paraEuro(saidaPreco) : NaN;
      const valor = Number.isFinite(preco) && preco > 0 ? preco : undefined;
      await marcarSaida(animal!.id, saidaTipo, iso, saidaMotivo.trim() || undefined, valor);
      setSaidaOpen(false);
      setSaidaMotivo('');
      setSaidaPreco('');
      toast.sucesso(
        saidaTipo === 'vendido' ? t('ficha.vendaRegistada') : t('ficha.morteRegistada'),
        rotuloAnimal(animal!),
      );
    } catch (e) {
      const razao = mensagemDeErro(e);
      setSaidaErro(razao);
      toast.erro(t('ficha.saidaNaoRegistada'), razao);
    } finally {
      setAGuardar(false);
    }
  }

  function pedirReativar() {
    confirmar(
      t('ficha.reativarTitulo'),
      t('ficha.reativarMensagem'),
      () => {
        void (async () => {
          try {
            await reativarAnimal(animal!.id);
            toast.sucesso(t('ficha.reativado'), rotuloAnimal(animal!));
          } catch (e) {
            // A reposição era feita sem ninguém olhar para o resultado: se o
            // servidor recusasse, o animal voltava ao efetivo no ecrã e saía
            // outra vez na sincronização seguinte, sem uma palavra.
            toast.erro(t('ficha.semReativar'), mensagemDeErro(e));
          }
        })();
      },
      { rotuloConfirmar: t('ficha.reativar') },
    );
  }

  // O botão de baixo, "Registar para a Estrela" (guia de estilo): o que mais se
  // faz numa ficha é apontar o que acabou de acontecer àquele animal.
  const comBotaoRegistar = podeRegistarEvento && !saiu;
  const femea = animal.sexo === 'Fêmea';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sem título em cima: o nome está logo abaixo, grande. À direita, o
          "Editar" com a palavra escrita (guia de estilo). */}
      <Header
        title=""
        actionIcon={podeEditar ? 'pencil-outline' : undefined}
        actionLabel={t('comum.editar')}
        onAction={podeEditar ? () => router.push(`/animal/editar/${animal.id}`) : undefined}
      />
      <Screen contentStyle={comBotaoRegistar ? { paddingBottom: 140 } : undefined}>
        {/* O retrato grande, com um aro, e o nome em Fraunces. Era um cartão
            verde com a vaca da biblioteca de ícones; o guia pôs aqui a mesma
            inicial da lista, que é para onde o retrato "voa". */}
        <View
          style={{
            flexDirection: estreito ? 'column' : 'row',
            alignItems: estreito ? 'flex-start' : 'center',
            gap: spacing.md,
          }}>
          <View
            style={{
              padding: 5,
              borderRadius: radii.pill,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
            <View
              ref={retrato}
              collapsable={false}
              onLayout={() =>
                // Diz ao retrato que vem a voar da lista onde é que ele pousa.
                retrato.current?.measureInWindow((x, y, w, h) => chegadaDoVoo(animal.id, { x, y, w, h }))
              }
              style={{ opacity: vooEmCurso ? 0 : 1 }}>
              <RetratoAnimal animal={animal} tamanho={estreito ? 88 : 104} />
            </View>
          </View>
          <View style={estreito ? { alignSelf: 'stretch' } : { flex: 1, minWidth: 0 }}>
            <Text variant="display" numberOfLines={2}>
              {animal.nome ?? t('animais.semNome')}
            </Text>
            {/* O número e o brinco em mono: é assim que se conferem contra o
                que está escrito no animal. */}
            <Text style={[type.mono, { color: colors.textSecondary, marginTop: 2 }]}>
              {[
                animal.numeroCasa ? t('animais.numero', { n: animal.numeroCasa }) : null,
                animal.numeroIdentificacao ?? t('animais.semBrinco'),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, flexWrap: 'wrap' }}>
          <PastilhaFicha
            label={femea ? t('evento.femea') : t('evento.macho')}
            fundo={femea ? colors.femeaTint : colors.machoTint}
            cor={femea ? colors.femea : colors.macho}
          />
          <PastilhaFicha icon={meta.icon} label={animal.raca ?? animal.especie} />
          <PastilhaFicha icon="cake-variant-outline" label={idadeExtenso(animal.dataNascimento)} />
          {terreno ? <PastilhaFicha icon="map-marker-outline" label={terreno.nome} /> : null}
          {animal.estado === 'falecido' ? <PastilhaFicha icon="grave-stone" label={t('ficha.falecido')} /> : null}
          {animal.estado === 'vendido' ? <PastilhaFicha icon="cash" label={t('ficha.vendido')} /> : null}
          {eliminado ? <PastilhaFicha icon="trash-can-outline" label={t('ficha.eliminado')} /> : null}
        </View>

        {/* O estado da reprodução em destaque, como no guia: o que interessa
            de uma fêmea prenhe é quando pare, e quanto falta. */}
        {reproducao && reproducao.fase !== 'nao-aplicavel' ? (
          <CartaoReproducao
            fase={reproducao.fase}
            dataPrevistaParto={reproducao.dataPrevistaParto}
            diasParaParto={reproducao.diasParaParto}
            gestacao={GestacaoDias[animal.especie]}
            desde={reproducao.desde}
            detalheCobricao={reproducao.detalheCobricao}
            diasNaFase={reproducao.diasNaFase}
          />
        ) : null}

        {/* Aviso: animal já não está no efetivo */}
        {saiu ? (
          <>
            <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {t('ficha.saidaDoEfetivo')}
            </Text>
            <Card>
              <InfoField
                icon={
                  animal.estado === 'falecido'
                    ? 'grave-stone'
                    : animal.estado === 'vendido'
                      ? 'cash'
                      : 'trash-can-outline'
                }
                label={t('ficha.motivo')}
                value={
                  animal.estado === 'falecido'
                    ? t('ficha.falecimento')
                    : animal.estado === 'vendido'
                      ? t('ficha.venda')
                      : t('ficha.eliminadoDaLista')
                }
              />
              <InfoField
                icon="calendar"
                label={t('ficha.data')}
                value={animal.dataSaida ? formatDataPt(animal.dataSaida) : t('ficha.semData')}
              />
              {/* Quem e quando: é o que faz do histórico uma auditoria. Só
                  aparece quando existe — um "registado por" em branco valia
                  tanto como não estar lá, e ocupava uma linha a dizê-lo. */}
              {animal.saidaPor || animal.saidaEm ? (
                <InfoField
                  icon="account-check-outline"
                  label={t('ficha.registadoPor')}
                  value={[
                    nomeDe(animal.saidaPor) ?? (animal.saidaPor ? t('ficha.alguemDaEquipa') : undefined),
                    animal.saidaEm ? formatDataHora(animal.saidaEm) : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ) : null}
              {animal.motivoSaida ? (
                <InfoField icon="note-text-outline" label={t('ficha.nota')} value={animal.motivoSaida} last />
              ) : null}
            </Card>
            <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
              {eliminado
                ? t('ficha.eliminadoExplicacao')
                : t('ficha.saidaExplicacao')}
            </Text>
          </>
        ) : null}

        {/* Alertas do animal */}
        {meusAlertas.length > 0 ? (
          <>
            <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {t('inicio.atencao')}
            </Text>
            <Card padded={false}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {meusAlertas.map((a, i) => (
                  <AlertItem key={a.id} alerta={a} divider={i < meusAlertas.length - 1} />
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {/* Identificação */}
        <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          {t('ficha.identificacao')}
        </Text>
        <Card>
          <InfoField icon="tag-outline" label={t('ficha.numeroIdentificacao')} value={animal.numeroIdentificacao ?? t('animais.semBrinco')} />
          {/* O número só aparece quando o animal o tem: uma linha com travessão
              a quem não numera o gado é ruído puro. */}
          {animal.numeroCasa ? (
            <InfoField icon="numeric" label={t('formAnimal.numero')} value={animal.numeroCasa} />
          ) : null}
          {animal.finalidade ? (
            <InfoField
              icon={finalidadeMeta[animal.finalidade].icon}
              label={t('filtro.finalidade')}
              value={animal.finalidade}
            />
          ) : null}
          <InfoField icon="calendar-check" label={t('ficha.dataIdentificacao')} value={animal.dataIdentificacao ? formatDataPt(animal.dataIdentificacao) : t('ficha.naoIndicada')} />
          <InfoField
            icon="cloud-upload-outline"
            label={t('categoria.snira')}
            value={animal.comunicadoSnira === false ? t('formAnimal.porComunicar') : animal.comunicadoSnira ? t('ficha.comunicado') : t('ficha.naoSeAplica')}
            valueTone={animal.comunicadoSnira === false ? colors.danger : undefined}
            last
          />
        </Card>

        {/* Nascimento e genealogia */}
        <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          {t('ficha.nascimentoEGenealogia')}
        </Text>
        <Card>
          <InfoField icon="cake-variant" label={t('formAnimal.dataNascimento')} value={formatDataPt(animal.dataNascimento)} />
          <InfoField icon="clock-outline" label={t('filtro.idade')} value={idadeExtenso(animal.dataNascimento)} />
          <InfoField icon="palette-outline" label={t('ficha.racaPelagem')} value={[animal.raca, animal.corPelagem].filter(Boolean).join(' · ') || t('ficha.naoIndicada')} />
          {/* Só a fêmeas prenhes: sem esta linha, quem registasse a cobrição
              não tinha onde confirmar a data até o alerta tocar, 14 dias antes. */}
          {animal.dataPrevistaParto ? (
            <InfoField
              icon="baby-bottle-outline"
              label={t('aviso.partoTitulo')}
              value={`${formatDataPt(animal.dataPrevistaParto)}${
                diasAte(animal.dataPrevistaParto) >= 0
                  ? ` · ${t('formAnimal.daquiA', { n: diasAte(animal.dataPrevistaParto) })}`
                  : ''
              }`}
            />
          ) : null}
          <GenealogiaRow label={t('formAnimal.mae')} nome={mae ? rotuloAnimal(mae) : undefined} onPress={mae ? () => router.push(`/animal/${mae.id}`) : undefined} />
          <GenealogiaRow label={t('formAnimal.pai')} nome={pai ? rotuloAnimal(pai) : undefined} onPress={pai ? () => router.push(`/animal/${pai.id}`) : undefined} last />
        </Card>
        <Button
          label={
            crias.length > 0
              ? t('ficha.verArvoreComCrias', { n: crias.length })
              : t('ficha.verArvore')
          }
          icon="family-tree"
          variant="secondary"
          onPress={() => router.push(`/animal/genealogia/${animal.id}`)}
          style={{ marginTop: spacing.sm }}
        />

        {/* Reprodução — só às fêmeas que já andam à reprodução. Nas outras
            seria uma secção sempre vazia a dizer "—", e a ficha já é comprida.

            Tudo isto é CALCULADO a partir do histórico (ver `reproducao.ts`):
            não há aqui nenhum campo que alguém tenha de manter atualizado. */}
        {reproducao && reproducao.fase !== 'nao-aplicavel' ? (
          <>
            <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {t('nav.reproducao')}
            </Text>
            <Card>
              {/* O estado em si está no cartão de cima, em destaque. */}
              {reproducao.fase === 'coberta' || reproducao.fase === 'duvidosa' ? (
                <InfoField
                  icon="calendar-clock"
                  label={reproducao.fase === 'coberta' ? t('ficha.cobertaHa') : t('ficha.porConfirmarHa')}
                  value={`${reproducao.diasNaFase} dias${
                    reproducao.detalheCobricao ? ` · ${reproducao.detalheCobricao}` : ''
                  }`}
                />
              ) : null}
              <InfoField
                icon="baby-bottle-outline"
                label={t('ficha.partos')}
                value={
                  reproducao.partos === 0
                    ? t('ficha.aindaNenhum')
                    : `${reproducao.partos}${
                        reproducao.diasDesdeUltimoParto != null
                          ? ` · último há ${reproducao.diasDesdeUltimoParto} dias`
                          : ''
                      }`
                }
                last={reproducao.intervaloMedioPartos == null}
              />
              {reproducao.intervaloMedioPartos != null ? (
                <InfoField
                  icon="chart-timeline-variant"
                  label={t('repro.intervaloPartos')}
                  value={`${reproducao.intervaloMedioPartos} dias em média`}
                  last
                />
              ) : null}
            </Card>
          </>
        ) : null}

        {/* Localização */}
        <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          {t('ficha.localizacao')}
        </Text>
        <Card>
          <InfoField icon="barn" label={t('formAnimal.exploracao')} value={exploracao?.nome ?? t('ficha.semExploracao')} />
          <InfoField icon="map-marker" label={t('ficha.terrenoAtual')} value={terreno?.nome ?? t('filtro.semTerreno')} last />
        </Card>

        {/* Balanço económico — só a quem pode consultar contas, e só quando há
            valores registados. O trabalhador vê a ficha do animal toda menos
            isto: quanto o animal rendeu é conta da exploração. */}
        {balanco.temDados && podeVerBalanco ? (
          <>
            <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {t('ficha.balanco')}
            </Text>
            <Card>
              <View style={{ gap: spacing.xs }}>
                <BalancoLinha label={t('ficha.receitaVenda')} valor={balanco.receita} cor={colors.success} sinal="+" />
                <BalancoLinha label={t('ficha.custos')} valor={balanco.custos} cor={colors.danger} sinal="−" />
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="bodyStrong">Resultado</Text>
                  <Text
                    variant="h3"
                    color={balanco.resultado >= 0 ? colors.success : colors.danger}>
                    {formatEuro(balanco.resultado)}
                  </Text>
                </View>
              </View>
            </Card>
          </>
        ) : null}

        {/* Histórico */}
        <Text variant="h2" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          {t('ficha.historico')} ({eventos.length})
        </Text>
        {eventos.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              {t('ficha.semEventos')}
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {eventos.map((ev, i) => (
                <View
                  key={ev.id}
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: i < eventos.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}>
                  <IconBadge name={eventoIcone[ev.tipo]} color={colors.primary} background={colors.primaryTint} size={40} iconSize={20} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs }}>
                      <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
                        {ev.descricao}
                      </Text>
                      <Text variant="caption" color={colors.textMuted}>
                        {formatDataPt(ev.data)}
                      </Text>
                    </View>
                    {ev.detalhe ? (
                      <Text variant="secondary" color={colors.textSecondary}>
                        {ev.detalhe}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Ações */}
        <View style={{ gap: spacing.sm, marginTop: spacing.xl }}>
          {/* Corrigir a ficha (o "Editar" lá em cima) continua a poder
              fazer-se depois de o animal sair do efetivo — a data de
              nascimento de uma vaca vendida está errada da mesma maneira. O
              que já não se corrige é um registo ELIMINADO, e aí o botão nem
              aparece (ver `podeEditar`). Registar fica no botão de baixo. */}
          {eliminado ? (
            <Text variant="secondary" color={colors.textMuted}>
              {t('ficha.eliminadoNaoSeAltera')}
            </Text>
          ) : null}
          {!saiu ? (
            <>
              {!podeRegistarSaida ? null : !saidaOpen ? (
                <Button
                  label={t('ficha.marcarSaida')}
                  icon="archive-outline"
                  variant="ghost"
                  onPress={() => setSaidaOpen(true)}
                />
              ) : (
                <FormularioSaida
                  tipo={saidaTipo}
                  data={saidaData}
                  motivo={saidaMotivo}
                  preco={saidaPreco}
                  podeDefinirPreco={podeDefinirPreco}
                  financasAtivas={financasAtivas}
                  erro={saidaErro}
                  aGuardar={aGuardar}
                  onChangeTipo={setSaidaTipo}
                  onChangeData={setSaidaData}
                  onChangeMotivo={setSaidaMotivo}
                  onChangePreco={setSaidaPreco}
                  onCancelar={() => {
                    setSaidaOpen(false);
                    setSaidaErro(null);
                  }}
                  onConfirmar={confirmarSaida}
                />
              )}
            </>
          ) : podeRegistarSaida && !eliminado ? (
            <Button
              label={t('ficha.voltarAAtivar')}
              icon="restore"
              variant="secondary"
              onPress={pedirReativar}
            />
          ) : null}
        </View>
      </Screen>

      {/* Preso ao fundo, como no guia: "Registar para a Estrela". O artigo
          segue o sexo do animal, que é como se diz. */}
      {comBotaoRegistar ? (
        <BarraRegistar
          rotulo={
            femea
              ? t('ficha.registarParaA', { nome: animal.nome ?? t('ficha.animal').toLowerCase() })
              : t('ficha.registarParaO', { nome: animal.nome ?? t('ficha.animal').toLowerCase() })
          }
          onPress={() => router.push({ pathname: '/evento/novo', params: { animalId: animal.id } })}
        />
      ) : null}
    </View>
  );
}

/** O botão de baixo da ficha, por cima do conteúdo, com a margem do iPhone. */
function BarraRegistar({ rotulo, onPress }: { rotulo: string; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: insets.bottom + spacing.sm,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}>
      <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <Button label={rotulo} icon="plus" onPress={onPress} />
      </View>
    </View>
  );
}

/**
 * O estado da reprodução em destaque (guia de estilo).
 *
 * Prenha: a data prevista do parto em Fraunces, uma barra com o tempo de
 * gestação que já passou (pela média da espécie, a mesma conta que dá a data)
 * e os dias que faltam em mono. Nas outras fases: o estado e o que ele quer
 * dizer. Tudo calculado do histórico (`reproducao.ts`), nada guardado.
 */
function CartaoReproducao({
  fase,
  dataPrevistaParto,
  diasParaParto,
  gestacao,
  desde,
  detalheCobricao,
  diasNaFase,
}: {
  fase: Exclude<ReturnType<typeof estadoReprodutivo>['fase'], 'nao-aplicavel'>;
  dataPrevistaParto?: string;
  diasParaParto?: number;
  gestacao: number;
  desde?: string;
  detalheCobricao?: string;
  diasNaFase: number;
}) {
  const meta = faseMeta(fase);
  const prenha = fase === 'gestante' && !!dataPrevistaParto && diasParaParto != null;
  const passou = prenha ? Math.min(1, Math.max(0, 1 - (diasParaParto ?? 0) / gestacao)) : 0;
  const tom = fase === 'gestante' ? 'warning' : fase === 'vazia' ? 'neutral' : 'info';
  return (
    <Card style={{ marginTop: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text variant="rotulo" color={colors.textSecondary}>
          {t('nav.reproducao')}
        </Text>
        <Badge tone={tom} label={meta.label} />
      </View>
      {prenha ? (
        <>
          <Text variant="h1" style={{ marginTop: spacing.sm }}>
            {t('ficha.partoPrevistoA', { data: formatDataPt(dataPrevistaParto!) })}
          </Text>
          {/* A barra: quanto da gestação já passou. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: 12,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceAlt,
              marginTop: spacing.md,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width: `${Math.round(passou * 100)}%`,
                height: '100%',
                borderRadius: radii.pill,
                backgroundColor: colors.warningVivo,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
              {desde
                ? detalheCobricao
                  ? t('ficha.cobricaoAComDetalhe', { data: formatDataPt(desde), detalhe: detalheCobricao })
                  : t('ficha.cobricaoA', { data: formatDataPt(desde) })
                : meta.explicacao}
            </Text>
            <Text style={[type.mono, { color: colors.warning }]} numberOfLines={1}>
              {(diasParaParto ?? 0) >= 0
                ? t('alerta.dias', { n: diasParaParto ?? 0 })
                : t('alerta.emAtraso')}
            </Text>
          </View>
        </>
      ) : (
        <>
          <Text variant="h2" style={{ marginTop: spacing.sm }}>
            {meta.explicacao}
          </Text>
          {(fase === 'coberta' || fase === 'duvidosa') && diasNaFase > 0 ? (
            <Text style={[type.mono, { color: colors.textSecondary, marginTop: spacing.xs }]}>
              {t('alerta.dias', { n: diasNaFase })}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

function FormularioSaida({
  tipo,
  data,
  motivo,
  preco,
  podeDefinirPreco,
  financasAtivas,
  erro,
  aGuardar,
  onChangeTipo,
  onChangeData,
  onChangeMotivo,
  onChangePreco,
  onCancelar,
  onConfirmar,
}: {
  tipo: Exclude<EstadoAnimal, 'ativo'>;
  data: string;
  motivo: string;
  preco: string;
  podeDefinirPreco: boolean;
  financasAtivas: boolean;
  erro: string | null;
  aGuardar: boolean;
  onChangeTipo: (t: Exclude<EstadoAnimal, 'ativo'>) => void;
  onChangeData: (t: string) => void;
  onChangeMotivo: (t: string) => void;
  onChangePreco: (t: string) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <Card>
      <Text variant="h3" style={{ marginBottom: spacing.sm }}>
        {t('ficha.marcarSaidaTitulo')}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
        <Chip
          label={t('ficha.vendido')}
          icon="cash"
          selected={tipo === 'vendido'}
          onPress={() => onChangeTipo('vendido')}
        />
        <Chip
          label={t('ficha.falecido')}
          icon="grave-stone"
          selected={tipo === 'falecido'}
          onPress={() => onChangeTipo('falecido')}
        />
      </View>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
        {t('ficha.dataFormato')}
      </Text>
      <View style={{ marginBottom: spacing.md }}>
        <CampoData
          value={data}
          onChangeText={onChangeData}
          placeholder={t('agenda.exDia')}
          icon="calendar"
          rotuloCalendario={t('ficha.calendarioSaida')}
        />
      </View>
      {tipo === 'vendido' && podeDefinirPreco ? (
        <>
          <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
            {t('ficha.precoVenda')}
          </Text>
          <View style={{ marginBottom: spacing.md }}>
            <TextField
              value={preco}
              onChangeText={onChangePreco}
              placeholder={t('ficha.exPreco')}
              icon="cash"
              keyboardType="decimal-pad"
            />
          </View>
        </>
      ) : null}
      {tipo === 'vendido' && !podeDefinirPreco && financasAtivas ? (
        // Dizer porque é que não há campo do preço. Sem esta linha, quem
        // registou a saída fica sem saber se se esqueceu de alguma coisa.
        //
        // Só quando as finanças estão LIGADAS: com elas desligadas não há
        // preço nenhum à espera de ser lançado, e prometer que "o valor entra
        // depois" deixava o criador à espera de uma coisa que não acontece.
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: colors.infoTint,
            borderRadius: radii.md,
            padding: spacing.sm,
            marginBottom: spacing.md,
          }}>
          <Icon name="information" size="md" color={colors.info} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            O preço é lançado por quem gere a exploração. Registe a saída: o valor
            entra depois.
          </Text>
        </View>
      ) : null}
      <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
        {t('ficha.notaOpcional')}
      </Text>
      <View style={{ marginBottom: spacing.md }}>
        <TextField
          value={motivo}
          onChangeText={onChangeMotivo}
          placeholder={tipo === 'vendido' ? t('ficha.exNotaVenda') : t('ficha.exNotaMorte')}
          icon="note-text-outline"
        />
      </View>
      {erro ? (
        <Text variant="secondary" color={colors.danger} style={{ marginBottom: spacing.sm }}>
          {erro}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={t('comum.cancelar')} variant="ghost" onPress={onCancelar} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={aGuardar ? t('comum.aGuardar') : t('ficha.confirmar')}
            icon="check"
            variant="primary"
            onPress={onConfirmar}
            disabled={aGuardar}
          />
        </View>
      </View>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
        Fica um evento de {tipo === 'vendido' ? t('ficha.venda') : 'Morte'} registado no histórico.
      </Text>
    </Card>
  );
}

/**
 * As pastilhas por baixo do nome (guia de estilo): o sexo na sua cor, e a
 * raça, a idade e o terreno em superfície com uma linha à volta.
 */
function PastilhaFicha({
  icon,
  label,
  fundo,
  cor,
}: {
  icon?: IconName;
  label: string;
  /** Sem fundo, é uma pastilha de superfície com linha. */
  fundo?: string;
  cor?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        backgroundColor: fundo ?? colors.surface,
        borderWidth: fundo ? 0 : 1,
        borderColor: colors.border,
        borderRadius: radii.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
      }}>
      {icon ? <Icon name={icon} size={16} color={cor ?? colors.textSecondary} /> : null}
      <Text variant="label" color={cor ?? colors.text}>
        {label}
      </Text>
    </View>
  );
}

function InfoField({
  icon,
  label,
  value,
  valueTone,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  valueTone?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" color={valueTone ?? colors.text} style={{ maxWidth: '55%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function BalancoLinha({
  label,
  valor,
  cor,
  sinal,
}: {
  label: string;
  valor: number;
  cor: string;
  sinal: '+' | '−';
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="body" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="bodyStrong" color={cor}>
        {sinal}
        {formatEuro(valor, 0)}
      </Text>
    </View>
  );
}

function GenealogiaRow({
  label,
  nome,
  onPress,
  last,
}: {
  label: string;
  nome?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      <Icon name="family-tree" size="md" color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      {nome ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="bodyStrong" color={onPress ? colors.primary : colors.text}>
            {nome}
          </Text>
          {onPress ? <Icon name="chevron-right" size="sm" color={colors.primary} /> : null}
        </View>
      ) : (
        <Text variant="bodyStrong" color={colors.textMuted}>
          {t('ficha.semRegisto')}
        </Text>
      )}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${nome}`}>
      {content}
    </Pressable>
  );
}
