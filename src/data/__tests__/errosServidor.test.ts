import { describe, expect, it } from '@jest/globals';

import { traduzErroServidor } from '../errosServidor';

describe('traduzErroServidor', () => {
  it('explica a recusa ao criar exploração como conta por aprovar', () => {
    const traduzido = traduzErroServidor(
      'new row violates row-level security policy for table "exploracao"',
    );
    expect(traduzido).toContain('não foi aprovada');
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
