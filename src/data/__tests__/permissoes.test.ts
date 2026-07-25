import { describe, expect, it } from '@jest/globals';

import {
  CAPACIDADES_GERIVEIS,
  capacidadeGerivel,
  exigeFinancasAtivas,
  explicacaoCapacidade,
  legendaCapacidade,
  legendaRole,
  permissoesEfetivas,
  podeConsultar,
  podeEscrever,
  rolePode,
  type Capacidade,
  type CapacidadeLeitura,
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

    // ---- Dinheiro ----
    // O dono decide tudo o que envolve euros.
    ['admin', 'registarDespesa', true],
    ['admin', 'registarReceita', true],
    ['admin', 'registarCustoTratamento', true],

    // O trabalhador traz a fatura da ração do armazém — lança despesas. Mas
    // quanto se vendeu um animal não é assunto de quem o carregou no camião.
    ['trabalhador', 'registarDespesa', true],
    ['trabalhador', 'registarCustoTratamento', true],
    ['trabalhador', 'registarReceita', false],

    // O veterinário só põe o preço do tratamento que acabou de dar. Não lança
    // despesas da exploração nem, muito menos, receitas.
    ['veterinario', 'registarCustoTratamento', true],
    ['veterinario', 'registarDespesa', false],
    ['veterinario', 'registarReceita', false],

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

/**
 * Consultar não é escrever, e a diferença tem consequências: uma conta
 * suspensa deixa de gravar mas continua a poder ver as suas contas. Espelha as
 * policies de SELECT de `supabase/schema_financas.sql`.
 */
describe('podeConsultar — quem vê as contas', () => {
  const base: ContextoAcesso = {
    supabaseConfigurado: true,
    temSessao: true,
    isSuperadmin: false,
    estadoPerfil: 'ativo',
    role: 'admin',
  };

  const casos: [ContextoAcesso['role'], CapacidadeLeitura, boolean][] = [
    ['admin', 'verFinancas', true],
    ['admin', 'verBalancoAnimal', true],
    // Quem só lança despesas não vê a contabilidade: no servidor a RLS já lhe
    // devolve apenas o que ele próprio lançou, e mostrar essa soma parecia o
    // saldo da exploração sem o ser.
    ['trabalhador', 'verFinancas', false],
    ['trabalhador', 'verBalancoAnimal', false],
    ['veterinario', 'verFinancas', false],
    ['veterinario', 'verBalancoAnimal', false],
    [undefined, 'verFinancas', false],
  ];

  it.each(casos)('papel %s + %s → %s', (papel, capacidade, esperado) => {
    expect(podeConsultar({ ...base, role: papel }, capacidade)).toBe(esperado);
  });

  it('conta suspensa continua a consultar as contas', () => {
    // A regra da suspensão é "só de leitura", não "às escuras". Passar esta
    // decisão por `podeEscrever` fechava o ecrã Finanças ao dono justamente no
    // dia em que a conta ficasse por regularizar.
    const suspensa = { ...base, estadoPerfil: 'pendente' as const };
    expect(podeConsultar(suspensa, 'verFinancas')).toBe(true);
    expect(podeEscrever(suspensa, 'registarDespesa')).toBe(false);
  });

  it('sem Supabase, o modo local/demo vê tudo', () => {
    const ctx = { ...base, supabaseConfigurado: false, estadoPerfil: null, role: undefined };
    expect(podeConsultar(ctx, 'verFinancas')).toBe(true);
  });

  it('o superadmin consulta sem papel na exploração', () => {
    expect(
      podeConsultar({ ...base, isSuperadmin: true, role: undefined }, 'verFinancas'),
    ).toBe(true);
  });
});

/**
 * O interruptor da gestão económica (Perfil → Gestão financeira) desliga um
 * conjunto exato de capacidades. Esta lista é a mesma que a RLS bloqueia em
 * `supabase/schema_financas_opcional.sql` — se as duas divergirem, a app mostra
 * um botão que o servidor recusa, e offline essa recusa só aparece na
 * sincronização, quando o criador já julga que gravou.
 */
describe('exigeFinancasAtivas', () => {
  it('tudo o que mexe em dinheiro depende do interruptor', () => {
    expect(exigeFinancasAtivas('registarDespesa')).toBe(true);
    expect(exigeFinancasAtivas('registarReceita')).toBe(true);
    expect(exigeFinancasAtivas('registarCustoTratamento')).toBe(true);
    expect(exigeFinancasAtivas('verFinancas')).toBe(true);
    expect(exigeFinancasAtivas('verBalancoAnimal')).toBe(true);
  });

  it('o resto da app não depende dele', () => {
    // Desligar as contas não pode tirar o gado a ninguém: quem não quer
    // contabilidade na app continua a registar partos, vacinas e pesagens.
    const alheias: Capacidade[] = [
      'editarExploracao',
      'eliminarExploracao',
      'gerirEquipa',
      'gerirTerrenos',
      'editarAnimais',
      'eliminarAnimais',
      'registarSaida',
    ];
    for (const cap of alheias) expect(exigeFinancasAtivas(cap)).toBe(false);
  });
});

/**
 * Os ajustes por pessoa (folha "O que pode alterar", no separador
 * Trabalhadores). Espelham `pode_cap()` de `supabase/schema_permissoes.sql`, e
 * cada um destes casos é uma forma de a permissão ficar mais larga do que quem a
 * deu quis.
 */
describe('rolePode com ajustes por pessoa', () => {
  it('tirar uma capacidade que o papel dá', () => {
    expect(rolePode('trabalhador', 'eliminarAnimais')).toBe(true);
    expect(rolePode('trabalhador', 'eliminarAnimais', { eliminarAnimais: false })).toBe(false);
  });

  it('dar uma capacidade que o papel não dá', () => {
    expect(rolePode('veterinario', 'gerirTerrenos')).toBe(false);
    expect(rolePode('veterinario', 'gerirTerrenos', { gerirTerrenos: true })).toBe(true);
  });

  it('o que não vem nos ajustes segue o papel', () => {
    // É esta a razão de guardar só as exceções: mudar a regra de um papel tem de
    // alcançar quem nunca foi afinado à mão.
    const ajustes = { eliminarAnimais: false };
    expect(rolePode('trabalhador', 'editarAnimais', ajustes)).toBe(true);
    expect(rolePode('trabalhador', 'registarReceita', ajustes)).toBe(false);
  });

  it('o dono não se ajusta — nem para menos, nem para mais', () => {
    // Uma exploração tem de ficar sempre com alguém que lhe consiga mexer; um
    // ajuste gravado por engano na linha do dono fechava-o fora dela.
    expect(rolePode('admin', 'eliminarAnimais', { eliminarAnimais: false })).toBe(true);
    expect(rolePode('admin', 'gerirEquipa', { gerirEquipa: false } as never)).toBe(true);
  });

  it('as capacidades do dono não se dão a mais ninguém, mesmo pedidas', () => {
    // O caminho curto para um convidado se promover: receber `gerirEquipa` e
    // convidar-se a si próprio como dono. A lista das ajustáveis fecha-o.
    const forcado = { gerirEquipa: true, editarExploracao: true, eliminarExploracao: true } as never;
    expect(rolePode('trabalhador', 'gerirEquipa', forcado)).toBe(false);
    expect(rolePode('trabalhador', 'editarExploracao', forcado)).toBe(false);
    expect(rolePode('veterinario', 'eliminarExploracao', forcado)).toBe(false);
  });

  it('capacidadeGerivel diz o mesmo que a lista', () => {
    for (const c of CAPACIDADES_GERIVEIS) expect(capacidadeGerivel(c)).toBe(true);
    const donoApenas: Capacidade[] = ['editarExploracao', 'eliminarExploracao', 'gerirEquipa'];
    for (const c of donoApenas) expect(capacidadeGerivel(c)).toBe(false);
  });

  it('podeEscrever leva os ajustes em conta, e a suspensão vence-os', () => {
    const base: ContextoAcesso = {
      supabaseConfigurado: true,
      temSessao: true,
      isSuperadmin: false,
      estadoPerfil: 'ativo',
      role: 'veterinario',
      permissoes: { gerirTerrenos: true },
    };
    expect(podeEscrever(base, 'gerirTerrenos')).toBe(true);
    // Dar permissões a alguém não desfaz uma conta suspensa.
    expect(podeEscrever({ ...base, estadoPerfil: 'pendente' }, 'gerirTerrenos')).toBe(false);
  });
});

describe('permissoesEfetivas — o que a folha mostra', () => {
  it('devolve uma linha por capacidade ajustável, com o efeito e a marca', () => {
    const linhas = permissoesEfetivas('veterinario', { gerirTerrenos: true });
    expect(linhas.map((l) => l.capacidade)).toEqual([...CAPACIDADES_GERIVEIS]);

    const terrenos = linhas.find((l) => l.capacidade === 'gerirTerrenos')!;
    expect(terrenos.pode).toBe(true);
    expect(terrenos.ajustada).toBe(true);

    // Uma capacidade que o papel já dava não conta como alterada.
    const animais = linhas.find((l) => l.capacidade === 'editarAnimais')!;
    expect(animais.pode).toBe(true);
    expect(animais.ajustada).toBe(false);
  });

  it('um ajuste igual ao que o papel dá não aparece como alterado', () => {
    // É o que sustenta o "Repor o que o papel dá" da folha: gravar o valor do
    // papel é o mesmo que não gravar ajuste nenhum.
    const linhas = permissoesEfetivas('trabalhador', { editarAnimais: true });
    expect(linhas.find((l) => l.capacidade === 'editarAnimais')!.ajustada).toBe(false);
  });

  it('sem ajustes, nada está alterado', () => {
    for (const l of permissoesEfetivas('trabalhador')) expect(l.ajustada).toBe(false);
  });
});

describe('legendas das capacidades', () => {
  it('toda a capacidade tem nome e explicação em PT-PT', () => {
    // Uma capacidade nova sem legenda apareceria na folha como um interruptor
    // sem nome — o `switch` é exaustivo, e isto apanha o esquecimento.
    const todas: Capacidade[] = [
      'editarExploracao',
      'eliminarExploracao',
      'gerirEquipa',
      ...CAPACIDADES_GERIVEIS,
    ];
    for (const c of todas) {
      expect(legendaCapacidade(c).length).toBeGreaterThan(3);
      expect(explicacaoCapacidade(c).length).toBeGreaterThan(10);
    }
  });
});

describe('legendaRole', () => {
  it('traduz os papéis para PT-PT', () => {
    expect(legendaRole('admin')).toBe('Dono');
    expect(legendaRole('trabalhador')).toBe('Trabalhador');
    expect(legendaRole('veterinario')).toBe('Veterinário');
  });
});
