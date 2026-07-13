import { PrazosLegais } from './constants';
import type { Alerta, Animal } from './types';

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
export function computeAlertas(animais: Animal[]): Alerta[] {
  const out: Alerta[] = [];

  for (const a of animais) {
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
      if (dias <= 14) {
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
  }

  const ordem = { urgente: 0, aviso: 1, info: 2 };
  return out.sort((x, y) => {
    if (ordem[x.gravidade] !== ordem[y.gravidade]) return ordem[x.gravidade] - ordem[y.gravidade];
    return (x.diasRestantes ?? 99) - (y.diasRestantes ?? 99);
  });
}
