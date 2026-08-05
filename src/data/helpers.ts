/**
 * Contas de data, formatação e as primitivas que o resto do domínio usa.
 *
 * O `computeAlertas` esteve aqui e mudou-se para `alertas.ts` — não foi
 * arrumação: os alertas passaram a precisar do `reproducao.ts`, que por sua vez
 * precisa das contas de datas deste ficheiro. Ficavam os dois a importar-se um
 * ao outro. Este módulo é a camada de baixo e não deve conhecer nenhum dos que
 * falam do domínio.
 */

const MESES_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const MS_DIA = 86_400_000;

/** Saudação conforme a hora do dia. */
export function saudacao(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Bom dia';
  if (h < 20) return 'Boa tarde';
  return 'Boa noite';
}

/** Data de hoje por extenso, ex: "Segunda, 13 jul 2026". */
export function dataExtensa(d = new Date()): string {
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
}

/* ---- Datas relativas (para seed sempre "vivo") ---- */
export function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * MS_DIA).toISOString();
}
export function isoInDays(n: number): string {
  return new Date(Date.now() + n * MS_DIA).toISOString();
}

/**
 * Converte "dd/mm/aaaa" (ou dd-mm-aaaa) numa data ISO ao meio-dia.
 * Devolve null se inválida. Por omissão recusa datas futuras — quase tudo o
 * que se regista já aconteceu; `permitirFuturo` abre a exceção para os campos
 * que são futuros por definição, como a data prevista do parto.
 *
 * "Futuro" é medido em DIAS, não em horas: a data fica ao meio-dia, e comparar
 * esse meio-dia com o instante atual recusava a data de HOJE a quem a
 * escrevesse de manhã. Era o caso mais comum de todos — o campo "Marcar saída"
 * já vem preenchido com hoje, e antes das 12h o criador carregava em Confirmar
 * e recebia "Data inválida" por cima de uma data correta, sem nada que
 * indicasse o que fazer a seguir.
 */
export function parseDataPt(
  texto: string,
  opcoes?: { permitirFuturo?: boolean },
): string | null {
  const m = texto.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  if (!opcoes?.permitirFuturo && d.getTime() > fimDeHoje()) return null;
  return d.toISOString();
}

