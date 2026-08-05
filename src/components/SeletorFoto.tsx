import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Button, Icon, type IconName, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { escolherDaGaleria, suportaCamera, tirarFoto, type ResultadoFoto } from '@/data/foto';
import { colors, radii, spacing } from '@/theme';

/**
 * Escolher/tirar uma fotografia, num formulário.
 * ------------------------------------------------------------------
 * Mostra a foto atual (ou uma silhueta) e dá dois botões grandes — câmara e
 * galeria — mais "remover" quando já há foto. Sem folhas de ação escondidas:
 * alvos grandes e à vista, para o utilizador-alvo.
 *
 * Só mexe numa string (o data URI); quem guarda é o formulário. A redução da
 * imagem e as permissões ficam em `data/foto.ts`.
 *
 * Serve o animal, a exploração e o terreno. Era só do animal (chamava-se
 * `FotoAnimal`) e ficou geral quando o criador pediu o mesmo para os outros
 * dois: um segundo componente quase igual seria um sítio a mais para a
 * permissão de câmara ficar por tratar.
 */
export function SeletorFoto({
  foto,
  onMudar,
  icone,
  assunto,
  forma = 'circulo',
}: {
  foto?: string;
  onMudar: (dataUri: string | undefined) => void;
  /** Silhueta para o vazio (a espécie do animal, o celeiro, a pastagem). */
  icone: IconName;
  /** Como referir isto nas mensagens: "do animal", "da exploração", "do terreno". */
  assunto: string;
  /**
   * `circulo` para o animal (é assim que aparece na lista e na ficha);
   * `cartao` para a exploração e o terreno, que são paisagens — num círculo de
   * 120px um lameiro fica um recorte verde sem nada que se reconheça.
   */
  forma?: 'circulo' | 'cartao';
}) {
  const [aProcessar, setAProcessar] = useState(false);
  const cartao = forma === 'cartao';

  async function correr(acao: () => Promise<ResultadoFoto>) {
    if (aProcessar) return;
    setAProcessar(true);
    try {
      const r = await acao();
      if (r.estado === 'ok') onMudar(r.dataUri);
      else if (r.estado === 'sem-permissao') {
        avisar(
          'Sem autorização',
          'O telemóvel está a bloquear o acesso à câmara ou às fotografias. Pode autorizá-lo nas definições do sistema.',
        );
      }
      // 'cancelado' — o criador fechou o seletor; não se diz nada.
    } catch (e) {
      avisar('Não foi possível usar a fotografia', e instanceof Error ? e.message : String(e));
    } finally {
      setAProcessar(false);
    }
  }

  return (
    <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
      <Pressable
        onPress={() => void correr(suportaCamera ? tirarFoto : escolherDaGaleria)}
        disabled={aProcessar}
        accessibilityRole="button"
        accessibilityLabel={
          foto ? `Mudar a fotografia ${assunto}` : `Adicionar uma fotografia ${assunto}`
        }
        style={({ pressed }) => [
          {
            width: cartao ? '100%' : 120,
            height: cartao ? 168 : 120,
            borderRadius: cartao ? radii.lg : radii.pill,
            backgroundColor: colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.border,
            overflow: 'hidden',
          },
          pressed && { opacity: 0.85 },
        ]}>
        {foto ? (
          <Image source={{ uri: foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Icon name={icone} size={56} color={colors.primary} />
        )}
        {aProcessar ? (
          <View
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: colors.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : null}
        {/* Emblema de câmara, para se perceber que se toca. */}
        <View
          style={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            width: 34,
            height: 34,
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: colors.surface,
          }}>
          <Icon name="camera" size="sm" color={colors.onPrimary} />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        {suportaCamera ? (
          <Button
            label="Tirar foto"
            icon="camera"
            variant="secondary"
            fullWidth={false}
            onPress={() => void correr(tirarFoto)}
          />
        ) : null}
        <Button
          label={suportaCamera ? 'Galeria' : 'Escolher foto'}
          icon="image-multiple-outline"
          variant="secondary"
          fullWidth={false}
          onPress={() => void correr(escolherDaGaleria)}
        />
      </View>
      {foto ? (
        <Pressable
          onPress={() => onMudar(undefined)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remover a fotografia"
          style={({ pressed }) => [{ marginTop: spacing.xs, padding: 4 }, pressed && { opacity: 0.6 }]}>
          <Text variant="secondary" color={colors.danger}>
            Remover fotografia
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
