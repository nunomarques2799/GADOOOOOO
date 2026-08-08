/**
 * Contas de data, formatação e as primitivas que o resto do domínio usa.
 *
 * O `computeAlertas` esteve aqui e mudou-se para `alertas.ts` — não foi
 * arrumação: os alertas passaram a precisar do `reproducao.ts`, que por sua vez
 * precisa das contas de datas deste ficheiro. Ficavam os dois a importar-se um
 * ao outro. Este módulo é a camada de baixo e não deve conhecer nenhum dos que
 * falam do domínio.
 *
 * O `@/i18n` é a exceção a essa regra, e não a contradiz: é uma camada AINDA
 * MAIS BAIXA do que esta (só sabe ler uma preferência e devolver uma string) e
 * não conhece nem o domínio nem este ficheiro. Serve as duas funções que
 * produzem texto para os olhos — a saudação e a data por extenso.
 */

import { idiomaAtual, t } from '@/i18n';

const MESES_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

const DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const MESES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DIAS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MS_DIA = 86_400_000;

/** Saudação conforme a hora do dia. */
export function saudacao(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return t('saudacao.manha');
  if (h < 20) return t('saudacao.tarde');
  return t('saudacao.noite');
}

/**
 * Data de hoje por extenso, ex: "Segunda, 13 jul 2026" / "Monday, 13 Jul 2026".
 *
 * As tabelas de meses e dias ficam AQUI e não no dicionário do `i18n`: são
 * catorze linhas por língua que nada mais lê, e diluí-las entre os textos de
 * ecrã só fazia o dicionário maior. A ORDEM também não muda — dia antes do mês
 * nas duas — porque é assim que se escreve em Portugal e no Reino Unido, e esta
 * app é usada em Portugal.
 *
 * `formatDataPt` e as outras continuam em português nas duas línguas: são
 * datas curtas em dígitos (13/07/2026), que se leem igual em qualquer sítio.
 */
