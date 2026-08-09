import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, Icon, type IconName, Text, TextField } from '@/components/ui';
import { especieMeta } from '@/data/constants';
import { SEM_TERRENO } from '@/data/filtrosAnimais';
import { normalizar } from '@/data/racas';
import type { Animal, Terreno } from '@/data/types';
import { t } from '@/i18n';
import { colors, radii, sizes, spacing } from '@/theme';

/**
 * Escolher animais — pelo terreno onde andam, não numa parede de etiquetas.
 * ------------------------------------------------------------------
 * Quem trata de gado sabe ONDE está o animal antes de saber como se chama: o
 * terreno é o filtro que ele tem na cabeça, e é por aí que a lista tem de
 * começar. Numa exploração com 400 animais, a alternativa é percorrer
 * quatrocentas etiquetas com nomes parecidos.
 *
 * São dois passos: primeiro o terreno, depois os animais que lá andam. A
 * PROCURA passa por cima dos dois — quem escreve o nome quer aquele animal, não
 * quer adivinhar primeiro em que cercado ele está.
 *
 * Nasceu dentro de `evento/novo.tsx`, onde servia para vacinar um lote inteiro.
 * Saiu para aqui quando a mesma parede de etiquetas apareceu no registo de
 * despesas — o problema era o mesmo e a resposta não devia ser escrita duas
 * vezes, com duas maneiras diferentes de se enganar.
 */
