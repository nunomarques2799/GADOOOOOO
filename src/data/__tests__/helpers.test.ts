import { describe, expect, it, jest } from '@jest/globals';

import {
  diaIso,
  diasAte,
  idadeDias,
  isoDaysAgo,
  isoInDays,
  isoMaisDias,
  mascaraDataPt,
  parseDataPt,
} from '../helpers';

describe('parseDataPt', () => {
  it('aceita dd/mm/aaaa e dd-mm-aaaa no passado', () => {
    expect(parseDataPt('15/03/2021')).not.toBeNull();
    expect(parseDataPt('15-03-2021')).not.toBeNull();
  });

  it('rejeita dias/meses fora do intervalo', () => {
    expect(parseDataPt('32/01/2021')).toBeNull();
    expect(parseDataPt('00/01/2021')).toBeNull();
    expect(parseDataPt('15/13/2021')).toBeNull();
  });

  it('rejeita datas inexistentes (ex: 31 de fevereiro)', () => {
    expect(parseDataPt('31/02/2021')).toBeNull();
  });

  it('rejeita datas no futuro e texto inválido', () => {
    expect(parseDataPt('01/01/2999')).toBeNull();
    expect(parseDataPt('amanhã')).toBeNull();
    expect(parseDataPt('')).toBeNull();
  });

  it('aceita o futuro quando explicitamente pedido', () => {
    // A data prevista do parto é futura por definição — sem esta exceção não
    // havia forma nenhuma de a registar.
    expect(parseDataPt('01/01/2999', { permitirFuturo: true })).not.toBeNull();
  });

  it('continua a validar o resto mesmo a permitir futuro', () => {
    expect(parseDataPt('31/02/2999', { permitirFuturo: true })).toBeNull();
  });

  // A data fica ao meio-dia. Enquanto o limite do "futuro" foi o instante
  // atual, escrever a data de hoje antes das 12h dava "Data inválida" —
  // exatamente o que acontecia no "Marcar saída", que já vem preenchido com
  // hoje. Percorre-se o dia inteiro para que nenhuma hora volte a falhar.
  it.each([0, 6, 9, 11, 12, 13, 18, 23])('aceita a data de hoje às %ih', (hora) => {
    jest.useFakeTimers();
    try {
      const agora = new Date(2026, 6, 23, hora, 30, 0);
      jest.setSystemTime(agora);
      const p = (n: number) => String(n).padStart(2, '0');
      const hoje = `${p(agora.getDate())}/${p(agora.getMonth() + 1)}/${agora.getFullYear()}`;
      expect(parseDataPt(hoje)).not.toBeNull();
      // Amanhã continua a ser recusado, a qualquer hora: a garantia que se
      // pretende é "não aceitar dias futuros", não "não aceitar horas futuras".
      const amanha = new Date(2026, 6, 24);
      const amanhaTxt = `${p(amanha.getDate())}/${p(amanha.getMonth() + 1)}/${amanha.getFullYear()}`;
      expect(parseDataPt(amanhaTxt)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('mascaraDataPt', () => {
  it('põe as barras à medida que se escreve', () => {
    expect(mascaraDataPt('')).toBe('');
    expect(mascaraDataPt('1')).toBe('1');
    expect(mascaraDataPt('15')).toBe('15');
    expect(mascaraDataPt('150')).toBe('15/0');
    expect(mascaraDataPt('1503')).toBe('15/03');
    expect(mascaraDataPt('15032')).toBe('15/03/2');
    expect(mascaraDataPt('15032021')).toBe('15/03/2021');
  });

  it('nunca deixa uma barra no fim, para o apagar funcionar', () => {
    // Se a máscara devolvesse "15/" a partir de "15", apagar a barra voltava a
    // pô-la e a tecla parecia avariada. O que sai daqui volta a entrar aqui.
    for (const digitos of ['1', '15', '150', '1503', '15032', '150320', '1503202', '15032021']) {
      const saida = mascaraDataPt(digitos);
      expect(saida).not.toMatch(/\/$/);
      expect(mascaraDataPt(saida)).toBe(saida); // idempotente
    }
  });

  it('endireita o que vem colado e corta o que sobra', () => {
    expect(mascaraDataPt('15-03-2021')).toBe('15/03/2021');
    expect(mascaraDataPt('15.03.2021')).toBe('15/03/2021');
    expect(mascaraDataPt('15/03/2021999')).toBe('15/03/2021');
    expect(mascaraDataPt('abc')).toBe('');
  });

  it('o que a máscara produz é aceite pelo parseDataPt', () => {
    // As duas peças têm de encaixar: não vale a máscara escrever num formato
    // que a validação depois recusa.
    expect(parseDataPt(mascaraDataPt('15032021'))).not.toBeNull();
  });
});

describe('diaIso', () => {
  it('lê o dia em hora local, não em UTC', () => {
    // O caso que interessa: entre a meia-noite e a uma da manhã, com o país em
    // UTC+1, o `toISOString()` ainda dá o dia anterior. É a conta que decide o
    // dia com que um movimento é gravado na coluna `date` do servidor.
    const instante = new Date(2026, 6, 25, 0, 30);
    expect(diaIso(instante)).toBe('2026-07-25');
    expect(diaIso(instante.toISOString())).toBe('2026-07-25');
  });

  it('não mexe num dia que já vem sem hora', () => {
    // O servidor devolve `date` sem hora. Passá-lo por `new Date` fazia o JS
    // lê-lo como meia-noite UTC, e num fuso a oeste a ida e volta recuava um
    // dia de cada vez que o mesmo movimento fosse gravado outra vez.
    expect(diaIso('2026-07-25')).toBe('2026-07-25');
    expect(diaIso('2026-01-01')).toBe('2026-01-01');
  });
});

describe('isoMaisDias', () => {
  it('soma dias e fixa a hora ao meio-dia', () => {
    // Meio-dia evita que fusos horários passem a data para o dia anterior.
    const d = new Date(isoMaisDias('2026-03-01T12:00:00.000Z', 283));
    expect(d.getHours()).toBe(12);
  });

  it('daqui a 10 dias continua a ler-se como 10 dias', () => {
    // O relógio TEM de ser fixado, e ao meio-dia — a hora a que `isoMaisDias`
    // ancora o alvo. Com a hora real este teste dava 11 de manhã e 10 de
    // tarde: falhava em metade das execuções da CI, e uma porta de qualidade
    // que falha ao calhar deixa de ser lida.
    //
    // A diferença de manhã não é ruído do teste — é `diasAte` a arredondar
    // para cima sobre uma fração de dia, o que faz as contagens dos alertas
    // mostrarem um dia a mais antes do meio-dia. Fica registado à parte.
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 19, 12, 0, 0));
    try {
      expect(diasAte(isoMaisDias(new Date().toISOString(), 10))).toBe(10);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('idadeDias / diasAte', () => {
  it('idadeDias conta dias desde o nascimento', () => {
    expect(idadeDias(isoDaysAgo(10))).toBe(10);
  });

  it('diasAte é positivo no futuro e negativo no passado', () => {
    expect(diasAte(isoInDays(5))).toBeGreaterThan(0);
    expect(diasAte(isoDaysAgo(5))).toBeLessThan(0);
  });
});
