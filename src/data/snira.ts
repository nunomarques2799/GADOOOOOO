/**
 * SNIRA — o que falta comunicar, e em quantos dias.
 * ------------------------------------------------------------------
 * Lógica pura, sem React e sem rede, para poder ser testada.
 *
 * O QUE ISTO É E O QUE NÃO É
 *
 * Não é uma ligação ao iDigital. A app não submete nada em nome de ninguém: o
 * criador continua a entrar no portal e a escrever lá. O que isto faz é
 * responder à pergunta que ele faz antes de entrar — "o que é que me falta
 * comunicar?" — com a lista pronta, os prazos contados, e os dados na ordem em
 * que o formulário do portal os pede.
 *
 * É a diferença entre um alerta a dizer "comunique o nascimento da Mimosa em 3
 * dias" e uma folha com as dezassete linhas que faltam esta semana, cada uma
 * com o brinco, a data e a marca de exploração ao lado.
 *
 * O QUE A LEI MANDA COMUNICAR (e em quanto tempo)
 *
 *   nascimento .. 7 dias depois da identificação (o brinco, que por sua vez tem
 *                 20 dias desde o nascimento — esse prazo é outro alerta)
 *   morte ....... 7 dias
 *   saída ....... 7 dias (venda, ida para matadouro)
 *   entrada ..... 7 dias (compra)
 *   movimentação. 7 dias (mudança de exploração)
 *
 * Os prazos vivem em `constants.ts` (`PrazosLegais`) e não aqui: são os mesmos
 * que os alertas usam, e duas cópias divergiriam no dia em que a lei mudasse.
 *
 * DE ONDE VEM CADA PENDÊNCIA
 *
 * O nascimento está no ANIMAL (`comunicadoSnira`), onde sempre esteve. As
 * outras quatro estão nos EVENTOS (`evento.comunicadoSnira`), porque é o evento
 * que representa o facto: um animal vendido tem um evento de Venda, e é essa
 * venda que se comunica. Ver `supabase/schema_snira.sql`.
 */

import { PrazosLegais } from './constants';
import { diaIso, diasAte, isoMaisDias } from './helpers';
import type { Animal, Evento, Exploracao } from './types';

/** O que se está a comunicar. */
export type TipoComunicacao = 'nascimento' | 'morte' | 'saida' | 'entrada' | 'movimentacao';

export const rotuloComunicacao: Record<TipoComunicacao, string> = {
  nascimento: 'Nascimento',
  morte: 'Morte',
  saida: 'Saída',
  entrada: 'Entrada',
  movimentacao: 'Movimentação',
};

/**
 * Os tipos de evento que se comunicam, e o que cada um é para o SNIRA. É esta
 * tabela que decide o que a app marca como "por comunicar" ao gravar um evento
 * — ver `comunicavel()`.
 */
const EVENTO_COMUNICAVEL: Partial<Record<Evento['tipo'], TipoComunicacao>> = {
  Morte: 'morte',
  Venda: 'saida',
  Compra: 'entrada',
  Movimentação: 'movimentacao',
};

/**
 * Este tipo de evento tem de ser comunicado? Usado no formulário, para nascer
 * já marcado como pendente em vez de o criador ter de se lembrar.
 */
export function comunicavel(tipo: Evento['tipo']): boolean {
  return EVENTO_COMUNICAVEL[tipo] !== undefined;
}

export type Pendencia = {
  /** Estável entre renders: é a chave das listas e das seleções. */
  id: string;
  tipo: TipoComunicacao;
  animalId: string;
  exploracaoId: string;
  /**
   * O evento a marcar quando isto for comunicado. Ausente no nascimento — aí o
   * que se marca é o animal.
   */
  eventoId?: string;
  /** O dia do facto (ISO). */
  data: string;
  /** O último dia para comunicar (ISO). */
  prazo: string;
  /** Negativo = já passou. */
  diasRestantes: number;
  /** Como se chama o animal na app. */
  rotulo: string;
  brinco?: string;
  /** Contexto que o portal pede a par do animal. */
  detalhe?: string;
};

