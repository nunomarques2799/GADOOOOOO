/**
 * O ecrã de denúncias do painel de superadmin.
 *
 * As contas estão cobertas em `data/__tests__/denuncias.test.ts` e quem pode
 * LER a fila prova-se no psql (`supabase/provar_denuncias.sql`). O que falta
 * provar é o ecrã, e há uma razão prática para isso importar mais aqui do que
 * noutro sítio: o painel de superadmin não abre em modo demo (sem Supabase não
 * há conta com `is_superadmin`), portanto não há como clicá-lo à mão. Este
 * ficheiro é o clique.
 *
 * O que se verifica é o que fecha a diretriz 1.2 da Apple: que a denúncia se
 * lê, que uma fotografia sem legenda não chega como linha em branco, e que as
 * duas ações (dar por tratada, suspender a conta) chegam mesmo ao servidor.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { Denuncia } from '@/data/denuncias';

/** Medidas fixas: sem elas o provider mede o ecrã e não há ecrã nenhum. */
const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ESCRITA: Denuncia = {
  id: 'd1',
  mensagemId: 'm1',
  conversaId: 'c1',
  denunciadoPor: 'u-queixoso',
  autorDenunciado: 'u-mau',
  textoCopia: 'isto nao se diz a ninguem',
  tipo: 'texto',
  contexto: [{ autor: 'u-queixoso', texto: 'bom dia', tipo: 'texto' }],
  motivo: 'linguagem ofensiva',
  criadoEm: '2026-08-23T10:00:00.000Z',
  estado: 'aberta',
};

/** O caso que fez a coluna `tipo` existir: sem legenda e sem texto nenhum. */
const FOTOGRAFIA: Denuncia = {
  id: 'd2',
  mensagemId: 'm2',
  conversaId: 'c1',
  denunciadoPor: 'u-queixoso',
  autorDenunciado: 'u-mau',
  textoCopia: '',
  tipo: 'foto',
  anexo: 'c1/m2.jpg',
  contexto: [],
  criadoEm: '2026-08-22T10:00:00.000Z',
  estado: 'aberta',
};

const JA_TRATADA: Denuncia = {
  id: 'd3',
  mensagemId: 'm3',
  conversaId: 'c1',
  denunciadoPor: 'u-queixoso',
  autorDenunciado: 'u-mau',
  textoCopia: 'engano meu',
  tipo: 'texto',
  contexto: [],
  criadoEm: '2026-08-01T10:00:00.000Z',
  estado: 'tratada',
  tratadoEm: '2026-08-02T10:00:00.000Z',
  notaSuperadmin: 'nao era nada',
};

let fila: Denuncia[] = [];

const mockListar = jest.fn(async () => fila);
const mockPessoas = jest.fn(async () => ({
  'u-mau': { nome: 'Zé Bravo', telefone: '912345678' },
  'u-queixoso': { nome: 'Ana Pastora' },
}));
const mockTratar = jest.fn(async (_id: string, _nota?: string): Promise<string | null> => null);
const mockReabrir = jest.fn(async (_id: string): Promise<string | null> => null);
const mockBloquear = jest.fn(async (_uid: string): Promise<string | null> => null);
const mockDefinirPorTratar = jest.fn((_n: number) => {});
const mockErro = jest.fn((_m: string, _d?: string) => {});

jest.mock('@/data/denunciasApi', () => ({
  listarDenuncias: () => mockListar(),
  pessoasDasDenuncias: () => mockPessoas(),
  tratarDenuncia: (id: string, nota?: string) => mockTratar(id, nota),
  reabrirDenuncia: (id: string) => mockReabrir(id),
  // O bucket é privado e nos testes não há Storage: o cartão desenha o lugar
  // da imagem e segue, que é o mesmo que faz sem rede.
  ligacaoParaFicheiroDenunciado: async () => null,
}));

jest.mock('@/data/useDenuncias', () => ({
  definirPorTratar: (n: number) => mockDefinirPorTratar(n),
}));

