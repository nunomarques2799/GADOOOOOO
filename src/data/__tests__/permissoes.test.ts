import { describe, expect, it } from '@jest/globals';

import {
  CAPACIDADES_GERIVEIS,
  capacidadeGerivel,
  exigeFinancasAtivas,
  explicacaoCapacidade,
  legendaCapacidade,
  legendaRole,
  eConvidado,
  permissoesEfetivas,
  podeConsultar,
  podeCriarExploracao,
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
    ['admin', 'registarTratamentos', true],
    ['admin', 'eliminarAnimais', true],
    ['admin', 'registarSaida', true],

    // O trabalhador trata do dia-a-dia, mas o património não é dele.
    ['trabalhador', 'gerirTerrenos', true],
    ['trabalhador', 'editarAnimais', true],
    ['trabalhador', 'registarTratamentos', true],
    ['trabalhador', 'eliminarAnimais', true],
    ['trabalhador', 'registarSaida', true],
    ['trabalhador', 'editarExploracao', false],
    ['trabalhador', 'eliminarExploracao', false],
    ['trabalhador', 'gerirEquipa', false],

    // O SUPERVISOR de uma sociedade agrícola trata do património e da equipa, e
    // não do gado. As cinco linhas a `false` do lado dos animais são o coração
    // deste papel: ele criou a exploração, paga-a e vê tudo o que lá se passa,
    // mas quem regista um animal, lhe escreve um tratamento ou lhe dá a saída é
    // o líder que ele pôs à frente dela. Se alguma passar a `true`, o
    // supervisor deixa de ser supervisor e passa a ser um segundo dono.
    ['supervisor', 'gerirTerrenos', true],
    ['supervisor', 'editarExploracao', true],
    ['supervisor', 'gerirEquipa', true],
    ['supervisor', 'editarAnimais', false],
    ['supervisor', 'registarTratamentos', false],
    ['supervisor', 'registarSaida', false],
    ['supervisor', 'eliminarAnimais', false],
    ['supervisor', 'marcarEventos', false],
    // Apagar a exploração não é dele nem de ninguém pela app: leva o efetivo e
    // o histórico atrás, e é a coisa que a sociedade paga.
    ['supervisor', 'eliminarExploracao', false],

    // O veterinário é uma VISITA: escreve o que fez ao animal e mais nada.
    //
    // As três linhas a `false` que se seguem ao `registarTratamentos` são o
    // coração desta tabela. Até 2026-07-30 `editarAnimais` queria dizer as duas
    // coisas ao mesmo tempo — corrigir a ficha e registar um tratamento — e por
    // isso quem vinha à exploração uma manhã ficava a poder trocar o brinco de
    // um animal, mudá-lo de courela (que é a mesma coluna da ficha) e dá-lo por
    // morto ou vendido. Se alguma delas voltar a `true`, é isso que volta.
    ['veterinario', 'registarTratamentos', true],
    ['veterinario', 'editarAnimais', false],
    ['veterinario', 'registarSaida', false],
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

    // O supervisor VÊ as contas todas das explorações dele (ver `podeConsultar`
    // mais abaixo) e não lança nem uma: quem lança despesas é quem traz a
    // fatura da ração, e quem lança receitas é quem vendeu o animal.
    ['supervisor', 'registarDespesa', false],
    ['supervisor', 'registarReceita', false],
    ['supervisor', 'registarCustoTratamento', false],

    // Quem não é membro não faz nada — é o caso de quem abre uma exploração
    // de outra pessoa por um link antigo.
    [undefined, 'editarAnimais', false],
    [undefined, 'registarSaida', false],
    [undefined, 'gerirEquipa', false],
  ];

  it.each(casos)('papel %s + %s → %s', (papel, capacidade, esperado) => {
    expect(rolePode(papel, capacidade)).toBe(esperado);
  });

  it('quem responde pela exploração mexe nela e na equipa', () => {
    const deQuemResponde: Capacidade[] = ['editarExploracao', 'gerirEquipa'];
    for (const cap of deQuemResponde) {
      expect(rolePode('admin', cap)).toBe(true);
      expect(rolePode('supervisor', cap)).toBe(true);
      expect(rolePode('trabalhador', cap)).toBe(false);
      expect(rolePode('veterinario', cap)).toBe(false);
    }
  });

  it('apagar a exploração é só do dono', () => {
    // O supervisor fica de fora com o trabalhador e o veterinário: numa
    // exploração de sociedade, apagar é pedido ao superadmin. Ver
    // `podeEscrever` para o outro lado disto (o líder, que é `admin`).
    expect(rolePode('admin', 'eliminarExploracao')).toBe(true);
    expect(rolePode('supervisor', 'eliminarExploracao')).toBe(false);
    expect(rolePode('trabalhador', 'eliminarExploracao')).toBe(false);
    expect(rolePode('veterinario', 'eliminarExploracao')).toBe(false);
  });

  it('a agenda é de quem lá anda', () => {
    // O veterinário não a marca porque a agenda diz quando é a feira e a que
    // horas se carrega o camião — o movimento da casa de quem o convidou, não
    // trabalho dele. O supervisor pela razão gémea: ele lê o plano, quem o faz
    // é quem está na exploração.
    expect(rolePode('admin', 'marcarEventos')).toBe(true);
    expect(rolePode('trabalhador', 'marcarEventos')).toBe(true);
    expect(rolePode('veterinario', 'marcarEventos')).toBe(false);
    expect(rolePode('supervisor', 'marcarEventos')).toBe(false);
  });

  it('o supervisor não se ajusta pessoa a pessoa, como o dono não se ajusta', () => {
    // Quem lhe abriria a folha de permissões era o líder que ele convidou — e
    // o convidado ficava a poder tirar os terrenos a quem o convidou.
    expect(rolePode('supervisor', 'gerirTerrenos', { gerirTerrenos: false })).toBe(true);
    expect(rolePode('supervisor', 'editarAnimais', { editarAnimais: true })).toBe(false);
    // E o trabalhador continua a ajustar-se, que é para isso que a coluna
    // existe: sem esta linha, a de cima passava com o ajuste desligado a torto.
    expect(rolePode('trabalhador', 'eliminarAnimais', { eliminarAnimais: false })).toBe(false);
  });

  it('marcar eventos não se ajusta pessoa a pessoa', () => {
    // Fora das `CAPACIDADES_GERIVEIS` de propósito (ver `permissoes.ts`): um
    // ajuste na coluna não pode abrir a agenda a quem o papel a fecha, ou o
    // interruptor existiria sem nada do lado do servidor a lê-lo.
    expect(capacidadeGerivel('marcarEventos')).toBe(false);
    const forcado = { marcarEventos: true } as never;
    expect(rolePode('veterinario', 'marcarEventos', forcado)).toBe(false);
  });

  it('o veterinário regista o que fez e não toca na ficha', () => {
    // A separação que dá sentido ao papel: registar SIM, alterar a ficha NÃO.
    // Com as duas na mesma capacidade não havia como ter uma sem a outra.
    expect(rolePode('veterinario', 'registarTratamentos')).toBe(true);
    expect(rolePode('veterinario', 'editarAnimais')).toBe(false);
    expect(rolePode('veterinario', 'eliminarAnimais')).toBe(false);
    expect(rolePode('veterinario', 'registarSaida')).toBe(false);
  });

  it('ao trabalhador não se fechou nada com a separação', () => {
    // A capacidade nova não pode ter sido uma subtração para quem já podia
    // tudo o que ela cobre: quem corrigia fichas E registava tratamentos tem de
    // continuar a fazer as duas coisas.
    expect(rolePode('trabalhador', 'editarAnimais')).toBe(true);
    expect(rolePode('trabalhador', 'registarTratamentos')).toBe(true);
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
    expect(podeEscrever({ ...base, role: 'veterinario' }, 'registarTratamentos')).toBe(true);
    expect(podeEscrever({ ...base, role: 'veterinario' }, 'editarAnimais')).toBe(false);
    expect(podeEscrever({ ...base, role: 'veterinario' }, 'eliminarAnimais')).toBe(false);
  });

  it('o líder faz tudo na exploração da sociedade, menos apagá-la', () => {
    // Ele é `admin` e corre a exploração: animais, terrenos, equipa, contas.
    // O que não pode é apagar uma exploração que não é dele — e a exploração
    // dele própria continua a apagar-se, que é o caso de sempre.
    const lider = { ...base, role: 'admin' as const, exploracaoSupervisionada: true };
    expect(podeEscrever(lider, 'editarAnimais')).toBe(true);
    expect(podeEscrever(lider, 'gerirEquipa')).toBe(true);
    expect(podeEscrever(lider, 'gerirTerrenos')).toBe(true);
    expect(podeEscrever(lider, 'eliminarExploracao')).toBe(false);
    expect(podeEscrever({ ...base, role: 'admin' }, 'eliminarExploracao')).toBe(true);
  });

  it('o supervisor cuida do património e não do gado', () => {
    const supervisor = { ...base, role: 'supervisor' as const, exploracaoSupervisionada: true };
    expect(podeEscrever(supervisor, 'gerirTerrenos')).toBe(true);
    expect(podeEscrever(supervisor, 'editarExploracao')).toBe(true);
    expect(podeEscrever(supervisor, 'gerirEquipa')).toBe(true);
    expect(podeEscrever(supervisor, 'editarAnimais')).toBe(false);
    expect(podeEscrever(supervisor, 'registarTratamentos')).toBe(false);
    expect(podeEscrever(supervisor, 'eliminarExploracao')).toBe(false);
  });

  it('a sociedade suspensa congela também o supervisor', () => {
    // Quem paga é ele: se a subscrição parar, para tudo, a começar por ele.
    const ctx = {
      ...base,
      role: 'supervisor' as const,
      estadoPerfil: 'pendente' as const,
      exploracaoSupervisionada: true,
    };
    expect(podeEscrever(ctx, 'gerirTerrenos')).toBe(false);
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

    // Os Documentos importam e exportam o efetivo inteiro. Ficam com quem tem a
    // exploração a cargo todos os dias; o veterinário não tem que levar o gado
    // de outra pessoa num Excel a caminho da quinta seguinte.
    ['admin', 'verDocumentos', true],
    ['trabalhador', 'verDocumentos', true],
    ['veterinario', 'verDocumentos', false],
    [undefined, 'verDocumentos', false],

    // O calendário é de quem lá trabalha todos os dias. Ao veterinário fecha-se
    // — e esta, ao contrário dos Documentos, tem RLS por trás
    // (`tem_agenda()` em `supabase/schema_agenda.sql`).
    ['admin', 'verAgenda', true],
    ['trabalhador', 'verAgenda', true],
    ['veterinario', 'verAgenda', false],
    [undefined, 'verAgenda', false],

    // O supervisor vê TUDO o que o dono vê, e é a razão de existir: paga a
    // subscrição para saber o que se passa nas explorações que criou. Fechar-lhe
    // as contas fazia dele um dono cego da sua própria sociedade.
    ['supervisor', 'verFinancas', true],
    ['supervisor', 'verBalancoAnimal', true],
    ['supervisor', 'verDocumentos', true],
    ['supervisor', 'verAgenda', true],
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
    const tratamentos = linhas.find((l) => l.capacidade === 'registarTratamentos')!;
    expect(tratamentos.pode).toBe(true);
    expect(tratamentos.ajustada).toBe(false);

    // E uma que ele não dá aparece desligada e não alterada.
    const fichas = linhas.find((l) => l.capacidade === 'editarAnimais')!;
    expect(fichas.pode).toBe(false);
    expect(fichas.ajustada).toBe(false);
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
      // Fora das ajustáveis (não se dá nem se tira pessoa a pessoa), mas com
      // legenda na mesma: o `switch` é exaustivo e isto guarda-o.
      'marcarEventos',
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
    expect(legendaRole('supervisor')).toBe('Supervisor');
    expect(legendaRole('trabalhador')).toBe('Trabalhador');
    expect(legendaRole('veterinario')).toBe('Veterinário');
  });

  it('o admin de uma exploração de sociedade é o LÍDER, não o dono', () => {
    // É o mesmo papel e o mesmo poder do dia a dia. O que muda é de quem é a
    // exploração, e chamar-lhe "dono" dizia a quem lê o contrário do que é.
    expect(legendaRole('admin', true)).toBe('Líder de exploração');
    expect(legendaRole('supervisor', true)).toBe('Supervisor');
    expect(legendaRole('trabalhador', true)).toBe('Trabalhador');
  });
});

