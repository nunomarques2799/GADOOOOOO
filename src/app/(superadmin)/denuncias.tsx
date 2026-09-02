import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Card, EmptyState, Icon, type IconName, Text, TextField } from '@/components/ui';
import { confirmar } from '@/data/avisos';
import { duracaoCurta } from '@/data/chat';
import {
  contarAbertas,
  MAX_NOTA,
  nomeDaPessoa,
  ordenarDenuncias,
  pessoasEnvolvidas,
  problemaComNota,
  resumoDoConteudo,
  rotuloTipo,
  temFicheiroParaVer,
  type Denuncia,
  type MensagemDoContexto,
  type PessoaDenunciada,
} from '@/data/denuncias';
import {
  ligacaoParaFicheiroDenunciado,
  listarDenuncias,
  pessoasDasDenuncias,
  reabrirDenuncia,
  tratarDenuncia,
} from '@/data/denunciasApi';
import { formatDataHora } from '@/data/helpers';
import { useMembros } from '@/data/membros';
import { useToasts } from '@/data/toasts';
import { definirPorTratar } from '@/data/useDenuncias';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';

/**
 * A fila de moderação.
 * ------------------------------------------------------------------
 * É este ecrã que fecha a diretriz 1.2 da Apple. Ela pede três coisas a quem
 * deixa pessoas escrever umas às outras: denunciar, bloquear, e ALGUÉM A AGIR
 * sobre o que foi denunciado. As duas primeiras estão na app desde a fase 1;
 * sem esta, o botão de denunciar não levava a lado nenhum.
 *
 * O QUE SE VÊ AQUI, E SÓ
 *
 * A cópia da mensagem que alguém entregou, com as três anteriores que o
 * servidor juntou para se perceber o que se estava a passar. Não há por onde
 * abrir a conversa de onde ela veio: as conversas dos clientes não se leem, e
 * as políticas do `schema_chat.sql` não deixariam ainda que este ecrã tentasse
 * (é o único ficheiro de schema sem `eh_superadmin()`, e a ausência é a
 * funcionalidade).
 *
 * AS DUAS AÇÕES
 *
 * "Tratada" arruma a denúncia e regista a decisão. "Suspender a conta" é o que
 * a diretriz chama ejetar: passa o perfil a `pendente`, e a partir daí o
 * servidor recusa-lhe qualquer escrita, mensagens incluídas (o
 * `posso_escrever_na_conversa()` começa por `perfil_ativo()`). Continua a
 * poder LER o que é dela, que é o princípio da suspensão nesta app.
 *
 * Este ecrã não se traduz, como o resto do painel de superadmin (ver AGENTS.md).
 */

type Filtro = 'abertas' | 'tratadas' | 'todas';

