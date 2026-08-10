import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Chip, Header, Icon, Text } from '@/components/ui';
import type { LinhaImportacao, ResultadoImportacao } from '@/data/animalExcel';
import {
  descarregarTemplate,
  escolherELerExcel,
  ErroExcel,
} from '@/data/animalExcelFicheiro';
import { avisar } from '@/data/avisos';
import { excelDisponivel } from '@/data/excelFicheiro';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
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
  const toast = useToasts();

  const editaveis = useMemo(
    () => exploracoes.filter((e) => pode(e.id, 'editarAnimais')),
    [exploracoes, pode],
  );

  const [exploracaoId, setExploracaoId] = useState(editaveis[0]?.id ?? '');
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null);
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

  /**
   * Lê o ficheiro escolhido. O erro fica no ecrã (e não só num alerta que se
   * fecha): quem carregou o ficheiro errado tem de poder ler o motivo enquanto
   * o vai corrigir no Excel.
   */
  async function escolherFicheiro() {
    if (aLer) return;
    setALer(true);
    try {
      // O efetivo todo vai para a leitura: é o que deixa saltar os animais que
      // já existem em vez de os duplicar (por ID, brinco, ou nome + nascimento).
      //
      // Menos os eliminados. Um registo eliminado continua na base para o
      // histórico, mas não aparece em lado nenhum onde se possa ver: travar a
      // importação por causa dele dava um "já existe um animal com este brinco"
      // a apontar para um animal que a app não mostra em parte nenhuma.
      const r = await escolherELerExcel(animais.filter((a) => a.estado !== 'eliminado'));
      if (r) {
        setResultado(r);
        setErro(null);
      }
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      const detalhe = e instanceof ErroExcel ? e.detalhe : undefined;
      setResultado(null);
      setErro({ mensagem, detalhe });
      // O motivo fica no ecrã (acima), por isso o aviso não precisa de exigir um
      // "OK" para se poder voltar ao Excel.
      toast.erro(t('importar.semLer'), mensagem);
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
        toast.sucesso(t('importar.nImportados', { n: criados }), exp?.nome);
      } else {
        const nomes = falhas.slice(0, 5).map((f) => f.rotulo).join(', ');
        avisar(
          t('importar.parcialTitulo'),
          t('importar.parcial', {
            entraram: criados,
            recusados: falhas.length,
            quais: nomes ? ` (${nomes}${falhas.length > 5 ? '…' : ''})` : '',
          })
            // O motivo do servidor, sem o qual sobra um "recusou" sem explicação.
            + `\n\n${t('importar.motivo', { motivo: falhas[0].erro })}`,
        );
      }
      router.back();
    } catch (e) {
      toast.erro(t('importar.semImportar'), mensagemDeErro(e));
    } finally {
      setAImportar(false);
    }
  }

  // No telemóvel não há seletor de ficheiros sem um módulo nativo novo — a
  // importação é do computador/web. Diz-se, em vez de mostrar um botão morto.
  if (!excelDisponivel) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('importar.titulo')} />
        <View style={{ ...conteudo, paddingTop: spacing.xl }}>
          <Card>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Icon name="laptop" size="lg" color={colors.info} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t('importar.noComputador')}</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  {t('importar.soNoComputador')}
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
      <Header title={t('importar.titulo')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={conteudo}>
          <Text variant="secondary" color={colors.textSecondary}>
            {t('importar.explicacao')}
          </Text>

          {/* Passo 1 — exploração de destino */}
          <PassoTitulo numero={1} texto={t('importar.paraQueExploracao')} />
          {contaSuspensa ? (
            <Card>
              <Text variant="secondary" color={colors.danger}>
                {t('importar.contaSuspensa')}
              </Text>
            </Card>
          ) : editaveis.length === 0 ? (
            <Card>
              <Text variant="secondary" color={colors.textSecondary}>
                {t('importar.semExploracoes')}
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
          <PassoTitulo numero={2} texto={t('importar.descarregarModelo')} />
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="microsoft-excel" size="lg" color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{t('importar.modeloExcel')}</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  {t('importar.modeloExplicacao')}
                </Text>
              </View>
            </View>
            <Button
              label={t('importar.descarregarModeloBotao')}
              icon="tray-arrow-down"
              variant="secondary"
              onPress={() => {
                try {
                  descarregarTemplate();
                  toast.sucesso(t('importar.modeloDescarregado'), t('importar.modeloOnde'));
                } catch (e) {
                  toast.erro(t('docs.semDescarga'), mensagemDeErro(e));
                }
              }}
              style={{ marginTop: spacing.md }}
            />
          </Card>

          {/* Passo 3 — carregar o ficheiro preenchido */}
          <PassoTitulo numero={3} texto={t('importar.carregarFicheiro')} />
          <Button
            label={
              aLer
                ? t('importar.aLer')
                : resultado
                  ? t('importar.escolherOutro')
                  : t('importar.escolherFicheiro')
            }
            icon="microsoft-excel"
            variant={resultado ? 'secondary' : 'primary'}
            loading={aLer}
            onPress={() => void escolherFicheiro()}
          />

          {/* O ficheiro não deu para ler — o motivo fica à vista */}
          {erro ? (
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Icon name="file-alert-outline" size="lg" color={colors.danger} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong" color={colors.danger}>
                    {t('importar.semLerTitulo')}
                  </Text>
                  <Text variant="secondary" color={colors.textSecondary}>
                    {erro.mensagem}
                  </Text>
                  {erro.detalhe ? (
                    <Text
                      variant="caption"
                      color={colors.textMuted}
                      style={{ marginTop: spacing.xs }}>
                      {t('importar.detalheTecnico', { detalhe: erro.detalhe })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </Card>
          ) : null}

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
                  ? t('importar.aImportar')
                  : t('importar.importarN', { n: prontos.length })
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

/**
 * Por que razão esta linha foi saltada. Dizer só "já existe" mandava o criador
 * procurar às cegas: o que ele precisa de saber é o que a app comparou (o ID
 * que o ficheiro trazia, o brinco, ou o nome com a data de nascimento).
 */
function motivoDuplicado(l: LinhaImportacao): string {
  const naConta = l.duplicado === 'ja-existe';
  switch (l.duplicadoPor) {
    case 'id':
      return naConta
        ? t('importar.dupIdNaConta')
        : t('importar.dupIdNoFicheiro');
    case 'nome-data':
      return naConta
        ? t('importar.dupNomeNaConta')
        : t('importar.dupNomeNoFicheiro');
    default:
      return naConta
        ? t('importar.dupBrincoNaConta')
        : t('importar.dupBrincoNoFicheiro');
  }
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
  if (comErro.length > 0) problemas.push(t('importar.nComErro', { n: comErro.length }));
  if (comDuplicado.length > 0) problemas.push(t('importar.nJaExistem', { n: comDuplicado.length }));

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
                ? t('importar.nProntos', { n: prontos })
                : t('importar.nenhumPronto')}
            </Text>
            <Text variant="secondary" color={colors.textSecondary}>
              {problemas.length > 0
                ? `${problemas.join(' · ')}.`
                : nada
                  ? t('importar.ficheiroVazio')
                  : t('importar.tudoCerto')}
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
              <Text variant="bodyStrong">{t('importar.faltamColunas')}</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                {t('importar.faltamColunasDetalhe', {
                  colunas: resultado.colunasEmFalta.join(', '),
                })}
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
            {t('importar.naoVaoEntrar')}
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
                    {t('importar.linha', { n: l.numero })} · {l.rotulo}
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
            {t('importar.jaExistem')}
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
                    {t('importar.linha', { n: l.numero })} · {l.rotulo}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                    <Icon name="content-duplicate" size="sm" color={colors.textMuted} />
                    <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                      {motivoDuplicado(l)}
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
            {t('importar.entramMasRepare')}
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
                    {t('importar.linha', { n: l.numero })} · {l.rotulo}
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
