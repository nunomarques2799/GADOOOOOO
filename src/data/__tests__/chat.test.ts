/**
 * As contas das conversas: o que a lista mostra, como se junta o que chega de
 * três sítios ao mesmo tempo, e quem pode apagar ou denunciar o quê.
 *
 * O que NÃO se testa aqui é o que decide de verdade quem lê o quê: isso é a
 * RLS, vive em `supabase/schema_chat.sql` e prova-se no psql a impersonar cada
 * papel (ver a secção VERIFICAR do ficheiro). Um teste em JavaScript que
 * "provasse" o isolamento das conversas estaria a provar a cópia, não o
 * original.
 */

import { describe, expect, it } from '@jest/globals';

import { comRelogio } from '../../testUtils/relogio';
import {
  agruparPorDia,
  descricaoCurta,
  duracaoCurta,
  horaCurta,
  iniciais,
  mesclarMensagens,
  ordenarConversas,
  percentagemDaOpcao,
  podeApagarMensagem,
  podeDenunciarMensagem,
  primeiroNome,
  problemaComSondagem,
  problemaComTexto,
  resumoDaUltima,
  rotuloDoDia,
  tituloDaConversa,
  totalDeVotos,
  totalNaoLidas,
  MAX_TEXTO,
  type Conversa,
  type Mensagem,
  type OpcaoSondagem,
} from '../chat';

/** Uma conversa com o mínimo preenchido. */
function conv(p: Partial<Conversa> & { id: string }): Conversa {
  return {
    tipo: 'grupo',
    ultimaEm: '2026-08-20T10:00:00.000Z',
    ultimoApagado: false,
    naoLidas: 0,
    silenciada: false,
    ativa: true,
    ...p,
  };
}

/** Uma mensagem com o mínimo preenchido. */
function msg(p: Partial<Mensagem> & { id: string }): Mensagem {
  return {
    conversaId: 'c1',
    tipo: 'texto',
    autor: 'u1',
    texto: 'bom dia',
    criadoEm: '2026-08-20T10:00:00.000Z',
    ...p,
  };
}

const NOMES: Record<string, string> = { u1: 'João Ferreira', u2: 'Ana Pastora' };
const nomeDe = (id?: string) => (id ? NOMES[id] : undefined);
const nomeExploracao = (id?: string) => (id === 'e1' ? 'Monte do Avô' : undefined);

describe('problemaComTexto — uma frase por engano', () => {
  it('aceita uma mensagem normal', () => {
    expect(problemaComTexto('Amanhã às 8 no curral')).toBeNull();
  });

  it('recusa o vazio e o que só tem espaços', () => {
    expect(problemaComTexto('')).toMatch(/Escreva/);
    expect(problemaComTexto('   \n  ')).toMatch(/Escreva/);
  });

  it('recusa o que passa do teto da coluna', () => {
    // O teto é o mesmo que a restrição do `texto` aceita no servidor. Se um dos
    // dois mudar sozinho, a app deixa passar o que o servidor recusa.
    expect(problemaComTexto('a'.repeat(MAX_TEXTO))).toBeNull();
    expect(problemaComTexto('a'.repeat(MAX_TEXTO + 1))).toMatch(/comprida/);
  });

  it('conta o texto JÁ APARADO, e não o que vem do campo', () => {
    // Sem o `trim` antes da contagem, dez espaços a mais no fim recusavam uma
    // mensagem que o servidor teria aceitado.
    expect(problemaComTexto('a'.repeat(MAX_TEXTO) + '     ')).toBeNull();
  });
});

describe('tituloDaConversa — como se chama cada uma', () => {
  it('o grupo sem nome chama-se como a exploração', () => {
    const c = conv({ id: 'c1', tipo: 'grupo', exploracaoId: 'e1' });
    expect(tituloDaConversa(c, nomeDe, nomeExploracao)).toBe('Monte do Avô');
  });

  it('o nome que o dono escreveu ganha ao da exploração', () => {
    const c = conv({ id: 'c1', tipo: 'grupo', exploracaoId: 'e1', nome: 'Equipa da manhã' });
    expect(tituloDaConversa(c, nomeDe, nomeExploracao)).toBe('Equipa da manhã');
  });

  it('a privada chama-se como a pessoa do outro lado', () => {
    const c = conv({ id: 'c2', tipo: 'privada', outro: 'u2' });
    expect(tituloDaConversa(c, nomeDe, nomeExploracao)).toBe('Ana Pastora');
  });

  it('quem apagou a conta continua a ter um nome na lista', () => {
    // A mensagem fica (a coluna `autor` passa a null), e uma conversa com um
    // título vazio era uma linha em branco a meio da lista.
    const c = conv({ id: 'c3', tipo: 'privada', outro: undefined });
    expect(tituloDaConversa(c, nomeDe, nomeExploracao)).toBe('Utilizador removido');
  });
});

