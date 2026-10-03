import { createContext, useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Verdadeiro dentro do painel de formulário do computador. O `Header` lê-o para
 * encostar o título à mesma margem dos campos, e não à da página.
 */
const PainelFormulario = createContext(false);
export const useDentroDePainel = () => useContext(PainelFormulario);

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
  larguraDesktop = layout.formularioDesktop,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** A largura do painel no computador (ver abaixo). */
  larguraDesktop?: number;
}) {
  const desktop = useDesktop();

  /*
   * No computador, o formulário é um PAINEL ao meio da página.
   * ------------------------------------------------------------------
   * Esticado pela janela, um campo de nome tinha 1100px de largura para cinco
   * letras, os chips do sexo ficavam a meia janela de distância um do outro e a
   * barra de gravar atravessava o monitor de um lado ao outro: era o desenho do
   * telemóvel, ampliado. Aqui o formulário vive numa folha com bordas, como um
   * papel pousado na mesa, e a barra de gravar fica DENTRO dela (é
   * `position: 'absolute'` em cada formulário, e o painel é o seu contentor),
   * debaixo dos campos a que pertence.
   *
   * A ÁRVORE É A MESMA nos dois desenhos e só os estilos mudam: eram duas
   * árvores diferentes, e cruzar os 900px a meio de um registo (encaixar a
   * janela do Windows a meio do ecrã) recriava os campos todos.
   */
  return (
    <KeyboardAvoidingView
      style={[
        { flex: 1, backgroundColor: colors.background },
        desktop && { paddingHorizontal: spacing.xxl, paddingVertical: spacing.xl },
        style,
      ]}
      // Só no iOS. No Android o `adjustResize` (omissão do Expo) já faz o
      // trabalho, e somar-lhe o `padding` daria o dobro do espaço — a barra
      // ficava a pairar a meio do ecrã.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        style={
          desktop
            ? {
                flex: 1,
                width: '100%',
                maxWidth: larguraDesktop,
                alignSelf: 'center',
                backgroundColor: colors.background,
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }
            : { flex: 1 }
        }>
        <PainelFormulario.Provider value={desktop}>{children}</PainelFormulario.Provider>
      </View>
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
