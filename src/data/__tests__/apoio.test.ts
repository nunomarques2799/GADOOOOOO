/**
 * Testes da validação da mensagem de apoio.
 *
 * Porquê estes: esta função decide o que chega ao email do apoio. Larga de
 * mais, deixa passar mensagens de três letras que ninguém consegue responder;
 * apertada de mais, recusa uma pergunta legítima com uma frase que o criador
 * não percebe e ele desiste de escrever.
 *
 * As mesmas regras existem no servidor (`supabase/schema_apoio.sql`) e são
 * aquelas que valem — o cliente não é de confiança. Estas existem para dizer o
 * que corrigir ANTES de esperar por uma ida à rede.
 */

import { describe, expect, it, jest } from '@jest/globals';

// O módulo importa o cliente do Supabase para enviar, e esse puxa o
// AsyncStorage nativo, que num teste não existe. O envio não é o que aqui se
// testa — a validação que corre antes dele é.
jest.mock('../supabase', () => ({ supabase: null, supabaseConfigurado: false }));

import { MAX_ASSUNTO, MAX_TEXTO, problemaComMensagem } from '../apoio';

const TEXTO_BOM = 'A app fechou-se sozinha ao abrir os animais, três vezes esta manhã.';

describe('problemaComMensagem', () => {
  it('aceita uma mensagem escrita como deve ser', () => {
    expect(problemaComMensagem('A app fecha-se', TEXTO_BOM)).toBeNull();
  });

  it('pede o assunto quando falta', () => {
    expect(problemaComMensagem('', TEXTO_BOM)).toMatch(/assunto/i);
    expect(problemaComMensagem('   ', TEXTO_BOM)).toMatch(/assunto/i);
  });

  it('pede mais texto a um "não funciona"', () => {
    expect(problemaComMensagem('Erro', 'nao da')).toMatch(/mais/i);
  });

  it('conta o texto sem os espaços das pontas', () => {
    // Senão bastava carregar no espaço dez vezes para passar a validação.
    expect(problemaComMensagem('Erro', '   olá     ')).not.toBeNull();
  });

  it('trava o que é comprido de mais', () => {
    // Um campo de texto ligado a uma API de email paga sem limite é um convite
    // a mandar megabytes por engano.
    expect(problemaComMensagem('a'.repeat(MAX_ASSUNTO + 1), TEXTO_BOM)).toMatch(/comprido/i);
    expect(problemaComMensagem('Erro', 'a'.repeat(MAX_TEXTO + 1))).toMatch(/comprida/i);
  });

  it('aponta um campo de cada vez, começando pelo assunto', () => {
    // Uma frase por engano: "falta o assunto" e "escreva mais" pedem correções
    // em campos diferentes, e um "preenchimento inválido" deixava o criador a
    // adivinhar em qual deles mexer.
    expect(problemaComMensagem('', 'x')).toMatch(/assunto/i);
  });
});
