/**
 * Raças e pelagens — as listas que o formulário oferece.
 * ------------------------------------------------------------------
 * Até aqui a raça e a cor eram campos de texto livre. Isso escrevia-se
 * depressa e lia-se mal: "mertolenga", "Mertolenga" e "Mertolengaa" são três
 * raças diferentes para um filtro, e o criador só dava por isso quando
 * filtrasse e faltassem animais. Escolher de uma lista resolve a origem do
 * problema em vez de a tapar mais à frente.
 *
 * As colunas continuam a ser TEXTO (`animal.raca`, `animal.cor_pelagem`) — não
 * há tabela nova nem migração. Uma raça que não esteja na lista escreve-se na
 * mesma, e a partir daí passa a aparecer nas escolhas seguintes porque as
 * opções são a lista curada MAIS o que já existe no efetivo (ver
 * `opcoesComUsadas`). Assim quem cria gado cruzado ou de uma raça local não
 * fica de fora, e não é preciso pedir a ninguém que atualize uma lista.
 *
 * Fonte das autóctones: raças reconhecidas pela DGAV. As exóticas são as que
 * aparecem com frequência em explorações portuguesas.
 */

import type { Especie } from './types';

/** Raças por espécie: as portuguesas primeiro, que são as mais prováveis. */
const RACAS: Record<Especie, readonly string[]> = {
  Bovino: [
    // Autóctones
    'Alentejana', 'Arouquesa', 'Barrosã', 'Brava de Lide', 'Cachena',
    'Garvonesa', 'Jarmelista', 'Marinhoa', 'Maronesa', 'Mertolenga',
    'Minhota', 'Mirandesa', 'Preta', 'Ramo Grande',
    // Exóticas comuns em Portugal
    'Angus', "Blonde d'Aquitaine", 'Charolesa', 'Frísia (Holstein)', 'Hereford',
    'Jersey', 'Limousine', 'Salers', 'Simental',
  ],
  Ovino: [
    'Bordaleira de Entre Douro e Minho', 'Campaniça', 'Churra Algarvia',
    'Churra Badana', 'Churra da Terra Quente', 'Churra do Campo',
    'Churra Galega Bragançana', 'Churra Galega Mirandesa',
    'Merino Branco', 'Merino Preto', 'Merino da Beira Baixa', 'Mondegueira',
    'Saloia', 'Serra da Estrela',
    'Assaf', 'Ile de France', 'Lacaune', 'Suffolk', 'Texel',
  ],
  Caprino: [
    'Algarvia', 'Bravia', 'Charnequeira', 'Preta de Montesinho', 'Serpentina',
    'Serrana',
    'Alpina', 'Murciana', 'Saanen',
  ],
  Suíno: [
    'Bísaro', 'Alentejano (Porco Preto)', 'Malhado de Alcobaça',
    'Duroc', 'Landrace', 'Large White', 'Pietrain',
  ],
  Equídeo: [
    'Lusitano', 'Sorraia', 'Garrano', 'Burro de Miranda',
    'Anglo-Árabe', 'Puro-Sangue Inglês',
  ],
};

/** Pelagens comuns a todas as espécies de gado. */
const CORES_GADO: readonly string[] = [
  'Preta', 'Branca', 'Castanha', 'Vermelha', 'Amarela', 'Cinzenta',
  'Malhada', 'Barrosa', 'Ruça', 'Pia', 'Fusca', 'Rosilha',
];

/** Pelagens de equídeos — o vocabulário é outro e não se mistura com o do gado. */
const CORES_EQUIDEO: readonly string[] = [
  'Alazã', 'Baia', 'Castanha', 'Preta', 'Tordilha', 'Ruça', 'Palomina',
  'Malhada', 'Isabel',
];

/** "Cruzado" serve quase sempre e não pertence a nenhuma raça em concreto. */
const CRUZADO = 'Cruzado';

/** Raças sugeridas para uma espécie, por ordem alfabética. */
export function racasDe(especie: Especie): string[] {
  return [...RACAS[especie], CRUZADO].sort((a, b) => a.localeCompare(b, 'pt'));
}

/** Pelagens sugeridas para uma espécie. */
export function coresDe(especie: Especie): string[] {
  const base = especie === 'Equídeo' ? CORES_EQUIDEO : CORES_GADO;
  return [...base].sort((a, b) => a.localeCompare(b, 'pt'));
}

/**
 * Junta as sugestões ao que já foi escrito no efetivo, sem repetir.
 *
 * É isto que faz a lista aprender: uma raça acrescentada à mão num animal
 * aparece sozinha na escolha do animal seguinte. A comparação ignora
 * maiúsculas e acentos para "Mertolenga" e "mertolenga" não conviverem como
 * duas entradas — o que voltaria a partir os filtros, que é o que isto veio
 * resolver.
 */
export function opcoesComUsadas(sugeridas: string[], usadas: (string | undefined)[]): string[] {
  const vistas = new Map<string, string>();
  for (const v of [...sugeridas, ...usadas]) {
    const limpo = v?.trim();
    if (!limpo) continue;
    const chave = normalizar(limpo);
    if (!vistas.has(chave)) vistas.set(chave, limpo);
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'pt'));
}

/** Minúsculas e sem acentos, para comparar o que o criador escreveu. */
export function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
