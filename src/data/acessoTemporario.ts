/**
 * Acesso com prazo — quanto tempo alguém fica ligado a uma exploração.
 * ------------------------------------------------------------------
 * Lógica pura (sem React, sem rede) para poder ser testada.
 *
 * Existe por causa do veterinário: é convidado para uma vinda, não para
 * sempre. O convite passa a levar consigo quantas horas o acesso dura, e a
 * coluna `membro_exploracao.expira_em` é quem decide — no servidor, dentro dos
 * helpers por onde toda a RLS passa (ver `supabase/schema_acesso_temporario.sql`).
 *
 * O que está aqui é o mesmo relógio, do lado da app: serve para NÃO mostrar
 * controlos que o servidor já não aceita, e para dizer às pessoas até quando
 * vale o que estão a ver. Quem manda continua a ser o servidor.
 */

/** Quanto tempo o acesso pode durar. Em horas, que é a unidade da coluna. */
export const DURACOES_ACESSO: { horas: number; label: string }[] = [
  { horas: 4, label: '4 horas' },
  { horas: 12, label: '12 horas' },
  { horas: 24, label: '1 dia' },
  { horas: 72, label: '3 dias' },
  { horas: 168, label: '1 semana' },
  { horas: 720, label: '1 mês' },
];

/** A duração oferecida por omissão a um veterinário: a visita de um dia. */
export const DURACAO_OMISSAO = 24;

/**
 * O acesso já terminou?
 *
 * Sem prazo (`undefined`) NUNCA expira — é o caso dos donos e dos
 * trabalhadores, e tratá-lo como expirado fechava a app a quase toda a gente.
 * Uma data que não se consegue ler também não expira, pela mesma razão: perante
 * dados estranhos, o lado seguro aqui é deixar ver (o servidor recusa na mesma
 * o que tiver de recusar) e não trancar alguém à porta por causa de um `null`
 * mal escrito.
 */
export function acessoTerminou(expiraEm?: string, agora: Date = new Date()): boolean {
  if (!expiraEm) return false;
  const fim = new Date(expiraEm).getTime();
  if (Number.isNaN(fim)) return false;
  return fim <= agora.getTime();
}

/** Falta pouco? (para avisar antes de o acesso cair, não depois) */
export function acessoQuaseAFim(
  expiraEm?: string,
  agora: Date = new Date(),
  horasDeAviso = 24,
): boolean {
  if (!expiraEm || acessoTerminou(expiraEm, agora)) return false;
  const fim = new Date(expiraEm).getTime();
  if (Number.isNaN(fim)) return false;
  return fim - agora.getTime() <= horasDeAviso * 3600_000;
}

/**
 * Quanto falta, em palavras: "faltam 3 horas", "falta 1 dia", "faltam 20 minutos".
 *
 * Devolve `null` sem prazo ou já terminado — quem chama decide o que dizer
 * nesses casos, que são frases diferentes ("Sem prazo", "Acesso terminado") e
 * não variações desta.
 */
export function faltaParaExpirar(expiraEm?: string, agora: Date = new Date()): string | null {
  if (!expiraEm || acessoTerminou(expiraEm, agora)) return null;
  const ms = new Date(expiraEm).getTime() - agora.getTime();
  if (Number.isNaN(ms)) return null;

  const minutos = Math.round(ms / 60_000);
  if (minutos < 60) return minutos === 1 ? 'falta 1 minuto' : `faltam ${minutos} minutos`;

  const horas = Math.round(ms / 3600_000);
  if (horas < 48) return horas === 1 ? 'falta 1 hora' : `faltam ${horas} horas`;

  const dias = Math.round(ms / 86_400_000);
  return `faltam ${dias} dias`;
}

/**
 * A linha que descreve o prazo de um vínculo, para a lista da equipa.
 *
 * `formatarData` entra de fora (é `formatDataHora` dos helpers) para este
 * módulo continuar sem dependências e testável com uma data fixa.
 */