jest.mock('@/data/membros', () => {
  const api = { bloquearCliente: (uid: string) => mockBloquear(uid) };
  return { useMembros: () => api };
});

jest.mock('@/data/toasts', () => {
  const api = { sucesso: () => {}, erro: (m: string, d?: string) => mockErro(m, d), info: () => {} };
  return { useToasts: () => api };
});

/** O `confirmar()` de verdade abre uma caixa; aqui responde sempre que sim. */
jest.mock('@/data/avisos', () => ({
  confirmar: (_t: string, _m: string, aoConfirmar: () => void) => aoConfirmar(),
}));

jest.mock('@/hooks/useDesktop', () => ({ useDesktop: () => false }));

import DenunciasScreen from '../denuncias';

/**
 * Todo o texto que o ecrã mostra.
 *
 * Os espaços são colapsados no fim: um `Denunciada por {nome}` são DOIS filhos
 * na árvore, e juntá-los com um espaço dá "Denunciada por  Ana Pastora". A
 * frase que o olho lê é a mesma, e é sobre essa que se quer escrever o teste.
 */
function textos(r: ReactTestRenderer): string {
  const juntar = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(juntar).join(' ');
    if (no && typeof no === 'object' && 'children' in no) {
      return juntar((no as { children: unknown }).children);
    }
    return '';
  };
  return juntar(r.toJSON()).replace(/\s+/g, ' ');
}

function tocaveis(r: ReactTestRenderer, rotulo: string) {
  return r.root
    .findAll((n) => typeof n.props?.onPress === 'function')
    .filter((n) => n.props.accessibilityLabel === rotulo || n.props.label === rotulo);
}

function tocar(r: ReactTestRenderer, rotulo: string) {
  const nos = tocaveis(r, rotulo);
  if (nos.length === 0) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  act(() => (nos[0].props.onPress as () => void)());
}

/**
 * Toca e espera pelo que a ação for buscar. Um `act` por toque, e não um `act`
 * dentro de outro: o aninhado dá "overlapping act() calls".
 */
async function tocarEsperar(r: ReactTestRenderer, rotulo: string) {
  const nos = tocaveis(r, rotulo);
  if (nos.length === 0) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
  await act(async () => {
    await (nos[0].props.onPress as () => unknown)();
  });
}

async function abrir() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <DenunciasScreen />
      </SafeAreaProvider>,
    );
  });
  return r;
}

