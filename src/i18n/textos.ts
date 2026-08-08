/**
 * Os textos da app, em português e em inglês.
 * ------------------------------------------------------------------
 * O português é a FONTE: é nele que a app é pensada e escrita, e é a coluna
 * `pt` que define as chaves. O `en` está tipado como `Record<ChaveTexto,
 * string>`, portanto uma chave nova sem tradução não compila — que é a única
 * maneira de isto não apodrecer meio traduzido.
 *
 * COMO SE ESCREVE UM TEXTO
 *
 *   '{n} animais'          → `t('chave', { n: 3 })`
 *   '{n} animal|{n} animais' → singular antes do `|`, plural depois; escolhido
 *                              pelo `n` que se passa. Existe porque o plural
 *                              não é o mesmo nas duas línguas e um `+ 's'`
 *                              colado no fim dava "1 animals" ou "3 alertas"
 *                              em inglês.
 *
 * O QUE **NÃO** ESTÁ AQUI
 *
 * Os nomes do DOMÍNIO — as espécies, os tipos de evento (`Cobrição`,
 * `Pesagem`), as raças, as finalidades — continuam só em português, e de
 * propósito por agora: são valores GRAVADOS na base de dados (`evento.tipo` é
 * texto livre) e traduzi-los na interface obrigava a uma tabela de conversão em
 * cada leitura e em cada escrita. Um registo gravado em inglês e lido em
 * português deixaria de ser encontrado pelos filtros. Fica para quando o
 * domínio tiver códigos em vez de palavras.
 */

import { idiomaAtual, type Idioma } from './idioma';

