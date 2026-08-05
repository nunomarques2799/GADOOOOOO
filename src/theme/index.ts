export {
  colors,
  spacing,
  radii,
  sizes,
  layout,
  type,
  maxFontScale,
  fontFamily,
  shadow,
  motion,
} from './tokens';
export type { ColorToken, Cores, TypeVariantName } from './tokens';
export {
  FAMILIAS,
  PALETAS,
  PALETA_OMISSAO,
  paletaOmissao,
  paletaPorId,
  paletasDe,
} from './paletas';
export type { Familia, Paleta, PaletaId, TokensPaleta } from './paletas';

// `./preferencia` fica DE FORA a propósito: puxa o armazenamento (expo-sqlite)
// e o cliente Supabase (a escolha viaja na conta) atrás de si, e `@/theme` é
// importado por praticamente todos os módulos, incluindo os que correm nos
// testes. Quem precisa de gravar a escolha importa `@/theme/preferencia`
// diretamente — são dois ficheiros ao todo.
