/**
 * Escrever ao apoio e reportar um problema, de dentro da app.
 * ------------------------------------------------------------------
 * A Ajuda tinha um botão "Enviar email" que abria o `mailto:` do aparelho. Num
 * telemóvel Android sem conta de correio configurada — que é o caso do criador
 * para quem esta app é feita — esse botão não faz nada: nem abre, nem explica,
 * nem falha à vista. Quem o carrega fica convencido de que escreveu e do outro
 * lado não chegou nada.
 *
 * Passa a haver um formulário dentro da app e é a base de dados que envia, pela
 * mesma via do aviso de registo novo (`supabase/schema_apoio.sql`). O destino é
 * fixo no servidor: nada aqui escolhe para onde vai, e é isso que impede que
 * isto se torne um enviador de emails em nome da Terrabovina.
 *
 * As regras de validação estão repetidas aqui e no SQL de propósito. As daqui
 * existem para o criador saber o que corrigir ANTES de esperar por uma ida ao
 * servidor; as de lá são as que valem, porque o servidor não pode confiar no
 * que o cliente lhe manda.
 */

import { Platform } from 'react-native';

import { supabase } from './supabase';
import { VERSAO_APP } from './versao';

export type TipoMensagem = 'apoio' | 'bug';

/** Para onde vai. Não é usado no envio (o servidor decide) — é o que se mostra. */
export const EMAIL_APOIO = 'terrabovinasuperadmin@gmail.com';

export const MAX_ASSUNTO = 150;
export const MAX_TEXTO = 4000;
/** Abaixo disto não há descrição nenhuma, só um "não funciona". */
export const MIN_TEXTO = 10;

/**
 * O que falta para a mensagem poder ser enviada, em palavras — ou `null` se
 * está pronta.
 *
 * Uma frase por engano, e não uma para os dois campos: "falta o assunto" e
 * "escreva mais" pedem correções diferentes, e um "preenchimento inválido"
 * deixava o criador a adivinhar em qual dos dois campos mexer.
 */
export function problemaComMensagem(assunto: string, texto: string): string | null {
  const a = assunto.trim();
  const t = texto.trim();
  if (!a) return 'Escreva um assunto — uma linha a dizer do que se trata.';
  if (a.length > MAX_ASSUNTO) return 'O assunto é demasiado comprido.';
  if (t.length < MIN_TEXTO) return 'Conte-nos um pouco mais sobre o que se passa.';
  if (t.length > MAX_TEXTO) return 'A mensagem é demasiado comprida. Conte o essencial.';
  return null;
}

/**
 * A linha de diagnóstico que segue com o reporte de um problema.
 *
 * Vai só nos problemas e não nas mensagens de apoio: numa dúvida sobre como
 * registar um animal, a versão da app é ruído; num problema, é a primeira coisa
 * que se pergunta e a que ninguém sabe responder de cabeça.
 */
export function contextoDoAparelho(): string {
  const onde =
    Platform.OS === 'web'
      ? typeof navigator !== 'undefined' && navigator.userAgent
        ? `navegador · ${navigator.userAgent.slice(0, 120)}`
        : 'navegador'
      : `${Platform.OS} ${String(Platform.Version)}`;
  return `Terrabovina ${VERSAO_APP} · ${onde}`;
}

/**
 * Envia. Devolve a razão da recusa, ou `null` se saiu.
 *
 * Não engole o erro nem responde "enviado" na dúvida: alguém que julga ter
 * reportado um problema e não reportou fica à espera de uma resposta que nunca
 * vem, e não volta a tentar por outra via.
 */
export async function enviarMensagemApoio(
  tipo: TipoMensagem,
  assunto: string,
  texto: string,
): Promise<string | null> {
  const problema = problemaComMensagem(assunto, texto);
  if (problema) return problema;
  if (!supabase) {
    return `A app está em modo local, sem ligação à conta. Escreva-nos para ${EMAIL_APOIO}.`;
  }

  const { error } = await supabase.rpc('enviar_mensagem_apoio', {
    p_tipo: tipo,
    p_assunto: assunto.trim(),
    p_texto: texto.trim(),
    p_contexto: tipo === 'bug' ? contextoDoAparelho() : null,
  });
  return error?.message ?? null;
}
