/**
 * Modelo de domínio — espelha o schema Drift/SQLite definido no projeto
 * (Utilizador → Exploração → Terreno → Animal) para que a persistência
 * local (expo-sqlite) possa entrar mais tarde sem alterar a UI.
 */

// Só o tipo, e por isso não há ciclo em execução: `permissoes.ts` também
// importa daqui, mas as duas importações desaparecem na compilação.
import type { PermissoesMembro } from './permissoes';

export type Especie = 'Bovino' | 'Equídeo' | 'Ovino' | 'Caprino' | 'Suíno';
export type Sexo = 'Macho' | 'Fêmea';
export type TipoTerreno = 'Pastagem' | 'Cultivo' | 'Misto' | 'Outro';

/**
 * Para que serve o animal na exploração. Só se pergunta a BOVINOS: é onde a
 * distinção manda no maneio (uma vaca de leite ordenha-se todos os dias, uma
 * de criação não) e no que faz sentido filtrar. Nos pequenos ruminantes o
 * rebanho tende a ter um destino só, e perguntar animal a animal seria um
 * campo a mais em cada registo.
 *
 * Nem todas se aplicam aos dois sexos — ver `finalidadesPara()` em
 * `constants.ts`. Um macho não é de "Criação" e uma fêmea não é "Semental".
 */
export type Finalidade =
  | 'Leite'
  | 'Carne'
  | 'Criação'
  | 'Semental'
  | 'Recria'
  | 'Trabalho';

/**
 * Estado do animal no efetivo. Nenhum dos três estados de saída apaga nada:
 * o registo mantém-se em BD (para preservar a árvore genealógica dos
 * descendentes e o histórico de quem o tratou), fica oculto das listas do
 * dia-a-dia e deixa de gerar alertas.
 *
 * `eliminado` é o que fica quando alguém carrega em "Eliminar animal". Não é a
 * mesma coisa que `falecido` nem que `vendido`: quer dizer que o registo foi
 * tirado da lista (por ter sido criado por engano, por duplicado, pelo que
 * for), e não que aconteceu alguma coisa ao animal. Ver `schema_auditoria.sql`.
 */
export type EstadoAnimal = 'ativo' | 'falecido' | 'vendido' | 'eliminado';

/** Papel de um utilizador dentro de uma exploração (multi-tenant). */
export type RoleMembro = 'admin' | 'trabalhador' | 'veterinario';

/** Estado do perfil (aprovação de cliente pelo superadmin). */
export type EstadoPerfil = 'pendente' | 'ativo';

export interface MembroExploracao {
  id: string;
  userId: string;
  exploracaoId: string;
  role: RoleMembro;
  criadoEm?: string;
  /**
   * O que o dono mudou às permissões desta pessoa, por cima do que o papel dá.
   * Vazio (ou ausente) = segue o papel. Ver `permissoes.ts`.
   */
  permissoes?: PermissoesMembro;
  /**
   * Até quando este vínculo vale (ISO com hora). Ausente = sem prazo, que é o
   * caso dos donos e dos trabalhadores.
   *
   * Existe por causa do veterinário, que é convidado para uma vinda e não para
   * sempre. Passada a hora, a linha CONTINUA na base — é o que deixa o dono ver
   * que o acesso existiu e renová-lo — mas deixa de valer: quem a ignora é o
   * servidor, nos helpers por onde toda a RLS passa (ver
   * `supabase/schema_acesso_temporario.sql`). A app usa isto só para não
   * mostrar controlos que o servidor já não aceita.
   */
  expiraEm?: string;
}

export interface Convite {
  codigo: string;
  exploracaoId: string;
  role: RoleMembro;
  criadoPor: string;
  criadoEm?: string;
  /**
   * Até quando o CÓDIGO pode ser usado. Não confundir com `acessoHoras`: um
   * código válido uma semana pode dar quatro horas de acesso.
   */
  expiraEm?: string;
  /**
   * Quantas horas o acesso dura DEPOIS de o código ser usado. Ausente = sem
   * prazo (trabalhadores). O relógio começa no resgate, não na criação: quem
   * só entra três dias depois tem as horas todas.
   */
  acessoHoras?: number;
  /**
   * O instante EXATO em que o acesso termina, quando o dono marcou dia e hora
   * em vez de uma duração ("até quinta às 18h"). Marcado, ganha ao
   * `acessoHoras` — e o servidor guarda só um dos dois.
   */
  acessoAte?: string;
  usadoPor?: string;
  usadoEm?: string;
  descricao?: string;
}

export interface UtilizadorPendente {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  nif?: string;
}

