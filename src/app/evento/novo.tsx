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
import { SeletorAnimais } from '@/components/SeletorAnimais';
import { avisar } from '@/data/avisos';
import { PrazosReproducao, resultadoMeta, resultadosDiagnostico } from '@/data/constants';
import { useMembros } from '@/data/membros';
import {
  formatDataPt,
  isoDaysAgo,
  isoMaisDias,
  paraEuro,
  parseDataPt,
} from '@/data/helpers';
import { formatQuantidade, lotesUtilizaveis, rotuloLote } from '@/data/medicamentos';
import { preverParto, sugestoesDeCobricao } from '@/data/reproducao';
import { useGado } from '@/data/store';
import { mensagemDeErro, useToasts } from '@/data/toasts';
import { useExistencias } from '@/data/useExistencias';
import { useFinancas } from '@/data/useFinancas';
import type { Animal, EventoTipo, ResultadoDiagnostico, Sexo } from '@/data/types';
import { t, type ChaveTexto } from '@/i18n';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/* ------------------------------------------------------------------ *
 *  Tipos de evento cobertos por este formulário
 * ------------------------------------------------------------------ */

const REGISTAVEIS = [
  'Parto',
  'Cobrição',
  'Diagnóstico',
  'Vacinação',
  'Medicamento',
  'Pesagem',
] as const;
type Registavel = (typeof REGISTAVEIS)[number];

/** Os que só se registam a fêmeas. */
const SO_FEMEAS: Registavel[] = ['Parto', 'Cobrição', 'Diagnóstico'];

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
 *
 * A COBRIÇÃO entra: numa manada com o touro à solta, o que se regista é "estas
 * vinte estiveram com o Marquês entre março e maio", e é o mesmo facto para
 * todas. O DIAGNÓSTICO não entra, apesar de o veterinário passar o rebanho todo
 * numa manhã: o que ele diz é diferente em cada vaca, e um "gestante" aplicado
 * a vinte cabeças de uma vez é a maneira mais rápida de pôr metade do efetivo a
 * contar dias para um parto que não vem.
 */
const EM_MASSA: Registavel[] = ['Vacinação', 'Medicamento', 'Cobrição'];

/** Os tipos que saem de um lote da arrecadação. */
const COM_LOTE: Registavel[] = ['Vacinação', 'Medicamento'];

/**
 * Ícone, cor e textos de cada tipo.
 *
 * O `titulo` e o `feito` são GETTERS pela mesma razão que a `cor`: esta tabela
 * é criada ao importar o módulo, antes de a paleta e o idioma guardados estarem
 * aplicados. Escritos como valores, ficavam com a cor de origem e a língua de
 * arranque para o resto da execução (ver AGENTS.md).
 */
const META: Record<
  Registavel,
  { icon: IconName; cor: string; titulo: string; feito: string }
> = {
  Parto: {
    icon: 'baby-bottle-outline',
    get cor() {
      return colors.info;
    },
    get titulo() {
      return t('evento.registarParto');
    },
    get feito() {
      return t('evento.partoRegistado');
    },
  },
  Cobrição: {
    icon: 'gender-male-female',
    get cor() {
      return colors.primaryDark;
    },
    get titulo() {
      return t('evento.registarCobricao');
    },
    get feito() {
      return t('evento.cobricaoRegistada');
    },
  },
  Diagnóstico: {
    icon: 'stethoscope',
    get cor() {
      return colors.info;
    },
    get titulo() {
      return t('evento.registarDiagnostico');
    },
    get feito() {
      return t('evento.diagnosticoRegistado');
    },
  },
  Vacinação: {
    icon: 'needle',
    get cor() {
      return colors.primary;
    },
    get titulo() {
      return t('evento.registarVacina');
    },
    get feito() {
      return t('evento.vacinaRegistada');
    },
  },
  Medicamento: {
    icon: 'medical-bag',
    get cor() {
      return colors.danger;
    },
    get titulo() {
      return t('evento.registarMedicamento');
    },
    get feito() {
      return t('evento.medicamentoRegistado');
    },
  },
  Pesagem: {
    icon: 'scale',
    get cor() {
      return colors.warning;
    },
    get titulo() {
      return t('evento.registarPesagem');
    },
    get feito() {
      return t('evento.pesagemRegistada');
    },
  },
};

