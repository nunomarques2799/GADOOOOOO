import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, Card, Chip, EmptyState, Header, Icon, type IconName, Text } from '@/components/ui';
import {
  acessoTerminou,
  DURACAO_OMISSAO,
  DURACOES_ACESSO,
  rotuloDuracao,
  rotuloPrazo,
} from '@/data/acessoTemporario';
import { formatDataHora } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useToasts } from '@/data/toasts';
import type { Convite, MembroExploracao, RoleMembro } from '@/data/types';
import { colors, radii, spacing } from '@/theme';

type MembroComNome = MembroExploracao & { nome: string };

const rolesOpcoes: { valor: Exclude<RoleMembro, 'admin'>; label: string; icon: IconName }[] = [
  { valor: 'trabalhador', label: 'Trabalhador', icon: 'account-hard-hat' },
  { valor: 'veterinario', label: 'Veterinário', icon: 'medical-bag' },
];

/** Ecrã para o admin duma exploração gerir a equipa (membros + convites). */
export default function EquipaExploracaoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { exploracaoById } = useGado();
  const {
    roleEm,
    listarMembrosDe,
    removerMembro,
    listarConvites,
    criarConvite,
    removerConvite,
    definirPrazoDeAcesso,
    pode,
    isSuperadmin,
  } = useMembros();

  const toast = useToasts();

  const exploracao = id ? exploracaoById(id) : undefined;
  // O `roleEm` fica em primeiro para o admin com a conta suspensa continuar a
  // ver a equipa (só de leitura, como o resto da app): o `pode` responderia que
  // não e trocava-lhe o ecrã por um "sem permissão" que não é o que se passa.
  // O `pode` entra a seguir para cobrir o modo local/demo, onde não há equipa
  // nem papéis e quem está no aparelho é o dono.
  const podeGerir = id ? roleEm(id) === 'admin' || isSuperadmin || pode(id, 'gerirEquipa') : false;

  const [membros, setMembros] = useState<MembroComNome[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [rolePedido, setRolePedido] = useState<Exclude<RoleMembro, 'admin'>>('trabalhador');
  const [descricao, setDescricao] = useState('');
  const [aGerar, setAGerar] = useState(false);
  const [codigoNovo, setCodigoNovo] = useState<{ codigo: string; acessoHoras?: number } | null>(
    null,
  );
  /**
   * Quanto tempo o acesso dura. Só se pergunta ao VETERINÁRIO: ele vem à
   * exploração, faz o que tem a fazer e vai-se embora, e um acesso que só
   * termina quando alguém se lembra de o tirar é um acesso que não termina. O
   * trabalhador anda lá todos os dias e fica sem prazo.
   */
  const [acessoHoras, setAcessoHoras] = useState<number>(DURACAO_OMISSAO);
  const comPrazo = rolePedido === 'veterinario';

  const carregar = useCallback(async () => {
    if (!id) return;
    setACarregar(true);
    setErro(null);
    try {
      const [ms, cs] = await Promise.all([listarMembrosDe(id), listarConvites(id)]);
      setMembros(ms);
      setConvites(cs);
    } catch (e: unknown) {
      setErro((e as Error).message ?? 'Erro ao carregar.');
    } finally {
      setACarregar(false);
    }
  }, [id, listarMembrosDe, listarConvites]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function gerarConvite() {
    if (!id) return;
    setAGerar(true);
    setCodigoNovo(null);
    setErro(null);
    const horas = comPrazo ? acessoHoras : undefined;
    const r = await criarConvite(id, rolePedido, descricao.trim() || undefined, 168, horas);
    setAGerar(false);
    if (r.erro) {
      setErro(r.erro);
      toast.erro('Código não criado', r.erro);
      return;
    }
    if (r.codigo) {
      setCodigoNovo({ codigo: r.codigo, acessoHoras: horas });
      setDescricao('');
      toast.sucesso(
        'Código criado',
        `${r.codigo} · ${legendaRole(rolePedido)}${horas ? ` · ${rotuloDuracao(horas)}` : ''}`,
      );
      await carregar();
    }
  }

  /** Renova, termina ou tira o prazo de um vínculo já existente. */
  async function mudarPrazo(membro: MembroComNome, horas: number | null, comoSeChama: string) {
    const e = await definirPrazoDeAcesso(membro.id, horas);
    if (e) {
      setErro(e);
      toast.erro('O tempo de acesso não mudou', e);
      return;
    }
    toast.sucesso(comoSeChama, membro.nome);
    await carregar();
  }

  async function copiar(codigo: string) {
    // Web: usa Clipboard API. Nativo: por agora só mostra alerta (adicionar
    // expo-clipboard se se quiser copiar diretamente no telemóvel).
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(codigo);
        toast.sucesso('Código copiado', codigo);
      } catch {
        // O browser pode recusar a área de transferência (sem HTTPS, sem foco).
        // O código continua à vista no ecrã — é só dizer que não foi copiado.
        toast.erro('Não foi possível copiar', 'Escreva o código à mão.');
      }
      return;
    }
    Alert.alert('Código', codigo, [{ text: 'OK' }]);
  }

  async function confirmarRemover(membro: MembroComNome) {
    const executar = async () => {
      const e = await removerMembro(membro.id);
      if (e) {
        setErro(e);
        toast.erro(`${membro.nome} não foi removido`, e);
        return;
      }
      toast.sucesso('Removido da equipa', membro.nome);
      await carregar();
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Remover ${membro.nome} desta exploração?`)) await executar();
      return;
    }
    Alert.alert('Remover membro', `Remover ${membro.nome} desta exploração?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void executar() },
    ]);
  }

  async function apagarConvite(codigo: string) {
    const e = await removerConvite(codigo);
    if (e) {
      setErro(e);
      toast.erro('Convite não apagado', e);
      return;
    }
    toast.sucesso('Convite apagado', codigo);
    await carregar();
  }

  if (!exploracao) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Equipa" />
        <EmptyState icon="barn" title="Exploração não encontrada" message="Este registo já não existe." />
      </View>
    );
  }

  if (!podeGerir) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title="Equipa" />
        <EmptyState
          icon="shield-off-outline"
          title="Sem permissão"
          message="Só o administrador desta exploração pode gerir a equipa."
        />
      </View>
    );
  }

  const convitesAtivos = convites.filter((c) => !c.usadoPor && (!c.expiraEm || new Date(c.expiraEm) > new Date()));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={`Equipa · ${exploracao.nome}`} actionIcon="refresh" onAction={carregar} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}>
        {erro ? (
          <Card style={{ backgroundColor: colors.dangerTint, marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="alert-circle-outline" size="md" color={colors.danger} />
              <Text variant="body" color={colors.danger} style={{ flex: 1 }}>{erro}</Text>
            </View>
          </Card>
        ) : null}

        {/* ---- Membros atuais ---- */}
        <Text variant="h3" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Membros ({membros.length})
        </Text>
        {aCarregar ? (
          <Card><Text variant="body" color={colors.textSecondary}>A carregar…</Text></Card>
        ) : membros.length === 0 ? (
          <Card><Text variant="body" color={colors.textSecondary}>Sem membros.</Text></Card>
        ) : (
          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.md }}>
              {membros.map((m, i) => {
                const terminou = acessoTerminou(m.expiraEm);
                return (
                  <View
                    key={m.id}
                    style={{
                      paddingVertical: spacing.sm,
                      borderBottomWidth: i < membros.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                      // O acesso terminado continua na lista, esbatido: é o que
                      // deixa o dono ver quem cá esteve e voltar a abrir a porta
                      // sem ter de gerar um código novo.
                      opacity: terminou ? 0.65 : 1,
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: radii.pill,
                          backgroundColor: corDoRole(m.role) + '22',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Icon name={iconeDoRole(m.role)} size="md" color={corDoRole(m.role)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="bodyStrong">{m.nome}</Text>
                        <Text variant="secondary" color={colors.textSecondary}>{legendaRole(m.role)}</Text>
                        {m.role !== 'admin' && m.expiraEm ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Icon
                              name={terminou ? 'clock-alert-outline' : 'clock-outline'}
                              size="xs"
                              color={terminou ? colors.danger : colors.warning}
                            />
                            <Text
                              variant="caption"
                              color={terminou ? colors.danger : colors.warning}
                              style={{ flex: 1 }}>
                              {rotuloPrazo(m.expiraEm, formatDataHora)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {m.role === 'admin' ? (
                        <Text variant="caption" color={colors.textMuted}>dono</Text>
                      ) : (
                        <Pressable
                          onPress={() => confirmarRemover(m)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remover ${m.nome}`}>
                          <Icon name="close-circle-outline" size="md" color={colors.danger} />
                        </Pressable>
                      )}
                    </View>

                    {/* Mexer no relógio de quem já cá está. Fora do dono, que
                        não tem prazo nenhum a mexer. */}
                    {m.role !== 'admin' ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: spacing.xs,
                          marginTop: spacing.xs,
                          marginLeft: 40 + spacing.sm,
                        }}>
                        {DURACOES_ACESSO.slice(0, 4).map((d) => (
                          <Chip
                            key={d.horas}
                            label={terminou ? `Reabrir ${d.label}` : `+${d.label}`}
                            onPress={() =>
                              void mudarPrazo(
                                m,
                                d.horas,
                                terminou ? 'Acesso reaberto' : 'Acesso prolongado',
                              )
                            }
                          />
                        ))}
                        {m.expiraEm && !terminou ? (
                          <Chip
                            label="Terminar já"
                            icon="clock-remove-outline"
                            onPress={() => void mudarPrazo(m, 0, 'Acesso terminado')}
                          />
                        ) : null}
                        {m.expiraEm ? null : (
                          <Text variant="caption" color={colors.textMuted} style={{ alignSelf: 'center' }}>
                            sem prazo
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* ---- Gerar novo convite ---- */}
        <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Convidar alguém
        </Text>
        <Card>
          <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
            Escolha a função e gere um código para partilhar com o trabalhador ou veterinário.
            Ao entrar com o código, fica automaticamente associado a esta exploração.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            {rolesOpcoes.map((r) => (
              <Chip
                key={r.valor}
                label={r.label}
                icon={r.icon}
                selected={rolePedido === r.valor}
                onPress={() => setRolePedido(r.valor)}
              />
            ))}
          </View>

          {/* Quanto tempo o acesso dura. Só ao veterinário: ele vem cá fazer uma
              coisa e vai-se embora, e é isso que o prazo escreve. */}
          {comPrazo ? (
            <View style={{ marginTop: spacing.md }}>
              <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
                Durante quanto tempo?
              </Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
                O tempo começa a contar quando ele usar o código, não agora. Passado o prazo,
                deixa de ver esta exploração. A conta dele fica, e pode voltar a ser convidado.
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                {DURACOES_ACESSO.map((d) => (
                  <Chip
                    key={d.horas}
                    label={d.label}
                    selected={acessoHoras === d.horas}
                    onPress={() => setAcessoHoras(d.horas)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Button
            label="Gerar código"
            icon="ticket-confirmation-outline"
            onPress={gerarConvite}
            loading={aGerar}
            style={{ marginTop: spacing.md }}
          />
          {codigoNovo ? (
            <View
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                backgroundColor: colors.successTint,
                borderRadius: radii.md,
                alignItems: 'center',
              }}>
              <Text variant="caption" color={colors.textSecondary}>Código (válido 7 dias)</Text>
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 32, letterSpacing: 3, color: colors.primaryDark, marginVertical: 4 }}>
                {codigoNovo.codigo}
              </Text>
              <Text variant="secondary" color={colors.textSecondary} center style={{ marginBottom: spacing.sm }}>
                {codigoNovo.acessoHoras
                  ? `Dá acesso durante ${rotuloDuracao(codigoNovo.acessoHoras)} a contar de quando o usar.`
                  : 'Dá acesso sem prazo, até ser removido da equipa.'}
              </Text>
              <Button
                label="Copiar código"
                icon="content-copy"
                variant="secondary"
                fullWidth={false}
                onPress={() => copiar(codigoNovo.codigo)}
              />
            </View>
          ) : null}
        </Card>

        {/* ---- Convites por resgatar ---- */}
        {convitesAtivos.length > 0 ? (
          <>
            <Text variant="h3" style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
              Convites por usar ({convitesAtivos.length})
            </Text>
            <Card padded={false}>
              <View style={{ paddingHorizontal: spacing.md }}>
                {convitesAtivos.map((c, i) => (
                  <View
                    key={c.codigo}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      borderBottomWidth: i < convitesAtivos.length - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" style={{ letterSpacing: 2 }}>{c.codigo}</Text>
                      <Text variant="secondary" color={colors.textSecondary}>
                        {legendaRole(c.role)}
                        {c.acessoHoras ? ` · ${rotuloDuracao(c.acessoHoras)} de acesso` : ''}
                        {c.expiraEm ? ` · código expira ${formatDataCurta(c.expiraEm)}` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => copiar(c.codigo)} hitSlop={8} accessibilityLabel="Copiar">
                      <Icon name="content-copy" size="md" color={colors.primary} />
                    </Pressable>
                    <Pressable onPress={() => apagarConvite(c.codigo)} hitSlop={8} accessibilityLabel="Apagar convite">
                      <Icon name="trash-can-outline" size="md" color={colors.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function iconeDoRole(r: RoleMembro): IconName {
  if (r === 'admin') return 'shield-crown';
  if (r === 'veterinario') return 'medical-bag';
  return 'account-hard-hat';
}

function corDoRole(r: RoleMembro): string {
  if (r === 'admin') return colors.primary;
  if (r === 'veterinario') return colors.info;
  return colors.warning;
}

function legendaRole(r: RoleMembro): string {
  if (r === 'admin') return 'Administrador';
  if (r === 'veterinario') return 'Veterinário';
  return 'Trabalhador';
}

function formatDataCurta(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}
