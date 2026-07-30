/**
 * Testes do prazo de acesso.
 *
 * Porquê estes: é a regra que decide se alguém vê uma exploração, e falha nos
 * dois sentidos com o mesmo silêncio. Um `undefined` tratado como expirado
 * fecha a app a toda a gente (donos e trabalhadores não têm prazo nenhum). Um
 * prazo já passado tratado como vivo deixa o veterinário dentro da exploração
 * depois de a visita acabar — que é exatamente o que isto veio resolver.
 *
 * O servidor é quem manda de verdade (`supabase/schema_acesso_temporario.sql`);
 * o que se testa aqui é o mesmo relógio do lado da app, que decide o que se
 * mostra e o que se diz.
 */

import { describe, expect, it } from '@jest/globals';

import {
  acessoQuaseAFim,
  acessoTerminou,
  combinarDataHora,
  DURACOES_ACESSO,
  faltaParaExpirar,
  mascaraHora,
  minutosDaHora,
  problemaComFim,
  rotuloDuracao,
  rotuloPrazo,
} from '../acessoTemporario';

const AGORA = new Date('2026-07-27T18:00:00.000Z');
const emHoras = (h: number) => new Date(AGORA.getTime() + h * 3600_000).toISOString();

describe('acessoTerminou', () => {
  it('sem prazo NUNCA termina', () => {
    // O caso do dono e do trabalhador. Errar aqui trancava a app a quase toda
    // a gente de uma vez.
    expect(acessoTerminou(undefined, AGORA)).toBe(false);
  });

  it('termina quando a hora passa', () => {
    expect(acessoTerminou(emHoras(-1), AGORA)).toBe(true);
    expect(acessoTerminou(emHoras(1), AGORA)).toBe(false);
  });

  it('o instante exato já conta como terminado', () => {
    expect(acessoTerminou(AGORA.toISOString(), AGORA)).toBe(true);
  });

  it('uma data ilegível não tranca ninguém', () => {
    // Perante dados estranhos, o lado seguro aqui é deixar ver: o servidor
    // recusa na mesma o que tiver de recusar, e ninguém fica à porta por causa
    // de um texto mal escrito na cache.
    expect(acessoTerminou('nem-uma-data', AGORA)).toBe(false);
  });
});

describe('acessoQuaseAFim', () => {
  it('avisa dentro das últimas 24 horas', () => {
    expect(acessoQuaseAFim(emHoras(3), AGORA)).toBe(true);
    expect(acessoQuaseAFim(emHoras(30), AGORA)).toBe(false);
  });

  it('não avisa sobre o que já acabou (para isso há outra frase)', () => {
    expect(acessoQuaseAFim(emHoras(-1), AGORA)).toBe(false);
  });

  it('não avisa sobre quem não tem prazo', () => {
    expect(acessoQuaseAFim(undefined, AGORA)).toBe(false);
  });
});

describe('faltaParaExpirar', () => {
  it('conta em minutos na última hora', () => {
    expect(faltaParaExpirar(emHoras(0.5), AGORA)).toBe('faltam 30 minutos');
  });

  it('conta em horas até dois dias', () => {
    expect(faltaParaExpirar(emHoras(3), AGORA)).toBe('faltam 3 horas');
    expect(faltaParaExpirar(emHoras(1), AGORA)).toBe('falta 1 hora');
  });

  it('conta em dias a partir daí', () => {
    expect(faltaParaExpirar(emHoras(72), AGORA)).toBe('faltam 3 dias');
  });

  it('não diz nada sem prazo ou já terminado', () => {
    expect(faltaParaExpirar(undefined, AGORA)).toBeNull();
    expect(faltaParaExpirar(emHoras(-1), AGORA)).toBeNull();
  });
});

describe('rotuloPrazo', () => {
  const formatar = (iso: string) => `[${iso.slice(0, 10)}]`;

  it('sem prazo di-lo por palavras', () => {
    expect(rotuloPrazo(undefined, formatar, AGORA)).toBe('Sem prazo');
  });

  it('terminado diz quando terminou', () => {
    expect(rotuloPrazo(emHoras(-2), formatar, AGORA)).toBe('Acesso terminado a [2026-07-27]');
  });

  it('a correr diz até quando e quanto falta', () => {
    expect(rotuloPrazo(emHoras(3), formatar, AGORA)).toBe(
      'Acesso até [2026-07-27] (faltam 3 horas)',
    );
  });
});

