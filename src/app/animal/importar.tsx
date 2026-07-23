import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Header, Icon, Text } from '@/components/ui';
import type { LinhaImportacao, ResultadoImportacao } from '@/data/animalExcel';
import {
  descarregarTemplate,
  escolherELerExcel,
  importacaoDisponivel,
} from '@/data/animalExcelFicheiro';
import { avisar } from '@/data/avisos';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Importar animais de um ficheiro Excel.
 * ------------------------------------------------------------------
 * Três passos: escolher a exploração, descarregar o modelo para preencher, e
 * carregar o ficheiro. Antes de gravar mostra-se sempre uma pré-visualização —
 * quantos entram e o que está mal — porque uma importação que grava às cegas é
 * das poucas ações da app capaz de sujar o efetivo com dezenas de linhas de uma
 * vez. A leitura do ficheiro é do computador/web (ver `animalExcelFicheiro`).
 */
export default function ImportarAnimaisScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
  const { animais, exploracoes, importarAnimais } = useGado();
  const { pode, contaSuspensa } = useMembros();

  const editaveis = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'editarAnimais')),
    [exploracoes, pode],
  );

  // Brincos já na conta — para saltar animais repetidos ao importar. Um brinco
  // é único, por isso conta o efetivo todo, não só o da exploração de destino.
  const brincosExistentes = useMemo(
    () => animais.map((a) => a.numeroIdentificacao).filter((b): b is string => !!b),
    [animais],
  );

  const [exploracaoId, setExploracaoId] = useState(editaveis[0]?.id ?? '');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [aLer, setALer] = useState(false);
  const [aImportar, setAImportar] = useState(false);

  // Offline-first: as explorações podem chegar da cache depois do 1.º render.
  // Sem isto, quem abre este ecrã antes de os dados assentarem ficava sem
  // nenhuma escolhida e com o botão de importar desativado sem razão aparente.
  useEffect(() => {
    if (!exploracaoId && editaveis.length > 0) setExploracaoId(editaveis[0].id);
  }, [editaveis, exploracaoId]);

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  const prontos = useMemo(
    () => (resultado ? resultado.linhas.filter((l) => l.dados) : []),
    [resultado],
  );
  const comErro = useMemo(
    () => (resultado ? resultado.linhas.filter((l) => l.erros.length > 0) : []),
    [resultado],
  );
  const comAviso = useMemo(
    () => (resultado ? resultado.linhas.filter((l) => l.dados && l.avisos.length > 0) : []),
    [resultado],
  );
  const comDuplicado = useMemo(
    () => (resultado ? resultado.linhas.filter((l) => l.duplicado) : []),
    [resultado],
  );

  async function escolherFicheiro() {
    if (aLer) return;
    setALer(true);
    try {
      const r = await escolherELerExcel(brincosExistentes);
      if (r) setResultado(r);
    } catch (e) {
      avisar('Não foi possível ler o ficheiro', e instanceof Error ? e.message : String(e));
    } finally {
      setALer(false);
    }
  }

  async function confirmarImportar() {
    if (!resultado || aImportar || !exploracaoId || prontos.length === 0) return;
    setAImportar(true);
    try {
      const dados = prontos.map((l) => l.dados!);
      const { criados, falhas } = await importarAnimais(exploracaoId, dados);
      const exp = editaveis.find((e) => e.id === exploracaoId);
      if (falhas.length === 0) {
        avisar(
          'Importação concluída',
          `Foram importados ${criados} animais para "${exp?.nome ?? ''}".`,
        );
      } else {
        const nomes = falhas.slice(0, 5).map((f) => f.rotulo).join(', ');
        avisar(
          'Importação parcial',
          `Entraram ${criados}. O servidor recusou ${falhas.length}` +
            `${nomes ? ` (${nomes}${falhas.length > 5 ? '…' : ''})` : ''}.`,
        );
      }
      router.back();
    } catch (e) {
      avisar('Não foi possível importar', e instanceof Error ? e.message : String(e));
    } finally {
      setAImportar(false);
    }
  }

  // No telemóvel não há seletor de ficheiros sem um módulo nativo novo — a
  // importação é do computador/web. Diz-se, em vez de mostrar um botão morto.
  if (!importacaoDisponivel) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Importar de Excel" />
        <View style={{ ...conteudo, paddingTop: spacing.xl }}>
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Icon name="laptop" size="lg" color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Faça a importação no computador</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  Para escolher um ficheiro Excel é preciso o computador ou o site da app.
                  No telemóvel, registe os animais um a um com o botão “Registar”.
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Importar de Excel" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={conteudo}>
          <Text variant="secondary" color={colors.textSecondary}>
            Descarregue o modelo, preencha-o no Excel (um animal por linha) e volte aqui
            para o carregar. Mostramos o que vai entrar antes de gravar.
          </Text>

          {/* Passo 1 — exploração de destino */}
          <PassoTitulo numero={1} texto="Para que exploração?" />
          {contaSuspensa ? (
            <Card>
              <Text variant="secondary" color={colors.danger}>
                A conta está suspensa ou por aprovar — não é possível gravar animais.
              </Text>
            </Card>
          ) : editaveis.length === 0 ? (
            <Card>
              <Text variant="secondary" color={colors.textSecondary}>
                Não tem nenhuma exploração onde possa registar animais. Crie uma
                exploração primeiro, ou peça acesso ao dono.
              </Text>
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {editaveis.map((e) => (
                <Chip
                  key={e.id}
                  label={e.nome}
                  icon="barn"
                  selected={exploracaoId === e.id}
                  onPress={() => setExploracaoId(e.id)}
                />
              ))}
            </View>
          )}

          {/* Passo 2 — modelo */}
          <PassoTitulo numero={2} texto="Descarregar o modelo" />
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="microsoft-excel" size="lg" color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">Modelo Excel</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  Traz os cabeçalhos certos e uma folha “Instruções” com o que cada
                  coluna aceita.
                </Text>
              </View>
            </View>
            <Button
              label="Descarregar modelo"
              icon="tray-arrow-down"
              variant="secondary"
              onPress={descarregarTemplate}
              style={{ marginTop: spacing.md }}
            />
          </Card>

          {/* Passo 3 — carregar o ficheiro preenchido */}
          <PassoTitulo numero={3} texto="Carregar o ficheiro preenchido" />
          <Button
            label={aLer ? 'A ler…' : resultado ? 'Escolher outro ficheiro' : 'Escolher ficheiro Excel'}
            icon="microsoft-excel"
            variant={resultado ? 'secondary' : 'primary'}
            loading={aLer}
            onPress={() => void escolherFicheiro()}
          />

          {/* Pré-visualização */}
          {resultado ? (
            <Previsualizacao
              resultado={resultado}
              prontos={prontos.length}
              comErro={comErro}
              comAviso={comAviso}
              comDuplicado={comDuplicado}
            />
          ) : null}
        </View>
      </ScrollView>

      {/* Barra de confirmação — só depois de ler um ficheiro com animais prontos */}
      {resultado && prontos.length > 0 ? (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
          <View style={{ width: '100%', maxWidth: desktop ? layout.conteudoEstreito : undefined, alignSelf: 'center' }}>
            <Button
              label={
                aImportar
                  ? 'A importar…'
                  : `Importar ${prontos.length} animai${prontos.length > 1 ? 's' : 'l'}`
              }
              icon="check"
              loading={aImportar}
              disabled={!exploracaoId || contaSuspensa}
              onPress={() => void confirmarImportar()}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function PassoTitulo({ numero, texto }: { numero: number; texto: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
      }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.pill,
          backgroundColor: colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="bodyStrong" color={colors.primaryDark}>
          {numero}
        </Text>
      </View>
      <Text variant="label">{texto}</Text>
    </View>
  );
}

function Previsualizacao({
  resultado,
  prontos,
  comErro,
  comAviso,
  comDuplicado,
}: {
  resultado: ResultadoImportacao;
  prontos: number;
  comErro: LinhaImportacao[];
  comAviso: LinhaImportacao[];
  comDuplicado: LinhaImportacao[];
}) {
  const nada = prontos === 0 && comErro.length === 0 && comDuplicado.length === 0;
  const problemas: string[] = [];
  if (comErro.length > 0) problemas.push(`${comErro.length} com erro`);
  if (comDuplicado.length > 0) problemas.push(`${comDuplicado.length} já existem`);

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
      {/* Resumo */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon
            name={prontos > 0 ? 'check-circle-outline' : 'alert-circle-outline'}
            size="lg"
            color={prontos > 0 ? colors.success : colors.warning}
          />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              {prontos > 0
                ? `${prontos} animai${prontos > 1 ? 's' : 'l'} prontos a importar`
                : 'Nenhum animal pronto a importar'}
            </Text>
            <Text variant="secondary" color={colors.textSecondary}>
              {problemas.length > 0
                ? `${problemas.join(' · ')}.`
                : nada
                  ? 'O ficheiro não tinha linhas de animais.'
                  : 'Tudo certo, sem problemas.'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Colunas obrigatórias em falta — trava tudo */}
      {resultado.colunasEmFalta.length > 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Icon name="table-alert" size="lg" color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">Faltam colunas no ficheiro</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                Não encontrámos: {resultado.colunasEmFalta.join(', ')}. Use o modelo
                descarregado sem apagar a linha de cabeçalhos.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Linhas com erro */}
      {comErro.length > 0 ? (
        <View>
          <Text
            variant="label"
            color={colors.textSecondary}
            style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
            NÃO VÃO ENTRAR
          </Text>
          <Card>
            <View style={{ gap: spacing.sm }}>
              {comErro.map((l) => (
                <View
                  key={l.numero}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: spacing.sm,
                  }}>
                  <Text variant="bodyStrong">
                    Linha {l.numero} · {l.rotulo}
                  </Text>
                  {l.erros.map((erro, i) => (
                    <View
                      key={i}
                      style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                      <Text variant="caption" color={colors.danger}>
                        •
                      </Text>
                      <Text variant="caption" color={colors.danger} style={{ flex: 1 }}>
                        {erro}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      {/* Duplicados — brinco já existente ou repetido no ficheiro */}
      {comDuplicado.length > 0 ? (
        <View>
          <Text
            variant="label"
            color={colors.textSecondary}
            style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
            JÁ EXISTEM — NÃO IMPORTADOS
          </Text>
          <Card>
            <View style={{ gap: spacing.sm }}>
              {comDuplicado.map((l) => (
                <View
                  key={l.numero}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: spacing.sm,
                  }}>
                  <Text variant="bodyStrong">
                    Linha {l.numero} · {l.rotulo}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                    <Icon name="content-duplicate" size="sm" color={colors.textMuted} />
                    <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                      {l.duplicado === 'ja-existe'
                        ? 'Já existe um animal com este brinco — não foi importado.'
                        : 'Este brinco aparece mais do que uma vez no ficheiro.'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      {/* Avisos (linhas que entram na mesma) */}
      {comAviso.length > 0 ? (
        <View>
          <Text
            variant="label"
            color={colors.textSecondary}
            style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
            ENTRAM, MAS REPARE
          </Text>
          <Card>
            <View style={{ gap: spacing.sm }}>
              {comAviso.map((l) => (
                <View
                  key={l.numero}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                    paddingTop: spacing.sm,
                  }}>
                  <Text variant="bodyStrong">
                    Linha {l.numero} · {l.rotulo}
                  </Text>
                  {l.avisos.map((aviso, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                      <Text variant="caption" color={colors.warning}>
                        •
                      </Text>
                      <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                        {aviso}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}
