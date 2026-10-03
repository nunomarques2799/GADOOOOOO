import type { ReactNode } from 'react';
import { View } from 'react-native';

import { BarraLateral, type ItemNav } from '@/components/BarraLateral';
import { useDestinos } from '@/components/destinosNavegacao';
import { useMembros } from '@/data/membros';
import { t } from '@/i18n';
import { useDesktop } from '@/hooks/useDesktop';
import { colors } from '@/theme';

/** A barra lateral do criador, com os destinos que esta pessoa pode ver. */
export function BarraLateralDaApp() {
  const destinos = useDestinos();
  const itens: ItemNav[] = destinos.map((d) => ({
    rota: d.rota,
    label: t(d.chave),
    icon: d.icon,
  }));
  return <BarraLateral itens={itens} />;
}

/**
 * No computador, a barra lateral fica à volta da PILHA inteira e não só dos
 * separadores.
 *
 * Vivia dentro do `(tabs)/_layout.tsx`, e por isso desaparecia sempre que se
 * abria uma ficha ou um formulário: a ficha de um animal ocupava a janela toda,
 * com um botão de voltar redondo ao canto, que é o gesto de um telemóvel. Num
 * monitor, quem abre a ficha da Mimosa continua a querer saltar para os
 * Terrenos sem ter de voltar atrás primeiro.
 *
 * O superadmin tem a sua própria barra, no `(superadmin)/_layout.tsx`, e fica
 * como estava.
 */
export function ComBarraLateral({ children }: { children: ReactNode }) {
  const desktop = useDesktop();
  const { isSuperadmin } = useMembros();
  // A barra entra e sai, a pilha fica no MESMO sítio da árvore. Com um
  // `return <>{children}</>` no desenho estreito, cruzar os 900px (encaixar a
  // janela do Windows a meio do ecrã) remontava a pilha toda e apagava o
  // formulário que se estava a preencher.
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      {desktop && !isSuperadmin ? <BarraLateralDaApp /> : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
