import { Redirect, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertItem } from '@/components/AlertItem';
import { BannerAtualizacao } from '@/components/BannerAtualizacao';
import { BannerNaoGravado } from '@/components/BannerNaoGravado';
import { BannerAcessoExpirado } from '@/components/BannerAcessoExpirado';
import { BannerSuspensao } from '@/components/BannerSuspensao';
import { CalendarioAgenda } from '@/components/CalendarioAgenda';
import { ModalDiaAgenda } from '@/components/ModalDiaAgenda';
import { PainelPrimeirosPassos } from '@/components/PainelPrimeirosPassos';
import { ExploracaoRow } from '@/components/ExploracaoRow';
import { GrelhaAcoesRapidas } from '@/components/AcoesRapidas';
import { Logotipo } from '@/components/Logotipo';
import { MenuConta, type Ancora } from '@/components/MenuConta';
import { StatCard } from '@/components/StatCard';
import { Avatar, Badge, Card, Colunas, Icon, SectionHeader, Text } from '@/components/ui';
import { useAgenda } from '@/data/useAgenda';
import { agruparPorDia } from '@/data/calendario';
import { resumoFinanceiro } from '@/data/financas';
import { dataExtensa, formatEuro, saudacao } from '@/data/helpers';
import { saiuDoEfetivo } from '@/data/historicoAnimais';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { supabaseConfigurado } from '@/data/supabase';
import { useFinancas } from '@/data/useFinancas';
import { useVoltarAoTopo } from '@/data/voltarAoTopo';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { useEstreito } from '@/hooks/useEstreito';
import { colors, layout, radii, spacing } from '@/theme';
import { temaEscuro } from '@/theme/preferencia';

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  // Tocar outra vez no Início, já estando nele, volta ao topo desta lista.
  const refTopo = useVoltarAoTopo('index');
  const router = useRouter();
  // O menu da conta, que abre por baixo da inicial (ver `MenuConta.tsx`).
  const inicial = useRef<View>(null);
  const [menuConta, setMenuConta] = useState<Ancora | null>(null);
  const desktop = useDesktop();
  const estreito = useEstreito();
  const { isSuperadmin, podeVer, podeEmAlguma, estadoPerfil, acessoExpirado } = useMembros();
  const { controlo: controloAtualizar } = useAtualizarPuxando();
  const {
    utilizador, exploracoes, terrenos, animais, eventos, movimentos, alertas, online,
    pendentesSinc,
  } = useGado();

  // O calendário. Como os restantes hooks, fica ACIMA do desvio do superadmin —
  // um `return` condicional pelo meio mudava a contagem de hooks entre renders
  // e derrubava a app com "Rendered fewer hooks than expected" (ver a nota do
  // `useFinancas` mais abaixo, que é o mesmo problema).
  const { porDia: eventosPorDia } = useAgenda();
  const temAgenda = podeVer(undefined, 'verAgenda');
  const podeMarcarEventos = podeEmAlguma('marcarEventos');
  /** O dia que o modal está a mostrar, ou `undefined` se está fechado. */
  const [diaAberto, setDiaAberto] = useState<string | undefined>(undefined);
  const alertasPorDia = useMemo(() => agruparPorDia(alertas), [alertas]);

  // Duas condições, uma só resposta (ver `useFinancas`): a gestão económica
  // tem de estar ligada na conta E esta pessoa tem de a poder consultar.
  // Mostrar a soma do que a RLS lhe deixou ver daria um número parecido com o
  // saldo da exploração, e completamente errado.
  //
  // ACIMA do desvio do superadmin de propósito: é um hook, e um hook não pode
  // ficar depois de um `return` condicional. O `isSuperadmin` chega da cache e
  // é corrigido pelo servidor logo a seguir; no render em que passasse de false
  // a true, o React contava menos hooks do que da vez anterior e derrubava a
  // app com "Rendered fewer hooks than expected".
  const { podeVerFinancas, podeRegistarDespesa } = useFinancas();

  // O saldo conta só as explorações cujas contas esta pessoa pode consultar —
  // o mesmo conjunto que o ecrã Finanças usa no "Todas". Somar tudo o que a app
  // carregou dava um número que junta dois negócios: os movimentos vêm já
  // filtrados por papel (a RLS), mas os eventos com custo não vêm, e quem é dono
  // de uma quinta e trabalhador de outra via as duas no mesmo saldo.
  const fin = useMemo(() => {
    const ids = exploracoes.filter((e) => podeVer(e.id, 'verFinancas')).map((e) => e.id);
    return resumoFinanceiro(eventos, movimentos, {
      filtro: { exploracaoIds: ids, animais },
    });
  }, [eventos, movimentos, exploracoes, animais, podeVer]);

  /**
   * O EFETIVO — os animais que ainda lá estão.
   *
   * `animais` traz também os que saíram (falecidos, vendidos, eliminados): eles
   * ficam guardados para a genealogia e para o Histórico do efetivo, e não são
   * o número que o criador conta quando olha para o campo. Somá-los aqui punha
   * "119 animais" no Início e "112 no efetivo" na lista para onde este cartão
   * leva — o mesmo rebanho com duas contas diferentes.
   */
  const efetivo = animais.filter((a) => !saiuDoEfetivo(a));

  // Superadmin não gere gado — vai direto para o painel de clientes.
  if (isSuperadmin) return <Redirect href="/(superadmin)/clientes" />;

  const temFinancas = podeVerFinancas && fin.movimentos.length > 0;
  const saldoPositivo = fin.saldo >= 0;

  const primeiroNome = utilizador.nome.split(' ')[0];
  // Uma letra só, em Fraunces, como no guia: duas iniciais num círculo de 52
  // ficavam em letra pequena, e é a primeira que se reconhece.
  const inicial1 = (utilizador.nome.trim()[0] ?? '?').toUpperCase();
  const urgentes = alertas.filter((a) => a.gravidade === 'urgente').length;
  // O nome no cabeçalho: a exploração, quando é uma; quantas, quando são mais.
  const nomeExploracao =
    exploracoes.length === 1
      ? exploracoes[0].nome
      : exploracoes.length > 1
        ? t('inicio.nExploracoes', { n: exploracoes.length })
        : 'Terrabovina';
  // "Tudo guardado" só quando é verdade no SERVIDOR: com ligação, sem nada na
  // fila. Sem Supabase (modo de demonstração) não há servidor a quem o dizer.
  const tudoGuardado = supabaseConfigurado && online && pendentesSinc === 0;

  // "EXPLORAÇÃO ⌄ / Monte da Azinheira", ao lado do logótipo ou, num ecrã
  // estreito, na linha de baixo (ver `estreito`).
  const seletorExploracao = (
    <Pressable
      onPress={() =>
        exploracoes.length === 1
          ? router.push(`/exploracao/${exploracoes[0].id}`)
          : router.push('/exploracoes')
      }
      accessibilityRole="button"
      accessibilityLabel={`${exploracoes.length > 1 ? t('inicio.exploracoes') : t('inicio.exploracao')}: ${nomeExploracao}`}
      hitSlop={6}
      style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed && { opacity: 0.6 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text variant="rotulo" color={colors.textSecondary} numberOfLines={1}>
          {exploracoes.length > 1 ? t('inicio.exploracoes') : t('inicio.exploracao')}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.textSecondary} />
      </View>
      <Text variant="h2" numberOfLines={estreito ? 2 : 1} style={{ fontSize: 22, lineHeight: 28 }}>
        {nomeExploracao}
      </Text>
    </Pressable>
  );

  /**
   * O calendário, em primeiro no Início.
   *
   * Vem antes dos avisos de propósito: a lista de avisos responde a "o que está
   * atrasado", e o calendário a "o que me espera" — que é a pergunta com que se
   * pega no telemóvel de manhã. Ao veterinário não aparece de todo (ver
   * `verAgenda` em `permissoes.ts`): a agenda diz quando é a feira e a que horas
   * se carrega o camião, que é o movimento da casa de outra pessoa.
   */
  const secaoCalendario = temAgenda ? (
    <>
      <SectionHeader
        title={t('inicio.calendario')}
        actionLabel={podeMarcarEventos ? t('inicio.marcar') : undefined}
        actionIcon="plus"
        onAction={podeMarcarEventos ? () => router.push('/agenda/novo') : undefined}
      />
      <CalendarioAgenda
        eventosPorDia={eventosPorDia}
        alertas={alertas}
        onAbrirDia={setDiaAberto}
      />
    </>
  ) : null;

  // Um cartão por aviso, como no guia, e a contagem dos urgentes à direita do
  // título, a terracota cheio: é o número que tem de se ver antes de ler.
  const secaoAlertas = (
    <>
      <SectionHeader
        title={t('inicio.atencao')}
        direita={
          urgentes > 0 ? <Badge tone="danger" cheia label={t('inicio.urgentes', { n: urgentes })} /> : undefined
        }
      />
      {alertas.length === 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="check-circle-outline" size="lg" color={colors.success} />
            <Text variant="body" style={{ flex: 1 }}>
              {t('inicio.tudoEmDia')}
            </Text>
          </View>
        </Card>
      ) : (
        <>
          {alertas.slice(0, 3).map((a) => (
            <Card key={a.id} padded={false} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginBottom: spacing.sm }}>
              <AlertItem alerta={a} />
            </Card>
          ))}
          <Pressable
            onPress={() => router.push('/alertas')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2, paddingVertical: spacing.xxs },
              pressed && { opacity: 0.6 },
            ]}>
            <Text variant="label" color={colors.primary}>
              {alertas.length > 3 ? `${t('comum.verTodos')} (${alertas.length})` : t('comum.verTodos')}
            </Text>
            <Icon name="chevron-right" size="sm" color={colors.primary} />
          </Pressable>
        </>
      )}
    </>
  );

  const secaoResumo = (
    <>
      <SectionHeader title={t('inicio.resumo')} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StatCard
          icon="cow"
          value={efetivo.length}
          label={t('nav.animais')}
          onPress={() => router.push('/animais')}
        />
        <StatCard
          icon="barn"
          value={exploracoes.length}
          label={t('nav.exploracoes')}
          tint={colors.caprino}
          onPress={() => router.push('/exploracoes')}
        />
        <StatCard icon="grass" value={terrenos.length} label={t('nav.terrenos')} tint={colors.success} />
      </View>
      {podeVerFinancas ? (
        <Card onPress={() => router.push('/financas')} style={{ marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon
              name="cash-multiple"
              size="lg"
              color={temFinancas ? (saldoPositivo ? colors.success : colors.danger) : colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t('nav.financas')}</Text>
              <Text variant="secondary" color={colors.textSecondary}>
                {temFinancas ? t('inicio.saldo') : t('inicio.registeContas')}
              </Text>
            </View>
            {temFinancas ? (
              <Text variant="h3" color={saldoPositivo ? colors.success : colors.danger}>
                {formatEuro(fin.saldo, 0)}
              </Text>
            ) : (
              <Icon name="chevron-right" size="md" color={colors.textMuted} />
            )}
          </View>
        </Card>
      ) : null}
    </>
  );

  const secaoExploracoes = (
    <>
      <SectionHeader
        title={t('inicio.minhasExploracoes')}
        actionLabel={t('comum.verTodas')}
        onAction={() => router.push('/exploracoes')}
      />
      {exploracoes.length === 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="barn" size="lg" color={colors.primary} />
            <Text variant="body" style={{ flex: 1 }}>
              {t('inicio.semExploracoes')}
            </Text>
          </View>
        </Card>
      ) : (
        exploracoes.slice(0, 3).map((e) => <ExploracaoRow key={e.id} exploracao={e} />)
      )}
    </>
  );

  // A lista vive em `components/AcoesRapidas.tsx`: é a mesma que a folha do
  // botão "+" da barra de baixo mostra, e duas cópias separavam-se no primeiro
  // dia em que uma delas mudasse.
  const secaoAcoes = (
    <>
      <SectionHeader title={t('inicio.acoesRapidas')} />
      <GrelhaAcoesRapidas />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* O cabeçalho é do fundo do ecrã: claro (ícones escuros), ou escuro na
          Noite (ícones claros). */}
      <StatusBar style={temaEscuro() ? 'light' : 'dark'} />
      <ScrollView
        ref={refTopo}
        showsVerticalScrollIndicator={false}
        refreshControl={controloAtualizar}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
        {/* Cabeçalho, no creme e sem a aba verde de antes (guia de estilo):
            o logótipo e a exploração à esquerda, o sino e a conta à direita,
            e por baixo a saudação em Fraunces. */}
        <View
          style={{
            width: '100%',
            maxWidth: desktop ? layout.conteudoDesktop : undefined,
            alignSelf: 'center',
            paddingTop: insets.top + (desktop ? spacing.xl : spacing.md),
            paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {/* No computador o logótipo já está na barra lateral. */}
            {desktop ? null : <Logotipo tamanho={52} />}
            {/* Num ecrã estreito (ou com a letra no máximo) a exploração passa
                para a linha de baixo: entre o logótipo, o sino e a conta só
                sobravam duas letras do nome. */}
            {estreito ? <View style={{ flex: 1 }} /> : seletorExploracao}
            {/* O sino leva aos avisos, com um ponto quando há urgentes: é o
                que se procura primeiro ao pegar no telemóvel de manhã. */}
            <Pressable
              onPress={() => router.push('/alertas')}
              accessibilityRole="button"
              accessibilityLabel={
                urgentes > 0 ? `${t('nav.alertas')}, ${t('inicio.urgentes', { n: urgentes })}` : t('nav.alertas')
              }
              hitSlop={6}
              style={({ pressed }) => [
                {
                  width: 52,
                  height: 52,
                  borderRadius: radii.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.7 },
              ]}>
              <Icon name="bell-outline" size={26} color={colors.text} />
              {urgentes > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 11,
                    right: 12,
                    width: 12,
                    height: 12,
                    borderRadius: radii.pill,
                    backgroundColor: colors.dangerVivo,
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                />
              ) : null}
            </Pressable>
            {/* A inicial abre o menu da conta: perfil, definições, ajuda e
                terminar sessão. É o sítio onde toda a gente procura isto. */}
            <View ref={inicial} collapsable={false}>
              <Pressable
                onPress={() =>
                  inicial.current?.measureInWindow((x, y, w, h) => setMenuConta({ x, y, w, h }))
                }
                accessibilityRole="button"
                accessibilityLabel={t('menuConta.abrir')}
                hitSlop={8}
                style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                <Avatar
                  initials={inicial1}
                  size={52}
                  background={colors.primary}
                  foreground={colors.onPrimary}
                />
              </Pressable>
            </View>
          </View>

          {estreito ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>{seletorExploracao}</View>
          ) : null}

          <Text variant="display" style={{ marginTop: estreito ? spacing.md : spacing.xl }}>
            {saudacao()}, {primeiroNome}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {tudoGuardado ? (
              <Icon name="check" size={18} color={colors.success} />
            ) : (
              <Icon name="calendar-blank-outline" size={16} color={colors.textSecondary} />
            )}
            <Text variant="body" color={colors.textSecondary} style={{ flexShrink: 1 }}>
              {dataExtensa()}
              {tudoGuardado ? ` · ${t('inicio.tudoGuardado')}` : ''}
            </Text>
          </View>
        </View>
        <MenuConta aberto={menuConta !== null} ancora={menuConta} onFechar={() => setMenuConta(null)} />

        {/* Conteúdo */}
        <View
          style={{
            width: '100%',
            maxWidth: desktop ? layout.conteudoDesktop : undefined,
            alignSelf: 'center',
            paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
            marginTop: spacing.sm,
          }}>
          {/* Conta suspensa — fica em primeiro, é o que explica tudo o resto */}
          <BannerSuspensao />

          {/* Acesso com prazo que acabou (o veterinário depois da visita).
              Logo a seguir à suspensão e pela mesma razão: sem isto, a app
              vazia não se explica. */}
          <BannerAcessoExpirado />

          {/* Aviso de nova versão — só na app desktop quando há atualização */}
          <BannerAtualizacao />

          {/* Alterações que o servidor recusou. Vem ANTES do estado da ligação:
              "sem rede" é uma condição passageira e o cartão abaixo explica-se
              sozinho; isto é trabalho perdido, e é o que exige uma decisão. */}
          <BannerNaoGravado />

          {/* Estado de sincronização — só aparece offline ou com pendentes */}
          {!online || pendentesSinc > 0 ? (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Icon
                  name={online ? 'cloud-sync-outline' : 'cloud-off-outline'}
                  size="lg"
                  color={online ? colors.info : colors.warning}
                />
                <Text variant="body" style={{ flex: 1 }}>
                  {online
                    ? t('inicio.aSincronizar', { n: pendentesSinc })
                    : pendentesSinc > 0
                      ? t('inicio.semLigacaoComPendentes', { n: pendentesSinc })
                      : t('inicio.semLigacao')}
                </Text>
              </View>
            </Card>
          ) : null}

          {/* Guia de primeiros passos — só para quem gere a própria conta (um
              trabalhador convidado entra numa operação já montada e não cria
              explorações). Some sozinho quando está tudo feito. */}
          {/* Não a quem o acesso expirou: o guia manda criar uma exploração, e
              quem veio cá como veterinário não veio para isso. O banner acima
              é que lhe diz o que fazer. */}
          {estadoPerfil === 'ativo' && !acessoExpirado ? <PainelPrimeirosPassos /> : null}

          {/* Em desktop há largura para duas colunas: à ESQUERDA o tempo — o
              calendário, os prazos a vencer e as explorações onde tudo isso
              acontece; à direita os números e os atalhos. No telemóvel segue
              tudo em pilha, pela mesma ordem. Com `Colunas`, a árvore é a
              mesma nos dois desenhos: o mês que se escolheu no calendário não
              volta ao de hoje por a janela mudar de largura. */}
          <Colunas
            proporcao={[3, 2]}
            esquerda={
              <>
                {secaoCalendario}
                {secaoAlertas}
                {secaoExploracoes}
              </>
            }
            direita={
              <>
                {secaoResumo}
                {secaoAcoes}
              </>
            }
          />
        </View>
      </ScrollView>

      {/* O dia que se tocou no calendário. Montado só quando está aberto: fora
          disso não há modal nenhum a guardar o dia de uma sessão anterior. */}
      {diaAberto ? (
        <ModalDiaAgenda
          aberto
          dia={diaAberto}
          eventos={eventosPorDia.get(diaAberto) ?? []}
          alertas={alertasPorDia.get(diaAberto) ?? []}
          podeMarcar={podeMarcarEventos}
          onFechar={() => setDiaAberto(undefined)}
          onMudarDia={setDiaAberto}
          onEditar={(e) => {
            setDiaAberto(undefined);
            router.push(`/agenda/editar/${e.id}`);
          }}
          onNovo={(dia) => {
            setDiaAberto(undefined);
            router.push({ pathname: '/agenda/novo', params: { dia } });
          }}
        />
      ) : null}
    </View>
  );
}
