import { describe, expect, it } from '@jest/globals';

import {
  CATEGORIAS_DOCUMENTO,
  CATEGORIA_OMISSAO,
  caminhoDocumento,
  categoriaValida,
  contarPorCategoria,
  explicacaoCategoria,
  filtrarPorCategoria,
  iconeCategoria,
  problemaComDocumento,
  TAMANHO_MAX,
  tamanhoLegivel,
  type Documento,
} from '../documentos';

function doc(p: Partial<Documento> & { id: string }): Documento {
  return {
    exploracaoId: 'exp-1',
    titulo: 'Fatura',
    categoria: 'Outros',
    caminho: 'exp-1/x.jpg',
    publico: true,
    criadoEm: '2026-08-01T10:00:00.000Z',
    ...p,
  };
}

describe('categoriaValida — o que vem de fora não parte o ecrã', () => {
  it('aceita as que conhecemos', () => {
    for (const c of CATEGORIAS_DOCUMENTO) expect(categoriaValida(c)).toBe(c);
  });

  it('o desconhecido cai em "Outros" em vez de sumir', () => {
    // A cache local é um ficheiro editável à mão e a coluna chega da rede. Um
    // valor estranho tem de dar um documento na gaveta errada, não um documento
    // invisível.
    expect(categoriaValida('Inventada')).toBe(CATEGORIA_OMISSAO);
    expect(categoriaValida(undefined)).toBe(CATEGORIA_OMISSAO);
    expect(categoriaValida(null)).toBe(CATEGORIA_OMISSAO);
    expect(categoriaValida(42)).toBe(CATEGORIA_OMISSAO);
  });
});

describe('problemaComDocumento — uma frase por engano', () => {
  it('deixa passar o que está bem', () => {
    expect(problemaComDocumento('Fatura da ração', 400_000)).toBeNull();
  });

  it('sem nome não se volta a encontrar o papel', () => {
    expect(problemaComDocumento('   ', 400_000)).toMatch(/nome/i);
  });

  it('recusa o ficheiro vazio e o grande de mais, com razões diferentes', () => {
    expect(problemaComDocumento('Fatura', 0)).toMatch(/vazio/);
    // No limite passa; um byte acima não. Se este teto divergir do
    // `file_size_limit` do bucket, é o Storage que recusa — em inglês e depois
    // de a imagem toda ter subido.
    expect(problemaComDocumento('Fatura', TAMANHO_MAX)).toBeNull();
    expect(problemaComDocumento('Fatura', TAMANHO_MAX + 1)).toMatch(/grande/);
  });
});

describe('caminhoDocumento', () => {
  it('põe a exploração à FRENTE — é o que a RLS do bucket lê', () => {
    // `storage.foldername(name)[1]` é a primeira pasta, e é por ela que o
    // servidor decide de quem é o ficheiro. Trocar a ordem abria os documentos
    // de toda a gente sem nada no SQL mudar.
    const caminho = caminhoDocumento('exp-1', 'abc-123', 'jpg');
    expect(caminho).toBe('exp-1/abc-123.jpg');
    expect(caminho.split('/')[0]).toBe('exp-1');
  });
});

describe('tamanhoLegivel', () => {
  it('escreve como se lê em português', () => {
    expect(tamanhoLegivel(512)).toBe('512 B');
    expect(tamanhoLegivel(400_000)).toBe('391 KB');
    // Vírgula decimal, não ponto.
    expect(tamanhoLegivel(2_000_000)).toBe('1,9 MB');
  });

  it('não inventa nada sem tamanho', () => {
    expect(tamanhoLegivel(undefined)).toBe('');
    expect(tamanhoLegivel(0)).toBe('');
  });
});

describe('filtrar e contar', () => {
  const lista = [
    doc({ id: 'a', categoria: 'Financeiro' }),
    doc({ id: 'b', categoria: 'Financeiro' }),
    doc({ id: 'c', categoria: 'Sanidade' }),
  ];

  it('sem gaveta escolhida devolve tudo', () => {
    expect(filtrarPorCategoria(lista)).toHaveLength(3);
  });

  it('com gaveta devolve só a dela', () => {
    expect(filtrarPorCategoria(lista, 'Financeiro').map((d) => d.id)).toEqual(['a', 'b']);
    expect(filtrarPorCategoria(lista, 'Documentos pessoais')).toHaveLength(0);
  });

  it('conta por gaveta, com zero nas vazias', () => {
    const conta = contarPorCategoria(lista);
    expect(conta.Financeiro).toBe(2);
    expect(conta.Sanidade).toBe(1);
    expect(conta['Documentos pessoais']).toBe(0);
    expect(conta.Outros).toBe(0);
  });
});

describe('legendas das gavetas', () => {
  it('cada gaveta tem ícone e explicação', () => {
    // Os dois `switch` são exaustivos; isto apanha uma gaveta nova que fique
    // sem nada escrito.
    for (const c of CATEGORIAS_DOCUMENTO) {
      expect(iconeCategoria(c).length).toBeGreaterThan(2);
      expect(explicacaoCategoria(c).length).toBeGreaterThan(10);
    }
  });
});
