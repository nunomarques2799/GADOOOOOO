import { describe, expect, it } from '@jest/globals';

import {
  deveMostrar,
  essenciais,
  opcionais,
  passosTutorial,
  progresso,
  type EstadoTutorial,
} from '../tutorial';

const vazio: EstadoTutorial = {
  temExploracoes: false,
  temTerrenos: false,
  temAnimais: false,
  avisosLigados: false,
  suportaAvisos: true,
  financasLigadas: false,
  casaLigada: false,
  podeConfigurar: true,
};

/** Tudo o que é essencial cumprido — o estado em que o guia se cala. */
const feito: EstadoTutorial = {
  ...vazio,
  temExploracoes: true,
  temTerrenos: true,
  temAnimais: true,
  avisosLigados: true,
};

describe('passosTutorial', () => {
  it('reflete os dados reais em cada passo', () => {
    const passos = passosTutorial({ ...vazio, temExploracoes: true, casaLigada: true });
    expect(passos.map((p) => [p.chave, p.feito])).toEqual([
      ['exploracao', true],
      ['terreno', false],
      ['animal', false],
      ['avisos', false],
      ['financas', false],
      ['casa', true],
    ]);
  });

  it('põe os terrenos antes dos animais', () => {
    // É no formulário do animal que se escolhe o terreno: ao contrário, esse
    // campo aparece vazio e sem nada por onde escolher.
    const chaves = essenciais(passosTutorial(vazio)).map((p) => p.chave);
    expect(chaves.indexOf('terreno')).toBeLessThan(chaves.indexOf('animal'));
  });

  it('esconde o passo dos avisos onde a plataforma não os suporta (web)', () => {
    const passos = passosTutorial({ ...vazio, suportaAvisos: false });
    expect(passos.map((p) => p.chave)).not.toContain('avisos');
  });

  it('não oferece os interruptores da conta a quem não é dono', () => {
    // Um trabalhador convidado não liga finanças nem registo por casa: o
    // servidor recusa-lhe, e o passo era um convite a bater numa porta fechada.
    const passos = passosTutorial({ ...vazio, podeConfigurar: false });
    expect(opcionais(passos)).toEqual([]);
  });

  it('explica cada passo por extenso, não só numa linha', () => {
    for (const p of passosTutorial(vazio)) {
      expect(p.detalhe.length).toBeGreaterThan(p.descricao.length);
      expect(p.acao).not.toEqual('');
    }
  });
});

describe('progresso', () => {
  it('conta os passos feitos', () => {
    const p = progresso(passosTutorial({ ...vazio, temExploracoes: true }));
    expect(p).toEqual({ feitos: 1, total: 4, completo: false });
  });

  it('fica completo quando está tudo feito', () => {
    expect(progresso(passosTutorial(feito)).completo).toBe(true);
  });

  it('na web basta os três passos para completar', () => {
    const p = progresso(passosTutorial({ ...feito, avisosLigados: false, suportaAvisos: false }));
    expect(p).toEqual({ feitos: 3, total: 3, completo: true });
  });

  it('os opcionais não entram na conta', () => {
    // Sem isto, quem não quer contabilidade nem numeração por casa ficava com um
    // "4 de 6" eterno em cima do Início — um guia que nunca se pode acabar.
    const semExtras = progresso(passosTutorial({ ...vazio, podeConfigurar: false }));
    const comExtras = progresso(passosTutorial(vazio));
    expect(comExtras).toEqual(semExtras);
    expect(comExtras.total).toBe(4);
  });
});

describe('deveMostrar', () => {
  it('mostra enquanto há passos por fazer e não foi escondido', () => {
    expect(deveMostrar(passosTutorial(vazio), false)).toBe(true);
  });

  it('não mostra depois de escondido, mesmo com passos por fazer', () => {
    expect(deveMostrar(passosTutorial(vazio), true)).toBe(false);
  });

  it('deixa de aparecer sozinho quando o caminho essencial está andado', () => {
    expect(deveMostrar(passosTutorial(feito), false)).toBe(false);
  });

  it('um opcional por ligar não prende o guia no ecrã', () => {
    // `feito` tem finanças e casa desligadas de propósito.
    expect(opcionais(passosTutorial(feito)).every((p) => !p.feito)).toBe(true);
    expect(deveMostrar(passosTutorial(feito), false)).toBe(false);
  });
});
