import { afterEach, describe, expect, it } from '@jest/globals';

import { definirIdiomaParaTestes, IDIOMA_OMISSAO, IDIOMAS } from '../idioma';
import { CHAVES_TEXTO, DICIONARIOS_EM_CRU, t, type ChaveTexto } from '../textos';

afterEach(() => definirIdiomaParaTestes(IDIOMA_OMISSAO));

describe('t — o texto no idioma em uso', () => {
  it('devolve o português por omissão', () => {
    expect(t('nav.animais')).toBe('Animais');
  });

  it('e o inglês quando é esse o idioma', () => {
    definirIdiomaParaTestes('en');
    expect(t('nav.animais')).toBe('Animals');
  });

  it('substitui os valores entre chavetas', () => {
    expect(t('animais.deTotal', { n: 3, total: 28 })).toBe('3 de 28');
    definirIdiomaParaTestes('en');
    expect(t('animais.deTotal', { n: 3, total: 28 })).toBe('3 of 28');
  });

  it('deixa quieta uma chaveta para a qual não veio valor', () => {
    // Melhor um `{total}` à vista do que um "3 de undefined" — o primeiro
    // denuncia-se, o segundo parece um número.
    expect(t('animais.deTotal', { n: 3 })).toBe('3 de {total}');
  });
});

describe('t — singular e plural', () => {
  it('escolhe o lado do | pelo n', () => {
    expect(t('inicio.urgentes', { n: 1 })).toBe('1 urgente');
    expect(t('inicio.urgentes', { n: 4 })).toBe('4 urgentes');
  });

  it('zero é plural, em português e em inglês', () => {
    // "0 urgente" não se diz em nenhuma das duas.
    expect(t('inicio.urgentes', { n: 0 })).toBe('0 urgentes');
    definirIdiomaParaTestes('en');
    expect(t('inicio.urgentes', { n: 0 })).toBe('0 urgent');
  });

  it('o inglês pode ter as duas formas iguais sem deixar de funcionar', () => {
    // "urgent" não muda no plural. O `|` continua lá para o formato ser o
    // mesmo nas duas línguas — quem traduz não tem de decidir se o põe.
    definirIdiomaParaTestes('en');
    expect(t('inicio.urgentes', { n: 1 })).toBe('1 urgent');
    expect(t('inicio.urgentes', { n: 3 })).toBe('3 urgent');
  });

  /**
   * A razão de o plural existir: em português o plural do substantivo e o do
   * verbo mudam ao mesmo tempo, e um `+ 's'` colado no fim dava "1 alterações"
   * ou "Sem ligação. 1 alterações guardadas".
   */
  it('trata a frase inteira e não só a palavra do fim', () => {
    expect(t('inicio.aSincronizar', { n: 1 })).toBe('A sincronizar 1 alteração…');
    expect(t('inicio.aSincronizar', { n: 5 })).toBe('A sincronizar 5 alterações…');
  });
});

describe('o dicionário está completo', () => {
  it('tem os dois idiomas e nenhuma chave a zero', () => {
    expect(IDIOMAS).toEqual(['pt', 'en']);
    expect(CHAVES_TEXTO.length).toBeGreaterThan(50);
    for (const idioma of IDIOMAS) {
      definirIdiomaParaTestes(idioma);
      for (const chave of CHAVES_TEXTO) expect(t(chave).trim()).not.toBe('');
    }
  });

  /**
   * O `en` está tipado como `Record<ChaveTexto, string>`, por isso uma chave
   * SEM tradução nem compila. Este teste apanha o que o tipo não apanha: uma
   * tradução ESQUECIDA, deixada igual ao português por copiar-colar — que
   * compila lindamente e só se vê com a app em inglês à frente.
   *
   * As exceções abaixo são as chaves em que as duas colunas SÃO iguais de
   * propósito, e cada uma tem de dizer porquê. A lista é curta e à mão de
   * propósito: acrescentar uma tem de ser uma decisão, não um atalho para
   * calar o teste.
   */
  const IGUAIS_DE_PROPOSITO: ChaveTexto[] = [
    // Máscaras de números oficiais portugueses (o brinco do SIA, a marca de
    // exploração). Não são frases: é o que se escreve no campo, e escreve-se
    // exatamente igual em inglês.
    'formAnimal.exBrinco',
    'formExploracao.exMarca',
    // "Animal" e "Dose" escrevem-se igual nas duas línguas.
    'ficha.animal',
    'evento.dose',
    // A pré-visualização das paletas mostra uma espécie e uma raça, e esses são
    // nomes de DOMÍNIO: ficam em português nas duas línguas (ver `textos.ts`).
    'aspeto.exemploRaca',
    // "Offline" é a mesma palavra nas duas línguas, e é a que se usa em
    // português corrente.
    'sinc.offline',
    // Símbolo da unidade, não uma palavra.
    'meteo.grausC',
    // "Supervisor" escreve-se igual nas duas línguas.
    'papel.supervisor',
    // Exemplos de números, não frases: um telemóvel e um código de seis
    // dígitos escrevem-se com os mesmos algarismos em qualquer língua.
    'login.telemovelPlaceholder',
    'login.codigoSmsPlaceholder',
  ];

  it('e nenhuma tradução ficou igual ao português por esquecimento', () => {
    definirIdiomaParaTestes('pt');
    const emPt = new Map(CHAVES_TEXTO.map((c) => [c, t(c)]));

    definirIdiomaParaTestes('en');
    const iguais = CHAVES_TEXTO.filter(
      (c) => t(c) === emPt.get(c) && !IGUAIS_DE_PROPOSITO.includes(c),
    );

    expect(iguais).toEqual([]);
  });

  it('e a lista de exceções não tem chaves já traduzidas', () => {
    // Uma exceção que deixou de fazer falta é uma porta aberta para a próxima
    // tradução esquecida entrar por ela sem ninguém dar conta.
    definirIdiomaParaTestes('pt');
    const emPt = new Map(CHAVES_TEXTO.map((c) => [c, t(c)]));
    definirIdiomaParaTestes('en');

    const jaTraduzidas = IGUAIS_DE_PROPOSITO.filter((c) => t(c) !== emPt.get(c));
    expect(jaTraduzidas).toEqual([]);
  });

  /**
   * As duas metades de um plural têm de existir nas duas línguas. Um `|` que
   * exista só no português dava, em inglês, a frase inteira com o `|` no meio
   * — e ninguém repara nisso a ler o dicionário.
   */
  it('e os plurais estão nas duas', () => {
    // Em CRU: o `t()` já resolveu o `|` e não deixava ver o que falta.
    const { pt, en } = DICIONARIOS_EM_CRU;
    const comPluralEmPt = CHAVES_TEXTO.filter((c) => pt[c].includes('|'));
    expect(comPluralEmPt.length).toBeGreaterThan(0);

    const semPluralEmEn = comPluralEmPt.filter((c) => !en[c].includes('|'));
    expect(semPluralEmEn).toEqual([]);
  });
});
