import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, CampoData, CampoHora, Card, Chip, Icon, type IconName, Text } from '@/components/ui';
import {
  acessoTerminou,
  combinarDataHora,
  DURACOES_ACESSO,
  HORA_OMISSAO,
  HORAS_SUGERIDAS,
  perguntaDePrazo,
  problemaComFim,
  rotuloPrazo,
} from '@/data/acessoTemporario';
import { confirmar } from '@/data/avisos';
import { formatDataCurta, formatDataHora, parseDataPt } from '@/data/helpers';
import {
  exigeFinancasAtivas,
  explicacaoCapacidade,
  legendaCapacidade,
  legendaRole,
  permissoesEfetivas,
  rolePode,
  type Capacidade,
  type PermissoesMembro,
} from '@/data/permissoes';
import type { Trabalhador, Vinculo } from '@/data/trabalhadores';
import type { RoleMembro } from '@/data/types';
import { t } from '@/i18n';
import { colors, radii, shadow, spacing } from '@/theme';

const ICONE_CAPACIDADE: Record<Capacidade, IconName> = {
  editarExploracao: 'barn',
  eliminarExploracao: 'delete-alert-outline',
  gerirEquipa: 'account-multiple',
  gerirTerrenos: 'grass',
  editarAnimais: 'cow',
  // `medical-bag` e não `needle`: o `needle` já é o do CUSTO do tratamento, e
  // dois ícones iguais numa lista de interruptores é a melhor forma de o dono
  // ligar o que não queria.
  registarTratamentos: 'medical-bag',
  eliminarAnimais: 'delete-outline',
  registarSaida: 'exit-run',
  // Nunca chega a aparecer nesta folha (o `marcarEventos` está fora das
  // `CAPACIDADES_GERIVEIS`), mas a tabela é exaustiva de propósito: é ela que
  // obriga a decidir um ícone para cada capacidade nova em vez de a deixar
  // aparecer um dia sem nenhum.
  marcarEventos: 'calendar-plus',
  registarDespesa: 'cash-minus',
  registarReceita: 'cash-plus',
  registarCustoTratamento: 'needle',
};

/**
 * O que uma pessoa da equipa pode alterar — por exploração.
 * ------------------------------------------------------------------
 * O papel (trabalhador / veterinário) dá um conjunto de partida, e é ele que
 * manda enquanto ninguém tocar em nada. Esta folha serve para as exceções, que
 * numa exploração a sério são a regra: o vizinho que só vem à ordenha não tem
 * de poder apagar animais, e o veterinário de confiança pode bem mudar o gado
 * de terreno.
 *
 * Guardar escreve o conjunto todo de uma vez (ver `definirPermissoes`), e o
 * servidor decide pela mesma tabela — as políticas de RLS de
 * `supabase/schema_permissoes.sql` leem esta coluna. Sem essa parte, isto seria
 * uma folha de interruptores que esconde botões e não impede nada.
 */