const pt = {
  /* ---- Navegação ---- */
  'nav.inicio': 'Início',
  'nav.exploracoes': 'Explorações',
  'nav.terrenos': 'Terrenos',
  'nav.animais': 'Animais',
  'nav.alertas': 'Alertas',
  'nav.reproducao': 'Reprodução',
  'nav.existencias': 'Existências',
  'nav.trabalhadores': 'Trabalhadores',
  'nav.financas': 'Finanças',
  'nav.documentos': 'Documentos',
  'nav.definicoes': 'Definições',
  'nav.perfil': 'Perfil',
  'nav.mais': 'Mais',
  'nav.registar': 'Registar',
  'nav.registarAjuda': 'Abre as ações rápidas: animal, vacina, parto, despesa',

  /* ---- Comuns ---- */
  'comum.fechar': 'Fechar',
  'comum.verTodos': 'Ver todos',
  'comum.verTodas': 'Ver todas',
  'comum.limpar': 'Limpar',
  'comum.todas': 'Todas',
  'comum.ligado': 'Ligado',
  'comum.desligado': 'Desligado',
  'comum.ligada': 'Ligada',
  'comum.desligada': 'Desligada',

  /* ---- Saudação e data (Início) ---- */
  'saudacao.manha': 'Bom dia',
  'saudacao.tarde': 'Boa tarde',
  'saudacao.noite': 'Boa noite',

  /* ---- Início ---- */
  'inicio.calendario': 'O que aí vem',
  'inicio.marcar': 'Marcar',
  'inicio.atencao': 'Precisa da sua atenção',
  'inicio.tudoEmDia': 'Tudo em dia. Não há prazos a cumprir.',
  'inicio.urgentes': '{n} urgente|{n} urgentes',
  'inicio.resumo': 'Resumo',
  'inicio.minhasExploracoes': 'As minhas explorações',
  'inicio.semExploracoes': 'Ainda não tem explorações. Crie uma para começar a registar animais.',
  'inicio.acoesRapidas': 'Ações rápidas',
  'inicio.saldo': 'Saldo da exploração',
  'inicio.registeContas': 'Registe despesas e receitas',
  'inicio.aSincronizar': 'A sincronizar {n} alteração…|A sincronizar {n} alterações…',
  'inicio.semLigacaoComPendentes':
    'Sem ligação. {n} alteração guardada. Envio automático quando houver rede.|Sem ligação. {n} alterações guardadas. Envio automático quando houver rede.',
  'inicio.semLigacao':
    'Sem ligação. Está a trabalhar offline; os dados estão guardados no dispositivo.',

  /* ---- Ações rápidas ---- */
  'acao.evento': 'Novo evento',
  'acao.eventoDesc': 'A feira, a visita do veterinário, a entrega',
  'acao.animal': 'Novo animal',
  'acao.animalDesc': 'Dar entrada de uma cabeça no efetivo',
  'acao.parto': 'Parto',
  'acao.partoDesc': 'A cria fica registada sozinha',
  'acao.vacinacao': 'Vacinação',
  'acao.vacinacaoDesc': 'A vários animais de uma vez',
  'acao.medicamento': 'Medicamento',
  'acao.medicamentoDesc': 'Com o intervalo de segurança',
  'acao.cobricao': 'Cobrição',
  'acao.cobricaoDesc': 'Por touro ou inseminação',
  'acao.pesagem': 'Pesagem',
  'acao.pesagemDesc': 'Calcula o ganho médio diário',
  'acao.despesa': 'Despesa',
  'acao.despesaDesc': 'Ração, gasóleo, faturas',
  'acao.semPermissao': 'Quem gere esta exploração ainda não lhe deu acesso a registar nada.',

  /* ---- Animais ---- */
  'animais.noEfetivo': '{n} no efetivo',
  'animais.deTotal': '{n} de {total}',
  'animais.procurar': 'Nome, brinco, raça ou número',
  'animais.filtros': 'Filtros',
  'animais.filtrosAtivos': 'Filtros, {n} ativos',
  'animais.ordenar': 'Ordenar:',
  'animais.historico': 'Histórico do efetivo ({n})',
  'animais.limparTodos': 'Limpar todos os filtros',
  'animais.vazioTitulo': 'Nenhum animal encontrado',
  'animais.vazioFiltrado': 'Experimente ajustar a pesquisa ou os filtros.',
  'animais.vazioSemNada': 'Ainda não há animais registados. Comece por adicionar o primeiro.',
  'animais.limparFiltros': 'Limpar filtros',
  'animais.registarAnimal': 'Registar animal',
  'animais.fab': 'Registar',
  'animais.ordemNome': 'Nome (A→Z)',
  'animais.ordemAlertas': 'Com alertas primeiro',
  'animais.ordemNovos': 'Mais novos',
  'animais.ordemVelhos': 'Mais velhos',
  'animais.semNome': 'Sem nome',
  'animais.semBrinco': 'Sem brinco',
  'animais.porCompletar': 'Por completar',

  /* ---- Idade por extenso ---- */
  'idade.porNascer': 'por nascer',
  'idade.dias': '{n} dia|{n} dias',
  'idade.meses': '{n} mês|{n} meses',
  'idade.anos': '{n} ano|{n} anos',
  /** "3 anos e 6 meses" — as duas partes já vêm formatadas. */
  'idade.anosEMeses': '{anos} e {meses}',

  /* ---- Explorações ---- */
  'exploracoes.subtitulo': 'As suas explorações pecuárias',
  'exploracoes.vazioTitulo': 'Sem explorações',
  'exploracoes.vazioPodeCriar':
    'Crie a sua primeira exploração para começar a registar terrenos e animais.',
  'exploracoes.vazioSemConvite':
    'Ainda não foi associado a nenhuma exploração. Peça um código a quem a gere.',
  'exploracoes.nova': 'Nova exploração',
  'exploracoes.fab': 'Nova',

  /* ---- Calendário, linha da exploração e selo do alerta ---- */
  'calendario.voltarAHoje': 'Voltar ao mês de hoje',
  'exploracao.animais': 'animais',
  'exploracao.terrenos': 'terrenos',
  'alerta.emAtraso': 'Em atraso',
  'alerta.hoje': 'Hoje',
  'alerta.dias': '{n} dia|{n} dias',

  /* ---- Alertas ---- */
  'alertas.urgente': 'Urgente',
  'alertas.estaSemana': 'Esta semana',
  'alertas.aAcompanhar': 'A acompanhar',
  'alertas.lista': 'Lista',
  'alertas.calendario': 'Calendário',
  'alertas.tudoEmDiaTitulo': 'Tudo em dia',
  'alertas.tudoEmDiaMensagem': 'Não há prazos legais nem tarefas pendentes. Bom trabalho!',

  /* ---- Definições ---- */
  'definicoes.subtitulo': 'Como a app funciona para si',
  'definicoes.grupoRegista': 'O QUE A APP REGISTA',
  'definicoes.grupoAspeto': 'ASPETO',
  'definicoes.grupoDados': 'DADOS',
  'definicoes.grupoSobre': 'SOBRE',
  'definicoes.financas': 'Gestão financeira',
  'definicoes.existencias': 'Registo de medicamentos',
  'definicoes.notificacoes': 'Notificações e alertas',
  'definicoes.cores': 'Cores da app',
  'definicoes.idioma': 'Idioma',
  'definicoes.sincronizacao': 'Sincronização e cópia de segurança',
  'definicoes.ajuda': 'Ajuda e apoio',
  'definicoes.privacidade': 'Privacidade e termos',
  'definicoes.versao': 'Terrabovina · versão {v}',

  /* ---- Ecrã do idioma ---- */
  'idioma.titulo': 'Idioma',
  'idioma.explicacao':
    'Muda a língua dos menus e das mensagens da app. Os nomes que escreveu — animais, terrenos, notas — ficam como os escreveu.',
  'idioma.aRecarregar': 'A app vai recarregar para mudar de língua.',
  'idioma.porAplicar':
    'Escolha guardada. A app muda de língua da próxima vez que a abrir.',
  'idioma.domínioEmPortugues':
    'Os tipos de registo (Parto, Cobrição, Vacinação) e as raças ficam em português: são o que está gravado nas fichas dos animais.',
} as const;

