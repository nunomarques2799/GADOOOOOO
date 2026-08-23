import { useEffect } from 'react';

import { primeiroNome, tituloDaConversa } from '@/data/chat';
import { useNomesEquipa } from '@/data/nomesEquipa';
import { useGado } from '@/data/store';
import { useToasts } from '@/data/toasts';
import { subscreverMensagemNova, useChat } from '@/data/useChat';
import { t } from '@/i18n';

/**
 * O que avisa de uma mensagem nova com a app aberta. Não desenha nada.
 * ------------------------------------------------------------------
 * Duas funções, e a segunda é a que importa: além de mostrar o aviso curto,
 * é este componente que MONTA o `useChat()` na raiz da app. É esse hook que
 * abre a subscrição de tempo real, e sem ela o contador da barra de baixo só
 * mudava depois de alguém abrir as Conversas.
 *
 * Isto NÃO é uma notificação. Só aparece com a app à frente, porque não há
 * servidor de push: a notificação a sério, com a app fechada, precisa de uma
 * chave APNs, de uma tabela de tokens e de um build nativo novo. É a fase
 * seguinte deste trabalho, e é a única parte do pedido que ainda não está
 * feita.
 *
 * Ao lado do `AberturaPorAviso` e do `AgendadorAvisos`, e pela mesma razão:
 * precisa dos contextos todos montados e de estar sempre vivo, não só quando
 * um ecrã de conversa está aberto.
 */
export function AnfitriaoMensagens() {
  const toast = useToasts();
  const { conversas } = useChat();
  const { nomeDe } = useNomesEquipa();
  const { exploracoes } = useGado();

  useEffect(() => {
    return subscreverMensagemNova((m, c) => {
      const conversa = c ?? conversas.find((x) => x.id === m.conversaId);
      const quem = m.autor ? primeiroNome(nomeDe(m.autor) ?? '') : '';
      const onde = conversa
        ? tituloDaConversa(
            conversa,
            nomeDe,
            (id) => exploracoes.find((e) => e.id === id)?.nome,
          )
        : '';
      // Numa privada o título JÁ é o nome de quem escreveu: repeti-lo dava
      // "João" e "João: bom dia" um por cima do outro.
      const cabeca =
        conversa?.tipo === 'grupo' && quem ? `${onde}: ${quem}` : onde || t('chat.mensagemNova');
      toast.info(cabeca, m.texto);
    });
  }, [conversas, exploracoes, nomeDe, toast]);

  return null;
}
