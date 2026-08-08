import { colors } from '@/theme';
import type { IconName } from '@/components/ui';

import type {
  Especie,
  Finalidade,
  ResultadoDiagnostico,
  Sexo,
  TipoMedicamento,
  TipoTerreno,
} from './types';

/** Prazos legais (dias) — DGAV/IFAP, ver README secção 3.3. */
export const PrazosLegais = {
  identificacao: 20, // identificar (brinco) até 20 dias de vida
  snira: 7, // comunicar nascimento 7 dias após identificação
  movimentacao: 7,
  morte: 7,
  intervaloPartos: 270,
  idadeMinMaeMeses: 15,
  idadeMinPaiMeses: 18,
} as const;

/**
 * Duração média da gestação, em dias, por espécie. Serve para calcular a data
 * prevista do parto a partir da cobrição — que é a data que o criador
 * costuma saber. São médias da literatura zootécnica, não garantias.
 */
export const GestacaoDias: Record<Especie, number> = {
  Bovino: 283,
  Equídeo: 340,
  Ovino: 150,
  Caprino: 150,
  Suíno: 114,
};

/**
 * Dias de atraso a partir dos quais uma previsão de parto deixa de valer.
 * Passado este prazo sem parto registado, a previsão está errada ou o criador
 * esqueceu-se de registar — contar dias de atraso indefinidamente só ia encher
 * a lista de avisos que nunca mais saem.
 */
export const PartoPrevisaoCaducaDias = 30;

/**
 * Prazos de maneio reprodutivo (dias). Orientação zootécnica, não lei: são as
 * réguas com que se decide que uma vaca precisa de atenção, e cada uma tem um
 * motivo prático por trás.
 */
export const PrazosReproducao = {
  /**
   * A partir de quantos dias depois da cobrição vale a pena diagnosticar. Aos
   * 30 dias a ecografia já vê; abaixo disso o veterinário responde "duvidoso" e
   * a deslocação foi ao lado. 35 dá margem.
   */
  diagnosticoAPartirDe: 35,
  /**
   * Passados estes dias sem diagnóstico, o alerta fica URGENTE. Uma vaca que
   * ficou vazia e ninguém deu por isso é um ciclo inteiro perdido — cada dia a
   * mais é leite ou um vitelo que não vai haver.
   */
  diagnosticoUrgenteAPartirDe: 60,
  /**
   * Um diagnóstico `duvidoso` repete-se, não se arquiva. É o prazo a partir do
   * qual a repetição volta a aparecer na lista.
   */
  repetirDuvidosoApos: 21,
  /**
   * Quantos dias depois do parto uma vaca devia estar coberta outra vez. O
   * intervalo entre partos que se procura é de ~365 dias e a gestação leva 283:
   * sobram uns 80 para voltar a conceber, e por volta dos 60 já se pode cobrir.
   * Aos 90 sem cobrição, o ano seguinte já está a escorregar.
   */
  cobrirApos: 90,
  /**
   * E a partir daqui deixou de escorregar e perdeu-se. Passa a urgente.
   */
  cobrirUrgenteApos: 150,
  /**
   * Idade mínima, em meses, a partir da qual uma fêmea entra nas listas de
   * reprodução. Abaixo disto é recria e não tem nada que estar lá.
   */
  idadeMinFemeaMeses: 15,
  /**
   * Idade mínima, em meses, para um macho ser sugerido como touro numa cobrição
   * (ver `sugestoesDeCobricao`). Abaixo disto é um vitelo, e oferecê-lo na lista
   * é oferecer um engano — ainda por cima num campo onde o engano fica a mentir
   * na genealogia da cria.
   */
  idadeMinMachoMeses: 12,
  /** Intervalo entre partos que se considera bom, em dias (para os números). */
  intervaloPartosAlvo: 400,
} as const;

/**
 * Avisos das existências (dias). O medicamento fora de validade não se
 * administra — e descobri-lo com o animal já preso no tronco é o pior sítio
 * para o descobrir.
 */
export const PrazosExistencias = {
  /** Antecedência com que se avisa que um lote está a chegar à validade. */
  avisoValidadeDias: 30,
  /**
   * Abaixo desta fração do que o frasco trazia, avisa-se que está a acabar.
   * Fração e não valor fixo: 20 ml num frasco de 1000 é o fim, num de 50 é
   * quase metade.
   */
  fracaoQuaseVazio: 0.15,
} as const;

/** Prazos sanitários (dias) — orientação prática, não prazo legal rígido. */
export const PrazosSanitarios = {
  /** Vacinação anual: alerta de revacinação passado ~1 ano da última. */
  revacinacao: 365,
  /** Só sugere "sem registo de vacinação" a partir desta idade (evita ruído nos recém-nascidos). */
  idadeMinVacinacaoDias: 180,
  /** Antecedência com que se avisa antes de a vacinação expirar. */
  avisoRevacinacaoDias: 30,
} as const;

