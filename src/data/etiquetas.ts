/**
 * Imprimir as etiquetas dos frascos.
 * ------------------------------------------------------------------
 * Só web e Windows, como as folhas de Excel (`excelFicheiro.ts`) e pela mesma
 * razão prática: uma impressora está ligada a um computador, não ao telemóvel
 * que anda no bolso pela vacada. Quem chama tem de olhar para o
 * `etiquetasImprimiveis` antes de mostrar o botão.
 *
 * PORQUE ABRE UMA JANELA E NÃO IMPRIME A PÁGINA
 *
 * Um `window.print()` na própria app imprimia a app: barras, menus, cores de
 * fundo. Uma janela nova com uma página feita para papel dá controlo sobre o
 * tamanho de cada etiqueta em MILÍMETROS, que é a única medida que interessa
 * quando o resultado vai ser colado num frasco de 20 ml.
 *
 * O SÍMBOLO VAI EM QUADRADOS, e não numa imagem: não há como gerar um PNG sem
 * uma tela, e uma tela dentro de uma janela nova é mais uma coisa a correr mal
 * em silêncio. Uma grelha de `<div>` imprime igual em qualquer impressora e
 * não depende de nada.
 */

import { etiquetaDeLote } from './codigos';
import { formatDataCurta } from './helpers';
import { matrizQr, segmentosQr } from './qr';
import type { Medicamento } from './types';

/** Há DOM (web/Electron), ou seja, há para onde imprimir? */
export const etiquetasImprimiveis =
  typeof document !== 'undefined' && typeof window !== 'undefined';

/**
 * O tamanho de cada etiqueta no papel, em milímetros.
 *
 * 45x32 é a etiqueta autocolante mais comum das que se compram em folha A4, e
 * cabe à volta de um frasco de 20 ml sem dar a volta inteira. Os 20 mm de
 * símbolo com uma versão 4 (33 quadrados) dão 0,6 mm por quadrado, que qualquer
 * telemóvel lê a um palmo de distância.
 */
const LARGURA_MM = 45;
const ALTURA_MM = 32;
const SIMBOLO_MM = 20;

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** O símbolo de um lote, em HTML, com cada linha feita de troços. */
function simboloHtml(texto: string): string {
  const linhas = segmentosQr(matrizQr(texto));
  const lado = linhas.length;
  // Em percentagem do símbolo, para o tamanho em milímetros ficar num sítio só.
  const passo = 100 / lado;
  const corpo = linhas
    .map((segmentos) => {
      let esquerda = 0;
      const partes: string[] = [];
      for (const s of segmentos) {
        if (s.escuro) {
          partes.push(
            `<i style="left:${(esquerda * passo).toFixed(4)}%;width:${(s.quantos * passo).toFixed(4)}%"></i>`,
          );
        }
        esquerda += s.quantos;
      }
      return `<u>${partes.join('')}</u>`;
    })
    .join('');
  return `<div class="qr" style="--lado:${lado}">${corpo}</div>`;
}

/** O que se lê por baixo do símbolo, para não ser preciso ler o QR. */
function legenda(m: Medicamento): string[] {
  const linhas = [m.nome];
  const segunda = [
    m.lote?.trim() ? `Lote ${m.lote.trim()}` : null,
    m.validade ? `Val. ${formatDataCurta(m.validade)}` : null,
  ]
    .filter(Boolean)
    .join('  ');
  if (segunda) linhas.push(segunda);
  return linhas;
}

/**
 * A folha de etiquetas em HTML.
 *
 * Separada da janela de propósito: assim o que decide o que sai no papel é uma
 * função que recebe lotes e devolve texto, e pode ser provada sem navegador
 * nenhum (`__tests__/etiquetas.test.ts`). O que fica do outro lado é só abrir a
 * janela e escrever isto lá dentro.
 */
export function paginaDeEtiquetas(lotes: Medicamento[], titulo: string): string {
  const cartoes = lotes
    .map((m) => {
      const linhas = legenda(m)
        .map((l, i) => `<p class="${i === 0 ? 'nome' : 'sub'}">${escapar(l)}</p>`)
        .join('');
      return `<section>${simboloHtml(etiquetaDeLote(m.id))}<div class="texto">${linhas}</div></section>`;
    })
    .join('');

  /**
   * `@page` sem margens e as etiquetas em grelha: é o que faz uma folha A4
   * sair com o mesmo número de etiquetas em qualquer impressora. As cores
   * levam `print-color-adjust`, senão o navegador "poupa tinta" e imprime os
   * quadrados a cinzento, que é o suficiente para o leitor falhar.
   */
  return `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; }
  main { display: flex; flex-wrap: wrap; gap: 2mm; }
  section {
    width: ${LARGURA_MM}mm; height: ${ALTURA_MM}mm;
    border: 0.2mm dashed #999; border-radius: 1.5mm;
    padding: 1.5mm; display: flex; align-items: center; gap: 1.5mm;
    page-break-inside: avoid; break-inside: avoid; overflow: hidden;
  }
  .qr {
    width: ${SIMBOLO_MM}mm; height: ${SIMBOLO_MM}mm; flex: none;
    background: #fff; position: relative;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .qr u { display: block; position: relative; height: calc(100% / var(--lado)); }
  .qr i {
    position: absolute; top: 0; height: 100%; background: #000;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .texto { min-width: 0; }
  .nome { margin: 0; font-size: 8pt; font-weight: 700; line-height: 1.15;
          overflow-wrap: anywhere; }
  .sub { margin: 0.7mm 0 0; font-size: 7pt; color: #333; line-height: 1.15;
         overflow-wrap: anywhere; }
  @media screen {
    body { background: #f2f2f2; padding: 8mm; }
    main { background: #fff; padding: 8mm; }
  }
</style></head>
<body><main>${cartoes}</main>
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`;
}

/**
 * Abre uma janela com as etiquetas prontas a imprimir.
 *
 * Devolve `false` quando o navegador bloqueia a janela (é o que acontece se
 * isto for chamado fora de um toque), para quem chama poder dizer porquê em vez
 * de deixar a pessoa a olhar para um botão que não faz nada.
 */
export function imprimirEtiquetas(lotes: Medicamento[], titulo: string): boolean {
  if (!etiquetasImprimiveis || lotes.length === 0) return false;

  const janela = window.open('', '_blank');
  if (!janela) return false;

  janela.document.write(paginaDeEtiquetas(lotes, titulo));
  janela.document.close();
  return true;
}
