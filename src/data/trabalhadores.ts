/**
 * Quem trabalha nas minhas explorações — lógica pura, sem React nem rede.
 * ------------------------------------------------------------------
 * A equipa está guardada por VÍNCULO (uma linha de `membro_exploracao` por
 * pessoa e por exploração), e é assim que o ecrã da equipa de cada exploração a
 * mostra. Mas a pergunta "quem são os meus trabalhadores?" é sobre PESSOAS: o
 * mesmo trabalhador que anda em duas quintas é um homem, não dois, e vê-lo
 * repetido em duas listas faz perder a conta a quem lá trabalha.
 *
 * Aqui juntam-se os vínculos por pessoa, para o ecrã `(tabs)/trabalhadores.tsx`
 * poder mostrar uma linha por gente e, dentro dela, onde é que ela entra.
 */

import { legendaRole, type PermissoesMembro } from './permissoes';
import type { MembroExploracao, RoleMembro } from './types';

/** Um membro com o nome do perfil, como o `listarMembrosDe` o devolve. */
export type MembroComNome = MembroExploracao & { nome: string };

/** A equipa de uma exploração. */
export type EquipaExploracao = {
  exploracaoId: string;
  nomeExploracao: string;
  membros: MembroComNome[];
};

/** Onde é que uma pessoa entra, e com que papel. */
export type Vinculo = {
  /** Id da linha de `membro_exploracao` — é o que se remove. */
  membroId: string;
  exploracaoId: string;
  nomeExploracao: string;
  role: RoleMembro;
  criadoEm?: string;
  /**
   * Ajustes de permissões nesta exploração (o que o dono deu ou tirou por cima
   * do papel). Ausente = segue o papel. Ver `permissoes.ts`.
   */
  permissoes?: PermissoesMembro;
};

export type Trabalhador = {
  userId: string;
  nome: string;
  /**
   * O papel por que a pessoa se apresenta na lista. Quem é trabalhador numa
   * quinta e veterinário noutra aparece como trabalhador: é o papel de quem
   * está lá todos os dias, e é por ele que o criador a procura.
   */
  papelPrincipal: RoleMembro;
  vinculos: Vinculo[];
};

/**
 * Ordem por que os papéis aparecem. Trabalhadores primeiro — o ecrã chama-se
 * Trabalhadores; os veterinários visitam, e os outros donos (co-admins) não são
 * equipa contratada.
 */
const ORDEM_PAPEL: Record<RoleMembro, number> = {
  trabalhador: 0,
  veterinario: 1,
  admin: 2,
};

/**
 * Junta as equipas de várias explorações numa lista de pessoas.
 *
 * `excluirUserId` serve para deixar de fora quem está a olhar: um dono não é
 * "um dos meus trabalhadores", e vê-se a si próprio no topo da lista sem
 * ganhar nada com isso.
 */
export function agruparTrabalhadores(
  equipas: EquipaExploracao[],
  { excluirUserId }: { excluirUserId?: string } = {},
): Trabalhador[] {
  const porPessoa = new Map<string, Trabalhador>();

  for (const equipa of equipas) {
    for (const m of equipa.membros) {
      if (excluirUserId && m.userId === excluirUserId) continue;
      const vinculo: Vinculo = {
        membroId: m.id,
        exploracaoId: equipa.exploracaoId,
        nomeExploracao: equipa.nomeExploracao,
        role: m.role,
        criadoEm: m.criadoEm,
        permissoes: m.permissoes,
      };
      const ja = porPessoa.get(m.userId);
      if (ja) {
        // O mesmo vínculo pode chegar duas vezes se a mesma exploração vier
        // repetida na lista de equipas — contá-lo duas vezes fazia o cartão
        // dizer "2 explorações" quando é uma.
        if (!ja.vinculos.some((v) => v.membroId === vinculo.membroId)) ja.vinculos.push(vinculo);
        // O nome pode faltar numa das linhas (perfil sem nome ainda): fica o
        // primeiro nome a sério que aparecer.
        if (ja.nome === '—' && m.nome !== '—') ja.nome = m.nome;
        if (ORDEM_PAPEL[m.role] < ORDEM_PAPEL[ja.papelPrincipal]) ja.papelPrincipal = m.role;
      } else {
        porPessoa.set(m.userId, {
          userId: m.userId,
          nome: m.nome,
          papelPrincipal: m.role,
          vinculos: [vinculo],
        });
      }
    }
  }

  const lista = [...porPessoa.values()];
  for (const t of lista) {
    t.vinculos.sort((a, b) => a.nomeExploracao.localeCompare(b.nomeExploracao, 'pt'));
  }
  return lista.sort(
    (a, b) =>
      ORDEM_PAPEL[a.papelPrincipal] - ORDEM_PAPEL[b.papelPrincipal]
      || a.nome.localeCompare(b.nome, 'pt'),
  );
}

/** Quantas pessoas há de cada papel, para o resumo do topo do ecrã. */
export function contarPorPapel(lista: Trabalhador[]): Record<RoleMembro, number> {
  const conta: Record<RoleMembro, number> = { trabalhador: 0, veterinario: 0, admin: 0 };
  for (const t of lista) conta[t.papelPrincipal]++;
  return conta;
}

/**
 * Como se descreve onde a pessoa entra: "Trabalhador em Monte do Avô" ou, com
 * o mesmo papel em várias, "Trabalhador em 2 explorações".
 */
export function resumoVinculos(t: Trabalhador): string {
  if (t.vinculos.length === 1) {
    const v = t.vinculos[0];
    return `${legendaRole(v.role)} em ${v.nomeExploracao}`;
  }
  const papeis = new Set(t.vinculos.map((v) => v.role));
  if (papeis.size === 1) {
    return `${legendaRole(t.papelPrincipal)} em ${t.vinculos.length} explorações`;
  }
  return t.vinculos.map((v) => `${legendaRole(v.role)} em ${v.nomeExploracao}`).join(' · ');
}

/** Iniciais para o avatar: "Joaquim Marques" → "JM". */
export function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 1 || /[A-Za-zÀ-ÿ]/.test(p));
  if (partes.length === 0) return '?';
  const primeira = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}
