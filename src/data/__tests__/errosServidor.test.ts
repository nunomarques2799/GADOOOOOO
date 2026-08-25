import { afterEach, describe, expect, it } from '@jest/globals';

import { definirIdiomaParaTestes, IDIOMA_OMISSAO } from '@/i18n/idioma';
import { traduzErroServidor } from '../errosServidor';

describe('traduzErroServidor', () => {
  it('na recusa ao criar exploração dá as duas causas, sem escolher uma', () => {
    const traduzido = traduzErroServidor(
      'new row violates row-level security policy for table "exploracao"',
    );
    // Ambas as saídas têm de estar lá: a primeira versão desta mensagem
    // afirmava a aprovação em falta e foi mostrada a uma conta APROVADA, a
    // mandá-la falar com um administrador que nada tinha para fazer.
    expect(traduzido).toContain('sessão expirou');
    expect(traduzido).toContain('aprovada');
    // O que o criador não pode ver é a mensagem do Postgres.
    expect(traduzido.toLowerCase()).not.toContain('row-level security');
  });

  it('as outras recusas de RLS falam de permissão, não de aprovação', () => {
    const traduzido = traduzErroServidor(
      'new row violates row-level security policy for table "animal"',
    );
    expect(traduzido).toContain('permissão');
    expect(traduzido).not.toContain('aprovada');
  });

  it('a cache de schema desatualizada diz para tentar outra vez', () => {
    const traduzido = traduzErroServidor(
      "Could not find the 'casa' column of 'animal' in the schema cache",
    );
    expect(traduzido).toContain('daqui a um minuto');
    expect(traduzido).not.toContain('schema cache');
  });

  it('o que não conhece passa tal e qual — inventar era pior', () => {
    const estranho = 'duplicate key value violates unique constraint "animal_pkey"';
    expect(traduzErroServidor(estranho)).toBe(estranho);
  });

  it('não toca no prefixo que marca os conflitos de versão', () => {
    const conflito = 'CONFLITO_DE_VERSAO: outra pessoa alterou este registo.';
    expect(traduzErroServidor(conflito)).toBe(conflito);
  });
});

/**
 * A língua escolhida tem de chegar também às mensagens do servidor.
 *
 * Estiveram escritas à mão em português dentro do módulo, tal como as da
 * autenticação: uma app posta em inglês continuava a explicar em português
 * porque é que a gravação tinha falhado. O que se prova aqui é que o texto
 * muda com o idioma e que a REGRA não muda: o que o módulo não conhece
 * continua a passar tal e qual, em qualquer língua.
 */
describe('traduzErroServidor, na língua da app', () => {
  afterEach(() => definirIdiomaParaTestes(IDIOMA_OMISSAO));

  it('a recusa ao criar exploração sai em inglês, e com as duas causas', () => {
    definirIdiomaParaTestes('en');
    const traduzido = traduzErroServidor(
      'new row violates row-level security policy for table "exploracao"',
    );
    expect(traduzido).toContain('session has expired');
    expect(traduzido).toContain('not approved to create farms');
    expect(traduzido.toLowerCase()).not.toContain('row-level security');
  });

  it('e as outras recusas falam de permissão, não de aprovação', () => {
    definirIdiomaParaTestes('en');
    const traduzido = traduzErroServidor(
      'new row violates row-level security policy for table "animal"',
    );
    expect(traduzido).toContain('not allowed to save this');
    expect(traduzido).not.toContain('approved');
  });

  it('a cache do schema e a falta de rede também', () => {
    definirIdiomaParaTestes('en');
    expect(
      traduzErroServidor("Could not find the 'casa' column of 'animal' in the schema cache"),
    ).toContain('Try again in a minute');
    expect(traduzErroServidor('TypeError: Failed to fetch')).toContain(
      'No connection to the server',
    );
  });

  it('o que não conhece passa tal e qual, seja qual for a língua', () => {
    definirIdiomaParaTestes('en');
    const estranho = 'duplicate key value violates unique constraint "animal_pkey"';
    expect(traduzErroServidor(estranho)).toBe(estranho);
  });
});