/**
 * Tudo o que está por comunicar, do mais atrasado para o menos.
 *
 * Animais eliminados ficam de fora: o registo foi tirado da lista por engano ou
 * por duplicado (ver `EstadoAnimal`), e mandar comunicar ao Estado um animal que
 * o criador disse não existir é o oposto do que a app deve fazer. Os falecidos e
 * os vendidos ENTRAM — é justamente a morte e a venda que há a comunicar.
 */
export function comunicacoesPendentes(animais: Animal[], eventos: Evento[]): Pendencia[] {
  const porId = new Map(animais.map((a) => [a.id, a]));
  const out: Pendencia[] = [];

  const rotuloDe = (a: Animal) => a.nome ?? a.numeroIdentificacao ?? 'Sem nome';

  for (const a of animais) {
    if (a.estado === 'eliminado') continue;
    // O nascimento só se comunica depois de o animal estar identificado: é o
    // número do brinco que se comunica. Sem brinco, o que falta é o brinco — e
    // disso trata o alerta de identificação.
    if (a.dataIdentificacao && a.comunicadoSnira === false) {
      const prazo = isoMaisDias(a.dataIdentificacao, PrazosLegais.snira);
      out.push({
        id: `nasc-${a.id}`,
        tipo: 'nascimento',
        animalId: a.id,
        exploracaoId: a.exploracaoId,
        data: a.dataIdentificacao,
        prazo,
        diasRestantes: diasAte(prazo),
        rotulo: rotuloDe(a),
        brinco: a.numeroIdentificacao,
        detalhe: `Nascido a ${diaIso(a.dataNascimento)}`,
      });
    }
  }

  for (const e of eventos) {
    if (e.comunicadoSnira !== false) continue;
    const tipo = EVENTO_COMUNICAVEL[e.tipo];
    if (!tipo) continue;
    const a = porId.get(e.animalId);
    // Sem o animal na lista (a RLS não o deu, ou foi mesmo apagado) não há o que
    // comunicar nem como o identificar. Uma linha sem brinco não serve de nada
    // no portal.
    if (!a || a.estado === 'eliminado') continue;

    const dias = tipo === 'morte' ? PrazosLegais.morte : PrazosLegais.movimentacao;
    const prazo = isoMaisDias(e.data, dias);
    out.push({
      id: `ev-${e.id}`,
      tipo,
      animalId: a.id,
      exploracaoId: a.exploracaoId,
      eventoId: e.id,
      data: e.data,
      prazo,
      diasRestantes: diasAte(prazo),
      rotulo: rotuloDe(a),
      brinco: a.numeroIdentificacao,
      detalhe: e.detalhe ?? e.descricao,
    });
  }

  return out.sort((x, y) => x.diasRestantes - y.diasRestantes);
}

/** Só as de uma exploração (a app trabalha uma de cada vez neste ecrã). */
export function pendentesDaExploracao(
  pendentes: Pendencia[],
  exploracaoId?: string,
): Pendencia[] {
  return exploracaoId ? pendentes.filter((p) => p.exploracaoId === exploracaoId) : pendentes;
}

export type ResumoSnira = {
  total: number;
  /** Prazo já vencido. */
  emAtraso: number;
  /** Faltam três dias ou menos. */
  urgentes: number;
};

export function resumoSnira(pendentes: Pendencia[]): ResumoSnira {
  return {
    total: pendentes.length,
    emAtraso: pendentes.filter((p) => p.diasRestantes < 0).length,
    urgentes: pendentes.filter((p) => p.diasRestantes >= 0 && p.diasRestantes <= 3).length,
  };
}

/**
 * A folha que se leva para o iDigital.
 *
 * As colunas estão pela ordem em que o portal as pede — animal, tipo, data,
 * marca de exploração — para se ir copiando de cima para baixo sem andar a
 * saltar de coluna. É por isso que a marca de exploração se repete em todas as
 * linhas em vez de ir no cabeçalho: quem preenche o formulário precisa dela em
 * cada linha, não uma vez no topo da folha.
 */
