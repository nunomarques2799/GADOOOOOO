import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Card, EmptyState, Header, Icon, Text } from '@/components/ui';
import { descarregarTabelaExcel, excelDisponivel } from '@/data/excelFicheiro';
import { guardarRelatorio, hojeISO, imprimirRelatorio } from '@/data/exportar';
import { formatDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import {
  comunicacoesPendentes,
  htmlRelatorioSnira,
  resumoSnira,
  rotuloComunicacao,
  tabelaSnira,
  type Pendencia,
} from '@/data/snira';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

const URL_IDIGITAL = 'https://www.idigital.dgav.pt';

/**
 * Comunicar ao SNIRA — a lista do que falta, pronta a levar para o iDigital.
 *
 * A app NÃO submete nada em nome de ninguém. O criador continua a entrar no
 * portal e a escrever lá; o que muda é chegar lá a saber exatamente o quê, em
 * que ordem, e com os dados à frente em vez de andar a saltar entre a app e o
 * formulário. É a tarde de quinta-feira que esta página existe para encurtar.
 *
 * Depois de comunicar, marca-se aqui — e é essa marca que faz o alerta calar-se
 * e o prazo deixar de contar. Marcar não é um detalhe administrativo: sem ele a
 * app ficava a avisar para sempre de uma coisa já feita, e a lista deixava de
 * se poder acreditar.
 */
export default function SniraScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { animais, eventos, exploracoes, updateAnimal, updateEvento } = useGado();
  const { podeEmAlguma, podeVer } = useMembros();
  const toast = useToasts();

  const [aMarcar, setAMarcar] = useState<string | null>(null);
  const comFicheiros = Platform.OS === 'web' && excelDisponivel;
  const podeMarcar = podeEmAlguma('editarAnimais');

  const pendentes = useMemo(() => comunicacoesPendentes(animais, eventos), [animais, eventos]);
  const resumo = useMemo(() => resumoSnira(pendentes), [pendentes]);

  /**
   * Marca uma comunicação como feita.
   *
   * O nascimento vive no ANIMAL e as outras nos EVENTOS — é a única razão para
   * haver aqui dois caminhos. Ver `supabase/schema_snira.sql`.
   */
  async function marcar(p: Pendencia) {
    if (aMarcar) return;
    setAMarcar(p.id);
    try {
      if (p.eventoId) await updateEvento(p.eventoId, { comunicadoSnira: true });
      else await updateAnimal(p.animalId, { comunicadoSnira: true });
      toast.sucesso('Marcado como comunicado', `${p.rotulo} · ${rotuloComunicacao[p.tipo]}`);
    } catch (e) {
      toast.erro('Não foi possível marcar', mensagemDeErro(e));
    } finally {
      setAMarcar(null);
    }
  }

  function exportarExcel() {
    try {
      descarregarTabelaExcel(
        `snira-${hojeISO()}.xlsx`,
        'A comunicar',
        tabelaSnira(pendentes, exploracoes),
      );
      toast.sucesso(
        'Ficheiro descarregado',
        `${pendentes.length} ${pendentes.length === 1 ? 'comunicação' : 'comunicações'}`,
      );
    } catch (e) {
      toast.erro('Não foi possível descarregar', mensagemDeErro(e));
    }
  }

  async function guardarPdf() {
    const html = htmlRelatorioSnira(pendentes, exploracoes);
    const r = await guardarRelatorio('Comunicações ao SNIRA', html, `snira-${hojeISO()}`);
    if (r.estado === 'guardado') toast.sucesso('Relatório guardado');
    else if (r.estado === 'html') toast.sucesso('Relatório descarregado', 'Abra-o e imprima para PDF.');
    else if (r.estado === 'erro') toast.erro('Não foi possível guardar', r.motivo);
  }

  // A porta é a mesma dos Documentos: quem não tem que levar o efetivo de outra
  // pessoa num ficheiro também não tem que ver a papelada dela. É gate de
  // interface, como lá — ver `permissoes.ts`.
  if (!podeVer(undefined, 'verDocumentos')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Comunicar ao SNIRA" />
        <EmptyState
          icon="lock-outline"
          title="Reservado a quem gere a exploração"
          message="As comunicações ao SNIRA são de quem responde pela exploração. Pode continuar a registar o que fizer a cada animal."
        />
      </View>
    );
  }

  const coluna = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Comunicar ao SNIRA" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={{ ...coluna, gap: spacing.md }}>
          {pendentes.length === 0 ? (
            <EmptyState
              icon="check-circle-outline"
              title="Não há nada por comunicar"
              message="Todos os nascimentos, mortes e saídas registados já foram comunicados. Quando registar um novo, ele aparece aqui com o prazo a contar."
            />
          ) : (
            <>
              {/* O resumo em três números. O que interessa é o primeiro: quantas
                  já passaram do prazo — é essa a conversa com a DGAV. */}
              <Card>
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Numero valor={resumo.total} label="Por comunicar" cor={colors.text} />
                  <Numero valor={resumo.emAtraso} label="Em atraso" cor={colors.danger} />
                  <Numero valor={resumo.urgentes} label="Até 3 dias" cor={colors.warning} />
                </View>
              </Card>

              <Card>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Icon name="information" size="md" color={colors.info} />
                  <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                    A app não comunica por si. Abra o iDigital, escreva o que está nesta lista
                    e marque aqui cada linha à medida que a for fazendo: é isso que cala o
                    aviso e para a contagem do prazo.
                  </Text>
                </View>
                <Button
                  label="Abrir o iDigital"
                  icon="open-in-new"
                  variant="secondary"
                  onPress={() => void Linking.openURL(URL_IDIGITAL)}
                  style={{ marginTop: spacing.sm }}
                />
              </Card>

              {comFicheiros ? (
                <Card padded={false}>
                  <Linha
                    icon="microsoft-excel"
                    label="Levar em Excel"
                    onPress={exportarExcel}
                  />
                  <Linha
                    icon="printer-outline"
                    label="Imprimir a folha"
                    onPress={() => {
                      if (!imprimirRelatorio('Comunicações ao SNIRA', htmlRelatorioSnira(pendentes, exploracoes))) {
                        toast.erro('Não foi possível abrir a impressão', 'O navegador bloqueou a janela.');
                      }
                    }}
                  />
                  <Linha
                    icon="file-pdf-box"
                    label="Guardar em PDF"
                    onPress={() => void guardarPdf()}
                    last
                  />
                </Card>
              ) : (
                <Card>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Icon name="laptop" size="lg" color={colors.info} />
                    <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
                      Para levar esta lista em Excel ou em papel, abra a app no computador.
                      Aqui pode conferir e marcar o que já comunicou.
                    </Text>
                  </View>
                </Card>
              )}

              <View style={{ gap: spacing.sm }}>
                {pendentes.map((p) => (
                  <LinhaPendencia
                    key={p.id}
                    pendencia={p}
                    podeMarcar={podeMarcar}
                    aMarcar={aMarcar === p.id}
                    onAbrir={() => router.push(`/animal/${p.animalId}`)}
                    onMarcar={() => void marcar(p)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Numero({ valor, label, cor }: { valor: number; label: string; cor: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h1" color={cor}>
        {valor}
      </Text>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
    </View>
  );
}

function LinhaPendencia({
  pendencia,
  podeMarcar,
  aMarcar,
  onAbrir,
  onMarcar,
}: {
  pendencia: Pendencia;
  podeMarcar: boolean;
  aMarcar: boolean;
  onAbrir: () => void;
  onMarcar: () => void;
}) {
  const atraso = pendencia.diasRestantes < 0;
  const urgente = !atraso && pendencia.diasRestantes <= 3;
  const cor = atraso ? colors.danger : urgente ? colors.warning : colors.info;

  return (
    <Card padded={false}>
      <Pressable
        onPress={onAbrir}
        accessibilityRole="button"
        accessibilityLabel={`${pendencia.rotulo}, ${rotuloComunicacao[pendencia.tipo]}`}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
          pressed && { opacity: 0.7 },
        ]}>
        <View
          style={{
            width: 4,
            alignSelf: 'stretch',
            borderRadius: 2,
            backgroundColor: cor,
          }}
        />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
              {pendencia.rotulo}
            </Text>
            <Badge tone="neutral" label={rotuloComunicacao[pendencia.tipo]} />
          </View>
          {/* O brinco é o que se escreve no portal, por isso vai à vista e não
              escondido dentro da ficha. */}
          {pendencia.brinco ? (
            <Text variant="bodyStrong" color={colors.textSecondary} style={{ marginTop: 2 }}>
              {pendencia.brinco}
            </Text>
          ) : (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 2 }}>
              Sem brinco registado. O portal precisa dele.
            </Text>
          )}
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
            {formatDataPt(pendencia.data)} · prazo {formatDataPt(pendencia.prazo)}
          </Text>
          <Text variant="secondary" color={cor} style={{ marginTop: 2 }}>
            {atraso
              ? `Em atraso há ${Math.abs(pendencia.diasRestantes)} dia(s)`
              : pendencia.diasRestantes === 0
                ? 'Último dia'
                : `Faltam ${pendencia.diasRestantes} dia(s)`}
          </Text>
        </View>
      </Pressable>

      {podeMarcar ? (
        <Pressable
          onPress={onMarcar}
          disabled={aMarcar}
          accessibilityRole="button"
          accessibilityLabel={`Marcar como comunicado: ${pendencia.rotulo}`}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              minHeight: 52,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              borderBottomLeftRadius: radii.lg,
              borderBottomRightRadius: radii.lg,
              backgroundColor: colors.primaryTint,
            },
            (pressed || aMarcar) && { opacity: 0.6 },
          ]}>
          <Icon name="check-circle-outline" size="md" color={colors.primaryDark} />
          <Text variant="button" color={colors.primaryDark}>
            {aMarcar ? 'A marcar…' : 'Já comuniquei'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function Linha({
  icon,
  label,
  onPress,
  last,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.md,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: colors.border,
        },
        pressed && { opacity: 0.6 },
      ]}>
      <Icon name={icon} size="md" color={colors.primary} />
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="chevron-right" size="sm" color={colors.textMuted} />
    </Pressable>
  );
}