export function rotuloPrazo(
  expiraEm: string | undefined,
  formatarData: (iso: string) => string,
  agora: Date = new Date(),
): string {
  if (!expiraEm) return 'Sem prazo';
  if (acessoTerminou(expiraEm, agora)) return `Acesso terminado a ${formatarData(expiraEm)}`;
  return `Acesso até ${formatarData(expiraEm)} (${faltaParaExpirar(expiraEm, agora)})`;
}

/** O rótulo de uma duração em horas ("4 horas", "3 dias"), para as confirmações. */
export function rotuloDuracao(horas: number): string {
  const conhecida = DURACOES_ACESSO.find((d) => d.horas === horas);
  if (conhecida) return conhecida.label;
  if (horas < 24) return horas === 1 ? '1 hora' : `${horas} horas`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

/* ==================================================================
 * A pergunta antes de mexer no relógio de alguém
 * ==================================================================
 * Mudar o tempo de acesso de uma pessoa acontece com UM toque num chip, e não
 * havia nada entre o dedo e a mudança. Trocar "+4 horas" por "Terminar já" é um
 * engano de dois centímetros que fecha a app na cara de quem está a trabalhar.
 *
 * E há uma segunda razão, que só apareceu ao escrever isto: o servidor NÃO SOMA
 * as horas — `definir_prazo_de_acesso` faz `expira_em = now() + horas`, sempre.
 * Um veterinário com 8 horas pela frente a quem se carregue "+4 horas" fica com
 * 4: o botão ENCURTA-lhe o acesso. A frase de confirmação diz a hora a que o
 * acesso passa a acabar, e avisa quando ela é mais cedo do que a de agora — é a
 * única forma de isso deixar de acontecer às escondidas.
 */

/** O texto de uma confirmação, pronto a entregar ao `confirmar()`. */
export type PerguntaDePrazo = {
  titulo: string;
  mensagem: string;
  rotuloConfirmar: string;
  destrutivo: boolean;
};

/**
 * O que perguntar antes de mudar o prazo de alguém.
 *
 * `horas`: `0` termina já, `null` tira o prazo, `> 0` marca esse tempo A CONTAR
 * DE AGORA (não soma ao que já lá está — ver o bloco acima).
 *
 * `formatarData` entra de fora (é o `formatDataHora` dos helpers) para este
 * módulo continuar sem dependências e testável com uma data fixa.
 */
export function perguntaDePrazo(
  horas: number | null,
  quem: { nome: string; expiraEm?: string },
  formatarData: (iso: string) => string,
  agora: Date = new Date(),
): PerguntaDePrazo {
  if (horas === null) {
    return {
      titulo: 'Tirar o prazo',
      mensagem:
        `${quem.nome} passa a ter acesso SEM PRAZO a esta exploração: fica com ela até `
        + 'alguém o remover da equipa à mão. Um veterinário convidado para uma visita não '
        + 'costuma precisar disto.',
      rotuloConfirmar: 'Tirar o prazo',
      destrutivo: false,
    };
  }

  if (horas <= 0) {
    return {
      titulo: 'Terminar o acesso agora',
      mensagem:
        `${quem.nome} deixa de ver esta exploração já. O que ele tiver por gravar `
        + 'perde-se. A conta dele fica, e pode voltar a dar-lhe acesso quando quiser.',
      rotuloConfirmar: 'Terminar já',
      destrutivo: true,
    };
  }

  const fim = new Date(agora.getTime() + horas * 3_600_000);
  const terminou = acessoTerminou(quem.expiraEm, agora);
  const encurta =
    !!quem.expiraEm
    && !terminou
    && new Date(quem.expiraEm).getTime() > fim.getTime();

  return {
    titulo: terminou ? 'Reabrir o acesso' : 'Mudar o tempo de acesso',
    mensagem:
      `${quem.nome} fica com ${rotuloDuracao(horas)} de acesso a contar de agora. `
      + `Passa a terminar a ${formatarData(fim.toISOString())}.`
      // O aviso que impede o engano de encurtar sem dar por isso.
      + (encurta
        ? `\n\nATENÇÃO: neste momento ele tem acesso até ${formatarData(quem.expiraEm as string)}. `
          + 'Isto ENCURTA-LHE o acesso, não o prolonga.'
        : ''),
    rotuloConfirmar: terminou ? 'Reabrir' : 'Confirmar',
    destrutivo: encurta,
  };
}

/* ==================================================================
 * Hora marcada — "até quinta às 18h", em vez de "durante 12 horas"
 * ==================================================================
 * A duração responde a "quanto tempo" e conta a partir do resgate. Não escreve
 * a frase que o criador diz de facto: «ele vem quinta de manhã, quero que perca
 * o acesso quinta às 18h». Para a escrever era preciso adivinhar a que horas é
 * que o veterinário ia usar o código — e se ele o usasse na véspera à noite, as
 * 12 horas acabavam às 8 da manhã, a meio da visita.
 *
 * Daqui sai um INSTANTE (ISO). Quem manda continua a ser o servidor
 * (`convite.acesso_ate` → `membro_exploracao.expira_em`, em
 * `supabase/schema_acesso_ate.sql`); isto é só a conversão do que se escreve no
 * ecrã — `dd/mm/aaaa` mais `hh:mm` — para o que se envia.
 */

/** As horas que se oferecem com um toque. O resto escreve-se. */
export const HORAS_SUGERIDAS: string[] = ['08:00', '12:00', '18:00', '20:00'];

/** A hora oferecida por omissão: o fim de um dia de trabalho. */
export const HORA_OMISSAO = '18:00';

/**
 * Põe os dois pontos de uma hora à medida que se escreve: `1830` → `18:30`.
 *
 * Irmã da `mascaraDataPt` dos helpers, e pela mesma razão: o teclado numérico
 * do telemóvel não tem os dois pontos à mão, e obrigar a trocar de teclado a
 * meio de escrever uma hora é onde ela se engana.
 */
export function mascaraHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** A hora válida em minutos desde a meia-noite, ou `null` se não se percebe. */
export function minutosDaHora(hora: string): number | null {
  const m = hora.trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * A data escrita em português mais a hora, num instante.
 *
 * Devolve `null` se qualquer uma das duas não se perceber — quem chama mostra a
 * razão. `permitirFuturo` é sempre verdadeiro na leitura da data: um prazo de
 * acesso é, por definição, no futuro, e a regra por omissão do `parseDataPt`
 * (que existe para datas de nascimento) recusaria tudo o que aqui se escreve.
 */
export function combinarDataHora(
  dataIso: string | null,
  hora: string,
): string | null {
  if (!dataIso) return null;
  const minutos = minutosDaHora(hora);
  if (minutos === null) return null;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
  return d.toISOString();
}

/**
 * O que está errado no fim marcado, em palavras — ou `null` se está bem.
 *
 * Uma frase por engano, e não uma só para os dois: "a data não se percebe" e "a
 * hora já passou" pedem correções diferentes, e um "valor inválido" para ambos
 * deixava o criador a mexer no campo certo por sorte.
 */
export function problemaComFim(
  dataIso: string | null,
  hora: string,
  agora: Date = new Date(),
): string | null {
  if (!dataIso) return 'Escreva o dia em que o acesso termina (dd/mm/aaaa).';
  if (minutosDaHora(hora) === null) return 'Escreva a hora como 18:00.';
  const fim = combinarDataHora(dataIso, hora);
  if (!fim) return 'Não foi possível ler o dia e a hora.';
  if (new Date(fim).getTime() <= agora.getTime()) {
    return 'Esse momento já passou. Escolha um dia e uma hora à frente.';
  }
  return null;
}
