import { describe, expect, it } from '@jest/globals';

import { diaIso, isoDaysAgo } from '../helpers';
import {
  comunicacoesPendentes,
  comunicavel,
  resumoSnira,
  tabelaSnira,
} from '../snira';
import type { Animal, Evento, Exploracao } from '../types';

function animal(over: Partial<Animal> = {}): Animal {
  return {
    id: 'a1',
    exploracaoId: 'exp-1',
    especie: 'Bovino',
    sexo: 'Fêmea',
    nome: 'Mimosa',
    dataNascimento: isoDaysAgo(40),
    numeroIdentificacao: 'PT 6120 0011 2201',
    ...over,
  };
}

function ev(tipo: Evento['tipo'], diasAtras: number, over: Partial<Evento> = {}): Evento {
  return {
    id: `${tipo}-${diasAtras}`,
    animalId: 'a1',
    tipo,
    data: isoDaysAgo(diasAtras),
    descricao: '',
    comunicadoSnira: false,
    ...over,
  };
}

const exploracao: Exploracao = {
  id: 'exp-1',
  utilizadorId: 'u1',
  nome: 'Monte do Avô',
  marcaExploracao: 'PT6120',
  nifDetentor: '500000000',
};

describe('comunicavel', () => {
  it('conhece as quatro que a lei manda comunicar', () => {
    expect(comunicavel('Morte')).toBe(true);
    expect(comunicavel('Venda')).toBe(true);
    expect(comunicavel('Compra')).toBe(true);
    expect(comunicavel('Movimentação')).toBe(true);
  });

  it('e deixa o resto em paz', () => {
    expect(comunicavel('Pesagem')).toBe(false);
    expect(comunicavel('Vacinação')).toBe(false);
    expect(comunicavel('Cobrição')).toBe(false);
  });
});

describe('comunicacoesPendentes — nascimento', () => {
  it('conta sete dias a partir da IDENTIFICAÇÃO, não do nascimento', () => {
    // É o brinco que se comunica: o prazo dos 20 dias para o pôr é outro, e é
    // o alerta de identificação que trata dele.
    const p = comunicacoesPendentes(
      [animal({ dataIdentificacao: isoDaysAgo(2), comunicadoSnira: false })],
      [],
    );
    expect(p).toHaveLength(1);
    expect(p[0].tipo).toBe('nascimento');
    expect(p[0].diasRestantes).toBe(5);
    expect(p[0].eventoId).toBeUndefined();
  });

  it('nada a comunicar enquanto o animal não tiver brinco', () => {
    const p = comunicacoesPendentes([animal({ comunicadoSnira: false })], []);
    expect(p).toHaveLength(0);
  });

  it('nem depois de comunicado', () => {
    const p = comunicacoesPendentes(
      [animal({ dataIdentificacao: isoDaysAgo(2), comunicadoSnira: true })],
      [],
    );
    expect(p).toHaveLength(0);
  });
});

describe('comunicacoesPendentes — mortes e movimentos', () => {
  it('traz a venda com o evento a marcar', () => {
    const p = comunicacoesPendentes([animal({ estado: 'vendido' })], [ev('Venda', 3)]);
    expect(p).toHaveLength(1);
    expect(p[0].tipo).toBe('saida');
    expect(p[0].eventoId).toBe('Venda-3');
    expect(p[0].brinco).toBe('PT 6120 0011 2201');
    expect(p[0].diasRestantes).toBe(4);
  });

  it('e a morte, com o prazo dela', () => {
    const p = comunicacoesPendentes([animal({ estado: 'falecido' })], [ev('Morte', 1)]);
    expect(p[0].tipo).toBe('morte');
    expect(p[0].diasRestantes).toBe(6);
  });

  it('ignora eventos que a lei não manda comunicar', () => {
    expect(comunicacoesPendentes([animal()], [ev('Pesagem', 1)])).toHaveLength(0);
  });

  it('ignora um evento cujo animal não está na lista', () => {
    // Sem o animal (a RLS não o deu, ou foi mesmo apagado) não há brinco, e uma
    // linha sem brinco não serve de nada no portal.
    expect(comunicacoesPendentes([], [ev('Venda', 3)])).toHaveLength(0);
  });

  it('deixa de fora os animais ELIMINADOS', () => {
    // Eliminar quer dizer "este registo foi criado por engano" (ver
    // `EstadoAnimal`). Mandar comunicar ao Estado um animal que o criador disse
    // não existir é o oposto do que a app deve fazer.
    const p = comunicacoesPendentes(
      [animal({ estado: 'eliminado', dataIdentificacao: isoDaysAgo(2), comunicadoSnira: false })],
      [ev('Venda', 3)],
    );
    expect(p).toHaveLength(0);
  });
});

describe('ordenação e resumo', () => {
  const pendentes = comunicacoesPendentes(
    [
      animal({ id: 'a1', nome: 'Atrasada', dataIdentificacao: isoDaysAgo(20), comunicadoSnira: false }),
      animal({ id: 'a2', nome: 'Folgada', dataIdentificacao: isoDaysAgo(1), comunicadoSnira: false }),
      animal({ id: 'a3', nome: 'Justa', dataIdentificacao: isoDaysAgo(5), comunicadoSnira: false }),
    ],
    [],
  );

  it('põe o mais atrasado primeiro', () => {
    expect(pendentes.map((p) => p.rotulo)).toEqual(['Atrasada', 'Justa', 'Folgada']);
  });

  it('separa o que já venceu do que está a vencer', () => {
    const r = resumoSnira(pendentes);
    expect(r.total).toBe(3);
    expect(r.emAtraso).toBe(1);
    expect(r.urgentes).toBe(1);
  });
});

describe('tabelaSnira', () => {
  it('repete a marca de exploração em cada linha', () => {
    // Quem preenche o formulário do portal precisa dela em cada linha, não uma
    // vez no topo da folha.
    const p = comunicacoesPendentes(
      [animal({ dataIdentificacao: isoDaysAgo(2), comunicadoSnira: false })],
      [],
    );
    const t = tabelaSnira(p, [exploracao]);
    expect(t.cabecalhos[0]).toBe('Brinco');
    expect(t.linhas[0]).toContain('PT6120');
    expect(t.linhas[0]).toContain(diaIso(isoDaysAgo(2)));
  });
});
