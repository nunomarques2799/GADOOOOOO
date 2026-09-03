import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Header, Icon, type IconName, Screen, Text } from '@/components/ui';
import { useAuth } from '@/data/auth';
import { confirmar } from '@/data/avisos';
import { configDoAmbiente, metodosConfigurados } from '@/data/loginExterno';
import { useToasts } from '@/data/toasts';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/**
 * As formas de entrar nesta conta.
 * ------------------------------------------------------------------
 * Uma conta, várias portas: o email e a palavra-passe de sempre, o Google, a
 * Apple, o telemóvel. Ligadas aqui, qualquer uma delas abre a MESMA conta — com
 * as mesmas explorações, os mesmos animais e o mesmo histórico.
 *
 * Sem isto, quem criasse conta com o email e um dia carregasse em "Continuar com
 * o Google" com o mesmo endereço ficava com DUAS contas: a segunda vazia, e sem
 * nada no ecrã que explicasse para onde tinha ido o gado. É esse o engano que
 * este ecrã existe para evitar, e por isso ele fala de "formas de entrar" e não
 * de "identidades" — a palavra do servidor não diz nada a quem a lê.
 *
 * Quem manda é o servidor: o Supabase recusa tirar a ÚLTIMA forma de entrar (e
 * ainda bem: uma conta sem nenhuma é uma conta perdida), e recusa ligar uma que
 * já pertença a outra pessoa. A app mostra a razão em vez de a esconder.
 */
export default function FormasDeEntrarScreen() {
  const { identidades, ligarIdentidade, desligarIdentidade, configurado } = useAuth();
  const toast = useToasts();

  const [lista, setLista] = useState<{ id: string; provider: string; detalhe?: string }[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [aTrabalhar, setATrabalhar] = useState(false);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setLista(await identidades());
    setACarregar(false);
  }, [identidades]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * O que ainda se pode LIGAR: o que está configurado nesta app menos o que a
   * conta já tem. O telemóvel fica de fora de propósito — ligá-lo é um código
   * por SMS, que é outro fluxo, e não cabe atrás de um botão que diz "ligar".
   */
  const jaTem = new Set(lista.map((i) => i.provider));
  const porLigar = metodosConfigurados(configDoAmbiente()).filter(
    (m): m is 'google' | 'apple' => m !== 'telemovel' && !jaTem.has(m),
  );

  async function ligar(metodo: 'google' | 'apple') {
    setATrabalhar(true);
    const e = await ligarIdentidade(metodo);
    setATrabalhar(false);
    if (e) {
      toast.erro(t('entrarConta.naoLigou'), e);
      return;
    }
    toast.sucesso(t('entrarConta.ligou'), nomeDoServico(metodo));
    await carregar();
  }

  function pedirEDesligar(id: string, provider: string) {
    confirmar(
      t('entrarConta.tirarTitulo', { servico: nomeDoServico(provider) }),
      t('entrarConta.tirarPergunta', { servico: nomeDoServico(provider) }),
      () => void desligar(id),
      { rotuloConfirmar: t('entrarConta.tirar'), destrutivo: true },
    );
  }

  async function desligar(id: string) {
    setATrabalhar(true);
    const e = await desligarIdentidade(id);
    setATrabalhar(false);
    if (e) {
      toast.erro(t('entrarConta.naoTirou'), e);
      return;
    }
    toast.sucesso(t('entrarConta.tirou'), '');
    await carregar();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('perfil.formasDeEntrar')} />
      <Screen>
        <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.lg }}>
          {t('entrarConta.explicacao')}
        </Text>

        {aCarregar ? (
          <Card>
            <Text variant="body" color={colors.textSecondary}>
              {t('comum.aCarregar')}
            </Text>
          </Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {lista.map((i, n) => (
                <View
                  key={i.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.md,
                    borderBottomWidth: n < lista.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}>
                  <Icon name={iconeDoServico(i.provider)} size="lg" color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{nomeDoServico(i.provider)}</Text>
                    {i.detalhe ? (
                      <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
                        {i.detalhe}
                      </Text>
                    ) : null}
                  </View>
                  {/* A última não se tira, e o botão nem aparece: o servidor
                      recusa na mesma, mas um botão que existe só para dar erro
                      é uma promessa que não se cumpre. */}
                  {lista.length > 1 ? (
                    <Button
                      label={t('entrarConta.tirar')}
                      variant="ghost"
                      onPress={() => pedirEDesligar(i.id, i.provider)}
                      disabled={aTrabalhar}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        )}

        {porLigar.length > 0 ? (
          <>
            <Text
              variant="label"
              style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              {t('entrarConta.juntarTitulo')}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {porLigar.map((m) => (
                <Button
                  key={m}
                  label={t('entrarConta.juntar', { servico: nomeDoServico(m) })}
                  icon={iconeDoServico(m)}
                  variant="secondary"
                  onPress={() => void ligar(m)}
                  disabled={aTrabalhar}
                />
              ))}
            </View>
          </>
        ) : null}

        {!configurado ? null : (
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginTop: spacing.xl,
              padding: spacing.md,
              borderRadius: radii.md,
              backgroundColor: colors.primaryTint,
            }}>
            <Icon name="information-outline" size="md" color={colors.primaryDark} />
            <Text variant="secondary" color={colors.primaryDark} style={{ flex: 1 }}>
              {t('entrarConta.aviso')}
            </Text>
          </View>
        )}
      </Screen>
    </View>
  );
}

/**
 * O nome do serviço como quem o usa lhe chama.
 *
 * O servidor diz `email`, `google`, `apple`, `phone`. Nenhuma dessas palavras é
 * o que uma pessoa procura numa lista das suas formas de entrar.
 */
function nomeDoServico(provider: string): string {
  if (provider === 'google') return 'Google';
  if (provider === 'apple') return 'Apple';
  if (provider === 'phone') return t('login.telemovel');
  if (provider === 'email') return t('login.email');
  return provider;
}

function iconeDoServico(provider: string): IconName {
  if (provider === 'google') return 'google';
  if (provider === 'apple') return 'apple';
  if (provider === 'phone') return 'cellphone';
  return 'email-outline';
}
