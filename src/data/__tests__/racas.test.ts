import { describe, expect, it } from '@jest/globals';

import { coresDe, normalizar, opcoesComUsadas, racasDe } from '../racas';
import { especies } from '../constants';

describe('normalizar', () => {
  // É esta função que decide se duas grafias são a MESMA raça. Se falhar em
  // silêncio, o filtro por raça passa a ter duas entradas para a mesma coisa e
  // metade dos animais some de cada uma — que é exatamente o problema que as
  // listas vieram resolver.
  it('ignora maiúsculas, espaços e acentos', () => {
    expect(normalizar('  MERTOLENGA ')).toBe('mertolenga');
    expect(normalizar('Barrosã')).toBe(normalizar('barrosa'));
    expect(normalizar('Bísaro')).toBe(normalizar('BISARO'));
    expect(normalizar('Alentejana')).toBe(normalizar('alentejaná'));
  });

  it('não colapsa raças que são mesmo diferentes', () => {
    expect(normalizar('Mirandesa')).not.toBe(normalizar('Marinhoa'));
    expect(normalizar('Merino Branco')).not.toBe(normalizar('Merino Preto'));
  });
});

describe('racasDe / coresDe', () => {
  it('todas as espécies têm sugestões', () => {
    for (const e of especies) {
      expect(racasDe(e).length).toBeGreaterThan(3);
      expect(coresDe(e).length).toBeGreaterThan(3);
    }
  });

  it('cada espécie leva as suas raças, não as das outras', () => {
    expect(racasDe('Bovino')).toContain('Mertolenga');
    expect(racasDe('Bovino')).not.toContain('Bísaro');
    expect(racasDe('Suíno')).toContain('Bísaro');
    expect(racasDe('Ovino')).toContain('Serra da Estrela');
    expect(racasDe('Equídeo')).toContain('Lusitano');
  });

  it('o gado e os equídeos não partilham vocabulário de pelagem', () => {
    // "Alazã" e "Tordilha" são de cavalo; oferecê-las para uma vaca faria a
    // lista parecer escrita por quem não percebe do assunto.
    expect(coresDe('Equídeo')).toContain('Alazã');
    expect(coresDe('Bovino')).not.toContain('Alazã');
    expect(coresDe('Bovino')).toContain('Malhada');
  });

  it('"Cruzado" está sempre disponível', () => {
    for (const e of especies) expect(racasDe(e)).toContain('Cruzado');
  });

  it('não há repetidos nem entradas vazias', () => {
    for (const e of especies) {
      const r = racasDe(e);
      expect(new Set(r.map(normalizar)).size).toBe(r.length);
      expect(r.every((x) => x.trim().length > 0)).toBe(true);
    }
  });
});

describe('opcoesComUsadas', () => {
  it('acrescenta o que já existe no efetivo às sugestões', () => {
    // É isto que faz a lista aprender: uma raça escrita à mão num animal passa
    // a estar disponível para o animal seguinte, sem ninguém atualizar código.
    const r = opcoesComUsadas(['Mertolenga', 'Minhota'], ['Raça do Zé']);
    expect(r).toContain('Raça do Zé');
    expect(r).toContain('Mertolenga');
  });

  it('não duplica o que só difere em maiúsculas ou acentos', () => {
    const r = opcoesComUsadas(['Mertolenga'], ['mertolenga', 'MERTOLENGA', 'Mertolenga']);
    expect(r.filter((x) => normalizar(x) === 'mertolenga')).toHaveLength(1);
  });

  it('a sugestão ganha à grafia usada, para a lista ficar bem escrita', () => {
    // Quem escreveu "barrosa" à pressa vê "Barrosã" na lista — a forma certa
    // é a da lista curada, que vem primeiro.
    expect(opcoesComUsadas(['Barrosã'], ['barrosa'])).toEqual(['Barrosã']);
  });

  it('ignora vazios e indefinidos vindos dos animais', () => {
    expect(opcoesComUsadas(['Preta'], [undefined, '', '   '])).toEqual(['Preta']);
  });

  it('vem por ordem alfabética portuguesa', () => {
    expect(opcoesComUsadas(['Zebu', 'Ávila', 'Barrosã'], [])).toEqual([
      'Ávila',
      'Barrosã',
      'Zebu',
    ]);
  });
});
