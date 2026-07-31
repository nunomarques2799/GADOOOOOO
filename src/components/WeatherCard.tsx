import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import type { MeteoEstado } from '@/data/store';
import type { DiaMeteo, Meteorologia } from '@/data/types';
import { colors, radii, shadow, spacing } from '@/theme';

/** Linha branca ténue que separa os blocos dentro do cartão verde. */
const RISCA = 'rgba(255,255,255,0.18)';

/** Cartão de meteorologia — bloco verde como na inspiração. */
export function WeatherCard({
  meteo,
  estado = 'atual',
  onRecarregar,
}: {
  meteo: Meteorologia;
  estado?: MeteoEstado;
  onRecarregar?: () => void;
}) {
  // Os próximos dias, sem hoje: hoje já está desenhado em grande aqui em cima,
  // e repeti-lo na lista fazia a pessoa contar mal os dias que faltam.
  const proximos = meteo.dias.slice(1);
  const amanha = proximos[0];
  const [aberto, setAberto] = useState(false);

  return (
    <LinearGradient
      colors={[colors.headerTo, colors.headerFrom]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radii.xl, padding: spacing.lg }, shadow.md]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs }}>
            <Icon name="map-marker" size="sm" color={colors.textOnDarkMuted} />
            <Text variant="label" color={colors.textOnDarkMuted}>
              {meteo.local}
            </Text>
            <EstadoMeteo estado={estado} onRecarregar={onRecarregar} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 52, lineHeight: 58, color: colors.textOnDark }}>
              {meteo.temperatura}
            </Text>
            <Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 24, color: colors.textOnDark, marginTop: 6 }}>
              °C
            </Text>
          </View>
          <Text variant="bodyStrong" color={colors.textOnDark}>
            {meteo.condicao}
          </Text>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meteo.icone as IconName} size={72} color={colors.textOnDark} />
          <Text variant="caption" color={colors.textOnDarkMuted}>
            {meteo.maxima}° / {meteo.minima}°
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          marginTop: spacing.md,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderTopColor: RISCA,
        }}>
        <Metric icon="water-percent" label="Humidade" value={`${meteo.humidade}%`} />
        <Metric icon="weather-windy" label="Vento" value={`${meteo.vento} km/h`} />
        <Metric icon="weather-pouring" label="Precip." value={`${meteo.precipitacao} mm`} />
      </View>

      {/* Amanhã, à vista. É a pergunta que se faz de véspera — dá para semear,
          dá para largar o gado, é preciso recolher? — e não devia obrigar a
          abrir nada. Os outros seis ficam por baixo, a um toque. */}
      {amanha ? (
        <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: RISCA }}>
          <LinhaDia dia={amanha} rotulo="Amanhã" destaque />

          {proximos.length > 1 ? (
            <>
              {aberto ? (
                <View style={{ marginTop: spacing.xs }}>
                  {proximos.slice(1).map((d) => (
                    <LinhaDia key={d.data} dia={d} rotulo={rotuloDia(d.data)} />
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={() => setAberto((a) => !a)}
                accessibilityRole="button"
                accessibilityState={{ expanded: aberto }}
                accessibilityLabel={
                  aberto ? 'Esconder os próximos dias' : `Ver os próximos ${proximos.length} dias`
                }
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    marginTop: spacing.xs,
                    paddingVertical: spacing.xs,
                  },
                  pressed && { opacity: 0.7 },
                ]}>
                <Icon name={aberto ? 'chevron-up' : 'chevron-down'} size="md" color={colors.textOnDark} />
                <Text variant="bodyStrong" color={colors.textOnDark}>
                  {aberto ? 'Mostrar menos' : `Próximos ${proximos.length} dias`}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: spacing.md,
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: radii.md,
          padding: spacing.sm,
        }}>
        <Icon name="information" size="sm" color={colors.textOnDark} />
        <Text variant="secondary" color={colors.textOnDark} style={{ flex: 1 }}>
          {meteo.conselho}
        </Text>
      </View>
    </LinearGradient>
  );
}