export default function DenunciasScreen() {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const toasts = useToasts();
  const { bloquearCliente } = useMembros();

  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [pessoas, setPessoas] = useState<Record<string, PessoaDenunciada>>({});
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [aTratar, setATratar] = useState<Denuncia | null>(null);
  const [aProcessar, setAProcessar] = useState<string | null>(null);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setACarregar(true);
    setErro(null);
    try {
      const lista = await listarDenuncias();
      setDenuncias(ordenarDenuncias(lista));
      // O ponto vermelho da barra sai desta mesma leitura. Perguntar outra vez
      // ao servidor pelo número que já está aqui era uma ida a mais, e uma
      // janela em que a barra dizia o contrário da lista.
      definirPorTratar(contarAbertas(lista));
      // Os nomes numa ida só, depois da lista: sem denúncias não há ninguém
      // para nomear, e a segunda chamada seria uma pergunta sobre uma lista
      // vazia.
      const ids = pessoasEnvolvidas(lista);
      setPessoas(ids.length > 0 ? await pessoasDasDenuncias(ids) : {});
    } catch (e) {
      setErro((e as Error).message ?? 'Não foi possível ler as denúncias.');
    }
    setACarregar(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abertas = useMemo(() => contarAbertas(denuncias), [denuncias]);
  const tratadas = denuncias.length - abertas;

  const filtradas = useMemo(() => {
    if (filtro === 'abertas') return denuncias.filter((d) => d.estado === 'aberta');
    if (filtro === 'tratadas') return denuncias.filter((d) => d.estado === 'tratada');
    return denuncias;
  }, [filtro, denuncias]);

  async function confirmarTratada(d: Denuncia, nota: string) {
    setATratar(null);
    setAProcessar(d.id);
    const e = await tratarDenuncia(d.id, nota);
    setAProcessar(null);
    if (e) {
      toasts.erro('Não foi possível fechar a denúncia.', e);
      return;
    }
    toasts.sucesso('Denúncia marcada como tratada.');
    await carregar();
  }

  async function reabrir(d: Denuncia) {
    setAProcessar(d.id);
    const e = await reabrirDenuncia(d.id);
    setAProcessar(null);
    if (e) {
      toasts.erro('Não foi possível reabrir a denúncia.', e);
      return;
    }
    toasts.sucesso('Denúncia reaberta.');
    await carregar();
  }

  function suspender(d: Denuncia) {
    if (!d.autorDenunciado) return;
    const quem = nomeDaPessoa(pessoas, d.autorDenunciado);
    confirmar(
      'Suspender a conta?',
      `${quem} deixa de poder escrever seja onde for na app, incluindo nas conversas. Continua a poder ver e exportar os dados que são dela. Para levantar a suspensão, aprova-se outra vez na aba Clientes.`,
      () => {
        void (async () => {
          setAProcessar(d.id);
          const e = await bloquearCliente(d.autorDenunciado as string);
          setAProcessar(null);
          if (e) {
            toasts.erro('Não foi possível suspender a conta.', e);
            return;
          }
          toasts.sucesso('Conta suspensa.', quem);
        })();
      },
      { rotuloConfirmar: 'Suspender', destrutivo: true },
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: desktop ? layout.conteudoDesktop : undefined,
          alignSelf: 'center',
          paddingBottom: spacing.huge + 40,
        }}>
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + (desktop ? spacing.xl : spacing.md),
            paddingBottom: spacing.xxl,
            paddingHorizontal: spacing.lg,
            borderBottomLeftRadius: radii.xl,
            borderBottomRightRadius: radii.xl,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: 4,
            }}>
            <Icon name="shield-crown" size={16} color={colors.textOnDarkMuted} />
            <Text variant="secondary" color={colors.textOnDarkMuted}>
              Painel do administrador
            </Text>
          </View>
          <Text variant="display" color={colors.textOnDark}>
            Denúncias
          </Text>
          <Text variant="body" color={colors.textOnDarkMuted}>
            Mensagens que alguém entregou para serem lidas.
          </Text>
        </LinearGradient>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            marginTop: -spacing.xl,
          }}>
          <StatKpi
            icon="flag-variant"
            valor={abertas}
            legenda="Por tratar"
            tint={abertas > 0 ? colors.danger : colors.success}
          />
          <StatKpi icon="check-decagram" valor={tratadas} legenda="Tratadas" tint={colors.success} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
            <FiltroBtn
              label="Por tratar"
              ativo={filtro === 'abertas'}
              onPress={() => setFiltro('abertas')}
              count={abertas}
            />
            <FiltroBtn
              label="Tratadas"
              ativo={filtro === 'tratadas'}
              onPress={() => setFiltro('tratadas')}
              count={tratadas}
            />
            <FiltroBtn
              label="Todas"
              ativo={filtro === 'todas'}
              onPress={() => setFiltro('todas')}
              count={denuncias.length}
            />
          </View>

          {erro ? (
            <Card style={{ backgroundColor: colors.dangerTint, marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Icon name="alert-circle-outline" size="md" color={colors.danger} />
                <Text variant="body" color={colors.danger} style={{ flex: 1 }}>
                  {erro}
                </Text>
              </View>
            </Card>
          ) : null}

          {aCarregar ? (
            <Card>
              <Text variant="body" color={colors.textSecondary}>
                A carregar…
              </Text>
            </Card>
          ) : filtradas.length === 0 ? (
            <EmptyState
              icon={filtro === 'tratadas' ? 'flag-checkered' : 'flag-outline'}
              title={filtro === 'tratadas' ? 'Nada tratado ainda' : 'Sem denúncias'}
              message={
                filtro === 'tratadas'
                  ? 'Ainda não se fechou nenhuma denúncia.'
                  : 'Ninguém denunciou nenhuma mensagem. É o estado normal.'
              }
            />
          ) : (
            filtradas.map((d) => (
              <CartaoDenuncia
                key={d.id}
                denuncia={d}
                pessoas={pessoas}
                aProcessar={aProcessar === d.id}
                onTratar={() => setATratar(d)}
                onReabrir={() => void reabrir(d)}
                onSuspender={() => suspender(d)}
                onVerFoto={setFotoAberta}
              />
            ))
          )}
        </View>
      </ScrollView>

      <ModalTratar
        denuncia={aTratar}
        onFechar={() => setATratar(null)}
        onConfirmar={(nota) => {
          if (aTratar) void confirmarTratada(aTratar, nota);
        }}
      />
      <VerFotografia caminho={fotoAberta} onFechar={() => setFotoAberta(null)} />
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  O cartão
 * ------------------------------------------------------------------ */

function CartaoDenuncia({
  denuncia: d,
  pessoas,
  aProcessar,
  onTratar,
  onReabrir,
  onSuspender,
  onVerFoto,
}: {
  denuncia: Denuncia;
  pessoas: Record<string, PessoaDenunciada>;
  aProcessar: boolean;
  onTratar: () => void;
  onReabrir: () => void;
  onSuspender: () => void;
  onVerFoto: (caminho: string) => void;
}) {
  const [contextoAberto, setContextoAberto] = useState(false);
  const aberta = d.estado === 'aberta';
  const autor = nomeDaPessoa(pessoas, d.autorDenunciado);
  const telefone = d.autorDenunciado ? pessoas[d.autorDenunciado]?.telefone : undefined;

  return (
    <Card style={{ marginBottom: spacing.sm }} padded={false}>
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        {/* Estado + quando */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {aberta ? (
            <Badge tone="danger" icon="flag-variant" label="Por tratar" />
          ) : (
            <Badge tone="success" icon="check-decagram" label="Tratada" />
          )}
          <Badge tone="neutral" icon={iconeDoTipo(d.tipo)} label={rotuloTipo(d.tipo)} />
          <Text variant="caption" color={colors.textMuted} style={{ marginLeft: 'auto' }}>
            {formatDataHora(d.criadoEm)}
          </Text>
        </View>

        {/* Quem e quem */}
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="account-alert-outline" size="sm" color={colors.danger} />
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
              {autor}
            </Text>
            <Text variant="secondary" color={colors.textSecondary}>
              escreveu
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="flag-outline" size="sm" color={colors.textMuted} />
            <Text variant="secondary" color={colors.textSecondary} numberOfLines={1}>
              Denunciada por {nomeDaPessoa(pessoas, d.denunciadoPor)}
            </Text>
          </View>
          {telefone ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="phone-outline" size="sm" color={colors.textMuted} />
              <Text variant="secondary" color={colors.textSecondary}>
                {telefone}
              </Text>
            </View>
          ) : null}
        </View>

        {/* O motivo, quando quem denunciou escreveu um */}
        {d.motivo ? (
          <View
            style={{
              backgroundColor: colors.surfaceSunken,
              borderRadius: radii.md,
              padding: spacing.sm,
            }}>
            <Text variant="caption" color={colors.textMuted}>
              Motivo indicado
            </Text>
            <Text variant="body">{d.motivo}</Text>
          </View>
        ) : null}

        {/* O que foi denunciado */}
        <View
          style={{
            borderWidth: 1.5,
            borderColor: aberta ? colors.danger : colors.border,
            borderRadius: radii.md,
            padding: spacing.sm,
            gap: spacing.xs,
            backgroundColor: colors.surface,
          }}>
          <ConteudoDenunciado denuncia={d} onVerFoto={onVerFoto} />
        </View>

        {/* As três anteriores */}
        {d.contexto.length > 0 ? (
          <View>
            <Pressable
              onPress={() => setContextoAberto((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: contextoAberto }}
              accessibilityLabel={
                contextoAberto
                  ? 'Esconder o que veio antes'
                  : `Ver o que veio antes (${d.contexto.length})`
              }
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon
                name={contextoAberto ? 'chevron-up' : 'chevron-down'}
                size="sm"
                color={colors.primary}
              />
              <Text variant="secondary" color={colors.primaryDark}>
                {contextoAberto
                  ? 'Esconder o que veio antes'
                  : `Ver o que veio antes (${d.contexto.length})`}
              </Text>
            </Pressable>
            {contextoAberto ? (
              <View
                style={{
                  gap: spacing.xs,
                  paddingLeft: spacing.sm,
                  borderLeftWidth: 2,
                  borderLeftColor: colors.border,
                }}>
                {d.contexto.map((c, i) => (
                  <LinhaDeContexto key={i} linha={c} pessoas={pessoas} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* A decisão, quando já foi tomada */}
        {!aberta && d.notaSuperadmin ? (
          <View
            style={{
              backgroundColor: colors.successTint,
              borderRadius: radii.md,
              padding: spacing.sm,
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="note-text-outline" size="sm" color={colors.success} />
              <Text variant="caption" color={colors.textSecondary}>
                Decidido {d.tratadoEm ? `a ${formatDataHora(d.tratadoEm)}` : ''}
              </Text>
            </View>
            <Text variant="body">{d.notaSuperadmin}</Text>
          </View>
        ) : null}

        {/* O que se pode fazer */}
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {aberta ? (
            <>
              <BotaoAcao
                label="Marcar como tratada"
                icon="check-circle-outline"
                onPress={onTratar}
                disabled={aProcessar}
                principal
              />
              {d.autorDenunciado ? (
                <BotaoAcao
                  label="Suspender a conta"
                  icon="account-cancel-outline"
                  onPress={onSuspender}
                  disabled={aProcessar}
                  destrutivo
                />
              ) : null}
            </>
          ) : (
            <BotaoAcao
              label="Reabrir"
              icon="undo-variant"
              onPress={onReabrir}
              disabled={aProcessar}
            />
          )}
        </View>
      </View>
    </Card>
  );
}

function iconeDoTipo(tipo: Denuncia['tipo']): IconName {
  if (tipo === 'foto') return 'image-outline';
  if (tipo === 'audio') return 'microphone-message';
  if (tipo === 'local') return 'map-marker';
  if (tipo === 'sondagem') return 'poll';
  return 'text-box-outline';
}

/* ------------------------------------------------------------------ *
 *  O conteúdo denunciado
 * ------------------------------------------------------------------ */

function ConteudoDenunciado({
  denuncia: d,
  onVerFoto,
}: {
  denuncia: Denuncia;
  onVerFoto: (caminho: string) => void;
}) {
  if (temFicheiroParaVer(d) && d.anexo) {
    const caminho = d.anexo;
    return (
      <>
        {d.tipo === 'foto' ? (
          <FotografiaDenunciada caminho={caminho} onAbrir={onVerFoto} />
        ) : (
          <AudioDenunciado caminho={caminho} />
        )}
        {d.textoCopia.trim() ? (
          <Text variant="body">{d.textoCopia}</Text>
        ) : (
          <Text variant="caption" color={colors.textMuted}>
            Sem legenda.
          </Text>
        )}
        {d.estado === 'aberta' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="folder-alert-outline" size="xs" color={colors.warning} />
            <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
              O ficheiro só se vê enquanto a denúncia estiver por tratar. Depois de fechada, a
              limpeza apaga-o.
            </Text>
          </View>
        ) : null}
      </>
    );
  }

  if (d.tipo === 'local') {
    // As coordenadas não são copiadas para a fila: o que ficou foi o nome que
    // quem marcou o ponto lhe deu. Chega para julgar a mensagem, e é o que a
    // denúncia entregou.
    return (
      <>
        <Text variant="body">{resumoDoConteudo(d)}</Text>
        <Text variant="caption" color={colors.textMuted}>
          Um ponto marcado no mapa. As coordenadas não vêm na denúncia.
        </Text>
      </>
    );
  }

  return <Text variant="body">{resumoDoConteudo(d)}</Text>;
}

/**
 * A fotografia denunciada.
 *
 * O bucket é privado e o endereço é assinado e de prazo curto, como na
 * conversa. A diferença é a porta: aqui quem a abre é a exceção do denunciado
 * na política `chat_bucket_read`, e não a pertença à conversa.
 */
function FotografiaDenunciada({
  caminho,
  onAbrir,
}: {
  caminho: string;
  onAbrir: (caminho: string) => void;
}) {
  const url = useLigacaoAssinada(caminho);

  return (
    <Pressable
      onPress={() => onAbrir(caminho)}
      accessibilityRole="button"
      accessibilityLabel="Ver a fotografia denunciada em grande"
      style={{
        width: '100%',
        height: 220,
        borderRadius: radii.md,
        overflow: 'hidden',
        backgroundColor: colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <Icon name="image-outline" size="xl" color={colors.textMuted} />
      )}
    </Pressable>
  );
}

/** O áudio denunciado: um botão e a duração, como na conversa. */
function AudioDenunciado({ caminho }: { caminho: string }) {
  const url = useLigacaoAssinada(caminho);
  const leitor = useAudioPlayer(url ?? undefined);
  const estado = useAudioPlayerStatus(leitor);
  const aTocar = estado?.playing === true;

  function alternar() {
    if (!url) return;
    if (aTocar) {
      leitor.pause();
      return;
    }
    if (estado?.didJustFinish || (estado?.currentTime ?? 0) >= (estado?.duration ?? 0) - 0.1) {
      leitor.seekTo(0);
    }
    leitor.play();
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pressable
        onPress={alternar}
        disabled={!url}
        accessibilityRole="button"
        accessibilityLabel={aTocar ? 'Parar' : 'Ouvir o áudio denunciado'}
        style={({ pressed }) => [
          {
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: url ? colors.primary : colors.surfaceSunken,
          },
          pressed && { opacity: 0.7 },
        ]}>
        <Icon
          name={aTocar ? 'pause' : 'play'}
          size="md"
          color={url ? colors.onPrimary : colors.textMuted}
        />
      </Pressable>
      <Text variant="body" color={colors.textSecondary}>
        {duracaoCurta(estado?.currentTime ?? 0)} / {duracaoCurta(estado?.duration ?? 0)}
      </Text>
    </View>
  );
}

/**
 * O endereço assinado de um ficheiro, pedido uma vez e esquecido ao sair.
 *
 * O `vivo` existe porque a resposta pode chegar depois de o cartão sair do
 * ecrã (mudar de filtro enquanto a ligação vinha), e escrever estado num
 * componente desmontado é um aviso na consola que ninguém sabe de onde vem.
 */
function useLigacaoAssinada(caminho: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void ligacaoParaFicheiroDenunciado(caminho).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [caminho]);
  return url;
}

/** Uma das mensagens que vieram antes. Só texto: o contexto não copia ficheiros. */
function LinhaDeContexto({
  linha,
  pessoas,
}: {
  linha: MensagemDoContexto;
  pessoas: Record<string, PessoaDenunciada>;
}) {
  const texto = linha.texto.trim();
  return (
    <View style={{ gap: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text variant="caption" color={colors.primaryDark}>
          {nomeDaPessoa(pessoas, linha.autor)}
        </Text>
        {linha.criadoEm ? (
          <Text variant="caption" color={colors.textMuted}>
            {formatDataHora(linha.criadoEm)}
          </Text>
        ) : null}
      </View>
      <Text variant="secondary" color={texto ? colors.textSecondary : colors.textMuted}>
        {texto || rotuloTipo(linha.tipo)}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ *
 *  Fechar a denúncia
 * ------------------------------------------------------------------ */

/**
 * A nota é opcional de propósito.
 *
 * Fechar uma denúncia sem escrever nada é uma decisão legítima ("não é nada"),
 * e obrigar a justificar cada uma levava a que nenhuma fosse fechada e a fila
 * deixasse de dizer o que falta fazer.
 */
function ModalTratar({
  denuncia,
  onFechar,
  onConfirmar,
}: {
  denuncia: Denuncia | null;
  onFechar: () => void;
  onConfirmar: (nota: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (denuncia) setNota('');
  }, [denuncia]);

  if (!denuncia) return null;
  const problema = problemaComNota(nota);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel="Fechar" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
            paddingBottom: (insets.bottom > 0 ? insets.bottom : spacing.md) + spacing.md,
            gap: spacing.sm,
          }}>
          <Text variant="h2">Dar por tratada</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            A denúncia sai da lista de trabalho. Fica registado quando foi fechada, e o que se
            escrever aqui fica com ela.
          </Text>

          <TextField
            value={nota}
            onChangeText={setNota}
            placeholder="O que se decidiu (opcional)"
            multiline
          />
          {problema ? (
            <Text variant="caption" color={colors.danger}>
              {problema}
            </Text>
          ) : (
            <Text variant="caption" color={colors.textMuted}>
              {nota.length} / {MAX_NOTA}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
            <BotaoAcao label="Cancelar" icon="close" onPress={onFechar} />
            <BotaoAcao
              label="Dar por tratada"
              icon="check-circle-outline"
              onPress={() => onConfirmar(nota)}
              disabled={!!problema}
              principal
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A fotografia em grande, por cima de tudo. Toca-se para fechar. */
function VerFotografia({ caminho, onFechar }: { caminho: string | null; onFechar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!caminho) {
      setUrl(null);
      return;
    }
    let vivo = true;
    void ligacaoParaFicheiroDenunciado(caminho).then((u) => {
      if (vivo) setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [caminho]);

  if (!caminho) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onFechar}>
      <Pressable
        onPress={onFechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.md,
        }}>
        {url ? (
          <Image
            source={{ uri: url }}
            style={{ width: '100%', height: '80%' }}
            contentFit="contain"
          />
        ) : (
          <Text variant="body" color={colors.textOnDark}>
            A carregar…
          </Text>
        )}
      </Pressable>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 *  Peças pequenas
 * ------------------------------------------------------------------ */

function StatKpi({
  icon,
  valor,
  legenda,
  tint,
}: {
  icon: IconName;
  valor: string | number;
  legenda: string;
  tint: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        padding: spacing.md,
        alignItems: 'center',
        gap: 2,
      }}>
      <Icon name={icon} size="md" color={tint} />
      <Text variant="h2">{valor}</Text>
      <Text variant="caption" color={colors.textMuted}>
        {legenda}
      </Text>
    </View>
  );
}

function FiltroBtn({
  label,
  ativo,
  onPress,
  count,
}: {
  label: string;
  ativo: boolean;
  onPress: () => void;
  count: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      // O ponto do meio é separador visual e não se lê: sem isto, o leitor de
      // ecrã dizia "Tratadas ponto médio um".
      accessibilityLabel={`${label}, ${count}`}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: spacing.xs,
          paddingHorizontal: spacing.sm,
          borderRadius: radii.pill,
          borderWidth: 1.5,
          borderColor: ativo ? colors.primary : colors.border,
          backgroundColor: ativo ? colors.primaryTint : colors.surface,
          alignItems: 'center',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <Text variant="bodyStrong" color={ativo ? colors.primaryDark : colors.textSecondary}>
        {label} · {count}
      </Text>
    </Pressable>
  );
}

function BotaoAcao({
  label,
  icon,
  onPress,
  disabled,
  principal,
  destrutivo,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  principal?: boolean;
  destrutivo?: boolean;
}) {
  const fundo = principal ? colors.primary : destrutivo ? colors.dangerTint : colors.surfaceSunken;
  const frente = principal ? colors.onPrimary : destrutivo ? colors.danger : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          flex: 1,
          minWidth: 150,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          backgroundColor: fundo,
          borderRadius: radii.pill,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      <Icon name={icon} size="sm" color={frente} />
      <Text variant="button" color={frente}>
        {label}
      </Text>
    </Pressable>
  );
}
