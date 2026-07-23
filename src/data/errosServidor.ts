/**
 * Mensagens do servidor traduzidas para quem está do outro lado do ecrã.
 * ------------------------------------------------------------------
 * O Postgres e o PostgREST escrevem para quem administra bases de dados. Um
 * criador de gado que carrega em "Guardar" e recebe
 *
 *   new row violates row-level security policy for table "exploracao"
 *
 * não fica a saber nada — nem o que correu mal, nem o que pode fazer a seguir.
 * Pior: a frase parece um defeito da app, quando quase sempre descreve uma
 * regra a funcionar como devia (a conta ainda não foi aprovada).
 *
 * Aqui só se traduzem os casos RECONHECIDOS. O que não estiver na lista passa
 * tal e qual: uma mensagem estranha é melhor do que uma mensagem inventada, e é
 * por ela que se descobre o caso seguinte a acrescentar.
 */

/**
 * Só se chama com o `message` de um erro vindo do Supabase. As mensagens de
 * conflito de versão são escritas pelo `supabaseRepo.ts` já em português e não
 * passam por aqui — se passassem, o prefixo `CONFLITO_DE_VERSAO` que a UI usa
 * para as reconhecer podia ser reescrito por engano.
 */
export function traduzErroServidor(msg: string): string {
  const m = msg.toLowerCase();

  // ---- RLS: a regra do servidor recusou ----
  if (m.includes('row-level security') || m.includes('row level security')) {
    // O servidor diz "recusado" e não diz porquê. Aqui só se pode dizer o que
    // se sabe: houve recusa e estas são as duas razões possíveis. A primeira
    // versão desta mensagem afirmava que a conta estava por aprovar — e foi
    // mostrada a uma conta aprovada, a mandá-la falar com um administrador que
    // não tinha nada para fazer. Uma mensagem errada custa mais do que uma
    // mensagem vaga. Quem consegue distinguir os dois casos é `explicarRecusa`
    // no `supabaseRepo.ts`, que vai perguntar ao servidor quem somos.
    if (m.includes('"exploracao"')) {
      return (
        'O servidor recusou criar a exploração. ' +
        'Ou a sessão expirou — feche e volte a entrar — ou a conta ainda não ' +
        'está aprovada para criar explorações.'
      );
    }
    return (
      'Não tem permissão para gravar isto. ' +
      'Se acha que devia ter, peça ao administrador da exploração.'
    );
  }

  // ---- PostgREST com a cópia do schema desatualizada ----
  // A coluna existe na base; quem não sabe dela é a API. Acontece nos minutos
  // a seguir a uma alteração à base de dados, e passa sozinho.
  if (m.includes('schema cache')) {
    return (
      'O servidor foi atualizado há pouco e ainda não reconhece este campo. ' +
      'Tente daqui a um minuto; se continuar, avise quem gere a aplicação.'
    );
  }

  // ---- Sem rede ----
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network request')) {
    return 'Sem ligação ao servidor. A alteração fica guardada e é enviada quando houver rede.';
  }

  return msg;
}
