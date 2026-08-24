/**
 * As contas da fila de moderação: a ordem por que se trabalha, o que se lê de
 * uma linha que veio da base, e quem é preciso nomear.
 *
 * O que NÃO se testa aqui é quem consegue LER a fila: isso é a RLS, vive em
 * `supabase/schema_chat.sql` e prova-se no psql a impersonar cada papel
 * (`supabase/provar_denuncias.sql`). Um teste em JavaScript que "provasse" que
 * só o superadmin lê denúncias estaria a provar a cópia, não o original.
 */

import { describe, expect, it } from '@jest/globals';

import {
  contarAbertas,
  lerContexto,
  lerTipo,
  MAX_NOTA,
  nomeDaPessoa,
  ordenarDenuncias,
  pessoasEnvolvidas,
  podeReabrir,
  podeTratar,
  problemaComNota,
  resumoDoConteudo,
  rotuloTipo,
  temFicheiroParaVer,
  type Denuncia,
} from '../denuncias';

/** Uma denúncia com o mínimo preenchido. */
function den(p: Partial<Denuncia> & { id: string }): Denuncia {
  return {
    textoCopia: 'isto não se diz',
    tipo: 'texto',
    contexto: [],
    criadoEm: '2026-08-20T10:00:00.000Z',
    estado: 'aberta',
    ...p,
  };
}

describe('ordenarDenuncias', () => {
  it('põe as abertas à frente das tratadas, por mais antigas que sejam', () => {
    const lista = [
      den({ id: 'tratada-hoje', estado: 'tratada', criadoEm: '2026-08-24T09:00:00.000Z' }),
      den({ id: 'aberta-velha', estado: 'aberta', criadoEm: '2026-08-01T09:00:00.000Z' }),
    ];
    expect(ordenarDenuncias(lista).map((d) => d.id)).toEqual(['aberta-velha', 'tratada-hoje']);
  });

  it('dentro do mesmo estado, a mais recente fica em cima', () => {
    const lista = [
      den({ id: 'a', criadoEm: '2026-08-01T09:00:00.000Z' }),
      den({ id: 'c', criadoEm: '2026-08-23T09:00:00.000Z' }),
      den({ id: 'b', criadoEm: '2026-08-10T09:00:00.000Z' }),
    ];
    expect(ordenarDenuncias(lista).map((d) => d.id)).toEqual(['c', 'b', 'a']);
  });

  it('não mexe na lista que recebeu', () => {
    const lista = [
      den({ id: 'tratada', estado: 'tratada' }),
      den({ id: 'aberta', estado: 'aberta' }),
    ];
    ordenarDenuncias(lista);
    expect(lista.map((d) => d.id)).toEqual(['tratada', 'aberta']);
  });
});

describe('contarAbertas', () => {
  it('conta só as que estão por tratar', () => {
    expect(
      contarAbertas([
        den({ id: '1' }),
        den({ id: '2', estado: 'tratada' }),
        den({ id: '3' }),
      ]),
    ).toBe(2);
  });

  it('sem denúncias, é zero', () => {
    expect(contarAbertas([])).toBe(0);
  });
});

describe('lerTipo', () => {
  it('aceita os cinco tipos que a base grava', () => {
    for (const t of ['texto', 'foto', 'audio', 'local', 'sondagem'] as const) {
      expect(lerTipo(t)).toBe(t);
    }
  });

  /**
   * A coluna `tipo` só nasceu no `schema_chat_anexos.sql` (36.º). Uma denúncia
   * feita entre os dois ficheiros tem-na a nulo, e tem de continuar a abrir.
   */
  it('uma denúncia anterior aos anexos conta como texto', () => {
    expect(lerTipo(null)).toBe('texto');
    expect(lerTipo(undefined)).toBe('texto');
  });

  it('e um valor que não é tipo nenhum também', () => {
    expect(lerTipo('video')).toBe('texto');
    expect(lerTipo(7)).toBe('texto');
  });
});

