import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useRef } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { PontosEmLinha, rotuloDoSinal } from '@/components/SinaisAnimal';
import { Badge, Icon, Text } from '@/components/ui';
import { semMovimento } from '@/components/ui/movimento';
import { iniciarVoo } from '@/components/VooAnimal';
import { especieMeta } from '@/data/constants';
import { idadeExtenso } from '@/data/helpers';
import { sinaisDe } from '@/data/sinaisAlerta';
import type { Alerta, Animal } from '@/data/types';
import { t } from '@/i18n';
import { colors, fontFamily, radii, spacing, type } from '@/theme';

/**
 * Onde a linha fica no cartão da lista.
 *
 * No telemóvel a lista é UM cartão, com as linhas separadas por uma risca
 * (guia de estilo); no computador, em grelha de duas colunas, cada animal é o
 * seu cartão (`unico`). A linha não sabe quem são as vizinhas, por isso quem
 * a desenha diz-lhe se é a primeira, a do meio ou a última.
 */
export type PosicaoNaLista = 'unico' | 'primeiro' | 'meio' | 'ultimo';

/** A primeira letra do nome, para o retrato. Sem nome não há letra: fica o desenho da espécie. */
export function inicialDoAnimal(a: Pick<Animal, 'nome'>): string | undefined {
  const l = a.nome?.trim()[0];
  return l ? l.toLocaleUpperCase('pt-PT') : undefined;
}

/**
 * O retrato do animal: a fotografia, ou a inicial do nome em Fraunces sobre
 * areia (guia de estilo), ou, sem nome, o desenho da espécie. É o mesmo na
 * lista e na ficha, e é por isso que pode "voar" de uma para a outra.
 */
