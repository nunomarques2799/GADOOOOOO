import { describe, expect, it } from '@jest/globals';

import {
  FILTRO_PRAZOS_TUDO,
  descricaoFiltroPrazos,
  filtrarAlertas,
  htmlRelatorioPrazos,
  tabelaEventos,
  tabelaFinancas,
  type FiltroPrazos,
} from '../exportar';
import type { Alerta, Animal, Evento } from '../types';

/* ------------------------------------------------------------------ *
 *  Filtros do relatório de prazos
 * ------------------------------------------------------------------ */

function alerta(p: Partial<Alerta> & Pick<Alerta, 'id'>): Alerta {
  return {
    gravidade: 'aviso',
    titulo: 'Prazo',
    descricao: 'Descrição',
    categoria: 'snira',
    ...p,
  };
}

const ALERTAS: Alerta[] = [
  alerta({ id: '1', gravidade: 'urgente', categoria: 'snira', diasRestantes: -3, exploracaoId: 'e1' }),
  alerta({ id: '2', gravidade: 'aviso', categoria: 'parto', diasRestantes: 5, exploracaoId: 'e1' }),
  alerta({ id: '3', gravidade: 'aviso', categoria: 'vacinacao', diasRestantes: 20, exploracaoId: 'e2' }),
  // Sem prazo a correr: é uma lacuna, não uma contagem decrescente.
  alerta({ id: '4', gravidade: 'info', categoria: 'vacinacao', exploracaoId: 'e2' }),
];

const filtro = (p: Partial<FiltroPrazos> = {}): FiltroPrazos => ({ ...FILTRO_PRAZOS_TUDO, ...p });

describe('filtrarAlertas', () => {
  it('sem filtros leva tudo', () => {
    expect(filtrarAlertas(ALERTAS, FILTRO_PRAZOS_TUDO)).toHaveLength(4);
  });

  it('só o que está em atraso', () => {
    const r = filtrarAlertas(ALERTAS, filtro({ janela: 'atraso' }));
    expect(r.map((a) => a.id)).toEqual(['1']);
  });

  it('a janela de dias inclui o que está em atraso e exclui o que não tem prazo', () => {
    const r = filtrarAlertas(ALERTAS, filtro({ janela: 7 }));
    expect(r.map((a) => a.id)).toEqual(['1', '2']);
  });

  it('a janela maior apanha mais prazos, mas nunca os que não têm dias', () => {
    const r = filtrarAlertas(ALERTAS, filtro({ janela: 30 }));
    expect(r.map((a) => a.id)).toEqual(['1', '2', '3']);
  });

  it('filtra por exploração', () => {
    const r = filtrarAlertas(ALERTAS, filtro({ exploracaoId: 'e2' }));
    expect(r.map((a) => a.id)).toEqual(['3', '4']);
  });

  it('gravidades e categorias escolhidas somam-se (E entre grupos, OU dentro)', () => {
    const r = filtrarAlertas(
      ALERTAS,
      filtro({ gravidades: ['aviso', 'info'], categorias: ['vacinacao'] }),
    );
    expect(r.map((a) => a.id)).toEqual(['3', '4']);
  });

  it('não altera a lista original', () => {
    const antes = ALERTAS.map((a) => a.id);
    filtrarAlertas(ALERTAS, filtro({ janela: 'atraso' }));
    expect(ALERTAS.map((a) => a.id)).toEqual(antes);
  });
});

describe('descricaoFiltroPrazos', () => {
  it('diz "todos" quando não se escolhe nada', () => {
    expect(descricaoFiltroPrazos(FILTRO_PRAZOS_TUDO)).toBe('Todos os prazos');
  });

  it('enumera a janela, as gravidades e os assuntos escolhidos', () => {
    const d = descricaoFiltroPrazos(filtro({ janela: 7, gravidades: ['urgente'], categorias: ['snira'] }));
    expect(d).toBe('Próximos 7 dias · Urgentes · SNIRA');
  });
});

