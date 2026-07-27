import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useToqueEmAviso } from '@/data/notificacoesLocais';
import { destinoDoAviso } from '@/data/notificacoesPlano';
import { useGado } from '@/data/store';

/**
 * Tocar no aviso do telemóvel abre o que o aviso é sobre.
 * ------------------------------------------------------------------
 * Não desenha nada — está montado ao lado da navegação (ver `_layout.tsx`) só
 * para ouvir o toque e mandar a app para o sítio certo.
 *
 * Um aviso de prazo é uma ordem de trabalho: "a Mimosa pare amanhã", "faltam 3
 * dias para comunicar o nascimento ao SNIRA". Abrir a app no Início obrigava a
 * ler o aviso, memorizá-lo, e ir procurar o animal a uma lista de dezenas — com
 * o aviso já desaparecido da barra de notificações. Agora abre a ficha desse
 * animal, com o alerta dele à vista no topo.
 *
 * Sem animal (um prazo da exploração), vai para a lista de alertas, que é onde
 * ele está.
 */
export function AberturaPorAviso() {
  const router = useRouter();
  const toque = useToqueEmAviso();
  const { animalById } = useGado();

  // Qual foi o último toque tratado. O `useLastNotificationResponse` continua a
  // devolver o mesmo toque em todos os renders seguintes — sem isto, qualquer
  // redesenho da app empilhava outra vez a ficha do animal, e o botão de voltar
  // passava a ter uma pilha de cópias do mesmo ecrã por baixo.
  const tratado = useRef<string | null>(null);

  useEffect(() => {
    if (!toque || tratado.current === toque.toque) return;
    tratado.current = toque.toque;

    // A escolha do destino é lógica pura e testada — ver `destinoDoAviso`.
    // O `as Href` é o preço de a manter em `data/`, longe do expo-router: as
    // rotas tipadas não reconhecem uma string montada fora delas. Os dois
    // destinos possíveis existem, e o teste garante que continuam a ser esses.
    router.push(destinoDoAviso(toque, (id) => !!animalById(id)) as Href);
  }, [toque, animalById, router]);

  return null;
}
