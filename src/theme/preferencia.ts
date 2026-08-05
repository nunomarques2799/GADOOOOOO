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
import { supabase } from '@/data/supabase';

import { PALETA_OMISSAO, PALETAS, paletaPorId, type PaletaId } from './paletas';
import { aplicarPaletaNasCores } from './tokens';

const CHAVE = 'tema.paleta';

/**
 * O INSTANTE da escolha que este aparelho já conhece.
 *
 * Sem isto não há como distinguir duas coisas que chegam iguais: "a conta traz
 * outra paleta porque o telemóvel a mudou" — e então este aparelho segue-a — e
 * "a conta traz a paleta ANTIGA porque a sessão em memória ainda não apanhou a
 * escolha que se acabou de fazer aqui" — e então não se toca em nada.
 *
 * Confundir as duas dava o pior resultado possível: a app a desfazer a escolha
 * do criador e a recarregar-se para isso, talvez mais do que uma vez. Com a
 * hora, só uma escolha MAIS RECENTE do que a que já se conhece manda.
 */
const CHAVE_EM = 'tema.paleta.em';

/** Os campos do `user_metadata` onde a escolha vive. */
const CAMPO_META = 'paleta';
const CAMPO_META_EM = 'paletaEm';

/** A escolha tal como a conta a traz. */
export type EscolhaDaConta = {
  id: PaletaId;
  /** Quando foi feita (ms). `0` numa escolha gravada antes de haver hora. */
  em: number;
};

/** A paleta gravada neste aparelho. */
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
 * A paleta escolhida é de fundo escuro?
 *
 * Serve para o que não é cor de token: a barra de estado do sistema (ícones
 * claros num fundo escuro) e o sentido de leitura da barra no ecrã Início, onde
 * o cabeçalho colorido troca de tom com o tema. Ler dentro do render — a app
 * recarrega ao mudar de paleta, por isso o valor está sempre certo.
 */
export function temaEscuro(): boolean {
  return paletaPorId(paletaGuardada()).escura ?? false;
}

/**
 * Aplica a paleta guardada. Chamada uma vez, no arranque, antes do primeiro
 * render — ver `src/app/_layout.tsx`.
 */
export function arrancarTema(): void {
  aplicarPaletaNasCores(paletaGuardada());
}

/** Recarrega a app para as cores novas ficarem aplicadas por inteiro. */
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
 * A escolha que a conta traz, ou `null` se não trouxer nenhuma que exista.
 *
 * Recebe o `user_metadata` da sessão Supabase — dados que vêm de fora e podem
 * ter lá dentro qualquer coisa, incluindo o id de uma paleta que já não existe
 * (uma que tenha sido retirada da app). Um id desconhecido é `null` e não a
 * paleta de origem: "a conta não diz nada" e "a conta diz verde" são coisas
 * diferentes, e confundi-las punha o aparelho a mudar para verde sozinho.
 */
export function paletaDaConta(metadata: unknown): EscolhaDaConta | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const dados = metadata as Record<string, unknown>;
  const valor = dados[CAMPO_META];
  if (typeof valor !== 'string' || !PALETAS.some((p) => p.id === valor)) return null;
  const em = dados[CAMPO_META_EM];
  return { id: valor as PaletaId, em: typeof em === 'number' && em > 0 ? em : 0 };
}

/**
 * Grava a escolha na conta, para os outros aparelhos a apanharem.
 *
 * Vive no `user_metadata` da conta Supabase e não numa tabela: é uma
 * preferência de aspeto, não são dados da exploração — não precisa de RLS, de
 * migração nem de entrar na sincronização offline. Chega com a sessão, que é
 * exatamente quando faz falta.
 *
 * Silencioso quando falha, e de propósito: sem rede, ou sem sessão (a app
 * também funciona offline puro), a escolha fica gravada NESTE aparelho e é isso
 * que interessa. Interromper alguém que acabou de escolher uma cor com um erro
 * de rede seria trocar uma coisa pequena por um susto.
 */
async function guardarNaConta(id: PaletaId, em: number): Promise<void> {
  try {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { error } = await supabase.auth.updateUser({
      data: { [CAMPO_META]: id, [CAMPO_META_EM]: em },
    });
    // A hora só fica marcada se a gravação passou. Falhou (sem rede)? Então a
    // conta continua com a escolha antiga, e é justo que uma mudança feita
    // noutro aparelho ganhe a esta — que nunca chegou a sair daqui.
    if (!error) guardar(CHAVE_EM, String(em));
  } catch {
    /* sem rede — fica só neste aparelho */
  }
}

/**
 * Grava a paleta (aqui e na conta) e recarrega a app.
 *
 * Devolve `false` se não conseguiu recarregar (acontece em ambientes de
 * desenvolvimento onde `Updates` não está ativo): aí a escolha ficou gravada e
 * entra no próximo arranque, e é isso que o ecrã diz ao criador — em vez de
 * ficar a olhar para uma app que não mudou de cor.
 */
export async function mudarPaleta(id: PaletaId): Promise<boolean> {
  guardar(CHAVE, id);
  aplicarPaletaNasCores(id);

  // ANTES de recarregar: um recarregamento a meio de um pedido deixava-o pelo
  // caminho, e a escolha nunca chegava aos outros aparelhos.
  await guardarNaConta(id, Date.now());

  return recarregarApp();
}

/**
 * Segue a escolha que a conta traz, se for mais recente do que a que este
 * aparelho já conhece.
 *
 * É isto que faz a cor escolhida no telemóvel aparecer no computador. Devolve
 * `true` se a app vai recarregar.
 *
 * A comparação é pela HORA e não pelo valor: uma sessão em memória pode trazer
 * a escolha ANTERIOR durante uns instantes depois de se mudar de cor aqui, e
 * pelo valor isso era indistinguível de outro aparelho ter mudado — a app
 * desfazia a escolha que o criador acabou de fazer e recarregava-se para isso.
 */
export async function seguirPaletaDaConta(escolha: EscolhaDaConta): Promise<boolean> {
  try {
    const conhecida = Number(ler(CHAVE_EM) ?? 0);
    if (escolha.em <= conhecida) return false; // nada de novo do outro lado
    guardar(CHAVE_EM, String(escolha.em));
  } catch {
    // Sem armazenamento não há como saber o que já se viu, e sem isso qualquer
    // arranque parecia uma mudança nova — a app recarregava em ciclo.
    return false;
  }
  if (escolha.id === paletaGuardada()) return false; // já é a que está a ser usada
  guardar(CHAVE, escolha.id);
  aplicarPaletaNasCores(escolha.id);
  return recarregarApp();
}
