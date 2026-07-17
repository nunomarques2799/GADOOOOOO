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
