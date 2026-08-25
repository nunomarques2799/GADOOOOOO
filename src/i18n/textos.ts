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
  'nav.chat': 'Conversas',
  /* O rótulo curto da barra de baixo: 'Conversas' não cabe em sete colunas. */
  'nav.chatCurto': 'Chat',
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
  'comum.eliminar': 'Eliminar',
  'comum.guardar': 'Guardar',
  'comum.cancelar': 'Cancelar',
  'comum.aGuardar': 'A guardar…',
  'comum.aCarregar': 'a carregar…',
  'comum.semVoltaAtras': 'Tem a certeza? Esta ação não pode ser anulada.',
  'comum.semEliminar': 'Não foi possível eliminar',
  'comum.semGravar': 'Não foi possível guardar',
  'comum.percebi': 'Percebi',

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
  /** Só falado por um leitor de ecrã, na linha da lista. */
  'animais.faladoPorCompletar': 'por completar: sem nome nem brinco',
  'animais.faladoSemBrinco': 'por identificar: sem brinco',

  /* ---- Pontos coloridos no retrato do animal ---- */
  'sinal.legal': 'Brinco e SNIRA',
  'sinal.reproducao': 'Reprodução',
  'sinal.saude': 'Vacinas e medicamentos',
  /** Como um leitor de ecrã anuncia os pontos de uma linha. */
  'sinal.falado': 'Por tratar',

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
  'calendario.mesAnterior': 'Mês anterior',
  'calendario.mesSeguinte': 'Mês seguinte',
  'calendario.diaAnterior': 'Dia anterior',
  'calendario.diaSeguinte': 'Dia seguinte',
  'calendario.nadaMarcado': 'Nada marcado.',
  'calendario.nadaNesteDia': 'Nada marcado para este dia.',
  'calendario.nEventos': '{n} evento|{n} eventos',
  'calendario.nPrazos': '{n} prazo|{n} prazos',
  'calendario.prazosDesteDia': 'PRAZOS DESTE DIA',
  'calendario.marcarNesteDia': 'Marcar evento neste dia',
  'calendario.arrasteParaOLado':
    'Arraste para o lado, ou use as setas, para ver os outros dias.',
  'calendario.soEuVejo': 'Só eu vejo',
  'exploracao.animais': 'animais',
  'exploracao.terrenos': 'terrenos',
  'exploracao.escolher': 'Ver que exploração?',
  'exploracao.filtroRotulo': 'Exploração: {nome}',
  'exploracao.filtroAjuda': 'Abre a lista das suas explorações',
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
  'alertas.tudoEmDiaNaExploracao': 'Não há prazos nem tarefas pendentes em {nome}.',
  'alertas.subtitulo': 'Prazos legais e tarefas por fazer',
  'alertas.introTitulo': 'Para que serve este separador',
  'alertas.intro1':
    'A app conta sozinha os prazos legais a partir das datas que registou: identificar um vitelo, comunicar ao SNIRA, o fim de um intervalo de segurança.',
  'alertas.intro2':
    'Em cima ficam os urgentes, e a seguir o que é desta semana. Quando trata do assunto no animal, o alerta desaparece daqui.',
  'alertas.intro3':
    'Toque no título de um grupo para o fechar. No Calendário vê os mesmos prazos por dias, para saber o que o espera na semana que vem.',
  'alertas.intro4':
    'Só os avisos sem contagem decrescente se podem dispensar. O que tem prazo a correr fica: é o que não pode ser esquecido.',
  'alertas.verMais': 'Ver mais {n}',
  'alertas.abrirGrupoAjuda': 'Abre a lista deste grupo',
  'alertas.fecharGrupoAjuda': 'Fecha a lista deste grupo',

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
    'Muda a língua dos menus e das mensagens da app. Os nomes que escreveu (animais, terrenos, notas) ficam como os escreveu.',
  'idioma.aRecarregar': 'A app vai recarregar para mudar de língua.',
  'idioma.porAplicar':
    'Escolha guardada. A app muda de língua da próxima vez que a abrir.',
  'idioma.domínioEmPortugues':
    'Os tipos de registo (Parto, Cobrição, Vacinação) e as raças ficam em português: são o que está gravado nas fichas dos animais.',

  /* ---- Guia de primeiros passos (Início) ---- */
  'tutorial.titulo': 'Vamos começar',
  'tutorial.progresso': '{n} de {total} feito|{n} de {total} feitos',
  'tutorial.esconder': 'Esconder',
  'tutorial.esconderAjuda': 'Esconder o guia de primeiros passos',
  'tutorial.comoFunciona':
    'Siga os passos pela ordem. Toque em cada um para saber o que é. Pode parar a meio e continuar quando quiser: a app guarda tudo.',
  'tutorial.opcionaisTitulo': 'SE QUISER, NÃO É PRECISO',
  'tutorial.opcionaisAjuda':
    'Feitios da app que pode ligar agora ou nunca. Também estão no Perfil.',
  'tutorial.feito': 'Feito',
  'tutorial.toqueParaSaber': 'Toque para saber o que é',

  'tutorial.exploracaoTitulo': 'Criar a sua exploração',
  'tutorial.exploracaoDescricao': 'É a sua quinta dentro da app. Comece por aqui.',
  'tutorial.exploracaoDetalhe':
    'A exploração é a sua quinta ou herdade dentro da app: é dentro dela que ficam os terrenos, os animais e tudo o que registar. Basta o nome por que lhe chama e a localidade; a marca de exploração e o resto podem ficar para depois. Se tiver duas quintas, crie duas: a app mantém as contas de cada uma separadas.',
  'tutorial.exploracaoAcao': 'Criar a exploração',

  'tutorial.terrenoTitulo': 'Registar os seus terrenos',
  'tutorial.terrenoDescricao': 'As pastagens, os cercados e os currais onde o gado anda.',
  'tutorial.terrenoDetalhe':
    'Um terreno é cada sítio onde os animais podem estar: uma pastagem, um cercado, um curral. Dê-lhe o nome por que lhe chama ("Courela de Baixo") e, se quiser, marque-o no mapa por satélite. Feito isto, pode dizer em que terreno está cada animal e ver, de uma olhadela, quantos estão em cada sítio.',
  'tutorial.terrenoAcao': 'Adicionar um terreno',

  'tutorial.animalTitulo': 'Registar o primeiro animal',
  'tutorial.animalDescricao': 'Basta a espécie, o sexo e a idade: o resto fica para depois.',
  'tutorial.animalDetalhe':
    'Comece por um animal só, para ver como é. Não precisa de ter tudo à mão: a espécie, o sexo e a data de nascimento chegam para o registar, e o brinco, a raça, a fotografia e o terreno acrescentam-se quando quiser. Se já tiver o efetivo escrito num ficheiro Excel, pode importá-lo todo de uma vez em vez de o escrever à mão.',
  'tutorial.animalAcao': 'Registar um animal',

  'tutorial.avisosTitulo': 'Ligar os avisos no telemóvel',
  'tutorial.avisosDescricao':
    'Para os prazos legais o avisarem a tempo, mesmo com a app fechada.',
  'tutorial.avisosDetalhe':
    'A app conta os prazos por si (identificar um vitelo, comunicar ao SNIRA, a próxima vacinação), mas só o consegue chamar se lhe der autorização. Com os avisos ligados, o recado aparece no ecrã do telemóvel no dia certo, mesmo que não abra a app nessa semana.',
  'tutorial.avisosAcao': 'Ligar os avisos',

  'tutorial.financasTitulo': 'Ligar a gestão do dinheiro',
  'tutorial.financasDescricao': 'Só se quiser apontar despesas e vendas na app.',
  'tutorial.financasDetalhe':
    'Ligando a gestão financeira, passa a poder apontar o que gasta (ração, veterinário, rendas) e o que recebe (vendas, leite, subsídios), e a app mostra-lhe o saldo da exploração e quanto lhe custou cada animal. Se não a ligar, nada de dinheiro aparece na app. Pode ligar e desligar quando quiser: desligar esconde, não apaga.',
  'tutorial.financasAcao': 'Ver a gestão do dinheiro',

  /* ---- O que se comunica ao SNIRA (só o texto dos avisos: a exportação
         para o iDigital continua em português, ver `alertas.ts`) ---- */
  'snira.nascimento': 'nascimento',
  'snira.morte': 'morte',
  'snira.saida': 'saída',
  'snira.entrada': 'entrada',
  'snira.movimentacao': 'movimentação',

  /* ---- Cada aviso que a app calcula (`data/alertas.ts`) ---- */
  'aviso.idAtrasoTitulo': 'Identificação em atraso',
  'aviso.idTitulo': 'Falta identificar (brinco)',
  'aviso.idAtrasoDesc':
    '{rotulo} devia estar identificado. Prazo excedido há {n} dia.|{rotulo} devia estar identificado. Prazo excedido há {n} dias.',
  'aviso.idDesc':
    '{rotulo} tem {idade}. Colocar brinco em {n} dia.|{rotulo} tem {idade}. Colocar brinco em {n} dias.',

  'aviso.sniraAtrasoTitulo': 'Comunicação SNIRA em atraso',
  'aviso.sniraNascTitulo': 'Comunicar ao SNIRA',
  'aviso.sniraNascAtrasoDesc':
    '{rotulo}: nascimento por comunicar ao SNIRA. Prazo excedido há {n} dia.|{rotulo}: nascimento por comunicar ao SNIRA. Prazo excedido há {n} dias.',
  'aviso.sniraNascDesc':
    '{rotulo}: comunicar nascimento ao SNIRA em {n} dia.|{rotulo}: comunicar nascimento ao SNIRA em {n} dias.',
  'aviso.sniraEvTitulo': 'Comunicar {oQue} ao SNIRA',
  'aviso.sniraEvAtrasoDesc':
    '{rotulo}: {oQue} de {data} por comunicar. Prazo excedido há {n} dia.|{rotulo}: {oQue} de {data} por comunicar. Prazo excedido há {n} dias.',
  'aviso.sniraEvDesc':
    '{rotulo}: comunicar {oQue} de {data} em {n} dia.|{rotulo}: comunicar {oQue} de {data} em {n} dias.',

  'aviso.partoConfirmarTitulo': 'Parto previsto por confirmar',
  'aviso.partoConfirmarDesc':
    '{rotulo}: a data prevista de parto já passou há mais de {dias} dias. Registe o parto ou corrija a previsão.',
  'aviso.partoTitulo': 'Parto previsto',
  'aviso.partoAtrasoDesc':
    '{rotulo} passou a data prevista de parto há {n} dia.|{rotulo} passou a data prevista de parto há {n} dias.',
  'aviso.partoDesc':
    '{rotulo} está próxima do parto ({n} dia).|{rotulo} está próxima do parto ({n} dias).',

  'aviso.segurancaTitulo': 'Período de segurança',
  'aviso.segurancaDesc':
    '{rotulo}: em intervalo de segurança, não vender para abate (falta {n} dia).|{rotulo}: em intervalo de segurança, não vender para abate (faltam {n} dias).',

  'aviso.revacinarAtrasoTitulo': 'Revacinação em atraso',
  'aviso.revacinarTitulo': 'Revacinação a aproximar-se',
  'aviso.revacinarAtrasoDesc':
    '{rotulo}: passou cerca de 1 ano da última vacinação. Prazo excedido há {n} dia.|{rotulo}: passou cerca de 1 ano da última vacinação. Prazo excedido há {n} dias.',
  'aviso.revacinarDesc':
    '{rotulo}: revacinar em {n} dia (última há {desde} dias).|{rotulo}: revacinar em {n} dias (última há {desde} dias).',
  'aviso.semVacinacaoTitulo': 'Sem registo de vacinação',
  'aviso.semVacinacaoDesc':
    '{rotulo} não tem nenhuma vacinação registada. Registe a última para acompanhar o plano.',

  'aviso.diagRepetirTitulo': 'Diagnóstico por repetir',
  'aviso.diagTitulo': 'Diagnóstico de gestação em falta',
  'aviso.diagRepetirDesc':
    '{rotulo}: o diagnóstico ficou por confirmar há {n} dia. Repetir.|{rotulo}: o diagnóstico ficou por confirmar há {n} dias. Repetir.',
  'aviso.diagDesc':
    '{rotulo}: coberta há {n} dia e ainda sem diagnóstico. Confirme se está gestante.|{rotulo}: coberta há {n} dias e ainda sem diagnóstico. Confirme se está gestante.',
  'aviso.semCobricaoTitulo': 'Sem cobrição desde o parto',
  'aviso.semCobricaoDesc':
    '{rotulo}: pariu há {n} dia e não voltou a ser coberta. Cada dia parada adia o parto seguinte.|{rotulo}: pariu há {n} dias e não voltou a ser coberta. Cada dia parada adia o parto seguinte.',

  'aviso.comLote': '{nome} (lote {lote})',
  'aviso.foraValidadeTitulo': 'Medicamento fora de validade',
  'aviso.foraValidadeDesc':
    '{nome}: a validade passou há {n} dia e ainda há existências. Não administrar.|{nome}: a validade passou há {n} dias e ainda há existências. Não administrar.',
  'aviso.validadeATerminarTitulo': 'Validade a terminar',
  'aviso.validadeATerminarDesc':
    '{nome}: expira em {n} dia. Gaste este lote antes dos outros.|{nome}: expira em {n} dias. Gaste este lote antes dos outros.',
  'aviso.aAcabarTitulo': 'Existências a acabar',
  'aviso.aAcabarDesc': '{nome}: restam {resta} {unidade} de {total}.',

  /* ---- Fase reprodutiva de uma fêmea (`data/reproducao.ts`) ---- */
  'fase.gestante': 'Gestante',
  'fase.gestanteExplicacao': 'Confirmada prenhe.',
  'fase.coberta': 'Coberta',
  'fase.cobertaExplicacao': 'Coberta, à espera de diagnóstico.',
  'fase.duvidosa': 'Por confirmar',
  'fase.duvidosaExplicacao': 'Diagnóstico inconclusivo: repetir.',
  'fase.vazia': 'Vazia',
  'fase.vaziaExplicacao': 'Não está prenhe.',
  'fase.naoAplicavel': 'Não se aplica',
  'fase.naoAplicavelExplicacao': 'Não entra na gestão reprodutiva.',

  /* ---- Ecrã da Reprodução ---- */
  'repro.subtituloVazio': 'O ciclo das fêmeas do efetivo',
  'repro.femeasEmIdade':
    '{n} fêmea em idade de reprodução|{n} fêmeas em idade de reprodução',
  'repro.prestesAParir': 'Prestes a parir',
  'repro.prestesAParirVazio': 'Nenhuma fêmea com parto previsto para o próximo mês.',
  'repro.aguardaDiagnostico': 'À espera de diagnóstico',
  'repro.aguardaDiagnosticoVazio':
    'Nenhuma fêmea coberta há mais de {dias} dias sem diagnóstico.',
  'repro.paradas': 'Sem cobrição desde o parto',
  'repro.paradasVazio': 'Nenhuma fêmea parida há mais de {dias} dias por cobrir.',
  'repro.vazioTitulo': 'Ainda não há fêmeas para acompanhar',
  'repro.vazioMensagem':
    'Assim que houver fêmeas em idade de reprodução no efetivo, esta página mostra quem está prenhe, quem falta diagnosticar e quem está parada desde o parto.',
  'repro.gestantes': 'Gestantes',
  'repro.cobertas': 'Cobertas',
  'repro.vazias': 'Vazias',
  'repro.taxaGestacao': 'TAXA DE GESTAÇÃO',
  'repro.intervaloPartos': 'INTERVALO ENTRE PARTOS',
  'repro.semDoisPartos': 'Ainda sem dois partos registados',
  'repro.passouPrevisao':
    'Passou a data prevista há {n} dia|Passou a data prevista há {n} dias',
  'repro.faltam': 'Falta {n} dia|Faltam {n} dias',
  'repro.cobertaHa': 'Coberta há {n} dia|Coberta há {n} dias',
  'repro.diagInconclusivo':
    'Diagnóstico inconclusivo há {n} dia|Diagnóstico inconclusivo há {n} dias',
  'repro.pariuHa': 'Pariu há {n} dia|Pariu há {n} dias',
  'repro.nPartos': '{n} parto|{n} partos',
  'repro.registar': 'Registar',
  'repro.registarEm': 'Registar {acao} em {nome}',
  'repro.registarCobricao': 'Registar cobrição',
  'repro.cobricao': 'Cobrição',
  'repro.diagnostico': 'Diagnóstico',

  /* ---- Ecrã das Existências ---- */
  'existencias.subtitulo': 'Medicamentos e vacinas na arrecadação',
  'existencias.nLotesRegistados': '{n} lote registado|{n} lotes registados',
  'existencias.nLotes': '{n} lote|{n} lotes',
  'existencias.aTratar': 'A tratar',
  'existencias.disponivel': 'Disponível',
  'existencias.foraDeUso': 'Fora de uso',
  'existencias.introTitulo': 'Para que serve este separador',
  'existencias.intro1':
    'Dê entrada de cada frasco ou caixa que compra, com o lote e a validade. Uma linha por compra: se comprar outro do mesmo, é outra linha.',
  'existencias.intro2':
    'Ao registar uma vacina ou um medicamento na ficha de um animal, escolha o lote de onde saiu e a app desconta sozinha o que gastou.',
  'existencias.intro3':
    'A app avisa quando um lote está a acabar e quando a validade se aproxima, para não descobrir isso com o animal já preso no tronco.',
  'existencias.intro4':
    'É também o registo de medicamentos que a lei obriga a ter. Do computador, sai em Excel para levar a uma inspeção.',
  'existencias.exportar': 'Exportar registo de medicamentos',
  'existencias.registoMedicamentos': 'Registo de medicamentos',
  'existencias.descarregado': 'Ficheiro descarregado',
  'existencias.semDescarga': 'Não foi possível descarregar',
  'existencias.vazioTitulo': 'Arrecadação vazia',
  'existencias.vazioPodeGerir':
    'Dê entrada dos medicamentos e vacinas que tem. Depois, ao registar um tratamento, escolhe o lote e a app desconta o que gastou.',
  'existencias.vazioSemPermissao':
    'Ainda não há medicamentos registados nesta exploração. Quem a gere é que lhes pode dar entrada.',
  'existencias.darEntrada': 'Dar entrada',
  'existencias.foraDeValidade': 'Fora de validade',
  'existencias.esgotado': 'Esgotado',
  'existencias.expiraEm': 'Expira em {n} dia|Expira em {n} dias',
  'existencias.aAcabar': 'A acabar',
  'existencias.lote': 'Lote {lote}',
  'existencias.semLote': 'Sem lote',
  'existencias.validade': 'validade {data}',
  'existencias.restamDe': 'Restam {resta} de {total}',
  'existencias.seguranca': 'segurança {n} dia|segurança {n} dias',

  /* ---- Ecrã dos Terrenos ---- */
  'terrenos.subtitulo': 'Onde o gado anda',
  'terrenos.contagem': '{n} terreno|{n} terrenos',
  'terrenos.vazioTitulo': 'Sem terrenos',
  'terrenos.vazioSemExploracao':
    'Os terrenos pertencem a uma exploração. Crie primeiro a sua exploração e depois registe aqui as pastagens e os cercados.',
  'terrenos.vazioPodeCriar':
    'Registe as pastagens, os cercados e os currais onde o gado anda. Depois pode dizer em que terreno está cada animal e ver, de uma olhadela, quantos estão em cada sítio.',
  'terrenos.vazioSemPermissao':
    'Ainda não há terrenos registados nesta exploração. Quem a gere é que os pode registar.',
  'terrenos.grupoVazio': 'Esta exploração ainda não tem terrenos registados.',
  'terrenos.novo': 'Novo terreno',
  'terrenos.novoCurto': 'NOVO',
  'terrenos.novoEm': 'Novo terreno em {nome}',
  'terrenos.semTipo': 'Sem tipo',
  'terrenos.nAnimais': '{n} animal|{n} animais',

  /* ---- Ecrã dos Documentos ---- */
  'docs.subtitulo': 'Guardar papéis, importar, exportar e as suas notas',
  'docs.subtituloSemAcesso': 'Importar, exportar e as suas notas',
  'docs.semAcessoTitulo': 'Documentos reservados à exploração',
  'docs.semAcessoMensagem':
    'Importar e exportar o efetivo é de quem tem a exploração a cargo. Pode continuar a consultar os animais e a registar o que fizer a cada um.',
  'docs.introTitulo': 'Para que serve este separador',
  'docs.intro1':
    'Guarde aqui os papéis que recebe: fotografe a fatura da ração, a guia de circulação ou o recibo do veterinário e ficam arrumados por gaveta, na exploração e não no telemóvel.',
  'docs.intro2':
    'Se já tem os animais escritos num ficheiro Excel, pode trazê-los todos de uma vez em vez de os escrever um a um.',
  'docs.intro3':
    'Daqui também leva os seus dados para fora: a lista de animais em Excel, e relatórios de prazos para imprimir ou entregar.',
  'docs.intro4':
    'As notas são suas e só suas: servem para o que não cabe na ficha de um animal, como combinações, telefones ou o que ficou por fazer.',
  'docs.intro5':
    'Importar e exportar ficheiros só funciona no computador. Guardar documentos e as notas funcionam também no telemóvel.',
  'docs.grupoObrigacoes': 'OBRIGAÇÕES',
  'docs.comunicarSnira': 'Comunicar ao SNIRA',
  'docs.emDia': 'em dia',
  'docs.grupoImportar': 'IMPORTAR',
  'docs.importarAnimais': 'Importar animais de Excel',
  'docs.grupoExportar': 'EXPORTAR E RELATÓRIOS',
  'docs.exportarAnimais': 'Exportar animais (Excel)',
  'docs.exportarEventos': 'Exportar eventos (Excel)',
  'docs.eventos': 'Eventos',
  'docs.nRegistos': '{n} registo|{n} registos',
  'docs.relatorioPrazos': 'Relatório de prazos (imprimir ou PDF)',
  'docs.soNoComputador': 'Ficheiros são do computador',
  'docs.soNoComputadorDetalhe':
    'Exportar para Excel, imprimir e guardar relatórios em PDF faz-se na app de computador ou no site da app: é lá que há onde guardar os ficheiros.',
  'docs.descarregado': 'Ficheiro descarregado',
  'docs.semDescarga': 'Não foi possível descarregar',

  /* ---- Notas ---- */
  'notas.titulo': 'NOTAS',
  'notas.uma': 'Nota',
  'notas.vazio':
    'Ainda não tem notas. Guarde aqui o que precisar de ter à mão: contactos, lembretes, o que quiser.',
  'notas.nova': 'Nova nota',
  'notas.editar': 'Editar nota',
  'notas.guardar': 'Guardar nota',
  'notas.guardada': 'Nota guardada',
  'notas.criada': 'Nota criada',
  'notas.eliminada': 'Nota eliminada',
  'notas.eliminarTitulo': 'Eliminar nota',
  'notas.semTitulo': 'Sem título',
  'notas.tituloOpcional': 'Título (opcional)',
  'notas.placeholder': 'Escreva a sua nota…',
  'notas.vaziaTitulo': 'Nota vazia',
  'notas.vaziaMensagem': 'Escreva alguma coisa antes de guardar.',
  'notas.semGravacao': 'Não foi possível guardar',
  'notas.precisamLigacao': 'As notas precisam de ligação para gravar.',

  /* ---- Ecrã de entrada ---- */
  'login.entrarNaConta': 'Entrar na sua conta',
  'login.criarConta': 'Criar a sua conta',
  'login.recuperarAcesso': 'Recuperar o acesso',
  'login.oQueVeioFazer': 'O que veio cá fazer?',
  'login.nome': 'Nome',
  'login.nomePlaceholder': 'O seu nome',
  'login.email': 'Email',
  'login.emailPlaceholder': 'nome@exemplo.pt',
  'login.palavraPasse': 'Palavra-passe',
  'login.palavraPassePlaceholder': 'Mínimo 6 caracteres',
  'login.explicacaoRecuperar':
    'Enviamos-lhe um email com um link para definir uma nova palavra-passe.',
  'login.esqueciMe': 'Esqueci-me da palavra-passe',
  'login.recuperadoAviso':
    'Se existir uma conta com este email, enviámos um link para redefinir a palavra-passe. Verifique a caixa de entrada.',
  'login.contaCriadaComCodigo':
    'Conta criada. Enviámos um email de confirmação: confirme, entre, e use o código de convite que lhe deram.',
  'login.contaCriada': 'Conta criada. Enviámos um email de confirmação: confirme e depois entre.',
  'login.enviarLink': 'Enviar link de recuperação',
  'login.criarContaBotao': 'Criar conta',
  'login.entrar': 'Entrar',
  'login.voltarAEntrar': 'Voltar a entrar',
  'login.jaTemConta': 'Já tem conta?',
  'login.aindaNaoTemConta': 'Ainda não tem conta?',

  /* ---- O que a pessoa vem cá fazer (`data/intencao.ts`) ---- */
  'intencao.dono': 'Dono de exploração',
  'intencao.donoDescricao':
    'Tenho animais meus para registar. A conta é aprovada pelo administrador.',
  'intencao.trabalhador': 'Trabalhador',
  'intencao.trabalhadorDescricao':
    'Trabalho numa exploração de outra pessoa. Entro com um código de convite.',
  'intencao.veterinario': 'Veterinário',
  'intencao.veterinarioDescricao':
    'Presto assistência a explorações. Entro com um código de convite.',

  /* ---- Folha de filtros da lista de animais ---- */
  'filtro.titulo': 'Filtrar animais',
  'filtro.fecharFiltros': 'Fechar filtros',
  'filtro.especie': 'Espécie',
  'filtro.sexo': 'Sexo',
  'filtro.femeas': 'Fêmeas',
  'filtro.machos': 'Machos',
  'filtro.cobricao': 'Cobrição',
  'filtro.cobertas': 'Cobertas',
  'filtro.naoCobertas': 'Não cobertas',
  'filtro.idade': 'Idade',
  'filtro.raca': 'Raça',
  'filtro.cor': 'Cor da pelagem',
  'filtro.finalidade': 'Finalidade',
  'filtro.terreno': 'Terreno',
  'filtro.semTerreno': 'Sem terreno',
  'filtro.todos': 'Todos',
  'filtro.outros': 'Outros',
  'filtro.comAlertas': 'Com alertas',
  'filtro.comArquivo': 'Com arquivo',
  'filtro.incluirArquivo': 'Incluir arquivo ({n})',
  'filtro.nadaParaAfinar': 'Não há mais nada para afinar nesta lista.',
  'filtro.nenhumCorresponde': 'Nenhum animal corresponde',
  'filtro.verN': 'Ver {n} animal|Ver {n} animais',

  /* ---- Faixas etárias ---- */
  'faixa.cria': 'Até 6 meses',
  'faixa.jovem': '6 meses a 2 anos',
  'faixa.adulto': '2 a 8 anos',
  'faixa.velho': 'Mais de 8 anos',

  /* ---- Categorias de alerta (chips do filtro) ---- */
  'categoria.identificacao': 'Identificação',
  'categoria.snira': 'SNIRA',
  'categoria.parto': 'Partos',
  'categoria.reproducao': 'Reprodução',
  'categoria.medicamento': 'Medicamentos',
  'categoria.vacinacao': 'Vacinação',
  'categoria.existencias': 'Existências',

  /* ---- Papéis de quem entra numa exploração ---- */
  'papel.dono': 'Dono',
  'papel.trabalhador': 'Trabalhador',
  'papel.veterinario': 'Veterinário',
  'papel.emExploracao': '{papel} em {nome}',
  'papel.emNExploracoes': '{papel} em {n} exploração|{papel} em {n} explorações',

  /* ---- Ecrã do Perfil ---- */
  'perfil.nExploracoes': '{n} explor.|{n} explor.',
  'perfil.tipoDeConta': 'Tipo de conta',
  'perfil.administrador': 'Administrador da plataforma',
  'perfil.criador': 'Criador',
  'perfil.oSeuPapel': 'O seu papel',
  'perfil.osSeusPapeis': 'Os seus papéis',
  'perfil.semExploracao': 'Sem exploração associada',
  'perfil.estado': 'Estado',
  'perfil.porAprovar': 'Por aprovar (só de leitura)',
  'perfil.editarDados': 'Editar dados pessoais',
  'perfil.terminarSessao': 'Terminar sessão',
  'perfil.apagarConta': 'Apagar a minha conta',
  'perfil.abrirDefinicoes': 'Abrir definições',
  'perfil.opcoesEmDefinicoes': 'As opções da app estão em Definições',
  'perfil.mudarFoto': 'Mudar a sua fotografia',
  'perfil.escolherFoto': 'Escolher uma fotografia para si',
  'perfil.aSuaFotografia': 'A sua fotografia',
  'perfil.assuntoFoto': 'da sua conta',
  'perfil.fotoSoSua':
    'Por agora a fotografia é só sua: aparece aqui no Perfil e mais ninguém a vê.',
  'perfil.fotoGuardada': 'Fotografia guardada',
  'perfil.fotoRemovida': 'Fotografia removida',
  'perfil.fotoSemGravar': 'Não foi possível guardar a fotografia',
  'perfil.porEnviarTitulo': 'Ainda há alterações por enviar',
  'perfil.porEnviarMensagem':
    'Tem {n} alteração guardada neste aparelho que ainda não chegou ao servidor. Se terminar sessão agora, perde-se. Ligue-se à internet e espere pela sincronização, ou termine sessão à mesma.|Tem {n} alterações guardadas neste aparelho que ainda não chegaram ao servidor. Se terminar sessão agora, perdem-se. Ligue-se à internet e espere pela sincronização, ou termine sessão à mesma.',
  'perfil.sairAMesma': 'Terminar à mesma',

  /* ---- Ecrã dos Trabalhadores ---- */
  'equipa.subtitulo': 'Quem trabalha nas suas explorações',
  'equipa.atualizar': 'Atualizar',
  'equipa.atualizarLista': 'Atualizar lista',
  'equipa.exploracao': 'Exploração',
  'equipa.introTitulo': 'Para que serve este separador',
  'equipa.intro1':
    'Aqui estão as pessoas a quem deu acesso à sua exploração: trabalhadores e veterinários. Quem não está nesta lista não vê nada do que registou.',
  'equipa.intro2':
    'Convida-se com um código: a pessoa instala a app, escreve o código e fica logo ligada à sua exploração, sem precisar de saber a sua palavra-passe.',
  'equipa.intro3':
    'Cada um só mexe no que lhe compete: o trabalhador aponta o que faz no dia a dia, o veterinário regista tratamentos.',
  'equipa.intro4':
    'Toque numa pessoa para ver e mudar ao certo o que ela pode alterar. Ao veterinário pode dar acesso até ao dia e hora que quiser, findos os quais ele sai sozinho.',
  'equipa.intro5':
    'No registo de alterações vê o que cada um mexeu e a que horas: quem registou um animal, quem mudou um terreno, quem lançou uma despesa.',
  'equipa.semCarregar': 'Não foi possível carregar a equipa',
  'equipa.aCarregarEquipa': 'A carregar a equipa…',
  'equipa.nTrabalhadores': '{n} trabalhador|{n} trabalhadores',
  'equipa.nVeterinarios': '{n} veterinário|{n} veterinários',
  'equipa.nDonos': '{n} dono|{n} donos',
  'equipa.semEquipaTitulo': 'Sem equipa para gerir',
  'equipa.semEquipaMensagem':
    'Só o dono de uma exploração vê e convida a equipa. Se entrou por convite, fale com quem o convidou.',
  'equipa.vazioTitulo': 'Ainda não tem trabalhadores',
  'equipa.vazioMensagem':
    'Convide alguém com um código: ele entra na app e fica logo ligado à sua exploração, a ver os animais e a registar o que faz.',
  'equipa.convidarAlguem': 'Convidar alguém',
  'equipa.convidarPara': 'Convidar para {nome}',
  'equipa.convidarTrabalhadorOuVet': 'Convidar trabalhador ou veterinário',
  'equipa.toqueNumaPessoa': 'Toque numa pessoa para escolher o que ela pode alterar na app.',
  'equipa.toqueNaExploracao':
    'Para convidar ou remover numa exploração à escolha, toque nela em cima.',
  'equipa.consultar': 'CONSULTAR',
  'equipa.verRegistoAlteracoes': 'Ver o registo de alterações',
  'equipa.verQuemCaEsteve': 'Ver quem já cá esteve',
  'equipa.toqueParaPermissoes': 'Toque para escolher o que esta pessoa pode alterar',
  'equipa.permissoesGuardadas': 'Permissões guardadas',
  'equipa.permissoesAjustadas': 'Permissões ajustadas',
  'equipa.prazoNaoMudou': 'O tempo de acesso não mudou',
  'equipa.acessoSemPrazo': 'Acesso sem prazo',
  'equipa.acessoTerminado': 'Acesso terminado',
  'equipa.acessoProlongado': 'Acesso prolongado',
  'equipa.acessoMarcado': 'Acesso marcado',
  'equipa.ate': 'até {quando}',

  /* ---- Ecrã das Finanças ---- */
  'financas.legenda': 'Despesas, receitas e o saldo da exploração',
  'financas.movimentos': 'Movimentos',
  'financas.animalRemovido': 'Animal removido',
  'financas.semExportar': 'Não foi possível exportar',
  'financas.desligadaTitulo': 'Gestão financeira desligada',
  'financas.desligadaMensagem':
    'Esta conta não usa a app para registar despesas e receitas. Quem gere a exploração pode ligá-la em Perfil, Gestão financeira.',
  'financas.reservadasTitulo': 'Contas reservadas ao dono',
  'financas.reservadasMensagem':
    'As receitas e o balanço da exploração só podem ser consultados por quem a gere. Pode continuar a registar as despesas que fizer.',
  'financas.registarDespesa': 'Registar despesa',
  'financas.registarMovimento': 'Registar movimento',
  'financas.introTitulo': 'Para que serve este separador',
  'financas.intro1':
    'Aqui aponta o que gasta (ração, veterinário, rendas) e o que recebe (vendas, leite, subsídios). A app faz a conta e mostra-lhe o saldo.',
  'financas.intro2':
    'Cada despesa pode ficar ligada a um animal ou a um terreno: é assim que depois se sabe quanto custou cada um.',
  'financas.intro3':
    'Os totais em cima são do período que escolher; com mais do que uma exploração, escolha primeiro qual.',
  'financas.intro4':
    'O dinheiro é opcional e pode desligá-lo em Perfil, Gestão financeira. Desligar esconde, não apaga.',
  'financas.vazioTitulo': 'Ainda sem movimentos',
  'financas.vazioMensagem':
    'Registe o que gasta em ração, energia ou vacinas, e o que recebe das vendas. O resumo aparece aqui.',
  'financas.semMovimentosMes': 'Sem movimentos neste mês',
  'financas.semMovimentosAno': 'Sem movimentos neste ano',
  'financas.em': 'em {nome}',
  'financas.escolhaOutroPeriodo': 'Escolha outro período para ver o histórico.',
  'financas.escolhaOutroOuExploracao':
    'Escolha outro período ou outra exploração para ver o histórico.',
  'financas.vendasSemPreco': '{n} venda sem preço|{n} vendas sem preço',
  'financas.vendasSemPrecoDetalhe':
    'Alguém registou a saída do animal mas não o valor. As receitas abaixo estão incompletas até as fechar.',
  'financas.saldo': 'Saldo (receitas menos despesas)',
  'financas.saldoCurto': 'Saldo',
  'financas.receitas': 'Receitas',
  'financas.despesas': 'Despesas',
  'financas.ultimos6Meses': 'Últimos 6 meses',
  'financas.paraOndeVai': 'Para onde vai o dinheiro',
  'financas.deOndeVem': 'De onde vem o dinheiro',
  'financas.animaisQueMaisPesam': 'Animais que mais pesam',
  'financas.verUltimos': 'Ver o último|Ver os últimos {n}',
  'financas.verMaisFaltam': 'Ver mais {n} (faltam {faltam})',
  'financas.historicoRegistos': 'Histórico de registos',
  'financas.exportarExcel': 'Exportar para Excel',
  'financas.exportaPeriodo': 'Exporta o que está a ver: o período.',
  'financas.exportaPeriodoEExploracao': 'Exporta o que está a ver: o período e {nome}.',
  'financas.excelSoNoComputador': 'Exportar as contas para Excel faz-se na app de computador.',
  'financas.semRegistosNesteMes': 'Sem registos neste mês.',
  'financas.toqueNumMes': 'Toque num mês para ver os valores desse mês.',
  'financas.esteMes': 'Este mês',
  'financas.esteAno': 'Este ano',
  'financas.tudo': 'Tudo',
  'financas.mesDeAno': '{mes} de {ano}',

  /* ---- Formulário do animal ---- */
  'formAnimal.novo': 'Novo animal',
  'formAnimal.editar': 'Editar animal',
  'formAnimal.ajudaNovo': 'Preencha o essencial. Pode completar os restantes dados mais tarde.',
  'formAnimal.ajudaEditar': 'Altere o que precisar e guarde no fim.',
  'formAnimal.hoje': 'Hoje',
  'formAnimal.ontem': 'Ontem',
  'formAnimal.ha1Semana': 'Há 1 semana',
  'formAnimal.cerca1Ano': 'cerca de 1 ano',
  'formAnimal.cerca2Anos': 'cerca de 2 anos',
  'formAnimal.cerca5Anos': 'cerca de 5 anos',
  'formAnimal.dataNascimento': 'Data de nascimento',
  'formAnimal.ouDataExata': 'Ou data exata (dd/mm/aaaa), útil para animais já crescidos',
  'formAnimal.exData': 'Ex: 15/03/2021',
  'formAnimal.calendarioNascimento': 'Escolher a data de nascimento no calendário',
  'formAnimal.dataInvalidaNaoFutura':
    'Data inválida. Use o formato dd/mm/aaaa e uma data não futura.',
  'formAnimal.dataInvalida': 'Data inválida. Use o formato dd/mm/aaaa.',
  'formAnimal.nome': 'Nome',
  'formAnimal.exNome': 'Ex: Mimosa',
  'formAnimal.brinco': 'Nº de brinco (SIA)',
  'formAnimal.exBrinco': 'PT 0000 0000 0000',
  'formAnimal.semBrincoAviso':
    'Se deixar vazio, criamos um alerta para identificar até aos 20 dias.',
  'formAnimal.comunicadoSnira': 'Nascimento comunicado ao SNIRA?',
  'formAnimal.jaComunicado': 'Já comunicado',
  'formAnimal.porComunicar': 'Por comunicar',
  'formAnimal.estaPrenhe': 'Está prenhe?',
  'formAnimal.sim': 'Sim',
  'formAnimal.nao': 'Não',
  'formAnimal.dataCobricaoAjuda': 'Data da cobrição (dd/mm/aaaa): calculamos o parto por si',
  'formAnimal.exDataCobricao': 'Ex: 10/02/2026',
  'formAnimal.calendarioCobricao': 'Escolher a data da cobrição no calendário',
  'formAnimal.ouDataParto': 'Ou, se já souber a data do parto, escreva-a aqui',
  'formAnimal.exDataParto': 'Ex: 20/11/2026',
  'formAnimal.calendarioParto': 'Escolher a data prevista do parto no calendário',
  'formAnimal.partoPrevisto': 'Parto previsto: {data}',
  'formAnimal.daquiA': 'daqui a {n} dia|daqui a {n} dias',
  'formAnimal.indiqueUmaData': 'Indique uma das datas para o podermos avisar do parto.',
  'formAnimal.escolherRaca': 'Escolher raça',
  'formAnimal.usarRaca': 'Usar a raça',
  'formAnimal.escolherCor': 'Escolher cor',
  'formAnimal.usarCor': 'Usar a cor',
  'formAnimal.numero': 'Número',
  'formAnimal.exNumero': 'Ex: 12',
  'formAnimal.exploracao': 'Exploração',
  'formAnimal.semExploracoes':
    'Ainda não tem explorações. Crie uma exploração antes de registar animais.',
  'formAnimal.escolhaExploracao': 'Escolha uma exploração para o animal.',
  'formAnimal.genealogia': 'Genealogia',
  'formAnimal.genealogiaAjuda':
    'Só aparecem animais da mesma exploração e espécie com idade suficiente à data do nascimento.',
  'formAnimal.mae': 'Mãe',
  'formAnimal.pai': 'Pai',
  'formAnimal.semFemeas': 'Não há fêmeas elegíveis registadas.',
  'formAnimal.semMachos': 'Não há machos elegíveis registados.',
  'formAnimal.procurarAnimal': 'Procurar por nome ou brinco',
  'formAnimal.maisNaProcura': 'Mais {n}. Use a procura para encontrar.',
  'formAnimal.nenhumCorresponde': 'Nenhum animal corresponde a "{procura}".',
  'formAnimal.guardarAnimal': 'Guardar animal',
  'formAnimal.guardarAlteracoes': 'Guardar alterações',
  'formAnimal.guardado': 'Animal guardado',
  'formAnimal.registado': 'Animal registado',
  'formAnimal.semGuardar': 'Animal não guardado',
  'formAnimal.semRegistar': 'Animal não registado',
  'formAnimal.eliminado': 'Animal eliminado',
  'formAnimal.eliminarAnimal': 'Eliminar animal',
  'formAnimal.eliminarPergunta': 'Eliminar "{rotulo}"? Esta ação não pode ser anulada.',
  'formAnimal.eliminarExplicacao':
    'O animal sai da lista e da árvore genealógica: eliminar quer dizer que foi registado por engano. O registo fica guardado no histórico do efetivo, com o dia e o nome de quem o eliminou.',
  'formAnimal.eliminarAjuda':
    'Para registos feitos por engano. Tira o animal da lista e da árvore genealógica, para sempre. Se o animal existiu mesmo, marque a saída (falecido ou vendido) em vez de eliminar.',
  'formAnimal.animalEliminado': 'Animal eliminado',
  'formAnimal.naoSeAltera': 'Este registo já não se altera',
  'formAnimal.eliminadoMensagem':
    'O animal foi eliminado da lista, e o registo fica como está, com o dia e o nome de quem o eliminou. Pode vê-lo no Histórico do efetivo.',
  'formAnimal.fichaDoGestor': 'A ficha é de quem gere o efetivo',
  'formAnimal.fichaDoGestorEditar':
    'Pode registar o que fizer a este animal (uma vacina, um medicamento, um parto), mas os dados da ficha são alterados por quem tem a exploração a cargo.',
  'formAnimal.fichaDoGestorNovo':
    'Registar animais novos é de quem tem a exploração a cargo. Pode registar tratamentos nos animais que já lá estão.',

  /* ---- Ficha do animal ---- */
  'ficha.animal': 'Animal',
  'ficha.naoEncontrado': 'Animal não encontrado',
  'ficha.jaNaoExiste': 'Este registo já não existe.',
  'ficha.dataInvalida': 'Data inválida: use o formato dd/mm/aaaa.',
  'ficha.vendaRegistada': 'Venda registada',
  'ficha.morteRegistada': 'Morte registada',
  'ficha.saidaNaoRegistada': 'Saída não registada',
  'ficha.reativarTitulo': 'Voltar a ativar?',
  'ficha.reativarMensagem':
    'O animal vai voltar a aparecer no efetivo. O evento anterior (Morte/Venda) permanece no histórico.',
  'ficha.reativar': 'Reativar',
  'ficha.reativado': 'Animal reativado',
  'ficha.semReativar': 'Não foi possível reativar',
  'ficha.falecido': 'Falecido',
  'ficha.vendido': 'Vendido',
  'ficha.eliminado': 'Eliminado',
  'ficha.saidaDoEfetivo': 'Saída do efetivo',
  'ficha.motivo': 'Motivo',
  'ficha.falecimento': 'Falecimento',
  'ficha.venda': 'Venda',
  'ficha.eliminadoDaLista': 'Eliminado da lista',
  'ficha.data': 'Data',
  'ficha.semData': 'Sem data',
  'ficha.registadoPor': 'Registado por',
  'ficha.alguemDaEquipa': 'Alguém da equipa',
  'ficha.nota': 'Nota',
  'ficha.eliminadoExplicacao':
    'O registo continua guardado: o histórico deste animal e a árvore genealógica dos descendentes ficam intactos. Só deixou de aparecer na lista de animais.',
  'ficha.saidaExplicacao':
    'O registo permanece guardado para preservar a árvore genealógica dos descendentes.',
  'ficha.identificacao': 'Identificação',
  'ficha.numeroIdentificacao': 'Nº de identificação (brinco)',
  'ficha.dataIdentificacao': 'Data de identificação',
  'ficha.naoIndicada': 'Não indicada',
  'ficha.comunicado': 'Comunicado',
  'ficha.naoSeAplica': 'Não se aplica',
  'ficha.nascimentoEGenealogia': 'Nascimento e genealogia',
  'ficha.racaPelagem': 'Raça / pelagem',
  'ficha.cobertaHa': 'Coberta há',
  'ficha.porConfirmarHa': 'Por confirmar há',
  'ficha.partos': 'Partos',
  'ficha.aindaNenhum': 'Ainda nenhum',
  'ficha.localizacao': 'Localização',
  'ficha.semExploracao': 'Sem exploração',
  'ficha.terrenoAtual': 'Terreno atual',
  'ficha.balanco': 'Balanço',
  'ficha.receitaVenda': 'Receita (venda)',
  'ficha.custos': 'Custos (compra, tratamentos)',
  'ficha.historico': 'Histórico',
  'ficha.semEventos': 'Ainda não há eventos registados para este animal.',
  'ficha.editarDados': 'Editar dados do animal',
  'ficha.registarEvento': 'Registar evento',
  'ficha.marcarSaida': 'Marcar como falecido / vendido',
  'ficha.voltarAAtivar': 'Voltar a ativar o animal',
  'ficha.eliminadoNaoSeAltera':
    'Este registo foi eliminado e já não se altera. Fica guardado como está, para o histórico e para a auditoria.',
  'ficha.marcarSaidaTitulo': 'Marcar saída do efetivo',
  'ficha.dataFormato': 'Data (dd/mm/aaaa)',
  'ficha.calendarioSaida': 'Escolher a data da saída no calendário',
  'ficha.precoVenda': 'Preço de venda (€), opcional',
  'ficha.exPreco': 'Ex.: 1350',
  'ficha.notaOpcional': 'Nota (opcional): comprador, matadouro, causa, etc.',
  'ficha.exNotaVenda': 'Ex.: vendido ao Sr. Silva',
  'ficha.exNotaMorte': 'Ex.: doença',
  'ficha.confirmar': 'Confirmar',
  'ficha.semRegisto': 'Sem registo',
  'ficha.verArvore': 'Ver árvore genealógica',
  'ficha.verArvoreComCrias':
    'Ver árvore genealógica ({n} cria)|Ver árvore genealógica ({n} crias)',

  /* ---- Registar um evento ---- */
  'evento.registarParto': 'Registar parto',
  'evento.partoRegistado': 'Parto registado',
  'evento.registarCobricao': 'Registar cobrição',
  'evento.cobricaoRegistada': 'Cobrição registada',
  'evento.registarDiagnostico': 'Registar diagnóstico',
  'evento.diagnosticoRegistado': 'Diagnóstico registado',
  'evento.registarVacina': 'Registar vacina',
  'evento.vacinaRegistada': 'Vacina registada',
  'evento.registarMedicamento': 'Registar medicamento',
  'evento.medicamentoRegistado': 'Medicamento registado',
  'evento.registarPesagem': 'Registar pesagem',
  'evento.pesagemRegistada': 'Pesagem registada',
  'evento.ha2Dias': 'Há 2 dias',
  'evento.naoGuardado': 'Registo não guardado',
  'evento.tenteNovamente': 'Tente novamente.',
  'evento.criaPorRegistar': 'Parto guardado, cria por registar',
  'evento.guardadoComFalhas': 'Guardado, com falhas',
  'evento.ficouRegistadoEm': 'Ficou registado em {n} animal.|Ficou registado em {n} animais.',
  'evento.naoFoiPossivelEm': 'Não foi possível em: {nomes}.',
  'evento.semPermissaoTitulo': 'Sem permissão para registar',
  'evento.semPermissaoMensagem':
    'Quem gere esta exploração não lhe deu acesso a registar tratamentos. Fale com essa pessoa se acha que é engano.',
  'evento.tipoDeRegisto': 'Tipo de registo',
  'evento.maeFemea': 'Mãe (fêmea)',
  'evento.femea': 'Fêmea',
  'evento.macho': 'Macho',
  'evento.nEscolhidos': '{n} escolhido|{n} escolhidos',
  'evento.semFemeas': 'Não há fêmeas registadas.',
  'evento.semAnimais': 'Ainda não há animais registados.',
  'evento.ouDataExata': 'Ou data exata (dd/mm/aaaa), para registar o que já aconteceu',
  'evento.exData': 'Ex: 15/03/2026',
  'evento.calendarioData': 'Escolher a data do registo no calendário',
  'evento.tipoDeParto': 'Tipo de parto',
  'evento.resultado': 'Resultado',
  'evento.nadoVivo': 'Nado-vivo',
  'evento.nadoMorto': 'Nado-morto',
  'evento.sexoDaCria': 'Sexo da cria',
  'evento.criaComoAnimalNovo':
    'Guardamos a cria como animal novo, com este sexo, a data do parto e a mãe já preenchidos.',
  'evento.criaViva':
    'A cria fica registada sozinha, por completar: acrescente-lhe o brinco até aos 20 dias e comunique o nascimento ao SNIRA. Se nasceram duas crias, registe dois partos.',
  'evento.umPartoPorCria': 'Um parto por cada cria: se nasceram duas, registe dois partos.',
  'evento.como': 'Como',
  'evento.escolhaTouroOuEscreva':
    'Escolha um acima ou escreva outro. Se não souber qual foi (manada com o touro à solta), deixe em branco.',
  'evento.touroDesconhecido':
    'Se não souber qual foi (manada com o touro à solta), deixe em branco.',
  'evento.partoPrevistoPara':
    'Parto previsto para {data}, contado a partir da cobrição de {cobricao}. Fica marcado na ficha e no calendário.',
  'evento.semCobricaoAnterior':
    'Não há cobrição registada antes desta data, por isso a app não consegue calcular o parto previsto. Registe a cobrição, ou escreva a data prevista na ficha do animal.',
  'evento.dataPartoApagada': 'A data prevista de parto que estava na ficha vai ser apagada.',
  'evento.veterinario': 'Veterinário',
  'evento.exVeterinario': 'Ex: Dr. Sousa',
  'evento.saiDoStock': 'Sai do stock',
  'evento.naoRegistar': 'Não registar',
  'evento.quantoSeGastou': 'Quanto se gastou, em {unidade}',
  'evento.restamNesteLote': 'Restam {resta} neste lote.',
  'evento.vacinaDoenca': 'Vacina / doença',
  'evento.exVacina': 'Ex: Língua azul',
  'evento.lote': 'Lote',
  'evento.exLote': 'Ex: 4471',
  'evento.proximaDose': 'Próxima dose',
  'evento.medicamento': 'Medicamento',
  'evento.exMedicamento': 'Ex: Antibiótico',
  'evento.dose': 'Dose',
  'evento.exDose': 'Ex: 20 ml',
  'evento.via': 'Via de administração',
  'evento.exMotivo': 'Ex: Mastite',
  'evento.intervaloSeguranca': 'Intervalo de segurança (dias)',
  'evento.naoVenderAte': 'Não vender para abate até {data}.',
  'evento.peso': 'Peso (kg)',
  'evento.exPeso': 'Ex: 520',
  'evento.custo': 'Custo (€)',
  'evento.custoPorAnimal': 'Custo por animal (€)',
  'evento.exCusto': 'Ex: 45',
  'evento.notas': 'Notas',
  'evento.exNotas': 'Observações (opcional)',
  'evento.guardarRegisto': 'Guardar registo',
  'evento.guardarEmNAnimais': 'Guardar em {n} animal|Guardar em {n} animais',

  /* ---- Formulário do terreno ---- */
  'formTerreno.terreno': 'Terreno',
  'formTerreno.editar': 'Editar terreno',
  'formTerreno.naoEncontrado': 'Terreno não encontrado',
  'formTerreno.criar': 'Criar terreno',
  'formTerreno.guardado': 'Terreno guardado',
  'formTerreno.adicionado': 'Terreno adicionado',
  'formTerreno.semGuardar': 'Terreno não guardado',
  'formTerreno.semAdicionar': 'Terreno não adicionado',
  'formTerreno.eliminado': 'Terreno eliminado',
  'formTerreno.eliminarTerreno': 'Eliminar terreno',
  'formTerreno.vaiEliminar': 'Vai eliminar "{nome}".',
  'formTerreno.ficamSemTerreno': 'O {n} animal fica sem terreno,|Os {n} animais ficam sem terreno,',
  'formTerreno.nenhumSePerde': 'Nenhum animal se perde:',
  'formTerreno.eliminarDetalhe':
    'nada é apagado além do próprio terreno. As despesas que lhe estavam imputadas continuam nas contas da exploração.',
  'formTerreno.semPermissaoTitulo': 'Os terrenos são de quem gere a exploração',
  'formTerreno.semPermissaoEditar':
    'Pode ver este terreno e os animais que lá andam, mas alterá-lo é de quem tem a exploração a cargo.',
  'formTerreno.semPermissaoNovo': 'Registar terrenos novos é de quem tem a exploração a cargo.',
  'formTerreno.semExploracoesTitulo': 'Sem explorações',
  'formTerreno.semExploracoesMensagem':
    'Crie primeiro uma exploração para poder adicionar terrenos.',
  'formTerreno.exploracaoE': 'Exploração: {nome}',
  'formTerreno.assuntoFoto': 'do terreno',
  'formTerreno.exNome': 'Ex: Lameiro Grande',
  'formTerreno.tipo': 'Tipo',
  'formTerreno.area': 'Área (hectares)',
  'formTerreno.exArea': 'Ex: 4.2',
  'formTerreno.descricao': 'Descrição',
  'formTerreno.exDescricao': 'Ex: Poço e bebedouro a norte',
  'formTerreno.localizacaoNoMapa': 'Localização no mapa',
  'formTerreno.toqueNoMapa': 'Toque no mapa para marcar o terreno.',
  'formTerreno.limparLocalizacao': 'Limpar localização',

  /* ---- Associar animais a um terreno ---- */
  'associar.titulo': 'Associar animais',
  'associar.ajuda': 'toque num animal para o colocar ou tirar de',
  'associar.semAnimais': 'Esta exploração ainda não tem animais registados.',
  'associar.procurar': 'Procurar por nome, brinco, raça ou número',
  'associar.grupoVazio': 'Não há animais neste grupo.',
  'associar.guardaSozinho': 'As alterações são guardadas automaticamente.',
  'associar.dentro': 'neste terreno',
  'associar.fora': 'fora do terreno',

  /* ---- Formulário da exploração ---- */
  'formExploracao.editar': 'Editar exploração',
  'formExploracao.criar': 'Criar exploração',
  'formExploracao.naoEncontrada': 'Exploração não encontrada',
  'formExploracao.guardada': 'Exploração guardada',
  'formExploracao.criada': 'Exploração criada',
  'formExploracao.semGuardar': 'Exploração não guardada',
  'formExploracao.semCriar': 'Exploração não criada',
  'formExploracao.eliminada': 'Exploração eliminada',
  'formExploracao.eliminarExploracao': 'Eliminar exploração',
  'formExploracao.vaiEliminar': 'Vai eliminar "{nome}" e tudo o que está lá dentro:',
  'formExploracao.eliminarDetalhe':
    'Leva também os animais que já tinham saído do efetivo, e com eles a genealogia. Esta ação não pode ser desfeita.',
  'formExploracao.nada': 'nada',
  'formExploracao.nDespesas': '{n} despesa ou receita|{n} despesas e receitas',
  'formExploracao.soComContaPropriaTitulo': 'Só quem tem a sua própria exploração',
  'formExploracao.soComContaPropriaMensagem':
    'Entrou nesta app por convite de quem gere uma exploração, e é lá que trabalha. Para abrir uma exploração sua, crie uma conta própria.',
  'formExploracao.semPermissaoTitulo': 'A exploração é de quem a tem a cargo',
  'formExploracao.semPermissaoMensagem':
    'O nome, a marca de exploração, o NIF e a localização são alterados por quem responde por ela. Continua a poder trabalhar nos animais e no que lhe compete.',
  'formExploracao.ajuda':
    'Dados oficiais da exploração pecuária. Todos os campos com * são obrigatórios.',
  'formExploracao.exNome': 'Ex: Monte do Avô',
  'formExploracao.marca': 'Marca de exploração',
  'formExploracao.exMarca': 'PT 00 000 0000',
  'formExploracao.nif': 'NIF do detentor',
  'formExploracao.localizacao': 'Localização',
  'formExploracao.exLocalizacao': 'Ex: Idanha-a-Nova',
  'formExploracao.localizacaoAjuda':
    'Escreva o nome da terra e escolha da lista. Chega para a meteorologia local.',
  'formExploracao.fecharMapa': 'Fechar o mapa',
  'formExploracao.verNoMapa': 'Ver no mapa',
  'formExploracao.marcarNoMapa': 'Ou marque no mapa onde fica',
  'formExploracao.toqueNoMapa': 'Toque no mapa para marcar a exploração.',
  'formExploracao.limparMarca': 'Limpar a marca no mapa',

  /* ---- Formulário do lote (existências) ---- */
  'formLote.lote': 'Lote',
  'formLote.exLote': 'Ex: PN-2291',
  'formLote.loteAjuda': 'Vem no rótulo. É por ele que se rastreia o frasco numa inspeção.',
  'formLote.guardado': 'Lote guardado',
  'formLote.entradaRegistada': 'Entrada registada',
  'formLote.eliminado': 'Lote eliminado',
  'formLote.eliminarLote': 'Eliminar lote',
  'formLote.eliminarComUso':
    'Já foram administrados {usado} deste lote. Os tratamentos ficam registados, mas deixam de dizer de que frasco saíram.',
  'formLote.semPermissaoTitulo': 'Sem permissão',
  'formLote.semPermissao':
    'Dar entrada de medicamentos é de quem gere a exploração. Pode continuar a escolher os lotes que já lá estão ao registar um tratamento.',
  'formLote.nomeProduto': 'Nome do produto',
  'formLote.exNome': 'Ex: Penicilina',
  'formLote.validade': 'Validade',
  'formLote.exValidade': 'Ex: 31/12/2027',
  'formLote.calendarioValidade': 'Escolher a validade no calendário',
  'formLote.quantidade': 'Quantidade',
  'formLote.exQuantidade': 'Ex: 250',
  'formLote.quantidadeAjuda': 'O que o frasco trazia, não o que resta. O que resta a app calcula.',
  'formLote.quantidadeAbaixo':
    'Já foram administrados {usado} deste lote. Uma quantidade menor do que essa deixa o stock a zero.',
  'formLote.exSeguranca': 'Ex: 10',
  'formLote.segurancaAjuda':
    'Vem na bula. A app propõe-o quando este lote for usado num tratamento, para o animal não ir para abate antes do tempo.',
  'formLote.fornecedor': 'Fornecedor',
  'formLote.exFornecedor': 'Ex: Agro-Nisa',
  'formLote.dataCompra': 'Data da compra',
  'formLote.exDataCompra': 'Ex: 15/03/2026',
  'formLote.calendarioCompra': 'Escolher a data da compra no calendário',
  'formLote.custoTotal': 'Custo total (€)',
  'formLote.exCusto': 'Ex: 95',
  'formLote.lancaDespesa': 'Lança a despesa em Sanidade',
  'formLote.naoLancaDespesa': 'Não lançar despesa nas contas',
  'formLote.despesaLancada': 'despesa lançada em Sanidade',

  /* ---- Interruptores da conta (finanças, existências) ---- */
  'interruptor.soQuemGere': 'Só quem gere a exploração',
  'interruptor.soQuemGereFinancas':
    'Esta definição pertence ao dono da exploração. Fale com ele se precisar de registar despesas na app.',
  'interruptor.soQuemGereExistencias':
    'Esta definição pertence ao dono da exploração. Fale com ele se precisar de dar entrada de medicamentos na app.',
  'interruptor.oQueMuda': 'O que isto muda',
  'interruptor.registarContas': 'Registar contas na app',
  'interruptor.gerirArrecadacao': 'Gerir a arrecadação na app',
  'interruptor.desligarNaoApaga':
    'Desligar não apaga nada. O que registar fica sempre guardado, mesmo que volte a desligar mais tarde.',
  'interruptor.desligarComMovimentos':
    'Desligar não apaga nada. O movimento que já registou fica guardado e volta a aparecer se ligar outra vez.|Desligar não apaga nada. Os {n} movimentos que já registou ficam guardados e voltam a aparecer se ligar outra vez.',
  'interruptor.desligarComLotes':
    'Desligar não apaga nada. O lote que já registou fica guardado e volta a aparecer se ligar outra vez.|Desligar não apaga nada. Os {n} lotes que já registou ficam guardados e voltam a aparecer se ligar outra vez.',
  'interruptor.valeParaTodas': 'Esta definição vale para todas as suas explorações.',
  'interruptor.obrigacaoLegal':
    'O registo de medicamentos é obrigatório por lei e pode ser pedido numa inspeção. Desligue-o só se o mantiver noutro sítio.',
  'interruptor.financas1Titulo': 'Despesas e receitas',
  'interruptor.financas1Texto':
    'Ração, energia, gasóleo, rendas, vendas e subsídios. Sem isto, ninguém na sua equipa consegue registar valores.',
  'interruptor.financas2Titulo': 'Ecrã de Finanças',
  'interruptor.financas2Texto':
    'Saldo, evolução mês a mês e onde está a gastar mais. Desligado, o ecrã desaparece da app.',
  'interruptor.financas3Titulo': 'Custo das vacinas e medicamentos',
  'interruptor.financas3Texto':
    'O campo do custo deixa de aparecer ao registar um tratamento. O registo sanitário continua igual: só o valor é que não é pedido.',
  'interruptor.existencias1Titulo': 'Separador Existências',
  'interruptor.existencias1Texto':
    'Os lotes que comprou, o que resta de cada um e a validade. Desligado, o separador desaparece da app.',
  'interruptor.existencias2Titulo': 'Escolher o lote no tratamento',
  'interruptor.existencias2Texto':
    'Ao registar uma vacina ou um medicamento deixa de lhe ser perguntado de que frasco saiu. O registo sanitário continua igual: o animal, a data, o produto e o intervalo de segurança ficam todos.',
  'interruptor.existencias3Titulo': 'Avisos de validade e de stock',
  'interruptor.existencias3Texto':
    'Deixa de ser avisado quando um lote está a acabar ou a chegar à validade.',

  /* ---- Aspeto da app ---- */
  'aspeto.titulo': 'Aspeto da app',
  'aspeto.mudar': 'Mudar',
  'aspeto.vaiRecarregar':
    'A app volta a abrir para ficar tudo com as cores novas. Não se perde nada do que está registado, e os outros aparelhos onde entrar com esta conta passam a abrir assim.',
  'aspeto.coresDosAvisos':
    'As cores dos avisos não mudam: o vermelho continua a ser prazo vencido, o âmbar esta semana e o azul informação.',
  'aspeto.exemploAnimal': 'Mimosa · 12 anos',
  'aspeto.exemploRaca': 'Bovino · Mertolenga',
  'idioma.escolhaGuardada': 'Escolha guardada',

  /* ---- Editar dados pessoais ---- */
  'editarConta.ajuda':
    'Nome e email associados à sua conta. Os animais e explorações não são afetados.',
  'editarConta.emailAjuda':
    'Ao mudar de email vamos enviar um link de confirmação para o endereço novo: só nessa altura é que a troca fica ativa.',
  'editarConta.confirmeEmail': 'Confirme o novo email',
  'editarConta.atualizados': 'Dados atualizados',
  'editarConta.guardadas': 'As alterações foram guardadas.',
  'editarConta.modoOffline':
    'Esta app está em modo offline. Para alterar os dados da conta é preciso ligação.',

  /* ---- Ficha de um terreno ---- */
  'detTerreno.area': 'Área',
  'detTerreno.semArea': 'Sem área',
  'detTerreno.comoChegar': 'Como chegar ao terreno:',
  'detTerreno.semLocalizacao': 'Sem localização no mapa. Edite o terreno para marcar onde fica.',
  'detTerreno.semAnimais': 'Ainda não há animais neste terreno. Associe os que estão aqui.',

  /* ---- Ficha de uma exploração ---- */
  'detExploracao.semLocalizacao': 'Sem localização',
  'detExploracao.areaTotal': 'Área total',
  'detExploracao.entrouComo': 'Entrou como {papel}',
  'detExploracao.meteorologia': 'Meteorologia local',
  'detExploracao.aObter': 'A obter meteorologia…',
  'detExploracao.semLocalizacaoDefinida': 'Sem localização definida.',
  'detExploracao.semLigacaoMeteo': 'Sem ligação à meteorologia.',
  'detExploracao.editeParaLocalizar':
    'Edite a exploração e escreva a localização, ou marque no mapa onde ela fica.',
  'detExploracao.dados': 'Dados da exploração',
  'detExploracao.adicionarTerreno': 'Adicionar terreno',
  'detExploracao.adicionar': 'Adicionar',
  'detExploracao.editarDados': 'Editar dados da exploração',
  'detExploracao.gerirEquipa': 'Gerir equipa e convites',

  /* ---- Formulário do movimento (despesa / receita) ---- */
  'formMovimento.movimento': 'Movimento',
  'formMovimento.editar': 'Editar movimento',
  'formMovimento.registarReceita': 'Registar receita',
  'formMovimento.guardarMovimento': 'Guardar movimento',
  'formMovimento.guardado': 'Movimento guardado',
  'formMovimento.receitaRegistada': 'Receita registada',
  'formMovimento.despesaRegistada': 'Despesa registada',
  'formMovimento.semGuardar': 'Movimento não guardado',
  'formMovimento.receitaSemRegistar': 'Receita não registada',
  'formMovimento.despesaSemRegistar': 'Despesa não registada',
  'formMovimento.eliminado': 'Movimento eliminado',
  'formMovimento.eliminarMovimento': 'Eliminar movimento',
  'formMovimento.naoEncontrado': 'Movimento não encontrado',
  'formMovimento.naoEncontradoMensagem':
    'Este lançamento já não existe, ou foi apagado noutro aparelho.',
  'formMovimento.naoESeuTitulo': 'Este lançamento não é seu',
  'formMovimento.naoESeuMensagem':
    'Cada pessoa corrige o que lançou. Para mudar este, fale com quem gere a exploração.',
  'formMovimento.naoMudaExploracao':
    'Um lançamento não muda de exploração. Se foi na outra, elimine e volte a lançar.',
  'formMovimento.ha1Mes': 'Há 1 mês',
  'formMovimento.ouOutraData': 'Ou outra data (dd/mm/aaaa)',
  'formMovimento.calendarioData': 'Escolher a data do movimento no calendário',
  'formMovimento.comprador': 'Comprador',
  'formMovimento.animalAjuda':
    'Só se este movimento for mesmo de um animal. Deixe em branco para custos da exploração inteira.',
  'formMovimento.soDespesas':
    'Pode registar despesas. As receitas (vendas, subsídios) são lançadas por quem gere a exploração.',
  'formMovimento.entra': 'Entra',
  'formMovimento.sai': 'Sai',
  'formMovimento.historicoAlteracoes': 'Histórico de alterações',
  'formMovimento.semHistorico':
    'Não foi possível carregar o histórico. Tente com ligação à internet.',
  'formMovimento.semAlteracoes':
    'Sem alterações registadas. Os lançamentos antigos, e os feitos sem servidor, não têm este registo.',

  /* ---- Comunicar ao SNIRA ---- */
  'snira.marcado': 'Marcado como comunicado',
  'snira.semMarcar': 'Não foi possível marcar',
  'snira.aComunicar': 'A comunicar',
  'snira.relatorioTitulo': 'Comunicações ao SNIRA',
  'snira.relatorioGuardado': 'Relatório guardado',
  'snira.relatorioDescarregado': 'Relatório descarregado',
  'snira.abraEImprima': 'Abra-o e imprima para PDF.',
  'snira.reservadoTitulo': 'Reservado a quem gere a exploração',
  'snira.reservadoMensagem':
    'As comunicações ao SNIRA são de quem responde pela exploração. Pode continuar a registar o que fizer a cada animal.',
  'snira.vazioTitulo': 'Não há nada por comunicar',
  'snira.vazioMensagem':
    'Todos os nascimentos, mortes e saídas registados já foram comunicados. Quando registar um novo, ele aparece aqui com o prazo a contar.',
  'snira.porComunicar': 'Por comunicar',
  'snira.ate3Dias': 'Até 3 dias',
  'snira.abrirIDigital': 'Abrir o iDigital',
  'snira.levarEmExcel': 'Levar em Excel',
  'snira.imprimirFolha': 'Imprimir a folha',
  'snira.guardarPdf': 'Guardar em PDF',
  'snira.semImpressao': 'Não foi possível abrir a impressão',
  'snira.navegadorBloqueou': 'O navegador bloqueou a janela.',
  'snira.soNoComputador':
    'Para levar esta lista em Excel ou em papel, abra a app no computador. Aqui pode conferir e marcar o que já comunicou.',
  'snira.semBrinco': 'Sem brinco registado. O portal precisa dele.',
  'snira.ultimoDia': 'Último dia',
  'snira.aMarcar': 'A marcar…',
  'snira.jaComuniquei': 'Já comuniquei',

  /* ---- Gaveta de documentos ---- */
  'gaveta.gaveta': 'Gaveta',
  'gaveta.semAcesso': 'Sem acesso',
  'gaveta.semCamara':
    'A app precisa de autorização para usar a câmara. Pode dá-la nas definições do telemóvel.',
  'gaveta.semGaleria': 'A app precisa de autorização para ver as suas fotografias.',
  'gaveta.semImagem': 'Não foi possível preparar a imagem',
  'gaveta.semAbrir': 'Não foi possível abrir',
  'gaveta.eliminarDocumento': 'Eliminar documento',
  'gaveta.eliminado': 'Documento eliminado',
  'gaveta.vaziaTitulo': 'Gaveta vazia',
  'gaveta.vaziaPodeGuardar':
    'Fotografe um papel e ele fica aqui, na exploração e não no telemóvel.',
  'gaveta.vaziaSemPermissao': 'Ainda não há nada guardado nesta gaveta.',
  'gaveta.fotografar': 'Fotografar',
  'gaveta.daGaleria': 'Da galeria',
  'gaveta.guardarAqui': 'Guardar nesta gaveta',
  'gaveta.guardadoPorSi': 'Guardado por si',
  'gaveta.guardadoPor': 'Guardado por {nome}',
  'gaveta.autorDesconhecido': 'Autor desconhecido',
  'gaveta.precisaNome': 'O documento tem de ter um nome.',
  'gaveta.alterado': 'Documento alterado',
  'gaveta.semAlterar': 'Não foi possível alterar',
  'gaveta.alterarDocumento': 'Alterar documento',
  'gaveta.exTitulo': 'Ex: Fatura da ração de julho',
  'gaveta.eliminarPergunta':
    'Vai apagar "{titulo}" e a imagem que lhe está guardada. Não há como voltar atrás.',

  /* ---- Histórico do efetivo ---- */
  'motivo.falecidos': 'Falecidos',
  'motivo.vendidos': 'Vendidos',
  'motivo.eliminados': 'Eliminados',
  'histAnimal.titulo': 'Histórico do efetivo',
  'histAnimal.ajuda':
    'Os animais que saíram do efetivo. Nenhum destes registos foi apagado: ficam aqui com o dia e o nome de quem os registou.',
  'histAnimal.procurar': 'Nome ou brinco',
  'histAnimal.vazioTitulo': 'Ainda não saiu nenhum animal',
  'histAnimal.vazioMensagem':
    'Quando marcar uma morte ou uma venda, ou eliminar um registo, o que aconteceu fica escrito aqui.',
  'histAnimal.semFiltrosTitulo': 'Nada com esses filtros',
  'histAnimal.semFiltrosMensagem':
    'Experimente outro motivo, outra exploração ou limpar a pesquisa.',
  'histAnimal.porEQuando': 'Registado por {autor}, {quando}',
  'histAnimal.porQuem': 'Registado por {autor}',
  'histAnimal.quando': 'Registado {quando}',
  'histAnimal.semAutor': 'Sem registo de quem o fez',

  /* ---- Histórico de lançamentos ---- */
  'histMovimento.reservadoMensagem':
    'Só quem gere a exploração pode ver quem lançou cada movimento.',
  'histMovimento.ajuda':
    'Cada lançamento pela ordem em que entrou na app, com o nome de quem o registou e a hora.',
  'histMovimento.vazioTitulo': 'Ainda não há registos',
  'histMovimento.vazioMensagem':
    'Assim que alguém lançar uma despesa ou uma receita, fica aqui escrito quem foi e a que horas.',
  'histMovimento.soFinancas':
    'Só despesas e receitas lançadas em Finanças. O custo de uma vacina ou de um medicamento fica no histórico do animal, junto do tratamento.',
  'histMovimento.semAutor': 'Sem registo de quem o lançou',

  /* ---- Faixas de aviso no topo dos ecrãs ---- */
  'banner.acessoTerminouTitulo': 'O seu acesso terminou',
  'banner.acessoTerminouTexto':
    'O tempo de acesso à exploração acabou, por isso já não vê os animais nem os registos dela. A sua conta continua criada: peça um código novo a quem o convidou para voltar a entrar.',
  'banner.acessoAcabaTexto':
    'Depois disso deixa de ver esta exploração. Termine o que tiver em mãos, ou peça mais tempo a quem o convidou.',
  'banner.jaDescarregada': 'Já está descarregada. A app fecha e volta a abrir sozinha.',
  'banner.dispensar': 'Dispensar',
  'banner.atualizarAgora': 'Atualizar agora',
  'banner.aAtualizar': 'A atualizar…',
  'banner.conflitoTexto':
    'Outra pessoa mexeu nos mesmos registos primeiro. Veja o que está em falta e volte a registar o que ainda fizer sentido.',
  'banner.recusadoTexto':
    'O servidor não as aceitou. Veja quais foram: o que se registou nelas não está guardado.',
  'banner.verOQueFalhou': 'Ver o que falhou',
  'banner.suspensaPropria':
    'Pode ver e exportar tudo o que já registou, mas de momento não é possível gravar alterações. Fale connosco para reativar a conta.',
  'banner.suspensaDoDono':
    'Pode consultar os dados desta exploração, mas não gravar alterações. A conta do responsável pela exploração está suspensa.',

  /* ---- Nova palavra-passe ---- */
  'novaPalavra.titulo': 'Nova palavra-passe',
  'novaPalavra.subtitulo': 'Escolha uma nova palavra-passe',
  'novaPalavra.confirmar': 'Confirmar palavra-passe',
  'novaPalavra.repita': 'Repita a palavra-passe',
  'novaPalavra.curta': 'A palavra-passe deve ter pelo menos 6 caracteres.',
  'novaPalavra.naoCoincidem': 'As palavras-passe não coincidem.',
  'novaPalavra.guardar': 'Guardar nova palavra-passe',

  /* ---- Ecrã de arranque ---- */
  'carregar.aAbrir': 'A abrir a Terrabovina…',
  'carregar.aDemorar':
    'Está a demorar mais do que o costume. Pode ser falta de rede, ou a sessão ter caducado e ser preciso entrar outra vez.',
  'carregar.sairEEntrar': 'Terminar sessão e entrar de novo',

  /* ---- Escolher uma fotografia ---- */
  'foto.semAutorizacao': 'Sem autorização',
  'foto.semAutorizacaoTexto':
    'O telemóvel está a bloquear o acesso à câmara ou às fotografias. Pode autorizá-lo nas definições do sistema.',
  'foto.semUsar': 'Não foi possível usar a fotografia',
  'foto.tirarFoto': 'Tirar foto',

  /* ---- Conta por aprovar / por código ---- */
  'pendente.bemVindo': 'Bem-vindo',
  'pendente.faltaCodigo': 'Falta o código',
  'pendente.aAguardar': 'A aguardar aprovação',
  'pendente.contaAtiva': 'A sua conta está ativa',
  'pendente.contaPendente': 'A sua conta está pendente',
  'pendente.pecaCodigo':
    'Peça o código de convite a quem gere a exploração onde vai trabalhar e escreva-o abaixo.',
  'pendente.podeCriar':
    'Pode criar a sua primeira exploração ou associar-se a uma através de um código de convite.',
  'pendente.semEsperar':
    'Não tem de esperar por ninguém: com o código de convite de uma exploração entra de imediato. Peça-o a quem a gere.',
  'pendente.emAnalise':
    'O administrador da plataforma vai analisar o pedido de acesso. Se tiver recebido um código de convite de um cliente, pode usá-lo já para entrar.',
  'pendente.conta': 'Conta: {email}',
  'pendente.criarDescricao': 'Registar a minha exploração e começar a lançar animais.',
  'pendente.tenhoCodigo': 'Tenho um código',
  'pendente.tenhoCodigoDescricao': 'Entrar na exploração de outra pessoa com um código de convite.',
  'pendente.criarEContinuar': 'Criar e continuar',
  'pendente.codigoConvite': 'Código de convite',
  'pendente.exCodigo': 'Ex: A7BXK2M9',
  'pendente.pecaAoResponsavel': 'Peça o código ao responsável pela exploração.',
  'pendente.entrarComCodigo': 'Entrar com este código',
  'pendente.verificarNovamente': 'Verificar novamente',
  'pendente.apagarExplicacao':
    'Não quer continuar? Pode apagar a conta e os dados do registo. Ninguém tem de a aprovar primeiro.',
  'pendente.codigoInvalido': 'Código inválido.',
  'pendente.codigoUsado': 'Este código já foi utilizado.',
  'pendente.codigoExpirado': 'Este código expirou. Peça um novo ao cliente.',

  /* ---- Notificações e alertas ---- */
  'notif.explicacao':
    'Escolha que avisos aparecem no início. Prazos já vencidos ou urgentes aparecem sempre, mesmo que a categoria esteja desligada.',
  'notif.repor': 'Repor',
  'notif.reporTitulo': 'Repor as preferências',
  'notif.reporMensagem':
    'Volta às definições recomendadas: todas as categorias ligadas, com antecedências pré-definidas.',
  'notif.reporRecomendacoes': 'Repor recomendações',
  'notif.autorizacaoRecusada': 'Autorização recusada',
  'notif.autorizacaoRecusadaTexto':
    'O telemóvel está a bloquear os avisos desta app. Pode autorizá-los nas definições do sistema, em Notificações.',
  'notif.avisarNoTelemovel': 'Avisar no telemóvel',
  'notif.avisarLigado':
    'O telemóvel avisa-o de manhã quando um prazo se aproxima, mesmo com a app fechada e sem internet.',
  'notif.avisarDesligado': 'Os avisos só aparecem quando abrir a app.',
  'notif.vibrar': 'Vibrar ao gravar',
  'notif.vibrarLigado':
    'O aparelho dá um toque curto quando um registo fica gravado, e um toque diferente quando alguma coisa falha. Dá para confirmar sem ler o ecrã.',
  'notif.vibrarDesligado': 'Os registos só se confirmam pelo aviso no ecrã.',
  'notif.som': 'Som ao gravar',
  'notif.somLigado':
    'A app dá um sinal sonoro curto quando um registo fica gravado, e outro diferente quando alguma coisa falha. O aparelho no silencioso continua calado.',
  'notif.somDesligado': 'Os registos só se confirmam pelo aviso no ecrã e pela vibração.',
  'notif.dispensados': 'Avisos dispensados',
  'notif.dispensadosAjuda':
    'Estes avisos não aparecem no início. Voltam sozinhos se a situação se agravar.',
  'notif.comecarAAvisar': 'Começar a avisar',
  'notif.menosDias': 'Menos dias',
  'notif.maisDias': 'Mais dias',

  /* ---- Sincronização e cópia ---- */
  'sinc.offline': 'Offline',
  'sinc.aSincronizar': 'A sincronizar',
  'sinc.aSincronizarPontos': 'A sincronizar…',
  'sinc.sincronizado': 'Sincronizado',
  'sinc.sincronizarAgora': 'Sincronizar agora',
  'sinc.semLigacao':
    'Sem ligação. As alterações ficam guardadas no dispositivo e enviam-se automaticamente quando a rede voltar.',
  'sinc.tudoEnviado': 'Tudo enviado. Os dados no servidor estão em dia.',
  'sinc.perdidas': 'ALTERAÇÕES PERDIDAS',
  'sinc.semGravar': 'NÃO FOI POSSÍVEL GRAVAR',
  'sinc.perdidasTexto':
    'Foram feitas sem ligação e não chegaram ao servidor. Confira o que está em falta e volte a registar o que ainda fizer sentido.',
  'sinc.recusadasTexto':
    'Foram feitas sem ligação e o servidor não as aceitou, normalmente por não ter permissão para essa exploração.',
  'sinc.esquecer': 'Esquecer',
  'sinc.esquecerLista': 'Esquecer esta lista',
  'sinc.esquecerTitulo': 'Esquecer alterações recusadas',
  'sinc.esquecerMensagem':
    'A lista deixa de aparecer. As alterações em si já não estão guardadas: se ainda forem precisas, tem de as fazer outra vez.',
  'sinc.copiaGuardada': 'Cópia guardada',
  'sinc.copiaGuardadaTexto':
    'Guardámos uma cópia dos seus dados neste dispositivo. Mantenha o ficheiro num local seguro.',
  'sinc.descarregarCopia': 'Descarregar cópia (JSON)',

  /* ---- Seletor de animais ---- */
  'selAnimais.escolhaTerreno': 'Escolha o terreno onde o animal anda.',
  'selAnimais.trocarTerreno': 'Trocar de terreno',
  'selAnimais.semAnimaisNoTerreno': 'Não há animais neste terreno.',
  'selAnimais.trocarAnimal': 'Trocar animal',
  'selAnimais.trocar': 'Trocar',

  /* ---- Mudar o gado de terreno ---- */
  'mover.titulo': 'Mudar o gado de terreno?',
  'mover.paraQueTerreno': 'Mudar para que terreno?',
  'mover.semMudarTudo': 'Não foi possível mudar tudo',

  /* ---- Guardar um documento ---- */
  'guardarDoc.titulo': 'Guardar documento',
  'guardarDoc.guardado': 'Documento guardado',
  'guardarDoc.semGuardar': 'Documento não guardado',
  'guardarDoc.escolhaExploracao': 'Escolha a exploração a que este documento pertence.',
  'guardarDoc.imagemPronta': 'Imagem pronta',
  'guardarDoc.faltaDizer': 'Falta dizer o que é e quem a pode ver.',
  'guardarDoc.oQueE': 'O que é',
  'guardarDoc.precisaLigacao':
    'Guardar um documento precisa de ligação: a imagem sobe para a sua conta.',
  'guardarDoc.quemVe': 'Quem vê',
  'guardarDoc.todaEquipa': 'Toda a equipa',
  'guardarDoc.todaEquipaDescricao': 'Quem trabalha nesta exploração pode abrir este documento.',
  'guardarDoc.soEu': 'Só eu',
  'guardarDoc.soEuDescricao': 'Mais ninguém o vê, nem o dono da exploração.',
  'guardarDoc.vetsNaoVeem': 'Em qualquer dos casos, os veterinários não veem documentos nenhuns.',

  /* ---- Secção dos documentos ---- */
  'seccaoDocs.vazia': 'Vazia.',
  'seccaoDocs.vaziaCurto': 'Vazia',
  'seccaoDocs.nDocumentos': '{n} documento|{n} documentos',
  'seccaoDocs.contaSuspensa':
    'Com a conta por regularizar pode consultar os documentos, mas não guardar novos.',
  'seccaoDocs.semPermissao': 'Guardar documentos é de quem tem uma exploração a cargo.',

  /* ---- Escrever ao apoio ---- */
  'apoio.reportar': 'Reportar um problema',
  'apoio.escrever': 'Escrever ao apoio',
  'apoio.vaiPara': 'Vai para {email}',
  'apoio.explicacaoBug':
    'Conte o que estava a fazer e o que aconteceu. Não precisa de saber termos técnicos: a versão da app e o aparelho seguem sozinhos.',
  'apoio.explicacaoMensagem':
    'Escreva-nos com a sua dúvida ou com o que precisa. Respondemos para o email da sua conta.',
  'apoio.assunto': 'Assunto',
  'apoio.assuntoAjuda': 'Uma linha a dizer do que se trata.',
  'apoio.exAssuntoBug': 'A app fecha ao abrir os animais',
  'apoio.exAssuntoDuvida': 'Dúvida sobre os alertas',
  'apoio.oQueAconteceu': 'O que aconteceu',
  'apoio.aSuaMensagem': 'A sua mensagem',
  'apoio.ajudaBug': 'O que estava a fazer, o que esperava e o que apareceu no ecrã.',
  'apoio.ajudaMensagem': 'Quanto mais concreto, mais depressa lhe respondemos.',
  'apoio.exTextoBug':
    'Carreguei em Animais e a app fechou-se sozinha. Aconteceu três vezes esta manhã.',
  'apoio.exTextoDuvida': 'Gostava de saber como…',
  'apoio.vaiJunto': 'Vai junto: {contexto}',
  'apoio.enviarProblema': 'Enviar o problema',
  'apoio.enviarMensagem': 'Enviar mensagem',
  'apoio.problemaEnviado': 'Problema enviado',
  'apoio.mensagemEnviada': 'Mensagem enviada',
  'apoio.problemaSemEnviar': 'Problema não enviado',
  'apoio.mensagemSemEnviar': 'Mensagem não enviada',
  'apoio.recebemos': 'Recebemos. Costumamos responder no mesmo dia útil.',

  /* ---- Avisos e erros ---- */
  'avisos.entendido': 'Entendido',
  'erro.titulo': 'Alguma coisa correu mal',
  'erro.dadosSeguros': 'Os seus dados continuam guardados neste aparelho: não se perdeu nada.',

  /* ---- Marcar um evento na agenda ---- */
  'agenda.semPermissaoTitulo': 'O calendário é de quem trabalha na exploração',
  'agenda.semPermissaoMensagem':
    'Marcar eventos é de quem tem a exploração a cargo e de quem lá trabalha todos os dias. Pode continuar a registar o que fizer a cada animal.',
  'agenda.semExploracoesMensagem': 'Os eventos pertencem a uma exploração. Crie primeiro a sua.',
  'agenda.exTitulo': 'Ex: Feira de Idanha',
  'agenda.dia': 'Dia',
  'agenda.exDia': 'dd/mm/aaaa',
  'agenda.calendarioDia': 'Escolher o dia do evento',
  'agenda.horas': 'Horas',
  'agenda.marcarHora': 'Marcar uma hora',
  'agenda.todaEquipaDescricao': 'Quem trabalha nesta exploração vê este evento no calendário.',
  'agenda.soEuDescricao':
    'Fica guardado na sua conta. Mais ninguém o vê, nem o dono da exploração.',
  'agenda.notasAjuda': 'O que mais precisar de ter à mão nesse dia.',
  'agenda.exNotas': 'Ex: levar a guia de circulação e os brincos de substituição',
  'agenda.eliminarEvento': 'Eliminar evento',

  /* ---- Campos do movimento ---- */
  'formMovimento.tipo': 'Tipo de movimento',
  'formMovimento.despesa': 'Despesa',
  'formMovimento.receita': 'Receita',
  'formMovimento.categoria': 'Categoria',
  'formMovimento.valor': 'Valor (€)',
  'formMovimento.exValor': 'Ex: 860',
  'formMovimento.exDescricao': 'Ex: Ração, 40 sacos',
  'formMovimento.data': 'Data',

  /* ---- Meteorologia ---- */
  'meteo.humidade': 'Humidade',
  'meteo.vento': 'Vento',
  'meteo.precipitacao': 'Precip.',
  'meteo.amanha': 'Amanhã',
  'meteo.atualizar': 'Atualizar meteorologia',
  'meteo.grausC': '°C',
  'meteo.chuva': 'Chuva {chuva}',
  'meteo.semLigacao': 'Sem ligação',
  'meteo.esconderDias': 'Esconder os próximos dias',
  'meteo.verProximosDias': 'Ver o próximo dia|Ver os próximos {n} dias',
  'meteo.mostrarMenos': 'Mostrar menos',
  'meteo.proximosDias': 'Próximo dia|Próximos {n} dias',
  'dia.domingo': 'Domingo',
  'dia.segunda': 'Segunda',
  'dia.terca': 'Terça',
  'dia.quarta': 'Quarta',
  'dia.quinta': 'Quinta',
  'dia.sexta': 'Sexta',
  'dia.sabado': 'Sábado',

  /* ---- Peças soltas da interface ---- */
  'comum.voltar': 'Voltar',
  'comum.acao': 'Ação',
  'comum.concluido': 'Concluído',
  'seletor.procurarOuEscrever': 'Procurar ou escrever uma nova',
  'seletor.nadaEncontrado': 'Nada encontrado.',

  /* ---- Equipa de uma exploração ---- */
  'equipaExp.titulo': 'Equipa',
  'equipaExp.semPermissao': 'Só o administrador desta exploração pode gerir a equipa.',
  'equipaExp.gerarCodigo': 'Gerar código',
  'equipaExp.apagarConvite': 'Apagar convite',
  'permissoes.reporPapel': 'Repor o que o papel dá',

  /* ---- Prazo de acesso de um convidado ---- */
  'acesso.duranteUmTempo': 'Durante um tempo',
  'acesso.ateDiaEHora': 'Até dia e hora',
  'acesso.terminarJa': 'Terminar já',
  'acesso.tirarPrazo': 'Tirar o prazo',
  'acesso.marcarEstaHora': 'Marcar esta hora',

  /* ---- Relatório de prazos ---- */
  'relatorio.prazo': 'Prazo',
  'relatorio.importancia': 'Importância',
  'relatorio.levarTodos': 'Levar todos os prazos',
  'relatorio.imprimir': 'Imprimir',
  'relatorio.descarregarPdf': 'Descarregar PDF',

  /* ---- Ajuda, apagar conta, importar, genealogia, atividade ---- */
  'ajuda.reverPrimeirosPassos': 'Rever os primeiros passos',
  'apagar.vaiSerApagado': 'Isto vai ser apagado',
  'apagar.continuaAExistir': 'Isto continua a existir, sem si',
  'apagar.ajudaEscrever': 'É de propósito: um botão vermelho sozinho carrega-se sem ler.',
  'apagar.afinalNao': 'Afinal não',
  'importar.titulo': 'Importar de Excel',
  'importar.paraQueExploracao': 'Para que exploração?',
  'importar.descarregarModelo': 'Descarregar o modelo',
  'importar.descarregarModeloBotao': 'Descarregar modelo',
  'importar.carregarFicheiro': 'Carregar o ficheiro preenchido',
  'genealogia.titulo': 'Árvore genealógica',
  'genealogia.naoEncontrado': 'Animal não encontrado',
  'genealogia.indicarPais': 'Indicar mãe e pai',
  'atividade.titulo': 'Registo de alterações',
  'atividade.aEquipa': 'A equipa',
  'atividade.incluirMinhas': 'Incluir as minhas',
  'histEquipa.titulo': 'Histórico da equipa',
  'histEquipa.semEquipaMensagem':
    'Só o dono de uma exploração vê quem lá passou. Se entrou por convite, fale com quem o convidou.',
  'histEquipa.vazioTitulo': 'Ainda não saiu ninguém',
  'histEquipa.vazioMensagem':
    'Quando o prazo de um veterinário acabar, ou quando remover alguém da equipa, fica aqui registado quem era, com que função e quando.',
  'histEquipa.toqueParaEquipa':
    'Toque para abrir a equipa desta exploração e dar-lhe mais tempo',

  /* ---- Últimos rótulos soltos ---- */
  'formLote.naoEncontrado': 'Lote não encontrado',
  'formLote.naoEncontradoMensagem': 'Este lote pode ter sido eliminado noutro aparelho.',
  'formLote.semExploracoesMensagem':
    'Os medicamentos pertencem a uma exploração. Crie primeiro a sua exploração.',
  'formAnimal.assuntoFoto': 'do animal',
  'formExploracao.assuntoFoto': 'da exploração',
  'foto.remover': 'Remover a fotografia',
  'agenda.toqueParaVer': 'Toque para ver ou alterar',
  'avisos.toqueParaFechar': 'Toque para fechar este aviso',
  'alertas.dispensarAjuda': 'Deixa de mostrar este aviso. Volta se a situação se agravar.',
  'erro.tentarDeNovo': 'Tentar de novo',
  'erro.enviarDetalhes': 'Enviar detalhes do erro',

  /* ---- Ecrã da Ajuda ---- */
  'ajuda.grupoContacto': 'PRECISA DE FALAR CONNOSCO?',
  'ajuda.escrevaNos':
    'Escreva-nos com a sua dúvida ou o que aconteceu. Costumamos responder no mesmo dia útil.',
  'ajuda.grupoProblema': 'ALGUMA COISA NÃO FUNCIONA?',
  'ajuda.grupoFaq': 'PERGUNTAS FREQUENTES',
  'ajuda.grupoRecomecar': 'COMEÇAR DE NOVO',
  'ajuda.reverExplicacao':
    'Voltar a ver o guia de primeiros passos no ecrã inicial e as explicações de cada separador.',
  'ajuda.guiaReposto': 'Guia reposto',
  'ajuda.guiaRepostoDetalhe':
    'Os primeiros passos voltam ao Início e os separadores voltam a apresentar-se.',

  /* ---- Perguntas frequentes ---- */
  'faq.offlineP': 'Posso usar a app sem internet?',
  'faq.offlineR':
    'Sim. Todos os dados ficam guardados no dispositivo e a app funciona igual sem rede. Quando a ligação voltar, as alterações são enviadas para o servidor sozinhas.',
  'faq.brincoP': 'Como identifico um animal (brinco)?',
  'faq.brincoR':
    'Ao criar ou editar o animal, preencha o campo "Número de identificação". A partir daí a app deixa de mostrar o alerta de identificação em atraso.',
  'faq.sniraP': 'A app comunica ao SNIRA por mim?',
  'faq.sniraR':
    'Não. O envio ao SNIRA continua a ser feito no portal oficial. A app avisa-o dos prazos e marca o animal como comunicado quando confirmar.',
  'faq.relatorioP': 'Onde posso descarregar um relatório?',
  'faq.relatorioR':
    'Em Documentos, no relatório de prazos. Na app de computador é guardado logo em PDF; no navegador é guardado como página que pode imprimir para PDF.',
  'faq.dadosP': 'Onde é que os dados são guardados?',
  'faq.dadosR':
    'No próprio dispositivo, para funcionar offline. Se tiver sessão iniciada, uma cópia é sincronizada para a sua conta no servidor. Pode descarregar uma cópia de segurança em Definições, Sincronização e cópia.',
  'faq.sessaoP': 'Como termino a sessão ou apago a conta?',
  'faq.sessaoR':
    'Ambos em Perfil, no fim do ecrã. Terminar sessão volta ao ecrã de entrada e não apaga nada do servidor. Apagar a minha conta abre um ecrã à parte que mostra o que vai desaparecer (se for dono, a exploração vai com a conta, com os animais e o histórico lá dentro) e só avança depois de escrever APAGAR. É definitivo: nem quem gere a aplicação consegue recuperar.',

  /* ---- Apagar a conta ---- */
  'apagar.intro':
    'Apagar a conta é definitivo. Ninguém, nem sequer quem gere a aplicação, consegue recuperar o que se perde aqui. Leia o que vai desaparecer antes de continuar.',
  'apagar.comCadaExploracao':
    'Com cada exploração caem os terrenos, os animais, os eventos, os documentos e o histórico.',
  'apagar.equipaPerdeAcesso': 'Quem trabalha consigo perde o acesso.',
  'apagar.nPessoasPerdem':
    '{n} pessoa da sua equipa perde o acesso.|{n} pessoas da sua equipa perdem o acesso.',
  'apagar.maisNinguem': 'Não há mais ninguém com acesso a estas explorações.',
  'apagar.deOutraPessoa':
    'Estas explorações são de outra pessoa: os animais e os registos ficam lá. O que se perde é a sua entrada: para voltar precisa de um código de convite novo.',
  'apagar.porSincronizar':
    '{n} alteração guardada neste aparelho ainda não chegou ao servidor. Se apagar a conta agora, perde-se também.|{n} alterações guardadas neste aparelho ainda não chegaram ao servidor. Se apagar a conta agora, perdem-se também.',
  'apagar.escrevaParaConfirmar': 'Escreva {palavra} para confirmar',
  'apagar.modoOffline':
    'Esta app está em modo offline. Para apagar a conta é preciso ter sessão iniciada.',
  'apagar.perguntaTitulo': 'Apagar a conta?',
  'apagar.perguntaComDados': 'Vai apagar a sua conta, {exploracoes} e {animais}.',
  'apagar.semRecuperar': 'Não há forma de recuperar isto: nem sua, nem de quem gere a aplicação.',
  'apagar.perguntaSemDados':
    'Vai apagar a sua conta e perder o acesso à aplicação. Não há forma de voltar atrás.',
  'apagar.definitivamente': 'Apagar definitivamente',
  'apagar.apagada': 'Conta apagada',
  'apagar.apagadaDetalhe':
    'Os seus dados foram removidos do servidor. Obrigado por ter usado a Terrabovina.',

  /* ---- Importar animais de Excel ---- */
  'importar.soNoComputador':
    'Para escolher um ficheiro Excel é preciso o computador ou o site da app. No telemóvel, registe os animais um a um com o botão de registar.',
  'importar.explicacao':
    'Descarregue o modelo, preencha-o no Excel (um animal por linha) e volte aqui para o carregar. Mostramos o que vai entrar antes de gravar. Os animais que a app já tem não entram outra vez, mesmo que o ficheiro os traga.',
  'importar.contaSuspensa':
    'A conta está suspensa ou por aprovar: não é possível gravar animais.',
  'importar.semExploracoes':
    'Não tem nenhuma exploração onde possa registar animais. Crie uma exploração primeiro, ou peça acesso ao dono.',
  'importar.modeloExplicacao':
    'Traz os cabeçalhos certos e uma folha de instruções com o que cada coluna aceita.',
  'importar.modeloDescarregado': 'Modelo descarregado',
  'importar.modeloOnde': 'Procure na pasta das transferências.',
  'importar.aLer': 'A ler…',
  'importar.escolherFicheiro': 'Escolher ficheiro Excel',
  'importar.escolherOutro': 'Escolher outro ficheiro',
  'importar.semLer': 'Ficheiro não lido',
  'importar.semLerTitulo': 'Não conseguimos ler o ficheiro',
  'importar.detalheTecnico': 'Detalhe técnico: {detalhe}',
  'importar.aImportar': 'A importar…',
  'importar.importarN': 'Importar {n} animal|Importar {n} animais',
  'importar.nImportados': '{n} animal importado|{n} animais importados',
  'importar.semImportar': 'Não foi possível importar',
  'importar.parcialTitulo': 'Importação parcial',
  'importar.parcial': 'Entraram {entraram}. O servidor recusou {recusados}{quais}.',
  'importar.motivo': 'Motivo: {motivo}',
  'importar.nProntos': '{n} animal pronto a importar|{n} animais prontos a importar',
  'importar.nenhumPronto': 'Nenhum animal pronto a importar',
  'importar.nComErro': '{n} com erro|{n} com erro',
  'importar.nJaExistem': '{n} já existe|{n} já existem',
  'importar.ficheiroVazio': 'O ficheiro não tinha linhas de animais.',
  'importar.tudoCerto': 'Tudo certo, sem problemas.',
  'importar.faltamColunas': 'Faltam colunas no ficheiro',
  'importar.faltamColunasDetalhe':
    'Não encontrámos: {colunas}. Use o modelo descarregado sem apagar a linha de cabeçalhos.',
  'importar.naoVaoEntrar': 'NÃO VÃO ENTRAR',
  'importar.jaExistem': 'JÁ EXISTEM (NÃO IMPORTADOS)',
  'importar.entramMasRepare': 'ENTRAM, MAS REPARE',
  'importar.linha': 'Linha {n}',
  'importar.dupIdNaConta':
    'Este animal já está na app: veio deste mesmo ficheiro exportado. Não foi importado outra vez.',
  'importar.dupIdNoFicheiro': 'Esta linha repete outra do ficheiro (mesmo ID).',
  'importar.dupNomeNaConta':
    'Já existe um animal com este nome e data de nascimento: não foi importado. Se for outro animal, mude-lhe o nome ou dê-lhe brinco.',
  'importar.dupNomeNoFicheiro': 'Outra linha do ficheiro tem o mesmo nome e data de nascimento.',
  'importar.dupBrincoNaConta': 'Já existe um animal com este brinco: não foi importado.',
  'importar.dupBrincoNoFicheiro': 'Este brinco aparece mais do que uma vez no ficheiro.',
  'importar.noComputador': 'Faça a importação no computador',
  'importar.modeloExcel': 'Modelo Excel',

  /* ---- O que cada linha do Excel tem de errado (`data/animalExcel.ts`) ----
     Os NOMES das colunas e os valores que elas aceitam (Bovino, Fêmea) ficam
     em português: são o que está escrito no ficheiro, e traduzi-los fazia a app
     deixar de saber ler um modelo preenchido na outra língua. ---- */
  'excel.faltaEspecie': 'Falta a espécie.',
  'excel.especieInvalida': 'Espécie "{valor}" não é válida. Use: {lista}.',
  'excel.faltaSexo': 'Falta o sexo.',
  'excel.sexoInvalido': 'Sexo "{valor}" não é válido. Use Macho ou Fêmea.',
  'excel.faltaNascimento': 'Falta a data de nascimento.',
  'excel.nascimentoInvalido':
    'Data de nascimento "{valor}" inválida. Use dd/mm/aaaa e uma data não futura.',
  'excel.finalidadeDesconhecida': 'Finalidade "{valor}" não reconhecida, por isso ignorada.',
  'excel.finalidadeSoBovinos': 'Finalidade só se aplica a bovinos, por isso ignorada.',
  'excel.finalidadeAtipica':
    'Finalidade "{valor}" não é típica de {sexo}, mas foi guardada na mesma.',
  'excel.identificacaoInvalida': 'Data de identificação "{valor}" inválida, por isso ignorada.',
  'excel.sniraInvalido': '"{valor}" não é Sim nem Não, por isso ficou Sim.',
  'excel.partoInvalido': 'Data prevista de parto "{valor}" inválida, por isso ignorada.',
  'excel.partoNumMacho': 'Data de parto indicada num macho, por isso ignorada.',
  'excel.semBrincoNemNome':
    'Sem brinco nem nome, não conseguimos confirmar se este animal já existe na app. Confira que não o está a registar duas vezes.',

  /* ---- Conversas (chat) ----
     O grupo da exploração e as mensagens privadas. Ver `data/chat.ts`. ---- */
  'chat.titulo': 'Conversas',
  'chat.subtitulo': 'Falar com quem trabalha consigo',
  'chat.semConversas': 'Ainda não tem conversas',
  'chat.semConversasMensagem':
    'O grupo da exploração aparece aqui assim que houver equipa. Também pode escrever a alguém em privado.',
  'chat.grupoSemNome': 'Grupo da exploração',
  'chat.grupo': 'Grupo da equipa',
  'chat.privada': 'Conversa privada',
  'chat.semMensagens': 'Ainda sem mensagens',
  'chat.mensagemApagada': 'Mensagem apagada',
  'chat.utilizadorRemovido': 'Utilizador removido',
  'chat.euDisse': 'Eu: {texto}',
  'chat.novaConversa': 'Nova conversa',
  'chat.aQuemEscrever': 'A quem quer escrever?',
  'chat.escreverA': 'Escrever a {nome}',
  'chat.semPessoas': 'Não há mais ninguém',
  'chat.semPessoasMensagem':
    'Só pode escrever a quem trabalha nas suas explorações. Para juntar alguém, use a aba Trabalhadores.',
  'chat.hoje': 'Hoje',
  'chat.ontem': 'Ontem',
  'chat.escrever': 'Escreva a mensagem',
  'chat.enviar': 'Enviar',
  'chat.porEnviar': 'Por enviar',
  'chat.erroVazia': 'Escreva alguma coisa antes de enviar.',
  'chat.erroComprida': 'A mensagem é comprida de mais (o máximo é {n} caracteres).',
  'chat.semEnviar': 'Não foi possível enviar',
  'chat.avisoSeisMeses': 'As mensagens com mais de {n} meses são apagadas.',
  'chat.foraDoGrupo': 'Já não está neste grupo. Pode ler o que ficou, mas não escrever.',
  'chat.conversaSumiu': 'Esta conversa já não está disponível.',
  'chat.semEscrita': 'O seu acesso a esta exploração terminou. Pode ler, mas não escrever.',
  'chat.info': 'Informação',
  'chat.membrosN': '{n} pessoa|{n} pessoas',
  'chat.naoLidasN': '{n} por ler',
  'chat.nomeDoGrupo': 'Nome do grupo',
  'chat.nomeDoGrupoAjuda': 'Deixe vazio para o grupo se chamar como a exploração.',
  'chat.soDono': 'Só o dono da exploração muda isto.',
  'chat.nomeMudado': 'Nome do grupo gravado',
  'chat.silenciar': 'Silenciar esta conversa',
  'chat.silenciarAjuda': 'Deixa de avisar quando chegam mensagens. Continua a poder abri-la.',
  'chat.avisarNovas': 'Avisar de mensagens novas',
  'chat.avisarNovasAjuda': 'Mostra um aviso curto quando chega uma mensagem com a app aberta.',
  'chat.ajustes': 'Definições das conversas',
  'chat.remover': 'Remover do grupo',
  'chat.repor': 'Repor no grupo',
  'chat.foraLista': 'Fora do grupo',
  'chat.confirmarRemover':
    'Remover {nome} do grupo? Continua na equipa da exploração e deixa de ver as mensagens novas.',
  'chat.removido': 'Removido do grupo',
  'chat.reposto': 'Reposto no grupo',
  'chat.bloquear': 'Bloquear esta pessoa',
  'chat.desbloquear': 'Desbloquear',
  'chat.confirmarBloquear':
    'Bloquear {nome}? Deixam de se poder escrever um ao outro. Pode desfazer quando quiser.',
  'chat.bloqueada': 'Pessoa bloqueada',
  'chat.desbloqueada': 'Pessoa desbloqueada',
  'chat.bloqueadoAviso': 'Esta conversa está bloqueada. Desbloqueie para voltar a escrever.',
  'chat.verBloqueados': 'Pessoas bloqueadas',
  'chat.semBloqueados': 'Não tem ninguém bloqueado.',
  'chat.denunciar': 'Denunciar mensagem',
  'chat.denunciarTexto':
    'A mensagem segue para quem administra a Terrabovina, com as três anteriores para dar contexto. O resto da conversa continua privado.',
  'chat.denunciada': 'Mensagem denunciada',
  'chat.denunciadaDetalhe': 'Vamos ver o que se passou.',
  'chat.apagarMensagem': 'Apagar mensagem',
  'chat.confirmarApagar':
    'Apagar esta mensagem? Fica "Mensagem apagada" no lugar dela, para toda a gente.',
  'chat.opcoes': 'O que quer fazer?',
  'chat.mensagemNova': 'Mensagem nova',
  'chat.regrasTitulo': 'Regras das conversas',
  'chat.regrasTexto':
    'Estas conversas são para o trabalho da exploração. Não é permitido conteúdo ofensivo, ameaças nem assédio. Qualquer mensagem pode ser denunciada, e quem a escreveu pode perder o acesso à app.',
  'chat.semLigacao': 'Sem ligação: fica à espera',
  'chat.semLigacaoDetalhe': 'A mensagem sai assim que houver rede.',


  /* ---- Conversas: anexos, sondagens e avisos no telemóvel ---- */
  'chat.umaFotografia': 'Fotografia',
  'chat.umaMensagemDeVoz': 'Mensagem de voz',
  'chat.umaLocalizacao': 'Localização',
  'chat.umaSondagem': 'Sondagem',
  'chat.anexar': 'Juntar à mensagem',
  'chat.tirarFoto': 'Tirar fotografia',
  'chat.escolherFoto': 'Escolher das fotografias',
  'chat.gravarVoz': 'Gravar mensagem de voz',
  'chat.marcarSitio': 'Marcar um sítio no mapa',
  'chat.fazerSondagem': 'Fazer uma sondagem',
  'chat.aEnviarFicheiro': 'A enviar…',
  'chat.semAnexo': 'Não foi possível enviar o ficheiro',
  'chat.semCamara': 'Sem acesso à câmara',
  'chat.semGaleria': 'Sem acesso às fotografias',
  'chat.semPermissaoAjuda': 'Autorize nas definições do telemóvel e volte a tentar.',
  'chat.legenda': 'Legenda (opcional)',
  'chat.fotoNaoAbre': 'Não foi possível abrir a fotografia.',
  'chat.verFoto': 'Ver a fotografia',
  'chat.aGravar': 'A gravar',
  'chat.pararEEnviar': 'Parar e enviar',
  'chat.descartar': 'Descartar',
  'chat.semMicrofone': 'Sem acesso ao microfone',
  'chat.gravacaoCurta': 'Gravou pouco tempo para se ouvir alguma coisa.',
  'chat.tocar': 'Tocar',
  'chat.parar': 'Parar',
  'chat.escolherSitio': 'Toque no mapa para marcar o sítio.',
  'chat.enviarSitio': 'Enviar este sítio',
  'chat.verNoMapa': 'Ver no mapa',
  'chat.semSitio': 'Marque um sítio primeiro.',
  'chat.pergunta': 'Pergunta',
  'chat.perguntaExemplo': 'Quem pode vir sábado?',
  'chat.respostaN': 'Resposta {n}',
  'chat.acrescentarResposta': 'Acrescentar resposta',
  'chat.enviarSondagem': 'Enviar a sondagem',
  'chat.votosN': '{n} voto|{n} votos',
  'chat.semVotos': 'Ainda ninguém respondeu',
  'chat.sondagemSemPergunta': 'Escreva a pergunta.',
  'chat.sondagemPerguntaLonga': 'A pergunta é comprida de mais (o máximo é {n} caracteres).',
  'chat.sondagemPoucasRespostas': 'Escreva pelo menos {n} respostas diferentes.',
  'chat.sondagemMuitasRespostas': 'Uma sondagem leva no máximo {n} respostas.',
  'chat.votar': 'Votar em: {opcao}',
  'chat.avisosNoTelemovel': 'Avisar no telemóvel',
  'chat.avisosNoTelemovelAjuda':
    'Toca mesmo com a app fechada. Sem isto, só vê as mensagens quando abrir a app.',
  'chat.avisosRecusados':
    'O telemóvel não autorizou os avisos. Ligue-os nas definições do aparelho.',
  'chat.avisosSoNoTelemovel': 'Os avisos com a app fechada são só no telemóvel.',

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
  'nav.chat': 'Chats',
  'nav.chatCurto': 'Chats',
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
  'comum.eliminar': 'Delete',
  'comum.guardar': 'Save',
  'comum.cancelar': 'Cancel',
  'comum.aGuardar': 'Saving…',
  'comum.aCarregar': 'loading…',
  'comum.semVoltaAtras': 'Are you sure? This cannot be undone.',
  'comum.semEliminar': 'Could not delete',
  'comum.semGravar': 'Could not save',
  'comum.percebi': 'Got it',

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
  'animais.faladoPorCompletar': 'incomplete: no name and no tag',
  'animais.faladoSemBrinco': 'not identified: no ear tag',

  /* ---- Pontos coloridos no retrato do animal ---- */
  'sinal.legal': 'Tag and SNIRA',
  'sinal.reproducao': 'Breeding',
  'sinal.saude': 'Vaccines and medicines',
  'sinal.falado': 'Needs attention',

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
  'calendario.mesAnterior': 'Previous month',
  'calendario.mesSeguinte': 'Next month',
  'calendario.diaAnterior': 'Previous day',
  'calendario.diaSeguinte': 'Next day',
  'calendario.nadaMarcado': 'Nothing on.',
  'calendario.nadaNesteDia': 'Nothing on for this day.',
  'calendario.nEventos': '{n} event|{n} events',
  'calendario.nPrazos': '{n} deadline|{n} deadlines',
  'calendario.prazosDesteDia': 'DEADLINES ON THIS DAY',
  'calendario.marcarNesteDia': 'Schedule something on this day',
  'calendario.arrasteParaOLado': 'Swipe sideways, or use the arrows, to see the other days.',
  'calendario.soEuVejo': 'Only I can see it',
  'exploracao.animais': 'animals',
  'exploracao.terrenos': 'land',
  'exploracao.escolher': 'Which farm?',
  'exploracao.filtroRotulo': 'Farm: {nome}',
  'exploracao.filtroAjuda': 'Opens the list of your farms',
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
  'alertas.tudoEmDiaNaExploracao': 'No deadlines or pending tasks at {nome}.',
  'alertas.subtitulo': 'Legal deadlines and tasks to do',
  'alertas.introTitulo': 'What this tab is for',
  'alertas.intro1':
    'The app works out the legal deadlines on its own, from the dates you record: tagging a calf, reporting to SNIRA, the end of a withdrawal period.',
  'alertas.intro2':
    'The urgent ones come first, then whatever is due this week. Once you deal with it on the animal, the alert disappears from here.',
  'alertas.intro3':
    'Tap a group heading to close it. The Calendar shows the same deadlines day by day, so you know what next week holds.',
  'alertas.intro4':
    'Only alerts without a countdown can be dismissed. Anything with a deadline running stays: that is what must not be forgotten.',
  'alertas.verMais': 'Show {n} more',
  'alertas.abrirGrupoAjuda': 'Opens this group',
  'alertas.fecharGrupoAjuda': 'Closes this group',

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
    "Changes the language of the app's menus and messages. The names you typed (animals, land, notes) stay exactly as you wrote them.",
  'idioma.aRecarregar': 'The app will reload to change language.',
  'idioma.porAplicar': 'Choice saved. The app will change language next time you open it.',
  'idioma.domínioEmPortugues':
    'Record types (Parto, Cobrição, Vacinação) and breeds stay in Portuguese: they are what is stored on the animals records.',

  /* ---- Guia de primeiros passos (Início) ---- */
  'tutorial.titulo': 'Let us get started',
  'tutorial.progresso': '{n} of {total} done|{n} of {total} done',
  'tutorial.esconder': 'Hide',
  'tutorial.esconderAjuda': 'Hide the getting started guide',
  'tutorial.comoFunciona':
    'Follow the steps in order. Tap any of them to see what it is about. You can stop halfway and carry on whenever you like: the app saves everything.',
  'tutorial.opcionaisTitulo': 'IF YOU WANT, NOT REQUIRED',
  'tutorial.opcionaisAjuda':
    'Parts of the app you can turn on now or never. They are also in your Profile.',
  'tutorial.feito': 'Done',
  'tutorial.toqueParaSaber': 'Tap to see what it is about',

  'tutorial.exploracaoTitulo': 'Create your farm',
  'tutorial.exploracaoDescricao': 'It is your farm inside the app. Start here.',
  'tutorial.exploracaoDetalhe':
    'The farm is your holding inside the app: it is where the land, the animals and everything you record live. The name you call it by and the town are enough; the holding number and the rest can wait. If you have two holdings, create two: the app keeps their books apart.',
  'tutorial.exploracaoAcao': 'Create the farm',

  'tutorial.terrenoTitulo': 'Record your land',
  'tutorial.terrenoDescricao': 'The pastures, the paddocks and the pens where the herd goes.',
  'tutorial.terrenoDetalhe':
    'A plot of land is any place the animals can be: a pasture, a paddock, a pen. Give it the name you call it by ("Lower Field") and, if you like, mark it on the satellite map. Once that is done you can say where each animal is and see, at a glance, how many are in each place.',
  'tutorial.terrenoAcao': 'Add a plot of land',

  'tutorial.animalTitulo': 'Record your first animal',
  'tutorial.animalDescricao': 'Species, sex and age are enough: the rest can wait.',
  'tutorial.animalDetalhe':
    'Start with a single animal, just to see how it goes. You do not need everything to hand: species, sex and date of birth are enough to record it, and the ear tag, the breed, the photo and the land can be added whenever you like. If your herd is already written up in an Excel file, you can import the lot in one go instead of typing it out.',
  'tutorial.animalAcao': 'Record an animal',

  'tutorial.avisosTitulo': 'Turn on phone reminders',
  'tutorial.avisosDescricao':
    'So legal deadlines reach you in time, even with the app closed.',
  'tutorial.avisosDetalhe':
    'The app counts the deadlines for you (tagging a calf, reporting to SNIRA, the next vaccination), but it can only call you if you allow it. With reminders on, the message shows up on your phone on the right day, even if you do not open the app that week.',
  'tutorial.avisosAcao': 'Turn on reminders',

  'tutorial.financasTitulo': 'Turn on money management',
  'tutorial.financasDescricao': 'Only if you want to record expenses and sales in the app.',
  'tutorial.financasDetalhe':
    'With financial management on, you can record what you spend (feed, vet, rent) and what you take in (sales, milk, subsidies), and the app shows you the farm balance and what each animal has cost you. If you leave it off, no money appears anywhere in the app. You can turn it on and off whenever you like: turning it off hides, it does not delete.',
  'tutorial.financasAcao': 'See money management',

  /* ---- O que se comunica ao SNIRA ---- */
  'snira.nascimento': 'birth',
  'snira.morte': 'death',
  'snira.saida': 'departure',
  'snira.entrada': 'arrival',
  'snira.movimentacao': 'movement',

  /* ---- Cada aviso que a app calcula (`data/alertas.ts`) ---- */
  'aviso.idAtrasoTitulo': 'Tagging overdue',
  'aviso.idTitulo': 'Still to be tagged',
  'aviso.idAtrasoDesc':
    '{rotulo} should already be tagged. The deadline passed {n} day ago.|{rotulo} should already be tagged. The deadline passed {n} days ago.',
  'aviso.idDesc':
    '{rotulo} is {idade} old. Tag within {n} day.|{rotulo} is {idade} old. Tag within {n} days.',

  'aviso.sniraAtrasoTitulo': 'SNIRA report overdue',
  'aviso.sniraNascTitulo': 'Report to SNIRA',
  'aviso.sniraNascAtrasoDesc':
    '{rotulo}: birth not yet reported to SNIRA. The deadline passed {n} day ago.|{rotulo}: birth not yet reported to SNIRA. The deadline passed {n} days ago.',
  'aviso.sniraNascDesc':
    '{rotulo}: report the birth to SNIRA within {n} day.|{rotulo}: report the birth to SNIRA within {n} days.',
  'aviso.sniraEvTitulo': 'Report {oQue} to SNIRA',
  'aviso.sniraEvAtrasoDesc':
    '{rotulo}: {oQue} on {data} not reported. The deadline passed {n} day ago.|{rotulo}: {oQue} on {data} not reported. The deadline passed {n} days ago.',
  'aviso.sniraEvDesc':
    '{rotulo}: report the {oQue} on {data} within {n} day.|{rotulo}: report the {oQue} on {data} within {n} days.',

  'aviso.partoConfirmarTitulo': 'Expected birth to confirm',
  'aviso.partoConfirmarDesc':
    '{rotulo}: the expected calving date passed more than {dias} days ago. Record the birth or correct the estimate.',
  'aviso.partoTitulo': 'Birth expected',
  'aviso.partoAtrasoDesc':
    '{rotulo} passed the expected calving date {n} day ago.|{rotulo} passed the expected calving date {n} days ago.',
  'aviso.partoDesc':
    '{rotulo} is close to calving ({n} day).|{rotulo} is close to calving ({n} days).',

  'aviso.segurancaTitulo': 'Withdrawal period',
  'aviso.segurancaDesc':
    '{rotulo}: within the withdrawal period, do not sell for slaughter ({n} day left).|{rotulo}: within the withdrawal period, do not sell for slaughter ({n} days left).',

  'aviso.revacinarAtrasoTitulo': 'Booster overdue',
  'aviso.revacinarTitulo': 'Booster coming up',
  'aviso.revacinarAtrasoDesc':
    '{rotulo}: about a year has passed since the last vaccination. The deadline passed {n} day ago.|{rotulo}: about a year has passed since the last vaccination. The deadline passed {n} days ago.',
  'aviso.revacinarDesc':
    '{rotulo}: booster due in {n} day (last one {desde} days ago).|{rotulo}: booster due in {n} days (last one {desde} days ago).',
  'aviso.semVacinacaoTitulo': 'No vaccination on record',
  'aviso.semVacinacaoDesc':
    '{rotulo} has no vaccination recorded. Record the last one to keep track of the plan.',

  'aviso.diagRepetirTitulo': 'Diagnosis to repeat',
  'aviso.diagTitulo': 'Pregnancy diagnosis missing',
  'aviso.diagRepetirDesc':
    '{rotulo}: the diagnosis has been unconfirmed for {n} day. Repeat it.|{rotulo}: the diagnosis has been unconfirmed for {n} days. Repeat it.',
  'aviso.diagDesc':
    '{rotulo}: mated {n} day ago and still without a diagnosis. Check whether she is in calf.|{rotulo}: mated {n} days ago and still without a diagnosis. Check whether she is in calf.',
  'aviso.semCobricaoTitulo': 'Not mated since calving',
  'aviso.semCobricaoDesc':
    '{rotulo}: calved {n} day ago and has not been mated again. Every idle day pushes back the next calving.|{rotulo}: calved {n} days ago and has not been mated again. Every idle day pushes back the next calving.',

  'aviso.comLote': '{nome} (batch {lote})',
  'aviso.foraValidadeTitulo': 'Medicine past its expiry date',
  'aviso.foraValidadeDesc':
    '{nome}: expired {n} day ago and there is still stock left. Do not administer.|{nome}: expired {n} days ago and there is still stock left. Do not administer.',
  'aviso.validadeATerminarTitulo': 'Expiry date approaching',
  'aviso.validadeATerminarDesc':
    '{nome}: expires in {n} day. Use this batch before the others.|{nome}: expires in {n} days. Use this batch before the others.',
  'aviso.aAcabarTitulo': 'Stock running out',
  'aviso.aAcabarDesc': '{nome}: {resta} {unidade} left out of {total}.',

  /* ---- Fase reprodutiva de uma fêmea ---- */
  'fase.gestante': 'In calf',
  'fase.gestanteExplicacao': 'Pregnancy confirmed.',
  'fase.coberta': 'Mated',
  'fase.cobertaExplicacao': 'Mated, waiting on a diagnosis.',
  'fase.duvidosa': 'Unconfirmed',
  'fase.duvidosaExplicacao': 'Inconclusive diagnosis: repeat it.',
  'fase.vazia': 'Empty',
  'fase.vaziaExplicacao': 'Not pregnant.',
  'fase.naoAplicavel': 'Not applicable',
  'fase.naoAplicavelExplicacao': 'Not part of breeding management.',

  /* ---- Ecrã da Reprodução ---- */
  'repro.subtituloVazio': 'The cycle of the females in your herd',
  'repro.femeasEmIdade': '{n} female of breeding age|{n} females of breeding age',
  'repro.prestesAParir': 'About to calve',
  'repro.prestesAParirVazio': 'No female is due to calve in the coming month.',
  'repro.aguardaDiagnostico': 'Waiting on a diagnosis',
  'repro.aguardaDiagnosticoVazio':
    'No female mated more than {dias} days ago is still without a diagnosis.',
  'repro.paradas': 'Not mated since calving',
  'repro.paradasVazio': 'No female that calved more than {dias} days ago is still unmated.',
  'repro.vazioTitulo': 'No females to follow yet',
  'repro.vazioMensagem':
    'As soon as there are females of breeding age in the herd, this page shows who is in calf, who still needs a diagnosis and who has been idle since calving.',
  'repro.gestantes': 'In calf',
  'repro.cobertas': 'Mated',
  'repro.vazias': 'Empty',
  'repro.taxaGestacao': 'PREGNANCY RATE',
  'repro.intervaloPartos': 'CALVING INTERVAL',
  'repro.semDoisPartos': 'Not two calvings on record yet',
  'repro.passouPrevisao': 'Due date passed {n} day ago|Due date passed {n} days ago',
  'repro.faltam': '{n} day to go|{n} days to go',
  'repro.cobertaHa': 'Mated {n} day ago|Mated {n} days ago',
  'repro.diagInconclusivo':
    'Diagnosis inconclusive for {n} day|Diagnosis inconclusive for {n} days',
  'repro.pariuHa': 'Calved {n} day ago|Calved {n} days ago',
  'repro.nPartos': '{n} calving|{n} calvings',
  'repro.registar': 'Record',
  'repro.registarEm': 'Record {acao} for {nome}',
  'repro.registarCobricao': 'Record a mating',
  'repro.cobricao': 'Mating',
  'repro.diagnostico': 'Diagnosis',

  /* ---- Ecrã das Existências ---- */
  'existencias.subtitulo': 'Medicines and vaccines in the store',
  'existencias.nLotesRegistados': '{n} batch recorded|{n} batches recorded',
  'existencias.nLotes': '{n} batch|{n} batches',
  'existencias.aTratar': 'Needs attention',
  'existencias.disponivel': 'Available',
  'existencias.foraDeUso': 'Out of use',
  'existencias.introTitulo': 'What this tab is for',
  'existencias.intro1':
    'Record every bottle or box you buy, with its batch number and expiry date. One line per purchase: buy another of the same and that is another line.',
  'existencias.intro2':
    'When you record a vaccine or a medicine on an animal, pick the batch it came from and the app takes off what you used.',
  'existencias.intro3':
    'The app warns you when a batch is running low and when the expiry date is coming up, so you do not find out with the animal already in the crush.',
  'existencias.intro4':
    'It is also the medicine register the law requires you to keep. From a computer it exports to Excel to take to an inspection.',
  'existencias.exportar': 'Export the medicine register',
  'existencias.registoMedicamentos': 'Medicine register',
  'existencias.descarregado': 'File downloaded',
  'existencias.semDescarga': 'Could not download',
  'existencias.vazioTitulo': 'The store is empty',
  'existencias.vazioPodeGerir':
    'Record the medicines and vaccines you have. Then, when you record a treatment, you pick the batch and the app takes off what you used.',
  'existencias.vazioSemPermissao':
    'No medicines recorded on this farm yet. Only whoever runs it can add them.',
  'existencias.darEntrada': 'Add stock',
  'existencias.foraDeValidade': 'Past its expiry date',
  'existencias.esgotado': 'Used up',
  'existencias.expiraEm': 'Expires in {n} day|Expires in {n} days',
  'existencias.aAcabar': 'Running out',
  'existencias.lote': 'Batch {lote}',
  'existencias.semLote': 'No batch number',
  'existencias.validade': 'expires {data}',
  'existencias.restamDe': '{resta} left out of {total}',
  'existencias.seguranca': 'withdrawal {n} day|withdrawal {n} days',

  /* ---- Ecrã dos Terrenos ---- */
  'terrenos.subtitulo': 'Where the herd goes',
  'terrenos.contagem': '{n} plot|{n} plots',
  'terrenos.vazioTitulo': 'No land recorded',
  'terrenos.vazioSemExploracao':
    'Land belongs to a farm. Create your farm first, then record the pastures and paddocks here.',
  'terrenos.vazioPodeCriar':
    'Record the pastures, the paddocks and the pens where the herd goes. Then you can say where each animal is and see, at a glance, how many are in each place.',
  'terrenos.vazioSemPermissao':
    'No land recorded on this farm yet. Only whoever runs it can add it.',
  'terrenos.grupoVazio': 'This farm has no land recorded yet.',
  'terrenos.novo': 'New plot',
  'terrenos.novoCurto': 'NEW',
  'terrenos.novoEm': 'New plot at {nome}',
  'terrenos.semTipo': 'No type',
  'terrenos.nAnimais': '{n} animal|{n} animals',

  /* ---- Ecrã dos Documentos ---- */
  'docs.subtitulo': 'Keep paperwork, import, export and your notes',
  'docs.subtituloSemAcesso': 'Import, export and your notes',
  'docs.semAcessoTitulo': 'Documents are for whoever runs the farm',
  'docs.semAcessoMensagem':
    'Importing and exporting the herd is for whoever runs the farm. You can still look at the animals and record what you do to each one.',
  'docs.introTitulo': 'What this tab is for',
  'docs.intro1':
    'Keep the paperwork you receive here: photograph the feed invoice, the movement document or the vet receipt and they are filed by drawer, on the farm rather than on your phone.',
  'docs.intro2':
    'If your animals are already written up in an Excel file, you can bring them all in at once instead of typing them one by one.',
  'docs.intro3':
    'This is also where your data goes out: the animal list in Excel, and deadline reports to print or hand in.',
  'docs.intro4':
    'The notes are yours alone: they are for whatever does not fit on an animal record, such as arrangements, phone numbers or what is still to be done.',
  'docs.intro5':
    'Importing and exporting files only works on a computer. Keeping documents and notes works on the phone too.',
  'docs.grupoObrigacoes': 'OBLIGATIONS',
  'docs.comunicarSnira': 'Report to SNIRA',
  'docs.emDia': 'up to date',
  'docs.grupoImportar': 'IMPORT',
  'docs.importarAnimais': 'Import animals from Excel',
  'docs.grupoExportar': 'EXPORT AND REPORTS',
  'docs.exportarAnimais': 'Export animals (Excel)',
  'docs.exportarEventos': 'Export records (Excel)',
  'docs.eventos': 'Records',
  'docs.nRegistos': '{n} record|{n} records',
  'docs.relatorioPrazos': 'Deadline report (print or PDF)',
  'docs.soNoComputador': 'Files are a computer job',
  'docs.soNoComputadorDetalhe':
    'Exporting to Excel, printing and saving PDF reports is done in the desktop app or on the app website: that is where there is somewhere to put the files.',
  'docs.descarregado': 'File downloaded',
  'docs.semDescarga': 'Could not download',

  /* ---- Notas ---- */
  'notas.titulo': 'NOTES',
  'notas.uma': 'Note',
  'notas.vazio':
    'No notes yet. Keep whatever you need to hand here: contacts, reminders, anything you like.',
  'notas.nova': 'New note',
  'notas.editar': 'Edit note',
  'notas.guardar': 'Save note',
  'notas.guardada': 'Note saved',
  'notas.criada': 'Note created',
  'notas.eliminada': 'Note deleted',
  'notas.eliminarTitulo': 'Delete note',
  'notas.semTitulo': 'Untitled',
  'notas.tituloOpcional': 'Title (optional)',
  'notas.placeholder': 'Write your note…',
  'notas.vaziaTitulo': 'Empty note',
  'notas.vaziaMensagem': 'Write something before saving.',
  'notas.semGravacao': 'Could not save',
  'notas.precisamLigacao': 'Notes need a connection to be saved.',

  /* ---- Ecrã de entrada ---- */
  'login.entrarNaConta': 'Sign in to your account',
  'login.criarConta': 'Create your account',
  'login.recuperarAcesso': 'Recover your access',
  'login.oQueVeioFazer': 'What brings you here?',
  'login.nome': 'Name',
  'login.nomePlaceholder': 'Your name',
  'login.email': 'Email address',
  'login.emailPlaceholder': 'name@example.com',
  'login.palavraPasse': 'Password',
  'login.palavraPassePlaceholder': 'At least 6 characters',
  'login.explicacaoRecuperar': 'We will email you a link to set a new password.',
  'login.esqueciMe': 'I forgot my password',
  'login.recuperadoAviso':
    'If an account exists with this email, we have sent a link to reset the password. Check your inbox.',
  'login.contaCriadaComCodigo':
    'Account created. We have sent a confirmation email: confirm it, sign in, and use the invite code you were given.',
  'login.contaCriada':
    'Account created. We have sent a confirmation email: confirm it and then sign in.',
  'login.enviarLink': 'Send recovery link',
  'login.criarContaBotao': 'Create account',
  'login.entrar': 'Sign in',
  'login.voltarAEntrar': 'Back to signing in',
  'login.jaTemConta': 'Already have an account?',
  'login.aindaNaoTemConta': 'No account yet?',

  /* ---- O que a pessoa vem cá fazer (`data/intencao.ts`) ---- */
  'intencao.dono': 'Farm owner',
  'intencao.donoDescricao':
    'I have animals of my own to record. The account is approved by the administrator.',
  'intencao.trabalhador': 'Farm worker',
  'intencao.trabalhadorDescricao':
    "I work on someone else's farm. I get in with an invite code.",
  'intencao.veterinario': 'Vet',
  'intencao.veterinarioDescricao': 'I attend farms. I get in with an invite code.',

  /* ---- Folha de filtros da lista de animais ---- */
  'filtro.titulo': 'Filter animals',
  'filtro.fecharFiltros': 'Close filters',
  'filtro.especie': 'Species',
  'filtro.sexo': 'Sex',
  'filtro.femeas': 'Females',
  'filtro.machos': 'Males',
  'filtro.cobricao': 'Mating',
  'filtro.cobertas': 'Mated',
  'filtro.naoCobertas': 'Not mated',
  'filtro.idade': 'Age',
  'filtro.raca': 'Breed',
  'filtro.cor': 'Coat colour',
  'filtro.finalidade': 'Purpose',
  'filtro.terreno': 'Land',
  'filtro.semTerreno': 'No land',
  'filtro.todos': 'All',
  'filtro.outros': 'Other',
  'filtro.comAlertas': 'With alerts',
  'filtro.comArquivo': 'With archive',
  'filtro.incluirArquivo': 'Include archive ({n})',
  'filtro.nadaParaAfinar': 'There is nothing more to narrow down in this list.',
  'filtro.nenhumCorresponde': 'No animal matches',
  'filtro.verN': 'See {n} animal|See {n} animals',

  /* ---- Faixas etárias ---- */
  'faixa.cria': 'Up to 6 months',
  'faixa.jovem': '6 months to 2 years',
  'faixa.adulto': '2 to 8 years',
  'faixa.velho': 'Over 8 years',

  /* ---- Categorias de alerta (chips do filtro) ---- */
  'categoria.identificacao': 'Tagging',
  // "SNIRA" é o nome do sistema e não se traduz; o teste de completude proíbe
  // duas colunas iguais, e a palavra a mais diz o que a categoria é.
  'categoria.snira': 'SNIRA reports',
  'categoria.parto': 'Births',
  'categoria.reproducao': 'Breeding',
  'categoria.medicamento': 'Medicines',
  'categoria.vacinacao': 'Vaccination',
  'categoria.existencias': 'Stock',

  /* ---- Papéis de quem entra numa exploração ---- */
  'papel.dono': 'Owner',
  'papel.trabalhador': 'Farm worker',
  'papel.veterinario': 'Vet',
  'papel.emExploracao': '{papel} at {nome}',
  'papel.emNExploracoes': '{papel} at {n} farm|{papel} at {n} farms',

  /* ---- Ecrã do Perfil ---- */
  'perfil.nExploracoes': '{n} farm|{n} farms',
  'perfil.tipoDeConta': 'Account type',
  'perfil.administrador': 'Platform administrator',
  'perfil.criador': 'Farmer',
  'perfil.oSeuPapel': 'Your role',
  'perfil.osSeusPapeis': 'Your roles',
  'perfil.semExploracao': 'Not linked to any farm',
  'perfil.estado': 'Status',
  'perfil.porAprovar': 'Awaiting approval (read only)',
  'perfil.editarDados': 'Edit your details',
  'perfil.terminarSessao': 'Sign out',
  'perfil.apagarConta': 'Delete my account',
  'perfil.abrirDefinicoes': 'Open settings',
  'perfil.opcoesEmDefinicoes': 'The app options are in Settings',
  'perfil.mudarFoto': 'Change your photo',
  'perfil.escolherFoto': 'Choose a photo for yourself',
  'perfil.aSuaFotografia': 'Your photo',
  'perfil.assuntoFoto': 'for your account',
  'perfil.fotoSoSua':
    'For now the photo is yours alone: it shows up here in your Profile and nobody else sees it.',
  'perfil.fotoGuardada': 'Photo saved',
  'perfil.fotoRemovida': 'Photo removed',
  'perfil.fotoSemGravar': 'Could not save the photo',
  'perfil.porEnviarTitulo': 'There are still changes waiting to be sent',
  'perfil.porEnviarMensagem':
    'You have {n} change saved on this device that has not reached the server. If you sign out now, it is lost. Go online and wait for the sync, or sign out anyway.|You have {n} changes saved on this device that have not reached the server. If you sign out now, they are lost. Go online and wait for the sync, or sign out anyway.',
  'perfil.sairAMesma': 'Sign out anyway',

  /* ---- Ecrã dos Trabalhadores ---- */
  'equipa.subtitulo': 'Who works on your farms',
  'equipa.atualizar': 'Refresh',
  'equipa.atualizarLista': 'Refresh the list',
  'equipa.exploracao': 'Farm',
  'equipa.introTitulo': 'What this tab is for',
  'equipa.intro1':
    'These are the people you have given access to your farm: workers and vets. Anyone not on this list sees nothing of what you record.',
  'equipa.intro2':
    'You invite with a code: the person installs the app, types the code and is linked to your farm straight away, without needing to know your password.',
  'equipa.intro3':
    'Each one only touches their own work: the worker records what they do day to day, the vet records treatments.',
  'equipa.intro4':
    'Tap a person to see and change exactly what they can alter. You can give a vet access until a day and time of your choosing, after which they drop out on their own.',
  'equipa.intro5':
    'The change log shows what each person touched and when: who recorded an animal, who moved a plot, who entered an expense.',
  'equipa.semCarregar': 'Could not load the team',
  'equipa.aCarregarEquipa': 'Loading the team…',
  'equipa.nTrabalhadores': '{n} worker|{n} workers',
  'equipa.nVeterinarios': '{n} vet|{n} vets',
  'equipa.nDonos': '{n} owner|{n} owners',
  'equipa.semEquipaTitulo': 'No team to manage',
  'equipa.semEquipaMensagem':
    'Only a farm owner sees and invites the team. If you came in by invitation, speak to whoever invited you.',
  'equipa.vazioTitulo': 'No workers yet',
  'equipa.vazioMensagem':
    'Invite someone with a code: they get into the app and are linked to your farm straight away, seeing the animals and recording what they do.',
  'equipa.convidarAlguem': 'Invite someone',
  'equipa.convidarPara': 'Invite to {nome}',
  'equipa.convidarTrabalhadorOuVet': 'Invite a worker or a vet',
  'equipa.toqueNumaPessoa': 'Tap a person to choose what they can change in the app.',
  'equipa.toqueNaExploracao': 'To invite or remove on a particular farm, tap it above.',
  'equipa.consultar': 'LOOK BACK',
  'equipa.verRegistoAlteracoes': 'See the change log',
  'equipa.verQuemCaEsteve': 'See who has been here',
  'equipa.toqueParaPermissoes': 'Tap to choose what this person can change',
  'equipa.permissoesGuardadas': 'Permissions saved',
  'equipa.permissoesAjustadas': 'Permissions adjusted',
  'equipa.prazoNaoMudou': 'The access period did not change',
  'equipa.acessoSemPrazo': 'Access with no time limit',
  'equipa.acessoTerminado': 'Access ended',
  'equipa.acessoProlongado': 'Access extended',
  'equipa.acessoMarcado': 'Access scheduled',
  'equipa.ate': 'until {quando}',

  /* ---- Ecrã das Finanças ---- */
  'financas.legenda': 'Expenses, income and the farm balance',
  'financas.movimentos': 'Entries',
  'financas.animalRemovido': 'Animal removed',
  'financas.semExportar': 'Could not export',
  'financas.desligadaTitulo': 'Financial management is off',
  'financas.desligadaMensagem':
    'This account does not use the app to record expenses and income. Whoever runs the farm can turn it on under Profile, Financial management.',
  'financas.reservadasTitulo': 'The books are for the owner',
  'financas.reservadasMensagem':
    'Income and the farm balance can only be seen by whoever runs it. You can still record the expenses you make.',
  'financas.registarDespesa': 'Record an expense',
  'financas.registarMovimento': 'Record an entry',
  'financas.introTitulo': 'What this tab is for',
  'financas.intro1':
    'Here you note what you spend (feed, vet, rent) and what you take in (sales, milk, subsidies). The app adds it up and shows you the balance.',
  'financas.intro2':
    'Each expense can be tied to an animal or a plot of land: that is how you later know what each one cost.',
  'financas.intro3':
    'The totals at the top are for the period you choose; with more than one farm, pick which one first.',
  'financas.intro4':
    'The money side is optional and you can turn it off under Profile, Financial management. Turning it off hides, it does not delete.',
  'financas.vazioTitulo': 'No entries yet',
  'financas.vazioMensagem':
    'Record what you spend on feed, power or vaccines, and what the sales bring in. The summary shows up here.',
  'financas.semMovimentosMes': 'No entries this month',
  'financas.semMovimentosAno': 'No entries this year',
  'financas.em': 'at {nome}',
  'financas.escolhaOutroPeriodo': 'Choose another period to see the history.',
  'financas.escolhaOutroOuExploracao': 'Choose another period or another farm to see the history.',
  'financas.vendasSemPreco': '{n} sale without a price|{n} sales without a price',
  'financas.vendasSemPrecoDetalhe':
    'Someone recorded the animal leaving but not the amount. The income below is incomplete until they are closed.',
  'financas.saldo': 'Balance (income minus expenses)',
  'financas.saldoCurto': 'Balance',
  'financas.receitas': 'Income',
  'financas.despesas': 'Expenses',
  'financas.ultimos6Meses': 'Last 6 months',
  'financas.paraOndeVai': 'Where the money goes',
  'financas.deOndeVem': 'Where the money comes from',
  'financas.animaisQueMaisPesam': 'The animals that weigh most',
  'financas.verUltimos': 'See the last one|See the last {n}',
  'financas.verMaisFaltam': 'Show {n} more ({faltam} to go)',
  'financas.historicoRegistos': 'Entry history',
  'financas.exportarExcel': 'Export to Excel',
  'financas.exportaPeriodo': 'Exports what you are looking at: the period.',
  'financas.exportaPeriodoEExploracao':
    'Exports what you are looking at: the period and {nome}.',
  'financas.excelSoNoComputador': 'Exporting the books to Excel is done in the desktop app.',
  'financas.semRegistosNesteMes': 'Nothing recorded this month.',
  'financas.toqueNumMes': 'Tap a month to see that month values.',
  'financas.esteMes': 'This month',
  'financas.esteAno': 'This year',
  'financas.tudo': 'All',
  'financas.mesDeAno': '{mes} {ano}',

  /* ---- Formulário do animal ---- */
  'formAnimal.novo': 'New animal',
  'formAnimal.editar': 'Edit animal',
  'formAnimal.ajudaNovo': 'Fill in the essentials. You can complete the rest later.',
  'formAnimal.ajudaEditar': 'Change what you need and save at the end.',
  'formAnimal.hoje': 'Today',
  'formAnimal.ontem': 'Yesterday',
  'formAnimal.ha1Semana': 'A week ago',
  'formAnimal.cerca1Ano': 'about 1 year',
  'formAnimal.cerca2Anos': 'about 2 years',
  'formAnimal.cerca5Anos': 'about 5 years',
  'formAnimal.dataNascimento': 'Date of birth',
  'formAnimal.ouDataExata': 'Or an exact date (dd/mm/yyyy), handy for grown animals',
  'formAnimal.exData': 'e.g. 15/03/2021',
  'formAnimal.calendarioNascimento': 'Pick the date of birth on the calendar',
  'formAnimal.dataInvalidaNaoFutura':
    'Invalid date. Use dd/mm/yyyy, and not a date in the future.',
  'formAnimal.dataInvalida': 'Invalid date. Use dd/mm/yyyy.',
  'formAnimal.nome': 'Name',
  'formAnimal.exNome': 'e.g. Daisy',
  'formAnimal.brinco': 'Ear tag number (SIA)',
  'formAnimal.exBrinco': 'PT 0000 0000 0000',
  'formAnimal.semBrincoAviso': 'If you leave it empty, we raise an alert to tag within 20 days.',
  'formAnimal.comunicadoSnira': 'Birth reported to SNIRA?',
  'formAnimal.jaComunicado': 'Already reported',
  'formAnimal.porComunicar': 'Not reported',
  'formAnimal.estaPrenhe': 'Is she in calf?',
  'formAnimal.sim': 'Yes',
  'formAnimal.nao': 'No',
  'formAnimal.dataCobricaoAjuda': 'Mating date (dd/mm/yyyy): we work out the calving for you',
  'formAnimal.exDataCobricao': 'e.g. 10/02/2026',
  'formAnimal.calendarioCobricao': 'Pick the mating date on the calendar',
  'formAnimal.ouDataParto': 'Or, if you already know the calving date, type it here',
  'formAnimal.exDataParto': 'e.g. 20/11/2026',
  'formAnimal.calendarioParto': 'Pick the expected calving date on the calendar',
  'formAnimal.partoPrevisto': 'Calving expected: {data}',
  'formAnimal.daquiA': '{n} day away|{n} days away',
  'formAnimal.indiqueUmaData': 'Give one of the dates so we can warn you about the calving.',
  'formAnimal.escolherRaca': 'Choose a breed',
  'formAnimal.usarRaca': 'Use the breed',
  'formAnimal.escolherCor': 'Choose a colour',
  'formAnimal.usarCor': 'Use the colour',
  'formAnimal.numero': 'Number',
  'formAnimal.exNumero': 'e.g. 12',
  'formAnimal.exploracao': 'Farm',
  'formAnimal.semExploracoes': 'No farms yet. Create a farm before recording animals.',
  'formAnimal.escolhaExploracao': 'Choose a farm for the animal.',
  'formAnimal.genealogia': 'Parentage',
  'formAnimal.genealogiaAjuda':
    'Only animals of the same farm and species, old enough at the date of birth, show up here.',
  'formAnimal.mae': 'Dam',
  'formAnimal.pai': 'Sire',
  'formAnimal.semFemeas': 'No eligible females recorded.',
  'formAnimal.semMachos': 'No eligible males recorded.',
  'formAnimal.procurarAnimal': 'Search by name or tag',
  'formAnimal.maisNaProcura': '{n} more. Use the search to find them.',
  'formAnimal.nenhumCorresponde': 'No animal matches "{procura}".',
  'formAnimal.guardarAnimal': 'Save animal',
  'formAnimal.guardarAlteracoes': 'Save changes',
  'formAnimal.guardado': 'Animal saved',
  'formAnimal.registado': 'Animal recorded',
  'formAnimal.semGuardar': 'Animal not saved',
  'formAnimal.semRegistar': 'Animal not recorded',
  'formAnimal.eliminado': 'Animal deleted',
  'formAnimal.eliminarAnimal': 'Delete animal',
  'formAnimal.eliminarPergunta': 'Delete "{rotulo}"? This cannot be undone.',
  'formAnimal.eliminarExplicacao':
    'The animal leaves the list and the family tree: deleting means it was recorded by mistake. The record stays in the herd history, with the day and the name of whoever deleted it.',
  'formAnimal.eliminarAjuda':
    'For records made by mistake. It takes the animal out of the list and the family tree, for good. If the animal really existed, mark it as gone (died or sold) instead of deleting.',
  'formAnimal.animalEliminado': 'Animal deleted',
  'formAnimal.naoSeAltera': 'This record can no longer be changed',
  'formAnimal.eliminadoMensagem':
    'The animal was deleted from the list, and the record stays as it is, with the day and the name of whoever deleted it. You can see it in the herd history.',
  'formAnimal.fichaDoGestor': 'The record belongs to whoever runs the herd',
  'formAnimal.fichaDoGestorEditar':
    'You can record what you do to this animal (a vaccine, a medicine, a birth), but the record details are changed by whoever runs the farm.',
  'formAnimal.fichaDoGestorNovo':
    'Recording new animals is for whoever runs the farm. You can record treatments on the animals already there.',

  /* ---- Ficha do animal ---- */
  'ficha.animal': 'Animal',
  'ficha.naoEncontrado': 'Animal not found',
  'ficha.jaNaoExiste': 'This record no longer exists.',
  'ficha.dataInvalida': 'Invalid date: use dd/mm/yyyy.',
  'ficha.vendaRegistada': 'Sale recorded',
  'ficha.morteRegistada': 'Death recorded',
  'ficha.saidaNaoRegistada': 'Departure not recorded',
  'ficha.reativarTitulo': 'Bring it back?',
  'ficha.reativarMensagem':
    'The animal will show up in the herd again. The earlier record (Death/Sale) stays in the history.',
  'ficha.reativar': 'Bring back',
  'ficha.reativado': 'Animal brought back',
  'ficha.semReativar': 'Could not bring the animal back',
  'ficha.falecido': 'Died',
  'ficha.vendido': 'Sold',
  'ficha.eliminado': 'Deleted',
  'ficha.saidaDoEfetivo': 'Left the herd',
  'ficha.motivo': 'Reason',
  'ficha.falecimento': 'Death',
  'ficha.venda': 'Sale',
  'ficha.eliminadoDaLista': 'Deleted from the list',
  'ficha.data': 'Date',
  'ficha.semData': 'No date',
  'ficha.registadoPor': 'Recorded by',
  'ficha.alguemDaEquipa': 'Someone on the team',
  'ficha.nota': 'Note',
  'ficha.eliminadoExplicacao':
    'The record is still kept: this animal history and the family tree of its offspring stay intact. It just no longer shows up in the animal list.',
  'ficha.saidaExplicacao':
    'The record is kept so the family tree of the offspring stays intact.',
  'ficha.identificacao': 'Identification',
  'ficha.numeroIdentificacao': 'Ear tag number',
  'ficha.dataIdentificacao': 'Date tagged',
  'ficha.naoIndicada': 'Not given',
  'ficha.comunicado': 'Reported',
  'ficha.naoSeAplica': 'Not applicable',
  'ficha.nascimentoEGenealogia': 'Birth and parentage',
  'ficha.racaPelagem': 'Breed / coat',
  'ficha.cobertaHa': 'Mated for',
  'ficha.porConfirmarHa': 'Unconfirmed for',
  'ficha.partos': 'Calvings',
  'ficha.aindaNenhum': 'None yet',
  'ficha.localizacao': 'Where it is',
  'ficha.semExploracao': 'No farm',
  'ficha.terrenoAtual': 'Current plot',
  'ficha.balanco': 'Balance',
  'ficha.receitaVenda': 'Income (sale)',
  'ficha.custos': 'Costs (purchase, treatments)',
  'ficha.historico': 'History',
  'ficha.semEventos': 'Nothing recorded for this animal yet.',
  'ficha.editarDados': 'Edit the animal details',
  'ficha.registarEvento': 'Record something',
  'ficha.marcarSaida': 'Mark as died / sold',
  'ficha.voltarAAtivar': 'Bring the animal back',
  'ficha.eliminadoNaoSeAltera':
    'This record was deleted and can no longer be changed. It stays as it is, for the history and the audit trail.',
  'ficha.marcarSaidaTitulo': 'Mark as having left the herd',
  'ficha.dataFormato': 'Date (dd/mm/yyyy)',
  'ficha.calendarioSaida': 'Pick the departure date on the calendar',
  'ficha.precoVenda': 'Sale price (€), optional',
  'ficha.exPreco': 'e.g. 1350',
  'ficha.notaOpcional': 'Note (optional): buyer, abattoir, cause, and so on.',
  'ficha.exNotaVenda': 'e.g. sold to Mr Silva',
  'ficha.exNotaMorte': 'e.g. illness',
  'ficha.confirmar': 'Confirm',
  'ficha.semRegisto': 'Nothing recorded',
  'ficha.verArvore': 'See the family tree',
  'ficha.verArvoreComCrias': 'See the family tree ({n} calf)|See the family tree ({n} calves)',

  /* ---- Registar um evento ---- */
  'evento.registarParto': 'Record a birth',
  'evento.partoRegistado': 'Birth recorded',
  'evento.registarCobricao': 'Record a mating',
  'evento.cobricaoRegistada': 'Mating recorded',
  'evento.registarDiagnostico': 'Record a diagnosis',
  'evento.diagnosticoRegistado': 'Diagnosis recorded',
  'evento.registarVacina': 'Record a vaccination',
  'evento.vacinaRegistada': 'Vaccination recorded',
  'evento.registarMedicamento': 'Record a medicine',
  'evento.medicamentoRegistado': 'Medicine recorded',
  'evento.registarPesagem': 'Record a weighing',
  'evento.pesagemRegistada': 'Weighing recorded',
  'evento.ha2Dias': '2 days ago',
  'evento.naoGuardado': 'Record not saved',
  'evento.tenteNovamente': 'Try again.',
  'evento.criaPorRegistar': 'Birth saved, calf still to record',
  'evento.guardadoComFalhas': 'Saved, with failures',
  'evento.ficouRegistadoEm': 'Recorded on {n} animal.|Recorded on {n} animals.',
  'evento.naoFoiPossivelEm': 'It failed on: {nomes}.',
  'evento.semPermissaoTitulo': 'You cannot record here',
  'evento.semPermissaoMensagem':
    'Whoever runs this farm has not given you access to record treatments. Talk to them if you think this is a mistake.',
  'evento.tipoDeRegisto': 'What are you recording?',
  'evento.maeFemea': 'Dam (female)',
  'evento.femea': 'Female',
  'evento.macho': 'Male',
  'evento.nEscolhidos': '{n} chosen|{n} chosen',
  'evento.semFemeas': 'No females recorded.',
  'evento.semAnimais': 'No animals recorded yet.',
  'evento.ouDataExata': 'Or an exact date (dd/mm/yyyy), to record something that already happened',
  'evento.exData': 'e.g. 15/03/2026',
  'evento.calendarioData': 'Pick the date on the calendar',
  'evento.tipoDeParto': 'Type of birth',
  'evento.resultado': 'Outcome',
  'evento.nadoVivo': 'Born alive',
  'evento.nadoMorto': 'Stillborn',
  'evento.sexoDaCria': 'Sex of the calf',
  'evento.criaComoAnimalNovo':
    'We save the calf as a new animal, with this sex, the date of the birth and the dam already filled in.',
  'evento.criaViva':
    'The calf is recorded on its own, incomplete: add its ear tag within 20 days and report the birth to SNIRA. If two calves were born, record two births.',
  'evento.umPartoPorCria': 'One birth per calf: if two were born, record two births.',
  'evento.como': 'How',
  'evento.escolhaTouroOuEscreva':
    'Pick one above or type another. If you do not know which it was (herd running with the bull), leave it empty.',
  'evento.touroDesconhecido':
    'If you do not know which it was (herd running with the bull), leave it empty.',
  'evento.partoPrevistoPara':
    'Calving expected on {data}, counted from the mating on {cobricao}. It goes on the record and on the calendar.',
  'evento.semCobricaoAnterior':
    'There is no mating recorded before this date, so the app cannot work out the expected calving. Record the mating, or type the expected date on the animal record.',
  'evento.dataPartoApagada': 'The expected calving date on the record will be cleared.',
  'evento.veterinario': 'Vet',
  'evento.exVeterinario': 'e.g. Dr Sousa',
  'evento.saiDoStock': 'Taken from stock',
  'evento.naoRegistar': 'Do not record',
  'evento.quantoSeGastou': 'How much was used, in {unidade}',
  'evento.restamNesteLote': '{resta} left in this batch.',
  'evento.vacinaDoenca': 'Vaccine / disease',
  'evento.exVacina': 'e.g. Bluetongue',
  'evento.lote': 'Batch',
  'evento.exLote': 'e.g. 4471',
  'evento.proximaDose': 'Next dose',
  'evento.medicamento': 'Medicine',
  'evento.exMedicamento': 'e.g. Antibiotic',
  'evento.dose': 'Dose',
  'evento.exDose': 'e.g. 20 ml',
  'evento.via': 'Route',
  'evento.exMotivo': 'e.g. Mastitis',
  'evento.intervaloSeguranca': 'Withdrawal period (days)',
  'evento.naoVenderAte': 'Do not sell for slaughter until {data}.',
  'evento.peso': 'Weight (kg)',
  'evento.exPeso': 'e.g. 520',
  'evento.custo': 'Cost (€)',
  'evento.custoPorAnimal': 'Cost per animal (€)',
  'evento.exCusto': 'e.g. 45',
  'evento.notas': 'Notes',
  'evento.exNotas': 'Observations (optional)',
  'evento.guardarRegisto': 'Save record',
  'evento.guardarEmNAnimais': 'Save on {n} animal|Save on {n} animals',

  /* ---- Formulário do terreno ---- */
  'formTerreno.terreno': 'Plot of land',
  'formTerreno.editar': 'Edit plot',
  'formTerreno.naoEncontrado': 'Plot not found',
  'formTerreno.criar': 'Create plot',
  'formTerreno.guardado': 'Plot saved',
  'formTerreno.adicionado': 'Plot added',
  'formTerreno.semGuardar': 'Plot not saved',
  'formTerreno.semAdicionar': 'Plot not added',
  'formTerreno.eliminado': 'Plot deleted',
  'formTerreno.eliminarTerreno': 'Delete plot',
  'formTerreno.vaiEliminar': 'You are about to delete "{nome}".',
  'formTerreno.ficamSemTerreno':
    'The {n} animal there is left without a plot,|The {n} animals there are left without a plot,',
  'formTerreno.nenhumSePerde': 'No animal is lost:',
  'formTerreno.eliminarDetalhe':
    'nothing is deleted apart from the plot itself. The expenses charged to it stay in the farm books.',
  'formTerreno.semPermissaoTitulo': 'Land belongs to whoever runs the farm',
  'formTerreno.semPermissaoEditar':
    'You can see this plot and the animals on it, but changing it is for whoever runs the farm.',
  'formTerreno.semPermissaoNovo': 'Recording new land is for whoever runs the farm.',
  'formTerreno.semExploracoesTitulo': 'No farms',
  'formTerreno.semExploracoesMensagem': 'Create a farm first so you can add land to it.',
  'formTerreno.exploracaoE': 'Farm: {nome}',
  'formTerreno.assuntoFoto': 'of the plot',
  'formTerreno.exNome': 'e.g. Lower Meadow',
  'formTerreno.tipo': 'Type',
  'formTerreno.area': 'Area (hectares)',
  'formTerreno.exArea': 'e.g. 4.2',
  'formTerreno.descricao': 'Description',
  'formTerreno.exDescricao': 'e.g. Well and trough to the north',
  'formTerreno.localizacaoNoMapa': 'Location on the map',
  'formTerreno.toqueNoMapa': 'Tap the map to mark the plot.',
  'formTerreno.limparLocalizacao': 'Clear the location',

  /* ---- Associar animais a um terreno ---- */
  'associar.titulo': 'Put animals here',
  'associar.ajuda': 'tap an animal to put it in or take it out of',
  'associar.semAnimais': 'This farm has no animals recorded yet.',
  'associar.procurar': 'Search by name, tag, breed or number',
  'associar.grupoVazio': 'No animals in this group.',
  'associar.guardaSozinho': 'Changes are saved automatically.',
  'associar.dentro': 'on this plot',
  'associar.fora': 'not on this plot',

  /* ---- Formulário da exploração ---- */
  'formExploracao.editar': 'Edit farm',
  'formExploracao.criar': 'Create farm',
  'formExploracao.naoEncontrada': 'Farm not found',
  'formExploracao.guardada': 'Farm saved',
  'formExploracao.criada': 'Farm created',
  'formExploracao.semGuardar': 'Farm not saved',
  'formExploracao.semCriar': 'Farm not created',
  'formExploracao.eliminada': 'Farm deleted',
  'formExploracao.eliminarExploracao': 'Delete farm',
  'formExploracao.vaiEliminar': 'You are about to delete "{nome}" and everything in it:',
  'formExploracao.eliminarDetalhe':
    'It also takes the animals that had already left the herd, and their parentage with them. This cannot be undone.',
  'formExploracao.nada': 'nothing',
  'formExploracao.nDespesas': '{n} expense or income entry|{n} expense and income entries',
  'formExploracao.soComContaPropriaTitulo': 'Only for people with a farm of their own',
  'formExploracao.soComContaPropriaMensagem':
    'You came into this app on an invitation from whoever runs a farm, and that is where you work. To open a farm of your own, create your own account.',
  'formExploracao.semPermissaoTitulo': 'The farm belongs to whoever runs it',
  'formExploracao.semPermissaoMensagem':
    'The name, the holding number, the tax number and the location are changed by whoever answers for it. You can still work on the animals and on whatever is yours to do.',
  'formExploracao.ajuda': 'Official details of the holding. Every field with * is required.',
  'formExploracao.exNome': 'e.g. Hillside Farm',
  'formExploracao.marca': 'Holding number',
  'formExploracao.exMarca': 'PT 00 000 0000',
  'formExploracao.nif': 'Keeper tax number',
  'formExploracao.localizacao': 'Location',
  'formExploracao.exLocalizacao': 'e.g. Idanha-a-Nova',
  'formExploracao.localizacaoAjuda':
    'Type the name of the place and pick it from the list. That is enough for the local weather.',
  'formExploracao.fecharMapa': 'Close the map',
  'formExploracao.verNoMapa': 'See it on the map',
  'formExploracao.marcarNoMapa': 'Or mark on the map where it is',
  'formExploracao.toqueNoMapa': 'Tap the map to mark the farm.',
  'formExploracao.limparMarca': 'Clear the mark on the map',

  /* ---- Formulário do lote (existências) ---- */
  'formLote.lote': 'Batch',
  'formLote.exLote': 'e.g. PN-2291',
  'formLote.loteAjuda': 'It is on the label. It is how a bottle is traced in an inspection.',
  'formLote.guardado': 'Batch saved',
  'formLote.entradaRegistada': 'Stock recorded',
  'formLote.eliminado': 'Batch deleted',
  'formLote.eliminarLote': 'Delete batch',
  'formLote.eliminarComUso':
    '{usado} of this batch has already been given. The treatments stay on record, but they stop saying which bottle they came from.',
  'formLote.semPermissaoTitulo': 'You cannot do this',
  'formLote.semPermissao':
    'Adding medicines to stock is for whoever runs the farm. You can still pick from the batches already there when you record a treatment.',
  'formLote.nomeProduto': 'Product name',
  'formLote.exNome': 'e.g. Penicillin',
  'formLote.validade': 'Expiry date',
  'formLote.exValidade': 'e.g. 31/12/2027',
  'formLote.calendarioValidade': 'Pick the expiry date on the calendar',
  'formLote.quantidade': 'Quantity',
  'formLote.exQuantidade': 'e.g. 250',
  'formLote.quantidadeAjuda':
    'What the bottle came with, not what is left. The app works out what is left.',
  'formLote.quantidadeAbaixo':
    '{usado} of this batch has already been given. A smaller quantity than that leaves the stock at zero.',
  'formLote.exSeguranca': 'e.g. 10',
  'formLote.segurancaAjuda':
    'It is on the leaflet. The app suggests it when this batch is used in a treatment, so the animal does not go for slaughter too early.',
  'formLote.fornecedor': 'Supplier',
  'formLote.exFornecedor': 'e.g. Agro-Nisa',
  'formLote.dataCompra': 'Date of purchase',
  'formLote.exDataCompra': 'e.g. 15/03/2026',
  'formLote.calendarioCompra': 'Pick the purchase date on the calendar',
  'formLote.custoTotal': 'Total cost (€)',
  'formLote.exCusto': 'e.g. 95',
  'formLote.lancaDespesa': 'Enter the expense under Sanidade',
  'formLote.naoLancaDespesa': 'Do not enter an expense in the books',
  'formLote.despesaLancada': 'expense entered under Sanidade',

  /* ---- Interruptores da conta (finanças, existências) ---- */
  'interruptor.soQuemGere': 'Only for whoever runs the farm',
  'interruptor.soQuemGereFinancas':
    'This setting belongs to the farm owner. Talk to them if you need to record expenses in the app.',
  'interruptor.soQuemGereExistencias':
    'This setting belongs to the farm owner. Talk to them if you need to add medicines to stock in the app.',
  'interruptor.oQueMuda': 'What this changes',
  'interruptor.registarContas': 'Keep the books in the app',
  'interruptor.gerirArrecadacao': 'Manage the medicine store in the app',
  'interruptor.desligarNaoApaga':
    'Turning it off deletes nothing. Whatever you record stays saved, even if you turn it off again later.',
  'interruptor.desligarComMovimentos':
    'Turning it off deletes nothing. The entry you already recorded stays saved and comes back if you turn it on again.|Turning it off deletes nothing. The {n} entries you already recorded stay saved and come back if you turn it on again.',
  'interruptor.desligarComLotes':
    'Turning it off deletes nothing. The batch you already recorded stays saved and comes back if you turn it on again.|Turning it off deletes nothing. The {n} batches you already recorded stay saved and come back if you turn it on again.',
  'interruptor.valeParaTodas': 'This setting applies to all your farms.',
  'interruptor.obrigacaoLegal':
    'The medicine register is required by law and can be asked for in an inspection. Only turn it off if you keep it somewhere else.',
  'interruptor.financas1Titulo': 'Expenses and income',
  'interruptor.financas1Texto':
    'Feed, power, fuel, rent, sales and subsidies. Without this, nobody on your team can record amounts.',
  'interruptor.financas2Titulo': 'The Finances tab',
  'interruptor.financas2Texto':
    'Balance, month by month, and where most of the money goes. Turned off, the tab disappears from the app.',
  'interruptor.financas3Titulo': 'Cost of vaccines and medicines',
  'interruptor.financas3Texto':
    'The cost field stops showing when you record a treatment. The health record stays the same: only the amount is not asked for.',
  'interruptor.existencias1Titulo': 'The Stock tab',
  'interruptor.existencias1Texto':
    'The batches you bought, what is left of each one and the expiry date. Turned off, the tab disappears from the app.',
  'interruptor.existencias2Titulo': 'Picking the batch on a treatment',
  'interruptor.existencias2Texto':
    'When recording a vaccine or a medicine you stop being asked which bottle it came from. The health record stays the same: the animal, the date, the product and the withdrawal period are all still there.',
  'interruptor.existencias3Titulo': 'Expiry and stock warnings',
  'interruptor.existencias3Texto':
    'You stop being warned when a batch is running out or nearing its expiry date.',

  /* ---- Aspeto da app ---- */
  'aspeto.titulo': 'How the app looks',
  'aspeto.mudar': 'Change',
  'aspeto.vaiRecarregar':
    'The app reopens so everything picks up the new colours. Nothing you have recorded is lost, and the other devices where you sign in with this account will open like this too.',
  'aspeto.coresDosAvisos':
    'Alert colours do not change: red still means a deadline passed, amber this week and blue information.',
  'aspeto.exemploAnimal': 'Daisy · 12 years',
  'aspeto.exemploRaca': 'Bovino · Mertolenga',
  'idioma.escolhaGuardada': 'Choice saved',

  /* ---- Editar dados pessoais ---- */
  'editarConta.ajuda':
    'The name and email on your account. The animals and farms are not affected.',
  'editarConta.emailAjuda':
    'When you change the email we send a confirmation link to the new address: the change only takes effect then.',
  'editarConta.confirmeEmail': 'Confirm the new email',
  'editarConta.atualizados': 'Details updated',
  'editarConta.guardadas': 'The changes were saved.',
  'editarConta.modoOffline':
    'This app is in offline mode. Changing your account details needs a connection.',

  /* ---- Ficha de um terreno ---- */
  'detTerreno.area': 'Area',
  'detTerreno.semArea': 'No area',
  'detTerreno.comoChegar': 'How to get there:',
  'detTerreno.semLocalizacao': 'Not on the map. Edit the plot to mark where it is.',
  'detTerreno.semAnimais': 'No animals on this plot yet. Put the ones that are here.',

  /* ---- Ficha de uma exploração ---- */
  'detExploracao.semLocalizacao': 'No location',
  'detExploracao.areaTotal': 'Total area',
  'detExploracao.entrouComo': 'You came in as a {papel}',
  'detExploracao.meteorologia': 'Local weather',
  'detExploracao.aObter': 'Getting the weather…',
  'detExploracao.semLocalizacaoDefinida': 'No location set.',
  'detExploracao.semLigacaoMeteo': 'No connection to the weather service.',
  'detExploracao.editeParaLocalizar':
    'Edit the farm and type the location, or mark on the map where it is.',
  'detExploracao.dados': 'Farm details',
  'detExploracao.adicionarTerreno': 'Add a plot',
  'detExploracao.adicionar': 'Add',
  'detExploracao.editarDados': 'Edit the farm details',
  'detExploracao.gerirEquipa': 'Manage the team and invitations',

  /* ---- Formulário do movimento (despesa / receita) ---- */
  'formMovimento.movimento': 'Entry',
  'formMovimento.editar': 'Edit entry',
  'formMovimento.registarReceita': 'Record income',
  'formMovimento.guardarMovimento': 'Save entry',
  'formMovimento.guardado': 'Entry saved',
  'formMovimento.receitaRegistada': 'Income recorded',
  'formMovimento.despesaRegistada': 'Expense recorded',
  'formMovimento.semGuardar': 'Entry not saved',
  'formMovimento.receitaSemRegistar': 'Income not recorded',
  'formMovimento.despesaSemRegistar': 'Expense not recorded',
  'formMovimento.eliminado': 'Entry deleted',
  'formMovimento.eliminarMovimento': 'Delete entry',
  'formMovimento.naoEncontrado': 'Entry not found',
  'formMovimento.naoEncontradoMensagem':
    'This entry no longer exists, or it was deleted on another device.',
  'formMovimento.naoESeuTitulo': 'This entry is not yours',
  'formMovimento.naoESeuMensagem':
    'Each person corrects what they entered. To change this one, talk to whoever runs the farm.',
  'formMovimento.naoMudaExploracao':
    'An entry does not move between farms. If it was on the other one, delete it and enter it again.',
  'formMovimento.ha1Mes': 'A month ago',
  'formMovimento.ouOutraData': 'Or another date (dd/mm/yyyy)',
  'formMovimento.calendarioData': 'Pick the date on the calendar',
  'formMovimento.comprador': 'Buyer',
  'formMovimento.animalAjuda':
    'Only if this entry really is about one animal. Leave it empty for costs of the whole farm.',
  'formMovimento.soDespesas':
    'You can record expenses. Income (sales, subsidies) is entered by whoever runs the farm.',
  'formMovimento.entra': 'In',
  'formMovimento.sai': 'Out',
  'formMovimento.historicoAlteracoes': 'Change history',
  'formMovimento.semHistorico': 'Could not load the history. Try again with an internet connection.',
  'formMovimento.semAlteracoes':
    'No changes recorded. Older entries, and those made without a server, have no history.',

  /* ---- Comunicar ao SNIRA ---- */
  'snira.marcado': 'Marked as reported',
  'snira.semMarcar': 'Could not mark it',
  'snira.aComunicar': 'Reporting',
  'snira.relatorioTitulo': 'SNIRA reports',
  'snira.relatorioGuardado': 'Report saved',
  'snira.relatorioDescarregado': 'Report downloaded',
  'snira.abraEImprima': 'Open it and print to PDF.',
  'snira.reservadoTitulo': 'For whoever runs the farm',
  'snira.reservadoMensagem':
    'Reporting to SNIRA is for whoever answers for the farm. You can still record what you do to each animal.',
  'snira.vazioTitulo': 'Nothing to report',
  'snira.vazioMensagem':
    'Every birth, death and departure you have recorded is already reported. When you record a new one it shows up here with its deadline counting down.',
  'snira.porComunicar': 'To report',
  'snira.ate3Dias': 'Within 3 days',
  'snira.abrirIDigital': 'Open iDigital',
  'snira.levarEmExcel': 'Take it in Excel',
  'snira.imprimirFolha': 'Print the sheet',
  'snira.guardarPdf': 'Save as PDF',
  'snira.semImpressao': 'Could not open the print dialog',
  'snira.navegadorBloqueou': 'The browser blocked the window.',
  'snira.soNoComputador':
    'To take this list in Excel or on paper, open the app on a computer. Here you can check it and mark what you have already reported.',
  'snira.semBrinco': 'No ear tag recorded. The portal needs it.',
  'snira.ultimoDia': 'Last day',
  'snira.aMarcar': 'Marking…',
  'snira.jaComuniquei': 'I have reported it',

  /* ---- Gaveta de documentos ---- */
  'gaveta.gaveta': 'Drawer',
  'gaveta.semAcesso': 'No access',
  'gaveta.semCamara':
    'The app needs permission to use the camera. You can give it in your phone settings.',
  'gaveta.semGaleria': 'The app needs permission to see your photos.',
  'gaveta.semImagem': 'Could not prepare the image',
  'gaveta.semAbrir': 'Could not open it',
  'gaveta.eliminarDocumento': 'Delete document',
  'gaveta.eliminado': 'Document deleted',
  'gaveta.vaziaTitulo': 'The drawer is empty',
  'gaveta.vaziaPodeGuardar':
    'Photograph a piece of paper and it stays here, on the farm and not on your phone.',
  'gaveta.vaziaSemPermissao': 'Nothing kept in this drawer yet.',
  'gaveta.fotografar': 'Take a photo',
  'gaveta.daGaleria': 'From the gallery',
  'gaveta.guardarAqui': 'Keep it in this drawer',
  'gaveta.guardadoPorSi': 'Kept by you',
  'gaveta.guardadoPor': 'Kept by {nome}',
  'gaveta.autorDesconhecido': 'Unknown author',
  'gaveta.precisaNome': 'The document needs a name.',
  'gaveta.alterado': 'Document changed',
  'gaveta.semAlterar': 'Could not change it',
  'gaveta.alterarDocumento': 'Change document',
  'gaveta.exTitulo': 'e.g. Feed invoice for July',
  'gaveta.eliminarPergunta':
    'You are about to delete "{titulo}" and the image kept with it. There is no way back.',

  /* ---- Histórico do efetivo ---- */
  'motivo.falecidos': 'Died',
  'motivo.vendidos': 'Sold',
  'motivo.eliminados': 'Deleted',
  'histAnimal.titulo': 'Herd history',
  'histAnimal.ajuda':
    'The animals that left the herd. None of these records was deleted: they stay here with the day and the name of whoever recorded them.',
  'histAnimal.procurar': 'Name or ear tag',
  'histAnimal.vazioTitulo': 'No animal has left yet',
  'histAnimal.vazioMensagem':
    'When you mark a death or a sale, or delete a record, what happened is written here.',
  'histAnimal.semFiltrosTitulo': 'Nothing with those filters',
  'histAnimal.semFiltrosMensagem': 'Try another reason, another farm, or clear the search.',
  'histAnimal.porEQuando': 'Recorded by {autor}, {quando}',
  'histAnimal.porQuem': 'Recorded by {autor}',
  'histAnimal.quando': 'Recorded {quando}',
  'histAnimal.semAutor': 'No record of who did it',

  /* ---- Histórico de lançamentos ---- */
  'histMovimento.reservadoMensagem':
    'Only whoever runs the farm can see who entered each item.',
  'histMovimento.ajuda':
    'Every entry in the order it reached the app, with the name of whoever recorded it and the time.',
  'histMovimento.vazioTitulo': 'Nothing recorded yet',
  'histMovimento.vazioMensagem':
    'As soon as someone enters an expense or income, it says here who it was and at what time.',
  'histMovimento.soFinancas':
    'Only expenses and income entered under Finances. The cost of a vaccine or a medicine stays in the animal history, next to the treatment.',
  'histMovimento.semAutor': 'No record of who entered it',

  /* ---- Faixas de aviso no topo dos ecrãs ---- */
  'banner.acessoTerminouTitulo': 'Your access has ended',
  'banner.acessoTerminouTexto':
    'Your time on the farm is up, so you no longer see its animals or its records. Your account is still there: ask whoever invited you for a new code to get back in.',
  'banner.acessoAcabaTexto':
    'After that you stop seeing this farm. Finish what you have in hand, or ask whoever invited you for more time.',
  'banner.jaDescarregada': 'It is already downloaded. The app closes and reopens on its own.',
  'banner.dispensar': 'Dismiss',
  'banner.atualizarAgora': 'Update now',
  'banner.aAtualizar': 'Updating…',
  'banner.conflitoTexto':
    'Someone else touched the same records first. See what is missing and record again whatever still makes sense.',
  'banner.recusadoTexto':
    'The server did not accept them. See which ones: what was recorded in them is not saved.',
  'banner.verOQueFalhou': 'See what failed',
  'banner.suspensaPropria':
    'You can see and export everything you have recorded, but for now changes cannot be saved. Talk to us to reactivate the account.',
  'banner.suspensaDoDono':
    'You can look at this farm data, but not save changes. The account of whoever answers for the farm is suspended.',

  /* ---- Nova palavra-passe ---- */
  'novaPalavra.titulo': 'New password',
  'novaPalavra.subtitulo': 'Choose a new password',
  'novaPalavra.confirmar': 'Confirm password',
  'novaPalavra.repita': 'Type the password again',
  'novaPalavra.curta': 'The password must have at least 6 characters.',
  'novaPalavra.naoCoincidem': 'The passwords do not match.',
  'novaPalavra.guardar': 'Save the new password',

  /* ---- Ecrã de arranque ---- */
  'carregar.aAbrir': 'Opening Terrabovina…',
  'carregar.aDemorar':
    'This is taking longer than usual. It may be the connection, or your session may have expired and need signing in again.',
  'carregar.sairEEntrar': 'Sign out and sign in again',

  /* ---- Escolher uma fotografia ---- */
  'foto.semAutorizacao': 'No permission',
  'foto.semAutorizacaoTexto':
    'The phone is blocking access to the camera or the photos. You can allow it in the system settings.',
  'foto.semUsar': 'Could not use the photo',
  'foto.tirarFoto': 'Take a photo',

  /* ---- Conta por aprovar / por código ---- */
  'pendente.bemVindo': 'Welcome',
  'pendente.faltaCodigo': 'The code is missing',
  'pendente.aAguardar': 'Waiting for approval',
  'pendente.contaAtiva': 'Your account is active',
  'pendente.contaPendente': 'Your account is pending',
  'pendente.pecaCodigo':
    'Ask whoever runs the farm you will work on for the invite code, and type it below.',
  'pendente.podeCriar': 'You can create your first farm or join one with an invite code.',
  'pendente.semEsperar':
    'You do not have to wait for anyone: with a farm invite code you get in right away. Ask whoever runs it.',
  'pendente.emAnalise':
    'The platform administrator will look at your request. If you have been given an invite code by a client, you can use it right now to get in.',
  'pendente.conta': 'Account: {email}',
  'pendente.criarDescricao': 'Record my farm and start adding animals.',
  'pendente.tenhoCodigo': 'I have a code',
  'pendente.tenhoCodigoDescricao': "Join someone else's farm with an invite code.",
  'pendente.criarEContinuar': 'Create and carry on',
  'pendente.codigoConvite': 'Invite code',
  'pendente.exCodigo': 'e.g. A7BXK2M9',
  'pendente.pecaAoResponsavel': 'Ask whoever answers for the farm for the code.',
  'pendente.entrarComCodigo': 'Get in with this code',
  'pendente.verificarNovamente': 'Check again',
  'pendente.apagarExplicacao':
    'Changed your mind? You can delete your account and your sign-up details. Nobody has to approve it first.',
  'pendente.codigoInvalido': 'Invalid code.',
  'pendente.codigoUsado': 'This code has already been used.',
  'pendente.codigoExpirado': 'This code has expired. Ask the client for a new one.',

  /* ---- Notificações e alertas ---- */
  'notif.explicacao':
    'Choose which alerts show up on the home screen. Deadlines already passed, or urgent ones, always show, even if the category is off.',
  'notif.repor': 'Reset',
  'notif.reporTitulo': 'Reset the preferences',
  'notif.reporMensagem':
    'Back to the recommended settings: every category on, with the default notice periods.',
  'notif.reporRecomendacoes': 'Reset to recommended',
  'notif.autorizacaoRecusada': 'Permission refused',
  'notif.autorizacaoRecusadaTexto':
    'The phone is blocking this app notifications. You can allow them in the system settings, under Notifications.',
  'notif.avisarNoTelemovel': 'Notify me on the phone',
  'notif.avisarLigado':
    'The phone tells you in the morning when a deadline is coming up, even with the app closed and no internet.',
  'notif.avisarDesligado': 'Alerts only show up when you open the app.',
  'notif.vibrar': 'Vibrate on save',
  'notif.vibrarLigado':
    'The device gives a short buzz when a record is saved, and a different one when something fails. You can tell without reading the screen.',
  'notif.vibrarDesligado': 'Records are only confirmed by the message on screen.',
  'notif.som': 'Sound on save',
  'notif.somLigado':
    'The app plays a short sound when a record is saved, and a different one when something fails. A device on silent stays silent.',
  'notif.somDesligado': 'Records are only confirmed by the message on screen and by the buzz.',
  'notif.dispensados': 'Dismissed alerts',
  'notif.dispensadosAjuda':
    'These alerts do not show on the home screen. They come back on their own if things get worse.',
  'notif.comecarAAvisar': 'Start warning',
  'notif.menosDias': 'Fewer days',
  'notif.maisDias': 'More days',

  /* ---- Sincronização e cópia ---- */
  'sinc.offline': 'Offline',
  'sinc.aSincronizar': 'Syncing',
  'sinc.aSincronizarPontos': 'Syncing…',
  'sinc.sincronizado': 'Synced',
  'sinc.sincronizarAgora': 'Sync now',
  'sinc.semLigacao':
    'No connection. Changes are kept on the device and sent automatically once the network is back.',
  'sinc.tudoEnviado': 'Everything sent. The data on the server is up to date.',
  'sinc.perdidas': 'CHANGES LOST',
  'sinc.semGravar': 'COULD NOT BE SAVED',
  'sinc.perdidasTexto':
    'They were made offline and never reached the server. Check what is missing and record again whatever still makes sense.',
  'sinc.recusadasTexto':
    'They were made offline and the server did not accept them, usually for lack of permission on that farm.',
  'sinc.esquecer': 'Forget',
  'sinc.esquecerLista': 'Forget this list',
  'sinc.esquecerTitulo': 'Forget the refused changes',
  'sinc.esquecerMensagem':
    'The list stops showing. The changes themselves are already gone: if you still need them, you have to make them again.',
  'sinc.copiaGuardada': 'Copy saved',
  'sinc.copiaGuardadaTexto':
    'We saved a copy of your data on this device. Keep the file somewhere safe.',
  'sinc.descarregarCopia': 'Download a copy (JSON)',

  /* ---- Seletor de animais ---- */
  'selAnimais.escolhaTerreno': 'Choose the plot the animal is on.',
  'selAnimais.trocarTerreno': 'Change plot',
  'selAnimais.semAnimaisNoTerreno': 'No animals on this plot.',
  'selAnimais.trocarAnimal': 'Change animal',
  'selAnimais.trocar': 'Change',

  /* ---- Mudar o gado de terreno ---- */
  'mover.titulo': 'Move the herd to another plot?',
  'mover.paraQueTerreno': 'Move to which plot?',
  'mover.semMudarTudo': 'Could not move them all',

  /* ---- Guardar um documento ---- */
  'guardarDoc.titulo': 'Keep document',
  'guardarDoc.guardado': 'Document kept',
  'guardarDoc.semGuardar': 'Document not kept',
  'guardarDoc.escolhaExploracao': 'Choose the farm this document belongs to.',
  'guardarDoc.imagemPronta': 'Image ready',
  'guardarDoc.faltaDizer': 'Now say what it is and who can see it.',
  'guardarDoc.oQueE': 'What it is',
  'guardarDoc.precisaLigacao':
    'Keeping a document needs a connection: the image goes up to your account.',
  'guardarDoc.quemVe': 'Who sees it',
  'guardarDoc.todaEquipa': 'The whole team',
  'guardarDoc.todaEquipaDescricao': 'Anyone who works on this farm can open this document.',
  'guardarDoc.soEu': 'Only me',
  'guardarDoc.soEuDescricao': 'Nobody else sees it, not even the farm owner.',
  'guardarDoc.vetsNaoVeem': 'Either way, vets see no documents at all.',

  /* ---- Secção dos documentos ---- */
  'seccaoDocs.vazia': 'Empty.',
  'seccaoDocs.vaziaCurto': 'Empty',
  'seccaoDocs.nDocumentos': '{n} document|{n} documents',
  'seccaoDocs.contaSuspensa':
    'With the account unsettled you can look at the documents, but not keep new ones.',
  'seccaoDocs.semPermissao': 'Keeping documents is for whoever has a farm in their charge.',

  /* ---- Escrever ao apoio ---- */
  'apoio.reportar': 'Report a problem',
  'apoio.escrever': 'Write to support',
  'apoio.vaiPara': 'Goes to {email}',
  'apoio.explicacaoBug':
    'Tell us what you were doing and what happened. You do not need technical words: the app version and the device go along on their own.',
  'apoio.explicacaoMensagem':
    'Write to us with your question or what you need. We reply to your account email.',
  'apoio.assunto': 'Subject',
  'apoio.assuntoAjuda': 'One line saying what it is about.',
  'apoio.exAssuntoBug': 'The app closes when I open the animals',
  'apoio.exAssuntoDuvida': 'Question about the alerts',
  'apoio.oQueAconteceu': 'What happened',
  'apoio.aSuaMensagem': 'Your message',
  'apoio.ajudaBug': 'What you were doing, what you expected and what showed up on screen.',
  'apoio.ajudaMensagem': 'The more specific you are, the faster we can answer.',
  'apoio.exTextoBug':
    'I tapped Animals and the app closed on its own. It happened three times this morning.',
  'apoio.exTextoDuvida': 'I would like to know how to…',
  'apoio.vaiJunto': 'Sent along: {contexto}',
  'apoio.enviarProblema': 'Send the problem',
  'apoio.enviarMensagem': 'Send message',
  'apoio.problemaEnviado': 'Problem sent',
  'apoio.mensagemEnviada': 'Message sent',
  'apoio.problemaSemEnviar': 'Problem not sent',
  'apoio.mensagemSemEnviar': 'Message not sent',
  'apoio.recebemos': 'We got it. We usually reply the same working day.',

  /* ---- Avisos e erros ---- */
  'avisos.entendido': 'Understood',
  'erro.titulo': 'Something went wrong',
  'erro.dadosSeguros': 'Your data is still saved on this device: nothing was lost.',

  /* ---- Marcar um evento na agenda ---- */
  'agenda.semPermissaoTitulo': 'The calendar belongs to whoever works on the farm',
  'agenda.semPermissaoMensagem':
    'Scheduling events is for whoever runs the farm and whoever works there day to day. You can still record what you do to each animal.',
  'agenda.semExploracoesMensagem': 'Events belong to a farm. Create yours first.',
  'agenda.exTitulo': 'e.g. Idanha livestock fair',
  'agenda.dia': 'Day',
  'agenda.exDia': 'dd/mm/yyyy',
  'agenda.calendarioDia': 'Pick the day of the event',
  'agenda.horas': 'Time',
  'agenda.marcarHora': 'Set a time',
  'agenda.todaEquipaDescricao': 'Anyone who works on this farm sees this event on the calendar.',
  'agenda.soEuDescricao': 'It stays on your account. Nobody else sees it, not even the farm owner.',
  'agenda.notasAjuda': 'Anything else you need to hand that day.',
  'agenda.exNotas': 'e.g. bring the movement document and spare ear tags',
  'agenda.eliminarEvento': 'Delete event',

  /* ---- Campos do movimento ---- */
  'formMovimento.tipo': 'Type of entry',
  'formMovimento.despesa': 'Expense',
  'formMovimento.receita': 'Income',
  'formMovimento.categoria': 'Category',
  'formMovimento.valor': 'Amount (€)',
  'formMovimento.exValor': 'e.g. 860',
  'formMovimento.exDescricao': 'e.g. Feed, 40 bags',
  'formMovimento.data': 'Date',

  /* ---- Meteorologia ---- */
  'meteo.humidade': 'Humidity',
  'meteo.vento': 'Wind',
  'meteo.precipitacao': 'Rain',
  'meteo.amanha': 'Tomorrow',
  'meteo.atualizar': 'Refresh the weather',
  'meteo.grausC': '°C',
  'meteo.chuva': 'Rain {chuva}',
  'meteo.semLigacao': 'No connection',
  'meteo.esconderDias': 'Hide the coming days',
  'meteo.verProximosDias': 'See the next day|See the next {n} days',
  'meteo.mostrarMenos': 'Show less',
  'meteo.proximosDias': 'Next day|Next {n} days',
  'dia.domingo': 'Sunday',
  'dia.segunda': 'Monday',
  'dia.terca': 'Tuesday',
  'dia.quarta': 'Wednesday',
  'dia.quinta': 'Thursday',
  'dia.sexta': 'Friday',
  'dia.sabado': 'Saturday',

  /* ---- Peças soltas da interface ---- */
  'comum.voltar': 'Back',
  'comum.acao': 'Action',
  'comum.concluido': 'Done',
  'seletor.procurarOuEscrever': 'Search, or type a new one',
  'seletor.nadaEncontrado': 'Nothing found.',

  /* ---- Equipa de uma exploração ---- */
  'equipaExp.titulo': 'Team',
  'equipaExp.semPermissao': 'Only the administrator of this farm can manage the team.',
  'equipaExp.gerarCodigo': 'Generate a code',
  'equipaExp.apagarConvite': 'Delete invitation',
  'permissoes.reporPapel': 'Back to what the role gives',

  /* ---- Prazo de acesso de um convidado ---- */
  'acesso.duranteUmTempo': 'For a while',
  'acesso.ateDiaEHora': 'Until a day and time',
  'acesso.terminarJa': 'End it now',
  'acesso.tirarPrazo': 'Remove the time limit',
  'acesso.marcarEstaHora': 'Set this time',

  /* ---- Relatório de prazos ---- */
  'relatorio.prazo': 'Deadline',
  'relatorio.importancia': 'Importance',
  'relatorio.levarTodos': 'Take every deadline',
  'relatorio.imprimir': 'Print',
  'relatorio.descarregarPdf': 'Download PDF',

  /* ---- Ajuda, apagar conta, importar, genealogia, atividade ---- */
  'ajuda.reverPrimeirosPassos': 'Go through the first steps again',
  'apagar.vaiSerApagado': 'This will be deleted',
  'apagar.continuaAExistir': 'This carries on without you',
  'apagar.ajudaEscrever': 'On purpose: a red button on its own gets pressed without reading.',
  'apagar.afinalNao': 'Actually, no',
  'importar.titulo': 'Import from Excel',
  'importar.paraQueExploracao': 'Which farm is it for?',
  'importar.descarregarModelo': 'Download the template',
  'importar.descarregarModeloBotao': 'Download template',
  'importar.carregarFicheiro': 'Upload the filled-in file',
  'genealogia.titulo': 'Family tree',
  'genealogia.naoEncontrado': 'Animal not found',
  'genealogia.indicarPais': 'Set the dam and sire',
  'atividade.titulo': 'Change log',
  'atividade.aEquipa': 'The team',
  'atividade.incluirMinhas': 'Include mine',
  'histEquipa.titulo': 'Team history',
  'histEquipa.semEquipaMensagem':
    'Only a farm owner sees who has been there. If you came in by invitation, speak to whoever invited you.',
  'histEquipa.vazioTitulo': 'Nobody has left yet',
  'histEquipa.vazioMensagem':
    'When a vet time runs out, or when you remove someone from the team, it is recorded here who they were, in what role and when.',
  'histEquipa.toqueParaEquipa': 'Tap to open this farm team and give them more time',

  /* ---- Últimos rótulos soltos ---- */
  'formLote.naoEncontrado': 'Batch not found',
  'formLote.naoEncontradoMensagem': 'This batch may have been deleted on another device.',
  'formLote.semExploracoesMensagem': 'Medicines belong to a farm. Create your farm first.',
  'formAnimal.assuntoFoto': 'of the animal',
  'formExploracao.assuntoFoto': 'of the farm',
  'foto.remover': 'Remove the photo',
  'agenda.toqueParaVer': 'Tap to see it or change it',
  'avisos.toqueParaFechar': 'Tap to close this message',
  'alertas.dispensarAjuda': 'Stops showing this alert. It comes back if things get worse.',
  'erro.tentarDeNovo': 'Try again',
  'erro.enviarDetalhes': 'Send the error details',

  /* ---- Ecrã da Ajuda ---- */
  'ajuda.grupoContacto': 'NEED TO TALK TO US?',
  'ajuda.escrevaNos':
    'Write to us with your question or with what happened. We usually reply the same working day.',
  'ajuda.grupoProblema': 'SOMETHING NOT WORKING?',
  'ajuda.grupoFaq': 'COMMON QUESTIONS',
  'ajuda.grupoRecomecar': 'START OVER',
  'ajuda.reverExplicacao':
    'See the getting started guide on the home screen again, along with the explanation of each tab.',
  'ajuda.guiaReposto': 'Guide reset',
  'ajuda.guiaRepostoDetalhe':
    'The first steps are back on the home screen and the tabs introduce themselves again.',

  /* ---- Perguntas frequentes ---- */
  'faq.offlineP': 'Can I use the app without internet?',
  'faq.offlineR':
    'Yes. All the data is kept on the device and the app works the same with no network. Once the connection is back, the changes are sent to the server on their own.',
  'faq.brincoP': 'How do I tag an animal?',
  'faq.brincoR':
    'When you create or edit the animal, fill in the "Ear tag number" field. From then on the app stops showing the overdue tagging alert.',
  'faq.sniraP': 'Does the app report to SNIRA for me?',
  'faq.sniraR':
    'No. Reporting to SNIRA is still done on the official portal. The app warns you about the deadlines and marks the animal as reported once you confirm.',
  'faq.relatorioP': 'Where can I download a report?',
  'faq.relatorioR':
    'Under Documents, in the deadline report. In the desktop app it is saved straight to PDF; in a browser it is saved as a page you can print to PDF.',
  'faq.dadosP': 'Where is the data kept?',
  'faq.dadosR':
    'On the device itself, so it works offline. If you are signed in, a copy is synced to your account on the server. You can download a backup under Settings, Sync and backup.',
  'faq.sessaoP': 'How do I sign out or delete my account?',
  'faq.sessaoR':
    'Both are in Profile, at the bottom of the screen. Signing out returns to the entry screen and deletes nothing from the server. Delete my account opens a separate screen showing what will disappear (if you are the owner, the farm goes with the account, and the animals and history inside it) and only goes ahead after you type APAGAR. It is final: not even whoever runs the app can bring it back.',

  /* ---- Apagar a conta ---- */
  'apagar.intro':
    'Deleting the account is final. Nobody, not even whoever runs the app, can bring back what is lost here. Read what will disappear before carrying on.',
  'apagar.comCadaExploracao':
    'With each farm go the land, the animals, the records, the documents and the history.',
  'apagar.equipaPerdeAcesso': 'Whoever works with you loses their access.',
  'apagar.nPessoasPerdem':
    '{n} person on your team loses their access.|{n} people on your team lose their access.',
  'apagar.maisNinguem': 'Nobody else has access to these farms.',
  'apagar.deOutraPessoa':
    'These farms belong to someone else: the animals and the records stay there. What you lose is your way in: to come back you need a new invite code.',
  'apagar.porSincronizar':
    '{n} change saved on this device has not reached the server. If you delete the account now, it is lost too.|{n} changes saved on this device have not reached the server. If you delete the account now, they are lost too.',
  'apagar.escrevaParaConfirmar': 'Type {palavra} to confirm',
  'apagar.modoOffline':
    'This app is in offline mode. Deleting the account needs you to be signed in.',
  'apagar.perguntaTitulo': 'Delete the account?',
  'apagar.perguntaComDados': 'This will delete your account, {exploracoes} and {animais}.',
  'apagar.semRecuperar': 'There is no way to get this back: not for you, not for whoever runs the app.',
  'apagar.perguntaSemDados':
    'This will delete your account and you lose access to the app. There is no way back.',
  'apagar.definitivamente': 'Delete for good',
  'apagar.apagada': 'Account deleted',
  'apagar.apagadaDetalhe':
    'Your data has been removed from the server. Thank you for using Terrabovina.',

  /* ---- Importar animais de Excel ---- */
  'importar.soNoComputador':
    'Choosing an Excel file needs a computer or the app website. On the phone, record the animals one by one with the add button.',
  'importar.explicacao':
    'Download the template, fill it in on Excel (one animal per row) and come back here to upload it. We show you what will go in before saving. Animals the app already has do not go in again, even if the file brings them.',
  'importar.contaSuspensa': 'The account is suspended or awaiting approval: animals cannot be saved.',
  'importar.semExploracoes':
    'You have no farm where you can record animals. Create a farm first, or ask the owner for access.',
  'importar.modeloExplicacao':
    'It comes with the right headings and an instructions sheet saying what each column accepts.',
  'importar.modeloDescarregado': 'Template downloaded',
  'importar.modeloOnde': 'Look in your downloads folder.',
  'importar.aLer': 'Reading…',
  'importar.escolherFicheiro': 'Choose an Excel file',
  'importar.escolherOutro': 'Choose another file',
  'importar.semLer': 'File not read',
  'importar.semLerTitulo': 'We could not read the file',
  'importar.detalheTecnico': 'Technical detail: {detalhe}',
  'importar.aImportar': 'Importing…',
  'importar.importarN': 'Import {n} animal|Import {n} animals',
  'importar.nImportados': '{n} animal imported|{n} animals imported',
  'importar.semImportar': 'Could not import',
  'importar.parcialTitulo': 'Partial import',
  'importar.parcial': '{entraram} went in. The server refused {recusados}{quais}.',
  'importar.motivo': 'Reason: {motivo}',
  'importar.nProntos': '{n} animal ready to import|{n} animals ready to import',
  'importar.nenhumPronto': 'No animal ready to import',
  'importar.nComErro': '{n} with an error|{n} with errors',
  'importar.nJaExistem': '{n} already there|{n} already there',
  'importar.ficheiroVazio': 'The file had no animal rows.',
  'importar.tudoCerto': 'All good, no problems.',
  'importar.faltamColunas': 'Columns missing from the file',
  'importar.faltamColunasDetalhe':
    'We could not find: {colunas}. Use the downloaded template without deleting the heading row.',
  'importar.naoVaoEntrar': 'WILL NOT GO IN',
  'importar.jaExistem': 'ALREADY THERE (NOT IMPORTED)',
  'importar.entramMasRepare': 'GOING IN, BUT NOTE THIS',
  'importar.linha': 'Row {n}',
  'importar.dupIdNaConta':
    'This animal is already in the app: it came from this same exported file. It was not imported again.',
  'importar.dupIdNoFicheiro': 'This row repeats another one in the file (same ID).',
  'importar.dupNomeNaConta':
    'There is already an animal with this name and date of birth: it was not imported. If it is a different animal, change its name or give it an ear tag.',
  'importar.dupNomeNoFicheiro': 'Another row in the file has the same name and date of birth.',
  'importar.dupBrincoNaConta': 'There is already an animal with this ear tag: it was not imported.',
  'importar.dupBrincoNoFicheiro': 'This ear tag appears more than once in the file.',
  'importar.noComputador': 'Do the import on a computer',
  'importar.modeloExcel': 'Excel template',

  /* ---- O que cada linha do Excel tem de errado ---- */
  'excel.faltaEspecie': 'The species is missing.',
  'excel.especieInvalida': 'Species "{valor}" is not valid. Use: {lista}.',
  'excel.faltaSexo': 'The sex is missing.',
  'excel.sexoInvalido': 'Sex "{valor}" is not valid. Use Macho or Fêmea.',
  'excel.faltaNascimento': 'The date of birth is missing.',
  'excel.nascimentoInvalido':
    'Date of birth "{valor}" is not valid. Use dd/mm/yyyy, and not a date in the future.',
  'excel.finalidadeDesconhecida': 'Purpose "{valor}" was not recognised, so it was ignored.',
  'excel.finalidadeSoBovinos': 'Purpose only applies to cattle, so it was ignored.',
  'excel.finalidadeAtipica': 'Purpose "{valor}" is unusual for {sexo}, but it was saved anyway.',
  'excel.identificacaoInvalida': 'Tagging date "{valor}" is not valid, so it was ignored.',
  'excel.sniraInvalido': '"{valor}" is neither Sim nor Não, so it was left as Sim.',
  'excel.partoInvalido': 'Expected calving date "{valor}" is not valid, so it was ignored.',
  'excel.partoNumMacho': 'A calving date was given for a male, so it was ignored.',
  'excel.semBrincoNemNome':
    'With no ear tag and no name we cannot tell whether this animal is already in the app. Check that you are not recording it twice.',

  /* ---- Chats ---- */
  'chat.titulo': 'Chats',
  'chat.subtitulo': 'Talk to the people you work with',
  'chat.semConversas': 'No chats yet',
  'chat.semConversasMensagem':
    'The farm group shows up here as soon as you have a team. You can also write to someone privately.',
  'chat.grupoSemNome': 'Farm group',
  'chat.grupo': 'Team group',
  'chat.privada': 'Private chat',
  'chat.semMensagens': 'No messages yet',
  'chat.mensagemApagada': 'Message deleted',
  'chat.utilizadorRemovido': 'Removed user',
  'chat.euDisse': 'You: {texto}',
  'chat.novaConversa': 'New chat',
  'chat.aQuemEscrever': 'Who do you want to write to?',
  'chat.escreverA': 'Write to {nome}',
  'chat.semPessoas': 'There is nobody else',
  'chat.semPessoasMensagem':
    'You can only write to people who work on your farms. To add someone, use the Workers tab.',
  'chat.hoje': 'Today',
  'chat.ontem': 'Yesterday',
  'chat.escrever': 'Write your message',
  'chat.enviar': 'Send',
  'chat.porEnviar': 'Waiting to be sent',
  'chat.erroVazia': 'Write something before sending.',
  'chat.erroComprida': 'That message is too long (the limit is {n} characters).',
  'chat.semEnviar': 'Could not send',
  'chat.avisoSeisMeses': 'Messages older than {n} months are deleted.',
  'chat.foraDoGrupo': 'You are no longer in this group. You can read what is here, but not write.',
  'chat.conversaSumiu': 'This chat is no longer available.',
  'chat.semEscrita': 'Your access to this farm has ended. You can read, but not write.',
  'chat.info': 'Details',
  'chat.membrosN': '{n} person|{n} people',
  'chat.naoLidasN': '{n} unread',
  'chat.nomeDoGrupo': 'Group name',
  'chat.nomeDoGrupoAjuda': 'Leave it empty and the group takes the name of the farm.',
  'chat.soDono': 'Only the farm owner can change this.',
  'chat.nomeMudado': 'Group name saved',
  'chat.silenciar': 'Mute this chat',
  'chat.silenciarAjuda': 'Stops telling you when messages arrive. You can still open it.',
  'chat.avisarNovas': 'Tell me about new messages',
  'chat.avisarNovasAjuda': 'Shows a short notice when a message arrives while the app is open.',
  'chat.ajustes': 'Chat settings',
  'chat.remover': 'Remove from the group',
  'chat.repor': 'Put back in the group',
  'chat.foraLista': 'Not in the group',
  'chat.confirmarRemover':
    'Remove {nome} from the group? They stay on the farm team and stop seeing new messages.',
  'chat.removido': 'Removed from the group',
  'chat.reposto': 'Put back in the group',
  'chat.bloquear': 'Block this person',
  'chat.desbloquear': 'Unblock',
  'chat.confirmarBloquear':
    'Block {nome}? Neither of you will be able to write to the other. You can undo this whenever you want.',
  'chat.bloqueada': 'Person blocked',
  'chat.desbloqueada': 'Person unblocked',
  'chat.bloqueadoAviso': 'This chat is blocked. Unblock it to write again.',
  'chat.verBloqueados': 'Blocked people',
  'chat.semBloqueados': 'You have not blocked anyone.',
  'chat.denunciar': 'Report message',
  'chat.denunciarTexto':
    'The message goes to whoever runs Terrabovina, with the three before it for context. The rest of the chat stays private.',
  'chat.denunciada': 'Message reported',
  'chat.denunciadaDetalhe': 'We will look into it.',
  'chat.apagarMensagem': 'Delete message',
  'chat.confirmarApagar': 'Delete this message? Everyone will see "Message deleted" in its place.',
  'chat.opcoes': 'What would you like to do?',
  'chat.mensagemNova': 'New message',
  'chat.regrasTitulo': 'Chat rules',
  'chat.regrasTexto':
    'These chats are for farm work. Offensive content, threats and harassment are not allowed. Any message can be reported, and whoever wrote it can lose access to the app.',
  'chat.semLigacao': 'No connection: it will wait',
  'chat.semLigacaoDetalhe': 'The message goes out as soon as there is a network.',


  /* ---- Chats: attachments, polls and phone notifications ---- */
  'chat.umaFotografia': 'Photo',
  'chat.umaMensagemDeVoz': 'Voice message',
  'chat.umaLocalizacao': 'Location',
  'chat.umaSondagem': 'Poll',
  'chat.anexar': 'Attach to the message',
  'chat.tirarFoto': 'Take a photo',
  'chat.escolherFoto': 'Choose from your photos',
  'chat.gravarVoz': 'Record a voice message',
  'chat.marcarSitio': 'Mark a place on the map',
  'chat.fazerSondagem': 'Create a poll',
  'chat.aEnviarFicheiro': 'Sending…',
  'chat.semAnexo': 'Could not send the file',
  'chat.semCamara': 'No access to the camera',
  'chat.semGaleria': 'No access to your photos',
  'chat.semPermissaoAjuda': 'Allow it in your phone settings and try again.',
  'chat.legenda': 'Caption (optional)',
  'chat.fotoNaoAbre': 'Could not open the photo.',
  'chat.verFoto': 'View the photo',
  'chat.aGravar': 'Recording',
  'chat.pararEEnviar': 'Stop and send',
  'chat.descartar': 'Discard',
  'chat.semMicrofone': 'No access to the microphone',
  'chat.gravacaoCurta': 'That recording is too short to hear anything.',
  'chat.tocar': 'Play',
  'chat.parar': 'Pause',
  'chat.escolherSitio': 'Tap the map to mark the place.',
  'chat.enviarSitio': 'Send this place',
  'chat.verNoMapa': 'Open in maps',
  'chat.semSitio': 'Mark a place first.',
  'chat.pergunta': 'Question',
  'chat.perguntaExemplo': 'Who can come on Saturday?',
  'chat.respostaN': 'Answer {n}',
  'chat.acrescentarResposta': 'Add an answer',
  'chat.enviarSondagem': 'Send the poll',
  'chat.votosN': '{n} vote|{n} votes',
  'chat.semVotos': 'Nobody has answered yet',
  'chat.sondagemSemPergunta': 'Write the question.',
  'chat.sondagemPerguntaLonga': 'That question is too long (the limit is {n} characters).',
  'chat.sondagemPoucasRespostas': 'Write at least {n} different answers.',
  'chat.sondagemMuitasRespostas': 'A poll takes at most {n} answers.',
  'chat.votar': 'Vote for: {opcao}',
  'chat.avisosNoTelemovel': 'Notify me on my phone',
  'chat.avisosNoTelemovelAjuda':
    'It rings even with the app closed. Without it, you only see messages when you open the app.',
  'chat.avisosRecusados':
    'Your phone did not allow notifications. Turn them on in the device settings.',
  'chat.avisosSoNoTelemovel': 'Notifications with the app closed only work on a phone.',

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
