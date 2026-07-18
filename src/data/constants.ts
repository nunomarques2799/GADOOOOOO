import { colors } from '@/theme';
import type { IconName } from '@/components/ui';

import type { Especie, Sexo, TipoTerreno } from './types';

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

export const tipoTerrenoMeta: Record<TipoTerreno, { icon: IconName; cor: string }> = {
  Pastagem: { icon: 'grass', cor: colors.success },
  Cultivo: { icon: 'sprout', cor: colors.caprino },
  Misto: { icon: 'leaf', cor: colors.primary },
  Outro: { icon: 'map-marker-outline', cor: colors.textSecondary },
};
