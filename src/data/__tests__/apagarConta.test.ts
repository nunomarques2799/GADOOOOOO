import { describe, expect, it } from '@jest/globals';

import {
  confirmacaoValida,
  consequenciasDeApagar,
  PALAVRA_CONFIRMACAO,
  pessoasAfetadas,
} from '../apagarConta';

const EU = 'user-1';
const OUTRO = 'user-2';

/** O caso normal: um criador com a sua quinta. */
const minhaQuinta = { id: 'e1', nome: 'Quinta do Souto', utilizadorId: EU };
/** A quinta de outra pessoa, onde eu só entro por convite. */
const quintaAlheia = { id: 'e2', nome: 'Herdade da Ponte', utilizadorId: OUTRO };

describe('consequenciasDeApagar', () => {
  it('o dono leva a exploração e os animais dela', () => {
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [minhaQuinta],
      animais: [{ exploracaoId: 'e1' }, { exploracaoId: 'e1' }, { exploracaoId: 'e1' }],
      membros: [{ exploracaoId: 'e1', role: 'admin' }],
    });

    expect(r.apagaDados).toBe(true);
    expect(r.exploracoesApagadas).toEqual([
      { id: 'e1', nome: 'Quinta do Souto', animais: 3 },
    ]);
    expect(r.animais).toBe(3);
    expect(r.acessosPerdidos).toEqual([]);
  });

  it('o trabalhador não apaga exploração nenhuma — só perde a entrada', () => {
    // É a diferença que este ecrã existe para dizer. Se aqui aparecesse
    // `apagaDados: true`, a app estava a ameaçar um trabalhador com o
    // apagamento de animais que não são dele e que não vão a lado nenhum.
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [quintaAlheia],
      animais: [{ exploracaoId: 'e2' }, { exploracaoId: 'e2' }],
      membros: [{ exploracaoId: 'e2', role: 'trabalhador' }],
    });

    expect(r.apagaDados).toBe(false);
    expect(r.exploracoesApagadas).toEqual([]);
    expect(r.animais).toBe(0);
    expect(r.acessosPerdidos).toEqual([
      { id: 'e2', nome: 'Herdade da Ponte', role: 'trabalhador' },
    ]);
  });

  it('o veterinário também não, mesmo com a exploração na cache', () => {
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [quintaAlheia],
      animais: [{ exploracaoId: 'e2' }],
      membros: [{ exploracaoId: 'e2', role: 'veterinario' }],
    });

    expect(r.apagaDados).toBe(false);
    expect(r.acessosPerdidos[0].role).toBe('veterinario');
  });

  it('quem é as duas coisas vê os dois lados separados', () => {
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [minhaQuinta, quintaAlheia],
      animais: [{ exploracaoId: 'e1' }, { exploracaoId: 'e2' }, { exploracaoId: 'e2' }],
      membros: [
        { exploracaoId: 'e1', role: 'admin' },
        { exploracaoId: 'e2', role: 'trabalhador' },
      ],
    });

    expect(r.exploracoesApagadas).toEqual([{ id: 'e1', nome: 'Quinta do Souto', animais: 1 }]);
    // Os animais da quinta alheia não entram na conta: não vão ser apagados.
    expect(r.animais).toBe(1);
    expect(r.acessosPerdidos.map((a) => a.id)).toEqual(['e2']);
  });

  it('a posse lê-se do utilizadorId mesmo sem vínculo carregado', () => {
    // No arranque a cache traz as explorações antes de o `membros` responder.
    // Sem esta fonte, o ecrã dizia a um dono que não perdia nada.
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [minhaQuinta],
      animais: [{ exploracaoId: 'e1' }],
      membros: [],
    });

    expect(r.apagaDados).toBe(true);
    expect(r.exploracoesApagadas[0].id).toBe('e1');
  });

  it('e do vínculo admin mesmo sem a exploração na cache', () => {
    // O contrário: entrou-se com a conta noutro aparelho e a lista local ainda
    // está vazia. A exploração conta à mesma — sem nome, mas conta.
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [],
      animais: [],
      membros: [{ exploracaoId: 'e9', role: 'admin' }],
    });

    expect(r.apagaDados).toBe(true);
    expect(r.exploracoesApagadas).toHaveLength(1);
    expect(r.exploracoesApagadas[0].id).toBe('e9');
  });

  it('não conta a mesma exploração duas vezes', () => {
    // `utilizadorId` e vínculo `admin` dizem a mesma coisa sobre a mesma
    // quinta. Somar as duas fontes dava "2 explorações" a quem tem uma.
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [minhaQuinta],
      animais: [{ exploracaoId: 'e1' }],
      membros: [
        { exploracaoId: 'e1', role: 'admin' },
        { exploracaoId: 'e1', role: 'admin' },
      ],
    });

    expect(r.exploracoesApagadas).toHaveLength(1);
    expect(r.animais).toBe(1);
  });

  it('uma conta sem nada não promete apagar nada', () => {
    const r = consequenciasDeApagar({
      utilizadorId: EU,
      exploracoes: [],
      animais: [],
      membros: [],
    });

    expect(r).toEqual({
      exploracoesApagadas: [],
      acessosPerdidos: [],
      animais: 0,
      apagaDados: false,
    });
  });
});

describe('pessoasAfetadas', () => {
  it('conta gente, não vínculos', () => {
    // O mesmo trabalhador nas duas quintas que vão cair é um homem.
    expect(
      pessoasAfetadas(EU, [
        { userId: EU },
        { userId: OUTRO },
        { userId: OUTRO },
        { userId: 'user-3' },
      ]),
    ).toBe(2);
  });

  it('não se conta a si próprio', () => {
    expect(pessoasAfetadas(EU, [{ userId: EU }])).toBe(0);
  });

  it('sem equipa, ninguém fica sem acesso', () => {
    expect(pessoasAfetadas(EU, [])).toBe(0);
  });
});

describe('confirmacaoValida', () => {
  it('aceita a palavra, com espaços ou em minúsculas', () => {
    // O teclado do telemóvel corrige a caixa sozinho, e ninguém repara nos
    // espaços que a colagem traz. Recusar isso era recusar quem acertou.
    expect(confirmacaoValida(PALAVRA_CONFIRMACAO)).toBe(true);
    expect(confirmacaoValida('apagar')).toBe(true);
    expect(confirmacaoValida('  Apagar  ')).toBe(true);
  });

  it('recusa tudo o resto', () => {
    expect(confirmacaoValida('')).toBe(false);
    expect(confirmacaoValida('   ')).toBe(false);
    expect(confirmacaoValida('apag')).toBe(false);
    expect(confirmacaoValida('apagar conta')).toBe(false);
    expect(confirmacaoValida('sim')).toBe(false);
  });
});
