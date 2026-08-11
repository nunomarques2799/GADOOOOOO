/**
 * Reprodução — o estado de cada fêmea, lido dos eventos que estão registados.
 * ------------------------------------------------------------------
 * Lógica pura, sem React e sem rede, para poder ser testada.
 *
 * A REGRA DA CASA: o estado reprodutivo NÃO está guardado em lado nenhum.
 * Calcula-se aqui, a partir do histórico. Uma coluna `estado_reprodutivo` no
 * animal seria uma segunda verdade a manter alinhada com os eventos para
 * sempre, e no dia em que alguém corrigisse a data de um parto ficava a mentir
 * sem ninguém dar por isso.
 *
 * A única exceção é `animal.dataPrevistaParto`, que já existia antes disto:
 * essa é uma PREVISÃO (não um facto observado) e é lida pelo calendário e pelos
 * avisos do telemóvel, que não têm por onde a recalcular.
 *
 * O CICLO
 *
 *   cobrição → diagnóstico → parto → (recomeça)
 *
 * O que interessa é sempre o ciclo ATUAL, e o ciclo atual começa no último
 * parto. Um diagnóstico de gestação de 2024 não diz nada sobre uma vaca que
 * pariu em 2025 — contá-lo era dá-la por prenhe três anos seguidos.
 */

import { t, type ChaveTexto } from '@/i18n';

import { GestacaoDias, PrazosReproducao } from './constants';
import { diasAte, diasEntreDatas, idadeDias, isoMaisDias } from './helpers';
import type { Animal, Evento, ResultadoDiagnostico } from './types';

/** Em que ponto do ciclo está a fêmea. */
export type FaseReprodutiva =
  /** Confirmada prenhe (ou com data de parto marcada à mão na ficha). */
  | 'gestante'
  /** Coberta, ainda sem diagnóstico. */
  | 'coberta'
  /** O último diagnóstico foi inconclusivo: repete-se, não se arquiva. */
  | 'duvidosa'
  /** Não está prenhe: nunca foi coberta neste ciclo, ou foi dada como vazia. */
  | 'vazia'
  /** Macho, jovem de mais, ou já fora do efetivo. */
  | 'nao-aplicavel';

export type EstadoReprodutivo = {
  fase: FaseReprodutiva;
  /** O dia do facto que pôs a fêmea nesta fase (ISO). */
  desde?: string;
  /** Há quantos dias. Zero quando a fase não vem de um facto datado. */
  diasNaFase: number;
  /** Só quando gestante. */
  dataPrevistaParto?: string;
  /** Negativo se a data já passou. */
  diasParaParto?: number;
  /** Ausente se nunca pariu. */
  diasDesdeUltimoParto?: number;
  /** Quantos partos estão registados. */
  partos: number;
  /**
   * Média dos intervalos entre partos consecutivos, em dias. Precisa de dois
   * partos para existir — com um só não há intervalo nenhum para medir.
   */
  intervaloMedioPartos?: number;
  /** O que se escreveu na cobrição (o touro, o sémen), se houver. */
  detalheCobricao?: string;
};

const NAO_APLICAVEL: EstadoReprodutivo = { fase: 'nao-aplicavel', diasNaFase: 0, partos: 0 };

/** Os tipos de evento que dizem que esta fêmea já está à reprodução. */
function eReprodutivo(e: Evento): boolean {
  return e.tipo === 'Cobrição' || e.tipo === 'Diagnóstico' || e.tipo === 'Parto';
}

/**
 * Esta fêmea entra nas listas de reprodução?
 *
 * Fêmea, no efetivo, e com idade para isso. A idade mínima não é preciosismo:
 * sem ela, todas as vitelas nascidas este ano apareciam na lista de "sem
 * cobrição" e a lista deixava de servir para alguma coisa.
 *
 * `jaAndaNaReproducao` é a exceção que a idade sozinha não sabia fazer. Se há
 * uma cobrição, um diagnóstico ou um parto registados, a pergunta está
 * respondida pelos factos e a régua da idade não tem nada que se meter: uma
 * novilha coberta aos catorze meses precisa de diagnóstico exatamente como
 * qualquer outra, e ficava de fora da lista precisamente na altura em que era
 * preciso não a perder de vista.
 */
export function elegivelParaReproducao(a: Animal, jaAndaNaReproducao = false): boolean {
  if (a.sexo !== 'Fêmea') return false;
  if (a.estado && a.estado !== 'ativo') return false;
  if (jaAndaNaReproducao) return true;
  return idadeDias(a.dataNascimento) >= PrazosReproducao.idadeMinFemeaMeses * 30.44;
}

