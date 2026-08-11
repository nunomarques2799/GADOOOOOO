import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AlertItem } from '@/components/AlertItem';
import { Card, Icon, Text } from '@/components/ui';
import {
  agruparPorDia,
  celulasDoMes,
  chaveDia,
  diasDaSemana,
  mesVizinho,
  piorGravidade,
  rotuloMes,
} from '@/data/calendario';
import type { Alerta, AlertaGravidade } from '@/data/types';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/** A cor de cada gravidade. Semânticas — não mudam com a paleta escolhida. */
function corDe(g: AlertaGravidade): string {
  return g === 'urgente' ? colors.danger : g === 'aviso' ? colors.warning : colors.info;
}

/**
 * Os alertas num mês, dia a dia.
 *
 * A lista de alertas diz o que está atrasado; isto diz o que aí vem. É a
 * diferença entre "tenho três coisas por fazer" e "na quinta-feira tenho dois
 * partos e uma revacinação" — que é a forma como se organiza uma semana de
 * trabalho no campo.
 *
 * Os alertas sem dia marcado (um animal sem nenhuma vacinação registada) não
 * aparecem na grelha: não são tarefa marcada para dia nenhum. Contam-se ao
 * fundo, para não desaparecerem de vista só por não terem data.
 */
export function CalendarioAlertas({
  alertas,
  onDispensar,
}: {
  alertas: Alerta[];
  onDispensar?: (a: Alerta) => void;
}) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [diaEscolhido, setDiaEscolhido] = useState<string>(chaveDia(hoje));

  const porDia = useMemo(() => agruparPorDia(alertas), [alertas]);
  const celulas = useMemo(() => celulasDoMes(ano, mes), [ano, mes]);

  const chaveHoje = chaveDia(hoje);
  const noMesDeHoje = ano === hoje.getFullYear() && mes === hoje.getMonth();
  const doDia = porDia.get(diaEscolhido) ?? [];
  const semData = alertas.filter((a) => !a.data).length;

  function andar(passo: number) {
    const v = mesVizinho(ano, mes, passo);
    setAno(v.ano);
    setMes(v.mes);
  }

  function irParaHoje() {
    setAno(hoje.getFullYear());
    setMes(hoje.getMonth());
    setDiaEscolhido(chaveHoje);
  }

  return (
    <View>
      {/* Mês a mês */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          marginBottom: spacing.sm,
        }}>
        <Seta icon="chevron-left" label={t('calendario.mesAnterior')} onPress={() => andar(-1)} />
        <Text variant="h3" center style={{ flex: 1 }}>
          {rotuloMes(ano, mes)}
        </Text>
        <Seta icon="chevron-right" label={t('calendario.mesSeguinte')} onPress={() => andar(1)} />
      </View>

      {!noMesDeHoje ? (
        <Pressable
          onPress={irParaHoje}
          accessibilityRole="button"
          accessibilityLabel={t('calendario.voltarAHoje')}
          style={({ pressed }) => [
            {
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radii.pill,
              backgroundColor: colors.primaryTint,
              marginBottom: spacing.sm,
            },
            pressed && { opacity: 0.7 },
          ]}>
          <Icon name="calendar-today" size="sm" color={colors.primaryDark} />
          <Text variant="label" color={colors.primaryDark}>
            {t('alerta.hoje')}
          </Text>
        </Pressable>
      ) : null}

      <Card padded={false} style={{ padding: spacing.xs, marginBottom: spacing.md }}>
        {/* Iniciais dos dias, de segunda a domingo */}
        <View style={{ flexDirection: 'row' }}>
          {diasDaSemana().map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
              <Text variant="caption" color={colors.textMuted}>
                {d}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {celulas.map((c) => {
            const doDiaCelula = porDia.get(c.chave) ?? [];
            const pior = piorGravidade(doDiaCelula);
            return (
              <Dia
                key={c.chave}
                numero={c.data.getDate()}
                doMes={c.doMes}
                hoje={c.chave === chaveHoje}
                escolhido={c.chave === diaEscolhido}
                gravidade={pior}
                quantos={doDiaCelula.length}
                descricao={c.descricao}
                onPress={() => setDiaEscolhido(c.chave)}
              />
            );
          })}
        </View>
      </Card>

      {/* O que há no dia escolhido */}
      <Text variant="h3" style={{ marginBottom: spacing.sm }}>
        {tituloDoDia(diaEscolhido, chaveHoje)}
      </Text>

      {doDia.length === 0 ? (
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="check-circle-outline" size="md" color={colors.success} />
            <Text variant="body" color={colors.textSecondary} style={{ flex: 1 }}>
              {t('calendario.nadaNesteDia')}
            </Text>
          </View>
        </Card>
      ) : (
        <Card padded={false} style={{ marginBottom: spacing.md }}>
          <View style={{ paddingHorizontal: spacing.md }}>
            {doDia.map((a, i) => (
              <AlertItem
                key={a.id}
                alerta={a}
                divider={i < doDia.length - 1}
                onDispensar={onDispensar}
              />
            ))}
          </View>
        </Card>
      )}

      {semData > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.xs,
            alignItems: 'flex-start',
            backgroundColor: colors.infoTint,
            borderRadius: radii.md,
            padding: spacing.md,
          }}>
          <Icon name="information" size="md" color={colors.info} />
          <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
            {semData === 1
              ? 'Há 1 aviso sem dia marcado (por exemplo, um animal sem nenhuma vacinação registada). Está na lista.'
              : `Há ${semData} avisos sem dia marcado (por exemplo, animais sem nenhuma vacinação registada). Estão na lista.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** "Hoje, 24 de julho" ou "3 de julho de 2026". */
function tituloDoDia(chave: string, chaveHoje: string): string {
  const [ano, mes, dia] = chave.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  const porExtenso = `${d.getDate()} de ${rotuloMes(ano, mes - 1)}`;
  return chave === chaveHoje ? `Hoje, ${porExtenso}` : porExtenso;
}

function Seta({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="lg" color={colors.primaryDark} />
    </Pressable>
  );
}

/**
 * Um dia da grelha.
 *
 * A cor do ponto nunca decide sozinha: o dia escolhido abre a lista por baixo,
 * onde cada alerta vem com ícone, título e prazo escritos. O ponto serve para
 * saber ONDE tocar, não para saber o que lá está.
 */
function Dia({
  numero,
  doMes,
  hoje,
  escolhido,
  gravidade,
  quantos,
  descricao,
  onPress,
}: {
  numero: number;
  doMes: boolean;
  hoje: boolean;
  escolhido: boolean;
  gravidade?: AlertaGravidade;
  quantos: number;
  descricao: string;
  onPress: () => void;
}) {
  const cor = gravidade ? corDe(gravidade) : undefined;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhido }}
      accessibilityLabel={
        quantos === 0
          ? `${descricao}. Nada marcado.`
          : `${descricao}. ${quantos} ${quantos === 1 ? 'aviso' : 'avisos'}.`
      }
      style={({ pressed }) => [
        {
          width: `${100 / 7}%`,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 4,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: escolhido ? colors.primary : 'transparent',
          // Hoje fica com contorno em vez de preenchimento: assim continua a
          // ver-se qual é o dia de hoje mesmo com outro dia escolhido.
          borderWidth: hoje && !escolhido ? 2 : 0,
          borderColor: colors.primary,
        }}>
        <Text
          variant={quantos > 0 || hoje ? 'bodyStrong' : 'body'}
          color={
            escolhido
              ? colors.onPrimary
              : doMes
                ? colors.text
                : colors.textMuted
          }>
          {numero}
        </Text>
      </View>

      {/* Marca do dia: ponto colorido e, com mais de um, o número */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 10 }}>
        {cor ? (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cor }} />
        ) : null}
        {quantos > 1 ? (
          <Text variant="caption" color={escolhido ? colors.text : colors.textMuted}>
            {quantos}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
