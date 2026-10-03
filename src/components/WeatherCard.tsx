import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Icon, type IconName, Text } from '@/components/ui';
import type { MeteoEstado } from '@/data/store';
import type { DiaMeteo, Meteorologia } from '@/data/types';
import { t, type ChaveTexto } from '@/i18n';
import { colors, fontFamily, radii, spacing } from '@/theme';

/**
 * Cartão de meteorologia, no papel do guia de estilo: cartão claro com risca
 * fina, números em Fraunces e o azul de informação nos ícones. Era um bloco
 * verde-escuro em degradê, do desenho de antes da marca nova.
 */
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
    <View
      style={{
        borderRadius: radii.xl,
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs }}>
            <Icon name="map-marker" size="sm" color={colors.textSecondary} />
            <Text variant="label" color={colors.textSecondary}>
              {meteo.local}
            </Text>
            <EstadoMeteo estado={estado} onRecarregar={onRecarregar} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: fontFamily.titulo, fontSize: 52, lineHeight: 58, color: colors.text }}>
              {meteo.temperatura}
            </Text>
            <Text style={{ fontFamily: fontFamily.bold, fontSize: 24, color: colors.text, marginTop: 6 }}>
              {t('meteo.grausC')}
            </Text>
          </View>
          <Text variant="bodyStrong" color={colors.text}>
            {meteo.condicao}
          </Text>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meteo.icone as IconName} size={72} color={colors.info} />
          <Text variant="caption" color={colors.textSecondary}>
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
          borderTopColor: colors.border,
        }}>
        <Metric icon="water-percent" label={t('meteo.humidade')} value={`${meteo.humidade}%`} />
        <Metric icon="weather-windy" label={t('meteo.vento')} value={`${meteo.vento} km/h`} />
        <Metric icon="weather-pouring" label={t('meteo.precipitacao')} value={`${meteo.precipitacao} mm`} />
      </View>

      {/* Amanhã, à vista. É a pergunta que se faz de véspera — dá para semear,
          dá para largar o gado, é preciso recolher? — e não devia obrigar a
          abrir nada. Os outros seis ficam por baixo, a um toque. */}
      {amanha ? (
        <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <LinhaDia dia={amanha} rotulo={t('meteo.amanha')} destaque />

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
                  aberto
                    ? t('meteo.esconderDias')
                    : t('meteo.verProximosDias', { n: proximos.length })
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
                <Icon name={aberto ? 'chevron-up' : 'chevron-down'} size="md" color={colors.text} />
                <Text variant="bodyStrong" color={colors.text}>
                  {aberto ? t('meteo.mostrarMenos') : t('meteo.proximosDias', { n: proximos.length })}
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
          backgroundColor: colors.infoTint,
          borderRadius: radii.md,
          padding: spacing.sm,
        }}>
        <Icon name="information" size="sm" color={colors.info} />
        <Text variant="secondary" color={colors.text} style={{ flex: 1 }}>
          {meteo.conselho}
        </Text>
      </View>
    </View>
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
        color={destaque ? colors.text : colors.textSecondary}
        style={{ width: 74 }}
        numberOfLines={1}>
        {rotulo}
      </Text>
      <Icon name={dia.icone as IconName} size={destaque ? 'lg' : 'md'} color={colors.info} />
      <View style={{ flex: 1 }}>
        <Text
          variant={destaque ? 'bodyStrong' : 'secondary'}
          color={destaque ? colors.text : colors.textSecondary}
          numberOfLines={1}>
          {dia.condicao}
        </Text>
        {chuva ? (
          <Text variant="caption" color={colors.textSecondary}>
            {t('meteo.chuva', { chuva })}
          </Text>
        ) : null}
      </View>
      <Text variant={destaque ? 'bodyStrong' : 'secondary'} color={colors.text}>
        {dia.maxima}° / {dia.minima}°
      </Text>
    </View>
  );
}

/** Guardam a CHAVE: uma tabela de módulo congelava a língua de arranque. */
const DIAS_SEMANA: ChaveTexto[] = [
  'dia.domingo',
  'dia.segunda',
  'dia.terca',
  'dia.quarta',
  'dia.quinta',
  'dia.sexta',
  'dia.sabado',
];

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
  return `${t(DIAS_SEMANA[d.getDay()])}, ${dia}/${mes}`;
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
    return <ActivityIndicator size="small" color={colors.textSecondary} style={{ marginLeft: 2 }} />;
  }

  const offline = estado === 'offline';
  const conteudo = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={offline ? 'cloud-off-outline' : 'refresh'} size={14} color={colors.textSecondary} />
      {offline ? (
        <Text variant="caption" color={colors.textSecondary}>
          {t('meteo.semLigacao')}
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
      accessibilityLabel={t('meteo.atualizar')}
      style={({ pressed }) => [{ marginLeft: 2 }, pressed && { opacity: 0.6 }]}>
      {conteudo}
    </Pressable>
  );
}

function Metric({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Icon name={icon} size="sm" color={colors.info} />
      <Text variant="bodyStrong" color={colors.text}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
    </View>
  );
}
