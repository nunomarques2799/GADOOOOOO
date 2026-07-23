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
    // Criar exploração é o único caso em que a recusa quer dizer "conta por
    // aprovar" — a política `exploracao_ativo_insert` exige um perfil ativo, e
    // é a porta por onde passa qualquer cliente novo.
    if (m.includes('"exploracao"')) {
      return (
        'A sua conta ainda não foi aprovada para criar explorações. ' +
        'Fale com o administrador — assim que aprovar, é só tentar de novo.'
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
