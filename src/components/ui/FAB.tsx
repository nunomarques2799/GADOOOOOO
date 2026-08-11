import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesktop } from '@/hooks/useDesktop';
import { colors, radii, shadow, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  /**
   * O que o botão faz. Já não se lê no ecrã (o botão é só o sinal `+`), mas
   * continua a ser o que um leitor de ecrã anuncia, e é por isso que continua a
   * ser obrigatório: um botão redondo sem rótulo falado é um botão que ninguém
   * cego consegue usar.
   */
  label: string;
  icon?: IconName;
  onPress: () => void;
};

/**
 * Botão de ação flutuante, ancorado em baixo à direita.
 *
 * REDONDO e só com o sinal, e não a pastilha com "Registar" que aqui esteve.
 * Cada lista tinha o seu verbo ("Registar", "Dar entrada", "Nova", "Cobrição"),
 * e com a letra do sistema grande essa pastilha crescia até tapar meia lista de
 * animais. O sinal `+` diz a mesma coisa em qualquer separador, em qualquer
 * língua, e ocupa sempre o mesmo canto.
 *
 * Fica COLADO à barra de separadores de propósito. O polegar que carrega no `+`
 * da barra é o mesmo que carrega neste, e ter os dois à mesma altura poupa a
 * viagem pelo ecrã. No computador não há barra em baixo, por isso aí volta a
 * respeitar a margem de segurança do sistema.
 */
export function FAB({ label, icon = 'plus', onPress }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: spacing.lg,
          // No telemóvel a barra de separadores já reserva a safe-area por
          // baixo dela: somá-la outra vez punha o botão a flutuar bem acima da
          // barra, que é o que o afastava do polegar.
          bottom: desktop ? insets.bottom + spacing.lg : spacing.xs,
          width: 60,
          height: 60,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
        },
        shadow.raised,
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}>
      <Icon name={icon} size={34} color={colors.onPrimary} />
    </Pressable>
  );
}
