import { describe, expect, it } from '@jest/globals';

import { deveMostrar, passosTutorial, progresso, type EstadoTutorial } from '../tutorial';

const vazio: EstadoTutorial = {
  temExploracoes: false,
  temAnimais: false,
  avisosLigados: false,
  suportaAvisos: true,
};

describe('passosTutorial', () => {
  it('reflete os dados reais em cada passo', () => {
    const passos = passosTutorial({
      temExploracoes: true,
      temAnimais: false,
      avisosLigados: false,
      suportaAvisos: true,
    });
    expect(passos.map((p) => [p.chave, p.feito])).toEqual([
      ['exploracao', true],
      ['animal', false],
      ['avisos', false],
    ]);
  });

  it('esconde o passo dos avisos onde a plataforma não os suporta (web)', () => {
    const passos = passosTutorial({ ...vazio, suportaAvisos: false });
    expect(passos.map((p) => p.chave)).toEqual(['exploracao', 'animal']);
  });
});

describe('progresso', () => {
  it('conta os passos feitos', () => {
    const p = progresso(passosTutorial({ ...vazio, temExploracoes: true }));
    expect(p).toEqual({ feitos: 1, total: 3, completo: false });
  });

  it('fica completo quando está tudo feito', () => {
    const p = progresso(
      passosTutorial({ temExploracoes: true, temAnimais: true, avisosLigados: true, suportaAvisos: true }),
    );
    expect(p.completo).toBe(true);
  });

  it('na web basta os dois passos para completar', () => {
    const p = progresso(
      passosTutorial({ temExploracoes: true, temAnimais: true, avisosLigados: false, suportaAvisos: false }),
    );
    expect(p).toEqual({ feitos: 2, total: 2, completo: true });
  });
});

describe('deveMostrar', () => {
  it('mostra enquanto há passos por fazer e não foi escondido', () => {
    expect(deveMostrar(passosTutorial(vazio), false)).toBe(true);
  });

  it('não mostra depois de escondido, mesmo com passos por fazer', () => {
    expect(deveMostrar(passosTutorial(vazio), true)).toBe(false);
  });

  it('deixa de aparecer sozinho quando está tudo feito', () => {
    const completo = passosTutorial({
      temExploracoes: true,
      temAnimais: true,
      avisosLigados: true,
      suportaAvisos: true,
    });
    expect(deveMostrar(completo, false)).toBe(false);
  });
});
