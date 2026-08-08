import { describe, expect, it, jest } from '@jest/globals';

import { comRelogio } from '../../testUtils/relogio';
import {
  diaIso,
  diasAte,
  idadeDias,
  idadeExtenso,
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
    // O relógio fixa-se na mesma, para o teste não depender da hora a que a CI
    // corre — mas já não é preciso que seja ao meio-dia. Enquanto `diasAte`
    // media horas e arredondava para cima, esta conta dava 11 de manhã e 10 de
    // tarde e o teste só passava se fosse ancorado ao meio-dia; agora compara
    // dias com dias e dá 10 a qualquer hora (ver `diasAte — conta dias`).
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 19, 8, 0, 0));
    try {
      expect(diasAte(isoMaisDias(new Date().toISOString(), 10))).toBe(10);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('diasAte — conta dias, não horas', () => {
  it('à 00:30 de verão, ontem é −1 e não 0', () => {
    // O erro relatado, no instante exato em que aparecia. Uma data SEM hora
    // (`2026-08-05` — a forma que vem do servidor e a que `diaIso` produz) é
    // lida como meia-noite UTC; à 00:30 de Portugal em UTC+1 isso punha ONTEM a
    // 0,98 dias de agora, e arredondar para cima dava 0. Efeito no ecrã: um
    // lote fora de validade lia-se "A expirar" em vez de "Fora de validade".
    comRelogio('Europe/Lisbon', [2026, 8, 6, 0, 30], () => {
      expect(diasAte('2026-08-05')).toBe(-1);
      expect(diasAte('2026-08-06')).toBe(0);
      expect(diasAte('2026-08-07')).toBe(1);
    });
  });

  // Sem o relógio fixo isto passava 23 horas por dia sem provar nada. Percorrer
  // o dia inteiro é o que mostra que a resposta deixou de depender da hora: a
  // meia-noite é o caso relatado, e a manhã inteira é o outro caminho (um alvo
  // ao meio-dia ficava a 7,4 dias às 00:30 e lia-se 8).
  it.each([0, 1, 5, 9, 11, 12, 13, 18, 23])('dá o mesmo às %ih', (hora) => {
    comRelogio('Europe/Lisbon', [2026, 8, 6, hora, 30], () => {
      expect(diasAte('2026-08-05')).toBe(-1);
      expect(diasAte('2026-08-06')).toBe(0);
      expect(diasAte('2026-08-07')).toBe(1);
      // Um instante completo ao meio-dia, que é o que `isoMaisDias` e
      // `parseDataPt` gravam: o prazo de sete dias tem de ler-se sete.
      expect(diasAte(isoMaisDias(new Date().toISOString(), 7))).toBe(7);
    });
  });

  it('no inverno, com o país em UTC+0, responde o mesmo', () => {
    // De novembro a março o desalinhamento desaparece. A conta não pode mudar
    // de resposta com a estação — é a mesma pergunta.
    comRelogio('Europe/Lisbon', [2026, 1, 15, 0, 30], () => {
      expect(diasAte('2026-01-14')).toBe(-1);
      expect(diasAte('2026-01-15')).toBe(0);
      expect(diasAte('2026-01-16')).toBe(1);
    });
  });

  it('as noites de 23 e 25 horas da mudança da hora valem um dia, como as outras', () => {
    // Contar dias dividindo milissegundos por 86 400 000 conta 1,04 dias na
    // noite em que o relógio recua e 0,96 na que avança. Os dias comparam-se
    // ancorados ao meio-dia justamente para essas duas noites não escaparem.
    comRelogio('Europe/Lisbon', [2026, 10, 24, 23, 30], () => {
      expect(diasAte('2026-10-25')).toBe(1); // a noite de 25 horas
      expect(diasAte('2026-10-26')).toBe(2);
    });
    comRelogio('Europe/Lisbon', [2026, 3, 28, 23, 30], () => {
      expect(diasAte('2026-03-29')).toBe(1); // a noite de 23 horas
      expect(diasAte('2026-03-30')).toBe(2);
    });
  });
});

describe('idadeDias / diasAte', () => {
  it('idadeDias conta dias desde o nascimento', () => {
    // Relógio fixo: `isoDaysAgo(10)` recua 10×24h, e nas noites de 23 e 25 horas
    // da mudança da hora isso não cai no mesmo ponto do dia. Com a data real,
    // este teste tinha uma janela de uma hora, duas vezes por ano, para falhar.
    comRelogio('Europe/Lisbon', [2026, 8, 8, 11, 29], () => {
      expect(idadeDias(isoDaysAgo(10))).toBe(10);
    });
  });

  it('diasAte é positivo no futuro e negativo no passado', () => {
    expect(diasAte(isoInDays(5))).toBeGreaterThan(0);
    expect(diasAte(isoDaysAgo(5))).toBeLessThan(0);
  });
});

describe('idadeDias — um animal nascido hoje tem zero dias, não menos um', () => {
  // As datas de nascimento ficam gravadas ao MEIO-DIA (`parseDataPt`). Medir a
  // distância em horas até ao meio-dia dava −1 durante toda a manhã, e o
  // `idadeExtenso` escrevia "por nascer" na ficha de um bezerro que estava ali à
  // frente do criador. O mesmo desvio tirava um dia a todos os prazos que se
  // contam a partir da idade. Percorre-se o dia inteiro: à tarde já acertava, e
  // é por isso que isto nunca deu nas vistas.
  const aoMeioDiaDe = (ano: number, mes: number, dia: number) =>
    new Date(ano, mes - 1, dia, 12, 0, 0).toISOString();

  it.each([0, 6, 9, 11, 12, 13, 18, 23])('às %ih', (hora) => {
    comRelogio('Europe/Lisbon', [2026, 8, 8, hora, 30], () => {
      expect(idadeDias(aoMeioDiaDe(2026, 8, 8))).toBe(0);
      expect(idadeExtenso(aoMeioDiaDe(2026, 8, 8))).toBe('0 dias');
      expect(idadeDias(aoMeioDiaDe(2026, 8, 7))).toBe(1);
      expect(idadeDias(aoMeioDiaDe(2026, 8, 5))).toBe(3);
      // Um nascimento mesmo no futuro continua a ser negativo — é o que o
      // `faixaDe` usa para não classificar um recém-nascido como "mais de 8
      // anos" quando o relógio do aparelho está desacertado.
      expect(idadeDias(aoMeioDiaDe(2026, 8, 9))).toBe(-1);
      expect(idadeExtenso(aoMeioDiaDe(2026, 8, 9))).toBe('por nascer');
    });
  });

  it('e o prazo do brinco de um bezerro de três dias é 17, a qualquer hora', () => {
    // O efeito a jusante, tal como o `alertas.ts` o calcula: 20 dias de prazo
    // legal menos a idade. De manhã lia-se 18.
    comRelogio('Europe/Lisbon', [2026, 8, 8, 9, 0], () => {
      expect(20 - idadeDias(aoMeioDiaDe(2026, 8, 5))).toBe(17);
    });
    comRelogio('Europe/Lisbon', [2026, 8, 8, 17, 0], () => {
      expect(20 - idadeDias(aoMeioDiaDe(2026, 8, 5))).toBe(17);
    });
  });

  it('mede o mesmo prazo que o diasAte, que é a régua do snira.ts', () => {
    // O `alertas.ts` conta o prazo do SNIRA por `PrazosLegais.snira -
    // idadeDias(...)` e o `snira.ts` por `diasAte(isoMaisDias(..., 7))`. São
    // duas contas para o mesmo número, em ecrãs que o criador vê lado a lado.
    // Enquanto uma media horas para trás e a outra para a frente, discordavam a
    // manhã inteira. Agora assentam as duas em dias de calendário.
    for (const hora of [0, 9, 11, 13, 23]) {
      comRelogio('Europe/Lisbon', [2026, 8, 8, hora, 30], () => {
        const identificacao = aoMeioDiaDe(2026, 8, 5);
        expect(7 - idadeDias(identificacao)).toBe(diasAte(isoMaisDias(identificacao, 7)));
      });
    }
  });
});
