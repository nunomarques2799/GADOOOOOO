/**
 * Som ao gravar — a app ouvir-se, além de se ver e de se sentir.
 * ------------------------------------------------------------------
 * Irmão do `vibrar.ts`, e pela mesma razão: um registo confirmado sem ser
 * preciso ler nada. A vibração resolve o telemóvel no bolso ou ao sol; não
 * resolve o computador da secretária, que não vibra, nem o telemóvel pousado em
 * cima do murete enquanto se prende a vaca. O som resolve os dois.
 *
 * Vive no mesmo sítio da vibração — é o `mostrar()` de `toasts.tsx` que o chama
 * —, por isso TODA a ação que já dava aviso no ecrã passou a dar sinal sonoro,
 * sem se mexer em nenhum ecrã: registar um animal, lançar uma despesa, apontar
 * uma medicação, guardar um documento.
 *
 * OS FICHEIROS
 *
 * Estão em `assets/sons/`, um por tipo de aviso. Os que lá estão são tons
 * gerados, para trocar: quem os substituir mantém o NOME e a extensão `.wav` e
 * não tem de tocar em código nenhum (ver o `LEIA-ME.md` da pasta).
 *
 * PORQUÊ O `require` ESCONDIDO
 *
 * O `expo-audio` é um módulo NATIVO, e a app instalada no telemóvel foi
 * construída antes de ele existir. Um `import` normal no topo deste ficheiro
 * rebentava nessa app assim que ela abrisse — e isto é carregado pela raiz, ou
 * seja, ela deixava de arrancar de todo com uma simples entrega de JS
 * (`eas update`). Pedido aqui dentro e com a falha engolida, uma app antiga fica
 * apenas sem som até ao build seguinte, que é como deve ser: nada disto é
 * essencial ao trabalho.
 */

import { guardar, ler } from './armazenamento';

const CHAVE = 'gado.som.v1';

/** Qual dos avisos. Os mesmos três da vibração, e pelas mesmas razões. */
export type SomDeAviso = 'sucesso' | 'erro' | 'aviso';

/**
 * Ligado por omissão. O aparelho tem sempre a última palavra: com o som
 * desligado ou no silencioso, nada disto se ouve.
 */
export function somLigado(): boolean {
  try {
    return ler(CHAVE) !== 'off';
  } catch {
    return true;
  }
}

export function definirSom(ligado: boolean): void {
  guardar(CHAVE, ligado ? 'on' : 'off');
}

type ModuloAudio = typeof import('expo-audio');
type Leitor = ReturnType<ModuloAudio['createAudioPlayer']>;

/** `undefined` = ainda não se tentou; `null` = este build não o traz. */
let audio: ModuloAudio | null | undefined;

function moduloAudio(): ModuloAudio | null {
  if (audio !== undefined) return audio;
  try {
    audio = require('expo-audio') as ModuloAudio;
  } catch {
    audio = null;
  }
  return audio;
}

/**
 * Um leitor por som, feito à primeira vez que ele toca e guardado depois.
 *
 * Guardar é o que faz o segundo aviso sair no instante: criar o leitor obriga a
 * ler e a descodificar o ficheiro, e fazê-lo a cada gravação dava um som a
 * chegar depois do cartão já ter desaparecido do ecrã. São três ficheiros de
 * três décimos de segundo — cabem na memória sem se notar.
 *
 * O valor `null` também se guarda: um build sem o módulo não vale a pena voltar
 * a tentar a cada gravação.
 */
const leitores = new Map<SomDeAviso, Leitor | null>();

function leitorDe(qual: SomDeAviso): Leitor | null {
  const ja = leitores.get(qual);
  if (ja !== undefined) return ja;

  let leitor: Leitor | null = null;
  try {
    const mod = moduloAudio();
    // Os `require` estão aqui dentro, e escritos um a um, porque é assim que o
    // Metro os vê: um caminho montado com uma variável não é empacotado, e o
    // som só falharia na app instalada — nunca em desenvolvimento.
    if (mod) leitor = mod.createAudioPlayer(FICHEIRO[qual]());
  } catch {
    leitor = null;
  }

  leitores.set(qual, leitor);
  return leitor;
}

/** O que o `createAudioPlayer` aceita — dito pelo próprio módulo, sem o importar. */
type Fonte = NonNullable<Parameters<ModuloAudio['createAudioPlayer']>[0]>;

const FICHEIRO: Record<SomDeAviso, () => Fonte> = {
  sucesso: () => require('../../assets/sons/sucesso.wav'),
  erro: () => require('../../assets/sons/erro.wav'),
  aviso: () => require('../../assets/sons/aviso.wav'),
};

/**
 * Toca, e nada do que corra mal aqui chega a quem chamou.
 *
 * Vale a mesma regra da vibração: um som é acessório, e a gravação que o mandou
 * não pode falhar por causa dele.
 */
function tocar(qual: SomDeAviso): void {
  if (!somLigado()) return;
  const leitor = leitorDe(qual);
  if (!leitor) return;
  try {
    // Do princípio, sempre. Chegado ao fim, o leitor fica lá parado e um `play`
    // seco não dá som nenhum — dois registos seguidos soavam uma vez só.
    void leitor
      .seekTo(0)
      .then(() => leitor.play())
      .catch(() => undefined);
  } catch {
    /* leitor num estado que não aceita ordens — segue sem som */
  }
}

/** Ficou gravado. */
export function somSucesso(): void {
  tocar('sucesso');
}

/** Não ficou. */
export function somErro(): void {
  tocar('erro');
}

/** O que tem de ser lido antes de continuar (ver `avisos.ts`). */
export function somAviso(): void {
  tocar('aviso');
}

/**
 * Esquece os leitores e larga os ficheiros.
 *
 * Serve para os testes e para o recarregamento a quente, onde um leitor de uma
 * versão anterior do módulo ficaria pendurado sem ninguém que o feche.
 */
export function esquecerSons(): void {
  for (const leitor of leitores.values()) {
    try {
      leitor?.remove();
    } catch {
      /* já removido */
    }
  }
  leitores.clear();
}