export function SeletorAnimais({
  animais,
  terrenos,
  escolhidos,
  onMudar,
  varios = false,
  vazio = 'Ainda não há animais registados.',
}: {
  /** Os animais entre os quais escolher, já filtrados e ordenados por quem chama. */
  animais: Animal[];
  /** Todos os terrenos (usa-se para dar nome aos grupos). */
  terrenos: Terreno[];
  escolhidos: string[];
  onMudar: (ids: string[]) => void;
  /** Escolha múltipla (vacinar um lote) ou um animal só. */
  varios?: boolean;
  /** O que dizer quando não há nenhum animal para escolher. */
  vazio?: string;
}) {
  const [procura, setProcura] = useState('');
  /**
   * Em que terreno se está a olhar. `null` = ainda a escolher o terreno.
   */
  const [terrenoAberto, setTerrenoAberto] = useState<string | null>(null);

  /**
   * Os animais arrumados pelo terreno onde andam.
   *
   * Os que não têm terreno atribuído vão para um grupo próprio, no fim: são
   * animais a sério e não podem desaparecer da escolha só por lhes faltar um
   * campo. Terrenos sem animais nenhuns não aparecem — seria um botão que abre
   * uma lista vazia.
   */
  const grupos = useMemo(() => {
    const nomes = new Map(terrenos.map((t) => [t.id, t.nome]));
    const porTerreno = new Map<string, Animal[]>();
    for (const a of animais) {
      const chave = a.terrenoId && nomes.has(a.terrenoId) ? a.terrenoId : SEM_TERRENO;
      const lista = porTerreno.get(chave);
      if (lista) lista.push(a);
      else porTerreno.set(chave, [a]);
    }
    return [...porTerreno.entries()]
      .map(([id, lista]) => ({
        id,
        nome: id === SEM_TERRENO ? t('filtro.semTerreno') : (nomes.get(id) ?? t('filtro.terreno')),
        animais: lista,
      }))
      .sort((x, y) => {
        // "Sem terreno" fica sempre no fim: é o resto, não um sítio.
        if (x.id === SEM_TERRENO) return 1;
        if (y.id === SEM_TERRENO) return -1;
        return x.nome.localeCompare(y.nome, 'pt');
      });
  }, [animais, terrenos]);

  /**
   * Que terreno está aberto de facto.
   *
   * Com um grupo só, o passo do terreno não decide nada — seria um toque a mais
   * para chegar exatamente à mesma lista — por isso abre-se sozinho.
   *
   * E um terreno que deixou de existir na lista volta ao passo da escolha: ao
   * trocar de "Pesagem" para "Parto" a lista passa a ser só de fêmeas, e um
   * cercado só de machos ficava aberto e vazio, sem nada por onde voltar atrás.
   */
  const aberto = terrenoAberto && grupos.some((g) => g.id === terrenoAberto) ? terrenoAberto : null;
  const grupoAberto = aberto ?? (grupos.length === 1 ? grupos[0].id : null);
  const terrenoEscolhido = grupos.find((g) => g.id === grupoAberto);

  /** O que está à vista — e é sobre isto que age o "escolher todos". */
  const aVista = useMemo(() => {
    const q = normalizar(procura.trim());
    if (q) {
      return animais.filter((a) =>
        [a.nome, a.numeroIdentificacao, a.raca, a.numeroCasa].some(
          (c) => c && normalizar(c).includes(q),
        ),
      );
    }
    return terrenoEscolhido?.animais ?? [];
  }, [animais, procura, terrenoEscolhido]);

  /** Escolhidos que a vista atual não mostra — senão gravava-se às cegas. */
  const escondidos = escolhidos.filter((id) => !aVista.some((a) => a.id === id)).length;

  function alternar(id: string) {
    if (escolhidos.includes(id)) onMudar(escolhidos.filter((x) => x !== id));
    else onMudar(varios ? [...escolhidos, id] : [id]);
  }

  if (animais.length === 0) {
    return (
      <Text variant="secondary" color={colors.textMuted}>
        {vazio}
      </Text>
    );
  }

  // Um só animal escolhido, em modo individual: o cartão com o nome e o brinco
  // confirma em quem se está a registar, e evita ter a lista toda aberta.
  const unico = !varios && escolhidos.length === 1
    ? animais.find((a) => a.id === escolhidos[0])
    : undefined;
  if (unico) {
    return <AnimalSelecionado animal={unico} onTrocar={() => onMudar([])} />;
  }

  return (
    <>
      {/* Com efetivo grande, percorrer cem etiquetas à procura de um animal é
          pior do que escrever três letras do nome. */}
      {animais.length > 8 ? (
        <View style={{ marginBottom: spacing.sm }}>
          <TextField
            value={procura}
            onChangeText={setProcura}
            placeholder={t('associar.procurar')}
            icon="magnify"
          />
        </View>
      ) : null}

      {!procura.trim() && grupoAberto === null ? (
        /* Passo 1: em que terreno. */
        <View style={{ gap: spacing.xs }}>
          <Text variant="secondary" color={colors.textSecondary}>
            {t('selAnimais.escolhaTerreno')}
          </Text>
          {grupos.map((g) => (
            <LinhaTerreno
              key={g.id}
              nome={g.nome}
              quantos={g.animais.length}
              escolhidos={g.animais.filter((a) => escolhidos.includes(a.id)).length}
              semTerreno={g.id === SEM_TERRENO}
              onPress={() => setTerrenoAberto(g.id)}
            />
          ))}
        </View>
      ) : (
        /* Passo 2: os animais desse terreno (ou o que a procura achou). */
        <>
          {!procura.trim() && terrenoEscolhido ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                marginBottom: spacing.xs,
              }}>
              <Icon name="map-marker" size="md" color={colors.primary} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {terrenoEscolhido.nome}
              </Text>
              {/* Só com mais do que um terreno: com um só, o passo nem chegou a
                  existir e este botão não levava a lado nenhum. */}
              {grupos.length > 1 ? (
                <Button
                  label={t('selAnimais.trocarTerreno')}
                  icon="swap-horizontal"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setTerrenoAberto(null)}
                />
              ) : null}
            </View>
          ) : null}

          {varios && aVista.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs }}>
              {/* Age sobre o que está à VISTA — os animais deste terreno, ou o
                  que a procura deixou — e não sobre o efetivo todo: é assim que
                  se vacina um cercado inteiro sem escolher animal a animal. */}
              <Button
                label={
                  procura.trim()
                    ? `Escolher os ${aVista.length} à vista`
                    : `Escolher os ${aVista.length} deste terreno`
                }
                icon="checkbox-multiple-marked-outline"
                variant="secondary"
                fullWidth={false}
                onPress={() => onMudar([...new Set([...escolhidos, ...aVista.map((a) => a.id)])])}
              />
              {escolhidos.length > 0 ? (
                <Button
                  label={t('comum.limpar')}
                  icon="close"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => onMudar([])}
                />
              ) : null}
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {aVista.map((a) => (
              <Chip
                key={a.id}
                label={a.nome ?? a.numeroIdentificacao ?? t('animais.semNome')}
                icon={escolhidos.includes(a.id) ? 'check' : especieMeta[a.especie].icon}
                selected={escolhidos.includes(a.id)}
                onPress={() => alternar(a.id)}
              />
            ))}
            {aVista.length === 0 ? (
              <Text variant="secondary" color={colors.textMuted}>
                {procura.trim()
                  ? `Nenhum animal corresponde a “${procura.trim()}”.`
                  : t('selAnimais.semAnimaisNoTerreno')}
              </Text>
            ) : null}
          </View>
        </>
      )}

      {/* Os que estão escolhidos noutro terreno (ou que a procura escondeu)
          continuam escolhidos — sem este aviso, gravava-se em animais que já
          não estavam à vista sem se perceber porquê. */}
      {varios && escondidos > 0 ? (
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
          Mais {escondidos} {escondidos === 1 ? 'animal escolhido' : 'animais escolhidos'} fora do
          que está à vista.
        </Text>
      ) : null}
    </>
  );
}

