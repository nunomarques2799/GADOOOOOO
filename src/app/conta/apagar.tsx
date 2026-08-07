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
      'Apagar a conta?',
      consequencias.apagaDados
        ? `Vai apagar a sua conta, ${frase(consequencias.exploracoesApagadas.length, 'exploração', 'explorações')} ` +
          `e ${frase(consequencias.animais, 'animal', 'animais')}. ` +
          'Não há forma de recuperar isto — nem sua, nem de quem gere a aplicação.'
        : 'Vai apagar a sua conta e perder o acesso à aplicação. Não há forma de voltar atrás.',
      () => void executar(),
      { rotuloConfirmar: 'Apagar definitivamente', destrutivo: true },
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
    avisar(
      'Conta apagada',
      'Os seus dados foram removidos do servidor. Obrigado por ter usado a Terrabovina.',
    );
  }

  const conteudo = {
    width: '100%',
    maxWidth: desktop ? layout.conteudoEstreito : undefined,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Apagar a minha conta" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          alignItems: 'center',
          paddingBottom: ALTURA_BARRA + insets.bottom + spacing.xl,
        }}>
        <View style={{ ...conteudo, gap: spacing.md }}>
          <Text variant="secondary" color={colors.textSecondary}>
            Apagar a conta é definitivo. Ninguém — nem quem gere a aplicação —
            consegue recuperar o que se perde aqui. Leia o que vai desaparecer
            antes de continuar.
          </Text>

          {/* O que desaparece, contado dos dados desta pessoa. Uma lista de
              nomes que o criador reconhece pesa mais do que "todos os seus
              dados", que não quer dizer nada a ninguém. */}
          {consequencias.apagaDados ? (
            <Card>
              <View style={{ gap: spacing.sm }}>
                <Titulo icone="alert-octagon" texto="Isto vai ser apagado" tom={colors.danger} />
                {consequencias.exploracoesApagadas.map((e) => (
                  <Item
                    key={e.id}
                    icone="barn"
                    texto={e.nome}
                    detalhe={frase(e.animais, 'animal', 'animais')}
                  />
                ))}
                <Text variant="secondary" color={colors.textSecondary}>
                  Com cada exploração caem os terrenos, os animais, os eventos,
                  os documentos e o histórico. {pessoas === null
                    ? 'Quem trabalha consigo perde o acesso.'
                    : pessoas > 0
                      ? `${frase(pessoas, 'pessoa da sua equipa', 'pessoas da sua equipa')} ${
                          pessoas === 1 ? 'perde' : 'perdem'
                        } o acesso.`
                      : 'Não há mais ninguém com acesso a estas explorações.'}
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
                  texto="Isto continua a existir, sem si"
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
                  Estas explorações são de outra pessoa: os animais e os
                  registos ficam lá. O que se perde é a sua entrada — para
                  voltar precisa de um código de convite novo.
                </Text>
              </View>
            </Card>
          ) : null}

          {/* O mesmo aviso que o "Terminar sessão" dá, pela mesma razão: o que
              ainda não subiu não existe em mais lado nenhum. Aqui é pior, que
              nem sequer há para onde voltar a entrar. */}
          {pendentesSinc > 0 ? (
            <Caixa tom={colors.warning} fundo={colors.warningTint} icone="cloud-alert">
              {frase(pendentesSinc, 'alteração guardada', 'alterações guardadas')} neste aparelho
              ainda não {pendentesSinc === 1 ? 'chegou' : 'chegaram'} ao servidor. Se apagar a
              conta agora, {pendentesSinc === 1 ? 'perde-se' : 'perdem-se'} também.
            </Caixa>
          ) : null}

          <Field
            label={`Escreva ${PALAVRA_CONFIRMACAO} para confirmar`}
            ajuda="É de propósito: um botão vermelho sozinho carrega-se sem ler.">
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
              Esta app está em modo offline. Para apagar a conta é preciso ter
              sessão iniciada.
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
            label="Apagar a minha conta"
            icon="delete-forever"
            variant="danger"
            onPress={perguntarPelaUltimaVez}
            disabled={!podeApagar}
            loading={aApagar}
          />
          <Button
            label="Afinal não"
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
function frase(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

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
