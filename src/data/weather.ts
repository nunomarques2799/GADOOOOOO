/**
 * Meteorologia real — Open-Meteo (https://open-meteo.com).
 * ------------------------------------------------------------------
 * Escolhido em vez do OpenWeatherMap por não exigir chave de API
 * (nada de segredos a gerir) e por ser gratuito e sem limites práticos
 * para uso pessoal — alinhado com o princípio offline-first do projeto.
 * A meteorologia é obtida por coordenadas GPS (lat/lon do terreno).
 */

import type { IconName } from '@/components/ui';

import type { Meteorologia } from './types';

/** Agrupamento do estado do tempo, para escolher conselho e ícone. */
type GrupoTempo = 'limpo' | 'nuvens' | 'nevoeiro' | 'chuva' | 'neve' | 'trovoada';

/** Descrição PT-PT + grupo para cada código WMO (weather_code). */
const CODIGOS_WMO: Record<number, { condicao: string; grupo: GrupoTempo }> = {
  0: { condicao: 'Céu limpo', grupo: 'limpo' },
  1: { condicao: 'Pouco nublado', grupo: 'limpo' },
  2: { condicao: 'Parcialmente nublado', grupo: 'nuvens' },
  3: { condicao: 'Encoberto', grupo: 'nuvens' },
  45: { condicao: 'Nevoeiro', grupo: 'nevoeiro' },
  48: { condicao: 'Nevoeiro com geada', grupo: 'nevoeiro' },
  51: { condicao: 'Chuvisco fraco', grupo: 'chuva' },
  53: { condicao: 'Chuvisco', grupo: 'chuva' },
  55: { condicao: 'Chuvisco forte', grupo: 'chuva' },
  56: { condicao: 'Chuvisco gelado', grupo: 'chuva' },
  57: { condicao: 'Chuvisco gelado forte', grupo: 'chuva' },
  61: { condicao: 'Chuva fraca', grupo: 'chuva' },
  63: { condicao: 'Chuva', grupo: 'chuva' },
  65: { condicao: 'Chuva forte', grupo: 'chuva' },
  66: { condicao: 'Chuva gelada', grupo: 'chuva' },
  67: { condicao: 'Chuva gelada forte', grupo: 'chuva' },
  71: { condicao: 'Neve fraca', grupo: 'neve' },
  73: { condicao: 'Neve', grupo: 'neve' },
  75: { condicao: 'Neve forte', grupo: 'neve' },
  77: { condicao: 'Grãos de neve', grupo: 'neve' },
  80: { condicao: 'Aguaceiros fracos', grupo: 'chuva' },
  81: { condicao: 'Aguaceiros', grupo: 'chuva' },
  82: { condicao: 'Aguaceiros fortes', grupo: 'chuva' },
  85: { condicao: 'Aguaceiros de neve', grupo: 'neve' },
  86: { condicao: 'Aguaceiros de neve fortes', grupo: 'neve' },
  95: { condicao: 'Trovoada', grupo: 'trovoada' },
  96: { condicao: 'Trovoada com granizo', grupo: 'trovoada' },
  99: { condicao: 'Trovoada com granizo forte', grupo: 'trovoada' },
};

const DESCONHECIDO = { condicao: 'Tempo variável', grupo: 'nuvens' as const };

/** Ícone MaterialCommunityIcons para o código WMO (varia dia/noite). */
function iconePara(code: number, dia: boolean): IconName {
  if (code === 0) return dia ? 'weather-sunny' : 'weather-night';
  if (code === 1 || code === 2) return dia ? 'weather-partly-cloudy' : 'weather-night-partly-cloudy';
  if (code === 3) return 'weather-cloudy';
  if (code === 45 || code === 48) return 'weather-fog';
  if (code >= 51 && code <= 57) return 'weather-partly-rainy';
  if (code === 65 || code === 82) return 'weather-pouring';
  if ((code >= 61 && code <= 64) || code === 80 || code === 81) return 'weather-rainy';
  if (code === 66 || code === 67) return 'weather-snowy-rainy';
  if (code === 75 || code === 86) return 'weather-snowy-heavy';
  if ((code >= 71 && code <= 77) || code === 85) return 'weather-snowy';
  if (code === 95) return 'weather-lightning';
  if (code === 96 || code === 99) return 'weather-lightning-rainy';
  return 'weather-cloudy';
}

/**
 * Conselho prático para o criador, conforme as condições. Ordenado por
 * prioridade (o risco mais relevante para os animais aparece primeiro).
 */
function conselhoPecuario(o: {
  grupo: GrupoTempo;
  maxima: number;
  minima: number;
  vento: number;
  precipitacao: number;
}): string {
  if (o.grupo === 'trovoada') return 'Trovoada prevista — recolha os animais e evite zonas abertas.';
  if (o.grupo === 'neve') return 'Neve — proteja os animais e garanta água que não congele.';
  if (o.minima <= 2) return 'Noite fria — vigie os recém-nascidos e os animais mais fracos.';
  if (o.grupo === 'chuva' || o.precipitacao >= 1) return 'Chuva prevista — verifique abrigos e zonas de lama.';
  if (o.maxima >= 32) return 'Calor forte — reforce a água e a sombra a meio do dia.';
  if (o.vento >= 35) return 'Vento forte — reveja cercas, telheiros e coberturas.';
  if (o.grupo === 'nevoeiro') return 'Nevoeiro — atenção nas deslocações e no maneio.';
  if (o.maxima >= 26) return 'Dia quente — garanta água fresca disponível todo o dia.';
  return 'Tempo calmo — bom dia para trabalhos no campo.';
}

/** Coordenadas + nome do local para a consulta meteorológica. */
export type LocalMeteo = { latitude: number; longitude: number; local: string };

/** Resposta parcial da Open-Meteo que nos interessa. */
type OpenMeteoResp = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    is_day?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

/**
 * Obtém a meteorologia atual para as coordenadas dadas. Lança em caso de
 * falha de rede ou resposta inválida — quem chama decide o fallback.
 */
export async function fetchMeteorologia(
  loc: LocalMeteo,
  signal?: AbortSignal,
): Promise<Meteorologia> {
  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
  });
  const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!resp.ok) throw new Error(`Open-Meteo respondeu ${resp.status}`);

  const dados = (await resp.json()) as OpenMeteoResp;
  const cur = dados.current;
  if (!cur || cur.temperature_2m == null) throw new Error('Resposta meteorológica sem dados atuais');

  const code = Number(cur.weather_code ?? 3);
  const info = CODIGOS_WMO[code] ?? DESCONHECIDO;
  const dia = cur.is_day !== 0;

  const maxima = Math.round(dados.daily?.temperature_2m_max?.[0] ?? cur.temperature_2m);
  const minima = Math.round(dados.daily?.temperature_2m_min?.[0] ?? cur.temperature_2m);
  const vento = Math.round(cur.wind_speed_10m ?? 0);
  const precipitacao = Math.round((cur.precipitation ?? 0) * 10) / 10;

  return {
    local: loc.local,
    temperatura: Math.round(cur.temperature_2m),
    condicao: info.condicao,
    icone: iconePara(code, dia),
    humidade: Math.round(cur.relative_humidity_2m ?? 0),
    vento,
    precipitacao,
    maxima,
    minima,
    conselho: conselhoPecuario({ grupo: info.grupo, maxima, minima, vento, precipitacao }),
  };
}
