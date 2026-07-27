/**
 * Exportação de dados — as tabelas que saem em Excel e o relatório de prazos.
 * ------------------------------------------------------------------
 * Alvo principal: a app desktop (Electron) e a web, onde há descarregamento de
 * ficheiros e impressão para PDF. No telemóvel não há disco onde escrever um
 * `.xlsx`, por isso a exportação é do computador. Tudo funciona offline (dados
 * já em memória) — não é preciso rede.
 *
 * Aqui vive só a parte PURA (o que vai em cada coluna, que prazos entram no
 * relatório); escrever o ficheiro é do `excelFicheiro.ts`.
 *
 * Não há exportação em CSV: o mesmo ficheiro abria em colunas num computador e
 * numa coluna só noutro, conforme a configuração regional de quem o abria.
 */

import { Platform, Share } from 'react-native';

import type { Tabela } from './excelFicheiro';
import type { Lancamento } from './financas';
import { diaIso, formatDataCurta, formatDataPt } from './helpers';
import type { Alerta, AlertaGravidade, Animal, Evento } from './types';

/* ---------- Primitivas ---------- */

/**
 * Data de hoje no formato aaaa-mm-dd, para nomes de ficheiro. Dia local, pela
 * mesma razão que em `diaIso`: exportar às 00:30 de verão datava o ficheiro de
 * ontem, e quem exporta duas vezes na mesma noite fica com dois nomes que
 * mentem sobre o que têm dentro.
 */
export function hojeISO(): string {
  return diaIso(new Date());
}

/** Descarrega (web/Electron) ou partilha (nativo) um ficheiro de texto. */
export async function guardarFicheiro(
  nomeFicheiro: string,
  conteudo: string,
  mime = 'text/plain',
): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([conteudo], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeFicheiro;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ message: conteudo });
}

/* ---------- Tabelas Excel específicas do domínio ---------- */

/** Como referir um animal numa folha: nome, senão brinco. */
function rotulosDeAnimais(animais: Animal[]): Map<string, string> {
  return new Map(animais.map((a) => [a.id, a.nome ?? a.numeroIdentificacao ?? a.id]));
}

/** A tabela dos eventos, do mais recente para o mais antigo. */
export function tabelaEventos(eventos: Evento[], animais: Animal[]): Tabela {
  const rotulo = rotulosDeAnimais(animais);
  return {
    cabecalhos: ['Animal', 'Tipo', 'Data', 'Descrição', 'Detalhe'],
    linhas: [...eventos]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .map((e) => [
        rotulo.get(e.animalId) ?? '',
        e.tipo,
        formatDataCurta(e.data),
        e.descricao,
        e.detalhe ?? '',
      ]),
  };
}

/**
 * A tabela das movimentações financeiras. Recebe lançamentos já normalizados
 * (ver `financas.ts`), o que faz com que as despesas da exploração — ração,
 * energia, rendas — saiam no ficheiro a par das que estão ligadas a um animal.
 *
 * O valor vai como NÚMERO, não como texto: num `.xlsx` o Excel soma a coluna
 * sem lhe pedir nada, e o sinal negativo distingue a despesa da receita.
 */
export function tabelaFinancas(lancamentos: Lancamento[], animais: Animal[]): Tabela {
  const rotulo = rotulosDeAnimais(animais);
  return {
    cabecalhos: ['Data', 'Categoria', 'Movimento', 'Animal', 'Valor (€)', 'Descrição'],
    linhas: [...lancamentos]
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .map((l) => [
        formatDataCurta(l.data),
        l.categoria,
        l.direcao === 'receita' ? 'Receita' : 'Despesa',
        l.animalId ? (rotulo.get(l.animalId) ?? '') : '',
        l.direcao === 'receita' ? l.valor : -l.valor,
        l.descricao,
      ]),
  };
}

/* ---------- Que prazos entram no relatório ---------- */

/**
 * Janela de tempo do relatório. `'atraso'` são só os que já passaram do prazo;
 * os números são "daqui a até N dias" (contando o que está em atraso, que
 * também é para tratar).
 */
export type JanelaPrazo = 'todos' | 'atraso' | 7 | 30;

/**
 * O que escolher antes de imprimir o relatório de prazos. Listas vazias querem
 * dizer "não filtrar" — é o estado com que a janela abre, e o mais parecido com
 * o que a app fazia antes (imprimia tudo).
 */
export type FiltroPrazos = {
  exploracaoId?: string;
  gravidades: AlertaGravidade[];
  categorias: Alerta['categoria'][];
  janela: JanelaPrazo;
};

export const FILTRO_PRAZOS_TUDO: FiltroPrazos = {
  gravidades: [],
  categorias: [],
  janela: 'todos',
};

export const ROTULO_GRAVIDADE: Record<AlertaGravidade, string> = {
  urgente: 'Urgentes',
  aviso: 'Esta semana',
  info: 'A acompanhar',
};

export const ROTULO_CATEGORIA: Record<Alerta['categoria'], string> = {
  snira: 'SNIRA',
  identificacao: 'Identificação',
  parto: 'Partos',
  medicamento: 'Medicamentos',
  vacinacao: 'Vacinação',
};