describe('htmlRelatorioPrazos', () => {
  it('imprime o filtro aplicado, para a folha dizer o que mostra', () => {
    const html = htmlRelatorioPrazos(filtrarAlertas(ALERTAS, filtro({ janela: 'atraso' })), {
      nomeExploracao: 'Quinta do Alto',
      filtro: filtro({ janela: 'atraso' }),
    });
    expect(html).toContain('Só o que está em atraso');
    expect(html).toContain('Quinta do Alto');
    expect(html).toContain('1 urgente(s)');
  });

  it('quando o filtro não deixa nada, explica que foi o filtro (não que está tudo em dia)', () => {
    const f = filtro({ categorias: ['medicamento'] });
    const html = htmlRelatorioPrazos(filtrarAlertas(ALERTAS, f), { filtro: f });
    expect(html).toContain('Nenhum prazo corresponde');
    expect(html).not.toContain('Tudo em dia');
  });

  it('sem filtro nenhum e sem prazos, diz que está tudo em dia', () => {
    expect(htmlRelatorioPrazos([])).toContain('Tudo em dia');
  });

  it('escapa o que vem dos dados do criador', () => {
    const html = htmlRelatorioPrazos([alerta({ id: 'x', titulo: '<script>mau()</script>' })]);
    expect(html).not.toContain('<script>mau()');
    expect(html).toContain('&lt;script&gt;');
  });

  it('assina com o nome atual da app, no cabeçalho e no rodapé', () => {
    // A folha impressa ficou a assinar "GG" (de "Gestão de Gado") depois de a app
    // passar a chamar-se Terrabovina: o rodapé mudou, o logótipo do cabeçalho
    // não. É o único sítio onde a app sai em papel, muitas vezes para entregar
    // a um veterinário ou a um técnico — o nome tem de ser um só.
    const html = htmlRelatorioPrazos([]);
    expect(html).not.toContain('>GG<');
    expect(html).toContain('>TB<');
    expect(html).toContain('Terrabovina');
  });
});

/* ------------------------------------------------------------------ *
 *  Tabelas para Excel
 * ------------------------------------------------------------------ */

const ANIMAIS = [
  { id: 'a1', nome: 'Mimosa' },
  { id: 'a2', numeroIdentificacao: 'PT 9' },
] as Animal[];

describe('tabelaEventos', () => {
  const eventos = [
    { id: 'e1', animalId: 'a1', tipo: 'Vacinação', data: '2026-01-10', descricao: 'Brucelose' },
    { id: 'e2', animalId: 'a2', tipo: 'Pesagem', data: '2026-03-02', descricao: '450 kg' },
  ] as Evento[];

  it('ordena do mais recente para o mais antigo e usa o nome (ou o brinco) do animal', () => {
    const t = tabelaEventos(eventos, ANIMAIS);
    expect(t.linhas.map((l) => l[0])).toEqual(['PT 9', 'Mimosa']);
    expect(t.linhas[0][2]).toBe('02/03/2026');
  });
});

describe('tabelaFinancas', () => {
  const lancamentos = [
    {
      id: 'm1',
      data: '2026-02-01',
      direcao: 'despesa' as const,
      categoria: 'Alimentação' as const,
      valor: 120.5,
      descricao: 'Ração',
      origem: 'movimento' as const,
    },
    {
      id: 'm2',
      data: '2026-02-05',
      direcao: 'receita' as const,
      categoria: 'Venda de animais' as const,
      valor: 900,
      descricao: 'Venda',
      animalId: 'a1',
      origem: 'evento' as const,
    },
  ];

  it('escreve o valor como número, negativo nas despesas (para o Excel somar a coluna)', () => {
    const t = tabelaFinancas(lancamentos, ANIMAIS);
    const valores = t.linhas.map((l) => l[4]);
    expect(valores).toEqual([900, -120.5]);
    expect(typeof valores[0]).toBe('number');
  });

  it('deixa a coluna do animal vazia nas despesas da exploração', () => {
    const t = tabelaFinancas(lancamentos, ANIMAIS);
    expect(t.linhas[1][3]).toBe('');
    expect(t.linhas[0][3]).toBe('Mimosa');
  });
});
