import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Icon, type IconName, Text } from '@/components/ui';
import { useMembros } from '@/data/membros';
import { useNotificacoes } from '@/data/notificacoes';
import { suportaNotificacoes, temPermissao } from '@/data/notificacoesLocais';
import { useGado } from '@/data/store';
import {
  deveMostrar,
  esconderTutorial,
  essenciais,
  opcionais,
  passosTutorial,
  progresso,
  tutorialEscondido,
  type ChavePasso,
  type Passo,
} from '@/data/tutorial';
import { t } from '@/i18n';
import { colors, radii, spacing } from '@/theme';

/** Para onde leva cada passo, e com que ícone aparece. */
const PASSO_META: Record<ChavePasso, { icon: IconName; rota: Href }> = {
  exploracao: { icon: 'barn', rota: '/exploracao/nova' },
  terreno: { icon: 'grass', rota: '/terreno/novo' },
  animal: { icon: 'cow', rota: '/animal/novo' },
  avisos: { icon: 'bell-ring-outline', rota: '/conta/notificacoes' },
  financas: { icon: 'cash-multiple', rota: '/conta/financas' },
};

/**
 * O guia de primeiros passos, no topo do Início.
 * ------------------------------------------------------------------
 * Uma conta nova é uma sequência de ecrãs vazios; isto dá-lhe um fio. Mostra os
 * passos por ordem, marca sozinho os que já estão feitos (lidos dos dados — um
 * animal registado noutro aparelho conta na mesma) e aponta o próximo. Some
 * quando o caminho essencial está andado, ou quando o criador o esconde — e
 * volta pela Ajuda.
 *
 * Cada passo ABRE-SE: a linha diz o que é numa frase, e por baixo — no passo
 * que está a ser apontado, ou em qualquer um a que se toque — vem a explicação
 * por extenso e o botão que lá leva. Um guia que só dissesse "Registar os seus
 * terrenos" mandava adivinhar o que é um terreno para a app e para que serve
 * registá-lo; a explicação toda de uma vez, em seis passos seguidos, era um
 * muro de texto em cima do Início.
 *
 * A lógica de que passos existem e quais estão feitos é pura e testada
 * (`data/tutorial.ts`); aqui só se liga aos dados e à navegação.
 */