/**
 * Um terreno na escolha do animal: o nome, quantos animais lá andam e quantos
 * já estão escolhidos.
 *
 * Linha inteira tocável e alta, como o resto das listas de escolha da app. O
 * número de escolhidos é o que permite vacinar dois cercados seguidos sem
 * perder a conta ao voltar atrás.
 */
function LinhaTerreno({
  nome,
  quantos,
  escolhidos,
  semTerreno,
  onPress,
}: {
  nome: string;
  quantos: number;
  escolhidos: number;
  semTerreno: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nome}, ${quantos} ${quantos === 1 ? 'animal' : 'animais'}${
        escolhidos > 0 ? `, ${escolhidos} escolhidos` : ''
      }`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: sizes.touchMin,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: escolhidos > 0 ? colors.primary : colors.border,
          backgroundColor: escolhidos > 0 ? colors.primaryTint : colors.surface,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon
        name={semTerreno ? 'map-marker-off-outline' : 'map-marker'}
        size="md"
        color={escolhidos > 0 ? colors.primaryDark : colors.textSecondary}
      />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={escolhidos > 0 ? colors.primaryDark : colors.text}>
          {nome}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {quantos} {quantos === 1 ? 'animal' : 'animais'}
          {escolhidos > 0 ? ` · ${escolhidos} escolhido${escolhidos === 1 ? '' : 's'}` : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size="md" color={colors.textMuted} />
    </Pressable>
  );
}

/** Resumo do animal escolhido, com opção de trocar. */
function AnimalSelecionado({ animal, onTrocar }: { animal: Animal; onTrocar: () => void }) {
  const icone: IconName = especieMeta[animal.especie].icon;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: colors.primaryTint,
        padding: spacing.sm,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icone} size="md" color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{animal.nome ?? t('animais.semNome')}</Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {animal.numeroIdentificacao ?? t('animais.semBrinco')}
        </Text>
      </View>
      <Pressable onPress={onTrocar} accessibilityRole="button" accessibilityLabel={t('selAnimais.trocarAnimal')} hitSlop={8}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
          }}>
          <Icon name="swap-horizontal" size="sm" color={colors.primaryDark} />
          <Text variant="label" color={colors.primaryDark}>
            {t('selAnimais.trocar')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