export function RetratoAnimal({
  animal,
  tamanho,
}: {
  animal: Pick<Animal, 'nome' | 'especie' | 'fotografia'>;
  tamanho: number;
}) {
  const inicial = inicialDoAnimal(animal);
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
      {animal.fotografia ? (
        <Image
          source={{ uri: animal.fotografia }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : inicial ? (
        <Text
          style={{
            fontFamily: fontFamily.titulo,
            fontSize: Math.round(tamanho * 0.46),
            lineHeight: Math.round(tamanho * 0.58),
            color: colors.primaryDark,
          }}
          maxFontSizeMultiplier={1}>
          {inicial}
        </Text>
      ) : (
        <Icon name={especieMeta[animal.especie].icon} size={Math.round(tamanho * 0.52)} color={colors.primaryDark} />
      )}
    </View>
  );
}

/**
 * Uma linha da lista de animais.
 *
 * `nomeTerreno` e `alertas` vêm já resolvidos de fora, e não de um `useGado()`
 * aqui dentro: numa lista de trezentos animais eram trezentas subscrições ao
 * store, e cada sincronização remexia a lista toda (ver `animais.tsx`, onde uns
 * e outros se resolvem uma vez só, em mapas memoizados). O `memo` fecha o ciclo:
 * sem novas props, a linha não volta a desenhar-se quando é outra que muda.
 */
export const AnimalRow = memo(function AnimalRow({
  animal,
  nomeTerreno,
  alertas,
  posicao = 'unico',
  compacto = false,
}: {
  animal: Animal;
  nomeTerreno?: string;
  /**
   * As categorias de alerta pendentes DESTE animal (de `mapaAlertas`). O
   * conjunto tem de ser estável entre renders, senão o `memo` deixa de servir
   * para alguma coisa.
   */
  alertas?: ReadonlySet<Alerta['categoria']>;
  posicao?: PosicaoNaLista;
  /**
   * Ecrã estreito (ou letra muito ampliada, ver `useEstreito`): o retrato
   * encolhe e a etiqueta do sexo desce para debaixo do nome. Na coluna da
   * direita deixava o nome reduzido a uma letra.
   */
  compacto?: boolean;
}) {
  const router = useRouter();
  const retrato = useRef<View>(null);
  const meta = especieMeta[animal.especie];
  const semBrinco = animal.especie === 'Bovino' && !animal.numeroIdentificacao;
  const saiu = !!animal.estado && animal.estado !== 'ativo';
  /**
   * Um registo que ainda não tem por onde se lhe pegar: nem nome nem brinco.
   *
   * É o estado em que nasce a cria criada automaticamente ao registar um parto
   * (ver `evento/novo.tsx`) — existe, conta para o efetivo e já tem o prazo de
   * identificação a correr, mas na lista aparecia como mais um "Sem nome / Sem
   * brinco" entre iguais. A etiqueta diz que falta ali alguma coisa, e é o que
   * leva alguém a abrir a ficha e a completá-la.
   */
  const porCompletar = !saiu && !animal.nome && !animal.numeroIdentificacao;

  const femea = animal.sexo === 'Fêmea';
  const etiquetaSexo = (
    <Badge tone={femea ? 'femea' : 'macho'} label={femea ? t('evento.femea') : t('evento.macho')} />
  );

  // Os pontos coloridos ao lado do nome. Uma cor não se lê num leitor de
  // ecrã, por isso o que eles dizem entra também na etiqueta falada da linha.
  const sinais = sinaisDe(alertas);

  const abrir = () => {
    // Mede onde está o retrato para ele "voar" até ao topo da ficha (ver
    // `VooAnimal.tsx`). A ficha abre em fade por causa do `voo`; sem a
    // medida, abre como sempre.
    const ir = (comVoo: boolean) =>
      router.push({
        pathname: '/animal/[id]',
        params: comVoo ? { id: animal.id, voo: '1' } : { id: animal.id },
      });
    const r = retrato.current;
    if (!r || semMovimento()) return ir(false);
    r.measureInWindow((x, y, w, h) => {
      if (!w || !h) return ir(false);
      iniciarVoo({
        id: animal.id,
        de: { x, y, w, h },
        foto: animal.fotografia,
        icone: meta.icon,
        inicial: inicialDoAnimal(animal),
        cor: colors.primaryDark,
        fundo: colors.surfaceAlt,
      });
      ir(true);
    });
  };

  const rotuloFalado = `${animal.nome ?? t('ficha.animal')}, ${animal.especie}, ${idadeExtenso(
    animal.dataNascimento,
  )}${
    porCompletar
      ? `, ${t('animais.faladoPorCompletar')}`
      : semBrinco
        ? `, ${t('animais.faladoSemBrinco')}`
        : ''
  }${sinais.length > 0 ? `. ${t('sinal.falado')}: ${sinais.map(rotuloDoSinal).join(', ')}` : ''}`;

  return (
    <Pressable
      onPress={abrir}
      accessibilityRole="button"
      accessibilityLabel={rotuloFalado}
      style={({ pressed }) => [
        moldura(posicao),
        { opacity: saiu ? 0.7 : 1 },
        pressed && { backgroundColor: colors.surfaceSunken },
      ]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: compacto ? 'flex-start' : 'center',
          padding: compacto ? spacing.sm : spacing.md,
          gap: spacing.sm,
        }}>
        <View ref={retrato} collapsable={false}>
          <RetratoAnimal animal={animal} tamanho={compacto ? 44 : 56} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="h3" numberOfLines={compacto ? 2 : 1} style={{ flexShrink: 1 }}>
              {animal.nome ?? t('animais.semNome')}
            </Text>
            {/* O número da casa, em mono como os brincos: é como o animal é
                chamado na exploração ("a 47"). */}
            {animal.numeroCasa ? (
              <Text style={[type.mono, { color: colors.textSecondary }]} numberOfLines={1}>
                {t('animais.numero', { n: animal.numeroCasa })}
              </Text>
            ) : null}
            <PontosEmLinha sinais={sinais} />
          </View>
          <Text variant="secondary" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: 2 }}>
            {animal.raca ?? animal.especie} · {idadeExtenso(animal.dataNascimento)} ·{' '}
            {animal.numeroIdentificacao ? (
              // Um ponto abaixo do resto: o Plex Mono é mais largo e mais alto
              // do que o Atkinson ao mesmo tamanho, e o brinco saltava da linha.
              <Text
                variant="secondary"
                style={{ fontFamily: fontFamily.mono, fontSize: 14 }}
                color={colors.textSecondary}>
                {animal.numeroIdentificacao}
              </Text>
            ) : (
              t('animais.semBrinco')
            )}
          </Text>
          {nomeTerreno ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <Icon name="map-marker-outline" size={14} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
                {nomeTerreno}
              </Text>
            </View>
          ) : null}
          {compacto ||
          animal.estado === 'falecido' ||
          animal.estado === 'vendido' ||
          animal.estado === 'eliminado' ||
          porCompletar ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {compacto ? etiquetaSexo : null}
              {animal.estado === 'falecido' ? (
                <Badge tone="neutral" icon="grave-stone" label={t('ficha.falecido')} />
              ) : null}
              {animal.estado === 'vendido' ? <Badge tone="info" icon="cash" label={t('ficha.vendido')} /> : null}
              {animal.estado === 'eliminado' ? (
                <Badge tone="danger" icon="trash-can-outline" label={t('ficha.eliminado')} />
              ) : null}
              {porCompletar ? (
                <Badge tone="warning" icon="pencil-outline" label={t('animais.porCompletar')} />
              ) : null}
            </View>
          ) : null}
        </View>

        {/* O sexo numa etiqueta da sua cor, com a palavra lá dentro: a cor
            sozinha não diz nada a um em cada doze homens. */}
        {compacto ? null : etiquetaSexo}
      </View>
    </Pressable>
  );
});

/** A moldura de cada linha: cartão inteiro, ou um pedaço do cartão da lista. */
function moldura(posicao: PosicaoNaLista): ViewStyle {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  };
  if (posicao === 'unico') {
    return { ...base, borderWidth: 1, borderRadius: radii.lg, marginBottom: spacing.sm };
  }
  if (posicao === 'primeiro') {
    return {
      ...base,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    };
  }
  if (posicao === 'ultimo') {
    return {
      ...base,
      borderBottomWidth: 1,
      borderBottomLeftRadius: radii.lg,
      borderBottomRightRadius: radii.lg,
      marginBottom: spacing.sm,
    };
  }
  // A risca entre linhas é a de baixo de cada uma: a última fecha o cartão.
  return { ...base, borderBottomWidth: 1 };
}