export type EventoTipo =
  | 'Parto'
  | 'Vacinação'
  | 'Medicamento'
  | 'Pesagem'
  /**
   * A fêmea foi coberta — por touro ou por inseminação artificial. É o começo
   * do ciclo: é daqui que se contam os dias até valer a pena diagnosticar, e é
   * a falta dele depois de um parto que põe a vaca na lista de quem está
   * parada. O touro (ou o sémen) vai no `detalhe`, como o veterinário numa
   * vacina — muitas vezes é um animal que não está na app.
   */
  | 'Cobrição'
  /**
   * Diagnóstico de gestação. O que interessa dele é o `resultado`, não o texto.
   * `gestante` é o que põe a data prevista de parto no animal.
   */
  | 'Diagnóstico'
  | 'Movimentação'
  | 'Compra'
  | 'Venda'
  | 'Morte';

/**
 * O que o diagnóstico de gestação disse. `duvidoso` não é um meio-termo
 * inventado: é o que o veterinário responde quando a gestação é demasiado
 * recente para se ver, e trata-se de outra maneira — repete-se daí a umas
 * semanas, em vez de se voltar a cobrir (que é o que se faz a uma vazia).
 */
export type ResultadoDiagnostico = 'gestante' | 'vazia' | 'duvidoso';

/** Vacina ou medicamento. Decide em que formulário o lote aparece. */
export type TipoMedicamento = 'Vacina' | 'Medicamento';

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  nif?: string;
  fotografia?: string;
}

/**
 * Versão da linha tal como o servidor a devolveu (`updated_at`), usada para
 * detetar que outra pessoa alterou o mesmo registo enquanto estávamos sem
 * rede. Ausente = nunca veio do servidor (criado localmente e ainda por
 * sincronizar), e nesse caso não há com quem colidir.
 *
 * Nunca é escrita pelo cliente: quem a mantém é o trigger `toca_updated_at`
 * (ver `supabase/schema_versoes.sql`). Um relógio mal acertado num telemóvel
 * não pode ter voto na versão.
 */
export interface ComVersao {
  atualizadoEm?: string;
}

export interface Exploracao extends ComVersao {
  id: string;
  utilizadorId: string;
  nome: string;
  marcaExploracao: string;
  nifDetentor: string;
  localizacao?: string;
  /**
   * Onde fica a sede da exploração, marcada no mapa. Opcional: escrever o nome
   * da terra continua a chegar (é o `localizacao`), e é o que a maioria faz.
   *
   * Quando existe, manda na meteorologia — ver `useMeteorologia`. Antes disto o
   * tempo saía das coordenadas do PRIMEIRO terreno com GPS, ou de uma
   * geocodificação do texto; quem tem os cercados espalhados por vinte
   * quilómetros via a previsão de um sítio que não escolheu.
   */
  latitude?: number;
  longitude?: number;
  fotografia?: string;
  /**
   * A gestão económica está ligada nesta exploração? Desligada (o valor por
   * omissão) esconde tudo o que é dinheiro e impede toda a gente de lançar
   * despesas, receitas ou custos de tratamento.
   *
   * É uma decisão de CONTA — o cliente liga-a uma vez no Perfil e o servidor
   * espelha-a por todas as explorações que ele administra. Está guardada aqui,
   * e não no perfil, porque a RLS de `perfil` só deixa cada um ver o seu: o
   * trabalhador e o veterinário precisam de a poder ler para saber o que a app
   * lhes deve mostrar. Nunca é escrita pelo cliente — só pelo RPC
   * `definir_financas_ativas` (ver `supabase/schema_financas_opcional.sql`).
   */
  financasAtivas?: boolean;
  /**
   * O registo de medicamentos (a aba Existências) está ligado nesta exploração?
   *
   * Mesma mecânica das finanças, e pela mesma razão: quem leva o frasco do
   * veterinário não tem arrecadação para gerir, e um separador vazio é uma
   * pergunta por responder no meio da barra. Decisão de CONTA, escrita só pelo
   * RPC `definir_existencias_ativas` (ver
   * `supabase/schema_existencias_opcional.sql`).
   *
   * Ao contrário das finanças, NÃO nasce desligada para toda a gente: a
   * migração liga-a a quem já tem lotes registados. Desligar esconde e não
   * apaga — o que resta de cada lote continua a ser comprado − aplicado, que
   * nunca esteve guardado em coluna nenhuma.
   */
  existenciasAtivas?: boolean;
  /**
   * HERANÇA. O interruptor do "registo por casa e número" já não existe na app:
   * o número do animal passou a um campo opcional sempre visível na ficha (ver
   * `FormularioAnimal`), porque um interruptor para mostrar um campo de texto
   * que quem não usa deixa vazio era uma decisão a pedir por nada.
   *
   * A coluna continua no servidor e a leitura continua a mapeá-la — apagar
   * colunas de uma base em uso não se faz por causa de um ecrã que saiu —, mas
   * nada na app a lê nem a escreve. Não voltar a pendurar comportamento aqui.
   */
  casaAtiva?: boolean;
}