export function FolhaPermissoes({
  pessoa,
  aberto,
  onFechar,
  onGuardar,
  onMudarPrazo,
  onMarcarFim,
  financasAtivasEm,
  onAbrirEquipa,
  onVerAtividade,
}: {
  pessoa: Trabalhador;
  aberto: boolean;
  onFechar: () => void;
  /** Grava e devolve a razão da recusa, ou `null` se ficou gravado. */
  onGuardar: (membroId: string, permissoes: PermissoesMembro) => Promise<string | null>;
  /**
   * Dá mais tempo, tira o prazo ou termina o acesso já. `horas` a `null` tira o
   * prazo; `0` termina-o de imediato. Devolve a razão da recusa, ou `null`.
   */
  onMudarPrazo: (membroId: string, horas: number | null) => Promise<string | null>;
  /** Marca a hora exata a que o acesso termina. Devolve a razão da recusa, ou `null`. */
  onMarcarFim: (membroId: string, fimIso: string) => Promise<string | null>;
  /** A gestão económica está ligada nesta exploração? */
  financasAtivasEm: (exploracaoId: string) => boolean;
  /** Levar ao ecrã da equipa desta exploração (convidar, remover). */
  onAbrirEquipa: (exploracaoId: string) => void;
  /** Levar ao registo de alterações, já filtrado por esta pessoa. */
  onVerAtividade: (userId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [indice, setIndice] = useState(0);
  /**
   * O rascunho por vínculo, com o `membroId` à frente.
   *
   * Uma pessoa pode andar em duas explorações com permissões diferentes; sem a
   * chave, mudar de exploração nos chips levava os interruptores da anterior
   * atrás e gravava-os na errada.
   */
  const [rascunhos, setRascunhos] = useState<Record<string, PermissoesMembro>>({});
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const vinculo: Vinculo | undefined = pessoa.vinculos[indice] ?? pessoa.vinculos[0];

  const rascunho = useMemo<PermissoesMembro>(
    () => (vinculo ? (rascunhos[vinculo.membroId] ?? vinculo.permissoes ?? {}) : {}),
    [rascunhos, vinculo],
  );

  const linhas = useMemo(
    () => (vinculo ? permissoesEfetivas(vinculo.role, rascunho) : []),
    [vinculo, rascunho],
  );

  // O que o servidor recusaria de qualquer forma não se mostra: com a gestão
  // económica desligada não há despesas nem receitas para ninguém, nem para o
  // dono (ver `schema_financas_opcional.sql`).
  const visiveis = useMemo(
    () =>
      linhas.filter(
        (l) =>
          !exigeFinancasAtivas(l.capacidade)
          || (vinculo ? financasAtivasEm(vinculo.exploracaoId) : false),
      ),
    [linhas, vinculo, financasAtivasEm],
  );

  const mexido = vinculo ? rascunhos[vinculo.membroId] !== undefined : false;
  const temAjustes = visiveis.some((l) => l.ajustada);

  function alternar(capacidade: Capacidade, valor: boolean) {
    if (!vinculo) return;
    setErro(null);
    setRascunhos((r) => {
      const atual = r[vinculo.membroId] ?? vinculo.permissoes ?? {};
      const seguinte = { ...atual };
      // Voltar ao que o papel dá TIRA o ajuste em vez de o gravar igual: assim,
      // no dia em que a regra do papel mudar, esta pessoa acompanha-a.
      if (rolePode(vinculo.role, capacidade) === valor) delete seguinte[capacidade];
      else seguinte[capacidade] = valor;
      return { ...r, [vinculo.membroId]: seguinte };
    });
  }

  function reporPapel() {
    if (!vinculo) return;
    setErro(null);
    setRascunhos((r) => ({ ...r, [vinculo.membroId]: {} }));
  }

  async function guardar() {
    if (!vinculo || aGuardar) return;
    setAGuardar(true);
    setErro(null);
    const razao = await onGuardar(vinculo.membroId, rascunho);
    setAGuardar(false);
    if (razao) {
      setErro(razao);
      return;
    }
    onFechar();
  }

  return (
    <Modal visible={aberto} animationType="slide" transparent onRequestClose={onFechar}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onFechar} accessibilityLabel={t('comum.fechar')} />
        <View
          style={[
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              paddingTop: spacing.md,
              maxHeight: '90%',
            },
            shadow.lg,
          ]}>
          {/* Cabeçalho: de quem estamos a falar */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.sm,
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="h3" numberOfLines={1}>
                {pessoa.nome}
              </Text>
              <Text variant="secondary" color={colors.textSecondary}>
                O que pode alterar {vinculo ? `em ${vinculo.nomeExploracao}` : ''}
              </Text>
            </View>
            <Pressable
              onPress={onFechar}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('comum.fechar')}>
              <Icon name="close" size="lg" color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            {/* Em que exploração — só se a pessoa entrar em mais do que uma */}
            {pessoa.vinculos.length > 1 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.xs,
                  marginBottom: spacing.md,
                }}>
                {pessoa.vinculos.map((v, i) => (
                  <Chip
                    key={v.membroId}
                    label={v.nomeExploracao}
                    icon="barn"
                    selected={i === indice}
                    onPress={() => {
                      setIndice(i);
                      setErro(null);
                    }}
                  />
                ))}
              </View>
            ) : null}

            {!vinculo ? (
              <Card>
                <Text variant="body" color={colors.textSecondary}>
                  Esta pessoa já não está ligada a nenhuma das suas explorações.
                </Text>
              </Card>
            ) : vinculo.role === 'admin' ? (
              <Card>
                <Text variant="bodyStrong">Dono da exploração</Text>
                <Text variant="secondary" color={colors.textSecondary}>
                  Quem é dono pode tudo, e isso não se ajusta: sem isto, uma exploração podia
                  ficar sem ninguém que lhe consiga mexer.
                </Text>
              </Card>
            ) : (
              <>
                <ResumoPapel role={vinculo.role} />

                {/* Quanto tempo esta pessoa ainda cá está. Fica ANTES dos
                    interruptores de propósito: com o acesso terminado, o que
                    ela pode alterar é uma pergunta sem consequência nenhuma —
                    o servidor recusa-lhe tudo na mesma. */}
                <SeccaoPrazo
                  vinculo={vinculo}
                  nome={pessoa.nome}
                  onMudarPrazo={onMudarPrazo}
                  onMarcarFim={onMarcarFim}
                  onErro={setErro}
                />

                {visiveis.map((l) => (
                  <LinhaCapacidade
                    key={l.capacidade}
                    capacidade={l.capacidade}
                    valor={l.pode}
                    ajustada={l.ajustada}
                    onMudar={(v) => alternar(l.capacidade, v)}
                  />
                ))}

                {temAjustes ? (
                  <Button
                    label={t('permissoes.reporPapel')}
                    icon="restore"
                    variant="secondary"
                    onPress={reporPapel}
                    style={{ marginTop: spacing.sm }}
                  />
                ) : null}

                {/* O que esta pessoa já alterou. Fica ao pé do que ela PODE
                    alterar de propósito: são as duas metades da mesma decisão —
                    ver o que fez é o que diz se as permissões estão certas. */}
                <Pressable
                  onPress={() => onVerAtividade(pessoa.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver o que ${pessoa.nome} alterou`}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: spacing.md,
                    },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="history" size="sm" color={colors.primary} />
                  <Text variant="secondary" color={colors.primary} style={{ flex: 1 }}>
                    Ver o que {pessoa.nome} alterou
                  </Text>
                  <Icon name="chevron-right" size="sm" color={colors.primary} />
                </Pressable>

                <Pressable
                  onPress={() => onAbrirEquipa(vinculo.exploracaoId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir a equipa de ${vinculo.nomeExploracao}`}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.xs,
                      marginTop: spacing.md,
                    },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Icon name="account-multiple" size="sm" color={colors.primary} />
                  <Text variant="secondary" color={colors.primary} style={{ flex: 1 }}>
                    Remover da equipa de {vinculo.nomeExploracao}
                  </Text>
                  <Icon name="chevron-right" size="sm" color={colors.primary} />
                </Pressable>
              </>
            )}

            {erro ? (
              <Card style={{ backgroundColor: colors.dangerTint, marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Icon name="alert-circle-outline" size="md" color={colors.danger} />
                  <Text variant="secondary" color={colors.danger} style={{ flex: 1 }}>
                    {erro}
                  </Text>
                </View>
              </Card>
            ) : null}
          </ScrollView>

          {vinculo && vinculo.role !== 'admin' ? (
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                paddingBottom: insets.bottom + spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
              }}>
              <Button
                label={mexido ? 'Guardar permissões' : 'Fechar'}
                icon={mexido ? 'check' : 'close'}
                onPress={mexido ? guardar : onFechar}
                loading={aGuardar}
                disabled={aGuardar}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Até quando esta pessoa tem acesso — e os botões que o mudam.
 * ------------------------------------------------------------------
 * Isto vivia só no ecrã da equipa de cada exploração. Para dar mais duas horas
 * ao veterinário que ainda estava na manga do curral era preciso: abrir a aba
 * Trabalhadores, ver que ele estava lá, tocar-lhe, ler que o acesso acabava às
 * 18h, fechar a folha, seguir a ligação para a equipa, encontrá-lo outra vez na
 * lista e só então carregar num chip. O sítio onde se lê o prazo passa a ser o
 * sítio onde se lhe mexe.
 *
 * Quem manda continua a ser o servidor (`definir_prazo_de_acesso` e
 * `definir_fim_de_acesso`, ambos a confirmar que quem pede é o dono).
 */
function SeccaoPrazo({
  vinculo,
  nome,
  onMudarPrazo,
  onMarcarFim,
  onErro,
}: {
  vinculo: Vinculo;
  /** De quem é o prazo — vai na pergunta de confirmação. */
  nome: string;
  onMudarPrazo: (membroId: string, horas: number | null) => Promise<string | null>;
  onMarcarFim: (membroId: string, fimIso: string) => Promise<string | null>;
  onErro: (razao: string | null) => void;
}) {
  const [aMarcar, setAMarcar] = useState(false);
  const [dia, setDia] = useState(() => formatDataCurta(new Date().toISOString()));
  const [hora, setHora] = useState(HORA_OMISSAO);
  const [ocupado, setOcupado] = useState(false);

  const terminou = acessoTerminou(vinculo.expiraEm);
  const fimEscolhido = combinarDataHora(parseDataPt(dia, { permitirFuturo: true }), hora);
  const problema = problemaComFim(parseDataPt(dia, { permitirFuturo: true }), hora);

  async function correr(acao: () => Promise<string | null>) {
    if (ocupado) return;
    setOcupado(true);
    onErro(null);
    const razao = await acao();
    setOcupado(false);
    if (razao) onErro(razao);
    else setAMarcar(false);
  }

  /**
   * Mexer no relógio de alguém pergunta primeiro.
   *
   * Todos estes controlos são chips do mesmo tamanho, encostados uns aos
   * outros: "+4 horas" e "Terminar já" ficam a dois centímetros um do outro, e
   * o segundo fecha a app na cara de quem está a trabalhar. A pergunta diz
   * SEMPRE a hora a que o acesso passa a acabar — e avisa quando as horas
   * escolhidas o encurtam, que é o engano que ninguém apanhava (ver
   * `perguntaDePrazo`).
   */
  function pedirEMudar(horas: number | null) {
    if (ocupado) return;
    const p = perguntaDePrazo(horas, { nome, expiraEm: vinculo.expiraEm }, formatDataHora);
    confirmar(
      p.titulo,
      p.mensagem,
      () => void correr(() => onMudarPrazo(vinculo.membroId, horas)),
      { rotuloConfirmar: p.rotuloConfirmar, destrutivo: p.destrutivo },
    );
  }

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon
          name={terminou ? 'clock-alert-outline' : vinculo.expiraEm ? 'clock-outline' : 'infinity'}
          size="md"
          color={terminou ? colors.danger : vinculo.expiraEm ? colors.warning : colors.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Tempo de acesso</Text>
          <Text
            variant="secondary"
            color={terminou ? colors.danger : colors.textSecondary}>
            {rotuloPrazo(vinculo.expiraEm, formatDataHora)}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.sm,
        }}>
        {/* Quatro durações e não as seis: as compridas ("1 mês") pertencem ao
            convite, onde se decide o género de acesso. Aqui a pergunta é outra
            — "ele ainda está cá, quanto lhe dou a mais?" */}
        {/* Sem o "+": o servidor NÃO soma — marca este tempo a contar de agora
            (ver `perguntaDePrazo`). Um "+4 horas" a quem tem 8 pela frente
            deixava-o com 4, e o sinal de mais dizia o contrário do que
            acontecia. */}
        {DURACOES_ACESSO.slice(0, 4).map((d) => (
          <Chip
            key={d.horas}
            label={terminou ? `Reabrir ${d.label}` : d.label}
            onPress={() => pedirEMudar(d.horas)}
          />
        ))}
        <Chip
          label={t('acesso.ateDiaEHora')}
          icon="calendar-clock"
          selected={aMarcar}
          onPress={() => {
            onErro(null);
            setAMarcar((v) => !v);
          }}
        />
        {/* "Terminar já" e "Tirar o prazo" são o contrário uma da outra e são
            fáceis de trocar — daí os rótulos dizerem o que acontece e não o que
            se mexe. A primeira fecha a porta agora; a segunda deixa-a aberta
            para sempre.

            "Terminar já" aparece a QUALQUER pessoa que não seja dona, tenha ela
            prazo ou não. Enquanto só aparecia a quem já tinha um, o veterinário
            convidado sem prazo — que é o que acontece quando se escolhe "sem
            prazo" no convite — não se conseguia cortar de todo: era preciso
            removê-lo da equipa, o que apaga o vínculo e a folha de permissões
            dele com ele. Fechar a porta e apagar a fechadura não são a mesma
            coisa. */}
        {!terminou ? (
          <Chip label={t('acesso.terminarJa')} icon="clock-remove-outline" onPress={() => pedirEMudar(0)} />
        ) : null}
        {vinculo.expiraEm ? (
          <Chip label={t('acesso.tirarPrazo')} icon="infinity" onPress={() => pedirEMudar(null)} />
        ) : null}
      </View>

      {aMarcar ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          <CampoData
            value={dia}
            onChangeText={setDia}
            placeholder={t('agenda.exDia')}
            permitirFuturo
            rotuloCalendario="Dia em que o acesso termina"
          />
          <CampoHora value={hora} onChangeText={setHora} rotuloRelogio="Hora a que o acesso termina" />
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            {HORAS_SUGERIDAS.map((h) => (
              <Chip key={h} label={h} selected={hora === h} onPress={() => setHora(h)} />
            ))}
          </View>
          {/* O que ficou escolhido, por extenso: reler os dígitos que se acabou
              de escrever é ler o mesmo engano duas vezes. */}
          <Text variant="secondary" color={problema ? colors.danger : colors.primaryDark}>
            {problema ?? `Termina a ${formatDataHora(fimEscolhido as string)}.`}
          </Text>
          <Button
            label={t('acesso.marcarEstaHora')}
            icon="calendar-clock"
            variant="secondary"
            disabled={!!problema || ocupado}
            onPress={() => {
              if (problema || !fimEscolhido) {
                onErro(problema);
                return;
              }
              void correr(() => onMarcarFim(vinculo.membroId, fimEscolhido));
            }}
          />
        </View>
      ) : null}
    </Card>
  );
}

