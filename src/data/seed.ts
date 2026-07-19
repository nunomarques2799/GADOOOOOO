import { isoDaysAgo, isoInDays } from './helpers';
import type { Animal, Evento, Exploracao, Movimento, Terreno, Utilizador } from './types';

export const utilizadorSeed: Utilizador = {
  id: 'dev-user-001',
  nome: 'Joaquim Marques',
  email: 'joaquim.marques@exemplo.pt',
  telefone: '912 345 678',
  nif: '212 345 678',
};

/**
 * Explorações de exemplo. Vêm com a gestão económica LIGADA — ao contrário do
 * que acontece numa conta a sério, onde é opt-in — porque este é o modo demo:
 * se viessem desligadas, quem experimenta a app não veria a funcionalidade
 * existir, e os movimentos de exemplo não apareceriam em lado nenhum.
 */
export const exploracoesSeed: Exploracao[] = [
  {
    id: 'exp-1',
    financasAtivas: true,
    utilizadorId: 'dev-user-001',
    nome: 'Monte do Avô',
    marcaExploracao: 'PT 61 234 5678',
    nifDetentor: '212 345 678',
    localizacao: 'Idanha-a-Nova, Castelo Branco',
  },
  {
    id: 'exp-2',
    financasAtivas: true,
    utilizadorId: 'dev-user-001',
    nome: 'Herdade das Corgas',
    marcaExploracao: 'PT 61 987 1234',
    nifDetentor: '212 345 678',
    localizacao: 'Nisa, Portalegre',
  },
];

export const terrenosSeed: Terreno[] = [
  { id: 'ter-1', exploracaoId: 'exp-1', nome: 'Lameiro Grande', tipo: 'Pastagem', area: 4.2, descricao: 'Poço e bebedouro a norte. Cerca de madeira.', latitude: 39.92, longitude: -7.24 },
  { id: 'ter-2', exploracaoId: 'exp-1', nome: 'Cerca do Poço', tipo: 'Pastagem', area: 2.8, descricao: 'Abrigo coberto. Boa sombra de sobreiros.', latitude: 39.93, longitude: -7.23 },
  { id: 'ter-3', exploracaoId: 'exp-1', nome: 'Souto Velho', tipo: 'Misto', area: 3.5, descricao: 'Souto de castanheiros com pastagem.', latitude: 39.91, longitude: -7.25 },
  { id: 'ter-4', exploracaoId: 'exp-2', nome: 'Vale da Ribeira', tipo: 'Pastagem', area: 6.1, descricao: 'Junto à ribeira. Água todo o ano.', latitude: 39.52, longitude: -7.65 },
];