export interface Terreno extends ComVersao {
  id: string;
  exploracaoId: string;
  nome: string;
  descricao?: string;
  latitude?: number;
  longitude?: number;
  area?: number; // hectares
  tipo?: TipoTerreno;
  /**
   * Fotografia do sítio, como a do animal: data URI JPEG reduzido, guardado na
   * própria coluna (ver `data/foto.ts`). Um lameiro reconhece-se de vista muito
   * antes de se ler o nome que alguém lhe deu na app.
   */
  fotografia?: string;
}

export interface Animal extends ComVersao {
  id: string;
  exploracaoId: string;
  terrenoId?: string;
  maeId?: string;
  paiId?: string;
  nome?: string;
  especie: Especie;
  sexo: Sexo;
  dataNascimento: string; // ISO
  raca?: string;
  corPelagem?: string;
  /**
   * HERANÇA: o nome da casa ("Casa do Monte"), do tempo em que o registo
   * tradicional eram dois campos. A app já não o pede nem o mostra — ficou só o
   * número, que é o que se diz de facto ("a 12"). A coluna fica no servidor com
   * o que lá estiver escrito; nada na app a lê.
   */
  casa?: string;
  /**
   * O número por que o animal é conhecido na exploração, a par do brinco.
   * Muitos criadores numeram o gado de um a duzentos há gerações e é assim que
   * o chamam. Opcional e sempre presente na ficha; entra na pesquisa.
   */
  numeroCasa?: string;
  /** Só para bovinos. Ver `Finalidade`. */
  finalidade?: Finalidade;
  numeroIdentificacao?: string; // brinco SIA
  dataIdentificacao?: string; // ISO
  tipoIdentificacao?: string;
  fotografia?: string;
  /** Estado sanitário: fim do intervalo de segurança de medicamento (ISO). */
  fimIntervaloSeguranca?: string;
  /** Data estimada de parto (ISO), para fêmeas gestantes. */
  dataPrevistaParto?: string;
  /** Já comunicado ao SNIRA? (nascimentos) */
  comunicadoSnira?: boolean;
  /**
   * Estado do animal. Ausente = considera-se `ativo` (compatível com registos
   * antigos). Fica preservado na BD mesmo quando falecido/vendido para a
   * árvore genealógica continuar a funcionar.
   */
  estado?: EstadoAnimal;
  /** Data em que saiu do efetivo (falecimento ou venda). ISO. */
  dataSaida?: string;
  /** Nota livre: causa da morte, comprador, matadouro, etc. */
  motivoSaida?: string;
  /**
   * Quem tirou o animal do efetivo, e o instante exato em que o fez. É o par
   * que faz do ecrã "Histórico do efetivo" uma auditoria e não uma lista.
   *
   * Nunca são escritos pelo cliente: quem os mantém é o trigger
   * `animal_regista_saida` (ver `supabase/schema_auditoria.sql`). Num modelo
   * offline-first o aparelho decide o que envia, e uma auditoria em que o
   * auditado escolhe o autor não vale nada. O que a app escreve localmente é
   * só uma previsão otimista, corrigida pelo servidor na sincronização.
   */
  saidaPor?: string;
  /** ISO com hora, ao contrário de `dataSaida` que é só o dia. */
  saidaEm?: string;
}

