import { Platform, useWindowDimensions } from 'react-native';

/**
 * Largura a partir da qual passamos do desenho de telemóvel (tabs em baixo,
 * coluna estreita) para o de desktop (barra lateral, conteúdo largo).
 */
export const BREAKPOINT_DESKTOP = 900;

/** True em janelas largas de web/Electron. No telemóvel é sempre false. */
export function useDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= BREAKPOINT_DESKTOP;
}

/**
 * Largura a partir da qual o desenho de desktop reparte o conteúdo em
 * COLUNAS (ver `Colunas`). Entre 900 e isto há barra lateral mas o conteúdo
 * fica numa coluna só: com os 248px da barra, duas colunas numa janela de
 * 1000px davam cartões de 280px, mais estreitos do que um telemóvel.
 */
export const BREAKPOINT_COLUNAS = 1100;

/** True quando há largura para pôr o conteúdo em colunas lado a lado. */
export function useColunas() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= BREAKPOINT_COLUNAS;
}

/** Três colunas (o quadro da Reprodução) só a partir daqui. */
export const BREAKPOINT_TRES_COLUNAS = 1280;

export function useTresColunas() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= BREAKPOINT_TRES_COLUNAS;
}