export type ChaveTexto = keyof typeof pt;

/**
 * Todas as chaves. Existe para o teste de completude as poder percorrer sem as
 * ter escritas à mão — uma lista copiada ficava desatualizada na primeira chave
 * nova, e um teste que não conhece metade das chaves não prova nada.
 */
export const CHAVES_TEXTO = Object.keys(pt) as ChaveTexto[];

const en: Record<ChaveTexto, string> = {
  /* ---- Navegação ---- */
  'nav.inicio': 'Home',
  'nav.exploracoes': 'Farms',
  'nav.terrenos': 'Land',
  'nav.animais': 'Animals',
  'nav.alertas': 'Alerts',
  'nav.reproducao': 'Breeding',
  'nav.existencias': 'Stock',
  'nav.trabalhadores': 'Workers',
  'nav.financas': 'Finances',
  'nav.documentos': 'Documents',
  'nav.definicoes': 'Settings',
  'nav.perfil': 'Profile',
  'nav.mais': 'More',
  'nav.registar': 'Add',
  'nav.registarAjuda': 'Opens quick actions: animal, vaccination, birth, expense',

  /* ---- Comuns ---- */
  'comum.fechar': 'Close',
  'comum.verTodos': 'See all',
  'comum.verTodas': 'See all',
  'comum.limpar': 'Clear',
  'comum.todas': 'All',
  'comum.ligado': 'On',
  'comum.desligado': 'Off',
  'comum.ligada': 'On',
  'comum.desligada': 'Off',

  /* ---- Saudação e data ---- */
  'saudacao.manha': 'Good morning',
  'saudacao.tarde': 'Good afternoon',
  'saudacao.noite': 'Good evening',

  /* ---- Início ---- */
  'inicio.calendario': "What's coming up",
  'inicio.marcar': 'Schedule',
  'inicio.atencao': 'Needs your attention',
  'inicio.tudoEmDia': 'All up to date. Nothing due.',
  'inicio.urgentes': '{n} urgent|{n} urgent',
  'inicio.resumo': 'Summary',
  'inicio.minhasExploracoes': 'My farms',
  'inicio.semExploracoes': "You don't have any farms yet. Create one to start recording animals.",
  'inicio.acoesRapidas': 'Quick actions',
  'inicio.saldo': 'Farm balance',
  'inicio.registeContas': 'Record income and expenses',
  'inicio.aSincronizar': 'Syncing {n} change…|Syncing {n} changes…',
  'inicio.semLigacaoComPendentes':
    'No connection. {n} change saved. It will be sent automatically once you are back online.|No connection. {n} changes saved. They will be sent automatically once you are back online.',
  'inicio.semLigacao': 'No connection. You are working offline; your data is saved on this device.',

  /* ---- Ações rápidas ---- */
  'acao.evento': 'New event',
  'acao.eventoDesc': 'The fair, the vet visit, a delivery',
  'acao.animal': 'New animal',
  'acao.animalDesc': 'Add a head to the herd',
  'acao.parto': 'Birth',
  'acao.partoDesc': 'The calf is recorded automatically',
  'acao.vacinacao': 'Vaccination',
  'acao.vacinacaoDesc': 'To several animals at once',
  'acao.medicamento': 'Medicine',
  'acao.medicamentoDesc': 'With the withdrawal period',
  'acao.cobricao': 'Mating',
  'acao.cobricaoDesc': 'By bull or insemination',
  'acao.pesagem': 'Weighing',
  'acao.pesagemDesc': 'Works out the average daily gain',
  'acao.despesa': 'Expense',
  'acao.despesaDesc': 'Feed, fuel, bills',
  'acao.semPermissao': "Whoever runs this farm hasn't given you access to record anything yet.",

  /* ---- Animais ---- */
  'animais.noEfetivo': '{n} in the herd',
  'animais.deTotal': '{n} of {total}',
  'animais.procurar': 'Name, tag, breed or number',
  'animais.filtros': 'Filters',
  'animais.filtrosAtivos': 'Filters, {n} active',
  'animais.ordenar': 'Sort:',
  'animais.historico': 'Herd history ({n})',
  'animais.limparTodos': 'Clear all filters',
  'animais.vazioTitulo': 'No animals found',
  'animais.vazioFiltrado': 'Try adjusting the search or the filters.',
  'animais.vazioSemNada': 'No animals recorded yet. Start by adding the first one.',
  'animais.limparFiltros': 'Clear filters',
  'animais.registarAnimal': 'Add animal',
  'animais.fab': 'Add',
  'animais.ordemNome': 'Name (A→Z)',
  'animais.ordemAlertas': 'With alerts first',
  'animais.ordemNovos': 'Youngest first',
  'animais.ordemVelhos': 'Oldest first',
  'animais.semNome': 'No name',
  'animais.semBrinco': 'No tag',
  'animais.porCompletar': 'Incomplete',

  /* ---- Idade por extenso ---- */
  'idade.porNascer': 'not born yet',
  'idade.dias': '{n} day|{n} days',
  'idade.meses': '{n} month|{n} months',
  'idade.anos': '{n} year|{n} years',
  'idade.anosEMeses': '{anos} and {meses}',

  /* ---- Explorações ---- */
  'exploracoes.subtitulo': 'Your livestock farms',
  'exploracoes.vazioTitulo': 'No farms',
  'exploracoes.vazioPodeCriar': 'Create your first farm to start recording land and animals.',
  'exploracoes.vazioSemConvite':
    "You haven't been added to any farm yet. Ask whoever runs it for a code.",
  'exploracoes.nova': 'New farm',
  'exploracoes.fab': 'New',

  /* ---- Calendário, linha da exploração e selo do alerta ---- */
  'calendario.voltarAHoje': 'Back to this month',
  'exploracao.animais': 'animals',
  'exploracao.terrenos': 'land',
  'alerta.emAtraso': 'Overdue',
  'alerta.hoje': 'Today',
  'alerta.dias': '{n} day|{n} days',

  /* ---- Alertas ---- */
  'alertas.urgente': 'Urgent',
  'alertas.estaSemana': 'This week',
  'alertas.aAcompanhar': 'Keep an eye on',
  'alertas.lista': 'List',
  'alertas.calendario': 'Calendar',
  'alertas.tudoEmDiaTitulo': 'All up to date',
  'alertas.tudoEmDiaMensagem': 'No legal deadlines or pending tasks. Good work!',

  /* ---- Definições ---- */
  'definicoes.subtitulo': 'How the app works for you',
  'definicoes.grupoRegista': 'WHAT THE APP RECORDS',
  'definicoes.grupoAspeto': 'APPEARANCE',
  'definicoes.grupoDados': 'DATA',
  'definicoes.grupoSobre': 'ABOUT',
  'definicoes.financas': 'Financial management',
  'definicoes.existencias': 'Medicine records',
  'definicoes.notificacoes': 'Notifications and alerts',
  'definicoes.cores': 'App colours',
  'definicoes.idioma': 'Language',
  'definicoes.sincronizacao': 'Sync and backup',
  'definicoes.ajuda': 'Help and support',
  'definicoes.privacidade': 'Privacy and terms',
  'definicoes.versao': 'Terrabovina · version {v}',

  /* ---- Ecrã do idioma ---- */
  'idioma.titulo': 'Language',
  'idioma.explicacao':
    "Changes the language of the app's menus and messages. The names you typed — animals, land, notes — stay exactly as you wrote them.",
  'idioma.aRecarregar': 'The app will reload to change language.',
  'idioma.porAplicar': 'Choice saved. The app will change language next time you open it.',
  'idioma.domínioEmPortugues':
    'Record types (Parto, Cobrição, Vacinação) and breeds stay in Portuguese: they are what is stored on the animals’ records.',
};

