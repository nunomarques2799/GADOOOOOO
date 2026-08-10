import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Field, Header, Icon, Text, TextField, type IconName } from '@/components/ui';
import {
  confirmacaoValida,
  consequenciasDeApagar,
  PALAVRA_CONFIRMACAO,
  pessoasAfetadas,
} from '@/data/apagarConta';
import { useAuth } from '@/data/auth';
import { avisar, confirmar } from '@/data/avisos';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import { useDesktop } from '@/hooks/useDesktop';
import { t } from '@/i18n';
import { colors, layout, radii, shadow, spacing } from '@/theme';

/**
 * Apagar a conta — o ecrã que existe para isto não ser um toque.
 *
 * O botão já esteve no Perfil, colado ao "Terminar sessão", e saiu de lá
 * exatamente por isso. Voltou porque a App Store obriga quem deixa criar conta
 * a deixar apagá-la de dentro da app (diretriz 5.1.1(v)), e a forma de cumprir
 * a regra sem repetir o acidente é esta: um ecrã só para o assunto, com a
 * conta do que se perde feita a partir dos dados REAIS desta pessoa, uma
 * palavra escrita à mão e só depois a pergunta final.
 *
 * A conta do que desaparece está em `data/apagarConta.ts` (é lógica, e tem
 * testes); aqui só se escreve o que ela devolveu.
 */