/**
 * Dias de calendário entre duas datas ISO (b − a).
 *
 * Delega no `diasEntreDatas` do `helpers.ts`. Estas duas contas eram feitas aqui
 * à mão, a dividir milissegundos por um dia e a arredondar para baixo: como os
 * eventos ficam gravados ao MEIO-DIA (`parseDataPt`), a fração que sobrava
 * tirava um dia até ao meio-dia. O "pariu há 12 dias" lia-se 11 de manhã, e
 * mudava sozinho a meio do dia sem nada ter acontecido.
 */
function diasEntre(a: string, b: string): number {
  return diasEntreDatas(a, b);
}

/** Dias de calendário desde uma data ISO até hoje. */
function diasDesde(iso: string): number {
  return diasEntreDatas(iso, new Date());
}

/**
 * A data prevista do parto a partir de uma cobrição, pela gestação média da
 * espécie. É uma média da literatura zootécnica, não uma garantia — e é por
 * isso que a app fala sempre em "previsto".
 */
export function preverParto(especie: Animal['especie'], dataCobricao: string): string {
  return isoMaisDias(dataCobricao, GestacaoDias[especie]);
}

/**
 * O estado reprodutivo de uma fêmea, lido do seu histórico.
 *
 * `eventos` pode vir com os eventos de qualquer animal: filtra-se aqui. Quem
 * chamar isto em ciclo deve passar já só os do animal (ver `estadosPorAnimal`),
 * que evita percorrer a lista inteira uma vez por cabeça.
 */
export function estadoReprodutivo(animal: Animal, eventos: Evento[]): EstadoReprodutivo {
  const meus = eventos
    .filter((e) => e.animalId === animal.id)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  if (!elegivelParaReproducao(animal, meus.some(eReprodutivo))) return NAO_APLICAVEL;

  const partos = meus.filter((e) => e.tipo === 'Parto');
  const ultimoParto = partos.length > 0 ? partos[partos.length - 1] : undefined;

  const intervaloMedioPartos =
    partos.length >= 2
      ? Math.round(
          partos
            .slice(1)
            .reduce((soma, p, i) => soma + diasEntre(partos[i].data, p.data), 0) /
            (partos.length - 1),
        )
      : undefined;

  const base = {
    partos: partos.length,
    intervaloMedioPartos,
    diasDesdeUltimoParto: ultimoParto ? diasDesde(ultimoParto.data) : undefined,
  };

  // O ciclo atual começa no último parto. Tudo o que é anterior pertence a um
  // ciclo já fechado e não diz nada sobre o estado de hoje.
  const inicioCiclo = ultimoParto ? new Date(ultimoParto.data).getTime() : -Infinity;
  const doCiclo = meus.filter(
    (e) =>
      (e.tipo === 'Cobrição' || e.tipo === 'Diagnóstico') &&
      new Date(e.data).getTime() > inicioCiclo,
  );

  // O último ato do ciclo manda. Em empate de data ganha a COBRIÇÃO: diagnosticar
  // e voltar a cobrir no mesmo dia acontece (deu vazia, foi ao touro), e a
  // ordem inversa — cobrir e diagnosticar no próprio dia — não existe.
  const ultimo = doCiclo.reduce<Evento | undefined>((melhor, e) => {
    if (!melhor) return e;
    const d = new Date(e.data).getTime();
    const dm = new Date(melhor.data).getTime();
    if (d > dm) return e;
    if (d === dm && e.tipo === 'Cobrição') return e;
    return melhor;
  }, undefined);

  if (!ultimo) {
    /**
     * Sem cobrição nem diagnóstico neste ciclo. Ainda pode estar gestante: há
     * quem marque a data prevista do parto à mão na ficha, sem passar pelo
     * registo do ciclo — a app fazia-o assim antes de existirem estes eventos, e
     * ignorá-lo agora tirava da lista de "prestes a parir" precisamente as vacas
     * que lá estavam ontem.
     *
     * A previsão só vale se for POSTERIOR ao último parto: uma data deixada para
     * trás é lixo de um ciclo antigo, não uma gestação.
     */
    const prev = animal.dataPrevistaParto;
    if (prev && new Date(prev).getTime() > inicioCiclo) {
      return {
        ...base,
        fase: 'gestante',
        desde: prev,
        diasNaFase: 0,
        dataPrevistaParto: prev,
        diasParaParto: diasAte(prev),
      };
    }
    return {
      ...base,
      fase: 'vazia',
      desde: ultimoParto?.data,
      diasNaFase: ultimoParto ? diasDesde(ultimoParto.data) : 0,
    };
  }

  if (ultimo.tipo === 'Cobrição') {
    return {
      ...base,
      fase: 'coberta',
      desde: ultimo.data,
      diasNaFase: diasDesde(ultimo.data),
      detalheCobricao: ultimo.detalhe,
    };
  }

  // Diagnóstico. Um sem resultado (registo antigo, ou corrigido a meio) trata-se
  // como duvidoso: repete-se. Dá-lo por vazio mandava cobrir uma vaca que pode
  // estar prenhe, e dá-lo por gestante é pior ainda.
  const resultado: ResultadoDiagnostico = ultimo.resultado ?? 'duvidoso';

  if (resultado === 'gestante') {
    // A previsão vem da cobrição que ESTE diagnóstico confirmou — a última
    // anterior a ele. Sem cobrição registada (diagnosticou-se sem ter registado
    // a cobrição), fica a data que estiver na ficha.
    const cobricao = doCiclo
      .filter((e) => e.tipo === 'Cobrição' && new Date(e.data).getTime() <= new Date(ultimo.data).getTime())
      .pop();
    const prevista =
      animal.dataPrevistaParto ??
      (cobricao ? preverParto(animal.especie, cobricao.data) : undefined);
    return {
      ...base,
      fase: 'gestante',
      desde: ultimo.data,
      diasNaFase: diasDesde(ultimo.data),
      dataPrevistaParto: prevista,
      diasParaParto: prevista ? diasAte(prevista) : undefined,
      detalheCobricao: cobricao?.detalhe,
    };
  }

  return {
    ...base,
    fase: resultado === 'vazia' ? 'vazia' : 'duvidosa',
    desde: ultimo.data,
    diasNaFase: diasDesde(ultimo.data),
  };
}