/** Último instante do dia de hoje, em hora local. */
function fimDeHoje(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Põe as barras de uma data à medida que se escreve: `15032021` → `15/03/2021`.
 *
 * Escrever barras num teclado numérico de telemóvel obriga a trocar de
 * teclado, e é onde as datas se enganavam — a app aceita `dd/mm/aaaa` e mais
 * nada, mas o teclado que abre para as escrever nem sempre tem a tecla. Aqui a
 * pontuação é posta pela app e o criador só carrega em números.
 *
 * Trabalha só sobre os dígitos, o que também endireita o que vem colado
 * (`15-03-2021`, `15.03.2021`) e corta o que passa dos oito. Nunca deixa uma
 * barra no fim: assim apagar tira sempre um dígito, em vez de tirar uma barra
 * que a máscara voltava a pôr — que é a tecla de apagar a parecer avariada.
 */
export function mascaraDataPt(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/**
 * O DIA a que um instante pertence, em hora local: `2026-07-25`.
 *
 * Local e não UTC, e a diferença não é teórica. Portugal está em UTC+1 de
 * março a outubro, portanto entre a meia-noite e a uma da manhã o `toISOString()`
 * ainda dá o dia ANTERIOR. Cortar os dez primeiros caracteres desse texto — que
 * é o atalho óbvio para chegar a um `aaaa-mm-dd` — gravava a despesa lançada à
 * 00:30 no dia errado, com o formulário a mostrar a data certa por cima.
 *
 * É a mesma conta que `chaveDia()` faz para o calendário (`calendario.ts`), que
 * delega aqui para não haver duas versões da regra.
 */
export function diaIso(d: Date | string): string {
  // Um texto que já é só o dia devolve-se como está. Passá-lo por `new Date`
  // faria o JS lê-lo como meia-noite UTC, e um dia sem hora não tem fuso para
  // converter: seria inventar uma hora para depois a interpretar. A ida e volta
  // ao servidor (que devolve `date` sem hora) tem de ser inofensiva.
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
  const data = typeof d === 'string' ? new Date(d) : d;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

/** Data ISO ao meio-dia, `dias` depois de `iso`. Usado para prever o parto. */
export function isoMaisDias(iso: string, dias: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + dias);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/* ---- Formatação PT ---- */
export function formatDataPt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MESES_PT[d.getMonth()]} ${d.getFullYear()}`;
}
export function formatDataCurta(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
/** Dia e hora, para registos com momento exato (ex.: `14/03 09:25`). */
export function formatDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---- Dinheiro (euros, formato PT) ---- */

/**
 * Formata um valor em euros à portuguesa: milhares com espaço, decimais
 * com vírgula e o símbolo € no fim (ex.: `1 350,00 €`). Sem casas decimais
 * quando `casas` é 0 (ex.: `1 350 €`).
 */
export function formatEuro(valor: number, casas: 0 | 2 = 2): string {
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const fixo = abs.toFixed(casas);
  const [inteiro, decimal] = fixo.split('.');
  const comMilhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const corpo = decimal ? `${comMilhares},${decimal}` : comMilhares;
  return `${negativo ? '−' : ''}${corpo} €`;
}

/** Converte texto de input ("1 350,50" ou "1350.5") num número; NaN se inválido. */
export function paraEuro(texto: string): number {
  return parseFloat(texto.replace(/\s/g, '').replace(',', '.'));
}

/* ---- Idade ---- */
export function idadeDias(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_DIA);
}
/**
 * Quantos DIAS faltam até `iso`: 0 é hoje, negativo já passou.
 *
 * Compara DIA com DIA, e não instante com instante — a conta anterior media a
 * distância em horas e arredondava para cima, o que dava um dia a mais por dois
 * caminhos diferentes:
 *
 * - Uma data SEM hora (`2026-08-05`, que é o que `diaIso` produz e o que o
 *   servidor devolve numa coluna `date`) é lida pelo JS como meia-noite UTC.
 *   Entre a meia-noite e a uma da manhã, com o país em UTC+1, ONTEM fica a 0,98
 *   dias de agora e o arredondamento para cima dava 0: um lote fora de validade
 *   aparecia como "A expirar" em vez de "Fora de validade" (ver `estadoDoLote`),
 *   e os prazos do SNIRA andavam um dia. Uma hora por dia, de março a outubro.
 * - Um instante ao MEIO-DIA (o que `parseDataPt` e `isoMaisDias` gravam) fica a
 *   10,1 dias de distância às 9 da manhã: "faltam 10 dias" lia-se 11 até ao
 *   meio-dia e 10 a partir dele. Este não depende de fuso nenhum — acontecia
 *   todas as manhãs, em qualquer país, e é o que punha metade dos testes de
 *   prazos vermelhos das 0h às 12h.
 *
 * Os dois lados passam por `diaIso`, que já sabe ler o dia em hora local sem
 * inventar uma hora para uma data que não a tem. Os dias comparam-se ancorados
 * ao meio-dia para que as noites de 23 e 25 horas da mudança da hora não valham
 * um dia a mais nem a menos.
 */
export function diasAte(iso: string): number {
  return Math.round((meioDiaLocal(diaIso(iso)) - meioDiaLocal(diaIso(new Date()))) / MS_DIA);
}

/** O meio-dia local de um `aaaa-mm-dd`. A âncora para contar dias entre dias. */
function meioDiaLocal(dia: string): number {
  const [ano, mes, d] = dia.split('-').map(Number);
  return new Date(ano, mes - 1, d, 12, 0, 0, 0).getTime();
}

export function idadeExtenso(iso: string): string {
  const dias = idadeDias(iso);
  if (dias < 0) return 'por nascer';
  if (dias < 31) return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  const meses = Math.floor(dias / 30.44);
  if (meses < 24) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(dias / 365.25);
  const mesesRest = Math.floor((dias - anos * 365.25) / 30.44);
  if (mesesRest === 0) return `${anos} anos`;
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${mesesRest} ${mesesRest === 1 ? 'mês' : 'meses'}`;
}
