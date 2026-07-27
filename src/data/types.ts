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
  | 'Movimentação'
  | 'Compra'
  | 'Venda'
  | 'Morte';

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
   * O registo por casa e número está ligado nesta exploração? Desligado (o
   * valor por omissão) esconde os dois campos do formulário do animal.
   *
   * Vive aqui, e não no perfil, pela mesma razão que `financasAtivas`: a RLS de
   * `perfil` só deixa cada um ver o seu, e o trabalhador precisa de a ler para
   * saber que campos preencher. Escrita só pelo RPC `definir_casa_ativa`.
   *
   * Ao contrário das finanças, isto não fecha nenhuma porta no servidor: são
   * duas colunas de texto sem regra de permissão própria. O interruptor existe
   * para não encher o formulário a quem nunca registou gado por casa — não é
   * uma medida de segurança, e não se deve passar a tratá-lo como tal.
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
   * Registo tradicional por casa: o nome da casa e o número do animal dentro
   * dela ("Casa do Monte, 12"). Muitos criadores identificam assim os animais
   * há gerações, ao lado (ou em vez) do brinco.
   *
   * Os campos só aparecem no formulário com `Exploracao.casaAtiva` ligada, mas
   * um animal que já os tenha preenchido mostra-os SEMPRE — desligar a opção
   * esconde o que ainda não foi escrito, nunca o que já lá está.
   */
  casa?: string;
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
  categoria: 'snira' | 'identificacao' | 'parto' | 'medicamento' | 'vacinacao';
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
}
