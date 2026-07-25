/**
 * O campo de localização com sugestões, desenhado a sério.
 *
 * A procura em si está coberta em `data/__tests__/localidades.test.ts`. O que
 * falta provar é o comportamento do campo: que não pergunta nada a cada tecla,
 * que escolher da lista escreve a localidade toda, e — o mais importante — que
 * ficar sem rede não estraga a escrita à mão.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockProcurar = jest.fn(async (_texto: string) => [
  {
    id: '1',
    etiqueta: 'Idanha-a-Nova, Castelo Branco',
    nome: 'Idanha-a-Nova',
    regiao: 'Castelo Branco',
    latitude: 39.92,
    longitude: -7.24,
  },
]);

jest.mock('@/data/localidades', () => ({
  MINIMO_LETRAS: 3,
  procurarLocalidades: (texto: string) => mockProcurar(texto),
}));

import { CampoLocalidade } from '../CampoLocalidade';

/** Todo o texto que o campo mostra, em bruto. */
function textos(r: ReactTestRenderer): string {
  const juntar = (no: unknown): string => {
    if (typeof no === 'string') return no;
    if (Array.isArray(no)) return no.map(juntar).join(' ');
    if (no && typeof no === 'object' && 'children' in no) {
      return juntar((no as { children: unknown }).children);
    }
    return '';
  };
  return juntar(r.toJSON());
}

/** Monta o campo e devolve como escrever nele e o que ele devolveu. */
function montar(inicial = '') {
  let r!: ReactTestRenderer;
  const estado = { valor: inicial };
  const desenhar = () =>
    act(() => {
      const no = (
        <CampoLocalidade
          value={estado.valor}
          onChangeText={(t) => {
            estado.valor = t;
            desenhar();
          }}
          placeholder="Ex: Idanha-a-Nova"
        />
      );
      if (r) r.update(no);
      else r = create(no);
    });
  desenhar();

  const escrever = (t: string) => {
    const input = r.root.findAll((n) => typeof n.props?.onChangeText === 'function')[0];
    act(() => (input.props.onChangeText as (v: string) => void)(t));
  };
  const tocar = (rotulo: string) => {
    const no = r.root
      .findAll((n) => typeof n.props?.onPress === 'function')
      .find((n) => n.props.accessibilityLabel === rotulo);
    if (!no) throw new Error(`Não há nada tocável com o rótulo "${rotulo}"`);
    act(() => (no.props.onPress as () => void)());
  };
  return { get r() { return r; }, estado, escrever, tocar };
}

/** Deixa passar o tempo de espera do campo e as promessas pendentes. */
async function esperarProcura() {
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
}

describe('CampoLocalidade', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockProcurar.mockClear();
  });

  it('não procura nada com menos de três letras', async () => {
    const c = montar();
    c.escrever('id');
    await esperarProcura();
    expect(mockProcurar).not.toHaveBeenCalled();
  });

  it('espera pela última tecla antes de perguntar (uma procura, não quatro)', async () => {
    const c = montar();
    c.escrever('ida');
    c.escrever('idan');
    c.escrever('idanh');
    c.escrever('idanha');
    await esperarProcura();
    expect(mockProcurar).toHaveBeenCalledTimes(1);
    expect(mockProcurar).toHaveBeenCalledWith('idanha');
  });

  it('mostra as sugestões com a terra e o distrito', async () => {
    const c = montar();
    c.escrever('idanha');
    await esperarProcura();
    expect(textos(c.r)).toContain('Idanha-a-Nova');
    expect(textos(c.r)).toContain('Castelo Branco');
  });

  it('escolher da lista escreve a localidade toda e fecha a lista', async () => {
    const c = montar();
    c.escrever('idanha');
    await esperarProcura();
    c.tocar('Idanha-a-Nova, Castelo Branco');

    expect(c.estado.valor).toBe('Idanha-a-Nova, Castelo Branco');
    // A lista fecha-se: ficar aberta por cima do que se escolheu tapava o resto
    // do formulário.
    expect(textos(c.r)).not.toContain('Castelo Branco · ');
  });

  it('não volta a procurar pelo que acabou de escolher', async () => {
    const c = montar();
    c.escrever('idanha');
    await esperarProcura();
    c.tocar('Idanha-a-Nova, Castelo Branco');
    await esperarProcura();
    expect(mockProcurar).toHaveBeenCalledTimes(1);
  });

  it('sem rede continua a dar para escrever à mão', async () => {
    mockProcurar.mockRejectedValueOnce(new Error('Network request failed'));
    const c = montar();
    c.escrever('idanha');
    await esperarProcura();
    // Nem rebenta nem mostra erro: fica só sem lista, com o que se escreveu.
    expect(c.estado.valor).toBe('idanha');
    expect(textos(c.r)).not.toContain('Network');
  });
});
