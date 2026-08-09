import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import type { EventoAgenda } from '@/data/agenda';
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
 * O mês em grelha, com o que está marcado e o que está a vencer.
 * ------------------------------------------------------------------
 * Irmão do `CalendarioAlertas` (que vive na aba Alertas e mostra a lista do dia
 * por baixo) e diferente dele numa coisa que muda tudo: aqui um dia ABRE UM
 * MODAL. Este calendário está no cimo do Início, onde o espaço é o que é —
 * pendurar-lhe a lista do dia por baixo empurrava as explorações e os atalhos
 * para fora do primeiro ecrã, que é o que o criador vê quando pega no
 * telemóvel.
 *
 * Mostra as DUAS coisas que têm dia marcado, e mostra-as com marcas diferentes:
 * os eventos que as pessoas escreveram (ponto cheio, cor da marca) e os prazos
 * que a app calcula (ponto da cor da gravidade). Separá-los em dois calendários
 * era pedir a quem organiza a semana que olhasse para dois sítios e fizesse a
 * junção de cabeça.
 */
export function CalendarioAgenda({
  eventosPorDia,
  alertas,
  onAbrirDia,
}: {
  /** Os eventos da agenda, agrupados por dia (`useAgenda().porDia`). */
  eventosPorDia: Map<string, EventoAgenda[]>;
  alertas: Alerta[];
  onAbrirDia: (dia: string) => void;
}) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());

  const alertasPorDia = useMemo(() => agruparPorDia(alertas), [alertas]);
  const celulas = useMemo(() => celulasDoMes(ano, mes), [ano, mes]);

  const chaveHoje = chaveDia(hoje);
  const noMesDeHoje = ano === hoje.getFullYear() && mes === hoje.getMonth();

  function andar(passo: number) {
    const v = mesVizinho(ano, mes, passo);
    setAno(v.ano);
    setMes(v.mes);
  }

  return (
    <Card padded={false} style={{ padding: spacing.xs, marginBottom: spacing.md }}>
      {/* Mês a mês */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.xs,
          marginBottom: spacing.xs,
        }}>
        <Seta icon="chevron-left" label={t('calendario.mesAnterior')} onPress={() => andar(-1)} />
        <Pressable
          onPress={() => {
            setAno(hoje.getFullYear());
            setMes(hoje.getMonth());
          }}
          disabled={noMesDeHoje}
          accessibilityRole="button"
          accessibilityLabel={noMesDeHoje ? rotuloMes(ano, mes) : t('calendario.voltarAHoje')}
          style={({ pressed }) => [{ flex: 1 }, pressed && !noMesDeHoje && { opacity: 0.6 }]}>
          <Text variant="h3" center numberOfLines={1}>
            {rotuloMes(ano, mes)}
          </Text>
          {/* Só aparece fora do mês corrente, e é o próprio título que serve de
              botão: um "Hoje" permanente ocupava uma linha inteira para não
              fazer nada onze meses em doze. */}
          {!noMesDeHoje ? (
            <Text variant="caption" color={colors.primary} center>
              voltar a hoje
            </Text>
          ) : null}
        </Pressable>
        <Seta icon="chevron-right" label={t('calendario.mesSeguinte')} onPress={() => andar(1)} />
      </View>

      {/* Iniciais dos dias, de segunda a domingo */}
      <View style={{ flexDirection: 'row' }}>
        {diasDaSemana().map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
            <Text variant="caption" color={colors.textMuted}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {celulas.map((c) => {
          const doDia = eventosPorDia.get(c.chave) ?? [];
          const avisos = alertasPorDia.get(c.chave) ?? [];
          return (
            <Dia
              key={c.chave}
              numero={c.data.getDate()}
              doMes={c.doMes}
              hoje={c.chave === chaveHoje}
              eventos={doDia.length}
              gravidade={piorGravidade(avisos)}
              avisos={avisos.length}
              descricao={c.descricao}
              onPress={() => onAbrirDia(c.chave)}
            />
          );
        })}
      </View>
    </Card>
  );
}

/**
 * Um dia da grelha.
 *
 * A cor nunca decide sozinha: tocar no dia abre a lista escrita, com título,
 * hora e prazo em palavras. As marcas servem para saber ONDE tocar, não o que
 * lá está — que é a única forma de isto servir a quem não distingue as cores.
 */
function Dia({
  numero,
  doMes,
  hoje,
  eventos,
  gravidade,
  avisos,
  descricao,
  onPress,
}: {
  numero: number;
  doMes: boolean;
  hoje: boolean;
  eventos: number;
  gravidade?: AlertaGravidade;
  avisos: number;
  descricao: string;
  onPress: () => void;
}) {
  const corAviso = gravidade ? corDe(gravidade) : undefined;
  const vazio = eventos === 0 && avisos === 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${descricao}. ${rotuloMarcas(eventos, avisos)}`}
      style={({ pressed }) => [
        {
          width: `${100 / 7}%`,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 2,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          // Hoje leva contorno em vez de preenchimento: preenchido, competia
          // com os pontos por baixo e o dia de hoje passava a parecer o dia com
          // mais coisas marcadas.
          borderWidth: hoje ? 2 : 0,
          borderColor: colors.primary,
          backgroundColor: !hoje && !vazio && doMes ? colors.surfaceSunken : 'transparent',
        }}>
        <Text
          variant={vazio ? 'body' : 'bodyStrong'}
          color={doMes ? colors.text : colors.textMuted}>
          {numero}
        </Text>
      </View>

      {/* As marcas do dia: evento (cor da marca) e prazo (cor da gravidade). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 9 }}>
        {eventos > 0 ? (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary }} />
        ) : null}
        {corAviso ? (
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: corAviso }} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** O que se anuncia a quem ouve o ecrã: "2 eventos e 1 prazo." */
function rotuloMarcas(eventos: number, avisos: number): string {
  if (eventos === 0 && avisos === 0) return t('calendario.nadaMarcado');
  const partes: string[] = [];
  if (eventos > 0) partes.push(t('calendario.nEventos', { n: eventos }));
  if (avisos > 0) partes.push(t('calendario.nPrazos', { n: avisos }));
  return `${partes.join(' e ')}.`;
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
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceAlt,
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size="lg" color={colors.primaryDark} />
    </Pressable>
  );
}