export default function ApagarContaScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const router = useRouter();
  const { utilizador, configurado, apagarConta } = useAuth();
  const { membros, listarMembrosDe } = useMembros();
  const { exploracoes, animais, pendentesSinc } = useGado();

  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aApagar, setAApagar] = useState(false);
  /** Quantas outras pessoas perdem o acesso. `null` = ainda não se sabe. */
  const [pessoas, setPessoas] = useState<number | null>(null);

  const uid = utilizador?.id ?? '';

  const consequencias = useMemo(
    () => consequenciasDeApagar({ utilizadorId: uid, exploracoes, animais, membros }),
    [uid, exploracoes, animais, membros],
  );

  /**
   * Quem mais fica sem acesso. É a única coisa deste ecrã que não está na
   * cache local: a equipa vive no servidor e não se sabe de cor.
   *
   * Se falhar (sem rede, por exemplo) fica-se sem o número e o ecrã diz a
   * frase sem ele. Não vale a pena bloquear o apagamento por não se conseguir
   * contar as pessoas — mas inventar um zero seria dizer que não há ninguém.
   */
  useEffect(() => {
    let vivo = true;
    const ids = consequencias.exploracoesApagadas.map((e) => e.id);
    if (ids.length === 0) {
      setPessoas(0);
      return;
    }
    void (async () => {
      try {
        const equipas = await Promise.all(ids.map((id) => listarMembrosDe(id)));
        if (vivo) setPessoas(pessoasAfetadas(uid, equipas.flat()));
      } catch {
        if (vivo) setPessoas(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [consequencias, listarMembrosDe, uid]);

  const podeApagar = configurado && confirmacaoValida(texto) && !aApagar;

  function perguntarPelaUltimaVez() {
    if (!podeApagar) return;
    confirmar(
      t('apagar.perguntaTitulo'),
      consequencias.apagaDados
        ? `${t('apagar.perguntaComDados', {
            exploracoes: t('perfil.nExploracoes', {
              n: consequencias.exploracoesApagadas.length,
            }),
            animais: t('terrenos.nAnimais', { n: consequencias.animais }),
          })} ${t('apagar.semRecuperar')}`
        : t('apagar.perguntaSemDados'),
      () => void executar(),
      { rotuloConfirmar: t('apagar.definitivamente'), destrutivo: true },
    );
  }

  async function executar() {
    setAApagar(true);
    setErro(null);
    const razao = await apagarConta();
    if (razao) {
      // Continua a haver conta: fica-se no ecrã, com a razão à vista e a
      // palavra ainda escrita. Voltar atrás aqui era esconder a falha.
      setAApagar(false);
      setErro(razao);
      return;
    }
    // Não se mexe no `router`: sem sessão, o portão de autenticação leva a app
    // ao ecrã de entrada sozinho (ver `_layout.tsx`). O aviso é montado por
    // fora dele e sobrevive a essa troca — daí ser `avisar()` e não um toast,
    // que morreria com o ecrã.
    avisar(t('apagar.apagada'), t('apagar.apagadaDetalhe'));
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('perfil.apagarConta')} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: ALTURA_BARRA + insets.bottom + spacing.xl,
        }}>
        <View style={{ ...conteudo, gap: spacing.md }}>
          <Text variant="secondary" color={colors.textSecondary}>
            {t('apagar.intro')}
          </Text>

          {/* O que desaparece, contado dos dados desta pessoa. Uma lista de
              nomes que o criador reconhece pesa mais do que "todos os seus
              dados", que não quer dizer nada a ninguém. */}
          {consequencias.apagaDados ? (
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Titulo icone="alert-octagon" texto={t('apagar.vaiSerApagado')} tom={colors.danger} />
                {consequencias.exploracoesApagadas.map((e) => (
                  <Item
                    key={e.id}
                    icone="barn"
                    texto={e.nome}
                    detalhe={t('terrenos.nAnimais', { n: e.animais })}
                  />
                ))}
                <Text variant="secondary" color={colors.textSecondary}>
                  {t('apagar.comCadaExploracao')}{' '}
                  {pessoas === null
                    ? t('apagar.equipaPerdeAcesso')
                    : pessoas > 0
                      ? t('apagar.nPessoasPerdem', { n: pessoas })
                      : t('apagar.maisNinguem')}
                </Text>
              </View>
            </Card>
          ) : null}

          {/* Trabalhador e veterinário: a exploração não é deles e não cai.
              Dizer-lhes que "vai apagar tudo" seria uma ameaça falsa. */}
          {consequencias.acessosPerdidos.length > 0 ? (
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Titulo
                  icone="account-off-outline"
                  texto={t('apagar.continuaAExistir')}
                  tom={colors.warning}
                />
                {consequencias.acessosPerdidos.map((a) => (
                  <Item
                    key={a.id}
                    icone="account-hard-hat"
                    texto={a.nome}
                    detalhe={legendaRole(a.role)}
                  />
                ))}
                <Text variant="secondary" color={colors.textSecondary}>
                  {t('apagar.deOutraPessoa')}
                </Text>
              </View>
            </Card>
          ) : null}

          {/* O mesmo aviso que o "Terminar sessão" dá, pela mesma razão: o que
              ainda não subiu não existe em mais lado nenhum. Aqui é pior, que
              nem sequer há para onde voltar a entrar. */}
          {pendentesSinc > 0 ? (
            <Caixa tom={colors.warning} fundo={colors.warningTint} icone="cloud-alert">
              {t('apagar.porSincronizar', { n: pendentesSinc })}
            </Caixa>
          ) : null}

          <Field
            label={t('apagar.escrevaParaConfirmar', { palavra: PALAVRA_CONFIRMACAO })}
            ajuda={t('apagar.ajudaEscrever')}>
            <TextField
              value={texto}
              onChangeText={setTexto}
              placeholder={PALAVRA_CONFIRMACAO}
              icon="alert-circle-outline"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </Field>

          {!configurado ? (
            <Caixa tom={colors.info} fundo={colors.infoTint} icone="information-outline">
              {t('apagar.modoOffline')}
            </Caixa>
          ) : null}

          {erro ? (
            <Caixa tom={colors.danger} fundo={colors.dangerTint} icone="alert-circle-outline">
              {erro}
            </Caixa>
          ) : null}
        </View>
      </ScrollView>

      {/* Barra fixa em baixo — o mesmo padrão dos formulários. */}
      <View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            alignItems: 'center',
          },
          shadow.lg,
        ]}>
        <View
          style={{
            width: '100%',
            maxWidth: desktop ? layout.conteudoEstreito : undefined,
            gap: spacing.sm,
          }}>
          <Button
            label={t('perfil.apagarConta')}
            icon="delete-forever"
            variant="danger"
            onPress={perguntarPelaUltimaVez}
            disabled={!podeApagar}
            loading={aApagar}
          />
          <Button
            label={t('apagar.afinalNao')}
            variant="ghost"
            onPress={() => router.back()}
            disabled={aApagar}
          />
        </View>
      </View>
    </View>
  );
}

/** "3 animais", "1 animal" — o singular certo, que aqui aparece muitas vezes. */
// O `frase(n, singular, plural)` que aqui vivia saiu: o plural passou a vir do
// `t()`, que já o resolve pelo `n` e o faz nas duas línguas.

function Titulo({ icone, texto, tom }: { icone: IconName; texto: string; tom: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon name={icone} size="md" color={tom} />
      <Text variant="h3" color={tom} style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}

function Item({
  icone,
  texto,
  detalhe,
}: {
  icone: IconName;
  texto: string;
  detalhe: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={icone} size="sm" color={colors.textSecondary} />
      <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
        {texto}
      </Text>
      <Text variant="secondary" color={colors.textSecondary}>
        {detalhe}
      </Text>
    </View>
  );
}

function Caixa({
  tom,
  fundo,
  icone,
  children,
}: {
  tom: string;
  fundo: string;
  icone: IconName;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.xs,
        backgroundColor: fundo,
        padding: spacing.sm,
        borderRadius: radii.md,
      }}>
      <Icon name={icone} size="sm" color={tom} />
      <Text variant="secondary" color={tom} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/** Altura reservada em baixo para a barra dos botões não tapar conteúdo. */
const ALTURA_BARRA = 148;
