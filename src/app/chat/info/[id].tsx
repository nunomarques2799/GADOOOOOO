import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';

import { Avatar, Button, Card, Header, Icon, Screen, SectionHeader, Text } from '@/components/ui';
import { confirmar } from '@/data/avisos';
import { iniciais, rotuloPapel, tituloDaConversa, type MembroConversa } from '@/data/chat';
import { useMembros } from '@/data/membros';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useChat } from '@/data/useChat';
import { t } from '@/i18n';
import { colors, radii, sizes, spacing } from '@/theme';

/**
 * A informação de uma conversa, e o que se pode mudar nela.
 *
 * NO GRUPO: o nome (só o dono), quem lá está, e quem o dono tirou de lá.
 * Remover do grupo NÃO remove da equipa da exploração: são duas coisas
 * diferentes e o texto do aviso di-lo, porque é exatamente onde alguém se
 * enganaria. O contrário já não é verdade: sair da equipa tira do grupo, e
 * isso acontece sozinho no servidor.
 *
 * NA PRIVADA: silenciar e bloquear. Bloquear é uma exigência da loja da Apple
 * (diretriz 1.2) e vale só aqui: no grupo da exploração não se bloqueia
 * ninguém, que é uma ferramenta de trabalho e não uma rede social.
 */
export default function InfoConversaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversaId = String(id ?? '');

  const {
    conversas,
    silenciar,
    mudarNome,
    membrosDe,
    removerDoGrupo,
    reporNoGrupo,
    bloquear,
    desbloquear,
    bloqueados,
  } = useChat();
  const { nomeDe } = useNomesEquipa();
  const { exploracoes } = useGado();
  const { roleEm } = useMembros();
  const toast = useToasts();

  const conversa = conversas.find((c) => c.id === conversaId);
  const nomeExploracao = useCallback(
    (expId?: string) => exploracoes.find((e) => e.id === expId)?.nome,
    [exploracoes],
  );

  const [membros, setMembros] = useState<MembroConversa[]>([]);
  const [nome, setNome] = useState(conversa?.nome ?? '');
  const [aGravar, setAGravar] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  const souDono = conversa?.exploracaoId
    ? roleEm(conversa.exploracaoId) === 'admin'
    : false;

  const carregarMembros = useCallback(() => {
    if (!conversaId) return;
    void membrosDe(conversaId)
      .then(setMembros)
      .catch(() => setMembros([]));
  }, [conversaId, membrosDe]);

  useEffect(carregarMembros, [carregarMembros]);

  useEffect(() => {
    if (conversa?.tipo !== 'privada' || !conversa.outro) return;
    void bloqueados().then((lista) => setBloqueado(lista.includes(conversa.outro as string)));
  }, [conversa?.tipo, conversa?.outro, bloqueados]);

  const titulo = conversa ? tituloDaConversa(conversa, nomeDe, nomeExploracao) : t('chat.info');

  async function gravarNome() {
    if (!conversa) return;
    setAGravar(true);
    try {
      await mudarNome(conversa.id, nome);
      toast.sucesso(t('chat.nomeMudado'));
    } catch (e) {
      toast.erro(t('comum.semGravar'), mensagemDeErro(e));
    } finally {
      setAGravar(false);
    }
  }

  function remover(m: MembroConversa) {
    if (!conversa) return;
    confirmar(
      t('chat.remover'),
      t('chat.confirmarRemover', { nome: m.nome }),
      () => {
        void removerDoGrupo(conversa.id, m.id)
          .then(() => {
            toast.sucesso(t('chat.removido'), m.nome);
            carregarMembros();
          })
          .catch((e) => toast.erro(t('comum.semGravar'), mensagemDeErro(e)));
      },
      { rotuloConfirmar: t('chat.remover'), destrutivo: true },
    );
  }

  function repor(m: MembroConversa) {
    if (!conversa) return;
    void reporNoGrupo(conversa.id, m.id)
      .then(() => {
        toast.sucesso(t('chat.reposto'), m.nome);
        carregarMembros();
      })
      .catch((e) => toast.erro(t('comum.semGravar'), mensagemDeErro(e)));
  }

  function alternarBloqueio() {
    if (!conversa?.outro) return;
    const outro = conversa.outro;
    const nomeOutro = nomeDe(outro) ?? t('chat.utilizadorRemovido');
    if (bloqueado) {
      void desbloquear(outro)
        .then(() => {
          setBloqueado(false);
          toast.sucesso(t('chat.desbloqueada'), nomeOutro);
        })
        .catch((e) => toast.erro(t('comum.semGravar'), mensagemDeErro(e)));
      return;
    }
    confirmar(
      t('chat.bloquear'),
      t('chat.confirmarBloquear', { nome: nomeOutro }),
      () => {
        void bloquear(outro)
          .then(() => {
            setBloqueado(true);
            toast.sucesso(t('chat.bloqueada'), nomeOutro);
          })
          .catch((e) => toast.erro(t('comum.semGravar'), mensagemDeErro(e)));
      },
      { rotuloConfirmar: t('chat.bloquear'), destrutivo: true },
    );
  }

  if (!conversa) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('chat.info')} />
        <Screen>
          <Text variant="body" color={colors.textSecondary}>
            {t('chat.semConversas')}
          </Text>
        </Screen>
      </View>
    );
  }

  const dentro = membros.filter((m) => !m.saiu);
  const fora = membros.filter((m) => m.saiu);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={t('chat.info')} />
      <Screen>
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <Avatar
            icon={conversa.tipo === 'grupo' ? 'account-group' : 'account'}
            initials={conversa.tipo === 'privada' ? iniciais(titulo) : undefined}
            size={sizes.avatar.lg}
          />
          <Text variant="h2" center style={{ marginTop: spacing.sm }}>
            {titulo}
          </Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {conversa.tipo === 'grupo'
              ? t('chat.membrosN', { n: dentro.length })
              : t('chat.privada')}
          </Text>
        </View>

        {conversa.tipo === 'grupo' ? (
          <Card style={{ marginBottom: spacing.md }}>
            <SectionHeader title={t('chat.nomeDoGrupo')} />
            {souDono ? (
              <>
                <TextInput
                  value={nome}
                  onChangeText={setNome}
                  placeholder={nomeExploracao(conversa.exploracaoId) ?? t('chat.grupoSemNome')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={60}
                  accessibilityLabel={t('chat.nomeDoGrupo')}
                  style={{
                    height: sizes.input,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    paddingHorizontal: spacing.md,
                    fontFamily: 'Nunito_400Regular',
                    fontSize: 17,
                    color: colors.text,
                  }}
                />
                <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                  {t('chat.nomeDoGrupoAjuda')}
                </Text>
                <Button
                  label={aGravar ? t('comum.aGuardar') : t('comum.guardar')}
                  icon="content-save-outline"
                  onPress={gravarNome}
                  disabled={aGravar}
                  style={{ marginTop: spacing.sm }}
                />
              </>
            ) : (
              <Text variant="secondary" color={colors.textSecondary}>
                {t('chat.soDono')}
              </Text>
            )}
          </Card>
        ) : null}

        <Card style={{ marginBottom: spacing.md }}>
          <Linha
            icone="bell-off-outline"
            titulo={t('chat.silenciar')}
            ajuda={t('chat.silenciarAjuda')}
            valor={conversa.silenciada}
            onMudar={(v) => {
              void silenciar(conversa.id, v).catch((e) =>
                toast.erro(t('comum.semGravar'), mensagemDeErro(e)),
              );
            }}
          />
        </Card>

        {conversa.tipo === 'privada' ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Pressable
              onPress={alternarBloqueio}
              accessibilityRole="button"
              accessibilityLabel={bloqueado ? t('chat.desbloquear') : t('chat.bloquear')}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 56 },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon
                name={bloqueado ? 'account-check-outline' : 'account-cancel-outline'}
                size="md"
                color={bloqueado ? colors.success : colors.danger}
              />
              <Text variant="body" color={bloqueado ? colors.text : colors.danger}>
                {bloqueado ? t('chat.desbloquear') : t('chat.bloquear')}
              </Text>
            </Pressable>
            {bloqueado ? (
              <Text variant="caption" color={colors.textSecondary}>
                {t('chat.bloqueadoAviso')}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {conversa.tipo === 'grupo' ? (
          <>
            <SectionHeader title={t('chat.membrosN', { n: dentro.length })} />
            <Card style={{ marginBottom: spacing.md }}>
              {dentro.map((m, i) => (
                <PessoaLinha
                  key={m.id}
                  membro={m}
                  ultima={i === dentro.length - 1}
                  acao={souDono ? { rotulo: t('chat.remover'), onPress: () => remover(m) } : undefined}
                />
              ))}
            </Card>

            {fora.length > 0 && souDono ? (
              <>
                <SectionHeader title={t('chat.foraLista')} />
                <Card style={{ marginBottom: spacing.md }}>
                  {fora.map((m, i) => (
                    <PessoaLinha
                      key={m.id}
                      membro={m}
                      ultima={i === fora.length - 1}
                      acao={{ rotulo: t('chat.repor'), onPress: () => repor(m) }}
                    />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        ) : null}

        <Card>
          <SectionHeader title={t('chat.regrasTitulo')} />
          <Text variant="secondary" color={colors.textSecondary}>
            {t('chat.regrasTexto')}
          </Text>
        </Card>

      </Screen>
    </View>
  );
}

function Linha({
  icone,
  titulo,
  ajuda,
  valor,
  onMudar,
}: {
  icone: 'bell-off-outline';
  titulo: string;
  ajuda: string;
  valor: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={icone} size="md" color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text variant="body">{titulo}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {ajuda}
        </Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onMudar}
        accessibilityLabel={titulo}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

function PessoaLinha({
  membro,
  ultima,
  acao,
}: {
  membro: MembroConversa;
  ultima: boolean;
  acao?: { rotulo: string; onPress: () => void };
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 60,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: colors.border,
      }}>
      <Avatar initials={iniciais(membro.nome)} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {membro.nome}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {rotuloPapel(membro.papel)}
        </Text>
      </View>
      {acao ? (
        <Pressable
          onPress={acao.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${acao.rotulo}: ${membro.nome}`}
          hitSlop={8}
          style={({ pressed }) => [
            {
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: colors.border,
            },
            pressed && { opacity: 0.7 },
          ]}>
          <Text variant="caption">{acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
