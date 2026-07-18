/**
 * Testes da gestão económica.
 *
 * Porquê aqui: um erro nesta soma não rebenta nada — o ecrã abre bonito e o
 * número está errado. O criador toma decisões (vender, comprar ração, pedir
 * apoio) a olhar para ele. Os casos abaixo são os que o fazem mentir em
 * silêncio: contar o preço de venda duas vezes, esquecer as despesas que não
 * têm animal, ou dar 0% de variação quando não havia com que comparar.
 */

import { describe, expect, it } from '@jest/globals';

import {
  balancoAnimal,
  categoriaDoEvento,
  compararComAnterior,
  direcaoDoEvento,
  eventoTemValor,
  lancamentos,
  noPeriodo,
  porAnimal,
  resumo,
  resumoFinanceiro,
  serieMensal,
  vendasSemPreco,
} from '../financas';
import type { Animal, Evento, Movimento } from '../types';

/* ---- Fixtures ---- */

const animal = (id: string, exploracaoId = 'exp-1'): Animal => ({
  id,
  exploracaoId,
  especie: 'Bovino',
  sexo: 'Fêmea',
  dataNascimento: '2020-01-01T12:00:00.000Z',
});

const evento = (over: Partial<Evento> & Pick<Evento, 'tipo'>): Evento => ({
  id: `e-${Math.random()}`,
  animalId: 'a1',
  data: '2026-07-10T12:00:00.000Z',
  descricao: '',
  ...over,
});

const movimento = (over: Partial<Movimento> & Pick<Movimento, 'direcao' | 'categoria' | 'valor'>): Movimento => ({
  id: `m-${Math.random()}`,
  exploracaoId: 'exp-1',
  data: '2026-07-10T12:00:00.000Z',
  descricao: '',
  ...over,
});

describe('sentido financeiro de um evento', () => {
  it('compra, vacina e medicamento são despesa', () => {
    expect(direcaoDoEvento('Compra')).toBe('despesa');
    expect(direcaoDoEvento('Vacinação')).toBe('despesa');
    expect(direcaoDoEvento('Medicamento')).toBe('despesa');
    expect(categoriaDoEvento('Vacinação')).toBe('Sanidade');
    expect(categoriaDoEvento('Compra')).toBe('Compra de animais');
  });

  it('uma VENDA não tem valor no evento — o preço é um movimento', () => {
    // Esta é a regra que impede o preço de venda de ser legível por toda a
    // equipa (uma coluna não se esconde a uns membros e não a outros) e, ao
    // mesmo tempo, o que evita contá-lo duas vezes ao somar as duas origens.
    expect(direcaoDoEvento('Venda')).toBeUndefined();
    expect(eventoTemValor(evento({ tipo: 'Venda', valor: 1500 }))).toBe(false);
  });

  it('eventos sem dinheiro ficam de fora', () => {
    expect(direcaoDoEvento('Pesagem')).toBeUndefined();
    expect(direcaoDoEvento('Parto')).toBeUndefined();
    expect(eventoTemValor(evento({ tipo: 'Vacinação' }))).toBe(false);
    expect(eventoTemValor(evento({ tipo: 'Vacinação', valor: 0 }))).toBe(false);
    expect(eventoTemValor(evento({ tipo: 'Vacinação', valor: 18 }))).toBe(true);
  });
});

describe('lancamentos — as duas origens numa conta só', () => {
  it('soma custos de eventos e movimentos da exploração', () => {
    const lista = lancamentos(
      [evento({ tipo: 'Vacinação', valor: 18 })],
      [movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 860 })],
    );
    const r = resumo(lista);
    expect(r.despesas).toBe(878);
    expect(r.receitas).toBe(0);
    expect(r.saldo).toBe(-878);
  });

  it('conta as despesas que não têm animal nenhum', () => {
    // O caso que motivou a tabela `movimento`: a ração e a eletricidade são o
    // grosso do custo e não pertencem a animal nenhum. Enquanto só se contava
    // dinheiro preso a um animal, o saldo aparecia positivo a quem perdia.
    const r = resumoFinanceiro(
      [],
      [
        movimento({ direcao: 'receita', categoria: 'Venda de animais', valor: 1500 }),
        movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 900 }),
        movimento({ direcao: 'despesa', categoria: 'Energia e combustível', valor: 700 }),
      ],
    );
    expect(r.receitas).toBe(1500);
    expect(r.despesas).toBe(1600);
    expect(r.saldo).toBe(-100);
  });

  it('filtrar por exploração não deixa passar o dinheiro de outra', () => {
    const lista = lancamentos(
      [
        evento({ tipo: 'Compra', valor: 1000, animalId: 'a1' }),
        evento({ tipo: 'Compra', valor: 5000, animalId: 'a2' }),
      ],
      [
        movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 100 }),
        movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 900, exploracaoId: 'exp-2' }),
      ],
      { exploracaoId: 'exp-1', animais: [animal('a1'), animal('a2', 'exp-2')] },
    );
    expect(resumo(lista).despesas).toBe(1100);
  });

  it('uma exploração ainda sem animais não herda os eventos das outras', () => {
    // A decisão tem de ser "há filtro?", nunca "o conjunto de animais tem
    // elementos?" — senão uma exploração vazia somava o dinheiro de todas.
    const lista = lancamentos(
      [evento({ tipo: 'Compra', valor: 1000, animalId: 'a1' })],
      [],
      { exploracaoId: 'exp-vazia', animais: [animal('a1')] },
    );
    expect(lista).toEqual([]);
  });

  it('ordena do mais recente para o mais antigo', () => {
    const lista = lancamentos(
      [evento({ tipo: 'Compra', valor: 10, data: '2026-01-01T12:00:00.000Z' })],
      [movimento({ direcao: 'despesa', categoria: 'Água', valor: 20, data: '2026-06-01T12:00:00.000Z' })],
    );
    expect(lista.map((l) => l.valor)).toEqual([20, 10]);
  });
});

