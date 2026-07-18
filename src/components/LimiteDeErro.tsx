/**
 * Limite de erro (error boundary) — a última linha de defesa da app.
 * ------------------------------------------------------------------
 * Sem isto, uma exceção durante o desenho de qualquer ecrã deixava a app em
 * branco: o criador não percebia o que aconteceu, não conseguia explicar-nos, e
 * nós não tínhamos como reproduzir. Aqui apanha-se a exceção, mostra-se um ecrã
 * que se percebe e dá-se um caminho de volta.
 *
 * Tem de ser componente de classe: `componentDidCatch`/`getDerivedStateFromError`
 * não têm equivalente em hooks.
 *
 * DELIBERADAMENTE não usa o design system (`<Text variant>`, `<Button>`, tokens):
 * este ecrã existe para os casos em que algo já correu mal, e pode ser desenhado
 * antes de as fontes Nunito carregarem ou com o próprio design system em falha.
 * Depender dele aqui seria construir a rede de segurança com o mesmo material
 * que se partiu. Cores e medidas vão em literais, por isso, de propósito.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';

import { VERSAO_APP } from '@/data/versao';

type Props = { children: ReactNode };
type State = { erro: Error | null };

/** Texto para o criador enviar a quem dá apoio. */
function relatorio(erro: Error, pilha?: string): string {
  return [
    `Gestão de Gado — versão ${VERSAO_APP}`,
    `Data: ${new Date().toISOString()}`,
    '',
    `Erro: ${erro.message}`,
    '',
    (pilha ?? erro.stack ?? '').trim(),
  ].join('\n');
}

export class LimiteDeErro extends Component<Props, State> {
  state: State = { erro: null };
  private pilhaComponentes?: string;

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    this.pilhaComponentes = info.componentStack ?? undefined;
    // Sem serviço de relato de erros configurado, ao menos fica no log do
    // aparelho (visível por `adb logcat` / consola do Metro em desenvolvimento).
    console.error('[LimiteDeErro]', erro, info.componentStack);
  }

  private tentarDeNovo = () => {
    this.setState({ erro: null });
  };

  private enviarDetalhes = () => {
    const { erro } = this.state;
    if (!erro) return;
    void Share.share({ message: relatorio(erro, this.pilhaComponentes) });
  };

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;

    return (
      <View style={{ flex: 1, backgroundColor: '#F7F6F1', justifyContent: 'center' }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          {/* Sinal desenhado à mão com Views: a regra do projeto proíbe emojis,
              e um ícone de fonte (MaterialCommunityIcons) seria mais uma coisa
              a poder falhar exatamente no ecrã que trata das falhas. */}
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#FBE9E7',
              alignSelf: 'center',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontSize: 38, fontWeight: '800', color: '#C0392B' }}>!</Text>
          </View>

          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: '#15200F',
              textAlign: 'center',
            }}>
            Alguma coisa correu mal
          </Text>

          {/* A primeira pergunta de quem vê isto é "perdi os meus animais?". */}
          <Text style={{ fontSize: 17, lineHeight: 25, color: '#3C4A34', textAlign: 'center' }}>
            Os seus dados continuam guardados neste aparelho — não se perdeu nada.
            Toque em "Tentar de novo" para voltar à app.
          </Text>

          <Pressable
            onPress={this.tentarDeNovo}
            accessibilityRole="button"
            accessibilityLabel="Tentar de novo"
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: 999,
              backgroundColor: '#0F7D33',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              opacity: pressed ? 0.9 : 1,
            })}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF' }}>
              Tentar de novo
            </Text>
          </Pressable>

          <Pressable
            onPress={this.enviarDetalhes}
            accessibilityRole="button"
            accessibilityLabel="Enviar detalhes do erro"
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: '#C2CBBB',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 24,
              opacity: pressed ? 0.9 : 1,
            })}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0B5B24' }}>
              Enviar detalhes a quem dá apoio
            </Text>
          </Pressable>

          {/* Detalhe técnico no fim, pequeno: não assusta quem não o percebe e
              poupa uma ida ao logcat a quem o percebe. */}
          <Text
            style={{ fontSize: 13, color: '#6B7A63', textAlign: 'center' }}
            selectable
            numberOfLines={4}>
            {erro.message}
          </Text>
          <Text style={{ fontSize: 13, color: '#93A08C', textAlign: 'center' }}>
            versão {VERSAO_APP}
          </Text>
        </ScrollView>
      </View>
    );
  }
}
