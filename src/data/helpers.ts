import { PartoPrevisaoCaducaDias, PrazosLegais, PrazosSanitarios } from './constants';
import type { Alerta, Animal, Evento } from './types';

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
  if (!opcoes?.permitirFuturo && d.getTime() > Date.now()) return null;
  return d.toISOString();
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
export function diasAte(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / MS_DIA);
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

/* ---- Cálculo de alertas legais ---- */
export function computeAlertas(animais: Animal[], eventos: Evento[] = []): Alerta[] {
  const out: Alerta[] = [];

  // Data da última vacinação por animal (ms), para os alertas de revacinação.
  const ultimaVacinacao = new Map<string, number>();
  for (const e of eventos) {
    if (e.tipo !== 'Vacinação') continue;
    const t = new Date(e.data).getTime();
    if (Number.isNaN(t)) continue;
    const anterior = ultimaVacinacao.get(e.animalId);
    if (anterior === undefined || t > anterior) ultimaVacinacao.set(e.animalId, t);
  }

  for (const a of animais) {
    // Animais que já saíram do efetivo (falecidos/vendidos) não geram alertas.
    if (a.estado && a.estado !== 'ativo') continue;
    const rotulo = a.nome ?? a.numeroIdentificacao ?? 'Sem nome';

    // Identificação (brinco) até 20 dias de vida — bovinos
    if (a.especie === 'Bovino' && !a.numeroIdentificacao) {
      const prazo = PrazosLegais.identificacao - idadeDias(a.dataNascimento);
      out.push({
        id: `id-${a.id}`,
        categoria: 'identificacao',
        animalId: a.id,
        gravidade: prazo <= 0 ? 'urgente' : prazo <= 5 ? 'aviso' : 'info',
        titulo: prazo <= 0 ? 'Identificação em atraso' : 'Falta identificar (brinco)',
        descricao:
          prazo <= 0
            ? `${rotulo} devia estar identificado. Prazo excedido há ${Math.abs(prazo)} dia(s).`
            : `${rotulo} tem ${idadeDias(a.dataNascimento)} dias. Colocar brinco em ${prazo} dia(s).`,
        diasRestantes: prazo,
      });
    }

    // Comunicação ao SNIRA — 7 dias após identificação
    if (a.dataIdentificacao && a.comunicadoSnira === false) {
      const prazo = PrazosLegais.snira - idadeDias(a.dataIdentificacao);
      out.push({
        id: `snira-${a.id}`,
        categoria: 'snira',
        animalId: a.id,
        gravidade: prazo <= 0 ? 'urgente' : prazo <= 3 ? 'aviso' : 'info',
        titulo: prazo <= 0 ? 'Comunicação SNIRA em atraso' : 'Comunicar ao SNIRA',
        descricao:
          prazo <= 0
            ? `${rotulo}: nascimento por comunicar ao SNIRA. Prazo excedido há ${Math.abs(prazo)} dia(s).`
            : `${rotulo}: comunicar nascimento ao SNIRA em ${prazo} dia(s).`,
        diasRestantes: prazo,
      });
    }

    // Parto previsto
    if (a.dataPrevistaParto) {
      const dias = diasAte(a.dataPrevistaParto);
      if (dias < -PartoPrevisaoCaducaDias) {
        // Previsão caducada: ou o parto aconteceu e não foi registado, ou a
        // conta estava errada. Continuar a contar dias de atraso não ajuda —
        // o que falta é o criador dizer o que aconteceu. Sem `diasRestantes`,
        // fica dispensável (ver `dispensados.ts`) e não fica preso na lista.
        out.push({
          id: `parto-${a.id}`,
          categoria: 'parto',
          animalId: a.id,
          gravidade: 'info',
          titulo: 'Parto previsto por confirmar',
          descricao: `${rotulo}: a data prevista de parto já passou há mais de ${PartoPrevisaoCaducaDias} dias. Registe o parto ou corrija a previsão.`,
        });
      } else if (dias <= 14) {
        out.push({
          id: `parto-${a.id}`,
          categoria: 'parto',
          animalId: a.id,
          gravidade: dias <= 3 ? 'aviso' : 'info',
          titulo: 'Parto previsto',
          descricao:
            dias < 0
              ? `${rotulo} passou a data prevista de parto há ${Math.abs(dias)} dia(s).`
              : `${rotulo} está próxima do parto (${dias} dia(s)).`,
          diasRestantes: dias,
        });
      }
    }

    // Intervalo de segurança de medicamento
    if (a.fimIntervaloSeguranca) {
      const dias = diasAte(a.fimIntervaloSeguranca);
      if (dias > 0) {
        out.push({
          id: `med-${a.id}`,
          categoria: 'medicamento',
          animalId: a.id,
          gravidade: 'info',
          titulo: 'Período de segurança',
          descricao: `${rotulo}: em intervalo de segurança — não vender para abate (faltam ${dias} dia(s)).`,
          diasRestantes: dias,
        });
      }
    }

    // Vacinação — revacinação anual (ou falta de registo em adultos).
    const idade = idadeDias(a.dataNascimento);
    const ultima = ultimaVacinacao.get(a.id);
    if (ultima !== undefined) {
      const diasDesde = Math.floor((Date.now() - ultima) / MS_DIA);
      const restam = PrazosSanitarios.revacinacao - diasDesde;
      if (restam <= PrazosSanitarios.avisoRevacinacaoDias) {
        out.push({
          id: `vac-${a.id}`,
          categoria: 'vacinacao',
          animalId: a.id,
          gravidade: restam <= 0 ? 'urgente' : 'info',
          titulo: restam <= 0 ? 'Revacinação em atraso' : 'Revacinação a aproximar-se',
          descricao:
            restam <= 0
              ? `${rotulo}: passou ~1 ano da última vacinação. Prazo excedido há ${Math.abs(restam)} dia(s).`
              : `${rotulo}: revacinar em ${restam} dia(s) (última há ${diasDesde} dias).`,
          diasRestantes: restam,
        });
      }
    } else if (idade >= PrazosSanitarios.idadeMinVacinacaoDias) {
      out.push({
        id: `vac-${a.id}`,
        categoria: 'vacinacao',
        animalId: a.id,
        gravidade: 'info',
        titulo: 'Sem registo de vacinação',
        descricao: `${rotulo} não tem nenhuma vacinação registada. Registe a última para acompanhar o plano.`,
      });
    }
  }

  const ordem = { urgente: 0, aviso: 1, info: 2 };
  return out.sort((x, y) => {
    if (ordem[x.gravidade] !== ordem[y.gravidade]) return ordem[x.gravidade] - ordem[y.gravidade];
    return (x.diasRestantes ?? 99) - (y.diasRestantes ?? 99);
  });
}
