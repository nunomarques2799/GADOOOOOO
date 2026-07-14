/**
 * Modelo de domínio — espelha o schema Drift/SQLite definido no projeto
 * (Utilizador → Exploração → Terreno → Animal) para que a persistência
 * local (expo-sqlite) possa entrar mais tarde sem alterar a UI.
 */

export type Especie = 'Bovino' | 'Equídeo' | 'Ovino' | 'Caprino' | 'Suíno';
export type Sexo = 'Macho' | 'Fêmea';
export type TipoTerreno = 'Pastagem' | 'Cultivo' | 'Misto' | 'Outro';

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
}

export interface Convite {
  codigo: string;
  exploracaoId: string;
  role: RoleMembro;
  criadoPor: string;
  criadoEm?: string;
  expiraEm?: string;
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

export interface Exploracao {
  id: string;
  utilizadorId: string;
  nome: string;
  marcaExploracao: string;
  nifDetentor: string;
  localizacao?: string;
  fotografia?: string;
}

export interface Terreno {
  id: string;
  exploracaoId: string;
  nome: string;
  descricao?: string;
  latitude?: number;
  longitude?: number;
  area?: number; // hectares
  tipo?: TipoTerreno;
}

export interface Animal {
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
}

export interface Evento {
  id: string;
  animalId: string;
  tipo: EventoTipo;
  data: string; // ISO
  descricao: string;
  detalhe?: string; // ex: medicamento, dose, veterinário
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