/** Efetivo — datas relativas a hoje para manter os alertas vivos. */
export const animaisSeed: Animal[] = [
  // Vacas adultas — Monte do Avô
  {
    id: 'an-1', exploracaoId: 'exp-1', terrenoId: 'ter-1', nome: 'Mimosa',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 5 + 40),
    raca: 'Mertolenga', corPelagem: 'Vermelha', numeroIdentificacao: 'PT 6120 0011 2201',
    dataIdentificacao: isoDaysAgo(365 * 5 + 25), comunicadoSnira: true,
    dataPrevistaParto: isoInDays(6),
  },
  {
    id: 'an-2', exploracaoId: 'exp-1', terrenoId: 'ter-1', nome: 'Estrela',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 4 + 120),
    raca: 'Alentejana', corPelagem: 'Amarela', numeroIdentificacao: 'PT 6120 0011 2202',
    dataIdentificacao: isoDaysAgo(365 * 4 + 105), comunicadoSnira: true,
  },
  {
    id: 'an-3', exploracaoId: 'exp-1', nome: 'Boneca',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 6 + 10),
    raca: 'Mertolenga', corPelagem: 'Vermelha', numeroIdentificacao: 'PT 6120 0011 2203',
    dataIdentificacao: isoDaysAgo(365 * 6), comunicadoSnira: true,
    estado: 'vendido', dataSaida: isoDaysAgo(10), motivoSaida: 'Vendida no matadouro de Elvas',
  },
  {
    id: 'an-4', exploracaoId: 'exp-1', terrenoId: 'ter-2', nome: 'Rosa',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 3 + 50),
    raca: 'Cruzado Charolês', corPelagem: 'Branca', numeroIdentificacao: 'PT 6120 0011 2204',
    dataIdentificacao: isoDaysAgo(365 * 3 + 35), comunicadoSnira: true,
  },
  {
    id: 'an-5', exploracaoId: 'exp-1', terrenoId: 'ter-1', nome: 'Gerês',
    especie: 'Bovino', sexo: 'Macho', dataNascimento: isoDaysAgo(365 * 5 + 200),
    raca: 'Limousine', corPelagem: 'Trigo', numeroIdentificacao: 'PT 6120 0011 2205',
    dataIdentificacao: isoDaysAgo(365 * 5 + 185), comunicadoSnira: true,
  },
  {
    id: 'an-6', exploracaoId: 'exp-1', terrenoId: 'ter-3', nome: 'Malhada',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 7 + 15),
    raca: 'Mertolenga', corPelagem: 'Malhada', numeroIdentificacao: 'PT 6120 0011 2206',
    dataIdentificacao: isoDaysAgo(365 * 7), comunicadoSnira: true,
  },
  {
    id: 'an-7', exploracaoId: 'exp-1', terrenoId: 'ter-3', nome: 'Preta',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 4 + 5),
    raca: 'Alentejana', corPelagem: 'Preta', numeroIdentificacao: 'PT 6120 0011 2207',
    dataIdentificacao: isoDaysAgo(365 * 4 - 10), comunicadoSnira: true,
    fimIntervaloSeguranca: isoInDays(8),
  },
  {
    id: 'an-8', exploracaoId: 'exp-1', terrenoId: 'ter-1', nome: 'Faísca',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 2 + 30),
    raca: 'Cruzado Charolês', corPelagem: 'Branca', numeroIdentificacao: 'PT 6120 0011 2208',
    dataIdentificacao: isoDaysAgo(365 * 2 + 15), comunicadoSnira: true,
  },
  {
    id: 'an-9', exploracaoId: 'exp-1', terrenoId: 'ter-3', nome: 'Castanha',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 3 + 200),
    raca: 'Mertolenga', corPelagem: 'Castanha', numeroIdentificacao: 'PT 6120 0011 2209',
    dataIdentificacao: isoDaysAgo(365 * 3 + 185), comunicadoSnira: true,
  },

  // Vitelos recentes — geram alertas
  {
    // nascido há 15 dias, sem brinco → falta identificar (prazo 5 dias)
    id: 'an-10', exploracaoId: 'exp-1', terrenoId: 'ter-1', nome: 'Trovão',
    especie: 'Bovino', sexo: 'Macho', dataNascimento: isoDaysAgo(15),
    raca: 'Mertolenga', maeId: 'an-1',
  },
  {
    // nascida há 25 dias, brinco colocado há 3 dias, SNIRA por comunicar (prazo 4)
    id: 'an-11', exploracaoId: 'exp-1', terrenoId: 'ter-3', nome: 'Aurora',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(25),
    raca: 'Mertolenga', maeId: 'an-6', numeroIdentificacao: 'PT 6120 0011 2210',
    dataIdentificacao: isoDaysAgo(3), comunicadoSnira: false,
  },
  {
    // nascido há 28 dias, ainda sem brinco → identificação EM ATRASO
    id: 'an-12', exploracaoId: 'exp-1', terrenoId: 'ter-2', nome: 'Bravo',
    especie: 'Bovino', sexo: 'Macho', dataNascimento: isoDaysAgo(28),
    raca: 'Cruzado Charolês', maeId: 'an-4',
  },

  // Herdade das Corgas
  {
    id: 'an-13', exploracaoId: 'exp-2', terrenoId: 'ter-4', nome: 'Duque',
    especie: 'Bovino', sexo: 'Macho', dataNascimento: isoDaysAgo(365 * 6 + 100),
    raca: 'Charolês', corPelagem: 'Branca', numeroIdentificacao: 'PT 6198 0022 3301',
    dataIdentificacao: isoDaysAgo(365 * 6 + 85), comunicadoSnira: true,
  },
  {
    id: 'an-14', exploracaoId: 'exp-2', terrenoId: 'ter-4', nome: 'Condessa',
    especie: 'Bovino', sexo: 'Fêmea', dataNascimento: isoDaysAgo(365 * 5 + 60),
    raca: 'Charolês', corPelagem: 'Branca', numeroIdentificacao: 'PT 6198 0022 3302',
    dataIdentificacao: isoDaysAgo(365 * 5 + 45), comunicadoSnira: true,
  },
  {
    id: 'an-15', exploracaoId: 'exp-2', terrenoId: 'ter-4', nome: 'Farrusco',
    especie: 'Ovino', sexo: 'Macho', dataNascimento: isoDaysAgo(365 * 2 + 90),
    raca: 'Merino', corPelagem: 'Branca', numeroIdentificacao: 'PT 6198 0055 7701',
    dataIdentificacao: isoDaysAgo(365 * 2 + 80), comunicadoSnira: true,
  },
];