describe('ecrã Denúncias', () => {
  beforeEach(() => {
    fila = [ESCRITA, FOTOGRAFIA, JA_TRATADA];
    mockListar.mockClear();
    mockTratar.mockClear();
    mockReabrir.mockClear();
    mockBloquear.mockClear();
    mockDefinirPorTratar.mockClear();
    mockErro.mockClear();
  });

  it('mostra o que foi denunciado, por quem, e o motivo', async () => {
    const t = textos(await abrir());
    expect(t).toContain('isto nao se diz a ninguem');
    expect(t).toContain('Zé Bravo');
    expect(t).toContain('Denunciada por Ana Pastora');
    expect(t).toContain('linguagem ofensiva');
  });

  /**
   * Sem isto, denunciar uma fotografia entregava uma linha em branco e não
   * havia o que julgar. Foi o que fez a denúncia passar a copiar o `tipo` e o
   * `anexo` (ver o cabeçalho do `schema_chat_anexos.sql`).
   */
  it('uma fotografia sem legenda não chega como cartão vazio', async () => {
    const t = textos(await abrir());
    expect(t).toContain('Fotografia');
    expect(t).toContain('Sem legenda.');
  });

  /** O ficheiro só sobrevive enquanto a denúncia estiver aberta, e diz-se. */
  it('avisa que o ficheiro desaparece depois de a denúncia ser fechada', async () => {
    expect(textos(await abrir())).toContain('só se vê enquanto a denúncia estiver por tratar');
  });

  it('abre nas que estão por tratar, e as tratadas ficam noutro separador', async () => {
    const r = await abrir();
    expect(textos(r)).not.toContain('engano meu');
    tocar(r, 'Tratadas, 1');
    const t = textos(r);
    expect(t).toContain('engano meu');
    expect(t).toContain('nao era nada');
    expect(t).not.toContain('isto nao se diz a ninguem');
  });

  it('o contexto está escondido até alguém o pedir', async () => {
    const r = await abrir();
    expect(textos(r)).not.toContain('bom dia');
    tocar(r, 'Ver o que veio antes (1)');
    expect(textos(r)).toContain('bom dia');
  });

  it('o ponto vermelho da barra sai da mesma leitura que a lista', async () => {
    await abrir();
    expect(mockDefinirPorTratar).toHaveBeenCalledWith(2);
  });

  it('dar por tratada escreve a nota e recarrega a fila', async () => {
    const r = await abrir();
    tocar(r, 'Marcar como tratada');
    const campo = r.root.find((n) => typeof n.props?.onChangeText === 'function');
    act(() => (campo.props.onChangeText as (t: string) => void)('avisado por telefone'));

    fila = [{ ...ESCRITA, estado: 'tratada' }, FOTOGRAFIA, JA_TRATADA];
    await tocarEsperar(r, 'Dar por tratada');

    expect(mockTratar).toHaveBeenCalledWith('d1', 'avisado por telefone');
    // Duas leituras: a de abrir e a de depois de gravar. Sem a segunda, o
    // cartão ficava no ecrã a dizer "por tratar" depois de já não estar.
    expect(mockListar).toHaveBeenCalledTimes(2);
    expect(mockDefinirPorTratar).toHaveBeenLastCalledWith(1);
  });

  it('e quando o servidor recusa, diz porquê em vez de fingir que gravou', async () => {
    mockTratar.mockImplementationOnce(async () => 'sem permissão');
    const r = await abrir();
    tocar(r, 'Marcar como tratada');
    await tocarEsperar(r, 'Dar por tratada');
    expect(mockErro).toHaveBeenCalledWith('Não foi possível fechar a denúncia.', 'sem permissão');
    expect(mockListar).toHaveBeenCalledTimes(1);
  });

  /**
   * A parte da diretriz 1.2 que não é ler: ejetar. Suspender passa o perfil a
   * `pendente` e o servidor recusa-lhe qualquer escrita a partir daí.
   */
  it('suspender a conta chega mesmo ao servidor, com o id de quem escreveu', async () => {
    const r = await abrir();
    await tocarEsperar(r, 'Suspender a conta');
    expect(mockBloquear).toHaveBeenCalledWith('u-mau');
  });

  it('uma denúncia tratada volta a abrir', async () => {
    const r = await abrir();
    tocar(r, 'Tratadas, 1');
    fila = [ESCRITA, FOTOGRAFIA, { ...JA_TRATADA, estado: 'aberta' }];
    await tocarEsperar(r, 'Reabrir');
    expect(mockReabrir).toHaveBeenCalledWith('d3');
    expect(mockDefinirPorTratar).toHaveBeenLastCalledWith(3);
  });

  it('sem denúncias nenhumas, diz que é o estado normal', async () => {
    fila = [];
    const t = textos(await abrir());
    expect(t).toContain('Sem denúncias');
    expect(t).toContain('É o estado normal.');
  });

  /**
   * A conta apagada deixa o `autor_denunciado` a nulo (`on delete set null`).
   * O cartão tem de abrir à mesma, e não pode oferecer suspender ninguém.
   */
  it('uma denúncia de conta já apagada abre, e não oferece suspender', async () => {
    fila = [{ ...ESCRITA, autorDenunciado: undefined, denunciadoPor: undefined }];
    const r = await abrir();
    expect(textos(r)).toContain('Conta apagada');
    expect(tocaveis(r, 'Suspender a conta')).toHaveLength(0);
  });

  it('quando a leitura falha, o ecrã diz a razão do servidor', async () => {
    mockListar.mockImplementationOnce(async () => {
      throw new Error('sem permissão');
    });
    expect(textos(await abrir())).toContain('sem permissão');
  });
});