const DICIONARIOS: Record<Idioma, Record<ChaveTexto, string>> = { pt, en };

/**
 * Os dicionários EM CRU, com o `|` do plural por resolver.
 *
 * Exportado só para os testes. O `t()` resolve o `|` antes de devolver, por
 * isso um teste que passasse por ele nunca conseguia ver se a tradução inglesa
 * ficou sem as duas metades — que é precisamente o engano que se quer apanhar.
 */
export const DICIONARIOS_EM_CRU: Record<Idioma, Record<ChaveTexto, string>> = DICIONARIOS;

/**
 * O texto de uma chave, no idioma em uso.
 *
 * `vars.n` faz duas coisas ao mesmo tempo: substitui `{n}` e escolhe o lado do
 * `|` (singular à esquerda). É o mesmo número nas duas funções de propósito —
 * um plural que não bate certo com o número que está escrito ao lado é pior do
 * que não ter plural nenhum.
 */
export function t(chave: ChaveTexto, vars?: Record<string, string | number>): string {
  const bruto = DICIONARIOS[idiomaAtual()][chave] ?? pt[chave];

  let texto = bruto;
  if (bruto.includes('|')) {
    const [singular, plural] = bruto.split('|');
    texto = Number(vars?.n) === 1 ? singular : plural;
  }

  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) =>
    nome in vars ? String(vars[nome]) : inteiro,
  );
}
