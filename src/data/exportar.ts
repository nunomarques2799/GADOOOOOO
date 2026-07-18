/**
 * Exportação de dados — CSV (animais/eventos) e relatório imprimível (prazos).
 * ------------------------------------------------------------------
 * Alvo principal: a app desktop (Electron) e a web, onde há descarregamento de
 * ficheiros e impressão para PDF. No nativo, o CSV é partilhado (Share) e o
 * relatório imprimível não está disponível. Tudo funciona offline (dados já
 * em memória) — não é preciso rede.
 */

import { Platform, Share } from 'react-native';

import type { Lancamento } from './financas';
import { formatDataPt } from './helpers';
import type { Alerta, Animal, Evento, Exploracao, Terreno } from './types';

/* ---------- Primitivas ---------- */

/** Escapa um valor para CSV (aspas, separador, quebras de linha). */
function celula(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Constrói um CSV. Usa ';' como separador (o Excel em PT usa a vírgula como
 * separador decimal) e um BOM à frente para os acentos abrirem corretos.
 */
export function construirCSV(cabecalhos: string[], linhas: unknown[][]): string {
  const sep = ';';
  const head = cabecalhos.map(celula).join(sep);
  const corpo = linhas.map((l) => l.map(celula).join(sep)).join('\r\n');
  return `﻿${head}\r\n${corpo}`;
}

/** Data de hoje no formato aaaa-mm-dd, para nomes de ficheiro. */
export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Descarrega (web/Electron) ou partilha (nativo) um ficheiro de texto. */
export async function guardarFicheiro(
  nomeFicheiro: string,
  conteudo: string,
  mime = 'text/csv',
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

/* ---------- CSV específicos do domínio ---------- */

export function csvAnimais(
  animais: Animal[],
  exploracoes: Exploracao[],
  terrenos: Terreno[],
): string {
  const nomeExp = new Map(exploracoes.map((e) => [e.id, e.nome]));
  const nomeTer = new Map(terrenos.map((t) => [t.id, t.nome]));
  const cabecalhos = [
    'Nome', 'Espécie', 'Sexo', 'Data nascimento', 'Nº brinco (SIA)', 'Raça',
    'Cor pelagem', 'Exploração', 'Terreno', 'Comunicado SNIRA',
  ];
  const linhas = [...animais]
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))
    .map((a) => [
      a.nome ?? '',
      a.especie,
      a.sexo,
      a.dataNascimento ? formatDataPt(a.dataNascimento) : '',
      a.numeroIdentificacao ?? '',
      a.raca ?? '',
      a.corPelagem ?? '',
      nomeExp.get(a.exploracaoId) ?? '',
      a.terrenoId ? nomeTer.get(a.terrenoId) ?? '' : '',
      a.comunicadoSnira == null ? '' : a.comunicadoSnira ? 'Sim' : 'Não',
    ]);
  return construirCSV(cabecalhos, linhas);
}

export function csvEventos(eventos: Evento[], animais: Animal[]): string {
  const rotulo = new Map(
    animais.map((a) => [a.id, a.nome ?? a.numeroIdentificacao ?? a.id]),
  );
  const cabecalhos = ['Animal', 'Tipo', 'Data', 'Descrição', 'Detalhe'];
  const linhas = [...eventos]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .map((e) => [
      rotulo.get(e.animalId) ?? '',
      e.tipo,
      formatDataPt(e.data),
      e.descricao,
      e.detalhe ?? '',
    ]);
  return construirCSV(cabecalhos, linhas);
}

/**
 * CSV das movimentações financeiras. Recebe lançamentos já normalizados (ver
 * `financas.ts`), o que faz com que as despesas da exploração — ração, energia,
 * rendas — saiam no ficheiro a par das que estão ligadas a um animal.
 */
export function csvFinancas(lancamentos: Lancamento[], animais: Animal[]): string {
  const rotulo = new Map(
    animais.map((a) => [a.id, a.nome ?? a.numeroIdentificacao ?? a.id]),
  );
  const cabecalhos = ['Data', 'Categoria', 'Movimento', 'Animal', 'Valor (€)', 'Descrição'];
  const linhas = [...lancamentos]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .map((l) => [
      formatDataPt(l.data),
      l.categoria,
      l.direcao === 'receita' ? 'Receita' : 'Despesa',
      l.animalId ? rotulo.get(l.animalId) ?? '' : '',
      // Valor com vírgula decimal (Excel PT) e sinal negativo nas despesas.
      `${l.direcao === 'receita' ? '' : '-'}${l.valor.toFixed(2).replace('.', ',')}`,
      l.descricao,
    ]);
  return construirCSV(cabecalhos, linhas);
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

/** Gera o HTML do relatório de prazos legais/sanitários. */
export function htmlRelatorioPrazos(alertas: Alerta[], nomeExploracao?: string): string {
  const dataHoje = formatDataPt(new Date().toISOString());
  const urgentes = alertas.filter((a) => a.gravidade === 'urgente').length;
  const avisos = alertas.filter((a) => a.gravidade === 'aviso').length;

  const linhas = alertas
    .map((a) => {
      const cor = CoresGravidade[a.gravidade];
      const prazo =
        a.diasRestantes == null
          ? '—'
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

  const vazio = `<tr><td colspan="3" class="vazio">Não há prazos pendentes. Tudo em dia.</td></tr>`;

  return `
    <header>
      <div class="marca">
        <span class="logo">GG</span>
        <div>
          <h1>Relatório de prazos</h1>
          <p>${nomeExploracao ? escaparHtml(nomeExploracao) + ' · ' : ''}${dataHoje}</p>
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
    <footer>Gerado pela app Gestão de Gado · ${dataHoje}. Documento informativo — confirme sempre os prazos oficiais (DGAV/IFAP/SNIRA).</footer>
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
