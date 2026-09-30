import { useCallback } from 'react';

import { useAuth } from '@/data/auth';
import { confirmar } from '@/data/avisos';
import { t } from '@/i18n';

/**
 * Terminar sessão, sempre com uma pergunta antes.
 *
 * Saía à primeira: um toque ao lado, e o criador ficava no ecrã de entrada a
 * ter de se lembrar do email e da palavra-passe. Agora pergunta sempre, e com
 * alterações ainda por enviar a pergunta é outra e mais séria (terminar sessão
 * apaga a cache do aparelho, e com ela o que não chegou ao servidor).
 *
 * \`pendentes\` vem de quem chama: o ecrã de espera da aprovação vive fora do
 * store dos dados e não tem fila nenhuma.
 */
export function useTerminarSessao(pendentes = 0) {
  const { sair } = useAuth();
  return useCallback(() => {
    if (pendentes > 0) {
      confirmar(
        t('perfil.porEnviarTitulo'),
        t('perfil.porEnviarMensagem', { n: pendentes }),
        () => void sair(),
        { rotuloConfirmar: t('perfil.sairAMesma'), destrutivo: true },
      );
      return;
    }
    confirmar(t('perfil.sairTitulo'), t('perfil.sairMensagem'), () => void sair(), {
      rotuloConfirmar: t('perfil.terminarSessao'),
      destrutivo: true,
    });
  }, [pendentes, sair]);
}