describe('resumoDaUltima — a linha de baixo, na lista', () => {
  it('diz "Eu" quando fui eu a escrever', () => {
    const c = conv({ id: 'c1', ultimoTexto: 'já fui', ultimoTipo: 'texto', ultimoAutor: 'u1' });
    expect(resumoDaUltima(c, 'u1', nomeDe)).toBe('Eu: já fui');
  });

  it('no grupo, diz o primeiro nome de quem escreveu', () => {
    const c = conv({ id: 'c1', tipo: 'grupo', ultimoTexto: 'vou lá', ultimoTipo: 'texto', ultimoAutor: 'u2' });
    expect(resumoDaUltima(c, 'u1', nomeDe)).toBe('Ana: vou lá');
  });

  it('na privada não diz o nome: só lá estão dois', () => {
    const c = conv({ id: 'c2', tipo: 'privada', outro: 'u2', ultimoTexto: 'vou lá', ultimoTipo: 'texto', ultimoAutor: 'u2' });
    expect(resumoDaUltima(c, 'u1', nomeDe)).toBe('vou lá');
  });

  it('uma conversa por estrear diz que ainda não tem nada', () => {
    expect(resumoDaUltima(conv({ id: 'c1' }), 'u1', nomeDe)).toBe('Ainda sem mensagens');
  });

  /**
   * O "tem mensagens?" pergunta-se ao TIPO e não ao texto.
   *
   * Uma fotografia sem legenda tem texto vazio: com a pergunta feita ao texto,
   * uma conversa cheia de fotografias aparecia na lista como "Ainda sem
   * mensagens".
   */
  it('uma fotografia sem legenda não é uma conversa vazia', () => {
    const c = conv({ id: 'c1', tipo: 'grupo', ultimoTipo: 'foto', ultimoAutor: 'u2' });
    expect(resumoDaUltima(c, 'u1', nomeDe)).toBe('Ana: Fotografia');
  });

  it('a mensagem apagada não mostra o texto que lá estava', () => {
    // O texto continua na base (é a linha que fica), mas quem a apagou pediu
    // que não se lesse — e a lista é o sítio onde isso passaria despercebido.
    const c = conv({ id: 'c1', tipo: 'privada', outro: 'u2', ultimoTexto: 'segredo', ultimoTipo: 'texto', ultimoAutor: 'u2', ultimoApagado: true });
    expect(resumoDaUltima(c, 'u1', nomeDe)).toBe('Mensagem apagada');
  });
});

describe('mesclarMensagens — o mesmo chega por três portas', () => {
  it('não repete o que já lá está', () => {
    const a = [msg({ id: 'm1' })];
    expect(mesclarMensagens(a, [msg({ id: 'm1' })])).toHaveLength(1);
  });

  it('ordena por hora, venha de onde vier', () => {
    const antiga = msg({ id: 'm1', criadoEm: '2026-08-20T09:00:00.000Z' });
    const nova = msg({ id: 'm2', criadoEm: '2026-08-20T11:00:00.000Z' });
    const meio = msg({ id: 'm3', criadoEm: '2026-08-20T10:00:00.000Z' });
    expect(mesclarMensagens([nova], [antiga, meio]).map((m) => m.id)).toEqual(['m1', 'm3', 'm2']);
  });

  it('a que chega do servidor tira a marca de "por enviar"', () => {
    // Isto é a correção de um erro que se vê: a minha mensagem saiu, o tempo
    // real devolve-ma, e sem isto ficava com o relógio de "por enviar" para
    // sempre — a app a dizer que não tinha ido o que já lá estava.
    const local = [msg({ id: 'm1', porEnviar: true })];
    const doServidor = [msg({ id: 'm1' })];
    expect(mesclarMensagens(local, doServidor)[0].porEnviar).toBeUndefined();
  });

  it('quem ainda está na fila mantém a marca', () => {
    const local = [msg({ id: 'm1', porEnviar: true })];
    const outra = [msg({ id: 'm2' })];
    const r = mesclarMensagens(local, outra);
    expect(r.find((m) => m.id === 'm1')?.porEnviar).toBe(true);
  });

  it('a versão do servidor traz o que a local não sabia (apagada)', () => {
    const local = [msg({ id: 'm1' })];
    const doServidor = [msg({ id: 'm1', apagadaEm: '2026-08-20T12:00:00.000Z' })];
    expect(mesclarMensagens(local, doServidor)[0].apagadaEm).toBe('2026-08-20T12:00:00.000Z');
  });
});