/** Uma linha: o nome da capacidade, o que muda, e o interruptor. */
function LinhaCapacidade({
  capacidade,
  valor,
  ajustada,
  onMudar,
}: {
  capacidade: Capacidade;
  valor: boolean;
  /** Diferente do que o papel dá — marcado, para se ver o que foi mexido. */
  ajustada: boolean;
  onMudar: (v: boolean) => void;
}) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radii.pill,
            backgroundColor: valor ? colors.successTint : colors.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={ICONE_CAPACIDADE[capacidade]}
            size="md"
            color={valor ? colors.success : colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text variant="bodyStrong" style={{ flexShrink: 1 }}>
              {legendaCapacidade(capacidade)}
            </Text>
            {ajustada ? (
              <Text variant="caption" color={colors.warning}>
                ALTERADO
              </Text>
            ) : null}
          </View>
          <Text variant="secondary" color={colors.textSecondary}>
            {explicacaoCapacidade(capacidade)}
          </Text>
        </View>
        <Switch
          value={valor}
          onValueChange={onMudar}
          accessibilityLabel={legendaCapacidade(capacidade)}
          trackColor={{ false: colors.borderStrong, true: colors.success }}
          thumbColor={colors.white}
        />
      </View>
    </Card>
  );
}

/**
 * Uma linha a dizer de onde vêm os valores de partida.
 *
 * A diferença entre os dois papéis não é óbvia para quem convida — e é a
 * pergunta que se faz aqui, com os interruptores à frente.
 */
function ResumoPapel({ role }: { role: RoleMembro }) {
  return (
    <Card style={{ marginBottom: spacing.md, backgroundColor: colors.primaryTint }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Icon
          name={role === 'veterinario' ? 'medical-bag' : 'account-hard-hat'}
          size="md"
          color={colors.primaryDark}
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={colors.primaryDark}>
            {legendaRole(role)}
          </Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {role === 'veterinario'
              ? 'De início trata dos animais: fichas, vacinas, medicamentos e certificar uma morte. Não mexe em terrenos nem nas contas.'
              : 'De início faz o maneio todo: animais, terrenos, saídas e as despesas que traz do armazém. Não mexe nas receitas nem na equipa.'}
          </Text>
        </View>
      </View>
    </Card>
  );
}
