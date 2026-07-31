import { describe, expect, it } from '@jest/globals';

import { entraPorCodigo, INTENCOES, intencaoMeta, lerIntencao } from '../intencao';

describe('lerIntencao', () => {
  it('devolve a intenção guardada na conta', () => {
    expect(lerIntencao({ nome: 'Ana', intencao: 'veterinario' })).toBe('veterinario');
  });

  it('ignora o que não é uma das três', () => {
    // O `user_metadata` é escrito pelo próprio (`auth.updateUser`): um valor
    // inventado não pode virar um estado que a app não sabe desenhar.
    expect(lerIntencao({ intencao: 'superadmin' })).toBeUndefined();
    expect(lerIntencao({ intencao: 42 })).toBeUndefined();
    expect(lerIntencao({ intencao: { id: 'dono' } })).toBeUndefined();
  });

  it('aguenta contas sem metadados', () => {
    expect(lerIntencao(undefined)).toBeUndefined();
    expect(lerIntencao(null)).toBeUndefined();
    expect(lerIntencao('dono')).toBeUndefined();
    // Contas criadas antes de a pergunta existir.
    expect(lerIntencao({ nome: 'Ana' })).toBeUndefined();
  });
});

describe('entraPorCodigo', () => {
  it('trabalhador e veterinário entram por código; o dono espera aprovação', () => {
    expect(entraPorCodigo('trabalhador')).toBe(true);
    expect(entraPorCodigo('veterinario')).toBe(true);
    expect(entraPorCodigo('dono')).toBe(false);
  });

  it('sem intenção, ninguém é empurrado para o código', () => {
    expect(entraPorCodigo(undefined)).toBe(false);
  });
});

describe('INTENCOES', () => {
  it('cada opção diz o que lhe acontece a seguir', () => {
    for (const op of INTENCOES) {
      expect(op.rotulo.length).toBeGreaterThan(0);
      expect(op.descricao.length).toBeGreaterThan(0);
      expect(intencaoMeta(op.id)).toBe(op);
    }
  });
});