/**
 * Criar explorações não é uma capacidade DENTRO de uma exploração: a pergunta é
 * sobre a conta inteira. Errar aqui tem dois lados e os dois são maus — deixar
 * um convidado abrir quinta na conta de outra pessoa, ou fechar a porta a quem
 * acaba de se registar e ainda não tem nada. Espelha a política
 * `exploracao_ativo_insert` de `supabase/schema_sociedade.sql`.
 */
describe('eConvidado / podeCriarExploracao', () => {
  const base: ContextoAcesso = {
    supabaseConfigurado: true,
    temSessao: true,
    isSuperadmin: false,
    estadoPerfil: 'ativo',
    role: undefined,
  };

  it('sem vínculo nenhum não é convidado', () => {
    // O caso da conta acabada de aprovar. Tratá-la como convidada fechava a
    // app a toda a gente nova: sem exploração não há nada que se possa fazer.
    expect(eConvidado({ papeis: [], criouExploracao: false })).toBe(false);
    expect(podeCriarExploracao({ ...base, papeis: [], criouExploracao: false })).toBe(true);
  });

  it('quem só entrou por código é convidado', () => {
    expect(eConvidado({ papeis: ['veterinario'], criouExploracao: false })).toBe(true);
    expect(eConvidado({ papeis: ['trabalhador'], criouExploracao: false })).toBe(true);
    expect(eConvidado({ papeis: ['trabalhador', 'veterinario'], criouExploracao: false })).toBe(
      true,
    );
    expect(
      podeCriarExploracao({ ...base, papeis: ['veterinario'], criouExploracao: false }),
    ).toBe(false);
  });

  it('quem criou uma exploração não é convidado de ninguém', () => {
    // O veterinário que também tem a sua quinta. Bloqueá-lo seria castigá-lo
    // por prestar serviço a outros.
    expect(eConvidado({ papeis: ['veterinario', 'admin'], criouExploracao: true })).toBe(false);
    expect(
      podeCriarExploracao({ ...base, papeis: ['veterinario', 'admin'], criouExploracao: true }),
    ).toBe(true);
  });

  it('o LÍDER de exploração é convidado, apesar de ser admin', () => {
    // A armadilha das sociedades. Ele é `admin` da exploração que corre, mas
    // quem a criou e a paga é o supervisor — e a pergunta antiga ("é admin
    // nalgum lado?") dava-lhe o direito de abrir quintas suas à conta da
    // subscrição de outra pessoa. Espelha `eh_convidado()`.
    expect(eConvidado({ papeis: ['admin'], criouExploracao: false })).toBe(true);
    expect(podeCriarExploracao({ ...base, papeis: ['admin'], criouExploracao: false })).toBe(false);
  });

  it('a conta de sociedade continua a poder criar mais explorações', () => {
    // Ela é `supervisor` das que já tem, e criou-as: é o oposto de uma
    // convidada. Se isto falhasse, a sociedade criava a primeira exploração e
    // ficava presa a ela.
    expect(eConvidado({ papeis: ['supervisor'], criouExploracao: true })).toBe(false);
    expect(
      podeCriarExploracao({ ...base, papeis: ['supervisor'], criouExploracao: true }),
    ).toBe(true);
  });

  it('conta por aprovar não cria, seja quem for', () => {
    // A política exige `perfil_ativo()` e não abre exceção: sem isto, o botão
    // "Nova" aparecia a quem ainda espera aprovação e a gravação rebentava com
    // um "new row violates row-level security policy" em cru.
    expect(
      podeCriarExploracao({
        ...base,
        estadoPerfil: 'pendente',
        papeis: [],
        criouExploracao: false,
      }),
    ).toBe(false);
    expect(
      podeCriarExploracao({ ...base, estadoPerfil: null, papeis: [], criouExploracao: false }),
    ).toBe(false);
  });

  it('modo local e superadmin passam', () => {
    // Sem servidor não há equipa nem papéis: quem está no aparelho é o dono.
    expect(
      podeCriarExploracao({
        ...base,
        supabaseConfigurado: false,
        papeis: ['veterinario'],
        criouExploracao: false,
      }),
    ).toBe(true);
    expect(
      podeCriarExploracao({
        ...base,
        isSuperadmin: true,
        papeis: ['veterinario'],
        criouExploracao: false,
      }),
    ).toBe(true);
  });
});
