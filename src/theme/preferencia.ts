/**
 * A paleta que o criador escolheu — ler, gravar e aplicar.
 * ------------------------------------------------------------------
 * Assenta no armazenamento SÍNCRONO (`src/data/armazenamento.ts`), e é essa a
 * razão de isto poder existir: a paleta tem de estar decidida antes de se
 * desenhar o primeiro ecrã, e um `AsyncStorage` obrigava a app a arrancar com
 * as cores erradas e a mudá-las à frente do utilizador.
 *
 * PORQUE É QUE MUDAR DE PALETA RECARREGA A APP
 *
 * As cores vivem num objeto que se reescreve (`aplicarPaletaNasCores`). Isso
 * chega para o arranque, mas não chega para trocar a quente: os ecrãs já
 * desenhados guardaram os valores antigos nos seus estilos, e o React Compiler
 * — ligado neste projeto — memoiza-os, por isso nem forçar um redesenho os
 * apanhava a todos. O resultado seria meia app numa cor e meia noutra.
 *
 * A alternativa era passar as ~950 leituras de `colors` por um hook de
 * contexto. Recarregar é um segundo, uma vez, numa definição que se mexe uma
 * vez na vida — e a app arranca da cache local, sem esperar pela rede.
 */

import { Platform } from 'react-native';

import { guardar, ler } from '@/data/armazenamento';

import { PALETA_OMISSAO, paletaPorId, type PaletaId } from './paletas';
import { aplicarPaletaNasCores } from './tokens';

const CHAVE = 'tema.paleta';

/** A paleta gravada neste aparelho (preferência do aparelho, não da conta). */
export function paletaGuardada(): PaletaId {
  try {
    return paletaPorId(ler(CHAVE)).id;
  } catch {
    // Sem armazenamento (browser em modo privado, disco cheio) a app abre na
    // paleta de origem. É uma preferência de aspeto — não vale um ecrã de erro.
    return PALETA_OMISSAO;
  }
}

/**
 * Aplica a paleta guardada. Chamada uma vez, no arranque, antes do primeiro
 * render — ver `src/app/_layout.tsx`.
 */
export function arrancarTema(): void {
  aplicarPaletaNasCores(paletaGuardada());
}

/**
 * Grava a paleta e recarrega a app para ela ficar aplicada por inteiro.
 *
 * Devolve `false` se não conseguiu recarregar (acontece em ambientes de
 * desenvolvimento onde `Updates` não está ativo): aí a escolha ficou gravada e
 * entra no próximo arranque, e é isso que o ecrã diz ao criador — em vez de
 * ficar a olhar para uma app que não mudou de cor.
 */
export async function mudarPaleta(id: PaletaId): Promise<boolean> {
  guardar(CHAVE, id);
  aplicarPaletaNasCores(id);

  try {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return false;
      window.location.reload();
      return true;
    }
    // Só se carrega o expo-updates quando é mesmo preciso: no arranque não faz
    // falta nenhuma e é código nativo a menos a inicializar.
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