describe('lerContexto', () => {
  it('lê as mensagens anteriores como a base as escreveu', () => {
    const lido = lerContexto([
      { autor: 'u1', texto: 'bom dia', tipo: 'texto', criado_em: '2026-08-20T09:00:00.000Z' },
      { autor: 'u2', texto: '', tipo: 'foto', criado_em: '2026-08-20T09:30:00.000Z' },
    ]);
    expect(lido).toEqual([
      { autor: 'u1', texto: 'bom dia', tipo: 'texto', criadoEm: '2026-08-20T09:00:00.000Z' },
      { autor: 'u2', texto: '', tipo: 'foto', criadoEm: '2026-08-20T09:30:00.000Z' },
    ]);
  });

  /**
   * O `contexto` é `jsonb` e chega sem garantias. Este ecrã é o último sítio
   * onde se quer um erro em vez do que alguém pediu para ser lido: uma linha
   * estranha perde-se, o resto abre.
   */
  it('aguenta o que não devia lá estar', () => {
    expect(lerContexto(null)).toEqual([]);
    expect(lerContexto('[]')).toEqual([]);
    expect(lerContexto({ autor: 'u1' })).toEqual([]);
    expect(lerContexto([null, 3, 'x'])).toEqual([]);
  });

  it('uma linha sem texto nem tipo abre à mesma', () => {
    expect(lerContexto([{ autor: 'u1' }])).toEqual([
      { autor: 'u1', texto: '', tipo: 'texto', criadoEm: undefined },
    ]);
  });

  it('uma conta apagada deixa o autor por saber, e isso não é erro', () => {
    expect(lerContexto([{ texto: 'olá' }])[0].autor).toBeUndefined();
  });
});

describe('resumoDoConteudo', () => {
  it('numa mensagem escrita, é o que foi escrito', () => {
    expect(resumoDoConteudo({ tipo: 'texto', textoCopia: 'isto não se diz' })).toBe(
      'isto não se diz',
    );
  });

  /**
   * O caso que fez a coluna `tipo` existir: uma fotografia sem legenda dava uma
   * linha em branco na fila de moderação (ver o cabeçalho do
   * `schema_chat_anexos.sql`).
   */
  it('uma fotografia sem legenda diz que é uma fotografia', () => {
    expect(resumoDoConteudo({ tipo: 'foto', textoCopia: '' })).toBe('Fotografia');
    expect(resumoDoConteudo({ tipo: 'audio', textoCopia: '   ' })).toBe('Mensagem de voz');
  });

  it('mas a legenda ganha à palavra genérica quando existe', () => {
    expect(resumoDoConteudo({ tipo: 'foto', textoCopia: 'o portão partido' })).toBe(
      'o portão partido',
    );
  });

  it('uma mensagem escrita e vazia não deixa o cartão em branco', () => {
    expect(resumoDoConteudo({ tipo: 'texto', textoCopia: '  ' })).toBe('(sem texto)');
  });
});

describe('rotuloTipo', () => {
  it('dá nome a cada tipo', () => {
    expect(rotuloTipo('texto')).toBe('Mensagem escrita');
    expect(rotuloTipo('foto')).toBe('Fotografia');
    expect(rotuloTipo('audio')).toBe('Mensagem de voz');
    expect(rotuloTipo('local')).toBe('Localização');
    expect(rotuloTipo('sondagem')).toBe('Sondagem');
  });
});