/** Atalhos da data. Guardam a CHAVE, e quem desenha é que traduz. */
const opcoesData: { chave: ChaveTexto; dias: number }[] = [
  { chave: 'formAnimal.hoje', dias: 0 },
  { chave: 'formAnimal.ontem', dias: 1 },
  { chave: 'evento.ha2Dias', dias: 2 },
  { chave: 'formAnimal.ha1Semana', dias: 7 },
];

const VACINAS_COMUNS = ['Língua azul', 'Brucelose', 'Clostridioses', 'Carbúnculo'];
const VIAS = ['Injetável', 'Oral', 'Tópica', 'Intramamária'];
const PROXIMA_DOSE = ['3 meses', '6 meses', '12 meses'];
const SEGURANCA_DIAS = [0, 7, 10, 14, 28];

/** Como a fêmea foi coberta. Muda o que se pergunta a seguir e mais nada. */
const MODOS_COBRICAO = ['Touro', 'Inseminação artificial'] as const;
type ModoCobricao = (typeof MODOS_COBRICAO)[number];

/** Converte "20,5" ou "20.5" num número; NaN se inválido. */
function paraNumero(txt: string): number {
  return parseFloat(txt.replace(',', '.'));
}

export default function NovoEventoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    animais,
    eventos,
    medicamentos,
    terrenos,
    addAnimal,
    addEvento,
    updateAnimal,
    animalById,
    eventosByAnimal,
  } = useGado();
  const { podeEmAlguma } = useMembros();
  const toast = useToasts();

  const params = useLocalSearchParams<{ tipo?: string; animalId?: string }>();
  const tipoInicial: Registavel = (REGISTAVEIS as readonly string[]).includes(params.tipo ?? '')
    ? (params.tipo as Registavel)
    : 'Pesagem';

  const [tipo, setTipo] = useState<Registavel>(tipoInicial);
  const [animalIds, setAnimalIds] = useState<string[]>(params.animalId ? [params.animalId] : []);
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

  // Cobrição
  const [modoCobricao, setModoCobricao] = useState<ModoCobricao>('Touro');
  const [touro, setTouro] = useState('');

  // Diagnóstico
  const [resultado, setResultado] = useState<ResultadoDiagnostico | undefined>(undefined);
  const [vetDiag, setVetDiag] = useState('');

  // Vacinação
  const [vacina, setVacina] = useState('');
  const [lote, setLote] = useState('');
  const [proximaDose, setProximaDose] = useState<string | undefined>(undefined);
  const [vetVacina, setVetVacina] = useState('');

  // Lote da arrecadação (vacinação e medicamento)
  const [loteId, setLoteId] = useState<string | undefined>(undefined);
  const [quantidade, setQuantidade] = useState('');

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

  // Lista para escolher o animal (só fêmeas no que é reprodução).
  const animaisEscolha = useMemo(() => {
    const lista = SO_FEMEAS.includes(tipo) ? animais.filter((a) => a.sexo === 'Fêmea') : animais;
    return [...lista].sort((a, b) =>
      (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(b.nome ?? b.numeroIdentificacao ?? ''),
    );
  }, [animais, tipo]);

  /**
   * Os lotes que dá para usar hoje: desta exploração, do tipo certo, com stock
   * e dentro da validade (ver `lotesUtilizaveis`).
   *
   * A exploração vem do PRIMEIRO animal escolhido. Numa vacinação em massa a
   * app não impede escolher animais de duas explorações, e nesse caso o lote
   * oferecido é o da primeira — que é também a única de que ele pode sair, já
   * que um frasco está fisicamente numa arrecadação só.
   */
  const exploracaoEscolhida = animalById(animalIds[0] ?? '')?.exploracaoId;
  // Com o registo de medicamentos desligado nas Definições não há arrecadação
  // nenhuma para descontar: a lista fica vazia e o campo "Sai do stock" não
  // chega a aparecer (ver `useExistencias`). O registo sanitário do tratamento
  // não muda — o animal, a data, o produto e o intervalo de segurança ficam.
  const { ativas: existenciasAtivas } = useExistencias(exploracaoEscolhida);
  const lotesDisponiveis = useMemo(
    () =>
      COM_LOTE.includes(tipo) && existenciasAtivas
        ? lotesUtilizaveis(
            medicamentos,
            eventos,
            exploracaoEscolhida,
            tipo === 'Vacinação' ? 'Vacina' : 'Medicamento',
          )
        : [],
    [medicamentos, eventos, exploracaoEscolhida, tipo, existenciasAtivas],
  );
  const loteEscolhido = lotesDisponiveis.find((l) => l.medicamento.id === loteId);

  /**
   * Escolher um lote preenche o resto: o nome do produto e o intervalo de
   * segurança que vem na bula. É o que faz valer a pena ter a arrecadação
   * registada — sem isto, escolher o frasco era um campo a mais em vez de
   * trabalho a menos.
   *
   * O intervalo continua a poder ser corrigido à mão a seguir: o do lote é o
   * ponto de partida, não uma imposição.
   */
  function escolherLote(id: string | undefined) {
    setLoteId(id);
    if (!id) return;
    const l = lotesDisponiveis.find((x) => x.medicamento.id === id);
    if (!l) return;
    setSeguranca(l.medicamento.intervaloSegurancaDias);
    if (tipo === 'Vacinação' && !vacina.trim()) setVacina(l.medicamento.nome);
    if (tipo === 'Medicamento' && !medicamento.trim()) setMedicamento(l.medicamento.nome);
    if (l.medicamento.lote?.trim() && !lote.trim()) setLote(l.medicamento.lote.trim());
  }

  /**
   * A cobrição que este diagnóstico está a confirmar, para se poder mostrar a
   * data prevista do parto ANTES de gravar. Ver a mesma conta em
   * `reproducao.ts` — aqui é só para o criador poder conferir.
   */
  const cobricaoDoDiagnostico = useMemo(() => {
    if (tipo !== 'Diagnóstico' || animalIds.length !== 1) return undefined;
    return eventosByAnimal(animalIds[0]).find(
      (e) => e.tipo === 'Cobrição' && new Date(e.data).getTime() <= new Date(data).getTime(),
    );
  }, [tipo, animalIds, eventosByAnimal, data]);

  const partoPrevisto =
    resultado === 'gestante' && animal && cobricaoDoDiagnostico
      ? preverParto(animal.especie, cobricaoDoDiagnostico.data)
      : undefined;

  /**
   * Os touros (ou as palhetas) que se podem escolher sem escrever.
   *
   * A exploração é a do primeiro animal escolhido — a mesma regra do lote da
   * arrecadação, e pela mesma razão: é a que está à frente de quem regista. Sem
   * animal escolhido ainda, `exploracaoEscolhida` é `undefined` e a função
   * devolve os machos de todas, que é melhor do que uma lista vazia num
   * formulário onde a fêmea se escolhe depois.
   */
  const sugestoesTouro = useMemo(
    () =>
      tipo === 'Cobrição'
        ? sugestoesDeCobricao(
            animais,
            eventos,
            exploracaoEscolhida,
            modoCobricao === 'Touro' ? 'Touro' : 'Sémen',
          )
        : [],
    [tipo, animais, eventos, exploracaoEscolhida, modoCobricao],
  );

  /**
   * Trocar para um tipo que não é de massa com vinte animais escolhidos não
   * pode gravar vinte partos. Fica o primeiro, que é o que o criador vê no
   * cartão — em vez de a app apagar a escolha toda sem dizer nada.
   */
  function mudarTipo(t: Registavel) {
    setTipo(t);
    if (!EM_MASSA.includes(t)) setAnimalIds((ids) => ids.slice(0, 1));
    // Trocar de tipo larga o lote: um frasco de vacina não serve para registar
    // um antibiótico, e um lote escolhido que fica pendurado num tipo onde nem
    // aparece descontava stock de um sítio sem ninguém ver.
    if (!COM_LOTE.includes(t)) {
      setLoteId(undefined);
      setQuantidade('');
    }
    // O mesmo para os animais: um macho escolhido não pode ficar num formulário
    // de cobrição, que só oferece fêmeas.
    if (SO_FEMEAS.includes(t)) {
      setAnimalIds((ids) => ids.filter((id) => animalById(id)?.sexo === 'Fêmea'));
    }
  }

  const pesoNum = paraNumero(peso);
  const quantidadeNum = paraNumero(quantidade);
  // Escolhido um lote, a quantidade passa a ser obrigatória: sem ela o stock
  // não desce, e uma arrecadação que nunca desce é pior do que nenhuma — dá a
  // impressão de estar controlada.
  const quantidadeValida =
    !loteEscolhido || (Number.isFinite(quantidadeNum) && quantidadeNum > 0);

  const valido =
    animalIds.length > 0 &&
    !dataManualInvalida &&
    quantidadeValida &&
    // O sexo da cria passou a ser obrigatório num parto de nado-vivo: é com ele
    // que a app cria o animal recém-nascido (ver `guardar`), e um animal sem
    // sexo não existe. Nado-morto não cria nada, e por isso não o pede.
    (tipo === 'Parto'
      ? !criaViva || sexoCria !== undefined
      : // A cobrição não pede mais nada: a data e o animal são o registo, e o
        // touro é opcional porque numa manada muitas vezes não se sabe qual foi.
        tipo === 'Cobrição' ||
        (tipo === 'Diagnóstico' && resultado !== undefined) ||
        (tipo === 'Vacinação' && vacina.trim().length > 0) ||
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
    } else if (tipo === 'Cobrição') {
      descricao = modoCobricao === 'Touro' ? 'Cobrição por touro' : 'Inseminação artificial';
      if (touro.trim()) {
        partes.push(`${modoCobricao === 'Touro' ? 'Touro' : 'Sémen'}: ${touro.trim()}`);
      }
    } else if (tipo === 'Diagnóstico') {
      descricao = `Diagnóstico de gestação: ${resultadoMeta[resultado!].label.toLowerCase()}`;
      if (vetDiag.trim()) partes.push(`Vet. ${vetDiag.trim()}`);
      if (partoPrevisto) partes.push(`parto previsto ${formatDataPt(partoPrevisto)}`);
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

    if (loteEscolhido) {
      partes.push(
        `de ${rotuloLote(loteEscolhido.medicamento)} · ${formatQuantidade(quantidadeNum, loteEscolhido.medicamento.unidade)}`,
      );
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
        await addEvento({
          animalId: id,
          tipo,
          data,
          descricao,
          detalhe,
          valor,
          resultado: tipo === 'Diagnóstico' ? resultado : undefined,
          medicamentoId: loteEscolhido?.medicamento.id,
          // A quantidade só vai com o lote: sozinha não desconta nada de lado
          // nenhum e ficava um número solto no registo.
          quantidade: loteEscolhido ? quantidadeNum : undefined,
        });

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

        /**
         * O diagnóstico manda na data prevista do parto — é para isso que ele
         * serve. Gestante põe-na (contada a partir da cobrição que ele
         * confirmou); vazia e duvidoso TIRAM-NA.
         *
         * Tirá-la é tão importante como pô-la: sem isso, uma vaca dada como
         * vazia continuava a contar dias para um parto que não vem, a aparecer
         * no calendário e a gerar o aviso no telemóvel — e a app ficava a
         * contradizer, todos os dias, o diagnóstico que o veterinário lhe deu.
         */
        if (tipo === 'Diagnóstico') {
          const a = animalById(id);
          if (resultado === 'gestante') {
            const cobricao = eventosByAnimal(id).find(
              (e) => e.tipo === 'Cobrição' && new Date(e.data).getTime() <= new Date(data).getTime(),
            );
            if (a && cobricao) {
              await updateAnimal(id, { dataPrevistaParto: preverParto(a.especie, cobricao.data) });
            }
          } else if (a?.dataPrevistaParto) {
            await updateAnimal(id, { dataPrevistaParto: undefined });
          }
        }
        gravados++;
      } catch (e) {
        const a = animalById(id);
        falhados.push({
          nome: a?.nome ?? a?.numeroIdentificacao ?? t('animais.semNome'),
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (gravados === 0) {
      toast.erro(t('evento.naoGuardado'), falhados[0]?.erro ?? t('evento.tenteNovamente'));
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
          toast.erro(t('evento.criaPorRegistar'), mensagemDeErro(e));
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
        t('evento.guardadoComFalhas'),
        `${t('evento.ficouRegistadoEm', { n: gravados })} `
          + t('evento.naoFoiPossivelEm', { nomes: falhados.map((f) => f.nome).join(', ') }),
      );
      if (animalIds.length === 1) router.replace(`/animal/${animalIds[0]}`);
      else router.back();
      return;
    }

    toast.sucesso(
      META[tipo].feito,
      cria
        ? `${descricao}. A cria já está na lista: falta pôr-lhe o brinco.`
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
          title={t('evento.semPermissaoTitulo')}
          message={t('evento.semPermissaoMensagem')}
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
        <Field label={t('evento.tipoDeRegisto')} obrigatorio>
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
              ? t('evento.maeFemea')
              : varios
                ? `${SO_FEMEAS.includes(tipo) ? t('filtro.femeas') : t('nav.animais')}${animalIds.length > 0 ? ` (${t('evento.nEscolhidos', { n: animalIds.length })})` : ''}`
                : SO_FEMEAS.includes(tipo)
                  ? t('evento.femea')
                  : t('ficha.animal')
          }
          obrigatorio>
          <SeletorAnimais
            animais={animaisEscolha}
            terrenos={terrenos}
            escolhidos={animalIds}
            onMudar={setAnimalIds}
            varios={varios}
            vazio={
              SO_FEMEAS.includes(tipo)
                ? t('evento.semFemeas')
                : t('evento.semAnimais')
            }
          />
        </Field>

        {/* Data */}
        <Field label={t('ficha.data')} obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {opcoesData.map((o) => (
              <Chip
                key={o.dias}
                label={t(o.chave)}
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
            {t('evento.ouDataExata')}
          </Text>
          <CampoData
            value={dataManual}
            onChangeText={setDataManual}
            placeholder={t('evento.exData')}
            rotuloCalendario={t('evento.calendarioData')}
          />
          {dataManualInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              {t('formAnimal.dataInvalidaNaoFutura')}
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
            <Field label={t('evento.tipoDeParto')} obrigatorio>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {(['Normal', 'Distócico', 'Cesariana'] as const).map((t) => (
                  <Chip key={t} label={t} selected={tipoParto === t} onPress={() => setTipoParto(t)} />
                ))}
              </View>
            </Field>
            <Field label={t('evento.resultado')} obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <BigToggle label={t('evento.nadoVivo')} icon="heart-pulse" selected={criaViva} onPress={() => setCriaViva(true)} />
                <BigToggle label={t('evento.nadoMorto')} icon="heart-broken" selected={!criaViva} onPress={() => setCriaViva(false)} />
              </View>
            </Field>
            {criaViva ? (
              <Field label={t('evento.sexoDaCria')} obrigatorio>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <BigToggle label={t('evento.femea')} icon="gender-female" selected={sexoCria === 'Fêmea'} onPress={() => setSexoCria('Fêmea')} />
                  <BigToggle label={t('evento.macho')} icon="gender-male" selected={sexoCria === 'Macho'} onPress={() => setSexoCria('Macho')} />
                </View>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                  {t('evento.criaComoAnimalNovo')}
                </Text>
              </Field>
            ) : null}
            <Aviso
              texto={
                criaViva
                  ? t('evento.criaViva')
                  : t('evento.umPartoPorCria')
              }
            />
          </>
        ) : null}

        {tipo === 'Cobrição' ? (
          <>
            <Field label={t('evento.como')} obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {MODOS_COBRICAO.map((m) => (
                  <BigToggle
                    key={m}
                    label={m === 'Touro' ? 'Touro' : 'Inseminação'}
                    icon={m === 'Touro' ? 'gender-male' : 'needle'}
                    selected={modoCobricao === m}
                    onPress={() => setModoCobricao(m)}
                  />
                ))}
              </View>
            </Field>
            <Field label={modoCobricao === 'Touro' ? 'Touro' : 'Sémen'} opcional>
              {/* Sugestões, e não uma lista fechada. O touro é muitas vezes
                  emprestado, alugado ou uma palheta de sémen, e nenhum deles
                  está no efetivo — uma lista fechada obrigaria a inventar um
                  animal para poder registar a cobrição. Mas escrever à mão o
                  nome do próprio semental, vinte vezes por época, era o caminho
                  curto para ficar com "Marquês" e "Marques" no histórico como se
                  fossem dois touros. Ver `sugestoesDeCobricao`. */}
              {sugestoesTouro.length > 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.xs,
                    marginBottom: spacing.xs,
                  }}>
                  {sugestoesTouro.map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      icon={modoCobricao === 'Touro' ? 'cow' : 'flask-outline'}
                      selected={touro.trim().toLocaleLowerCase('pt') === s.toLocaleLowerCase('pt')}
                      // Tocar no que já está escolhido limpa — é como se
                      // desfaz sem apagar letra a letra.
                      onPress={() =>
                        setTouro((atual) =>
                          atual.trim().toLocaleLowerCase('pt') === s.toLocaleLowerCase('pt')
                            ? ''
                            : s,
                        )
                      }
                    />
                  ))}
                </View>
              ) : null}
              <TextField
                value={touro}
                onChangeText={setTouro}
                placeholder={modoCobricao === 'Touro' ? 'Ex: Marquês' : 'Ex: Alentejano 4471'}
                icon={modoCobricao === 'Touro' ? 'cow' : 'flask-outline'}
                autoCapitalize="words"
              />
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                {sugestoesTouro.length > 0
                  ? t('evento.escolhaTouroOuEscreva')
                  : t('evento.touroDesconhecido')}
              </Text>
            </Field>
            <Aviso
              texto={`A app começa a contar a partir de hoje: passados ${PrazosReproducao.diagnosticoAPartirDe} dias avisa que falta o diagnóstico de gestação.`}
            />
          </>
        ) : null}

        {tipo === 'Diagnóstico' ? (
          <>
            <Field label={t('evento.resultado')} obrigatorio>
              <View style={{ gap: spacing.xs }}>
                {resultadosDiagnostico.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setResultado(r)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: resultado === r }}
                    accessibilityLabel={resultadoMeta[r].label}
                    style={({ pressed }) => [
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        minHeight: 60,
                        paddingHorizontal: spacing.md,
                        borderRadius: radii.md,
                        borderWidth: 1.5,
                        borderColor: resultado === r ? colors.primary : colors.border,
                        backgroundColor: resultado === r ? colors.primaryTint : colors.surface,
                      },
                      pressed && { opacity: 0.85 },
                    ]}>
                    <Icon
                      name={resultadoMeta[r].icon}
                      size="lg"
                      color={resultado === r ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong" color={resultado === r ? colors.primaryDark : colors.text}>
                        {resultadoMeta[r].label}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {resultadoMeta[r].explicacao}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </Field>

            {/* A conta feita, ANTES de gravar. É a única maneira de o criador
                perceber que a data prevista sai da cobrição e não do ar — e de
                reparar que a cobrição está com a data errada, se estiver. */}
            {resultado === 'gestante' ? (
              <Aviso
                texto={
                  partoPrevisto
                    ? t('evento.partoPrevistoPara', {
                        data: formatDataPt(partoPrevisto),
                        cobricao: formatDataPt(cobricaoDoDiagnostico!.data),
                      })
                    : t('evento.semCobricaoAnterior')
                }
              />
            ) : null}
            {resultado === 'vazia' && animal?.dataPrevistaParto ? (
              <Aviso texto={t('evento.dataPartoApagada')} />
            ) : null}

            <Field label={t('evento.veterinario')} opcional>
              <TextField
                value={vetDiag}
                onChangeText={setVetDiag}
                placeholder={t('evento.exVeterinario')}
                icon="stethoscope"
                autoCapitalize="words"
              />
            </Field>
          </>
        ) : null}

        {/* Lote da arrecadação — vacinação e medicamento. Só aparece se houver
            alguma coisa lá dentro: um seletor vazio num formulário que se usa
            no tronco é um campo a mais para ler e ignorar. */}
        {COM_LOTE.includes(tipo) && lotesDisponiveis.length > 0 ? (
          <Field label={t('evento.saiDoStock')} opcional>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              <Chip
                label={t('evento.naoRegistar')}
                selected={!loteId}
                onPress={() => {
                  setLoteId(undefined);
                  setQuantidade('');
                }}
              />
              {lotesDisponiveis.map((l) => (
                <Chip
                  key={l.medicamento.id}
                  label={`${rotuloLote(l.medicamento)} · restam ${formatQuantidade(l.resta, l.medicamento.unidade)}`}
                  selected={loteId === l.medicamento.id}
                  onPress={() => escolherLote(loteId === l.medicamento.id ? undefined : l.medicamento.id)}
                />
              ))}
            </View>
            {loteEscolhido ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>
                  {t('evento.quantoSeGastou', { unidade: loteEscolhido.medicamento.unidade })}
                  {animalIds.length > 1 ? ' e POR ANIMAL' : ''}
                </Text>
                <TextField
                  value={quantidade}
                  onChangeText={setQuantidade}
                  placeholder={`Ex: 20`}
                  icon="beaker-outline"
                  keyboardType="decimal-pad"
                />
                {/* A conta à frente: em massa, o que sai do frasco é a dose
                    vezes os animais, e é aí que se vê se o lote chega. */}
                {Number.isFinite(quantidadeNum) && quantidadeNum > 0 ? (
                  <Text
                    variant="caption"
                    color={
                      quantidadeNum * animalIds.length > loteEscolhido.resta
                        ? colors.danger
                        : colors.textMuted
                    }
                    style={{ marginTop: 4 }}>
                    {animalIds.length > 1
                      ? `${animalIds.length} animais × ${formatQuantidade(quantidadeNum, loteEscolhido.medicamento.unidade)} = ${formatQuantidade(quantidadeNum * animalIds.length, loteEscolhido.medicamento.unidade)}. `
                      : ''}
                    {t('evento.restamNesteLote', {
                      resta: formatQuantidade(loteEscolhido.resta, loteEscolhido.medicamento.unidade),
                    })}
                    {quantidadeNum * animalIds.length > loteEscolhido.resta
                      ? ' Não chega: o registo grava na mesma, mas confira o que está na arrecadação.'
                      : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Field>
        ) : null}

        {tipo === 'Vacinação' ? (
          <>
            <Field label={t('evento.vacinaDoenca')} obrigatorio>
              <TextField value={vacina} onChangeText={setVacina} placeholder={t('evento.exVacina')} icon="needle" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {VACINAS_COMUNS.map((v) => (
                  <Chip key={v} label={v} selected={vacina === v} onPress={() => setVacina(v)} />
                ))}
              </View>
            </Field>
            <Field label={t('evento.lote')} opcional>
              <TextField value={lote} onChangeText={setLote} placeholder={t('evento.exLote')} icon="flask-outline" autoCapitalize="characters" />
            </Field>
            <Field label={t('evento.proximaDose')} opcional>
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
            <Field label={t('evento.veterinario')} opcional>
              <TextField value={vetVacina} onChangeText={setVetVacina} placeholder={t('evento.exVeterinario')} icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Medicamento' ? (
          <>
            <Field label={t('evento.medicamento')} obrigatorio>
              <TextField value={medicamento} onChangeText={setMedicamento} placeholder={t('evento.exMedicamento')} icon="medical-bag" />
            </Field>
            <Field label={t('evento.dose')} opcional>
              <TextField value={dose} onChangeText={setDose} placeholder={t('evento.exDose')} icon="cup-water" />
            </Field>
            <Field label={t('evento.via')} opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {VIAS.map((v) => (
                  <Chip key={v} label={v} selected={via === v} onPress={() => setVia(via === v ? undefined : v)} />
                ))}
              </View>
            </Field>
            <Field label={t('ficha.motivo')} opcional>
              <TextField value={motivo} onChangeText={setMotivo} placeholder={t('evento.exMotivo')} icon="clipboard-text-outline" />
            </Field>
            <Field label={t('evento.intervaloSeguranca')} opcional>
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
                  {t('evento.naoVenderAte', { data: formatDataPt(isoMaisDias(data, seguranca)) })}
                </Text>
              ) : null}
            </Field>
            <Field label={t('evento.veterinario')} opcional>
              <TextField value={vetMed} onChangeText={setVetMed} placeholder={t('evento.exVeterinario')} icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Pesagem' ? (
          <Field label={t('evento.peso')} obrigatorio>
            <TextField value={peso} onChangeText={setPeso} placeholder={t('evento.exPeso')} icon="weight-kilogram" keyboardType="decimal-pad" />
          </Field>
        ) : null}

        {/* Custo — vacinação e medicamento (entra na gestão económica). Some
            com a gestão financeira desligada: o registo sanitário é o mesmo,
            só não se pede o dinheiro. É também a única coisa financeira que o
            veterinário preenche. */}
        {podeRegistarCusto && (tipo === 'Vacinação' || tipo === 'Medicamento') ? (
          <Field label={animalIds.length > 1 ? t('evento.custoPorAnimal') : t('evento.custo')} opcional>
            <TextField value={custo} onChangeText={setCusto} placeholder={t('evento.exCusto')} icon="cash" keyboardType="decimal-pad" />
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
        <Field label={t('evento.notas')} opcional>
          <TextField value={notas} onChangeText={setNotas} placeholder={t('evento.exNotas')} icon="note-text-outline" multiline />
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
              ? t('comum.aGuardar')
              : animalIds.length > 1
                ? t('evento.guardarEmNAnimais', { n: animalIds.length })
                : t('evento.guardarRegisto')
          }
          icon="check"
          onPress={guardar}
          disabled={!valido || aGuardar}
        />
      </View>
    </EcraComTeclado>
  );
}

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
