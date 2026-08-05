import type { ViewStyle } from 'react-native';

import { colors, radii, spacing } from '@/theme';

/**
 * O botão do calendário dentro de um campo de data.
 * ------------------------------------------------------------------
 * Vive aqui, e não dentro do `CampoData`, porque há dois: o nativo abre o
 * seletor do sistema e o `.web.tsx` abre o do navegador. O aspeto tem de ser o
 * mesmo nos dois — este ficheiro não importa nada de nativo, por isso pode ser
 * lido por ambos.
 *
 * Porquê um botão com fundo e não só um ícone: era um ícone de 32px encostado à
 * direita do campo, e quem o não conhecesse não tinha como saber que aquilo se
 * tocava. Escrevia-se a data à mão, dígito a dígito, como se o calendário não
 * existisse. Com fundo, tamanho de alvo de toque e a cor da marca, lê-se como o
 * botão que é.
 *
 * Função e não constante: as cores mudam com a paleta escolhida e um objeto no
 * topo do módulo congelava as de origem (ver DESIGN_SYSTEM.md).
 */
export function estiloBotaoCalendario(): ViewStyle {
  return {
    width: 46,
    height: 46,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    marginLeft: spacing.xxs,
  };
}
