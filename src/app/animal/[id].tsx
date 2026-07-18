import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AlertItem } from '@/components/AlertItem';
import {
  Badge,
  Button,
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
import { especieMeta } from '@/data/constants';
import { avisar, confirmar } from '@/data/avisos';
import { filhosDe, rotuloAnimal } from '@/data/genealogia';
import { balancoAnimal } from '@/data/financas';
import { formatDataCurta, formatDataPt, formatEuro, idadeExtenso, paraEuro, parseDataPt } from '@/data/helpers';
import { useGado } from '@/data/store';
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
    alertas,
    marcarSaida,
    reativarAnimal,
  } = useGado();

  const animal = animalById(id);

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
  const mae = animal.maeId ? animalById(animal.maeId) : undefined;
  const pai = animal.paiId ? animalById(animal.paiId) : undefined;
  const crias = filhosDe(animais, animal.id);
  const eventos = eventosByAnimal(animal.id);
  const balanco = balancoAnimal(eventos);
  const meusAlertas = alertas.filter((a) => a.animalId === animal.id);
  const saiu = animal.estado === 'falecido' || animal.estado === 'vendido';

  async function confirmarSaida() {
    const iso = parseDataPt(saidaData);
    if (!iso) {
      setSaidaErro('Data inválida — use o formato dd/mm/aaaa.');
      return;
    }
    setSaidaErro(null);
    setAGuardar(true);
    try {
      const preco = saidaTipo === 'vendido' ? paraEuro(saidaPreco) : NaN;
      const valor = Number.isFinite(preco) && preco > 0 ? preco : undefined;
      await marcarSaida(animal!.id, saidaTipo, iso, saidaMotivo.trim() || undefined, valor);
      setSaidaOpen(false);
      setSaidaMotivo('');
      setSaidaPreco('');
    } catch (e) {
      avisar('Não foi possível guardar', e instanceof Error ? e.message : String(e));
    } finally {
      setAGuardar(false);
    }
  }

  function pedirReativar() {
    confirmar(
      'Voltar a ativar?',
      'O animal vai voltar a aparecer no efetivo. O evento anterior (Morte/Venda) permanece no histórico.',
      () => {
        void reativarAnimal(animal!.id);
      },
      { rotuloConfirmar: 'Reativar' },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={animal.nome ?? 'Animal'}
        actionIcon="pencil-outline"
        onAction={() => router.push(`/animal/editar/${animal.id}`)}
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
            }}>
            <Icon name={meta.icon} size={52} color={colors.textOnDark} />
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
                icon={animal.estado === 'falecido' ? 'grave-stone' : 'cash'}
                label="Motivo"
                value={animal.estado === 'falecido' ? 'Falecimento' : 'Venda'}
              />
              <InfoField
                icon="calendar"
                label="Data"
                value={animal.dataSaida ? formatDataPt(animal.dataSaida) : '—'}
              />
              <InfoField
                icon="note-text-outline"
                label="Nota"
                value={animal.motivoSaida ?? '—'}
                last
              />
            </Card>
            <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
              O registo permanece guardado para preservar a árvore genealógica dos descendentes.
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
          <InfoField icon="tag-outline" label="Nº de identificação (brinco)" value={animal.numeroIdentificacao ?? '—'} />
          <InfoField icon="calendar-check" label="Data de identificação" value={animal.dataIdentificacao ? formatDataPt(animal.dataIdentificacao) : '—'} />
          <InfoField
            icon="cloud-upload-outline"
            label="SNIRA"
            value={animal.comunicadoSnira === false ? 'Por comunicar' : animal.comunicadoSnira ? 'Comunicado' : '—'}
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
          <InfoField icon="palette-outline" label="Raça / pelagem" value={[animal.raca, animal.corPelagem].filter(Boolean).join(' · ') || '—'} />
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
          <InfoField icon="barn" label="Exploração" value={exploracao?.nome ?? '—'} />
          <InfoField icon="map-marker" label="Terreno atual" value={terreno?.nome ?? 'Sem terreno'} last />
        </Card>

        {/* Balanço económico — só quando há valores registados */}
        {balanco.temDados ? (
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
          {!saiu ? (
            <>
              <Button
                label="Registar evento"
                icon="plus"
                variant="secondary"
                onPress={() => router.push({ pathname: '/evento/novo', params: { animalId: animal.id } })}
              />
              <Button
                label="Editar dados do animal"
                icon="pencil-outline"
                variant="ghost"
                onPress={() => router.push(`/animal/editar/${animal.id}`)}
              />
              {!saidaOpen ? (
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
          ) : (
            <Button
              label="Voltar a ativar o animal"
              icon="restore"
              variant="secondary"
              onPress={pedirReativar}
            />
          )}
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
        <TextField
          value={data}
          onChangeText={onChangeData}
          placeholder="dd/mm/aaaa"
          icon="calendar"
          keyboardType="numbers-and-punctuation"
        />
      </View>
      {tipo === 'vendido' ? (
        <>
          <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
            Preço de venda (€) — opcional
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
      <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: 4 }}>
        Nota (opcional) — comprador, matadouro, causa, etc.
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
          —
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