export function tabelaSnira(
  pendentes: Pendencia[],
  exploracoes: Exploracao[],
): { cabecalhos: string[]; linhas: (string | number)[][] } {
  const marca = new Map(exploracoes.map((e) => [e.id, e.marcaExploracao]));
  return {
    cabecalhos: [
      'Brinco',
      'Animal',
      'A comunicar',
      'Data do facto',
      'Prazo',
      'Dias restantes',
      'Marca de exploração',
      'Observações',
    ],
    linhas: pendentes.map((p) => [
      p.brinco ?? '',
      p.rotulo,
      rotuloComunicacao[p.tipo],
      diaIso(p.data),
      diaIso(p.prazo),
      p.diasRestantes,
      marca.get(p.exploracaoId) ?? '',
      p.detalhe ?? '',
    ]),
  };
}

/**
 * A mesma folha, para imprimir — com uma coluna de quadradinhos para riscar à
 * medida que se vai comunicando.
 *
 * Papel, em 2026, e de propósito: quem trata disto muitas vezes tem o portal
 * aberto num ecrã só, e alternar entre o formulário e a app a cada linha é como
 * se perde o sítio. A folha ao lado do teclado resolve isso melhor do que
 * qualquer coisa que se pusesse dentro da app.
 */
export function htmlRelatorioSnira(pendentes: Pendencia[], exploracoes: Exploracao[]): string {
  const marca = new Map(exploracoes.map((e) => [e.id, e.marcaExploracao]));
  const resumo = resumoSnira(pendentes);
  const hoje = new Date();
  const dataHoje = `${hoje.getDate()}/${hoje.getMonth() + 1}/${hoje.getFullYear()}`;

  const escapar = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const linhas = pendentes
    .map((p) => {
      const cor = p.diasRestantes < 0 ? '#d45b3b' : p.diasRestantes <= 3 ? '#e39a2e' : '#3b82c4';
      const prazo =
        p.diasRestantes < 0
          ? `Em atraso (${Math.abs(p.diasRestantes)}d)`
          : p.diasRestantes === 0
            ? 'Hoje'
            : `${p.diasRestantes} dia(s)`;
      return `<tr>
        <td class="check"></td>
        <td class="brinco">${escapar(p.brinco ?? '-')}</td>
        <td>${escapar(p.rotulo)}</td>
        <td><span class="dot" style="background:${cor}"></span>${escapar(rotuloComunicacao[p.tipo])}</td>
        <td>${escapar(diaIso(p.data))}</td>
        <td>${escapar(diaIso(p.prazo))}</td>
        <td class="prazo">${escapar(prazo)}</td>
        <td>${escapar(marca.get(p.exploracaoId) ?? '')}</td>
      </tr>`;
    })
    .join('');

  const vazio = `<tr><td colspan="8" class="vazio">Não há nada por comunicar.</td></tr>`;

  return `
    <header>
      <div class="marca">
        <span class="logo">TB</span>
        <div>
          <h1>Comunicações ao SNIRA</h1>
          <p>${dataHoje} · lista do que falta comunicar no iDigital</p>
        </div>
      </div>
      <div class="resumo">
        <span class="pill urg">${resumo.emAtraso} em atraso</span>
        <span class="pill avi">${resumo.urgentes} até 3 dias</span>
        <span class="pill tot">${resumo.total} no total</span>
      </div>
    </header>
    <table>
      <thead><tr>
        <th></th><th>Brinco</th><th>Animal</th><th>A comunicar</th>
        <th>Data</th><th>Prazo</th><th>Falta</th><th>Marca expl.</th>
      </tr></thead>
      <tbody>${pendentes.length ? linhas : vazio}</tbody>
    </table>
    <style>
      .check { width: 22px; }
      .check::before { content: ''; display: block; width: 14px; height: 14px; border: 1.5px solid #869184; border-radius: 3px; }
      .brinco { font-family: ui-monospace, "Courier New", monospace; font-weight: 700; white-space: nowrap; }
    </style>
    <footer>Gerado pela app Terrabovina · ${dataHoje}. A app não comunica ao SNIRA: esta folha serve para preencher o iDigital. Confirme sempre os prazos oficiais (DGAV/IFAP).</footer>
  `;
}
