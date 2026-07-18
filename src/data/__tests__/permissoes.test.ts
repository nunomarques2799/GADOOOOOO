import { describe, expect, it } from '@jest/globals';

import {
  legendaRole,
  podeEscrever,
  rolePode,
  type Capacidade,
  type ContextoAcesso,
} from '../permissoes';
import type { RoleMembro } from '../types';

/**
 * Esta tabela é a fonte da verdade do que a interface mostra a cada pessoa, e
 * espelha as políticas RLS de `supabase/schema_roles.sql`. Ao mudar uma
 * política no SQL, mudar aqui — um botão a mais é uma gravação que o servidor
 * recusa e que, feita offline, só se descobre na sincronização.
 */
describe('rolePode', () => {
  const casos: [RoleMembro | undefined, Capacidade, boolean][] = [
    // O dono faz tudo na sua exploração.
    ['admin', 'editarExploracao', true],
    ['admin', 'eliminarExploracao', true],
    ['admin', 'gerirEquipa', true],
    ['admin', 'gerirTerrenos', true],
    ['admin', 'editarAnimais', true],
    ['admin', 'eliminarAnimais', true],
    ['admin', 'registarSaida', true],

    // O trabalhador trata do dia-a-dia, mas o património não é dele.
    ['trabalhador', 'gerirTerrenos', true],
    ['trabalhador', 'editarAnimais', true],
    ['trabalhador', 'eliminarAnimais', true],
    ['trabalhador', 'registarSaida', true],
    ['trabalhador', 'editarExploracao', false],
    ['trabalhador', 'eliminarExploracao', false],
    ['trabalhador', 'gerirEquipa', false],

    // O veterinário mexe nos animais e certifica saídas — nada mais.
    ['veterinario', 'editarAnimais', true],
    ['veterinario', 'registarSaida', true],
    ['veterinario', 'eliminarAnimais', false],
    ['veterinario', 'gerirTerrenos', false],
    ['veterinario', 'editarExploracao', false],
    ['veterinario', 'eliminarExploracao', false],
    ['veterinario', 'gerirEquipa', false],

    // Quem não é membro não faz nada — é o caso de quem abre uma exploração
    // de outra pessoa por um link antigo.
    [undefined, 'editarAnimais', false],
    [undefined, 'registarSaida', false],
    [undefined, 'gerirEquipa', false],
  ];

  it.each(casos)('papel %s + %s → %s', (papel, capacidade, esperado) => {
    expect(rolePode(papel, capacidade)).toBe(esperado);
  });

  it('só o admin pode mexer na exploração e na equipa', () => {
    const donoApenas: Capacidade[] = ['editarExploracao', 'eliminarExploracao', 'gerirEquipa'];
    for (const cap of donoApenas) {
      expect(rolePode('admin', cap)).toBe(true);
      expect(rolePode('trabalhador', cap)).toBe(false);
      expect(rolePode('veterinario', cap)).toBe(false);
    }
  });

  it('apagar um animal leva o histórico atrás — não é ato veterinário', () => {
    expect(rolePode('veterinario', 'editarAnimais')).toBe(true);
    expect(rolePode('veterinario', 'eliminarAnimais')).toBe(false);
  });
});

/**
 * Cada ramo desta função tem um modo de falhar próprio e caro — daí o teste.
 * Espelha `pode_escrever_em()` de `supabase/schema_suspensao.sql`.
 */
describe('podeEscrever — modo da app + estado da conta + papel', () => {
  const base: ContextoAcesso = {
    supabaseConfigurado: true,
    temSessao: true,
    isSuperadmin: false,
    estadoPerfil: 'ativo',
    role: 'admin',
  };

  it('sem Supabase, permite tudo — é o modo local/demo, sem equipa nem papéis', () => {
    // Se isto falhasse, o .exe sem chaves e a app offline ficavam só de leitura.
    const ctx = { ...base, supabaseConfigurado: false, estadoPerfil: null, role: undefined };
    expect(podeEscrever(ctx, 'eliminarExploracao')).toBe(true);
  });

  it('sem sessão iniciada, permite tudo (SQLite local)', () => {
    const ctx = { ...base, temSessao: false, estadoPerfil: null, role: undefined };
    expect(podeEscrever(ctx, 'gerirTerrenos')).toBe(true);
  });

  it('o superadmin passa mesmo sem papel na exploração', () => {
    // Precisa disto para assistir a conta de um cliente.
    const ctx = { ...base, isSuperadmin: true, role: undefined, estadoPerfil: null };
    expect(podeEscrever(ctx, 'editarExploracao')).toBe(true);
  });

  it('conta suspensa não escreve, nem sendo dono da exploração', () => {
    // O ponto todo do S3: suspender tem de suspender mesmo.
    const ctx = { ...base, estadoPerfil: 'pendente' as const, role: 'admin' as const };
    expect(podeEscrever(ctx, 'editarAnimais')).toBe(false);
    expect(podeEscrever(ctx, 'gerirTerrenos')).toBe(false);
    expect(podeEscrever(ctx, 'eliminarExploracao')).toBe(false);
  });

  it('a suspensão vence o papel, mas não vence o superadmin', () => {
    expect(podeEscrever({ ...base, estadoPerfil: 'pendente' }, 'editarAnimais')).toBe(false);
    expect(
      podeEscrever({ ...base, estadoPerfil: 'pendente', isSuperadmin: true }, 'editarAnimais'),
    ).toBe(true);
  });

  it('conta ativa sem papel nesta exploração não escreve', () => {
    expect(podeEscrever({ ...base, role: undefined }, 'editarAnimais')).toBe(false);
  });

  it('conta ativa respeita os limites do papel', () => {
    expect(podeEscrever({ ...base, role: 'veterinario' }, 'editarAnimais')).toBe(true);
    expect(podeEscrever({ ...base, role: 'veterinario' }, 'eliminarAnimais')).toBe(false);
  });
});

describe('legendaRole', () => {
  it('traduz os papéis para PT-PT', () => {
    expect(legendaRole('admin')).toBe('Dono');
    expect(legendaRole('trabalhador')).toBe('Trabalhador');
    expect(legendaRole('veterinario')).toBe('Veterinário');
  });
});
