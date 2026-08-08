/**
 * O idioma da app — ler, detetar, gravar e aplicar.
 * ------------------------------------------------------------------
 * Assenta no armazenamento SÍNCRONO (`src/data/armazenamento.ts`) pela mesma
 * razão da paleta (ver `src/theme/preferencia.ts`): o idioma tem de estar
 * decidido antes de se desenhar o primeiro ecrã, e um `AsyncStorage` obrigava a
 * app a arrancar em português e a trocar de língua à frente do utilizador.
 *
 * PORQUE É QUE MUDAR DE IDIOMA RECARREGA A APP
 *
 * É a mesma decisão, e pelo mesmo motivo, que a das cores. O `t()` lê um valor
 * de módulo; os ecrãs já desenhados guardaram os textos antigos nos seus nós, e
 * o React Compiler — ligado neste projeto — memoiza-os. Nem forçar um redesenho
 * os apanhava a todos: ficava meia app numa língua e meia noutra. A alternativa
 * era passar cada leitura por um hook de contexto e refazer todos os ecrãs.
 * Recarregar é um segundo, uma vez, numa definição que se mexe uma vez na vida.
 *
 * PORQUÊ SEM `expo-localization`
 *
 * Detetar a língua do telemóvel dava jeito e o pacote do Expo faz isso bem. Mas
 * é um módulo NATIVO: entrava no `app.json` e a app instalada só passaria a ter
 * idiomas depois de um `eas build` novo (ver AGENTS.md, "Atualizações"). A
 * deteção abaixo usa só o que já existe — o `Intl` do Hermes, o `navigator` da
 * web —, e por isso isto chega ao telemóvel num `eas update` normal.
 */

import { Platform } from 'react-native';

import { guardar, ler } from '@/data/armazenamento';

export const IDIOMAS = ['pt', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

/**
 * Português por omissão, e não a língua do telemóvel.
 *
 * O público-alvo é criador de gado português, e a app é escrita em PT-PT. A
 * deteção abaixo só decide na PRIMEIRA abertura, e só sai do português se o
 * aparelho estiver mesmo noutra língua.
 */
export const IDIOMA_OMISSAO: Idioma = 'pt';

const CHAVE = 'app.idioma';

export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'Português',
  // Em inglês e não "Inglês": quem procura esta opção não lê português, e é
  // por isso que a procura.
  en: 'English',
};

function valido(v: string | null | undefined): v is Idioma {
  return !!v && (IDIOMAS as readonly string[]).includes(v);
}

/**
 * A língua do aparelho, reduzida às que a app tem.
 *
 * Só é consultada quando ainda não há escolha gravada. Qualquer coisa que não
 * comece por `pt` conta como inglês — não porque um alemão fale inglês, mas
 * porque entre uma app que ele não percebe e outra que talvez perceba, a
 * segunda é melhor. Quem quiser troca nas Definições.
 */
export function idiomaDoSistema(): Idioma {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
    }
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    return locale.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  } catch {
    // Sem `Intl` (uma build de Hermes sem ele) fica o português, que é o que
    // serve quem esta app tem à frente.
    return IDIOMA_OMISSAO;
  }
}

/**
 * O idioma em uso.
 *
 * Valor de MÓDULO e não um estado de React, para o `t()` poder ser uma função
 * simples chamada de qualquer sítio — incluindo de fora de um componente, que é
 * onde vivem metade dos textos desta app (as tabelas de constantes, as
 * mensagens dos alertas). Ver o cabeçalho: mudar de idioma recarrega a app, por
 * isso este valor nunca fica dessincronizado do que está no ecrã.
 */
let atual: Idioma = IDIOMA_OMISSAO;

export function idiomaAtual(): Idioma {
  return atual;
}

/** O que está gravado neste aparelho, ou `null` se ainda ninguém escolheu. */
export function idiomaGuardado(): Idioma | null {
  try {
    const v = ler(CHAVE);
    return valido(v) ? v : null;
  } catch {
    // Sem armazenamento (browser em modo privado, disco cheio) a app abre em
    // português. É uma preferência — não vale um ecrã de erro.
    return null;
  }
}

/**
 * Decide o idioma e aplica-o. Chamada uma vez, no arranque, antes do primeiro
 * render — ver `src/app/_layout.tsx`, ao lado do `arrancarTema()`.
 *
 * NÃO grava a deteção. Se gravasse, a escolha automática ficava
 * indistinguível de uma escolha do criador: mudar o telemóvel para inglês
 * depois disso não mudava nada, e ninguém perceberia porquê.
 */
export function arrancarIdioma(): void {
  atual = idiomaGuardado() ?? idiomaDoSistema();
}

/** Recarrega a app para os textos novos ficarem aplicados por inteiro. */
async function recarregarApp(): Promise<boolean> {
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

/**
 * Grava o idioma e recarrega a app.
 *
 * Devolve `false` se não conseguiu recarregar (acontece em ambientes de
 * desenvolvimento onde o `Updates` não está ativo): aí a escolha ficou gravada
 * e entra no próximo arranque, e é isso que o ecrã diz — em vez de deixar
 * alguém a olhar para uma app que não mudou de língua.
 *
 * Ao contrário da paleta, isto NÃO vai à conta Supabase. A cor é a mesma pessoa
 * em todos os aparelhos; a língua é muitas vezes do APARELHO — o computador do
 * escritório em inglês e o telemóvel em português é um arranjo normal, e
 * sincronizá-la desfazia-o de cada vez.
 */
export async function mudarIdioma(id: Idioma): Promise<boolean> {
  guardar(CHAVE, id);
  atual = id;
  return recarregarApp();
}

/** Só para os testes: põe o idioma sem gravar nem recarregar. */
export function definirIdiomaParaTestes(id: Idioma): void {
  atual = id;
}