describe('resumo por categoria', () => {
  it('agrupa, ordena da maior para a menor e calcula a fatia', () => {
    const r = resumoFinanceiro(
      [evento({ tipo: 'Vacinação', valor: 100 })],
      [
        movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 600 }),
        movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 300 }),
      ],
    );
    expect(r.categoriasDespesa.map((c) => c.categoria)).toEqual(['Alimentação', 'Sanidade']);
    expect(r.categoriasDespesa[0].total).toBe(900);
    expect(r.categoriasDespesa[0].contagem).toBe(2);
    expect(r.categoriasDespesa[0].percentagem).toBe(90);
    expect(r.categoriasDespesa[1].percentagem).toBe(10);
  });

  it('separa receitas de despesas', () => {
    const r = resumoFinanceiro([], [
      movimento({ direcao: 'receita', categoria: 'Apoios e subsídios', valor: 2400 }),
      movimento({ direcao: 'despesa', categoria: 'Alimentação', valor: 800 }),
    ]);
    expect(r.categoriasReceita.map((c) => c.categoria)).toEqual(['Apoios e subsídios']);
    expect(r.categoriasDespesa.map((c) => c.categoria)).toEqual(['Alimentação']);
  });
});

describe('períodos', () => {
  const agora = new Date(2026, 6, 15, 12, 0, 0); // 15 de julho de 2026

  const emJulho = movimento({
    direcao: 'despesa',
    categoria: 'Alimentação',
    valor: 100,
    data: new Date(2026, 6, 3, 12).toISOString(),
  });
  const emJunho = movimento({
    direcao: 'despesa',
    categoria: 'Alimentação',
    valor: 200,
    data: new Date(2026, 5, 3, 12).toISOString(),
  });
  const anoPassado = movimento({
    direcao: 'despesa',
    categoria: 'Alimentação',
    valor: 400,
    data: new Date(2025, 5, 3, 12).toISOString(),
  });

  const lista = lancamentos([], [emJulho, emJunho, anoPassado]);

  it('"este mês" só apanha o mês corrente', () => {
    expect(resumo(noPeriodo(lista, 'mes', agora)).despesas).toBe(100);
  });

  it('"este ano" apanha o ano corrente', () => {
    expect(resumo(noPeriodo(lista, 'ano', agora)).despesas).toBe(300);
  });

  it('"tudo" não filtra nada', () => {
    expect(resumo(noPeriodo(lista, 'tudo', agora)).despesas).toBe(700);
  });
});

describe('comparação com o período anterior', () => {
  const agora = new Date(2026, 6, 15, 12, 0, 0);
  const gasto = (valor: number, mes: number) =>
    movimento({
      direcao: 'despesa',
      categoria: 'Alimentação',
      valor,
      data: new Date(2026, mes, 5, 12).toISOString(),
    });

  it('mede a subida das despesas face ao mês anterior', () => {
    const lista = lancamentos([], [gasto(150, 6), gasto(100, 5)]);
    const c = compararComAnterior(lista, 'mes', agora);
    expect(c.despesas).toBe(150);
    expect(c.despesasAntes).toBe(100);
    expect(c.variacaoDespesas).toBe(50);
  });

  it('sem período anterior, não inventa uma percentagem', () => {
    // Dizer "+100%" quando antes não havia nada é uma comparação com o vazio.
    // `undefined` é o que faz a seta desaparecer do ecrã em vez de mentir.
    const lista = lancamentos([], [gasto(150, 6)]);
    const c = compararComAnterior(lista, 'mes', agora);
    expect(c.despesasAntes).toBe(0);
    expect(c.variacaoDespesas).toBeUndefined();
  });

  it('o período "tudo" não tem anterior com que comparar', () => {
    const c = compararComAnterior(lancamentos([], [gasto(150, 6)]), 'tudo', agora);
    expect(c.disponivel).toBe(false);
  });
});