describe('agruparPorDia e rotuloDoDia — os separadores da conversa', () => {
  it('junta as do mesmo dia e separa as de dias diferentes', () => {
    const blocos = agruparPorDia([
      msg({ id: 'm1', criadoEm: '2026-08-19T09:00:00.000Z' }),
      msg({ id: 'm2', criadoEm: '2026-08-19T18:00:00.000Z' }),
      msg({ id: 'm3', criadoEm: '2026-08-20T08:00:00.000Z' }),
    ]);
    expect(blocos.map((b) => b.dia)).toEqual(['2026-08-19', '2026-08-20']);
    expect(blocos[0].mensagens).toHaveLength(2);
  });

  /**
   * O dia é o dia LOCAL de quem lê, e a comparação é entre textos de dia.
   *
   * Contar horas de diferença é o erro que esta app já pagou uma vez (ver
   * `gado-testes-vermelhos-a-meia-noite`): uma mensagem das 23h de ontem está a
   * menos de 24 horas de agora e continua a ser de ONTEM.
   */
  it('"Hoje" e "Ontem" não dependem da hora a que se pergunta', () => {
    comRelogio([2026, 8, 20, 7, 30], () => {
      expect(rotuloDoDia('2026-08-20')).toBe('Hoje');
      expect(rotuloDoDia('2026-08-19')).toBe('Ontem');
      expect(rotuloDoDia('2026-08-18')).toBe('18/08/2026');
    });
    comRelogio([2026, 8, 20, 23, 50], () => {
      expect(rotuloDoDia('2026-08-20')).toBe('Hoje');
      expect(rotuloDoDia('2026-08-19')).toBe('Ontem');
    });
  });

  it('o primeiro dia do mês vê bem o último do anterior', () => {
    comRelogio([2026, 9, 1, 0, 10], () => {
      expect(rotuloDoDia('2026-08-31')).toBe('Ontem');
    });
  });
});

describe('horaCurta — a hora ao lado da mensagem', () => {
  it('escreve com dois dígitos', () => {
    comRelogio([2026, 8, 20, 12, 0], () => {
      // Meio-dia e cinco em Lisboa, escrito em UTC: agosto é UTC+1.
      expect(horaCurta('2026-08-20T11:05:00.000Z')).toBe('12:05');
    });
  });

  it('não inventa nada com um valor que não é data', () => {
    expect(horaCurta('nem por sombras')).toBe('');
  });
});

describe('o que se pode fazer a uma mensagem', () => {
  it('só se apaga a própria, e só uma vez', () => {
    expect(podeApagarMensagem(msg({ id: 'm', autor: 'u1' }), 'u1')).toBe(true);
    expect(podeApagarMensagem(msg({ id: 'm', autor: 'u2' }), 'u1')).toBe(false);
    expect(podeApagarMensagem(msg({ id: 'm', autor: 'u1', apagadaEm: 'x' }), 'u1')).toBe(false);
  });

  it('não se apaga o que ainda não saiu daqui', () => {
    // Apagar chama o servidor, e o servidor ainda não conhece esta linha.
    expect(podeApagarMensagem(msg({ id: 'm', autor: 'u1', porEnviar: true }), 'u1')).toBe(false);
  });

  it('só se denuncia a dos outros', () => {
    expect(podeDenunciarMensagem(msg({ id: 'm', autor: 'u2' }), 'u1')).toBe(true);
    expect(podeDenunciarMensagem(msg({ id: 'm', autor: 'u1' }), 'u1')).toBe(false);
  });

  it('não se denuncia o que já foi apagado', () => {
    // Quem apagou fez o que a denúncia ia pedir.
    expect(podeDenunciarMensagem(msg({ id: 'm', autor: 'u2', apagadaEm: 'x' }), 'u1')).toBe(false);
  });

  it('a mensagem de quem apagou a conta não se denuncia nem se apaga', () => {
    const orfa = msg({ id: 'm', autor: undefined });
    expect(podeDenunciarMensagem(orfa, 'u1')).toBe(false);
    expect(podeApagarMensagem(orfa, 'u1')).toBe(false);
  });
});