export interface Evento extends ComVersao {
  id: string;
  animalId: string;
  tipo: EventoTipo;
  data: string; // ISO
  descricao: string;
  detalhe?: string; // ex: medicamento, dose, veterinário
  /**
   * Custo em euros do que este evento consumiu (sempre positivo): a compra do
   * animal, a vacina, o medicamento. É SEMPRE uma despesa — ver `financas.ts`.
   *
   * O preço de uma VENDA não vive aqui: é uma receita, e as receitas só podem
   * ser vistas pelo dono. Como o Postgres não sabe esconder uma coluna a uns
   * membros e não a outros, deixá-lo no evento entregava o preço de venda a
   * qualquer trabalhador ou veterinário que lesse a tabela. Vive em
   * `Movimento` (tabela própria, com RLS por papel).
   */
  valor?: number;
  /**
   * O resultado de um `Diagnóstico`. Ausente em todos os outros tipos — uma
   * pesagem não tem resultado nenhum.
   *
   * Está numa coluna e não dentro do `descricao` porque é a resposta de que
   * depende o resto do ciclo. Lê-lo do texto com uma expressão regular é o que
   * se faz ao peso ("520 kg"), e ali o pior que acontece é um ganho médio
   * diário não aparecer; aqui o pior que acontece é uma vaca dada por prenhe
   * quando não está.
   */
  resultado?: ResultadoDiagnostico;
  /**
   * O lote de onde saiu o que se administrou (ver `Medicamento`). Ausente
   * quando o tratamento não veio da arrecadação — o veterinário que traz o
   * seu — e é isso que faz o desconto das existências ignorar esta linha em
   * vez de a contar como zero.
   */
  medicamentoId?: string;
  /** Quanto se gastou, na unidade do lote. Só faz sentido com `medicamentoId`. */
  quantidade?: number;
  /**
   * Este evento já foi comunicado ao SNIRA? Os três estados querem dizer
   * coisas diferentes (ver `supabase/schema_snira.sql`):
   *
   *   `undefined` — não é comunicável, ou é anterior a esta funcionalidade.
   *   `false`     — falta comunicar. É o que gera o alerta.
   *   `true`      — já foi.
   *
   * O nascimento não passa por aqui: esse vive em `Animal.comunicadoSnira`,
   * onde já estava.
   */
  comunicadoSnira?: boolean;
  /**
   * Quando foi comunicado (ISO com hora). Nunca é escrito pelo cliente: quem o
   * mantém é o gatilho `evento_comunicacao`, pela mesma razão que `saidaEm` —
   * uma data que prova o cumprimento de um prazo legal não pode sair do
   * relógio de um telemóvel mal acertado.
   */
  comunicadoEm?: string;
}

/* ---- Existências de medicamentos e vacinas ---- */

/**
 * Um lote que entrou na exploração — não um produto.
 *
 * A distinção manda em tudo o resto: dois frascos do mesmo antibiótico
 * comprados com três meses de diferença têm lotes e validades diferentes, e num
 * surto é o lote que se rastreia. Uma linha por frasco, com a quantidade que
 * trazia; acabou, fica a zero com o histórico do que saiu dele.
 *
 * O que RESTA não está aqui: calcula-se (ver `medicamentos.ts`) subtraindo à
 * `quantidade` o que os eventos gastaram. Uma coluna a descontar teria de ser
 * mantida certa a partir de dois aparelhos que podem estar offline, e a
 * primeira gravação perdida deixava-a errada para sempre.
 */
export interface Medicamento extends ComVersao {
  id: string;
  exploracaoId: string;
  nome: string;
  tipo: TipoMedicamento;
  lote?: string;
  /** ISO aaaa-mm-dd. */
  validade?: string;
  /** O que o frasco trazia. Sempre positivo. */
  quantidade: number;
  unidade: string;
  /**
   * Dias a aguardar antes de o animal poder ir para abate. Vem da bula, por
   * isso pertence ao produto e não a quem o administra — o formulário do
   * tratamento propõe-o preenchido e deixa corrigir.
   */
  intervaloSegurancaDias: number;
  fornecedor?: string;
  /** Custo TOTAL do que entrou (não por unidade), em euros. */
  custo?: number;
  /** ISO aaaa-mm-dd. */
  dataCompra: string;
  notas?: string;
  /**
   * O código impresso na caixa, lido pela câmara e já normalizado (ver
   * `data/codigos.ts`). É a MEMÓRIA de produtos da conta: ao dar entrada do
   * mesmo produto outra vez, é por aqui que a app o reconhece e propõe o
   * formulário preenchido.
   *
   * Guarda a CHAVE e não o que a câmara leu em cru, porque o mesmo produto lido
   * do código de riscas e do Data Matrix dá números diferentes (13 e 14
   * dígitos) e teriam de ser o mesmo para se reconhecerem um ao outro.
   */
  codigoBarras?: string;
  criadoPor?: string;
}

/* ---- Movimentos financeiros (o que não cabe num evento de animal) ---- */

/**
 * Onde o dinheiro é gasto. A alimentação costuma ser a maior fatia do custo
 * de uma exploração, e nada disso tem animal: é da exploração inteira.
 */
export type CategoriaDespesa =
  | 'Alimentação'
  | 'Sanidade'
  | 'Compra de animais'
  | 'Energia e combustível'
  | 'Água'
  | 'Rendas e terrenos'
  | 'Máquinas e reparações'
  | 'Mão-de-obra'
  | 'Taxas e seguros'
  | 'Outras despesas';

