import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { MINIMO_LETRAS, procurarLocalidades, type Localidade } from '@/data/localidades';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/** Tempo de espera depois da última letra, para não perguntar a cada tecla. */
const ESPERA_MS = 350;

/**
 * Campo de localização com sugestões de sítios reais.
 * ------------------------------------------------------------------
 * Escreve-se e aparece a lista de localidades que a API de geocodificação
 * conhece — a MESMA que a app usa depois para ir buscar a meteorologia (ver
 * `localidades.ts`). Escolher da lista é o que garante que o sítio é
 * encontrável; escrever à mão continua a valer, para um lugar que a API não
 * conheça.
 *
 * Sem rede, ou com a API em baixo, não acontece nada de especial: o campo
 * comporta-se como o campo de texto que era. Nunca se bloqueia a escrita à
 * espera de uma resposta.
 */
export function CampoLocalidade({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [sugestoes, setSugestoes] = useState<Localidade[]>([]);
  const [aProcurar, setAProcurar] = useState(false);
  const [aberto, setAberto] = useState(false);
  /** O texto que já foi escolhido da lista — não se volta a procurar por ele. */
  const escolhido = useRef<string | null>(null);
  const controlador = useRef<AbortController | null>(null);

  useEffect(() => {
    const termo = value.trim();
    if (termo === escolhido.current || termo.length < MINIMO_LETRAS) {
      setSugestoes([]);
      setAProcurar(false);
      return;
    }

    const temporizador = setTimeout(() => {
      controlador.current?.abort();
      const meu = new AbortController();
      controlador.current = meu;
      setAProcurar(true);
      procurarLocalidades(termo, { signal: meu.signal })
        .then((lista) => {
          if (meu.signal.aborted) return;
          setSugestoes(lista);
          setAberto(true);
        })
        // Falhar aqui não é um erro para mostrar: é só ficar sem sugestões.
        // Quem está sem rede está a escrever a localização à mão, e um aviso
        // por cima do teclado só o atrapalhava.
        .catch(() => {
          if (!meu.signal.aborted) setSugestoes([]);
        })
        .finally(() => {
          if (!meu.signal.aborted) setAProcurar(false);
        });
    }, ESPERA_MS);

    return () => clearTimeout(temporizador);
  }, [value]);

  // Cancela o pedido pendente se o ecrã fechar a meio da escrita.
  useEffect(() => () => controlador.current?.abort(), []);

  function escolher(l: Localidade) {
    escolhido.current = l.etiqueta;
    onChangeText(l.etiqueta);
    setSugestoes([]);
    setAberto(false);
  }

  const mostrarLista = aberto && sugestoes.length > 0;

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          height: sizes.input,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: mostrarLista ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
        }}>
        <Icon name="map-marker" size="md" color={colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={(t) => {
            escolhido.current = null;
            onChangeText(t);
          }}
          onFocus={() => setAberto(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={autoFocus}
          style={{ flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 17, color: colors.text }}
        />
        {aProcurar ? <Icon name="dots-horizontal" size="md" color={colors.textMuted} /> : null}
        {value.length > 0 && !aProcurar ? (
          <Pressable
            onPress={() => {
              escolhido.current = null;
              onChangeText('');
              setSugestoes([]);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Limpar localização">
            <Icon name="close-circle" size="md" color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {mostrarLista ? (
        <View
          style={[
            {
              marginTop: spacing.xs,
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              overflow: 'hidden',
            },
            shadow.md,
          ]}>
          {/* Uma lista curta (8 no máximo) mas com rolamento: com a letra do
              sistema ampliada, cada linha ocupa o dobro. */}
          <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
            {sugestoes.map((l, i) => (
              <Pressable
                key={l.id}
                onPress={() => escolher(l)}
                accessibilityRole="button"
                accessibilityLabel={l.etiqueta}
                style={({ pressed }) => [
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderBottomWidth: i < sugestoes.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  },
                  pressed && { backgroundColor: colors.primaryTint },
                ]}>
                <Icon name="map-marker-outline" size="md" color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {l.nome}
                  </Text>
                  {l.regiao || l.pais ? (
                    <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>
                      {[l.regiao, l.pais].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
