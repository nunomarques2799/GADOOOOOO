import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/theme';

/**
 * O invólucro dos ecrãs de formulário, para o teclado não tapar o que importa.
 * ------------------------------------------------------------------
 * Todos os formulários desta app têm a barra de guardar fixa no fundo
 * (`position: 'absolute'`). No Android isso resolve-se sozinho — a janela
 * encolhe quando o teclado abre e a barra sobe com ela. No iPhone não: a janela
 * mantém o tamanho, o teclado sobrepõe-se, e o botão "Guardar animal" fica
 * literalmente debaixo do teclado. Quem estava a escrever a data de nascimento
 * ou o preço — os últimos campos, logo acima da barra — tinha de adivinhar que
 * precisava de fechar o teclado primeiro.
 *
 * O `behavior="padding"` acrescenta ao fundo DESTE contentor a altura do
 * teclado. Como a barra está posicionada em absoluto dentro dele, o `bottom: 0`
 * dela passa a ser o topo do teclado, e sobe junto. O ScrollView encolhe pelo
 * mesmo motivo, o que faz o iOS trazer o campo focado para a vista.
 *
 * Substitui o `<View style={{ flex: 1, backgroundColor: colors.background }}>`
 * que envolvia estes ecrãs — o fundo já vem aqui.
 */
export function EcraComTeclado({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      // Só no iOS. No Android o `adjustResize` (omissão do Expo) já faz o
      // trabalho, e somar-lhe o `padding` daria o dobro do espaço — a barra
      // ficava a pairar a meio do ecrã.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}

/**
 * O mesmo problema, nas folhas que sobem de baixo (`Modal` transparente).
 *
 * Uma folha ancorada ao fundo do ecrã com um campo de escrita lá dentro — a
 * procura de uma raça, o texto de uma nota — fica atrás do teclado assim que se
 * toca no campo. Substitui o invólucro `<View style={{ flex: 1, backgroundColor:
 * colors.overlay, justifyContent: 'flex-end' }}>` das folhas que escrevem.
 */
export function FolhaComTeclado({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}
