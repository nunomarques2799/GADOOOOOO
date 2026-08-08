import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
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
import { StatCard } from '@/components/StatCard';
import { Avatar, Badge, Card, Icon, SectionHeader, Text } from '@/components/ui';
import { useAgenda } from '@/data/useAgenda';
import { agruparPorDia } from '@/data/calendario';
import { resumoFinanceiro } from '@/data/financas';
import { dataExtensa, formatEuro, saudacao } from '@/data/helpers';
import { saiuDoEfetivo } from '@/data/historicoAnimais';
import { useMembros } from '@/data/membros';
import { useGado } from '@/data/store';
import { useFinancas } from '@/data/useFinancas';
import { t } from '@/i18n';
import { useAtualizarPuxando } from '@/hooks/useAtualizarPuxando';
import { useDesktop } from '@/hooks/useDesktop';
import { colors, layout, radii, spacing } from '@/theme';
import { temaEscuro } from '@/theme/preferencia';

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const desktop = useDesktop();
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
  const iniciais = utilizador.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  const urgentes = alertas.filter((a) => a.gravidade === 'urgente').length;

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
        onAction={podeMarcarEventos ? () => router.push('/agenda/novo') : undefined}
      />
      <CalendarioAgenda
        eventosPorDia={eventosPorDia}
        alertas={alertas}
        onAbrirDia={setDiaAberto}
      />
    </>
  ) : null;

  const secaoAlertas = (
    <>
      <SectionHeader
        title={t('inicio.atencao')}
        actionLabel={t('comum.verTodos')}
        onAction={() => router.push('/alertas')}
      />
      {alertas.length === 0 ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="check-circle" size="lg" color={colors.success} />
            <Text variant="body" style={{ flex: 1 }}>
              {t('inicio.tudoEmDia')}
            </Text>
          </View>
        </Card>
      ) : (
        <Card padded={false}>
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
            {urgentes > 0 ? (
              <Badge
                tone="danger"
                icon="alert"
                label={t('inicio.urgentes', { n: urgentes })}
                style={{ marginVertical: spacing.xs }}
              />
            ) : null}
            {alertas.slice(0, 3).map((a, i) => (
              <AlertItem key={a.id} alerta={a} divider={i < Math.min(alertas.length, 3) - 1} />
            ))}
          </View>
        </Card>
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
      {/* O cabeçalho verde é escuro (ícones claros); na Noite é verde claro
          (ícones escuros). */}
      <StatusBar style={temaEscuro() ? 'dark' : 'light'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={controloAtualizar}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
        {/* Cabeçalho verde */}
        <LinearGradient
          colors={[colors.headerFrom, colors.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + (desktop ? spacing.xl : spacing.md),
            // No telemóvel o conteúdo sobe um pouco por cima do cabeçalho, para
            // o primeiro cartão ficar encostado à aba verde. SÓ UM POUCO: com a
            // folga antiga (40px de subida contra 60px de folga em baixo), o
            // primeiro elemento do conteúdo entrava 16px dentro do verde. Quando
            // esse elemento era um cartão não se dava por nada — ele traz o seu
            // próprio fundo. Mas quando é um TÍTULO de secção, que é texto solto
            // e escuro, ficava metade da linha em cima do verde e metade fora: é
            // o que se via no "O que aí vem" e no "Marcar" do calendário.
            paddingBottom: desktop ? spacing.xl : spacing.xl,
            paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
            // Em desktop encosta à barra lateral — cantos redondos aqui
            // abririam uma fresta de fundo entre as duas.
            borderBottomLeftRadius: desktop ? 0 : radii.xl,
            borderBottomRightRadius: desktop ? 0 : radii.xl,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              maxWidth: desktop ? layout.conteudoDesktop - spacing.xxl * 2 : undefined,
              alignSelf: 'center',
            }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyLg" color={colors.textOnDarkMuted}>
                {saudacao()},
              </Text>
              <Text variant="display" color={colors.textOnDark} numberOfLines={1}>
                {primeiroNome}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="calendar-blank" size={14} color={colors.textOnDarkMuted} />
                <Text variant="secondary" color={colors.textOnDarkMuted}>
                  {dataExtensa()}
                </Text>
              </View>
            </View>
            <Avatar
              initials={iniciais}
              size={54}
              background="rgba(255,255,255,0.18)"
              foreground={colors.textOnDark}
            />
          </View>
        </LinearGradient>

        {/* Conteúdo */}
        <View
          style={{
            width: '100%',
            maxWidth: desktop ? layout.conteudoDesktop : undefined,
            alignSelf: 'center',
            paddingHorizontal: desktop ? spacing.xxl : spacing.lg,
            // 12px de subida contra 24px de folga em baixo: um cartão encosta à
            // aba verde sem lhe entrar dentro, e um título de secção (que traz
            // ainda `marginTop: xl` por cima) nasce sempre abaixo do verde.
            marginTop: desktop ? spacing.lg : -spacing.sm,
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
              tudo em pilha, pela mesma ordem. */}
          {desktop ? (
            <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
              <View style={{ flex: 3 }}>
                {secaoCalendario}
                {secaoAlertas}
                {secaoExploracoes}
              </View>
              <View style={{ flex: 2 }}>
                {secaoResumo}
                {secaoAcoes}
              </View>
            </View>
          ) : (
            <>
              {secaoCalendario}
              {secaoAlertas}
              {secaoExploracoes}
              {secaoResumo}
              {secaoAcoes}
            </>
          )}
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