/**
 * Aplica os filtros escolhidos. A janela de dias só olha para alertas COM prazo
 * a correr: "sem registo de vacinação" não tem contagem decrescente (ver o
 * `diasRestantes` em `types.ts`) e entrar num relatório de "próximos 7 dias"
 * seria dizer que há um prazo onde não há.
 */
export function filtrarAlertas(alertas: Alerta[], filtro: FiltroPrazos): Alerta[] {
  const { exploracaoId, gravidades, categorias, janela } = filtro;
  return alertas.filter((a) => {
    if (exploracaoId && a.exploracaoId !== exploracaoId) return false;
    if (gravidades.length > 0 && !gravidades.includes(a.gravidade)) return false;
    if (categorias.length > 0 && !categorias.includes(a.categoria)) return false;
    if (janela === 'todos') return true;
    if (a.diasRestantes == null) return false;
    if (janela === 'atraso') return a.diasRestantes < 0;
    return a.diasRestantes <= janela;
  });
}

/** true se o filtro deixa alguma coisa de fora (ou seja, se não é "tudo"). */
export function filtroEstreita(f: FiltroPrazos): boolean {
  return (
    f.janela !== 'todos'
    || f.gravidades.length > 0
    || f.categorias.length > 0
    || f.exploracaoId != null
  );
}

/** Como se lê a janela escolhida, para o cabeçalho do relatório e para a app. */
export function rotuloJanela(janela: JanelaPrazo): string {
  if (janela === 'todos') return 'Todos os prazos';
  if (janela === 'atraso') return 'Só o que está em atraso';
  return `Próximos ${janela} dias`;
}

/**
 * Uma linha a dizer o que o relatório traz. Vai impressa no PDF: uma folha que
 * mostra 4 prazos quando a exploração tem 30 tem de dizer que foi filtrada, ou
 * passa por um retrato completo do que está pendente.
 */
export function descricaoFiltroPrazos(filtro: FiltroPrazos): string {
  const partes = [rotuloJanela(filtro.janela)];
  if (filtro.gravidades.length > 0)
    partes.push(filtro.gravidades.map((g) => ROTULO_GRAVIDADE[g]).join(', '));
  if (filtro.categorias.length > 0)
    partes.push(filtro.categorias.map((c) => ROTULO_CATEGORIA[c]).join(', '));
  return partes.join(' · ');
}

/* ---------- Relatório imprimível de prazos (→ PDF via impressão) ---------- */

const CoresGravidade: Record<Alerta['gravidade'], string> = {
  urgente: '#d45b3b',
  aviso: '#e39a2e',
  info: '#3b82c4',
};

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Gera o HTML do relatório de prazos legais/sanitários. `filtro` é o que se
 * escolheu na app — sai impresso, para a folha dizer o que mostra.
 */
export function htmlRelatorioPrazos(
  alertas: Alerta[],
  { nomeExploracao, filtro }: { nomeExploracao?: string; filtro?: FiltroPrazos } = {},
): string {
  const dataHoje = formatDataPt(new Date().toISOString());
  const urgentes = alertas.filter((a) => a.gravidade === 'urgente').length;
  const avisos = alertas.filter((a) => a.gravidade === 'aviso').length;

  const linhas = alertas
    .map((a) => {
      const cor = CoresGravidade[a.gravidade];
      const prazo =
        a.diasRestantes == null
          ? 'Sem prazo'
          : a.diasRestantes < 0
            ? `Em atraso (${Math.abs(a.diasRestantes)}d)`
            : a.diasRestantes === 0
              ? 'Hoje'
              : `${a.diasRestantes} dia(s)`;
      return `<tr>
        <td><span class="dot" style="background:${cor}"></span>${escaparHtml(a.titulo)}</td>
        <td>${escaparHtml(a.descricao)}</td>
        <td class="prazo">${escaparHtml(prazo)}</td>
      </tr>`;
    })
    .join('');

  const vazio = `<tr><td colspan="3" class="vazio">${
    filtro && filtroEstreita(filtro)
      ? 'Nenhum prazo corresponde ao que escolheu.'
      : 'Não há prazos pendentes. Tudo em dia.'
  }</td></tr>`;

  const filtrado = filtro ? escaparHtml(descricaoFiltroPrazos(filtro)) : '';

  return `
    <header>
      <div class="marca">
        <!-- As iniciais da app, que se chama Terrabovina. Ficou "GG" (de
             "Gestão de Gado") na folha impressa depois de a app mudar de nome:
             o rodapé já dizia Terrabovina e o cabeçalho continuava a assinar
             com o nome antigo, na única coisa que sai da app em papel. -->
        <span class="logo">TB</span>
        <div>
          <h1>Relatório de prazos</h1>
          <p>${nomeExploracao ? escaparHtml(nomeExploracao) + ' · ' : ''}${dataHoje}</p>
          ${filtrado ? `<p class="filtro">${filtrado}</p>` : ''}
        </div>
      </div>
      <div class="resumo">
        <span class="pill urg">${urgentes} urgente(s)</span>
        <span class="pill avi">${avisos} a avisar</span>
        <span class="pill tot">${alertas.length} no total</span>
      </div>
    </header>
    <table>
      <thead><tr><th>Alerta</th><th>Descrição</th><th>Prazo</th></tr></thead>
      <tbody>${alertas.length ? linhas : vazio}</tbody>
    </table>
    <footer>Gerado pela app Terrabovina · ${dataHoje}. Documento informativo: confirme sempre os prazos oficiais (DGAV/IFAP/SNIRA).</footer>
  `;
}

