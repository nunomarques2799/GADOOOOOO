/**
 * Notificações locais — versão WEB/Electron (não faz nada).
 * ------------------------------------------------------------------
 * O `expo-notifications` não agenda na web, e a app de desktop fica aberta
 * enquanto o criador trabalha, por isso a lista de alertas no ecrã já cumpre
 * o papel. Manter a mesma assinatura evita espalhar `Platform.OS === 'web'`
 * pelos ecrãs.
 */

import type { Preferencias } from './notificacoes';
import type { AcessoComPrazo } from './notificacoesPlano';
import type { Alerta } from './types';

export const suportaNotificacoes = false;

export async function temPermissao(): Promise<boolean> {
  return false;
}

export async function pedirPermissao(): Promise<boolean> {
  return false;
}

export async function agendar(
  _alertas: Alerta[],
  _p: Preferencias,
  _acessos: AcessoComPrazo[] = [],
): Promise<number> {
  return 0;
}

export async function cancelarTudo(): Promise<void> {
  /* nada a cancelar */
}

export type DestinoAviso = {
  toque: string;
  alertaId?: string;
  animalId?: string;
};

/** Sem avisos agendados, nunca há toque nenhum para seguir. */
export function useToqueEmAviso(): DestinoAviso | null {
  return null;
}
