import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AnimalRow } from '@/components/AnimalRow';
import { CartaoTitulo } from '@/components/CartaoTitulo';
import { FolhaMoverAnimais } from '@/components/FolhaMoverAnimais';
import { BotoesDirecoes } from '@/components/mapa/BotoesDirecoes';
import { MapaLocalizacao } from '@/components/mapa/MapaLocalizacao';
import {
  Button,
  Card,
  Colunas,
  EmptyState,
  Header,
  Icon,
  Screen,
  Text,
} from '@/components/ui';
import { tipoTerrenoMeta } from '@/data/constants';
import { mapaAlertas } from '@/data/filtrosAnimais';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

export default function TerrenoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const desktop = useDesktop();
  const { terrenoById, exploracaoById, animais, terrenosByExploracao, alertas } = useGado();
  const { pode } = useMembros();
  const [moverAberto, setMoverAberto] = useState(false);
  // Antes do `return` do terreno que não existe: um hook não pode ficar depois
  // de uma saída antecipada.
  const porAnimal = useMemo(() => mapaAlertas(alertas), [alertas]);

  const terreno = id ? terrenoById(id) : undefined;
  // O veterinário trata dos animais, não do património — não edita terrenos.
  const podeEditar = pode(terreno?.exploracaoId, 'gerirTerrenos');
  // Mudar o gado de cercado é mexer nos ANIMAIS, não no terreno: quem regista o
  // efetivo pode fazê-lo, mesmo sem poder editar o terreno em si.
  const podeMexerNoEfetivo = pode(terreno?.exploracaoId, 'editarAnimais');

  if (!terreno) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('formTerreno.terreno')} />
        <EmptyState icon="map-marker" title={t('formTerreno.naoEncontrado')} message={t('ficha.jaNaoExiste')} />
      </View>
    );
  }

  const meta = tipoTerrenoMeta[terreno.tipo ?? 'Outro'];
  const exploracao = exploracaoById(terreno.exploracaoId);
  const animaisNoTerreno = animais.filter((a) => a.terrenoId === terreno.id);
  /** Para onde é que o gado daqui pode ir — os outros cercados da mesma quinta. */
  const outrosTerrenos = terrenosByExploracao(terreno.exploracaoId).filter(
    (t) => t.id !== terreno.id,
  );
  const temCoords = terreno.latitude != null && terreno.longitude != null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        // No computador o nome já está no cartão de baixo, em grande.
        title={desktop ? '' : terreno.nome}
        actionIcon={podeEditar ? 'pencil-outline' : undefined}
        onAction={podeEditar ? () => router.push(`/terreno/editar/${terreno.id}`) : undefined}
      />
      <Screen>
        {/* O cartão do topo, no estilo do guia (ver `CartaoTitulo`). */}
        <CartaoTitulo
          fotografia={terreno.fotografia}
          icone={meta.icon}
          titulo={terreno.nome}
          iconeLinha="barn"
          linha={exploracao?.nome ?? t('ficha.semExploracao')}
          numeros={[
            { valor: terreno.tipo ?? 'Outro', rotulo: t('formTerreno.tipo') },
            {
              valor: terreno.area != null ? `${terreno.area} ha` : t('detTerreno.semArea'),
              rotulo: t('detTerreno.area'),
            },
            { valor: animaisNoTerreno.length, rotulo: t('nav.animais') },
          ]}
        />

        {/* Mapa + direções */}
        {/* No computador, o mapa e a descrição à esquerda e o gado do
            terreno à direita (ver `Colunas`). */}
        <Colunas
          proporcao={[3, 2]}
          esquerda={
        <>
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
          {t('ficha.localizacao')}
        </Text>
        {temCoords ? (
          <>
            {/* Alto, não uma faixa. A 200px o mapa era uma tira em que só cabia
                o pino: para perceber onde fica o cercado em relação ao caminho
                e ao vizinho era preciso arrastar às cegas. Em ecrã largo cresce
                mais, que é onde há espaço para isso. */}
            <MapaLocalizacao
              latitude={terreno.latitude}
              longitude={terreno.longitude}
              altura={desktop ? 460 : 340}
            />
            <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
              {t('detTerreno.comoChegar')}
            </Text>
            <BotoesDirecoes latitude={terreno.latitude!} longitude={terreno.longitude!} nome={terreno.nome} />
          </>
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="map-marker-off" size="lg" color={colors.textMuted} />
              <Text variant="body" style={{ flex: 1 }}>
                {t('detTerreno.semLocalizacao')}
              </Text>
            </View>
          </Card>
        )}

        {/* Características */}
        {terreno.descricao ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.xs }}>
              {t('formTerreno.descricao')}
            </Text>
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                {terreno.descricao}
              </Text>
            </Card>
          </>
        ) : null}

        </>
          }
          direita={
        <>
        {/* Animais no terreno */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.xl,
            marginBottom: spacing.xs,
          }}>
          <Text variant="h3">
            {t('nav.animais')} ({animaisNoTerreno.length})
          </Text>
        </View>

        {animaisNoTerreno.length === 0 ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              {t('detTerreno.semAnimais')}
            </Text>
          </Card>
        ) : (
          // Sem `nomeTerreno`: são todos deste terreno, repetir o nome em cada
          // linha era ruído.
          animaisNoTerreno.map((a) => (
            <AnimalRow key={a.id} animal={a} alertas={porAnimal.get(a.id)} />
          ))
        )}

        <Button
          label={t('associar.titulo')}
          icon="cow"
          variant="secondary"
          onPress={() => router.push(`/terreno/animais/${terreno.id}`)}
          style={{ marginTop: spacing.sm }}
        />

        {/* Mudar o rebanho todo de pasto. Só aparece quando há gado para mudar
            E outro terreno para onde o mandar — sem uma das duas coisas, é um
            botão que abre uma lista vazia. */}
        {podeMexerNoEfetivo && animaisNoTerreno.length > 0 && outrosTerrenos.length > 0 ? (
          <Button
            label={`Mudar os ${animaisNoTerreno.length} para outro terreno`}
            icon="transfer-right"
            variant="secondary"
            onPress={() => setMoverAberto(true)}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
        </>
          }
        />
      </Screen>

      <FolhaMoverAnimais
        aberto={moverAberto}
        origem={terreno}
        destinos={outrosTerrenos}
        animais={animaisNoTerreno}
        onFechar={() => setMoverAberto(false)}
      />
    </View>
  );
}

