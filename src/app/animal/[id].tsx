import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AlertItem } from '@/components/AlertItem';
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
import { especieMeta, finalidadeMeta } from '@/data/constants';
import { confirmar } from '@/data/avisos';
import { filhosDe, progenitorDe, rotuloAnimal } from '@/data/genealogia';
import { balancoAnimal } from '@/data/financas';
import { diasAte, formatDataCurta, formatDataHora, formatDataPt, formatEuro, idadeExtenso, paraEuro, parseDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useFinancas } from '@/data/useFinancas';
import type { EstadoAnimal, EventoTipo } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

const eventoIcone: Record<EventoTipo, IconName> = {
  Parto: 'baby-bottle-outline',
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
        <Header title="Animal" />
        <EmptyState icon="cow-off" title="Animal não encontrado" message="Este registo já não existe." />
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
  const meusAlertas = alertas.filter((a) => a.animalId === animal.id);
  const saiu = !!animal.estado && animal.estado !== 'ativo';

  async function confirmarSaida() {
    const iso = parseDataPt(saidaData);
    if (!iso) {
      setSaidaErro('Data inválida: use o formato dd/mm/aaaa.');
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
        saidaTipo === 'vendido' ? 'Venda registada' : 'Morte registada',
        rotuloAnimal(animal!),
      );
    } catch (e) {
      const razao = mensagemDeErro(e);
      setSaidaErro(razao);
      toast.erro('Saída não registada', razao);
    } finally {
      setAGuardar(false);
    }
  }

  function pedirReativar() {
    confirmar(
      'Voltar a ativar?',
      'O animal vai voltar a aparecer no efetivo. O evento anterior (Morte/Venda) permanece no histórico.',
      () => {
        void (async () => {
          try {
            await reativarAnimal(animal!.id);
            toast.sucesso('Animal reativado', rotuloAnimal(animal!));
          } catch (e) {
            // A reposição era feita sem ninguém olhar para o resultado: se o
            // servidor recusasse, o animal voltava ao efetivo no ecrã e saía
            // outra vez na sincronização seguinte, sem uma palavra.
            toast.erro('Não foi possível reativar', mensagemDeErro(e));
          }
        })();
      },
      { rotuloConfirmar: 'Reativar' },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={animal.nome ?? 'Animal'}
        actionIcon={podeEditar ? 'pencil-outline' : undefined}
        onAction={podeEditar ? () => router.push(`/animal/editar/${animal.id}`) : undefined}
      />
      <Screen>
        {/* Hero */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ borderRadius: radii.xl, padding: spacing.lg, alignItems: 'center' }, shadow.md]}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radii.pill,
              backgroundColor: 'rgba(255,255,255,0.16)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.sm,
              overflow: 'hidden',
            }}>
            {animal.fotografia ? (
              <Image
                source={{ uri: animal.fotografia }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Icon name={meta.icon} size={52} color={colors.textOnDark} />
            )}
          </View>
          <Text variant="h1" color={colors.textOnDark}>
            {animal.nome ?? 'Sem nome'}
          </Text>
          <Text variant="body" color={colors.textOnDarkMuted}>
            {animal.numeroIdentificacao ?? 'Sem brinco'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' }}>
            <HeroChip icon={meta.icon} label={animal.especie} />
            <HeroChip icon={animal.sexo === 'Fêmea' ? 'gender-female' : 'gender-male'} label={animal.sexo} />
            <HeroChip icon="cake-variant" label={idadeExtenso(animal.dataNascimento)} />
            {animal.estado === 'falecido' ? (
              <HeroChip icon="grave-stone" label="Falecido" />
            ) : null}
            {animal.estado === 'vendido' ? (
              <HeroChip icon="cash" label="Vendido" />
            ) : null}
            {eliminado ? <HeroChip icon="trash-can-outline" label="Eliminado" /> : null}
          </View>
        </LinearGradient>

        {/* Aviso: animal já não está no efetivo */}
        {saiu ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
              Saída do efetivo
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
                label="Motivo"
                value={
                  animal.estado === 'falecido'
                    ? 'Falecimento'
                    : animal.estado === 'vendido'
                      ? 'Venda'
                      : 'Eliminado da lista'
                }
              />
              <InfoField
                icon="calendar"
                label="Data"
                value={animal.dataSaida ? formatDataPt(animal.dataSaida) : 'Sem data'}
              />
              {/* Quem e quando: é o que faz do histórico uma auditoria. Só
                  aparece quando existe — um "registado por" em branco valia
                  tanto como não estar lá, e ocupava uma linha a dizê-lo. */}
              {animal.saidaPor || animal.saidaEm ? (
                <InfoField
                  icon="account-check-outline"
                  label="Registado por"
                  value={[
                    nomeDe(animal.saidaPor) ?? (animal.saidaPor ? 'Alguém da equipa' : undefined),
                    animal.saidaEm ? formatDataHora(animal.saidaEm) : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ) : null}
              {animal.motivoSaida ? (
                <InfoField icon="note-text-outline" label="Nota" value={animal.motivoSaida} last />
              ) : null}
            </Card>
            <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
              {eliminado
                ? 'O registo continua guardado: o histórico deste animal e a árvore genealógica dos descendentes ficam intactos. Só deixou de aparecer na lista de animais.'
                : 'O registo permanece guardado para preservar a árvore genealógica dos descendentes.'}
            </Text>
          </>
        ) : null}

        {/* Alertas do animal */}
        {meusAlertas.length > 0 ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
              A precisar de atenção
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
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Identificação
        </Text>
        <Card>
          <InfoField icon="tag-outline" label="Nº de identificação (brinco)" value={animal.numeroIdentificacao ?? 'Sem brinco'} />
          {/* O número só aparece quando o animal o tem: uma linha com travessão
              a quem não numera o gado é ruído puro. */}
          {animal.numeroCasa ? (
            <InfoField icon="numeric" label="Número" value={animal.numeroCasa} />
          ) : null}
          {animal.finalidade ? (
            <InfoField
              icon={finalidadeMeta[animal.finalidade].icon}
              label="Finalidade"
              value={animal.finalidade}
            />
          ) : null}
          <InfoField icon="calendar-check" label="Data de identificação" value={animal.dataIdentificacao ? formatDataPt(animal.dataIdentificacao) : 'Não indicada'} />
          <InfoField
            icon="cloud-upload-outline"
            label="SNIRA"
            value={animal.comunicadoSnira === false ? 'Por comunicar' : animal.comunicadoSnira ? 'Comunicado' : 'Não se aplica'}
            valueTone={animal.comunicadoSnira === false ? colors.danger : undefined}
            last
          />
        </Card>

        {/* Nascimento e genealogia */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Nascimento e genealogia
        </Text>
        <Card>
          <InfoField icon="cake-variant" label="Data de nascimento" value={formatDataPt(animal.dataNascimento)} />
          <InfoField icon="clock-outline" label="Idade" value={idadeExtenso(animal.dataNascimento)} />
          <InfoField icon="palette-outline" label="Raça / pelagem" value={[animal.raca, animal.corPelagem].filter(Boolean).join(' · ') || 'Não indicada'} />
          {/* Só a fêmeas prenhes: sem esta linha, quem registasse a cobrição
              não tinha onde confirmar a data até o alerta tocar, 14 dias antes. */}
          {animal.dataPrevistaParto ? (
            <InfoField
              icon="baby-bottle-outline"
              label="Parto previsto"
              value={`${formatDataPt(animal.dataPrevistaParto)}${
                diasAte(animal.dataPrevistaParto) >= 0
                  ? ` · daqui a ${diasAte(animal.dataPrevistaParto)} dias`
                  : ''
              }`}
            />
          ) : null}
          <GenealogiaRow label="Mãe" nome={mae ? rotuloAnimal(mae) : undefined} onPress={mae ? () => router.push(`/animal/${mae.id}`) : undefined} />
          <GenealogiaRow label="Pai" nome={pai ? rotuloAnimal(pai) : undefined} onPress={pai ? () => router.push(`/animal/${pai.id}`) : undefined} last />
        </Card>
        <Button
          label={`Ver árvore genealógica${crias.length > 0 ? ` (${crias.length} cria${crias.length === 1 ? '' : 's'})` : ''}`}
          icon="family-tree"
          variant="secondary"
          onPress={() => router.push(`/animal/genealogia/${animal.id}`)}
          style={{ marginTop: spacing.sm }}
        />

        {/* Localização */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Localização
        </Text>
        <Card>
          <InfoField icon="barn" label="Exploração" value={exploracao?.nome ?? 'Sem exploração'} />
          <InfoField icon="map-marker" label="Terreno atual" value={terreno?.nome ?? 'Sem terreno'} last />
        </Card>

        {/* Balanço económico — só a quem pode consultar contas, e só quando há
            valores registados. O trabalhador vê a ficha do animal toda menos
            isto: quanto o animal rendeu é conta da exploração. */}
        {balanco.temDados && podeVerBalanco ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
              Balanço
            </Text>
            <Card>
              <View style={{ gap: spacing.xs }}>
                <BalancoLinha label="Receita (venda)" valor={balanco.receita} cor={colors.success} sinal="+" />
                <BalancoLinha label="Custos (compra, tratamentos)" valor={balanco.custos} cor={colors.danger} sinal="−" />
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
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          Histórico ({eventos.length})
        </Text>
        {eventos.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              Ainda não há eventos registados para este animal.
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
          {/* Corrigir a ficha continua a poder fazer-se depois de o animal
              sair do efetivo — a data de nascimento de uma vaca vendida está
              errada da mesma maneira. O que já não se corrige é um registo
              ELIMINADO, e aí este botão nem aparece (ver `podeEditar`). */}
          {podeEditar ? (
            <Button
              label="Editar dados do animal"
              icon="pencil-outline"
              variant={saiu ? 'secondary' : 'ghost'}
              onPress={() => router.push(`/animal/editar/${animal.id}`)}
            />
          ) : null}
          {eliminado ? (
            <Text variant="secondary" color={colors.textMuted}>
              Este registo foi eliminado e já não se altera. Fica guardado como
              está, para o histórico e para a auditoria.
            </Text>
          ) : null}
          {!saiu ? (
            <>
              {podeRegistarEvento ? (
                <Button
                  label="Registar evento"
                  icon="plus"
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/evento/novo', params: { animalId: animal.id } })}
                />
              ) : null}
              {!podeRegistarSaida ? null : !saidaOpen ? (
                <Button
                  label="Marcar como falecido / vendido"
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
              label="Voltar a ativar o animal"
              icon="restore"
              variant="secondary"
              onPress={pedirReativar}
            />
          ) : null}
        </View>
      </Screen>
    </View>
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
        Marcar saída do efetivo
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
        <Chip
          label="Vendido"
          icon="cash"
          selected={tipo === 'vendido'}
          onPress={() => onChangeTipo('vendido')}
        />
        <Chip
          label="Falecido"
          icon="grave-stone"
          selected={tipo === 'falecido'}
          onPress={() => onChangeTipo('falecido')}
        />
      </View>
      <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
        Data (dd/mm/aaaa)
      </Text>
      <View style={{ marginBottom: spacing.md }}>
        <CampoData
          value={data}
          onChangeText={onChangeData}
          placeholder="dd/mm/aaaa"
          icon="calendar"
          rotuloCalendario="Escolher a data da saída no calendário"
        />
      </View>
      {tipo === 'vendido' && podeDefinirPreco ? (
        <>
          <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
            Preço de venda (€), opcional
          </Text>
          <View style={{ marginBottom: spacing.md }}>
            <TextField
              value={preco}
              onChangeText={onChangePreco}
              placeholder="Ex.: 1350"
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
        Nota (opcional): comprador, matadouro, causa, etc.
      </Text>
      <View style={{ marginBottom: spacing.md }}>
        <TextField
          value={motivo}
          onChangeText={onChangeMotivo}
          placeholder={tipo === 'vendido' ? 'Ex.: vendido ao Sr. Silva' : 'Ex.: doença'}
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
          <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={aGuardar ? 'A guardar…' : 'Confirmar'}
            icon="check"
            variant="primary"
            onPress={onConfirmar}
            disabled={aGuardar}
          />
        </View>
      </View>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
        Fica um evento de {tipo === 'vendido' ? 'Venda' : 'Morte'} registado no histórico.
      </Text>
    </Card>
  );
}

function HeroChip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderRadius: radii.pill,
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
      }}>
      <Icon name={icon} size={15} color={colors.textOnDark} />
      <Text variant="caption" color={colors.textOnDark}>
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
          Sem registo
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
