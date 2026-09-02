import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  CampoData,
  CampoHora,
  Card,
  Chip,
  EmptyState,
  Header,
  Icon,
  type IconName,
  Text,
} from '@/components/ui';
import {
  acessoTerminou,
  combinarDataHora,
  DURACAO_OMISSAO,
  DURACOES_ACESSO,
  HORA_OMISSAO,
  HORAS_SUGERIDAS,
  perguntaDePrazo,
  problemaComFim,
  rotuloDuracao,
  rotuloPrazo,
} from '@/data/acessoTemporario';
import { confirmar } from '@/data/avisos';
import { formatDataCurta as formatarDia, formatDataHora, parseDataPt } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { legendaRole } from '@/data/permissoes';
import { useGado } from '@/data/store';
import { useToasts } from '@/data/toasts';
import type { Convite, MembroExploracao, RoleMembro } from '@/data/types';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

type MembroComNome = MembroExploracao & { nome: string };

/** Os papéis que um convite pode dar. O de supervisor não se convida. */
type RoleConvidavel = Exclude<RoleMembro, 'supervisor'>;

/**
 * As funções que se podem convidar para esta exploração.
 *
 * `admin` só aparece a quem é SUPERVISOR dela, e aí chama-se líder de
 * exploração: é a pessoa que a vai correr por conta da sociedade. Quem tem a
 * sua própria exploração já é o dono dela e não tem um segundo para convidar
 * — o servidor recusa esse código (ver `criar_convite` em
 * `supabase/schema_sociedade.sql`), e um chip que gera sempre um erro é pior
 * do que um chip que não existe.
 */
function rolesOpcoes(souSupervisor: boolean): {
  valor: RoleConvidavel;
  label: string;
  icon: IconName;
}[] {
  return [
    ...(souSupervisor
      ? [{ valor: 'admin' as const, label: t('papel.lider'), icon: 'shield-crown' as IconName }]
      : []),
    { valor: 'trabalhador', label: t('papel.trabalhador'), icon: 'account-hard-hat' },
    { valor: 'veterinario', label: t('papel.veterinario'), icon: 'medical-bag' },
  ];
}