/**
 * O estado de todas as fêmeas de uma vez.
 *
 * Agrupa os eventos por animal ANTES de calcular: chamar `estadoReprodutivo`
 * numa lista de 400 cabeças filtrava a lista inteira de eventos 400 vezes, e é
 * o género de conta que só se nota quando a exploração cresce.
 */
export function estadosPorAnimal(
  animais: Animal[],
  eventos: Evento[],
): Map<string, EstadoReprodutivo> {
  const porAnimal = new Map<string, Evento[]>();
  for (const e of eventos) {
    const lista = porAnimal.get(e.animalId);
    if (lista) lista.push(e);
    else porAnimal.set(e.animalId, [e]);
  }
  const out = new Map<string, EstadoReprodutivo>();
  for (const a of animais) {
    const meus = porAnimal.get(a.id) ?? [];
    if (!elegivelParaReproducao(a, meus.some(eReprodutivo))) continue;
    out.set(a.id, estadoReprodutivo(a, meus));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 *  As três listas
 * ------------------------------------------------------------------ */

export type LinhaReproducao = { animal: Animal; estado: EstadoReprodutivo };

/** Ordena pelo que é mais urgente primeiro (menos dias a faltar / mais atraso). */
function porUrgencia(chave: (l: LinhaReproducao) => number) {
  return (a: LinhaReproducao, b: LinhaReproducao) => chave(a) - chave(b);
}

/**
 * Prestes a parir — as gestantes cuja data prevista cai dentro da janela.
 * Inclui as que já a passaram: uma previsão vencida é mais urgente, não menos.
 */
export function prestesAParir(
  animais: Animal[],
  eventos: Evento[],
  janelaDias = 30,
): LinhaReproducao[] {
  const estados = estadosPorAnimal(animais, eventos);
  return animais
    .flatMap((animal) => {
      const estado = estados.get(animal.id);
      if (!estado || estado.fase !== 'gestante') return [];
      if (estado.diasParaParto == null || estado.diasParaParto > janelaDias) return [];
      return [{ animal, estado }];
    })
    .sort(porUrgencia((l) => l.estado.diasParaParto ?? 0));
}

/**
 * À espera de diagnóstico — cobertas há tempo suficiente para valer a pena
 * diagnosticar, mais as duvidosas cuja repetição já se venceu.
 *
 * As duas entram na mesma lista porque a ação é a mesma: chamar o veterinário.
 * Separá-las dava duas listas curtas com o mesmo botão no fim.
 */
export function aguardamDiagnostico(animais: Animal[], eventos: Evento[]): LinhaReproducao[] {
  const estados = estadosPorAnimal(animais, eventos);
  return animais
    .flatMap((animal) => {
      const estado = estados.get(animal.id);
      if (!estado) return [];
      if (estado.fase === 'coberta' && estado.diasNaFase >= PrazosReproducao.diagnosticoAPartirDe) {
        return [{ animal, estado }];
      }
      if (estado.fase === 'duvidosa' && estado.diasNaFase >= PrazosReproducao.repetirDuvidosoApos) {
        return [{ animal, estado }];
      }
      return [];
    })
    // Mais dias à espera primeiro.
    .sort(porUrgencia((l) => -l.estado.diasNaFase));
}

/**
 * Sem cobrição desde o parto — vacas paridas há muito que não voltaram a ser
 * cobertas. É a lista que mede o dinheiro que se está a perder sem se ver:
 * cada dia aqui é um dia a mais no intervalo entre partos.
 *
 * Só entram as que JÁ PARIRAM. Uma novilha que nunca pariu também está vazia,
 * mas o que ela precisa é de entrar à reprodução pela primeira vez — outra
 * conversa, outra decisão, e uma lista onde ela apareça a par das vacas
 * paradas é uma lista que não se sabe ler.
 */
export function semCobricaoAposParto(animais: Animal[], eventos: Evento[]): LinhaReproducao[] {
  const estados = estadosPorAnimal(animais, eventos);
  return animais
    .flatMap((animal) => {
      const estado = estados.get(animal.id);
      if (!estado || estado.fase !== 'vazia') return [];
      const dias = estado.diasDesdeUltimoParto;
      if (dias == null || dias < PrazosReproducao.cobrirApos) return [];
      return [{ animal, estado }];
    })
    .sort(porUrgencia((l) => -(l.estado.diasDesdeUltimoParto ?? 0)));
}

/**
 * As fêmeas que estão numa destas fases, para se poderem VER.
 *
 * As três listas acima respondem a "o que é preciso fazer". Esta responde a
 * "quem são" — a pergunta que os números do resumo levantavam e não sabiam
 * responder: via-se «14 cobertas» e não havia por onde saber quais eram.
 *
 * Ordena pela mais recente primeiro: numa lista de quem foi coberta, a que
 * interessa é a última, não a mais antiga (essa já está nas de trabalho).
 */
export function porFase(
  animais: Animal[],
  eventos: Evento[],
  fases: FaseReprodutiva[],
): LinhaReproducao[] {
  const estados = estadosPorAnimal(animais, eventos);
  return animais
    .flatMap((animal) => {
      const estado = estados.get(animal.id);
      if (!estado || !fases.includes(estado.fase)) return [];
      return [{ animal, estado }];
    })
    .sort(porUrgencia((l) => l.estado.diasNaFase));
}

/* ------------------------------------------------------------------ *
 *  Quem cobriu
 * ------------------------------------------------------------------ */

/**
 * O nome escrito numa cobrição, se lá estiver.
 *
 * O `detalhe` de um evento é um punhado de pedaços colados por " · " (ver
 * `evento/novo.tsx`), e a cobrição põe lá `Touro: Marquês` ou `Sémen: Alentejano
 * 4471`. Ler o pedaço certo é o que permite oferecer amanhã o que se escreveu
 * ontem, sem guardar nada de novo na base de dados.
 */
export function nomeNaCobricao(
  evento: Evento,
  modo: 'Touro' | 'Sémen',
): string | undefined {
  const prefixo = `${modo}: `;
  const parte = (evento.detalhe ?? '')
    .split(' · ')
    .find((p) => p.startsWith(prefixo));
  return parte?.slice(prefixo.length).trim() || undefined;
}

/**
 * O que se pode escolher no campo "Touro" (ou "Sémen") de uma cobrição.
 *
 * Era um campo de texto e mais nada, com o argumento — verdadeiro — de que o
 * touro é muitas vezes emprestado, alugado ou uma palheta de sémen, e portanto
 * não está no efetivo. O que esse argumento não justificava era obrigar a
 * ESCREVER o nome do próprio semental, à mão, de cada vez, a quem o tem no
 * curral: são vinte cobrições por época com o mesmo nome, e basta um "Marques"
 * sem acento para o histórico passar a ter dois touros onde há um.
 *
 * Por isso: sugestões, não uma lista fechada. Entram
 *   1. os machos adultos do efetivo desta exploração (sementais à frente);
 *   2. os nomes já escritos em cobrições anteriores — que é o que apanha o
 *      touro do vizinho e a palheta que se costuma comprar.
 * E o campo de texto fica, para o que não está em nenhuma das duas.
 */
export function sugestoesDeCobricao(
  animais: Animal[],
  eventos: Evento[],
  exploracaoId: string | undefined,
  modo: 'Touro' | 'Sémen',
  limite = 12,
): string[] {
  const out: string[] = [];
  /** Para não repetir "Marquês" e "marquês" como se fossem dois. */
  const vistos = new Set<string>();
  const juntar = (nome: string | undefined) => {
    const limpo = nome?.trim();
    if (!limpo) return;
    const chave = limpo.toLocaleLowerCase('pt');
    if (vistos.has(chave)) return;
    vistos.add(chave);
    out.push(limpo);
  };

  // 1. Os machos da casa. Só no modo "Touro": numa inseminação o que se escreve
  // é a palheta, e um macho do curral ali é uma sugestão errada.
  if (modo === 'Touro') {
    const machos = animais.filter(
      (a) =>
        a.sexo === 'Macho'
        && (!a.estado || a.estado === 'ativo')
        && (!exploracaoId || a.exploracaoId === exploracaoId)
        && idadeDias(a.dataNascimento) >= PrazosReproducao.idadeMinMachoMeses * 30.44,
    );
    // Os sementais primeiro: num efetivo com trinta machos de engorda e dois
    // reprodutores, são os dois que se procuram.
    const sementais = machos.filter((a) => a.finalidade === 'Semental');
    const outros = machos.filter((a) => a.finalidade !== 'Semental');
    for (const a of [...sementais, ...outros]) juntar(a.nome ?? a.numeroIdentificacao);
  }

  // 2. O que já se escreveu antes, do mais recente para o mais antigo.
  const anteriores = eventos
    .filter((e) => e.tipo === 'Cobrição')
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  for (const e of anteriores) juntar(nomeNaCobricao(e, modo));

  return out.slice(0, limite);
}

/* ------------------------------------------------------------------ *
 *  Números do efetivo
 * ------------------------------------------------------------------ */

export type ResumoReproducao = {
  /** Fêmeas em idade reprodutiva. */
  elegiveis: number;
  gestantes: number;
  cobertas: number;
  duvidosas: number;
  vazias: number;
  /**
   * Fêmeas gestantes sobre as elegíveis, em percentagem. É a leitura mais
   * simples de "como vai a reprodução" — e a que dá para comparar de mês para
   * mês sem precisar de contabilidade nenhuma.
   */
  taxaGestacao: number;
  /**
   * Média dos intervalos entre partos das fêmeas que já pariram duas vezes.
   * Ausente enquanto não houver nenhuma — e é honesto que fique ausente: com um
   * ano de registos ainda não há dois partos em quase ninguém.
   */
  intervaloMedioPartos?: number;
};

export function resumoReproducao(animais: Animal[], eventos: Evento[]): ResumoReproducao {
  const estados = estadosPorAnimal(animais, eventos);
  let gestantes = 0;
  let cobertas = 0;
  let duvidosas = 0;
  let vazias = 0;
  const intervalos: number[] = [];

  for (const estado of estados.values()) {
    if (estado.fase === 'gestante') gestantes++;
    else if (estado.fase === 'coberta') cobertas++;
    else if (estado.fase === 'duvidosa') duvidosas++;
    else if (estado.fase === 'vazia') vazias++;
    if (estado.intervaloMedioPartos != null) intervalos.push(estado.intervaloMedioPartos);
  }

  const elegiveis = estados.size;
  return {
    elegiveis,
    gestantes,
    cobertas,
    duvidosas,
    vazias,
    taxaGestacao: elegiveis === 0 ? 0 : Math.round((gestantes / elegiveis) * 100),
    intervaloMedioPartos:
      intervalos.length === 0
        ? undefined
        : Math.round(intervalos.reduce((s, n) => s + n, 0) / intervalos.length),
  };
}

/** Como se lê a fase, para a app a mostrar. */
/**
 * O nome e a explicação de cada fase.
 *
 * FUNÇÃO e não tabela de módulo: os textos passam pelo `t()`, e um `Record`
 * resolvido no import ficava congelado na língua de arranque (a mesma armadilha
 * das cores, ver AGENTS.md). Quem desenha é que traduz.
 */
export function faseMeta(fase: FaseReprodutiva): { label: string; explicacao: string } {
  const chaves: Record<FaseReprodutiva, [ChaveTexto, ChaveTexto]> = {
    gestante: ['fase.gestante', 'fase.gestanteExplicacao'],
    coberta: ['fase.coberta', 'fase.cobertaExplicacao'],
    duvidosa: ['fase.duvidosa', 'fase.duvidosaExplicacao'],
    vazia: ['fase.vazia', 'fase.vaziaExplicacao'],
    'nao-aplicavel': ['fase.naoAplicavel', 'fase.naoAplicavelExplicacao'],
  };
  const [label, explicacao] = chaves[fase];
  return { label: t(label), explicacao: t(explicacao) };
}