/**
 * Um dia da previsão, em linha.
 *
 * Em LINHA e não em cartões lado a lado: sete colunas num ecrã de telemóvel dão
 * ~45px cada, e com a letra do sistema ampliada ao máximo (que este público usa)
 * "26°/11°" não cabe em nenhuma delas. Em linha, cada dia cresce para baixo.
 */
function LinhaDia({
  dia,
  rotulo,
  destaque,
}: {
  dia: DiaMeteo;
  rotulo: string;
  destaque?: boolean;
}) {
  // A chuva só aparece quando há: um "0 mm" em cada linha é uma coluna de zeros
  // que rouba a atenção ao único dia em que interessa.
  const chuva =
    dia.probabilidadeChuva != null && dia.probabilidadeChuva >= 20
      ? `${dia.probabilidadeChuva}%`
      : dia.precipitacao >= 0.5
        ? `${dia.precipitacao} mm`
        : null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: destaque ? 2 : spacing.xs,
      }}
      accessibilityLabel={`${rotulo}: ${dia.condicao}, máxima ${dia.maxima} graus, mínima ${dia.minima} graus${
        chuva ? `, chuva ${chuva}` : ''
      }`}>
      <Text
        variant={destaque ? 'bodyStrong' : 'secondary'}
        color={destaque ? colors.textOnDark : colors.textOnDarkMuted}
        style={{ width: 74 }}
        numberOfLines={1}>
        {rotulo}
      </Text>
      <Icon name={dia.icone as IconName} size={destaque ? 'lg' : 'md'} color={colors.textOnDark} />
      <View style={{ flex: 1 }}>
        <Text
          variant={destaque ? 'bodyStrong' : 'secondary'}
          color={destaque ? colors.textOnDark : colors.textOnDarkMuted}
          numberOfLines={1}>
          {dia.condicao}
        </Text>
        {chuva ? (
          <Text variant="caption" color={colors.textOnDarkMuted}>
            Chuva {chuva}
          </Text>
        ) : null}
      </View>
      <Text variant={destaque ? 'bodyStrong' : 'secondary'} color={colors.textOnDark}>
        {dia.maxima}° / {dia.minima}°
      </Text>
    </View>
  );
}

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * "Quarta, 5/8" — o dia da semana é como se marca trabalho no campo, e a data
 * ao lado tira a dúvida de qual das quartas é.
 *
 * A data vem em `aaaa-mm-dd` e é partida à mão: `new Date('2026-08-05')` é
 * meia-noite em UTC, e a oeste de Greenwich isso é o dia ANTERIOR à noite.
 */
function rotuloDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  if (!ano || !mes || !dia) return iso;
  const d = new Date(ano, mes - 1, dia);
  return `${DIAS_SEMANA[d.getDay()]}, ${dia}/${mes}`;
}

/** Indicador de estado da meteorologia junto ao local (a carregar / offline / atualizar). */
function EstadoMeteo({
  estado,
  onRecarregar,
}: {
  estado: MeteoEstado;
  onRecarregar?: () => void;
}) {
  if (estado === 'a-carregar') {
    return <ActivityIndicator size="small" color={colors.textOnDarkMuted} style={{ marginLeft: 2 }} />;
  }

  const offline = estado === 'offline';
  const conteudo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={offline ? 'cloud-off-outline' : 'refresh'} size={14} color={colors.textOnDarkMuted} />
      {offline ? (
        <Text variant="caption" color={colors.textOnDarkMuted}>
          Sem ligação
        </Text>
      ) : null}
    </View>
  );

  if (!onRecarregar) return offline ? conteudo : null;
  return (
    <Pressable
      onPress={onRecarregar}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Atualizar meteorologia"
      style={({ pressed }) => [{ marginLeft: 2 }, pressed && { opacity: 0.6 }]}>
      {conteudo}
    </Pressable>
  );
}

function Metric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Icon name={icon} size="sm" color={colors.textOnDarkMuted} />
      <Text variant="bodyStrong" color={colors.textOnDark}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textOnDarkMuted}>
        {label}
      </Text>
    </View>
  );
}