/**
 * Abre um relatório imprimível numa nova janela (o utilizador escolhe
 * "Guardar como PDF" no diálogo de impressão). Só web/Electron; devolve false
 * no nativo para quem chama poder mostrar uma alternativa.
 */
export function imprimirRelatorio(titulo: string, corpoHtml: string): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.write(documentoRelatorio(titulo, corpoHtml, { comBotaoImprimir: true }));
  win.document.close();
  return true;
}

/**
 * Ponte para o PDF do Electron (ver desktop/preload.js). Só existe na app de
 * computador; no browser e no telemóvel é undefined.
 */
type PonteRelatorio = {
  guardarPdf: (html: string, nomeSugerido: string) => Promise<string>;
};

function ponteRelatorio(): PonteRelatorio | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { gadoRelatorio?: PonteRelatorio }).gadoRelatorio;
}

/** Resultado de guardar um relatório, para quem chama poder informar o utilizador. */
export type ResultadoGuardar =
  | { estado: 'guardado' }
  | { estado: 'cancelado' }
  | { estado: 'html' } // sem Electron: descarregou a página em vez do PDF
  | { estado: 'indisponivel' } // nativo: não há descarregamento de ficheiros
  | { estado: 'erro'; motivo: string };

/**
 * Guarda o relatório como ficheiro. Na app de computador gera um PDF verdadeiro
 * (Chromium printToPDF, com diálogo "Guardar como"); no browser não há acesso ao
 * disco, por isso descarrega o mesmo relatório em HTML — abre em qualquer lado e
 * imprime para PDF a partir daí.
 */
export async function guardarRelatorio(
  titulo: string,
  corpoHtml: string,
  nomeBase: string,
): Promise<ResultadoGuardar> {
  const html = documentoRelatorio(titulo, corpoHtml, { comBotaoImprimir: false });

  const ponte = ponteRelatorio();
  if (ponte) {
    const r = await ponte.guardarPdf(html, `${nomeBase}.pdf`);
    if (r === 'guardado') return { estado: 'guardado' };
    if (r === 'cancelado') return { estado: 'cancelado' };
    return { estado: 'erro', motivo: r.replace(/^erro:\s*/, '') };
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    await guardarFicheiro(`${nomeBase}.html`, html, 'text/html');
    return { estado: 'html' };
  }
  return { estado: 'indisponivel' };
}

/** Documento HTML completo do relatório — partilhado pela impressão e pelo PDF. */
function documentoRelatorio(
  titulo: string,
  corpoHtml: string,
  { comBotaoImprimir }: { comBotaoImprimir: boolean },
): string {
  // O botão e o auto-print só fazem sentido na janela de impressão; no PDF
  // seriam um botão morto desenhado no ficheiro.
  const botao = comBotaoImprimir
    ? '<button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>'
    : '';
  const autoPrint = comBotaoImprimir
    ? "<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });<\/script>"
    : '';

  return `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8" />
<title>${escaparHtml(titulo)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, "Segoe UI", sans-serif; color: #15251c; margin: 32px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #166b3d; padding-bottom: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .marca { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 12px; background: #166b3d; color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  h1 { font-size: 22px; margin: 0; }
  header p { margin: 2px 0 0; color: #54655b; font-size: 13px; }
  header p.filtro { color: #869184; font-size: 12px; font-style: italic; }
  .resumo { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 999px; }
  .pill.urg { background: #fbe7e0; color: #d45b3b; }
  .pill.avi { background: #fbf0dc; color: #b8760f; }
  .pill.tot { background: #eef8f1; color: #166b3d; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #54655b; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 8px; border-bottom: 1.5px solid #e3eae0; }
  td { padding: 10px 8px; border-bottom: 1px solid #eef2ec; vertical-align: top; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; margin-right: 7px; }
  .prazo { white-space: nowrap; font-weight: 700; }
  .vazio { text-align: center; color: #54655b; padding: 24px; }
  footer { margin-top: 24px; color: #869184; font-size: 11px; border-top: 1px solid #e3eae0; padding-top: 12px; }
  .btn-print { margin: 0 0 20px; padding: 10px 16px; font-size: 14px; font-weight: 700; color: #fff; background: #1b7a48; border: none; border-radius: 10px; cursor: pointer; }
  @media print { .btn-print { display: none; } body { margin: 0; } }
</style></head>
<body>
${botao}
${corpoHtml}
${autoPrint}
</body></html>`;
}
