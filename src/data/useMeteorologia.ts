/**
 * Hook de meteorologia para uma dada exploração.
 * ------------------------------------------------------------------
 * Usa as coordenadas GPS dos terrenos da exploração; se não houver
 * nenhuma, tenta geo-codificar a localização textual via Open-Meteo
 * Geocoding API (também gratuita e sem chave).
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

  // Coordenadas diretas dos terrenos (prioridade).
  const localDireto = useMemo<LocalMeteo | null>(() => {
    const t = terrenos.find((t) => t.latitude != null && t.longitude != null);
    if (t?.latitude != null && t.longitude != null) {
      return {
        latitude: t.latitude,
        longitude: t.longitude,
        local: exploracao?.localizacao?.split(',')[0]?.trim() || t.nome,
      };
    }
    return null;
  }, [terrenos, exploracao]);

  const textoLocal = exploracao?.localizacao?.trim() || null;
  const controladorRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controladorRef.current?.abort();
    const controlador = new AbortController();
    controladorRef.current = controlador;

    if (!exploracao) {
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
        setMeteo(m);
        setEstado('atual');
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setEstado('offline');
      }
    }

    void obter();
    return () => controlador.abort();
  }, [exploracao, localDireto, textoLocal, tentativa]);

  return {
    meteo,
    estado,
    recarregar: () => setTentativa((n) => n + 1),
  };
}
