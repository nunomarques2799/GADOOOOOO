import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Card, Header, Icon, Text } from '@/components/ui';
import { avisar, confirmar } from '@/data/avisos';
import { descreverOp, lerCache } from '@/data/cacheLocal';
import { guardarFicheiro, hojeISO } from '@/data/exportar';
import { formatDataHora } from '@/data/helpers';
import { mensagemLegivel } from '@/data/supabaseRepo';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * Ver o estado da sincronização, forçar envio das alterações pendentes e
 * descarregar uma cópia de segurança do que está guardado no dispositivo.
 * Nunca apagamos nada aqui — este ecrã é seguro para o utilizador explorar.
 */
export default function SincronizacaoScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const {
    online,
    erroSincronizacao,
    pendentesSinc,
    falhadas,
    limparFalhadas,
    animais,
    exploracoes,
    terrenos,
    eventos,
    recarregar,
  } = useGado();

  const [aSincronizar, setASincronizar] = useState(false);

  const nConflitos = falhadas.filter((f) => f.motivo === 'conflito').length;

  function confirmarLimparFalhadas() {
    confirmar(
      t('sinc.esquecerTitulo'),
      t('sinc.esquecerMensagem'),
      limparFalhadas,
      { rotuloConfirmar: t('sinc.esquecer') },
    );
  }

  async function sincronizarAgora() {
    if (aSincronizar) return;
    setASincronizar(true);
    try {
      await recarregar();
    } finally {
      setASincronizar(false);
    }
  }

  async function descarregarCopia() {
    // A cópia de segurança é a mesma estrutura que a app usa em memória —
    // se um dia for preciso recuperar, é o suficiente para reconstruir tudo.
    const dados = lerCache() ?? { animais, exploracoes, terrenos, eventos };
    const json = JSON.stringify(
      {
        gerado: new Date().toISOString(),
        versao: 1,
        ...dados,
      },
      null,
      2,
    );
    await guardarFicheiro(`copia-gado-${hojeISO()}.json`, json, 'application/json');
    avisar(
      t('sinc.copiaGuardada'),
      t('sinc.copiaGuardadaTexto'),
    );
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  } as const;

  const estadoRotulo = !online
    ? t('sinc.offline')
    : pendentesSinc > 0
      ? t('sinc.aSincronizar')
      : t('sinc.sincronizado');
  const estadoTom = !online ? 'warning' : pendentesSinc > 0 ? 'info' : 'success';
  const estadoIcone = !online
    ? 'cloud-off-outline'
    : pendentesSinc > 0
      ? 'cloud-sync-outline'
      : 'cloud-check-outline';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('definicoes.sincronizacao')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          alignItems: 'center',
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
        }}>
        <View style={conteudo}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radii.pill,
                  backgroundColor:
                    estadoTom === 'warning'
                      ? colors.warningTint
                      : estadoTom === 'info'
                        ? colors.infoTint
                        : colors.successTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Icon
                  name={estadoIcone}
                  size="lg"
                  color={
                    estadoTom === 'warning'
                      ? colors.warning
                      : estadoTom === 'info'
                        ? colors.info
                        : colors.success
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{estadoRotulo}</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  {!online
                    ? t('sinc.semLigacao')
                    : pendentesSinc > 0
                      ? `${pendentesSinc} alteração${pendentesSinc > 1 ? 'ões' : ''} por enviar.`
                      : t('sinc.tudoEnviado')}
                </Text>
              </View>
            </View>

            <Button
              label={aSincronizar ? t('sinc.aSincronizarPontos') : t('sinc.sincronizarAgora')}
              icon="refresh"
              variant="secondary"
              onPress={() => void sincronizarAgora()}
              loading={aSincronizar}
              style={{ marginTop: spacing.md }}
            />
          </Card>

          {/* Porque é que a leitura falhou, tal como o servidor a explicou.
              A mensagem é técnica e em inglês, e fica assim de propósito: não
              é para o criador a perceber, é para a poder ler ao telefone a
              quem o ajuda. Traduzi-la perdia exatamente a parte que serve
              para encontrar o problema. */}
          {erroSincronizacao ? (
            <View>
              <Text
                variant="label"
                color={colors.textSecondary}
                style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
                O SERVIDOR RECUSOU A LEITURA
              </Text>
              <Card>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <Icon name="cloud-alert" size="lg" color={colors.warning} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text variant="secondary" color={colors.textSecondary}>
                      O que está no ecrã é a última cópia guardada neste aparelho, e pode
                      estar desatualizada. O servidor respondeu:
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.surfaceSunken,
                        borderRadius: radii.md,
                        padding: spacing.sm,
                      }}>
                      <Text variant="secondary" color={colors.text}>
                        {erroSincronizacao}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </View>
          ) : null}

          {/* Alterações que o servidor recusou. Só aparece se houver alguma —
              é o sítio onde deixam de se perder em silêncio. */}
          {falhadas.length > 0 ? (
            <View>
              <Text
                variant="label"
                color={colors.textSecondary}
                style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
                {nConflitos > 0 ? t('sinc.perdidas') : t('sinc.semGravar')}
              </Text>
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Icon name="alert-circle-outline" size="lg" color={colors.danger} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">
                        {falhadas.length} alteraç{falhadas.length > 1 ? 'ões' : 'ão'} não
                        guardada{falhadas.length > 1 ? 's' : ''}
                      </Text>
                      <Text variant="secondary" color={colors.textSecondary}>
                        {nConflitos > 0
                          ? t('sinc.perdidasTexto')
                          : t('sinc.recusadasTexto')}
                      </Text>
                    </View>
                  </View>

                  <View>
                    {falhadas.map((f, i) => {
                      const conflito = f.motivo === 'conflito';
                      return (
                        <View
                          key={`${f.em}-${i}`}
                          style={{
                            paddingVertical: spacing.sm,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: spacing.xs,
                              flexWrap: 'wrap',
                            }}>
                            <Text variant="bodyStrong">{descreverOp(f.op)}</Text>
                            <Badge
                              tone={conflito ? 'warning' : 'danger'}
                              icon={conflito ? 'account-sync-outline' : 'lock-outline'}
                              label={conflito ? 'alterado por outra pessoa' : 'sem permissão'}
                            />
                          </View>
                          <Text variant="caption" color={colors.textSecondary}>
                            {formatDataHora(f.em)}
                          </Text>
                          <Text
                            variant="caption"
                            color={conflito ? colors.warning : colors.danger}
                            style={{ marginTop: 2 }}
                            numberOfLines={3}>
                            {mensagemLegivel(f.erro)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <Button
                    label={t('sinc.esquecerLista')}
                    icon="check"
                    variant="secondary"
                    onPress={confirmarLimparFalhadas}
                  />
                </View>
              </Card>
            </View>
          ) : null}

          <View>
            <Text
              variant="label"
              color={colors.textSecondary}
              style={{ marginBottom: spacing.xs, marginLeft: spacing.xs }}>
              CÓPIA DE SEGURANÇA
            </Text>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="database-arrow-down-outline" size="lg" color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">Descarregar cópia dos dados</Text>
                    <Text variant="secondary" color={colors.textSecondary}>
                      Um único ficheiro com tudo o que está no dispositivo:
                      explorações, terrenos, animais e histórico. Útil para
                      guardar noutro sítio, por precaução.
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                  <Badge tone="neutral" icon="barn" label={`${exploracoes.length} explor.`} />
                  <Badge tone="neutral" icon="grass" label={`${terrenos.length} terrenos`} />
                  <Badge tone="brand" icon="cow" label={`${animais.length} animais`} />
                  <Badge
                    tone="neutral"
                    icon="calendar-text-outline"
                    label={`${eventos.length} eventos`}
                  />
                </View>

                <Button
                  label={t('sinc.descarregarCopia')}
                  icon="file-download-outline"
                  variant="secondary"
                  onPress={() => void descarregarCopia()}
                />
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