describe('a lista de conversas', () => {
  it('mostra a mais recente à cabeça', () => {
    const lista = ordenarConversas([
      conv({ id: 'a', ultimaEm: '2026-08-19T10:00:00.000Z' }),
      conv({ id: 'b', ultimaEm: '2026-08-20T10:00:00.000Z' }),
    ]);
    expect(lista.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('soma o que falta ler', () => {
    expect(totalNaoLidas([conv({ id: 'a', naoLidas: 2 }), conv({ id: 'b', naoLidas: 3 })])).toBe(5);
  });

  it('uma conversa silenciada não acende o número da barra', () => {
    // Silenciar é pedir para não ser incomodado. Um ponto vermelho na barra
    // por causa dela é exatamente ser incomodado.
    expect(
      totalNaoLidas([conv({ id: 'a', naoLidas: 9, silenciada: true }), conv({ id: 'b', naoLidas: 1 })]),
    ).toBe(1);
  });
});

describe('descricaoCurta — uma mensagem numa linha', () => {
  it('o texto é o próprio texto', () => {
    expect(descricaoCurta('texto', 'vou já')).toBe('vou já');
  });

  it('uma fotografia sem legenda diz o que é', () => {
    // Sem isto, a lista de conversas mostrava uma linha em BRANCO por baixo do
    // nome de quem mandou uma fotografia, e parecia uma conversa avariada.
    expect(descricaoCurta('foto', '')).toBe('Fotografia');
    expect(descricaoCurta('audio', '')).toBe('Mensagem de voz');
    expect(descricaoCurta('local', '')).toBe('Localização');
  });

  it('mas a legenda ganha à palavra genérica', () => {
    // "o portão partido" diz mais do que "Fotografia".
    expect(descricaoCurta('foto', 'o portão partido')).toBe('o portão partido');
  });
});

describe('duracaoCurta — o tempo de um áudio', () => {
  it('escreve minutos e segundos', () => {
    expect(duracaoCurta(0)).toBe('0:00');
    expect(duracaoCurta(8)).toBe('0:08');
    expect(duracaoCurta(65)).toBe('1:05');
    expect(duracaoCurta(600)).toBe('10:00');
  });

  it('não inventa nada com o que não recebeu', () => {
    expect(duracaoCurta(undefined)).toBe('0:00');
    expect(duracaoCurta(-5)).toBe('0:00');
  });
});

describe('problemaComSondagem — as mesmas regras do servidor', () => {
  it('aceita uma pergunta com duas respostas', () => {
    expect(problemaComSondagem('Quem vem sábado?', ['Eu vou', 'Não posso'])).toBeNull();
  });

  it('sem pergunta não há sondagem', () => {
    expect(problemaComSondagem('   ', ['a', 'b'])).toMatch(/pergunta/);
  });

  it('com uma resposta só também não', () => {
    expect(problemaComSondagem('Vens?', ['Sim'])).toMatch(/pelo menos/);
    expect(problemaComSondagem('Vens?', ['Sim', '  '])).toMatch(/pelo menos/);
  });

  /**
   * As repetidas contam UMA vez, como no `criar_sondagem` do servidor.
   *
   * Sem esta conta, a app deixava passar "Sim/Sim" e era o servidor a recusar
   * depois de a pessoa carregar em enviar. Duas respostas iguais repartiam os
   * votos por nada.
   */
  it('duas respostas iguais são uma só', () => {
    expect(problemaComSondagem('Vens?', ['Sim', 'Sim'])).toMatch(/pelo menos/);
    expect(problemaComSondagem('Vens?', ['Sim', ' Sim '])).toMatch(/pelo menos/);
  });

  it('há um teto de respostas', () => {
    expect(problemaComSondagem('Qual?', ['a', 'b', 'c', 'd', 'e', 'f'])).toBeNull();
    expect(problemaComSondagem('Qual?', ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toMatch(/máximo/);
  });
});

describe('as contas de uma sondagem', () => {
  const op = (p: Partial<OpcaoSondagem> & { id: string }): OpcaoSondagem => ({
    mensagemId: 'm1',
    texto: 'Sim',
    ordem: 0,
    votos: 0,
    quem: [],
    minha: false,
    ...p,
  });

  it('soma os votos todos', () => {
    expect(totalDeVotos([op({ id: 'a', votos: 2 }), op({ id: 'b', votos: 1 })])).toBe(3);
  });

  it('a percentagem é sobre o total, e não sobre o maior', () => {
    const a = op({ id: 'a', votos: 3 });
    expect(percentagemDaOpcao(a, 4)).toBe(75);
  });

  it('sem votos nenhuns, nenhuma barra se enche', () => {
    // Uma divisão por zero dava `NaN`, e um `width: NaN%` desenha a barra
    // inteira: uma sondagem por responder parecia ter 100% em todas.
    expect(percentagemDaOpcao(op({ id: 'a' }), 0)).toBe(0);
  });
});

describe('nomes', () => {
  it('o primeiro nome é o que cabe na lista', () => {
    expect(primeiroNome('João Carlos Silva')).toBe('João');
    expect(primeiroNome('Ana')).toBe('Ana');
  });

  it('as iniciais são duas: a primeira e a última', () => {
    expect(iniciais('João Ferreira')).toBe('JF');
    expect(iniciais('Ana Maria Pastora')).toBe('AP');
    expect(iniciais('Ana')).toBe('AN');
    expect(iniciais('   ')).toBe('?');
  });
});
