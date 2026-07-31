import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  CampoData,
  Chip,
  EcraComTeclado,
  EmptyState,
  Header,
  Icon,
  type IconName,
  Text,
} from '@/components/ui';
import { avisar } from '@/data/avisos';
import { especieMeta } from '@/data/constants';
import { SEM_TERRENO } from '@/data/filtrosAnimais';
import { useMembros } from '@/data/membros';
import {
  formatDataPt,
  isoDaysAgo,
  isoMaisDias,
  paraEuro,
  parseDataPt,
} from '@/data/helpers';
import { normalizar } from '@/data/racas';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useFinancas } from '@/data/useFinancas';
import type { Animal, EventoTipo, Sexo } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/* ------------------------------------------------------------------ *
 *  Tipos de evento cobertos por este formulário
 * ------------------------------------------------------------------ */

const REGISTAVEIS = ['Parto', 'Vacinação', 'Medicamento', 'Pesagem'] as const;
type Registavel = (typeof REGISTAVEIS)[number];

/**
 * O que se pode registar a vários animais de uma vez.
 *
 * Vacinar e medicar fazem-se a um lote inteiro no mesmo dia, com a mesma
 * vacina e o mesmo lote — obrigar a repetir o formulário trinta vezes é o
 * caminho mais curto para se deixar de registar de todo.
 *
 * Parto e pesagem ficam de fora porque o que se regista é diferente em cada
 * animal: um peso igual para trinta vacas não é um registo, é ruído que ainda
 * por cima estraga o cálculo do ganho médio diário.
 */
const EM_MASSA: Registavel[] = ['Vacinação', 'Medicamento'];

const META: Record<
  Registavel,
  { icon: IconName; cor: string; titulo: string; feito: string }
> = {
  Parto: {
    icon: 'baby-bottle-outline',
    cor: colors.info,
    titulo: 'Registar parto',
    feito: 'Parto registado',
  },
  Vacinação: {
    icon: 'needle',
    // Getter porque segue a paleta escolhida: esta tabela é criada no arranque
    // do módulo, antes de a paleta guardada estar aplicada.
    get cor() {
      return colors.primary;
    },
    titulo: 'Registar vacina',
    feito: 'Vacina registada',
  },
  Medicamento: {
    icon: 'medical-bag',
    cor: colors.danger,
    titulo: 'Registar medicamento',
    feito: 'Medicamento registado',
  },
  Pesagem: { icon: 'scale', cor: colors.warning, titulo: 'Registar pesagem', feito: 'Pesagem registada' },
};

const opcoesData = [
  { label: 'Hoje', dias: 0 },
  { label: 'Ontem', dias: 1 },
  { label: 'Há 2 dias', dias: 2 },
  { label: 'Há 1 semana', dias: 7 },
];

const VACINAS_COMUNS = ['Língua azul', 'Brucelose', 'Clostridioses', 'Carbúnculo'];
const VIAS = ['Injetável', 'Oral', 'Tópica', 'Intramamária'];
const PROXIMA_DOSE = ['3 meses', '6 meses', '12 meses'];
const SEGURANCA_DIAS = [0, 7, 10, 14, 28];

/** Converte "20,5" ou "20.5" num número; NaN se inválido. */
function paraNumero(txt: string): number {
  return parseFloat(txt.replace(',', '.'));
}