export const especies: Especie[] = ['Bovino', 'Equídeo', 'Ovino', 'Caprino', 'Suíno'];
export const sexos: Sexo[] = ['Fêmea', 'Macho'];
export const tiposTerreno: TipoTerreno[] = ['Pastagem', 'Cultivo', 'Misto', 'Outro'];

type EspecieMeta = { icon: IconName; cor: string; plural: string };

export const especieMeta: Record<Especie, EspecieMeta> = {
  Bovino: { icon: 'cow', cor: colors.bovino, plural: 'Bovinos' },
  Equídeo: { icon: 'horse-variant', cor: colors.equideo, plural: 'Equídeos' },
  Ovino: { icon: 'sheep', cor: colors.ovino, plural: 'Ovinos' },
  Caprino: { icon: 'paw', cor: colors.caprino, plural: 'Caprinos' },
  Suíno: { icon: 'pig-variant', cor: colors.suino, plural: 'Suínos' },
};

/**
 * Finalidades por sexo. A régua é biológica, não de gosto: um macho não pare
 * e uma fêmea não cobre. Oferecer as seis a toda a gente obrigava o criador a
 * ler opções impossíveis de cada vez que registasse um animal.
 *
 * "Recria" é o animal jovem que ainda não tem destino fechado — serve os dois,
 * e é o que se escolhe enquanto não se decide entre engordar ou guardar para
 * reprodução.
 */
const FINALIDADES: Record<Sexo, readonly Finalidade[]> = {
  Fêmea: ['Leite', 'Criação', 'Carne', 'Recria'],
  Macho: ['Semental', 'Carne', 'Recria', 'Trabalho'],
};

export function finalidadesPara(sexo: Sexo): Finalidade[] {
  return [...FINALIDADES[sexo]];
}

/** Todas as finalidades — para os filtros, que não estão dentro de um sexo. */
export const finalidades: Finalidade[] = [
  'Leite',
  'Criação',
  'Semental',
  'Carne',
  'Recria',
  'Trabalho',
];

export const finalidadeMeta: Record<Finalidade, { icon: IconName; descricao: string }> = {
  Leite: { icon: 'bottle-soda-outline', descricao: 'Em ordenha ou destinada a ordenha' },
  Criação: { icon: 'baby-bottle-outline', descricao: 'Fêmea para parir e criar' },
  Semental: { icon: 'gender-male', descricao: 'Macho reprodutor' },
  Carne: { icon: 'food-steak', descricao: 'Engorda para abate' },
  Recria: { icon: 'sprout', descricao: 'Jovem, ainda a crescer' },
  Trabalho: { icon: 'tractor', descricao: 'Boi de trabalho' },
};

/* ---- Reprodução e existências ---- */

export const resultadosDiagnostico: ResultadoDiagnostico[] = ['gestante', 'vazia', 'duvidoso'];

export const resultadoMeta: Record<
  ResultadoDiagnostico,
  { label: string; icon: IconName; explicacao: string }
> = {
  gestante: {
    label: 'Gestante',
    icon: 'check-circle-outline',
    explicacao: 'Confirmada prenhe. A app calcula a data prevista do parto.',
  },
  vazia: {
    label: 'Vazia',
    icon: 'close-circle-outline',
    explicacao: 'Não está prenhe. Volta à lista de quem precisa de cobrição.',
  },
  duvidoso: {
    label: 'Duvidoso',
    icon: 'help-circle-outline',
    explicacao: 'Cedo de mais para se ver. Repetir daqui a três semanas.',
  },
};

export const tiposMedicamento: TipoMedicamento[] = ['Medicamento', 'Vacina'];

/** Unidades em que se mede o que está na arrecadação. */
export const unidadesMedicamento = ['ml', 'l', 'g', 'kg', 'doses', 'comprimidos'] as const;

/**
 * `Misto` e `Outro` seguem a paleta escolhida, por isso são GETTERS: esta
 * tabela nasce no arranque do módulo, antes de a paleta guardada estar
 * aplicada, e um valor direto ficava com a cor de origem para sempre.
 */
export const tipoTerrenoMeta: Record<TipoTerreno, { icon: IconName; cor: string }> = {
  Pastagem: { icon: 'grass', cor: colors.success },
  Cultivo: { icon: 'sprout', cor: colors.caprino },
  Misto: {
    icon: 'leaf',
    get cor() {
      return colors.primary;
    },
  },
  Outro: {
    icon: 'map-marker-outline',
    get cor() {
      return colors.textSecondary;
    },
  },
};