describe('serieMensal', () => {
  const agora = new Date(2026, 6, 15, 12, 0, 0);

  it('devolve os últimos n meses, do mais antigo para o mais recente', () => {
    const meses = serieMensal([], 6, agora);
    expect(meses).toHaveLength(6);
    expect(meses[0].chave).toBe('2026-02');
    expect(meses[5].chave).toBe('2026-07');
    expect(meses[5].rotulo).toBe('Jul');
  });

  it('meses sem movimento ficam a zero, não desaparecem', () => {
    // Um buraco no gráfico esconderia que naquele mês não se registou nada —
    // e isso é informação, não ausência dela.
    const meses = serieMensal(
      lancamentos([], [
        movimento({
          direcao: 'despesa',
          categoria: 'Água',
          valor: 50,
          data: new Date(2026, 6, 2, 12).toISOString(),
        }),
      ]),
      3,
      agora,
    );
    expect(meses.map((m) => m.despesas)).toEqual([0, 0, 50]);
    expect(meses[2].saldo).toBe(-50);
  });
});

describe('balanço por animal', () => {
  it('junta os custos do evento com a receita do movimento', () => {
    const b = balancoAnimal(
      [evento({ tipo: 'Compra', valor: 1000 }), evento({ tipo: 'Vacinação', valor: 50 })],
      [movimento({ direcao: 'receita', categoria: 'Venda de animais', valor: 1500, animalId: 'a1' })],
    );
    expect(b.custos).toBe(1050);
    expect(b.receita).toBe(1500);
    expect(b.resultado).toBe(450);
    expect(b.temDados).toBe(true);
  });

  it('sem os movimentos, um animal vendido não parece dar prejuízo por engano', () => {
    // Antes de o preço mudar para `movimento`, chamar isto só com os eventos
    // dava a receita a zero — e o animal aparecia sempre no vermelho.
    const soEventos = balancoAnimal([evento({ tipo: 'Compra', valor: 1000 })]);
    expect(soEventos.receita).toBe(0);
    expect(soEventos.resultado).toBe(-1000);
  });

  it('um animal sem dinheiro associado não tem balanço', () => {
    expect(balancoAnimal([evento({ tipo: 'Pesagem' })]).temDados).toBe(false);
  });
});

describe('porAnimal', () => {
  it('ordena pelo que mais custou e ignora o que não tem animal', () => {
    const lista = lancamentos(
      [
        evento({ tipo: 'Compra', valor: 1000, animalId: 'a1' }),
        evento({ tipo: 'Vacinação', valor: 300, animalId: 'a2' }),
      ],
      [
        movimento({ direcao: 'receita', categoria: 'Venda de animais', valor: 1500, animalId: 'a1' }),
        // A fatura da luz não tem animal — não pode aparecer no ranking.
        movimento({ direcao: 'despesa', categoria: 'Energia e combustível', valor: 5000 }),
      ],
    );
    const r = porAnimal(lista);
    expect(r.map((l) => l.animalId)).toEqual(['a1', 'a2']);
    expect(r[0].resultado).toBe(500);
    expect(r[1].resultado).toBe(-300);
  });
});

describe('vendasSemPreco', () => {
  it('apanha a venda que ficou por fechar', () => {
    // O trabalhador regista a saída; o preço é do dono. Sem esta lista, a
    // venda ficava invisível e as receitas apareciam em baixo sem explicação.
    const porFechar = vendasSemPreco(
      [
        evento({ tipo: 'Venda', animalId: 'a1' }),
        evento({ tipo: 'Venda', animalId: 'a2' }),
      ],
      [movimento({ direcao: 'receita', categoria: 'Venda de animais', valor: 1500, animalId: 'a2' })],
    );
    expect(porFechar.map((e) => e.animalId)).toEqual(['a1']);
  });

  it('não confunde uma despesa imputada ao animal com o preço da venda', () => {
    const porFechar = vendasSemPreco(
      [evento({ tipo: 'Venda', animalId: 'a1' })],
      [movimento({ direcao: 'despesa', categoria: 'Sanidade', valor: 40, animalId: 'a1' })],
    );
    expect(porFechar).toHaveLength(1);
  });
});