/** De onde o dinheiro vem. */
export type CategoriaReceita =
  | 'Venda de animais'
  | 'Leite e produtos'
  | 'Apoios e subsídios'
  | 'Outras receitas';

export type CategoriaMovimento = CategoriaDespesa | CategoriaReceita;

export type Direcao = 'receita' | 'despesa';

/**
 * Uma entrada ou saída de dinheiro da exploração.
 *
 * Existe porque as finanças não cabem todas nos eventos: a fatura da ração, a
 * eletricidade e o gasóleo não pertencem a nenhum animal, e sem elas o saldo
 * seria bonito e falso. `animalId`/`terrenoId` são opcionais — servem para
 * imputar um custo quando faz sentido, sem obrigar a isso na conta da luz.
 */
export interface Movimento extends ComVersao {
  id: string;
  exploracaoId: string;
  direcao: Direcao;
  categoria: CategoriaMovimento;
  /** Euros, sempre positivo. O sinal vem da `direcao`. */
  valor: number;
  data: string; // ISO
  descricao: string;
  /** Quem emitiu a fatura, ou a quem se vendeu. */
  contraparte?: string;
  animalId?: string;
  terrenoId?: string;
  /**
   * Quem registou. É o que permite ao trabalhador ver e corrigir o que lançou
   * sem lhe abrir a contabilidade da exploração: a RLS filtra por esta coluna.
   */
  criadoPor?: string;
  /**
   * Quando o lançamento entrou na app (ISO com hora), que não é a mesma coisa
   * que `data` — essa é o dia a que a despesa diz respeito, e escreve-se à mão.
   * Quem lança uma fatura de há três semanas põe a data dela; o instante do
   * registo é este, e é do servidor (`default now()`).
   */
  criadoEm?: string;
}

/* ---- Derivados (não persistidos) ---- */

export type AlertaGravidade = 'urgente' | 'aviso' | 'info';

export interface Alerta {
  id: string;
  gravidade: AlertaGravidade;
  titulo: string;
  descricao: string;
  animalId?: string;
  /** Dias restantes até ao prazo (negativo = vencido). */
  diasRestantes?: number;
  /**
   * O dia a que o alerta pertence (ISO) — a data prevista do parto, o fim do
   * prazo legal, o dia de revacinar. É o que põe o alerta no calendário.
   *
   * Nem todos têm: "sem registo de vacinação" não é um prazo, é uma lacuna, e
   * inventar-lhe um dia era pô-lo no calendário como se fosse tarefa marcada.
   */
  data?: string;
  /** A exploração do animal, para se poderem ver os alertas de uma só. */
  exploracaoId?: string;
  /**
   * `existencias` é a única categoria que não fala de um animal: fala da
   * arrecadação (um lote fora de validade, um frasco a acabar). Por isso os
   * seus alertas não trazem `animalId` — e quem os agrupa por animal tem de
   * contar com isso.
   */
  categoria:
    | 'snira'
    | 'identificacao'
    | 'parto'
    | 'medicamento'
    | 'vacinacao'
    | 'reproducao'
    | 'existencias';
  /** O lote a que o alerta diz respeito (só em `existencias`). */
  medicamentoId?: string;
}

/**
 * Um dia da previsão. Sem hora, sem humidade e sem vento de propósito: a
 * pergunta que se faz a uma previsão a três dias é "chove?" e "que frio faz de
 * manhã", e o resto é ruído com ar de precisão.
 */
export interface DiaMeteo {
  /** O dia (ISO aaaa-mm-dd). */
  data: string;
  maxima: number;
  minima: number;
  condicao: string;
  icone: string; // nome de ícone MaterialCommunityIcons
  /** Chuva prevista para o dia inteiro, em mm. */
  precipitacao: number;
  /** Probabilidade de precipitação (%), quando a API a dá. */
  probabilidadeChuva?: number;
}

export interface Meteorologia {
  local: string;
  temperatura: number;
  condicao: string;
  icone: string; // nome de ícone MaterialCommunityIcons
  humidade: number;
  vento: number; // km/h
  precipitacao: number; // mm
  maxima: number;
  minima: number;
  conselho: string;
  /**
   * Hoje e os dias seguintes, por ordem. O primeiro é sempre hoje — é o que
   * deixa os cartões da previsão e os números de cima virem da mesma resposta,
   * em vez de discordarem um do outro por causa de dois pedidos.
   *
   * Pode vir vazio: uma resposta sem bloco diário ainda serve para mostrar o
   * tempo que está agora, e é melhor do que um ecrã de erro.
   */
  dias: DiaMeteo[];
}