/** Ecrã para o admin duma exploração gerir a equipa (membros + convites). */
export default function EquipaExploracaoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { exploracaoById } = useGado();
  const {
    roleEm,
    listarMembrosDe,
    removerMembro,
    listarConvites,
    criarConvite,
    removerConvite,
    definirPrazoDeAcesso,
    definirFimDeAcesso,
    pode,
    isSuperadmin,
    supervisionada,
  } = useMembros();

  const toast = useToasts();

  const exploracao = id ? exploracaoById(id) : undefined;
  // O `roleEm` fica em primeiro para o admin com a conta suspensa continuar a
  // ver a equipa (só de leitura, como o resto da app): o `pode` responderia que
  // não e trocava-lhe o ecrã por um "sem permissão" que não é o que se passa.
  // O `pode` entra a seguir para cobrir o modo local/demo, onde não há equipa
  // nem papéis e quem está no aparelho é o dono.
  const meuPapel = id ? roleEm(id) : undefined;
  const souSupervisor = meuPapel === 'supervisor';
  const podeGerir = id
    ? meuPapel === 'admin' || souSupervisor || isSuperadmin || pode(id, 'gerirEquipa')
    : false;
  const eDaSociedade = id ? supervisionada(id) : false;

  const [membros, setMembros] = useState<MembroComNome[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [rolePedido, setRolePedido] = useState<RoleConvidavel>('trabalhador');
  const [descricao, setDescricao] = useState('');
  const [aGerar, setAGerar] = useState(false);
  const [codigoNovo, setCodigoNovo] = useState<{
    codigo: string;
    acessoHoras?: number;
    acessoAte?: string;
  } | null>(null);
  /**
   * Quanto tempo o acesso dura. Só se pergunta ao VETERINÁRIO: ele vem à
   * exploração, faz o que tem a fazer e vai-se embora, e um acesso que só
   * termina quando alguém se lembra de o tirar é um acesso que não termina. O
   * trabalhador anda lá todos os dias e fica sem prazo.
   */
  const [acessoHoras, setAcessoHoras] = useState<number>(DURACAO_OMISSAO);
  /**
   * As duas maneiras de dizer até quando, porque são duas perguntas diferentes:
   *
   *   'duracao' — "durante 4 horas", a contar de quando ele usar o código. Serve
   *               quando não se sabe o dia da visita.
   *   'ate'     — "até quinta às 18h", a hora exata. É a frase que o criador diz
   *               de facto quando já combinou a visita, e com a duração ela não
   *               se conseguia escrever: obrigava a adivinhar a que horas é que
   *               o veterinário ia entrar e a fazer a conta de cabeça.
   */
  const [modoPrazo, setModoPrazo] = useState<'duracao' | 'ate'>('duracao');
  /** Quem tem os campos de dia/hora abertos na lista de membros (pelo id do vínculo). */
  const [aMarcar, setAMarcar] = useState<string | undefined>(undefined);
  /**
   * O código que está mesmo na área de transferência.
   *
   * Guarda-se o CÓDIGO e não um simples `true`: há dois sítios a copiar (a caixa
   * do código acabado de gerar e a lista dos que estão por usar), e com um
   * booleano copiar um deles marcava-os todos como copiados.
   *
   * Não se apaga sozinho ao fim de uns segundos. Quem copia um código vai
   * colá-lo noutra aplicação — no WhatsApp, numa mensagem — e volta à app
   * depois; encontrar o aviso já desaparecido deixava a dúvida de saber se
   * chegou a copiar. Fica até se copiar outro.
   */
  const [copiado, setCopiado] = useState<string | null>(null);
  const [diaFim, setDiaFim] = useState(() => formatarDia(new Date().toISOString()));
  const [horaFim, setHoraFim] = useState(HORA_OMISSAO);
  const comPrazo = rolePedido === 'veterinario';

  /** O instante escolhido nos campos de dia/hora, ou `null` se ainda não serve. */
  const fimEscolhido = combinarDataHora(parseDataPt(diaFim, { permitirFuturo: true }), horaFim);

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

    // O que se envia: OU as horas, OU a hora marcada. Nunca as duas — o
    // servidor limpa uma delas de qualquer forma, mas mandar as duas era pedir
    // uma coisa e receber outra sem nada o dizer.
    const comHoraMarcada = comPrazo && modoPrazo === 'ate';
    if (comHoraMarcada) {
      const problema = problemaComFim(parseDataPt(diaFim, { permitirFuturo: true }), horaFim);
      if (problema) {
        setErro(problema);
        toast.erro('Código não criado', problema);
        return;
      }
    }
    const horas = comPrazo && !comHoraMarcada ? acessoHoras : undefined;
    const ate = comHoraMarcada ? (fimEscolhido ?? undefined) : undefined;

    setAGerar(true);
    setCodigoNovo(null);
    setErro(null);
    const r = await criarConvite(id, rolePedido, descricao.trim() || undefined, 168, horas, ate);
    setAGerar(false);
    if (r.erro) {
      setErro(r.erro);
      toast.erro('Código não criado', r.erro);
      return;
    }
    if (r.codigo) {
      setCodigoNovo({ codigo: r.codigo, acessoHoras: horas, acessoAte: ate });
      setDescricao('');
      const prazo = ate
        ? ` · até ${formatDataHora(ate)}`
        : horas
          ? ` · ${rotuloDuracao(horas)}`
          : '';
      toast.sucesso('Código criado', `${r.codigo} · ${legendaRole(rolePedido, souSupervisor)}${prazo}`);
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

  /**
   * O mesmo, mas a perguntar primeiro.
   *
   * Estes chips estão todos encostados uns aos outros e um deles corta o acesso
   * a alguém que está a trabalhar. A pergunta diz sempre a hora a que o acesso
   * passa a acabar — e avisa quando a escolha o ENCURTA, porque o servidor marca
   * o tempo a contar de agora em vez de somar ao que já lá está.
   */
  function pedirEMudarPrazo(membro: MembroComNome, horas: number | null, comoSeChama: string) {
    const p = perguntaDePrazo(horas, { nome: membro.nome, expiraEm: membro.expiraEm }, formatDataHora);
    confirmar(p.titulo, p.mensagem, () => void mudarPrazo(membro, horas, comoSeChama), {
      rotuloConfirmar: p.rotuloConfirmar,
      destrutivo: p.destrutivo,
    });
  }

  /** Marca a hora exata a que o acesso de alguém termina. */
  async function marcarFim(membro: MembroComNome) {
    const problema = problemaComFim(parseDataPt(diaFim, { permitirFuturo: true }), horaFim);
    if (problema) {
      setErro(problema);
      toast.erro('A hora não foi marcada', problema);
      return;
    }
    const e = await definirFimDeAcesso(membro.id, fimEscolhido);
    if (e) {
      setErro(e);
      toast.erro('O tempo de acesso não mudou', e);
      return;
    }
    setAMarcar(undefined);
    toast.sucesso('Acesso marcado', `${membro.nome} · até ${formatDataHora(fimEscolhido as string)}`);
    await carregar();
  }

  async function copiar(codigo: string) {
    // Web: usa Clipboard API. Nativo: por agora só mostra alerta (adicionar
    // expo-clipboard se se quiser copiar diretamente no telemóvel).
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(codigo);
        // A marca de "copiado" só se põe DEPOIS de o browser aceitar. Pô-la
        // antes, ou no ramo do alerta lá em baixo, dava um ecrã a garantir que
        // o código estava na área de transferência quando não estava — e quem
        // fosse colá-lo à mensagem colava outra coisa qualquer.
        setCopiado(codigo);
        toast.sucesso('Código copiado', codigo);
      } catch {
        // O browser pode recusar a área de transferência (sem HTTPS, sem foco).
        // O código continua à vista no ecrã — é só dizer que não foi copiado.
        setCopiado(null);
        toast.erro('Não foi possível copiar', 'Escreva o código à mão.');
      }
      return;
    }
    Alert.alert('Código', codigo, [{ text: 'OK' }]);
  }

  /**
   * Tirar alguém da equipa, a perguntar primeiro.
   *
   * Pergunta pelo `confirmar()` da app e não pelo diálogo do sistema (ver
   * `data/avisos.ts`): este era dos últimos sítios com um `window.confirm`, que
   * na app de computador aparecia como uma barra do navegador agarrada ao topo
   * da janela — com "localhost:8081 diz" por cima da pergunta mais destrutiva
   * deste ecrã.
   *
   * A pergunta diz o que se perde e o que fica. As permissões que o dono
   * ajustou àquela pessoa vão-se com o vínculo, e essa é a parte que ninguém
   * espera; a passagem dela pela exploração fica no histórico, e essa é a parte
   * que sossega quem hesita em remover.
   */
  function confirmarRemover(membro: MembroComNome) {
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
    confirmar(
      'Remover da equipa',
      `${membro.nome} deixa de ver esta exploração já. As permissões que lhe ajustou perdem-se, e para voltar precisa de um código novo. `
        + 'A passagem dele por aqui fica no histórico da equipa, e o que ele registou não se apaga.',
      () => void executar(),
      { rotuloConfirmar: 'Remover', destrutivo: true },
    );
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
        <Header title={t('equipaExp.titulo')} />
        <EmptyState
          icon="barn"
          title={t('formExploracao.naoEncontrada')}
          message={t('ficha.jaNaoExiste')}
        />
      </View>
    );
  }

  if (!podeGerir) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header title={t('equipaExp.titulo')} />
        <EmptyState
          icon="shield-off-outline"
          title={t('formLote.semPermissaoTitulo')}
          message={t('equipaExp.semPermissao')}
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

        {/* Uma exploração de sociedade acabada de criar não tem ninguém que
            possa registar um animal: o supervisor não mexe no gado e ainda não
            há líder. Sem este aviso, ele criava a exploração, procurava o botão
            de registar e não o encontrava, sem uma palavra que explicasse
            porquê. */}
        {souSupervisor && !aCarregar && !membros.some((m) => m.role === 'admin') ? (
          <Card style={{ backgroundColor: colors.primaryTint, marginTop: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Icon name="shield-crown" size="md" color={colors.primaryDark} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" color={colors.primaryDark}>
                  {t('equipaExp.faltaLiderTitulo')}
                </Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  {t('equipaExp.faltaLiderTexto')}
                </Text>
              </View>
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
                // Quem responde pela exploração não tem prazo a mexer nem sai
                // por um toque nesta lista.
                const eChefia = m.role === 'admin' || m.role === 'supervisor';
                /**
                 * A linha do SUPERVISOR não se apaga por ninguém: era assim que
                 * o líder trancava fora da exploração a pessoa que a criou e a
                 * paga (a RLS também o recusa, ver `membro_admin_write`).
                 *
                 * A do LÍDER apaga-se, mas só pelo supervisor: é como se troca
                 * de responsável por uma exploração da sociedade. Numa
                 * exploração normal não há linha de admin para apagar sem ser a
                 * do próprio dono, e essa continua sem botão.
                 */
                const podeRemover =
                  m.role === 'supervisor' ? false : m.role === 'admin' ? souSupervisor : true;
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
                        <Text variant="secondary" color={colors.textSecondary}>
                          {legendaRole(m.role, eDaSociedade)}
                        </Text>
                        {!eChefia && m.expiraEm ? (
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
                      {!podeRemover ? (
                        <Text variant="caption" color={colors.textMuted}>
                          {legendaRole(m.role, eDaSociedade).toLowerCase()}
                        </Text>
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

                    {/* Mexer no relógio de quem já cá está. Fora de quem
                        responde pela exploração, que não tem prazo a mexer. */}
                    {!eChefia ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: spacing.xs,
                          marginTop: spacing.xs,
                          marginLeft: 40 + spacing.sm,
                        }}>
                        {/* Sem o "+": o servidor marca este tempo A CONTAR DE
                            AGORA, não o soma ao que lá está. O sinal de mais
                            dizia o contrário do que acontecia. */}
                        {DURACOES_ACESSO.slice(0, 4).map((d) => (
                          <Chip
                            key={d.horas}
                            label={terminou ? `Reabrir ${d.label}` : d.label}
                            onPress={() =>
                              pedirEMudarPrazo(
                                m,
                                d.horas,
                                terminou ? 'Acesso reaberto' : 'Tempo de acesso alterado',
                              )
                            }
                          />
                        ))}
                        {/* A hora exata, para quem já cá está. É a mesma escolha
                            do convite: "mais 4 horas" e "até quinta às 18h" são
                            as duas frases que se dizem, e só uma delas se
                            conseguia escrever. */}
                        <Chip
                          label={t('acesso.ateDiaEHora')}
                          icon="calendar-clock"
                          selected={aMarcar === m.id}
                          onPress={() => setAMarcar(aMarcar === m.id ? undefined : m.id)}
                        />
                        {/* Sem exigir que já tenha prazo: quem foi convidado
                            "sem prazo" também se tem de conseguir cortar, e a
                            alternativa era removê-lo da equipa — que apaga o
                            vínculo e as permissões dele com ele. */}
                        {!terminou ? (
                          <Chip
                            label={t('acesso.terminarJa')}
                            icon="clock-remove-outline"
                            onPress={() => pedirEMudarPrazo(m, 0, 'Acesso terminado')}
                          />
                        ) : null}
                        {m.expiraEm ? null : (
                          <Text variant="caption" color={colors.textMuted} style={{ alignSelf: 'center' }}>
                            sem prazo
                          </Text>
                        )}
                      </View>
                    ) : null}

                    {aMarcar === m.id ? (
                      <View
                        style={{
                          marginTop: spacing.sm,
                          marginLeft: 40 + spacing.sm,
                          gap: spacing.sm,
                        }}>
                        <CampoData
                          value={diaFim}
                          onChangeText={setDiaFim}
                          placeholder={t('agenda.exDia')}
                          permitirFuturo
                          rotuloCalendario={`Dia em que o acesso de ${m.nome} termina`}
                        />
                        <CampoHora
                          value={horaFim}
                          onChangeText={setHoraFim}
                          rotuloRelogio={`Hora a que o acesso de ${m.nome} termina`}
                        />
                        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                          {HORAS_SUGERIDAS.map((h) => (
                            <Chip
                              key={h}
                              label={h}
                              selected={horaFim === h}
                              onPress={() => setHoraFim(h)}
                            />
                          ))}
                        </View>
                        <Text
                          variant="secondary"
                          color={fimEscolhido ? colors.primaryDark : colors.danger}>
                          {problemaComFim(parseDataPt(diaFim, { permitirFuturo: true }), horaFim)
                            ?? `Termina a ${formatDataHora(fimEscolhido as string)}.`}
                        </Text>
                        <Button
                          label={t('acesso.marcarEstaHora')}
                          icon="calendar-clock"
                          variant="secondary"
                          onPress={() => void marcarFim(m)}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Card>
        )}

        {/* Quem já cá não anda. Fica ao pé da lista de quem cá anda porque é a
            pergunta seguinte a essa — e porque é aqui que se dá por falta de
            alguém que se lembra de ter convidado. */}
        <Button
          label={t('equipa.verQuemCaEsteve')}
          icon="account-clock-outline"
          variant="ghost"
          onPress={() => router.push(`/equipa/historico?exploracao=${id}`)}
          style={{ marginTop: spacing.sm }}
        />

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
            {rolesOpcoes(souSupervisor).map((r) => (
              <Chip
                key={r.valor}
                label={r.label}
                icon={r.icon}
                selected={rolePedido === r.valor}
                onPress={() => setRolePedido(r.valor)}
              />
            ))}
          </View>
          {rolePedido === 'admin' ? (
            <Text
              variant="secondary"
              color={colors.textSecondary}
              style={{ marginTop: spacing.sm }}
            >
              {t('equipaExp.oQueOLiderFaz')}
            </Text>
          ) : null}

          {/* Quanto tempo o acesso dura. Só ao veterinário: ele vem cá fazer uma
              coisa e vai-se embora, e é isso que o prazo escreve. */}
          {comPrazo ? (
            <View style={{ marginTop: spacing.md }}>
              <Text variant="bodyStrong" style={{ marginBottom: 4 }}>
                Até quando?
              </Text>
              <Text variant="secondary" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
                Passado o prazo, deixa de ver esta exploração. A conta dele fica, e pode
                voltar a ser convidado.
              </Text>

              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                <Chip
                  label={t('acesso.duranteUmTempo')}
                  icon="timer-sand"
                  selected={modoPrazo === 'duracao'}
                  onPress={() => setModoPrazo('duracao')}
                />
                <Chip
                  label={t('acesso.ateDiaEHora')}
                  icon="calendar-clock"
                  selected={modoPrazo === 'ate'}
                  onPress={() => setModoPrazo('ate')}
                />
              </View>

              {modoPrazo === 'duracao' ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
                    O tempo começa a contar quando ele usar o código, não agora.
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
              ) : (
                <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted}>
                    O acesso termina nesta hora, tenha ele entrado quando tiver.
                  </Text>
                  <CampoData
                    value={diaFim}
                    onChangeText={setDiaFim}
                    placeholder={t('agenda.exDia')}
                    permitirFuturo
                    rotuloCalendario="Escolher o dia em que o acesso termina"
                  />
                  <CampoHora
                    value={horaFim}
                    onChangeText={setHoraFim}
                    rotuloRelogio="Escolher a hora a que o acesso termina"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
                    {HORAS_SUGERIDAS.map((h) => (
                      <Chip
                        key={h}
                        label={h}
                        selected={horaFim === h}
                        onPress={() => setHoraFim(h)}
                      />
                    ))}
                  </View>
                  {/* O que ficou escolhido, por extenso. Confirmar a data pelos
                      dígitos que se acabou de escrever é ler o mesmo engano
                      duas vezes. */}
                  <Text
                    variant="secondary"
                    color={fimEscolhido ? colors.primaryDark : colors.danger}>
                    {problemaComFim(parseDataPt(diaFim, { permitirFuturo: true }), horaFim)
                      ?? `Termina a ${formatDataHora(fimEscolhido as string)}.`}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          <Button
            label={t('equipaExp.gerarCodigo')}
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
              <Text variant="caption" color={colors.textSecondary}>
                {codigoNovo.acessoAte
                  ? `Código (válido até ${formatDataHora(codigoNovo.acessoAte)})`
                  : 'Código (válido 7 dias)'}
              </Text>
              <Text style={{ fontFamily: 'Nunito_800ExtraBold', fontSize: 32, letterSpacing: 3, color: colors.primaryDark, marginVertical: 4 }}>
                {codigoNovo.codigo}
              </Text>
              <Text variant="secondary" color={colors.textSecondary} center style={{ marginBottom: spacing.sm }}>
                {codigoNovo.acessoAte
                  ? `Dá acesso até ${formatDataHora(codigoNovo.acessoAte)}, entre ele quando entrar.`
                  : codigoNovo.acessoHoras
                    ? `Dá acesso durante ${rotuloDuracao(codigoNovo.acessoHoras)} a contar de quando o usar.`
                    : 'Dá acesso sem prazo, até ser removido da equipa.'}
              </Text>
              {/* Copiar é a única ação desta caixa que não deixa rasto nenhum:
                  o código já estava no ecrã antes e continua igual depois. Sem
                  esta linha, quem carregava ficava sem saber se tinha carregado
                  — e carregava outra vez, por via das dúvidas. */}
              {copiado === codigoNovo.codigo ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    marginBottom: spacing.sm,
                  }}>
                  <Icon name="check-circle" size="md" color={colors.success} />
                  <Text variant="bodyStrong" color={colors.success}>
                    Código copiado
                  </Text>
                </View>
              ) : null}
              {/* O botão continua lá, e a copiar: o rótulo é que muda para
                  dizer o que já aconteceu. Desativá-lo prendia quem tivesse
                  copiado e depois perdido a área de transferência noutra app. */}
              <Button
                label={copiado === codigoNovo.codigo ? 'Copiar outra vez' : 'Copiar código'}
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
                        {legendaRole(c.role, eDaSociedade)}
                        {c.acessoAte
                          ? ` · acesso até ${formatDataHora(c.acessoAte)}`
                          : c.acessoHoras
                            ? ` · ${rotuloDuracao(c.acessoHoras)} de acesso`
                            : ''}
                        {c.expiraEm && !c.acessoAte
                          ? ` · código expira ${formatDataCurta(c.expiraEm)}`
                          : ''}
                      </Text>
                      {copiado === c.codigo ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Icon name="check-circle" size="xs" color={colors.success} />
                          <Text variant="caption" color={colors.success}>
                            Código copiado
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Mesmo botão, mesma ação: só o ícone diz que já foi
                        copiado uma vez. Ver a nota da caixa do código novo. */}
                    <Pressable
                      onPress={() => copiar(c.codigo)}
                      hitSlop={8}
                      accessibilityLabel={copiado === c.codigo ? 'Copiar outra vez' : 'Copiar'}>
                      <Icon
                        name={copiado === c.codigo ? 'check-circle' : 'content-copy'}
                        size="md"
                        color={copiado === c.codigo ? colors.success : colors.primary}
                      />
                    </Pressable>
                    <Pressable onPress={() => apagarConvite(c.codigo)} hitSlop={8} accessibilityLabel={t('equipaExp.apagarConvite')}>
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
  if (r === 'supervisor') return 'account-tie';
  if (r === 'admin') return 'shield-crown';
  if (r === 'veterinario') return 'medical-bag';
  return 'account-hard-hat';
}

function corDoRole(r: RoleMembro): string {
  if (r === 'admin' || r === 'supervisor') return colors.primary;
  if (r === 'veterinario') return colors.info;
  return colors.warning;
}

function formatDataCurta(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}
