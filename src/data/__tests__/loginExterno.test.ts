/**
 * As outras portas de entrada: quais é que se mostram, e o que se aceita como
 * número de telemóvel.
 *
 * Porquê testar isto e não o resto: o que toca no Google e na Apple é um SDK
 * nativo que não existe em Jest nem na web, e simulá-lo só provava o simulador.
 * O que se pode provar — e o que parte a app se estiver errado — é a DECISÃO de
 * mostrar um botão sem credenciais (que dá um erro que ninguém percebe, no ecrã
 * onde ainda não há conta nenhuma para onde voltar) e a leitura do número, que é
 * escrito à mão por quem tem o telemóvel na outra.
 */

import { describe, expect, it } from '@jest/globals';

import {
  codigoSmsValido,
  metodosConfigurados,
  normalizarTelemovel,
  type ConfigLogin,
} from '../loginExterno';

const base: ConfigLogin = {
  googleWebClientId: undefined,
  googleIosClientId: undefined,
  telemovelLigado: false,
  plataforma: 'android',
};

describe('metodosConfigurados', () => {
  it('sem credenciais nenhumas, não mostra nada', () => {
    // É o estado da app HOJE, antes de as credenciais existirem, e tem de ser
    // indistinguível de nunca ter havido nada disto.
    expect(metodosConfigurados(base)).toEqual([]);
  });

  it('o Google precisa do Client ID web', () => {
    expect(metodosConfigurados({ ...base, googleWebClientId: 'w' })).toEqual(['google']);
  });

  it('no iPhone o Google precisa TAMBÉM do Client ID de iOS', () => {
    // Sem ele o SDK arranca e falha só na hora de pedir o token, com um erro
    // que não diz nada a quem o lê. Mais vale não haver botão.
    expect(metodosConfigurados({ ...base, plataforma: 'ios', googleWebClientId: 'w' })).toEqual([
      'apple',
    ]);
    expect(
      metodosConfigurados({
        ...base,
        plataforma: 'ios',
        googleWebClientId: 'w',
        googleIosClientId: 'i',
      }),
    ).toEqual(['google', 'apple']);
  });

  it('a Apple só no iPhone', () => {
    // Na web e no Android ela existe pelo caminho do navegador, e é uma porta
    // que não se abre a ninguém: quem tem conta Apple tem um iPhone à mão.
    expect(metodosConfigurados({ ...base, plataforma: 'ios' })).toContain('apple');
    expect(metodosConfigurados({ ...base, plataforma: 'android' })).not.toContain('apple');
    expect(metodosConfigurados({ ...base, plataforma: 'web' })).not.toContain('apple');
  });

  it('o telemóvel segue o interruptor, e mais nada', () => {
    // As credenciais da Twilio vivem do lado do Supabase e a app não as vê. O
    // interruptor existe para se poder desligar isto num minuto se as contas
    // começarem a subir, sem esperar por um build.
    expect(metodosConfigurados({ ...base, telemovelLigado: true })).toEqual(['telemovel']);
  });
});

describe('normalizarTelemovel', () => {
  it('nove dígitos portugueses ganham o indicativo', () => {
    // Ninguém em Portugal escreve o +351 quando lhe pedem o telemóvel.
    expect(normalizarTelemovel('912345678')).toBe('+351912345678');
  });

  it('espaços, traços e parênteses não contam', () => {
    // É como o número está escrito num papel, e é como se copia de uma agenda.
    expect(normalizarTelemovel('912 345 678')).toBe('+351912345678');
    expect(normalizarTelemovel('912-345-678')).toBe('+351912345678');
    expect(normalizarTelemovel(' (912) 345.678 ')).toBe('+351912345678');
  });

  it('aceita o número já internacional, nas duas escritas', () => {
    expect(normalizarTelemovel('+351912345678')).toBe('+351912345678');
    // "00351" é como está escrito em metade das agendas antigas.
    expect(normalizarTelemovel('00351912345678')).toBe('+351912345678');
    expect(normalizarTelemovel('351912345678')).toBe('+351912345678');
  });

  it('deixa passar números de outros países', () => {
    // Um veterinário espanhol convidado para uma exploração no Alentejo não
    // tem um número português, e não é por isso que fica de fora.
    expect(normalizarTelemovel('+34600123456')).toBe('+34600123456');
  });

  it('recusa o que não dá para aproveitar', () => {
    // Devolver `null` é o que faz a app avisar em vez de mandar lixo ao
    // servidor para ele recusar com uma mensagem sobre formatos.
    expect(normalizarTelemovel('')).toBeNull();
    expect(normalizarTelemovel('12345')).toBeNull();
    expect(normalizarTelemovel('abcdefghi')).toBeNull();
    expect(normalizarTelemovel('91234567')).toBeNull(); // oito dígitos
    expect(normalizarTelemovel('+351 91a 345 678')).toBeNull();
  });
});

describe('codigoSmsValido', () => {
  it('seis dígitos, e mais nada', () => {
    expect(codigoSmsValido('123456')).toBe(true);
    expect(codigoSmsValido('123 456')).toBe(true); // colado do SMS com espaço
    expect(codigoSmsValido('12345')).toBe(false);
    expect(codigoSmsValido('1234567')).toBe(false);
    expect(codigoSmsValido('12345a')).toBe(false);
  });
});