export function PainelPrimeirosPassos() {
  const router = useRouter();
  const { exploracoes, terrenos, animais } = useGado();
  const { preferencias } = useNotificacoes();
  const { podeEmAlguma } = useMembros();

  /**
   * A app tem autorização do sistema para avisar? `null` é "ainda não sei".
   *
   * A distinção não é zelo: perguntar ao sistema é assíncrono, e enquanto isto
   * era um `false` de partida o passo dos avisos nascia por fazer. Quem já
   * tinha a app configurada há meses via o guia dos primeiros passos aparecer
   * no topo do Início e desaparecer meio segundo depois, a cada arranque, sem
   * nunca ter chegado a tempo de o ler. Com `null`, o painel não decide nada
   * enquanto não souber.
   */
  const [permitido, setPermitido] = useState<boolean | null>(
    // Onde não há avisos (web, computador) não há nada por que esperar, e o
    // `passosTutorial` já trata o `suportaAvisos: false`.
    suportaNotificacoes ? null : false,
  );
  useEffect(() => {
    if (suportaNotificacoes) void temPermissao().then(setPermitido);
  }, []);

  // Esconder é uma decisão do momento — guardá-la em estado faz o painel sumir
  // sem recarregar a app.
  const [escondido, setEscondido] = useState(() => tutorialEscondido());

  /**
   * Qual dos passos está aberto.
   *
   * `null` é "o criador ainda não escolheu": aí abre-se sozinho o próximo por
   * fazer, que é a pergunta seguinte de quem está a começar. `'nenhum'` é ter
   * fechado esse — e é por isso que não chega um `ChavePasso | null`: sem o
   * terceiro estado, fechar o passo em foco voltava a `null` e ele reabria.
   */
  const [aberto, setAberto] = useState<ChavePasso | 'nenhum' | null>(null);

  // Enquanto não se souber da autorização, o painel não aparece. Um guia que
  // pisca é pior do que um guia que chega meio segundo depois.
  if (permitido === null) return null;

  const passos = passosTutorial({
    temExploracoes: exploracoes.length > 0,
    temTerrenos: terrenos.length > 0,
    temAnimais: animais.length > 0,
    avisosLigados: preferencias.noTelemovel && permitido,
    suportaAvisos: suportaNotificacoes,
    financasLigadas: exploracoes.some((e) => e.financasAtivas),
    // O mesmo critério do ecrã que liga os interruptores (ver `useFinancas`):
    // são do dono da exploração.
    podeConfigurar: podeEmAlguma('editarExploracao'),
  });

  if (!deveMostrar(passos, escondido)) return null;

  const { feitos, total } = progresso(passos);
  const caminho = essenciais(passos);
  const extras = opcionais(passos);
  // O próximo por fazer é o que leva a explicação aberta — um passo de cada
  // vez, para não pedir tudo ao mesmo tempo a quem está a começar.
  const proximo = caminho.find((p) => !p.feito);
  const emFoco = aberto === null ? proximo?.chave : aberto === 'nenhum' ? undefined : aberto;

  function esconder() {
    esconderTutorial();
    setEscondido(true);
  }

  function alternar(chave: ChavePasso) {
    setAberto(emFoco === chave ? 'nenhum' : chave);
  }

  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="flag-checkered" size="lg" color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{t('tutorial.titulo')}</Text>
          <Text variant="secondary" color={colors.textSecondary}>
            {t('tutorial.progresso', { n: feitos, total })}
          </Text>
        </View>
        <Pressable
          onPress={esconder}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('tutorial.esconderAjuda')}
          style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}>
          <Text variant="caption" color={colors.textMuted}>
            {t('tutorial.esconder')}
          </Text>
        </Pressable>
      </View>

      {/* Barra de progresso: proporção dos passos essenciais já feitos. */}
      <View
        style={{
          height: 8,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceSunken,
          marginTop: spacing.sm,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${(feitos / total) * 100}%`,
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.primary,
          }}
        />
      </View>

      <Text variant="secondary" color={colors.textSecondary} style={{ marginTop: spacing.sm }}>
        {t('tutorial.comoFunciona')}
      </Text>

      <View style={{ marginTop: spacing.sm }}>
        {caminho.map((p) => (
          <LinhaPasso
            key={p.chave}
            passo={p}
            destaque={!p.feito && p.chave === proximo?.chave}
            aberto={!p.feito && p.chave === emFoco}
            onAlternar={() => alternar(p.chave)}
            onIr={() => router.push(PASSO_META[p.chave].rota)}
          />
        ))}
      </View>

      {/* Os feitios à escolha. Ficam à parte e depois de tudo, com um título que
          diz que não são obrigatórios: quem não os quer não fica com a sensação
          de ter o guia por acabar (não contam para o progresso). */}
      {extras.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginBottom: spacing.sm,
            }}
          />
          <Text variant="label" color={colors.textSecondary}>
            {t('tutorial.opcionaisTitulo')}
          </Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
            {t('tutorial.opcionaisAjuda')}
          </Text>
          {extras.map((p) => (
            <LinhaPasso
              key={p.chave}
              passo={p}
              destaque={false}
              aberto={!p.feito && p.chave === emFoco}
              onAlternar={() => alternar(p.chave)}
              onIr={() => router.push(PASSO_META[p.chave].rota)}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function LinhaPasso({
  passo,
  destaque,
  aberto,
  onAlternar,
  onIr,
}: {
  passo: Passo;
  destaque: boolean;
  aberto: boolean;
  onAlternar: () => void;
  onIr: () => void;
}) {
  const meta = PASSO_META[passo.chave];

  return (
    <View
      style={{
        paddingHorizontal: destaque ? spacing.sm : 0,
        borderRadius: radii.md,
        backgroundColor: destaque ? colors.primaryTint : 'transparent',
      }}>
      <Pressable
        // Um passo já feito não abre nada — não há o que explicar a quem já o fez.
        onPress={passo.feito ? undefined : onAlternar}
        disabled={passo.feito}
        accessibilityRole="button"
        accessibilityState={{ disabled: passo.feito, expanded: aberto }}
        accessibilityLabel={`${passo.titulo}. ${passo.feito ? t('tutorial.feito') : passo.descricao}`}
        accessibilityHint={passo.feito ? undefined : t('tutorial.toqueParaSaber')}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
          },
          pressed && !passo.feito && { opacity: 0.7 },
        ]}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: passo.feito ? colors.successTint : colors.surfaceSunken,
          }}>
          <Icon
            name={passo.feito ? 'check' : meta.icon}
            size="md"
            color={passo.feito ? colors.success : colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            variant="bodyStrong"
            color={passo.feito ? colors.textMuted : colors.text}
            style={passo.feito ? { textDecorationLine: 'line-through' } : undefined}>
            {passo.titulo}
          </Text>
          {!passo.feito ? (
            <Text variant="secondary" color={colors.textSecondary}>
              {passo.descricao}
            </Text>
          ) : null}
        </View>
        {!passo.feito ? (
          <Icon name={aberto ? 'chevron-up' : 'chevron-down'} size="md" color={colors.textMuted} />
        ) : null}
      </Pressable>

      {/* A explicação por extenso e a porta para lá ir. Só do passo aberto: é o
          que separa um guia de uma parede de texto. */}
      {aberto && !passo.feito ? (
        <View style={{ paddingBottom: spacing.sm, gap: spacing.sm }}>
          <Text variant="body" color={colors.textSecondary}>
            {passo.detalhe}
          </Text>
          <Button
            label={passo.acao}
            icon={meta.icon}
            variant={passo.opcional ? 'secondary' : 'primary'}
            onPress={onIr}
          />
        </View>
      ) : null}
    </View>
  );
}
