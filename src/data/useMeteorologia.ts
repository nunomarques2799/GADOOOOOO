/**
 * Hook de meteorologia para uma dada exploração.
 * ------------------------------------------------------------------
 * Três origens para o sítio, pela ordem em que se confia nelas:
 *   1. as coordenadas da PRÓPRIA exploração, se o criador as marcou no mapa;
 *   2. as de um terreno com GPS;
 *   3. a localização escrita, passada pela geocodificação do Open-Meteo.
 *
 * A ordem mudou quando a exploração ganhou mapa: antes começava no terreno, e
 * quem tem os cercados espalhados por vinte quilómetros via a previsão do
 * primeiro que por acaso tivesse GPS.
 *
 * CUIDADO COM AS DEPENDÊNCIAS DO EFEITO. Elas são valores simples (números e
 * strings), e têm de continuar a ser. `terrenosByExploracao()` devolve um array
 * NOVO em cada render, e `exploracaoById()` muda de identidade sempre que a
 * lista de explorações é substituída: com qualquer um deles nas dependências, o
 * efeito voltava a correr a cada render, abortava o pedido anterior antes de ele
 * chegar e punha o estado outra vez em 'a-carregar' — o loader que nunca
 * acabava, e que só aparecia a quem tinha coordenadas nalgum lado (sem elas o
 * valor era `null`, que é estável, e o ciclo não se fechava).
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useGado } from './store';
import type { Meteorologia } from './types';
import { fetchMeteorologia, type LocalMeteo } from './weather';

export type EstadoMeteo = 'a-carregar' | 'atual' | 'offline' | 'sem-local';

type Resultado = {
  meteo: Meteorologia | null;
  estado: EstadoMeteo;
  recarregar: () => void;
};

/** Cache simples de coordenadas por texto de localização, para evitar geocoding repetido. */
const cacheGeo = new Map<string, LocalMeteo | null>();

async function geocodificar(texto: string, signal?: AbortSignal): Promise<LocalMeteo | null> {
  const chave = texto.trim().toLowerCase();
  if (cacheGeo.has(chave)) return cacheGeo.get(chave) ?? null;

  const params = new URLSearchParams({
    name: texto.split(',')[0]?.trim() || texto,
    count: '1',
    language: 'pt',
    format: 'json',
  });
  const resp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
  if (!resp.ok) throw new Error(`Geocoding respondeu ${resp.status}`);
  const dados = (await resp.json()) as {
    results?: { latitude: number; longitude: number; name: string; admin1?: string }[];
  };
  const r = dados.results?.[0];
  if (!r) {
    cacheGeo.set(chave, null);
    return null;
  }
  const local: LocalMeteo = {
    latitude: r.latitude,
    longitude: r.longitude,
    local: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
  };
  cacheGeo.set(chave, local);
  return local;
}

export function useMeteorologia(exploracaoId: string | undefined): Resultado {
  const { exploracaoById, terrenosByExploracao } = useGado();
  const [meteo, setMeteo] = useState<Meteorologia | null>(null);
  const [estado, setEstado] = useState<EstadoMeteo>('a-carregar');
  const [tentativa, setTentativa] = useState(0);

  const exploracao = exploracaoId ? exploracaoById(exploracaoId) : undefined;
  const terrenos = exploracaoId ? terrenosByExploracao(exploracaoId) : [];

  // Coordenadas já conhecidas: as da exploração, senão as do primeiro terreno
  // com GPS. Guardadas como três valores simples — ver o aviso no cabeçalho.
  const comGps = terrenos.find((t) => t.latitude != null && t.longitude != null);
  const latitude = exploracao?.latitude ?? comGps?.latitude;
  const longitude = exploracao?.longitude ?? comGps?.longitude;
  const nomeLocal =
    exploracao?.localizacao?.split(',')[0]?.trim() || comGps?.nome || exploracao?.nome || '';
  const textoLocal = exploracao?.localizacao?.trim() || '';
  const existe = !!exploracao;

  const controladorRef = useRef<AbortController | null>(null);

  // O objeto que o `fetch` recebe é montado a partir dos valores simples acima.
  // Fica FORA das dependências do efeito de propósito: é reconstruído a cada
  // render, e não é a identidade dele que decide se é preciso pedir de novo.
  const localDireto = useMemo<LocalMeteo | null>(
    () => (latitude != null && longitude != null
      ? { latitude, longitude, local: nomeLocal || 'A exploração' }
      : null),
    [latitude, longitude, nomeLocal],
  );

  useEffect(() => {
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;

    if (!existe) {
      setEstado('sem-local');
      setMeteo(null);
      return () => controlador.abort();
    }

    setEstado('a-carregar');

    async function obter() {
      try {
        let local = localDireto;
        if (!local && textoLocal) local = await geocodificar(textoLocal, controlador.signal);
        if (!local) {
          setEstado('sem-local');
          setMeteo(null);
          return;
        }
        const m = await fetchMeteorologia(local, controlador.signal);
        if (controlador.signal.aborted) return;
        setMeteo(m);
        setEstado('atual');
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setEstado('offline');
      }
    }

    void obter();
    return () => controlador.abort();
    // `localDireto` está fora de propósito (ver o cabeçalho): o que decide
    // repetir o pedido são as coordenadas em si, não o objeto que as embrulha.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existe, latitude, longitude, nomeLocal, textoLocal, tentativa]);

  return {
    meteo,
    estado,
    recarregar: () => setTentativa((n) => n + 1),
  };
}