describe('rotuloDuracao', () => {
  it('usa o nome das durações oferecidas', () => {
    for (const d of DURACOES_ACESSO) expect(rotuloDuracao(d.horas)).toBe(d.label);
  });

  it('sabe descrever uma duração que não está na lista', () => {
    // O prazo pode vir do servidor com um valor posto à mão numa correção.
    expect(rotuloDuracao(2)).toBe('2 horas');
    expect(rotuloDuracao(48)).toBe('2 dias');
  });
});

/* ==================================================================
 * Hora marcada — "até quinta às 18h"
 * ==================================================================
 * Estas quatro funções são o que separa "o dono escreveu a hora certa" de "o
 * veterinário ficou com acesso até uma hora que ninguém escolheu". Erram em
 * silêncio: uma hora mal lida não rebenta nada, só marca outro prazo.
 */

describe('mascaraHora', () => {
  it('põe os dois pontos à medida que se escreve', () => {
    expect(mascaraHora('1')).toBe('1');
    expect(mascaraHora('18')).toBe('18');
    expect(mascaraHora('183')).toBe('18:3');
    expect(mascaraHora('1830')).toBe('18:30');
  });

  it('endireita o que vem colado e corta o que sobra', () => {
    expect(mascaraHora('18h30')).toBe('18:30');
    expect(mascaraHora('183055')).toBe('18:30');
  });

  it('nunca deixa os dois pontos no fim', () => {
    // Senão a tecla de apagar parece avariada: tira a pontuação e a máscara
    // volta a pô-la, e o dígito nunca desaparece.
    expect(mascaraHora('18:')).toBe('18');
  });
});

describe('minutosDaHora', () => {
  it('lê uma hora escrita', () => {
    expect(minutosDaHora('00:00')).toBe(0);
    expect(minutosDaHora('18:30')).toBe(18 * 60 + 30);
    expect(minutosDaHora('9:05')).toBe(9 * 60 + 5);
  });

  it('recusa o que não é hora', () => {
    expect(minutosDaHora('')).toBeNull();
    expect(minutosDaHora('18')).toBeNull();
    expect(minutosDaHora('24:00')).toBeNull();
    expect(minutosDaHora('18:60')).toBeNull();
  });
});

describe('combinarDataHora', () => {
  it('junta o dia à hora, em hora local', () => {
    // O `parseDataPt` devolve a data ao meio-dia local; a hora escolhida tem de
    // a substituir, não somar-se-lhe.
    const dia = new Date(2026, 6, 30, 12, 0, 0).toISOString();
    const fim = combinarDataHora(dia, '18:30');
    expect(fim).not.toBeNull();
    const d = new Date(fim as string);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(30);
  });

  it('sem data ou sem hora válida não inventa nada', () => {
    expect(combinarDataHora(null, '18:00')).toBeNull();
    expect(combinarDataHora(new Date().toISOString(), 'logo à noite')).toBeNull();
  });
});

describe('problemaComFim', () => {
  const daquiADias = (n: number) => {
    const d = new Date(AGORA);
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };

  it('aceita um momento à frente', () => {
    expect(problemaComFim(daquiADias(2), '18:00', AGORA)).toBeNull();
  });

  it('aponta o campo certo em cada engano', () => {
    // Duas frases e não uma: "a data não se percebe" e "a hora já passou"
    // pedem correções em campos diferentes.
    expect(problemaComFim(null, '18:00', AGORA)).toMatch(/dia/i);
    expect(problemaComFim(daquiADias(2), 'xx', AGORA)).toMatch(/hora/i);
  });

  it('recusa um momento que já passou', () => {
    // Sem isto, o código nascia morto e só se descobria quando o veterinário o
    // tentasse usar, do outro lado do telefone.
    expect(problemaComFim(daquiADias(-1), '18:00', AGORA)).toMatch(/já passou/i);
  });
});
