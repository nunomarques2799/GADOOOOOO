/**
 * Os atalhos da barra de baixo: o que a barra mostra a partir do que o
 * criador escolheu. A regra que importa é a de nunca deixar um buraco na
 * barra, mesmo com uma escolha guardada que já não serve.
 */
import { describe, expect, it } from '@jest/globals';

import { ATALHOS_OMISSAO, atalhosDaBarra } from '../barraAtalhos';

const TODOS = [
  'index', 'exploracoes', 'terrenos', 'animais', 'alertas', 'chat',
  'reproducao', 'financas', 'definicoes', 'perfil',
];

describe('atalhosDaBarra', () => {
  it('sem escolha, usa a omissão: Animais e Alertas', () => {
    expect(atalhosDaBarra(null, TODOS, ATALHOS_OMISSAO)).toEqual(['animais', 'alertas']);
  });

  it('respeita a escolha, pela ordem (esquerda, direita)', () => {
    expect(atalhosDaBarra(['chat', 'terrenos'], TODOS, ATALHOS_OMISSAO)).toEqual(['chat', 'terrenos']);
  });

  it('o Início nunca é um atalho, porque já está sempre na barra', () => {
    expect(atalhosDaBarra(['index', 'chat'], TODOS, ATALHOS_OMISSAO)).toEqual(['animais', 'chat']);
  });

  it('uma escolha que deixou de estar disponível passa à omissão desse lugar', () => {
    // As Finanças desligadas: o lugar da esquerda volta a ser os Animais.
    const semFinancas = TODOS.filter((n) => n !== 'financas');
    expect(atalhosDaBarra(['financas', 'chat'], semFinancas, ATALHOS_OMISSAO)).toEqual([
      'animais',
      'chat',
    ]);
  });

  it('nunca mostra o mesmo destino nos dois lugares', () => {
    expect(atalhosDaBarra(['chat', 'chat'], TODOS, ATALHOS_OMISSAO)).toEqual(['chat', 'alertas']);
    // Nem quando a escolha de um lado é a omissão do outro.
    expect(atalhosDaBarra(['alertas', null], TODOS, ATALHOS_OMISSAO)).toEqual(['alertas', 'animais']);
  });

  it('sem omissão disponível, fica com o primeiro destino livre em vez de um buraco', () => {
    // Um convidado sem Animais nem Alertas à vista (caso extremo): a barra
    // continua com dois atalhos que ele consegue abrir.
    expect(atalhosDaBarra(null, ['index', 'terrenos', 'perfil'], ATALHOS_OMISSAO)).toEqual([
      'terrenos',
      'perfil',
    ]);
  });

  it('um valor corrompido no armazenamento não parte nada', () => {
    expect(
      atalhosDaBarra([undefined, 'nao-existe'] as unknown as string[], TODOS, ATALHOS_OMISSAO),
    ).toEqual(['animais', 'alertas']);
  });
});