export const eventosSeed: Evento[] = [
  { id: 'ev-1', animalId: 'an-1', tipo: 'Parto', data: isoDaysAgo(15), descricao: 'Parto normal — vitelo macho (Trovão)', detalhe: 'Sem complicações' },
  { id: 'ev-2', animalId: 'an-1', tipo: 'Vacinação', data: isoDaysAgo(120), descricao: 'Vacina da língua azul', detalhe: 'Lote 4471 · próxima dose em 6 meses', valor: 18 },
  { id: 'ev-3', animalId: 'an-7', tipo: 'Medicamento', data: isoDaysAgo(2), descricao: 'Antibiótico — mastite', detalhe: 'Dose 20ml · Vet. Dr. Sousa · segurança 10 dias', valor: 45 },
  { id: 'ev-4', animalId: 'an-6', tipo: 'Parto', data: isoDaysAgo(25), descricao: 'Parto normal — vitela fêmea (Aurora)', detalhe: 'Sem complicações' },
  { id: 'ev-5', animalId: 'an-3', tipo: 'Pesagem', data: isoDaysAgo(30), descricao: 'Pesagem: 520 kg', detalhe: 'GMD 0,9 kg/dia' },
  { id: 'ev-6', animalId: 'an-13', tipo: 'Compra', data: isoDaysAgo(365), descricao: 'Compra — Feira de Nisa', detalhe: 'origem PT 44 552 1100', valor: 1350 },
  // O preço desta venda vive em `movimentosSeed` (é receita — ver financas.ts).
  { id: 'ev-7', animalId: 'an-3', tipo: 'Venda', data: isoDaysAgo(10), descricao: 'Animal saiu por venda.', detalhe: 'Vendido no matadouro de Elvas' },
];

/**
 * Movimentos financeiros de exemplo. Espalhados por vários meses de propósito:
 * são eles que dão conteúdo ao gráfico de evolução mensal no modo demo — com
 * tudo no mesmo dia, o ecrã Finanças abria com uma barra só e não se percebia
 * o que ele faz.
 */
export const movimentosSeed: Movimento[] = [
  // Receitas
  { id: 'mov-1', exploracaoId: 'exp-1', direcao: 'receita', categoria: 'Venda de animais', valor: 1580, data: isoDaysAgo(10), descricao: 'Venda — matadouro de Elvas', contraparte: 'Matadouro de Elvas', animalId: 'an-3' },
  { id: 'mov-2', exploracaoId: 'exp-1', direcao: 'receita', categoria: 'Apoios e subsídios', valor: 2400, data: isoDaysAgo(75), descricao: 'Apoio IFAP — prémio por vaca aleitante' },
  { id: 'mov-3', exploracaoId: 'exp-1', direcao: 'receita', categoria: 'Leite e produtos', valor: 310, data: isoDaysAgo(40), descricao: 'Entrega de leite' },

  // Despesas — a alimentação é o grosso, como numa exploração a sério
  { id: 'mov-4', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Alimentação', valor: 860, data: isoDaysAgo(20), descricao: 'Ração — 40 sacos', contraparte: 'Agro-Nisa' },
  { id: 'mov-5', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Alimentação', valor: 640, data: isoDaysAgo(55), descricao: 'Fardos de feno', contraparte: 'Agro-Nisa' },
  { id: 'mov-6', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Alimentação', valor: 720, data: isoDaysAgo(95), descricao: 'Ração e suplementos', contraparte: 'Agro-Nisa' },
  { id: 'mov-7', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Energia e combustível', valor: 145, data: isoDaysAgo(18), descricao: 'Eletricidade — furo e bebedouros', contraparte: 'EDP' },
  { id: 'mov-8', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Energia e combustível', valor: 180, data: isoDaysAgo(48), descricao: 'Gasóleo do trator' },
  { id: 'mov-9', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Rendas e terrenos', valor: 400, data: isoDaysAgo(60), descricao: 'Renda do Souto Velho', terrenoId: 'ter-3' },
  { id: 'mov-10', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Máquinas e reparações', valor: 230, data: isoDaysAgo(33), descricao: 'Reparação da cerca elétrica' },
  { id: 'mov-11', exploracaoId: 'exp-1', direcao: 'despesa', categoria: 'Taxas e seguros', valor: 195, data: isoDaysAgo(85), descricao: 'Seguro da exploração' },
];