export function dataExtensa(d = new Date()): string {
  const [dias, meses] = idiomaAtual() === 'en' ? [DIAS_EN, MESES_EN] : [DIAS_PT, MESES_PT];
  return `${dias[d.getDay()]}, ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
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
 * Um texto que é SÓ um dia, `aaaa-mm-dd` — a forma que o servidor devolve numa
 * coluna `date` e a que `diaIso` produz. Um valor destes não tem hora nenhuma,
 * e quem o receber não deve inventar uma: é a diferença entre "dia 2" e "dia 2
 * à meia-noite", e a segunda leitura muda de dia conforme o fuso.
 */
const SO_DIA = /^\d{4}-\d{2}-\d{2}$/;

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
  if (typeof d === 'string' && SO_DIA.test(d.trim())) return d.trim();
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

/* ---- Formatação PT ----
 *
 * As duas escrevem um DIA, e por isso começam por reduzir o que recebem a um
 * dia com `diaIso` em vez de o passarem por `new Date` e lerem os componentes
 * locais. Parece o mesmo e não é: uma data sem hora (`2026-03-02`, o que o
 * servidor devolve numa coluna `date`) é lida como meia-noite UTC, e num fuso a
 * OESTE de Greenwich essa meia-noite ainda pertence ao dia anterior — a folha
 * exportada escrevia 01/03 onde a app mostrava 02/03.
 *
 * Em Portugal (UTC+0/+1) isto nunca se viu, e não se vê: a meia-noite UTC cai
 * sempre no mesmo dia local. A correção não muda nada do que o criador lê — tira
 * é a dependência de o país estar a leste, que não era uma decisão de ninguém.
 * É também a razão de o teste que a prova ter de correr noutro fuso, à parte
 * (`npm run test:fuso-oeste`).
 */
export function formatDataPt(iso: string): string {
  const [ano, mes, dia] = diaIso(iso).split('-');
  return `${Number(dia)} ${MESES_PT[Number(mes) - 1]} ${ano}`;
}
export function formatDataCurta(iso: string): string {
  const [ano, mes, dia] = diaIso(iso).split('-');
  return `${dia}/${mes}/${ano}`;
}
/**
 * Dia e hora, para registos com momento exato (ex.: `14/03 09:25`).
 *
 * Ao contrário das duas de cima, esta PRECISA do instante — é a hora que vem
 * mostrar. Para tudo o que recebe hoje (`registadoEm`, `criadoEm`, `acessoAte`,
 * todos `timestamptz`) já estava certa: os componentes locais de um instante dão
 * o dia local certo em qualquer fuso.
 *
 * O que se fecha aqui é a entrada que nunca acontece mas não estava travada: uma
 * data SEM hora. Passada por `new Date` virava meia-noite UTC, o que a oeste de
 * Greenwich a punha no dia anterior — e, em qualquer fuso, fazia aparecer uma
 * hora que ninguém registou. O dia passa a sair de `diaIso`, e onde não há hora
 * não se escreve nenhuma: `14/03` em vez de `14/03 00:00`.
 */
export function formatDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const [, mes, dia] = diaIso(iso).split('-');
  if (SO_DIA.test(iso.trim())) return `${dia}/${mes}`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dia}/${mes} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

/* ---- Idade e prazos ----
 *
 * As duas contas abaixo são a MESMA pergunta em sentidos opostos, e por isso
 * assentam na mesma primitiva: quantos dias de CALENDÁRIO separam dois dias.
 * Enquanto cada uma media horas por sua conta, davam respostas diferentes para
 * o mesmo prazo — o do SNIRA saía por `idadeDias` no `alertas.ts` e por
 * `diasAte` no `snira.ts`, e os dois ecrãs discordavam a manhã inteira.
 *
 * Nenhuma delas compara instantes. Contar horas e arredondar dava um dia a mais
 * ou a menos por dois caminhos:
 *
 * - Uma data SEM hora (`2026-08-05`, que é o que `diaIso` produz e o que o
 *   servidor devolve numa coluna `date`) é lida pelo JS como meia-noite UTC.
 *   Entre a meia-noite e a uma da manhã, com o país em UTC+1, ONTEM fica a 0,98
 *   dias de agora: um lote fora de validade aparecia como "A expirar" em vez de
 *   "Fora de validade" (ver `estadoDoLote`). Uma hora por dia, de março a
 *   outubro, e só onde o fuso não é UTC.
 * - Um instante ao MEIO-DIA (o que `parseDataPt` e `isoMaisDias` gravam) fica a
 *   10,1 dias de distância às 9 da manhã. Este não depende de fuso nenhum:
 *   acontecia todas as manhãs até ao meio-dia, em qualquer país.
 *
 * Os dois lados passam por `diaIso`, que já sabe ler o dia em hora local sem
 * inventar uma hora para uma data que não a tem, e os dias comparam-se ancorados
 * ao meio-dia para que as noites de 23 e 25 horas da mudança da hora não valham
 * um dia a mais nem a menos.
 */

/** Dias de calendário de `de` até `ate`, ambos `aaaa-mm-dd` em hora local. */
function diasEntreDias(de: string, ate: string): number {
  return Math.round((meioDiaLocal(ate) - meioDiaLocal(de)) / MS_DIA);
}

/**
 * Dias de calendário entre dois instantes ou datas (`b − a`).
 *
 * É a primitiva de todas as contas de dias da app. Aceita as três formas que
 * circulam por aqui — `Date`, instante ISO completo e data sem hora — porque é
 * `diaIso` quem reduz cada uma ao dia a que pertence antes de as comparar.
 *
 * Usar isto em vez de dividir a diferença de milissegundos por um dia. Essa
 * conta parece equivalente e não é: as datas ficam gravadas ao meio-dia, e a
 * fração que sobra dava um dia a mais ou a menos conforme a HORA a que se
 * perguntasse — todas as manhãs, sem nada que o denunciasse.
 */
export function diasEntreDatas(a: Date | string, b: Date | string): number {
  return diasEntreDias(diaIso(a), diaIso(b));
}

/** O meio-dia local de um `aaaa-mm-dd`. A âncora para contar dias entre dias. */
function meioDiaLocal(dia: string): number {
  const [ano, mes, d] = dia.split('-').map(Number);
  return new Date(ano, mes - 1, d, 12, 0, 0, 0).getTime();
}

/**
 * Há quantos dias foi `iso`: 0 é hoje, negativo ainda não chegou.
 *
 * Um animal nascido HOJE dá 0 a qualquer hora. Enquanto isto media horas contra
 * uma data de nascimento gravada ao meio-dia, dava −1 de manhã e o
 * `idadeExtenso` escrevia **"por nascer"** na ficha de um bezerro que estava ali
 * à frente do criador. Pela mesma conta, o prazo do brinco de um bezerro de três
 * dias lia-se 18 em vez de 17 até ao meio-dia.
 */
export function idadeDias(iso: string): number {
  return diasEntreDatas(iso, new Date());
}

/** Quantos DIAS faltam até `iso`: 0 é hoje, negativo já passou. */
export function diasAte(iso: string): number {
  return diasEntreDatas(new Date(), iso);
}

export function idadeExtenso(iso: string): string {
  const dias = idadeDias(iso);
  if (dias < 0) return t('idade.porNascer');
  if (dias < 31) return t('idade.dias', { n: dias });
  const meses = Math.floor(dias / 30.44);
  if (meses < 24) return t('idade.meses', { n: meses });
  const anos = Math.floor(dias / 365.25);
  const mesesRest = Math.floor((dias - anos * 365.25) / 30.44);
  if (mesesRest === 0) return t('idade.anos', { n: anos });
  // As duas partes vão já formatadas para o `|` do plural funcionar em cada
  // uma: "1 ano e 6 meses" tem singular à esquerda e plural à direita, e uma
  // frase só não conseguia escolher os dois.
  return t('idade.anosEMeses', {
    anos: t('idade.anos', { n: anos }),
    meses: t('idade.meses', { n: mesesRest }),
  });
}
