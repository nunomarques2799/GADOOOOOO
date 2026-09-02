import { useMemo } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui';
import { matrizQr, segmentosQr } from '@/data/qr';
import { colors, radii, spacing } from '@/theme';

/**
 * Um código QR desenhado no ecrã.
 * ------------------------------------------------------------------
 * PRETO E BRANCO FIXOS, e não as cores da paleta que o criador escolheu. É a
 * única coisa nesta app que ignora a paleta de propósito: um leitor precisa de
 * contraste a sério, e um QR castanho sobre bege é bonito e não lê. O mesmo
 * vale para o modo escuro, e é por isso que o quadrado branco é desenhado aqui
 * dentro em vez de se deixar o fundo do cartão passar.
 *
 * A MARGEM BRANCA à volta não é espaçamento: a norma chama-lhe zona de silêncio
 * e exige quatro quadrados de largura. Sem ela, um QR encostado a texto escuro
 * deixa de ser lido, e a causa é invisível a quem olha para o ecrã.
 *
 * POR SEGMENTOS E NÃO POR QUADRADO. Um símbolo de versão 4 tem 1089 quadrados,
 * e uma vista por quadrado põe um telemóvel antigo de joelhos só para mostrar
 * uma etiqueta. Cada linha é desenhada em troços seguidos da mesma cor, o que
 * corta as vistas para cerca de metade e dá exatamente o mesmo no ecrã.
 */
export function EtiquetaQR({
  texto,
  tamanho = 176,
  legenda,
}: {
  /** O que vai codificado. Para um lote, é o `etiquetaDeLote(id)`. */
  texto: string;
  /** Largura do símbolo em pontos, sem contar a margem branca. */
  tamanho?: number;
  /** Uma linha por baixo, para se saber o que a etiqueta é sem a ler. */
  legenda?: string;
}) {
  const linhas = useMemo(() => {
    try {
      return segmentosQr(matrizQr(texto));
    } catch {
      // Um texto que não cabe num QR não pode derrubar o ecrã do lote. Sem
      // símbolo, mostra-se a legenda e mais nada.
      return null;
    }
  }, [texto]);

  if (!linhas) return null;

  // O lado do quadrado, arredondado ao ponto: um lado fracionário faz o
  // desenho ficar com riscas cinzentas entre módulos, e o leitor perde-as.
  const modulo = Math.max(1, Math.round(tamanho / linhas.length));
  const margem = modulo * 4;

  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <View
        style={{
          backgroundColor: '#FFFFFF',
          padding: margem,
          borderRadius: radii.sm,
        }}>
        {linhas.map((segmentos, i) => (
          <View key={i} style={{ flexDirection: 'row', height: modulo }}>
            {segmentos.map((s, j) => (
              <View
                key={j}
                style={{
                  width: s.quantos * modulo,
                  height: modulo,
                  backgroundColor: s.escuro ? '#000000' : '#FFFFFF',
                }}
              />
            ))}
          </View>
        ))}
      </View>
      {legenda ? (
        <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
          {legenda}
        </Text>
      ) : null}
    </View>
  );
}
