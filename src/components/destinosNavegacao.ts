import type { Href } from 'expo-router';
import { useMemo } from 'react';

import type { IconName } from '@/components/ui';
import { useMembros } from '@/data/membros';
import type { CapacidadeLeitura } from '@/data/permissoes';
import { useExistencias } from '@/data/useExistencias';
import type { ChaveTexto } from '@/i18n';

/**
 * Os destinos da navegação: a barra lateral do computador, a barra de baixo do
 * telemóvel e a folha do "Mais" leem todos esta tabela.
 *
 * Saiu do `(tabs)/_layout.tsx` quando os atalhos da barra passaram a ser
 * escolhidos pelo criador: o ecrã onde se escolhem (`conta/barra.tsx`) precisa
 * da mesma lista, e importar de um ficheiro de rota não é coisa que se faça.
 */

type Rota = Extract<Href, string>;
export type Destino = {
  nome: string;
  rota: Rota;
  /**
   * A CHAVE do rótulo, não o rótulo.
   *
   * Esta tabela é criada ao importar o módulo, e o `t()` lê o idioma de uma
   * variável que o arranque preenche — uma string resolvida aqui ficava
   * congelada na língua de origem, exatamente como acontece com as cores lidas
   * fora do render (ver a nota do `colors` no AGENTS.md). Com a chave, quem
   * desenha é que traduz.
   */
  chave: ChaveTexto;
  icon: IconName;
  /**
   * Um rótulo mais CURTO, só para a barra de baixo do telemóvel.
   *
   * "Conversas" é comprido para uma coluna da barra num ecrã de 375px, e com a
   * letra do sistema no máximo encostava-se aos vizinhos. Na barra lateral do
   * computador e em todo o resto da app continua a chamar-se pelo nome
   * inteiro, que é onde há espaço para ele.
   */
  curto?: ChaveTexto;

  /** Só aparece a quem gere a equipa de alguma exploração. */
  soComEquipa?: boolean;
  /**
   * Só aparece a quem pode CONSULTAR isto nalguma exploração. Serve os
   * separadores que um convidado não tem que abrir: as contas da exploração e
   * os ficheiros com o efetivo lá dentro.
   */
  exigeLeitura?: CapacidadeLeitura;
  /**
   * Só aparece se o criador tiver LIGADO a funcionalidade nas Definições.
   *
   * É diferente do `exigeLeitura`: aquele é sobre o que este PAPEL pode ver,
   * este é sobre o que a CONTA escolheu ter. As finanças precisam dos dois (só
   * o dono liga, e nem toda a equipa vê as contas depois de ligadas); as
   * existências só deste — ligada a arrecadação, quem trata dos animais precisa
   * de escolher o frasco de onde saiu a dose, seja trabalhador ou veterinário.
   */
  exigeInterruptor?: 'existencias';
};

/**
 * Os destinos, pela ordem em que aparecem na barra lateral. Os ícones são de
 * traço, nunca cheios (guia de estilo); os Animais levam o brinco e os Terrenos
 * o mapa, como na barra de baixo do guia.
 * `nome` é o ficheiro dentro de `(tabs)/`; `rota` é o URL (o grupo `(tabs)`
 * não aparece no caminho, por isso `(tabs)/alertas.tsx` serve `/alertas`).
 *
 * `soComEquipa` marca os que só fazem sentido a quem tem equipa para gerir:
 * um trabalhador convidado não vê a lista de colegas (a RLS também não lha
 * daria), e um destino que abre sempre vazio é um destino a mais na barra.
 */
export const DESTINOS: Destino[] = [
  { nome: 'index', rota: '/', chave: 'nav.inicio', icon: 'home-outline' },
  { nome: 'exploracoes', rota: '/exploracoes', chave: 'nav.exploracoes', icon: 'barn' },
  { nome: 'terrenos', rota: '/terrenos', chave: 'nav.terrenos', icon: 'map-outline' },
  { nome: 'animais', rota: '/animais', chave: 'nav.animais', icon: 'tag-outline' },
  { nome: 'alertas', rota: '/alertas', chave: 'nav.alertas', icon: 'bell-outline' },
  { nome: 'chat', rota: '/chat', chave: 'nav.chat', curto: 'nav.chatCurto', icon: 'chat-outline' },
  { nome: 'reproducao', rota: '/reproducao', chave: 'nav.reproducao', icon: 'heart-pulse' },
  {
    nome: 'medicamentos',
    rota: '/medicamentos',
    chave: 'nav.existencias',
    icon: 'package-variant',
    exigeInterruptor: 'existencias',
  },
  {
    nome: 'trabalhadores',
    rota: '/trabalhadores',
    chave: 'nav.trabalhadores',
    icon: 'account-hard-hat-outline',
    soComEquipa: true,
  },
  {
    nome: 'financas',
    rota: '/financas',
    chave: 'nav.financas',
    icon: 'cash-multiple',
    exigeLeitura: 'verFinancas',
  },
  {
    nome: 'documentos',
    rota: '/documentos',
    chave: 'nav.documentos',
    icon: 'file-document-outline',
    exigeLeitura: 'verDocumentos',
  },
  { nome: 'definicoes', rota: '/definicoes', chave: 'nav.definicoes', icon: 'cog-outline' },
  { nome: 'perfil', rota: '/perfil', chave: 'nav.perfil', icon: 'account-outline' },
];

/**
 * Os destinos que esta pessoa pode ver. A rota continua declarada (quem chegar
 * lá por um link encontra o ecrã, que se explica a si mesmo) — o que se filtra
 * é a NAVEGAÇÃO, para ninguém tropeçar num ecrã que a RLS lhe fecha.
 */
export function useDestinos(): Destino[] {
  const { podeEmAlguma, podeVer } = useMembros();
  const comEquipa = podeEmAlguma('gerirEquipa');
  // `podeVer(undefined, …)` responde por QUALQUER exploração de que se seja
  // membro: quem tem duas quintas e as contas ligadas só numa continua a ver o
  // separador. É a mesma pergunta que os ecrãs de dentro fazem.
  const comFinancas = podeVer(undefined, 'verFinancas');
  const comDocumentos = podeVer(undefined, 'verDocumentos');
  const { ativas: comExistencias } = useExistencias();

  return useMemo(
    () =>
      DESTINOS.filter((d) => {
        if (d.soComEquipa && !comEquipa) return false;
        if (d.exigeInterruptor === 'existencias' && !comExistencias) return false;
        if (d.exigeLeitura === 'verFinancas') return comFinancas;
        if (d.exigeLeitura === 'verDocumentos') return comDocumentos;
        return true;
      }),
    [comEquipa, comFinancas, comDocumentos, comExistencias],
  );
}
