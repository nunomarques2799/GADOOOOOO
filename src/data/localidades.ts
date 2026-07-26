/**
 * Procura de localidades — lógica pura (só precisa de um `fetch`).
 * ------------------------------------------------------------------
 * A localização da exploração era um campo de texto livre, e é dela que sai a
 * meteorologia: escrever "Idanha" ou "idanha a nova" dava um sítio diferente (ou
 * nenhum) do que escrever o nome como o geocodificador o conhece. Aqui as
 * sugestões vêm da MESMA API que depois converte o texto em coordenadas
 * (Open-Meteo Geocoding, gratuita e sem chave — ver `useMeteorologia.ts`), por
 * isso o que se escolhe da lista é garantidamente encontrável a seguir.
 *
 * Não é obrigatório escolher da lista: quem tem um lugar que a API não conhece
 * continua a poder escrever o que quiser. Sem rede, a lista simplesmente não
 * aparece — a app é offline-first e um campo de texto não pode depender disso.
 */

/** Uma localidade sugerida. */
export type Localidade = {
  /** Chave estável para as listas do React. */
  id: string;
  /** O que se grava no campo: "Idanha-a-Nova, Castelo Branco". */
  etiqueta: string;
  /** Nome da terra, sem a região. */
  nome: string;
  /** Distrito/região, quando a API a conhece. */
  regiao?: string;
  /** País, para distinguir uma "Braga" portuguesa de outra qualquer. */
  pais?: string;
  latitude: number;
  longitude: number;
};

/** Resposta da Open-Meteo Geocoding, na parte que nos interessa. */
type RespostaGeocoding = {
  results?: {
    id?: number;
    name?: string;
    latitude?: number;
    longitude?: number;
    /** Distrito (admin1) e concelho (admin2), conforme o país. */
    admin1?: string;
    admin2?: string;
    country?: string;
    country_code?: string;
  }[];
};

const URL_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

/** A partir de quantas letras vale a pena perguntar à API. */
export const MINIMO_LETRAS = 3;

/**
 * Cache por texto procurado. Escrever apaga e volta a escrever a mesma letra é
 * o mais comum do mundo num teclado de telemóvel; sem isto era um pedido novo
 * de cada vez.
 */
const cache = new Map<string, Localidade[]>();

/**
 * O nome da região como um criador a diz: "Portalegre", não "Distrito de
 * Portalegre" — é assim que a API devolve os distritos portugueses, e o prefixo
 * ocupava metade da linha sem acrescentar nada.
 */
function limparRegiao(regiao: string): string {
  return regiao
    .replace(/^distrito d[eoa]s?\s+/i, '')
    .replace(/^regi[ãa]o aut[óo]noma d[eoa]s?\s+/i, '')
    .trim();
}

/** Como a localidade se lê numa linha: "Idanha-a-Nova, Castelo Branco". */
function etiquetaDe(nome: string, regiao?: string): string {
  return regiao && regiao !== nome ? `${nome}, ${regiao}` : nome;
}

/**
 * Converte a resposta da API em sugestões, pela ordem em que se devem mostrar.
 *
 * Portugal primeiro: a app é para criadores portugueses, e a API devolve as
 * homónimas do Brasil e dos Estados Unidos à frente com frequência — "Braga"
 * traz uma Braga em qualquer sítio menos no Minho. As de fora ficam, mas em
 * baixo e com o país à frente, para quem tem terras do outro lado da fronteira.
 */
export function interpretarLocalidades(dados: unknown): Localidade[] {
  const resultados = (dados as RespostaGeocoding)?.results ?? [];
  const vistos = new Set<string>();
  const out: Localidade[] = [];

  for (const r of resultados) {
    const nome = (r.name ?? '').trim();
    if (!nome || r.latitude == null || r.longitude == null) continue;
    // admin1 é o distrito; admin2 (concelho) só serve quando repete a terra.
    const regiao = limparRegiao(r.admin1 ?? r.admin2 ?? '') || undefined;
    const etiqueta = etiquetaDe(nome, regiao);
    const pais = (r.country ?? '').trim() || undefined;
    const ehPt = (r.country_code ?? '').toUpperCase() === 'PT';
    // A mesma terra vem repetida quando a API tem várias entradas para ela
    // (freguesia e concelho com o mesmo nome). Uma linha basta.
    const chave = `${etiqueta.toLowerCase()}|${ehPt ? 'pt' : (pais ?? '').toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({
      id: String(r.id ?? `${r.latitude},${r.longitude}`),
      etiqueta,
      nome,
      regiao,
      pais: ehPt ? undefined : pais,
      latitude: r.latitude,
      longitude: r.longitude,
    });
  }

  // `sort` estável: dentro de cada grupo mantém-se a ordem da API, que já vem
  // por relevância.
  return out.sort((a, b) => Number(!!a.pais) - Number(!!b.pais));
}

/**
 * Procura localidades para o que está escrito. Devolve `[]` para textos curtos
 * demais e propaga o `AbortError` de quem cancelou (o campo cancela o pedido
 * anterior a cada letra nova).
 */
export async function procurarLocalidades(
  texto: string,
  opcoes: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<Localidade[]> {
  const termo = texto.trim();
  if (termo.length < MINIMO_LETRAS) return [];

  const chave = termo.toLowerCase();
  const guardado = cache.get(chave);
  if (guardado) return guardado;

  const params = new URLSearchParams({
    name: termo,
    count: '8',
    language: 'pt',
    format: 'json',
  });
  const buscar = opcoes.fetchImpl ?? fetch;
  const resp = await buscar(`${URL_BASE}?${params}`, { signal: opcoes.signal });
  if (!resp.ok) throw new Error(`A procura de localidades respondeu ${resp.status}`);
  const lista = interpretarLocalidades(await resp.json());
  cache.set(chave, lista);
  return lista;
}

/** Só para os testes: esvazia a cache entre casos. */
export function limparCacheLocalidades(): void {
  cache.clear();
}
