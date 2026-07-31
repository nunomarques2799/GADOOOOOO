/**
 * Avisos e confirmações que funcionam nas duas plataformas.
 * ------------------------------------------------------------------
 * Quem chama continua a escrever `avisar(...)` e `confirmar(...)` — o que mudou
 * foi quem os desenha. Antes eram os diálogos do SISTEMA: `Alert` no telemóvel
 * e `window.alert`/`window.confirm` na web. Na app de computador isso dava uma
 * barra cinzenta agarrada ao topo da janela, com o tipo de letra do Chrome e um
 * "localhost:8081 diz" por cima da pergunta — nada daquilo é a app, e a coisa
 * mais destrutiva que aqui se faz (eliminar um animal) pedia confirmação num
 * balão que parece um erro do navegador.
 *
 * Agora quem os mostra é um ecrã da app (`components/AnfitriaoAvisos.tsx`),
 * montado uma vez na raiz. Este módulo continua a ser código simples, sem React:
 * guarda a referência do anfitrião e entrega-lhe o pedido.
 *
 * O caminho do sistema fica como REDE DE SEGURANÇA. Um `confirmar()` chamado
 * antes de a app montar, ou de dentro de um teste sem a árvore toda, tem de
 * continuar a perguntar alguma coisa — calar-se seria pior: uma ação
 * destrutiva que não pergunta nada e não acontece.
 */

import { Alert, Platform } from 'react-native';

import { vibrarAviso } from './vibrar';

const naWeb = Platform.OS === 'web';
const temJanela = () => typeof window !== 'undefined';

export type PedidoAviso = {
  titulo: string;
  mensagem: string;
};

export type PedidoConfirmacao = PedidoAviso & {
  rotuloConfirmar: string;
  destrutivo: boolean;
  aoConfirmar: () => void;
};

/** Quem desenha os avisos no ecrã. Registado pelo `AnfitriaoAvisos`. */
export type AnfitriaoAvisos = {
  avisar: (pedido: PedidoAviso) => void;
  confirmar: (pedido: PedidoConfirmacao) => void;
};

let anfitriao: AnfitriaoAvisos | null = null;

/**
 * Liga (ou desliga, com `null`) o anfitrião que desenha os avisos.
 *
 * Só há um em toda a app. Desligar no desmontar é o que impede um anfitrião
 * antigo — de um recarregamento a quente, por exemplo — de ficar a receber
 * pedidos que ninguém vê.
 */
export function definirAnfitriaoAvisos(a: AnfitriaoAvisos | null): void {
  anfitriao = a;
}

/** Mensagem informativa com um só botão. */
export function avisar(titulo: string, mensagem: string): void {
  // Isto interrompe porque tem de ser lido (ver a tabela do DESIGN_SYSTEM.md).
  // A vibração é o que chama a atenção de quem já ia a guardar o telemóvel no
  // bolso — a lista de animais que ficaram por gravar está aqui, não no ecrã.
  vibrarAviso();
  if (anfitriao) {
    anfitriao.avisar({ titulo, mensagem });
    return;
  }
  if (naWeb) {
    if (temJanela()) window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

/**
 * Pergunta sim/não. Chama `aoConfirmar` apenas se o utilizador aceitar.
 * `destrutivo` marca a ação a vermelho.
 */
export function confirmar(
  titulo: string,
  mensagem: string,
  aoConfirmar: () => void,
  { rotuloConfirmar = 'Confirmar', destrutivo = false } = {},
): void {
  if (anfitriao) {
    anfitriao.confirmar({ titulo, mensagem, rotuloConfirmar, destrutivo, aoConfirmar });
    return;
  }
  if (naWeb) {
    if (temJanela() && window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: rotuloConfirmar,
      style: destrutivo ? 'destructive' : 'default',
      onPress: aoConfirmar,
    },
  ]);
}