export default function NovoEventoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    animais,
    terrenos,
    especieDe,
    addAnimal,
    addEvento,
    updateAnimal,
    animalById,
    eventosByAnimal,
  } = useGadoAdaptado();
  const { podeEmAlguma } = useMembros();
  const toast = useToasts();

  const params = useLocalSearchParams<{ tipo?: string; animalId?: string }>();
  const tipoInicial: Registavel = (REGISTAVEIS as readonly string[]).includes(params.tipo ?? '')
    ? (params.tipo as Registavel)
    : 'Pesagem';

  const [tipo, setTipo] = useState<Registavel>(tipoInicial);
  const [animalIds, setAnimalIds] = useState<string[]>(params.animalId ? [params.animalId] : []);
  const [procura, setProcura] = useState('');
  /**
   * Em que terreno se está a olhar. `null` = ainda a escolher o terreno.
   *
   * Sem isto, escolher a vaca do parto era percorrer o efetivo inteiro numa
   * parede de cem etiquetas com nomes que se parecem. Quem trata de gado sabe
   * ONDE está o animal antes de saber como se chama — o terreno é o filtro que
   * ele tem na cabeça, e é por aí que a lista tem de começar.
   */
  const [terrenoAberto, setTerrenoAberto] = useState<string | null>(null);
  const [diasAtras, setDiasAtras] = useState(0);
  // Data escrita à mão. Os atalhos cobrem o registo do próprio dia, que é o
  // caso comum; isto cobre o resto — a vacina que se deu no mês passado e só
  // agora se está a lançar, ou o parto que aconteceu enquanto não havia rede.
  const [dataManual, setDataManual] = useState('');

  // Parto — um parto, uma cria. Nasceram duas? São dois registos, cada um com
  // o seu resultado e o seu sexo. O campo "número de crias" que aqui esteve
  // dava um registo só a dizer "2 crias" e nenhuma delas ficava a existir na
  // app; e no dia em que uma nasce viva e a outra morta, o registo era falso.
  const [tipoParto, setTipoParto] = useState<'Normal' | 'Distócico' | 'Cesariana'>('Normal');
  const [criaViva, setCriaViva] = useState(true);
  const [sexoCria, setSexoCria] = useState<Sexo | undefined>(undefined);

  // Vacinação
  const [vacina, setVacina] = useState('');
  const [lote, setLote] = useState('');
  const [proximaDose, setProximaDose] = useState<string | undefined>(undefined);
  const [vetVacina, setVetVacina] = useState('');

  // Medicamento
  const [medicamento, setMedicamento] = useState('');
  const [dose, setDose] = useState('');
  const [via, setVia] = useState<string | undefined>(undefined);
  const [motivo, setMotivo] = useState('');
  const [seguranca, setSeguranca] = useState(0);
  const [vetMed, setVetMed] = useState('');

  // Pesagem
  const [peso, setPeso] = useState('');

  // Custo (€) — vacinação e medicamento
  const [custo, setCusto] = useState('');

  // Comum
  const [notas, setNotas] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  // Uma data escrita à mão manda sobre os atalhos. `parseDataPt` recusa datas
  // futuras, que é o que se quer: um evento regista o que JÁ aconteceu.
  const dataManualIso = dataManual.trim() ? parseDataPt(dataManual) : null;
  const dataManualInvalida = dataManual.trim().length > 0 && !dataManualIso;
  const data = dataManualIso ?? isoDaysAgo(diasAtras);
  const varios = EM_MASSA.includes(tipo);
  // Um só animal escolhido é o caso normal — é o que dá o cartão com o nome e
  // o brinco, e o que permite calcular o ganho médio diário.
  const animal = animalIds.length === 1 ? animalById(animalIds[0]) : undefined;
  const { podeRegistarCustoTratamento: podeRegistarCusto } = useFinancas(
    (animal ?? (animalIds[0] ? animalById(animalIds[0]) : undefined))?.exploracaoId,
  );
  const podeRegistarEmAlguma = podeEmAlguma('registarTratamentos');

  // Lista para escolher o animal (só fêmeas quando é um parto).
  const animaisEscolha = useMemo(() => {
    const lista = tipo === 'Parto' ? animais.filter((a) => a.sexo === 'Fêmea') : animais;
    return [...lista].sort((a, b) =>
      (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(b.nome ?? b.numeroIdentificacao ?? ''),
    );
  }, [animais, tipo]);

  /**
   * Os animais arrumados pelo terreno onde andam.
   *
   * Os que não têm terreno atribuído vão para um grupo próprio, no fim: são
   * animais a sério e não podem desaparecer da escolha só por lhes faltar um
   * campo. Terrenos sem animais nenhuns não aparecem — seria um botão que abre
   * uma lista vazia.
   */
  const grupos = useMemo(() => {
    const nomes = new Map(terrenos.map((t) => [t.id, t.nome]));
    const porTerreno = new Map<string, Animal[]>();
    for (const a of animaisEscolha) {
      const chave = a.terrenoId && nomes.has(a.terrenoId) ? a.terrenoId : SEM_TERRENO;
      const lista = porTerreno.get(chave);
      if (lista) lista.push(a);
      else porTerreno.set(chave, [a]);
    }
    return [...porTerreno.entries()]
      .map(([id, lista]) => ({
        id,
        nome: id === SEM_TERRENO ? 'Sem terreno' : (nomes.get(id) ?? 'Terreno'),
        animais: lista,
      }))
      .sort((x, y) => {
        // "Sem terreno" fica sempre no fim: é o resto, não um sítio.
        if (x.id === SEM_TERRENO) return 1;
        if (y.id === SEM_TERRENO) return -1;
        return x.nome.localeCompare(y.nome, 'pt');
      });
  }, [animaisEscolha, terrenos]);

  /**
   * Que terreno está aberto de facto.
   *
   * Com um grupo só, o passo do terreno não decide nada — seria um toque a mais
   * para chegar exatamente à mesma lista — por isso abre-se sozinho.
   *
   * E um terreno que deixou de existir na lista volta ao passo da escolha: ao
   * trocar de "Pesagem" para "Parto" a lista passa a ser só de fêmeas, e um
   * cercado só de machos ficava aberto e vazio, sem nada por onde voltar atrás.
   */
  const aberto = terrenoAberto && grupos.some((g) => g.id === terrenoAberto)
    ? terrenoAberto
    : null;
  const grupoAberto = aberto ?? (grupos.length === 1 ? grupos[0].id : null);
  const terrenoEscolhido = grupos.find((g) => g.id === grupoAberto);

  /**
   * O que está à vista — e é sobre isto que age o "escolher todos".
   *
   * A procura passa POR CIMA dos terrenos: quem escreve o nome de um animal
   * quer aquele animal, não quer primeiro adivinhar em que terreno ele anda.
   */
  const aVista = useMemo(() => {
    const q = normalizar(procura.trim());
    if (q) {
      return animaisEscolha.filter((a) =>
        [a.nome, a.numeroIdentificacao, a.raca, a.numeroCasa].some(
          (c) => c && normalizar(c).includes(q),
        ),
      );
    }
    return terrenoEscolhido?.animais ?? [];
  }, [animaisEscolha, procura, terrenoEscolhido]);

  /**
   * Trocar para um tipo que não é de massa com vinte animais escolhidos não
   * pode gravar vinte partos. Fica o primeiro, que é o que o criador vê no
   * cartão — em vez de a app apagar a escolha toda sem dizer nada.
   */
  function mudarTipo(t: Registavel) {
    setTipo(t);
    if (!EM_MASSA.includes(t)) setAnimalIds((ids) => ids.slice(0, 1));
  }

  function alternarAnimal(id: string) {
    setAnimalIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return varios ? [...ids, id] : [id];
    });
  }

  /** Escolhidos que a procura atual não mostra — senão gravava-se às cegas. */
  const escondidos = animalIds.filter((id) => !aVista.some((a) => a.id === id)).length;

  const pesoNum = paraNumero(peso);
  const valido =
    animalIds.length > 0 &&
    !dataManualInvalida &&
    // O sexo da cria passou a ser obrigatório num parto de nado-vivo: é com ele
    // que a app cria o animal recém-nascido (ver `guardar`), e um animal sem
    // sexo não existe. Nado-morto não cria nada, e por isso não o pede.
    (tipo === 'Parto'
      ? !criaViva || sexoCria !== undefined
      : (tipo === 'Vacinação' && vacina.trim().length > 0) ||
        (tipo === 'Medicamento' && medicamento.trim().length > 0) ||
        (tipo === 'Pesagem' && Number.isFinite(pesoNum) && pesoNum > 0));

  /** Ganho médio diário desde a última pesagem registada, se existir. */
  function calcularGmd(kg: number): string | undefined {
    const animalId = animalIds[0];
    if (!animalId) return undefined;
    const ultima = eventosByAnimal(animalId).find((e) => e.tipo === 'Pesagem');
    if (!ultima) return undefined;
    const m = ultima.descricao.match(/([\d.,]+)\s*kg/i);
    if (!m) return undefined;
    const kgAnt = paraNumero(m[1]);
    if (!Number.isFinite(kgAnt)) return undefined;
    const dias = (new Date(data).getTime() - new Date(ultima.data).getTime()) / 86_400_000;
    if (dias < 1) return undefined;
    const gmd = (kg - kgAnt) / dias;
    return `GMD ${gmd.toFixed(2).replace('.', ',')} kg/dia`;
  }

  async function guardar() {
    if (animalIds.length === 0 || !valido || aGuardar) return;

    let descricao = '';
    const partes: string[] = [];

    if (tipo === 'Parto') {
      const rotulo =
        tipoParto === 'Normal' ? 'normal' : tipoParto === 'Distócico' ? 'distócico' : 'por cesariana';
      descricao = `Parto ${rotulo}`;
      if (sexoCria) partes.push(`cria ${sexoCria === 'Fêmea' ? 'fêmea' : 'macho'}`);
      partes.push(criaViva ? 'nado-vivo' : 'nado-morto');
    } else if (tipo === 'Vacinação') {
      descricao = `Vacina: ${vacina.trim()}`;
      if (lote.trim()) partes.push(`Lote ${lote.trim()}`);
      if (proximaDose) partes.push(`próxima em ${proximaDose}`);
      if (vetVacina.trim()) partes.push(`Vet. ${vetVacina.trim()}`);
    } else if (tipo === 'Medicamento') {
      descricao = `Medicamento: ${medicamento.trim()}`;
      if (dose.trim()) partes.push(`Dose ${dose.trim()}`);
      if (via) partes.push(via);
      if (motivo.trim()) partes.push(motivo.trim());
      if (vetMed.trim()) partes.push(`Vet. ${vetMed.trim()}`);
      if (seguranca > 0) partes.push(`segurança ${seguranca} dias`);
    } else {
      descricao = `Pesagem: ${peso.trim().replace('.', ',')} kg`;
      const gmd = calcularGmd(pesoNum);
      if (gmd) partes.push(gmd);
    }

    if (notas.trim()) partes.push(notas.trim());
    const detalhe = partes.join(' · ') || undefined;

    // Custo (€) — só faz sentido em vacinação/medicamento, e só se a gestão
    // económica estiver ligada (o servidor limpa-o na mesma, por trigger).
    let valor: number | undefined;
    if (podeRegistarCusto && (tipo === 'Vacinação' || tipo === 'Medicamento')) {
      const n = paraEuro(custo);
      if (Number.isFinite(n) && n > 0) valor = n;
    }

    // Esperar pela gravação antes de sair do ecrã. Sem o `await` e sem o
    // `catch`, uma recusa do servidor (RLS, conflito de versão) ficava numa
    // promessa sem dono: a app navegava para a ficha do animal como se tivesse
    // gravado, e o registo sanitário — uma vacina, um medicamento com intervalo
    // de segurança — desaparecia sem ninguém saber. Offline não muda nada: aí a
    // escrita entra na fila e isto devolve logo sem erro.
    setAGuardar(true);

    // Um a um, e não em paralelo: são escritas com fila de sincronização por
    // trás, e trinta pedidos ao mesmo tempo numa rede de campo dão trinta
    // hipóteses de falhar em vez de uma. Os que passam ficam gravados — um
    // erro a meio não desfaz o que já foi feito.
    const falhados: { nome: string; erro: string }[] = [];
    let gravados = 0;

    for (const id of animalIds) {
      try {
        await addEvento({ animalId: id, tipo, data, descricao, detalhe, valor });

        // Efeitos secundários no animal.
        // O intervalo de segurança conta a partir do dia do TRATAMENTO, não de
        // hoje. Enquanto a data só podia recuar uma semana o erro passava
        // despercebido; com a data exata, lançar hoje um medicamento dado há
        // três meses prendia o animal por mais 14 dias sem razão nenhuma — e o
        // erro simétrico, num tratamento antigo de intervalo curto, dava por
        // vencido um prazo que ainda corria.
        if (tipo === 'Medicamento' && seguranca > 0) {
          await updateAnimal(id, { fimIntervaloSeguranca: isoMaisDias(data, seguranca) });
        }
        if (tipo === 'Parto' && animalById(id)?.dataPrevistaParto) {
          await updateAnimal(id, { dataPrevistaParto: undefined });
        }
        gravados++;
      } catch (e) {
        const a = animalById(id);
        falhados.push({
          nome: a?.nome ?? a?.numeroIdentificacao ?? 'Sem nome',
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (gravados === 0) {
      toast.erro('Registo não guardado', falhados[0]?.erro ?? 'Tente novamente.');
      setAGuardar(false);
      return;
    }

    /**
     * Um parto de nado-vivo cria o animal recém-nascido.
     *
     * Sem isto, registar o parto e registar a cria eram duas tarefas separadas,
     * e a segunda esquecia-se: o vitelo existia no histórico da mãe e em mais
     * lado nenhum — sem prazo de identificação a contar, sem alerta de SNIRA,
     * fora do efetivo. Ora é exatamente o animal que a lei manda identificar em
     * 20 dias.
     *
     * Nasce com o mínimo: espécie e terreno da mãe, a data do parto, a mãe na
     * genealogia. Sem nome e sem brinco de propósito — não os há ainda —, o que
     * o faz aparecer na lista marcado como POR COMPLETAR (ver `AnimalRow`) e
     * gera o alerta de identificação. O nado-morto não cria nada: nunca entrou
     * no efetivo.
     */
    let cria: Animal | undefined;
    if (tipo === 'Parto' && criaViva && sexoCria) {
      const mae = animalById(animalIds[0]);
      if (mae) {
        try {
          cria = await addAnimal({
            exploracaoId: mae.exploracaoId,
            terrenoId: mae.terrenoId,
            maeId: mae.id,
            // O pai fica por saber: numa cobrição de manada não há forma de o
            // adivinhar, e escrever um palpite na genealogia é pior do que
            // deixar em branco. Acrescenta-se na ficha da cria, se se souber.
            especie: mae.especie,
            sexo: sexoCria,
            dataNascimento: data,
            estado: 'ativo',
          });
        } catch (e) {
          // O parto ficou gravado — isso é o que interessa e não se desfaz. O
          // que falhou foi a ficha da cria, e é preciso dizê-lo: em silêncio, o
          // criador contava com um animal que a app não tem.
          toast.erro('Parto guardado, cria por registar', mensagemDeErro(e));
        }
      }
    }

    if (falhados.length > 0) {
      // Nomear quem ficou de fora é o que permite repetir só esses. Um
      // "gravado com erros" sem dizer quais obrigava a conferir trinta fichas.
      //
      // Este continua a interromper, e não é um toast: é uma lista de nomes
      // para ir buscar, que não pode desaparecer sozinha ao fim de segundos.
      avisar(
        'Guardado, com falhas',
        `Ficou registado em ${gravados} ${gravados === 1 ? 'animal' : 'animais'}. ` +
          `Não foi possível em: ${falhados.map((f) => f.nome).join(', ')}.`,
      );
      if (animalIds.length === 1) router.replace(`/animal/${animalIds[0]}`);
      else router.back();
      return;
    }

    toast.sucesso(
      META[tipo].feito,
      cria
        ? `${descricao}. A cria já está na lista — falta pôr-lhe o brinco.`
        : gravados === 1
          ? `${descricao} · ${formatDataPt(data)}`
          : `${descricao} em ${gravados} animais, a ${formatDataPt(data)}`,
    );

    if (animalIds.length === 1) {
      router.replace(`/animal/${animalIds[0]}`);
      return;
    }
    router.back();
  }

  // Este ecrã nunca teve porteiro: até aqui, quem podia mexer em animais podia
  // registar, e eram a mesma permissão. Agora que `registarTratamentos` existe
  // sozinha, há quem a possa ter desligada — e o formulário deixava preencher
  // tudo para falhar contra a RLS no fim.
  //
  // `podeEmAlguma` e não `pode(exploracao)` porque ao abrir ainda não há animal
  // escolhido, e portanto não há exploração pela qual perguntar. Quem puder
  // registar nalguma entra; a gravação em si é filtrada pela RLS de cada uma.
  if (!podeRegistarEmAlguma) {
    return (
      <EcraComTeclado>
        <Header title={META[tipo].titulo} />
        <EmptyState
          icon="lock-outline"
          title="Sem permissão para registar"
          message="Quem gere esta exploração não lhe deu acesso a registar tratamentos. Fale com essa pessoa se acha que é engano."
        />
      </EcraComTeclado>
    );
  }

  return (
    <EcraComTeclado>
      <Header title={META[tipo].titulo} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        {/* Tipo de evento */}
        <Field label="Tipo de registo" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {REGISTAVEIS.map((t) => (
              <TipoButton
                key={t}
                label={t}
                icon={META[t].icon}
                cor={META[t].cor}
                selected={tipo === t}
                onPress={() => mudarTipo(t)}
              />
            ))}
          </View>
        </Field>

        {/* Animal(is) */}
        <Field
          label={
            tipo === 'Parto'
              ? 'Mãe (fêmea)'
              : varios
                ? `Animais${animalIds.length > 0 ? ` (${animalIds.length} escolhidos)` : ''}`
                : 'Animal'
          }
          obrigatorio>
          {/* Um só animal escolhido, num tipo individual: o cartão com o nome
              e o brinco confirma em quem se está a registar. */}
          {!varios && animal ? (
            <AnimalSelecionado
              icone={especieDe(animal.especie)}
              nome={animal.nome ?? 'Sem nome'}
              brinco={animal.numeroIdentificacao ?? 'Sem brinco'}
              onTrocar={() => setAnimalIds([])}
            />
          ) : (
            <>
              {/* Com efetivo grande, percorrer cem chips à procura de um animal
                  é pior do que escrever três letras do nome. E a procura passa
                  por cima dos terrenos: quem escreve o nome quer o animal, não
                  quer adivinhar primeiro onde ele anda. */}
              {animaisEscolha.length > 8 ? (
                <View style={{ marginBottom: spacing.sm }}>
                  <TextField
                    value={procura}
                    onChangeText={setProcura}
                    placeholder="Procurar por nome, brinco, raça ou número"
                    icon="magnify"
                  />
                </View>
              ) : null}

              {animaisEscolha.length === 0 ? (
                <Text variant="secondary" color={colors.textMuted}>
                  {tipo === 'Parto'
                    ? 'Não há fêmeas registadas para associar a um parto.'
                    : 'Ainda não há animais registados.'}
                </Text>
              ) : !procura.trim() && grupoAberto === null ? (
                /* Passo 1: em que terreno. */
                <View style={{ gap: spacing.xs }}>
                  <Text variant="secondary" color={colors.textSecondary}>
                    Escolha o terreno onde o animal anda.
                  </Text>
                  {grupos.map((g) => (
                    <LinhaTerreno
                      key={g.id}
                      nome={g.nome}
                      quantos={g.animais.length}
                      escolhidos={g.animais.filter((a) => animalIds.includes(a.id)).length}
                      semTerreno={g.id === SEM_TERRENO}
                      onPress={() => setTerrenoAberto(g.id)}
                    />
                  ))}
                </View>
              ) : (
                /* Passo 2: os animais desse terreno (ou o que a procura achou). */
                <>
                  {!procura.trim() && terrenoEscolhido ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        marginBottom: spacing.xs,
                      }}>
                      <Icon name="map-marker" size="md" color={colors.primary} />
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {terrenoEscolhido.nome}
                      </Text>
                      {/* Só com mais do que um terreno: com um só, o passo nem
                          chegou a existir e este botão não levava a lado nenhum. */}
                      {grupos.length > 1 ? (
                        <Button
                          label="Trocar de terreno"
                          icon="swap-horizontal"
                          variant="ghost"
                          fullWidth={false}
                          onPress={() => setTerrenoAberto(null)}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  {varios && aVista.length > 0 ? (
                    <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs }}>
                      {/* Age sobre o que está à VISTA — os animais deste
                          terreno, ou o que a procura deixou — e não sobre o
                          efetivo todo: é assim que se vacina um cercado
                          inteiro sem escolher animal a animal. */}
                      <Button
                        label={
                          procura.trim()
                            ? `Escolher os ${aVista.length} à vista`
                            : `Escolher os ${aVista.length} deste terreno`
                        }
                        icon="checkbox-multiple-marked-outline"
                        variant="secondary"
                        fullWidth={false}
                        onPress={() =>
                          setAnimalIds((ids) => [
                            ...new Set([...ids, ...aVista.map((a) => a.id)]),
                          ])
                        }
                      />
                      {animalIds.length > 0 ? (
                        <Button
                          label="Limpar"
                          icon="close"
                          variant="ghost"
                          fullWidth={false}
                          onPress={() => setAnimalIds([])}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {aVista.map((a) => (
                      <Chip
                        key={a.id}
                        label={a.nome ?? a.numeroIdentificacao ?? 'Sem nome'}
                        icon={animalIds.includes(a.id) ? 'check' : especieDe(a.especie)}
                        selected={animalIds.includes(a.id)}
                        onPress={() => alternarAnimal(a.id)}
                      />
                    ))}
                    {aVista.length === 0 ? (
                      <Text variant="secondary" color={colors.textMuted}>
                        {procura.trim()
                          ? `Nenhum animal corresponde a “${procura.trim()}”.`
                          : 'Não há animais neste terreno.'}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}

              {/* Os que estão escolhidos noutro terreno (ou que a procura
                  escondeu) continuam escolhidos — sem este aviso, gravava-se em
                  animais que já não estavam à vista sem se perceber porquê. */}
              {varios && escondidos > 0 ? (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  Mais {escondidos} {escondidos === 1 ? 'animal escolhido' : 'animais escolhidos'}{' '}
                  fora do que está à vista.
                </Text>
              ) : null}
            </>
          )}
        </Field>

        {/* Data */}
        <Field label="Data" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {opcoesData.map((o) => (
              <Chip
                key={o.dias}
                label={o.label}
                // Com uma data escrita à mão, nenhum atalho está escolhido —
                // senão o ecrã mostrava "Hoje" aceso por baixo de outra data.
                selected={!dataManualIso && diasAtras === o.dias}
                onPress={() => {
                  setDiasAtras(o.dias);
                  setDataManual('');
                }}
              />
            ))}
          </View>

          <Text
            variant="caption"
            color={colors.textMuted}
            style={{ marginTop: spacing.sm, marginBottom: 4 }}>
            Ou data exata (dd/mm/aaaa), para registar o que já aconteceu
          </Text>
          <CampoData
            value={dataManual}
            onChangeText={setDataManual}
            placeholder="Ex: 15/03/2026"
            rotuloCalendario="Escolher a data do registo no calendário"
          />
          {dataManualInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              Data inválida. Use o formato dd/mm/aaaa e uma data não futura.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
            <Icon name="calendar-check" size="sm" color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              {formatDataPt(data)}
            </Text>
          </View>
        </Field>

        {/* ---- Campos específicos ---- */}
        {tipo === 'Parto' ? (
          <>
            <Field label="Tipo de parto" obrigatorio>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {(['Normal', 'Distócico', 'Cesariana'] as const).map((t) => (
                  <Chip key={t} label={t} selected={tipoParto === t} onPress={() => setTipoParto(t)} />
                ))}
              </View>
            </Field>
            <Field label="Resultado" obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <BigToggle label="Nado-vivo" icon="heart-pulse" selected={criaViva} onPress={() => setCriaViva(true)} />
                <BigToggle label="Nado-morto" icon="heart-broken" selected={!criaViva} onPress={() => setCriaViva(false)} />
              </View>
            </Field>
            {criaViva ? (
              <Field label="Sexo da cria" obrigatorio>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <BigToggle label="Fêmea" icon="gender-female" selected={sexoCria === 'Fêmea'} onPress={() => setSexoCria('Fêmea')} />
                  <BigToggle label="Macho" icon="gender-male" selected={sexoCria === 'Macho'} onPress={() => setSexoCria('Macho')} />
                </View>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                  Guardamos a cria como animal novo, com este sexo, a data do
                  parto e a mãe já preenchidos.
                </Text>
              </Field>
            ) : null}
            <Aviso
              texto={
                criaViva
                  ? 'A cria fica registada sozinha, por completar: acrescente-lhe o brinco até aos 20 dias e comunique o nascimento ao SNIRA. Se nasceram duas crias, registe dois partos.'
                  : 'Um parto por cada cria: se nasceram duas, registe dois partos.'
              }
            />
          </>
        ) : null}

        {tipo === 'Vacinação' ? (
          <>
            <Field label="Vacina / doença" obrigatorio>
              <TextField value={vacina} onChangeText={setVacina} placeholder="Ex: Língua azul" icon="needle" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {VACINAS_COMUNS.map((v) => (
                  <Chip key={v} label={v} selected={vacina === v} onPress={() => setVacina(v)} />
                ))}
              </View>
            </Field>
            <Field label="Lote" opcional>
              <TextField value={lote} onChangeText={setLote} placeholder="Ex: 4471" icon="flask-outline" autoCapitalize="characters" />
            </Field>
            <Field label="Próxima dose" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {PROXIMA_DOSE.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={proximaDose === p}
                    onPress={() => setProximaDose(proximaDose === p ? undefined : p)}
                  />
                ))}
              </View>
            </Field>
            <Field label="Veterinário" opcional>
              <TextField value={vetVacina} onChangeText={setVetVacina} placeholder="Ex: Dr. Sousa" icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Medicamento' ? (
          <>
            <Field label="Medicamento" obrigatorio>
              <TextField value={medicamento} onChangeText={setMedicamento} placeholder="Ex: Antibiótico" icon="medical-bag" />
            </Field>
            <Field label="Dose" opcional>
              <TextField value={dose} onChangeText={setDose} placeholder="Ex: 20 ml" icon="cup-water" />
            </Field>
            <Field label="Via de administração" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {VIAS.map((v) => (
                  <Chip key={v} label={v} selected={via === v} onPress={() => setVia(via === v ? undefined : v)} />
                ))}
              </View>
            </Field>
            <Field label="Motivo" opcional>
              <TextField value={motivo} onChangeText={setMotivo} placeholder="Ex: Mastite" icon="clipboard-text-outline" />
            </Field>
            <Field label="Intervalo de segurança (dias)" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {SEGURANCA_DIAS.map((d) => (
                  <Chip
                    key={d}
                    label={d === 0 ? 'Nenhum' : `${d} dias`}
                    selected={seguranca === d}
                    onPress={() => setSeguranca(d)}
                  />
                ))}
              </View>
              {seguranca > 0 ? (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                  Não vender para abate até {formatDataPt(isoMaisDias(data, seguranca))}.
                </Text>
              ) : null}
            </Field>
            <Field label="Veterinário" opcional>
              <TextField value={vetMed} onChangeText={setVetMed} placeholder="Ex: Dr. Sousa" icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Pesagem' ? (
          <Field label="Peso (kg)" obrigatorio>
            <TextField value={peso} onChangeText={setPeso} placeholder="Ex: 520" icon="weight-kilogram" keyboardType="decimal-pad" />
          </Field>
        ) : null}

        {/* Custo — vacinação e medicamento (entra na gestão económica). Some
            com a gestão financeira desligada: o registo sanitário é o mesmo,
            só não se pede o dinheiro. É também a única coisa financeira que o
            veterinário preenche. */}
        {podeRegistarCusto && (tipo === 'Vacinação' || tipo === 'Medicamento') ? (
          <Field label={animalIds.length > 1 ? 'Custo por animal (€)' : 'Custo (€)'} opcional>
            <TextField value={custo} onChangeText={setCusto} placeholder="Ex: 45" icon="cash" keyboardType="decimal-pad" />
            {/* O valor é gravado em CADA animal. Mostrar a conta feita evita o
                engano de escrever aqui o total da fatura e ficar com trinta
                vezes esse total lançado na exploração. */}
            {animalIds.length > 1 && Number.isFinite(paraEuro(custo)) && paraEuro(custo) > 0 ? (
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                {animalIds.length} animais × {paraEuro(custo).toFixed(2).replace('.', ',')} € ={' '}
                {(paraEuro(custo) * animalIds.length).toFixed(2).replace('.', ',')} € no total.
              </Text>
            ) : null}
          </Field>
        ) : null}

        {/* Notas — comum a todos */}
        <Field label="Notas" opcional>
          <TextField value={notas} onChangeText={setNotas} placeholder="Observações (opcional)" icon="note-text-outline" multiline />
        </Field>
      </ScrollView>

      {/* Barra de gravar fixa */}
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
          },
          shadow.lg,
        ]}>
        <Button
          label={
            aGuardar
              ? 'A guardar…'
              : animalIds.length > 1
                ? `Guardar em ${animalIds.length} animais`
                : 'Guardar registo'
          }
          icon="check"
          onPress={guardar}
          disabled={!valido || aGuardar}
        />
      </View>
    </EcraComTeclado>
  );
}

/**
 * Pequeno adaptador sobre useGado: expõe um seletor de ícone por espécie
 * para não repetir o mapa especieMeta em vários pontos do ecrã.
 */
function useGadoAdaptado() {
  const gado = useGado();
  return {
    ...gado,
    especieDe: (especie: keyof typeof especieMeta): IconName => especieMeta[especie].icon,
  };
}

/* ------------------------------------------------------------------ *
 *  Escolha do animal por terreno
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 *  Componentes locais de formulário (partilham o estilo de animal/novo)
 * ------------------------------------------------------------------ */

function Field({
  label,
  obrigatorio,
  opcional,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
        <Text variant="label">{label}</Text>
        {obrigatorio ? (
          <Text variant="label" color={colors.danger}>
            *
          </Text>
        ) : null}
        {opcional ? (
          <Text variant="caption" color={colors.textMuted}>
            opcional
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function TextField({
  value,
  onChangeText,
  placeholder,
  icon,
  autoCapitalize,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: IconName;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: spacing.xs,
        minHeight: sizes.input,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: multiline ? spacing.sm : 0,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          flex: 1,
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 17,
          color: colors.text,
          paddingTop: multiline ? 4 : 0,
          minHeight: multiline ? 48 : undefined,
        }}
      />
    </View>
  );
}

/**
 * Um terreno na escolha do animal: o nome, quantos animais lá andam e quantos
 * já estão escolhidos.
 *
 * Linha inteira tocável e alta, como o resto das listas de escolha da app. O
 * número de escolhidos é o que permite vacinar dois cercados seguidos sem
 * perder a conta ao voltar atrás.
 */
function LinhaTerreno({
  nome,
  quantos,
  escolhidos,
  semTerreno,
  onPress,
}: {
  nome: string;
  quantos: number;
  escolhidos: number;
  semTerreno: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${nome}, ${quantos} ${quantos === 1 ? 'animal' : 'animais'}${
        escolhidos > 0 ? `, ${escolhidos} escolhidos` : ''
      }`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: sizes.touchMin,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: escolhidos > 0 ? colors.primary : colors.border,
          backgroundColor: escolhidos > 0 ? colors.primaryTint : colors.surface,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon
        name={semTerreno ? 'map-marker-off-outline' : 'map-marker'}
        size="md"
        color={escolhidos > 0 ? colors.primaryDark : colors.textSecondary}
      />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={escolhidos > 0 ? colors.primaryDark : colors.text}>
          {nome}
        </Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {quantos} {quantos === 1 ? 'animal' : 'animais'}
          {escolhidos > 0 ? ` · ${escolhidos} escolhido${escolhidos === 1 ? '' : 's'}` : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size="md" color={colors.textMuted} />
    </Pressable>
  );
}

/** Cartão grande de escolha do tipo de evento (ícone + rótulo). */
function TipoButton({
  label,
  icon,
  cor,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  cor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flexGrow: 1,
          flexBasis: '46%',
          minHeight: 64,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? cor : colors.border,
          backgroundColor: selected ? cor : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={icon} size="md" color={selected ? colors.onPrimary : cor} />
      <Text variant="button" color={selected ? colors.onPrimary : colors.textSecondary} style={{ fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Resumo do animal escolhido, com opção de trocar. */
function AnimalSelecionado({
  icone,
  nome,
  brinco,
  onTrocar,
}: {
  icone: IconName;
  nome: string;
  brinco: string;
  onTrocar: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: colors.primaryTint,
        padding: spacing.sm,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icone} size="md" color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{nome}</Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {brinco}
        </Text>
      </View>
      <Pressable onPress={onTrocar} accessibilityRole="button" accessibilityLabel="Trocar animal" hitSlop={8}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
          }}>
          <Icon name="swap-horizontal" size="sm" color={colors.primaryDark} />
          <Text variant="label" color={colors.primaryDark}>
            Trocar
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function BigToggle({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flex: 1,
          height: sizes.button,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryTint : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        pressed && { opacity: 0.85 },
      ]}>
      {icon ? <Icon name={icon} size="md" color={selected ? colors.primary : colors.textMuted} /> : null}
      <Text variant="button" color={selected ? colors.primaryDark : colors.textSecondary} style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Nota informativa (contexto legal / boas práticas). */
function Aviso({ texto }: { texto: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'flex-start',
        backgroundColor: colors.infoTint,
        borderRadius: radii.md,
        padding: spacing.sm,
        marginBottom: spacing.lg,
      }}>
      <Icon name="information" size="md" color={colors.info} />
      <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}
