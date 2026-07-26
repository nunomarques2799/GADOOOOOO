import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  interpretarLocalidades,
  limparCacheLocalidades,
  MINIMO_LETRAS,
  procurarLocalidades,
} from '../localidades';

/** Uma entrada como a Open-Meteo Geocoding a devolve. */
function resultado(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Idanha-a-Nova',
    latitude: 39.92,
    longitude: -7.24,
    admin1: 'Castelo Branco',
    country: 'Portugal',
    country_code: 'PT',
    ...over,
  };
}

/** Um `fetch` de mentira que devolve o corpo dado e conta as chamadas. */
function fetchFalso(corpo: unknown, { ok = true, status = 200 } = {}) {
  return jest.fn(async () => ({ ok, status, json: async () => corpo })) as unknown as typeof fetch;
}

describe('interpretarLocalidades', () => {
  it('monta a etiqueta com a terra e o distrito', () => {
    const [l] = interpretarLocalidades({ results: [resultado()] });
    expect(l.etiqueta).toBe('Idanha-a-Nova, Castelo Branco');
    expect(l.nome).toBe('Idanha-a-Nova');
    expect(l.regiao).toBe('Castelo Branco');
    expect(l.latitude).toBeCloseTo(39.92);
  });

  it('não repete o nome quando a região é igual à terra', () => {
    const [l] = interpretarLocalidades({ results: [resultado({ name: 'Braga', admin1: 'Braga' })] });
    expect(l.etiqueta).toBe('Braga');
  });

  it('tira o "Distrito de" com que a API nomeia os distritos portugueses', () => {
    const [l] = interpretarLocalidades({
      results: [resultado({ name: 'Nisa', admin1: 'Distrito de Portalegre' })],
    });
    expect(l.etiqueta).toBe('Nisa, Portalegre');
  });

  it('faz o mesmo às regiões autónomas', () => {
    const [l] = interpretarLocalidades({
      results: [resultado({ name: 'Angra do Heroísmo', admin1: 'Região Autónoma dos Açores' })],
    });
    expect(l.etiqueta).toBe('Angra do Heroísmo, Açores');
  });

  it('usa o concelho quando não há distrito', () => {
    const [l] = interpretarLocalidades({
      results: [resultado({ admin1: undefined, admin2: 'Nisa' })],
    });
    expect(l.etiqueta).toBe('Idanha-a-Nova, Nisa');
  });

  it('põe Portugal à frente das homónimas de fora', () => {
    // A API devolve com frequência a "Braga" do Brasil antes da do Minho, e uma
    // lista que começa no outro hemisfério faz o criador desistir dela.
    const lista = interpretarLocalidades({
      results: [
        resultado({ id: 1, name: 'Braga', admin1: 'Pará', country: 'Brasil', country_code: 'BR' }),
        resultado({ id: 2, name: 'Braga', admin1: 'Braga', country: 'Portugal', country_code: 'PT' }),
      ],
    });
    expect(lista.map((l) => l.etiqueta)).toEqual(['Braga', 'Braga, Pará']);
    // O país só se mostra nas de fora — dizer "Portugal" em todas é ruído.
    expect(lista[0].pais).toBeUndefined();
    expect(lista[1].pais).toBe('Brasil');
  });

  it('junta as repetidas (freguesia e concelho com o mesmo nome)', () => {
    const lista = interpretarLocalidades({
      results: [resultado({ id: 1 }), resultado({ id: 2 })],
    });
    expect(lista).toHaveLength(1);
  });

  it('salta entradas sem nome ou sem coordenadas', () => {
    const lista = interpretarLocalidades({
      results: [
        resultado({ id: 1, name: '' }),
        resultado({ id: 2, name: 'Nisa', latitude: undefined }),
        resultado({ id: 3, name: 'Nisa' }),
      ],
    });
    expect(lista.map((l) => l.nome)).toEqual(['Nisa']);
  });

  it('aguenta uma resposta sem resultados ou com lixo', () => {
    expect(interpretarLocalidades({})).toEqual([]);
    expect(interpretarLocalidades(null)).toEqual([]);
    expect(interpretarLocalidades({ results: [] })).toEqual([]);
  });
});

describe('procurarLocalidades', () => {
  beforeEach(limparCacheLocalidades);

  it('não pergunta nada por textos curtos demais', async () => {
    const fetchImpl = fetchFalso({ results: [resultado()] });
    const curto = 'id'.slice(0, MINIMO_LETRAS - 1);
    expect(await procurarLocalidades(curto, { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('procura e devolve as sugestões', async () => {
    const fetchImpl = fetchFalso({ results: [resultado()] });
    const lista = await procurarLocalidades('idanha', { fetchImpl });
    expect(lista[0].etiqueta).toBe('Idanha-a-Nova, Castelo Branco');
    const url = String((fetchImpl as unknown as jest.Mock).mock.calls[0][0]);
    expect(url).toContain('name=idanha');
    expect(url).toContain('language=pt');
  });

  it('a segunda procura igual não volta à rede', async () => {
    const fetchImpl = fetchFalso({ results: [resultado()] });
    await procurarLocalidades('idanha', { fetchImpl });
    await procurarLocalidades('  IDANHA ', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('lança quando a API recusa, para quem chama poder ficar sem lista', async () => {
    const fetchImpl = fetchFalso({}, { ok: false, status: 503 });
    await expect(procurarLocalidades('idanha', { fetchImpl })).rejects.toThrow('503');
  });
});