describe('temFicheiroParaVer', () => {
  it('a fotografia e o áudio têm ficheiro', () => {
    expect(temFicheiroParaVer(den({ id: '1', tipo: 'foto', anexo: 'c/m.jpg' }))).toBe(true);
    expect(temFicheiroParaVer(den({ id: '2', tipo: 'audio', anexo: 'c/m.m4a' }))).toBe(true);
  });

  it('o texto, a localização e a sondagem não', () => {
    expect(temFicheiroParaVer(den({ id: '3', tipo: 'texto' }))).toBe(false);
    expect(temFicheiroParaVer(den({ id: '4', tipo: 'local' }))).toBe(false);
    expect(temFicheiroParaVer(den({ id: '5', tipo: 'sondagem' }))).toBe(false);
  });

  /**
   * O tipo diz "foto" e o caminho não veio: pedir uma ligação assinada a
   * `undefined` devolvia um erro do Storage no meio do cartão.
   */
  it('nem uma fotografia sem caminho', () => {
    expect(temFicheiroParaVer(den({ id: '6', tipo: 'foto' }))).toBe(false);
  });
});

describe('pessoasEnvolvidas', () => {
  it('junta quem denunciou, quem foi denunciado e quem escreveu o contexto', () => {
    const ids = pessoasEnvolvidas([
      den({
        id: '1',
        denunciadoPor: 'u1',
        autorDenunciado: 'u2',
        contexto: [
          { autor: 'u3', texto: 'a', tipo: 'texto' },
          { autor: 'u1', texto: 'b', tipo: 'texto' },
        ],
      }),
    ]);
    expect([...ids].sort()).toEqual(['u1', 'u2', 'u3']);
  });

  it('não repete quem aparece em duas denúncias', () => {
    const ids = pessoasEnvolvidas([
      den({ id: '1', denunciadoPor: 'u1', autorDenunciado: 'u2' }),
      den({ id: '2', denunciadoPor: 'u1', autorDenunciado: 'u2' }),
    ]);
    expect(ids).toHaveLength(2);
  });

  /**
   * As colunas são `on delete set null`: uma conta apagada deixa o campo a
   * nulo. Perguntar ao servidor pelo perfil de `undefined` devolvia a tabela
   * toda ou um erro, conforme o filtro.
   */
  it('ignora as contas que já não existem', () => {
    expect(pessoasEnvolvidas([den({ id: '1' })])).toEqual([]);
  });
});

describe('nomeDaPessoa', () => {
  const pessoas = { u1: { nome: 'Manuel Silva' }, u2: { nome: '  ' }, u3: {} };

  it('diz o nome quando o há', () => {
    expect(nomeDaPessoa(pessoas, 'u1')).toBe('Manuel Silva');
  });

  it('um perfil sem nome não deixa o cartão em branco', () => {
    expect(nomeDaPessoa(pessoas, 'u2')).toBe('Sem nome');
    expect(nomeDaPessoa(pessoas, 'u3')).toBe('Sem nome');
    expect(nomeDaPessoa(pessoas, 'desconhecido')).toBe('Sem nome');
  });

  it('e uma conta apagada diz que foi apagada, que é outra coisa', () => {
    expect(nomeDaPessoa(pessoas, undefined)).toBe('Conta apagada');
  });
});

describe('podeTratar e podeReabrir', () => {
  it('nunca são as duas ao mesmo tempo', () => {
    const aberta = den({ id: '1' });
    const tratada = den({ id: '2', estado: 'tratada' });
    expect([podeTratar(aberta), podeReabrir(aberta)]).toEqual([true, false]);
    expect([podeTratar(tratada), podeReabrir(tratada)]).toEqual([false, true]);
  });
});

describe('problemaComNota', () => {
  /**
   * Fechar sem escrever nada é uma decisão legítima ("não é nada"). Obrigar a
   * justificar cada uma levava a que nenhuma fosse fechada, e a fila deixava
   * de dizer o que falta fazer.
   */
  it('deixa fechar sem escrever nada', () => {
    expect(problemaComNota('')).toBeNull();
  });

  it('aceita uma nota até ao tamanho da coluna', () => {
    expect(problemaComNota('a'.repeat(MAX_NOTA))).toBeNull();
  });

  it('e recusa uma que não caberia lá', () => {
    expect(problemaComNota('a'.repeat(MAX_NOTA + 1))).toContain(String(MAX_NOTA));
  });
});
