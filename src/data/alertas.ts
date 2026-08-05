/**
 * Os alertas — tudo o que a app calcula e põe à frente do criador.
 * ------------------------------------------------------------------
 * Lógica pura, sem React e sem rede, para poder ser testada.
 *
 * ESTEVE EM `helpers.ts` até os alertas de reprodução existirem. Saiu de lá por
 * uma razão de arrumação que é também de funcionamento: `reproducao.ts` precisa
 * das contas de datas do `helpers.ts`, e se o `helpers.ts` precisasse do
 * `reproducao.ts` para calcular alertas ficavam os dois a importar-se um ao
 * outro. As camadas ficam assim:
 *
 *   helpers ............. datas, formatação, contas
 *      ↑
 *   reproducao / snira / medicamentos ...... domínio
 *      ↑
 *   alertas ............. junta tudo e diz o que está pendente
 *
 * O `helpers.ts` mantém-se em baixo e não conhece nenhum dos de cima.
 */

import {
  PartoPrevisaoCaducaDias,
  PrazosExistencias,
  PrazosLegais,
  PrazosReproducao,
  PrazosSanitarios,
} from './constants';
import { diaIso, diasAte, idadeDias, isoMaisDias } from './helpers';
import { lotesComEstado } from './medicamentos';
import { aguardamDiagnostico, semCobricaoAposParto } from './reproducao';
import { comunicacoesPendentes, rotuloComunicacao } from './snira';
import type { Alerta, Animal, Evento, Medicamento } from './types';

const MS_DIA = 86_400_000;

/* ---- Cálculo de alertas legais ---- */
export function computeAlertas(
  animais: Animal[],
  eventos: Evento[] = [],
  medicamentos: Medicamento[] = [],
): Alerta[] {
  const out: Alerta[] = [];

  // Data da última vacinação por animal (ms), para os alertas de revacinação.
  const ultimaVacinacao = new Map<string, number>();
  for (const e of eventos) {
    if (e.tipo !== 'Vacinação') continue;
    const t = new Date(e.data).getTime();
    if (Number.isNaN(t)) continue;
    const anterior = ultimaVacinacao.get(e.animalId);
    if (anterior === undefined || t > anterior) ultimaVacinacao.set(e.animalId, t);
  }

  for (const a of animais) {
    // Animais que já saíram do efetivo (falecidos/vendidos) não geram alertas.
    if (a.estado && a.estado !== 'ativo') continue;
    const rotulo = a.nome ?? a.numeroIdentificacao ?? 'Sem nome';

    // Identificação (brinco) até 20 dias de vida — bovinos
    if (a.especie === 'Bovino' && !a.numeroIdentificacao) {
      const prazo = PrazosLegais.identificacao - idadeDias(a.dataNascimento);
      out.push({
        id: `id-${a.id}`,
        categoria: 'identificacao',
        animalId: a.id,
        exploracaoId: a.exploracaoId,
        data: isoMaisDias(a.dataNascimento, PrazosLegais.identificacao),
        gravidade: prazo <= 0 ? 'urgente' : prazo <= 5 ? 'aviso' : 'info',
        titulo: prazo <= 0 ? 'Identificação em atraso' : 'Falta identificar (brinco)',
        descricao:
          prazo <= 0
            ? `${rotulo} devia estar identificado. Prazo excedido há ${Math.abs(prazo)} dia(s).`
            : `${rotulo} tem ${idadeDias(a.dataNascimento)} dias. Colocar brinco em ${prazo} dia(s).`,
        diasRestantes: prazo,
      });
    }

    // Comunicação ao SNIRA — 7 dias após identificação
    if (a.dataIdentificacao && a.comunicadoSnira === false) {
      const prazo = PrazosLegais.snira - idadeDias(a.dataIdentificacao);
      out.push({
        id: `snira-${a.id}`,
        categoria: 'snira',
        animalId: a.id,
        exploracaoId: a.exploracaoId,
        data: isoMaisDias(a.dataIdentificacao, PrazosLegais.snira),
        gravidade: prazo <= 0 ? 'urgente' : prazo <= 3 ? 'aviso' : 'info',
        titulo: prazo <= 0 ? 'Comunicação SNIRA em atraso' : 'Comunicar ao SNIRA',
        descricao:
          prazo <= 0
            ? `${rotulo}: nascimento por comunicar ao SNIRA. Prazo excedido há ${Math.abs(prazo)} dia(s).`
            : `${rotulo}: comunicar nascimento ao SNIRA em ${prazo} dia(s).`,
        diasRestantes: prazo,
      });
    }

    // Parto previsto
    if (a.dataPrevistaParto) {
      const dias = diasAte(a.dataPrevistaParto);
      if (dias < -PartoPrevisaoCaducaDias) {
        // Previsão caducada: ou o parto aconteceu e não foi registado, ou a
        // conta estava errada. Continuar a contar dias de atraso não ajuda —
        // o que falta é o criador dizer o que aconteceu. Sem `diasRestantes`,
        // fica dispensável (ver `dispensados.ts`) e não fica preso na lista.
        out.push({
          id: `parto-${a.id}`,
          categoria: 'parto',
          animalId: a.id,
          exploracaoId: a.exploracaoId,
          data: a.dataPrevistaParto,
          gravidade: 'info',
          titulo: 'Parto previsto por confirmar',
          descricao: `${rotulo}: a data prevista de parto já passou há mais de ${PartoPrevisaoCaducaDias} dias. Registe o parto ou corrija a previsão.`,
        });
      } else if (dias <= 14) {
        out.push({
          id: `parto-${a.id}`,
          categoria: 'parto',
          animalId: a.id,
          exploracaoId: a.exploracaoId,
          data: a.dataPrevistaParto,
          gravidade: dias <= 3 ? 'aviso' : 'info',
          titulo: 'Parto previsto',
          descricao:
            dias < 0
              ? `${rotulo} passou a data prevista de parto há ${Math.abs(dias)} dia(s).`
              : `${rotulo} está próxima do parto (${dias} dia(s)).`,
          diasRestantes: dias,
        });
      }
    }

    // Intervalo de segurança de medicamento
    if (a.fimIntervaloSeguranca) {
      const dias = diasAte(a.fimIntervaloSeguranca);
      if (dias > 0) {
        out.push({
          id: `med-${a.id}`,
          categoria: 'medicamento',
          animalId: a.id,
          exploracaoId: a.exploracaoId,
          data: a.fimIntervaloSeguranca,
          gravidade: 'info',
          titulo: 'Período de segurança',
          descricao: `${rotulo}: em intervalo de segurança, não vender para abate (faltam ${dias} dia(s)).`,
          diasRestantes: dias,
        });
      }
    }

    // Vacinação — revacinação anual (ou falta de registo em adultos).
    const idade = idadeDias(a.dataNascimento);
    const ultima = ultimaVacinacao.get(a.id);
    if (ultima !== undefined) {
      const diasDesde = Math.floor((Date.now() - ultima) / MS_DIA);
      const restam = PrazosSanitarios.revacinacao - diasDesde;
      if (restam <= PrazosSanitarios.avisoRevacinacaoDias) {
        out.push({
          id: `vac-${a.id}`,
          categoria: 'vacinacao',
          animalId: a.id,
          exploracaoId: a.exploracaoId,
          data: isoMaisDias(new Date(ultima).toISOString(), PrazosSanitarios.revacinacao),
          gravidade: restam <= 0 ? 'urgente' : 'info',
          titulo: restam <= 0 ? 'Revacinação em atraso' : 'Revacinação a aproximar-se',
          descricao:
            restam <= 0
              ? `${rotulo}: passou ~1 ano da última vacinação. Prazo excedido há ${Math.abs(restam)} dia(s).`
              : `${rotulo}: revacinar em ${restam} dia(s) (última há ${diasDesde} dias).`,
          diasRestantes: restam,
        });
      }
    } else if (idade >= PrazosSanitarios.idadeMinVacinacaoDias) {
      out.push({
        id: `vac-${a.id}`,
        categoria: 'vacinacao',
        animalId: a.id,
        exploracaoId: a.exploracaoId,
        // Sem `data` de propósito: não há prazo nenhum a correr, há um registo
        // em falta. No calendário só apareceria a fingir de tarefa marcada.
        gravidade: 'info',
        titulo: 'Sem registo de vacinação',
        descricao: `${rotulo} não tem nenhuma vacinação registada. Registe a última para acompanhar o plano.`,
      });
    }
  }

  out.push(...alertasSnira(animais, eventos));
  out.push(...alertasReproducao(animais, eventos));
  out.push(...alertasExistencias(medicamentos, eventos));

  const ordem = { urgente: 0, aviso: 1, info: 2 };
  return out.sort((x, y) => {
    if (ordem[x.gravidade] !== ordem[y.gravidade]) return ordem[x.gravidade] - ordem[y.gravidade];
    return (x.diasRestantes ?? 99) - (y.diasRestantes ?? 99);
  });
}

/* ------------------------------------------------------------------ *
 *  SNIRA — as comunicações que NÃO são o nascimento
 * ------------------------------------------------------------------ */

/**
 * O nascimento fica no ciclo acima, onde sempre esteve (vem do animal, não de
 * um evento). Aqui entram a morte, a saída, a entrada e a movimentação, que
 * vivem nos eventos — e por isso o `comunicacoesPendentes` é filtrado para não
 * duplicar o que já foi produzido.
 */
function alertasSnira(animais: Animal[], eventos: Evento[]): Alerta[] {
  return comunicacoesPendentes(animais, eventos)
    .filter((p) => p.tipo !== 'nascimento')
    .map((p) => {
      const dias = p.diasRestantes;
      const oQue = rotuloComunicacao[p.tipo].toLowerCase();
      return {
        id: `snira-ev-${p.eventoId}`,
        categoria: 'snira' as const,
        animalId: p.animalId,
        exploracaoId: p.exploracaoId,
        data: p.prazo,
        gravidade: dias < 0 ? ('urgente' as const) : dias <= 3 ? ('aviso' as const) : ('info' as const),
        titulo: dias < 0 ? `Comunicação SNIRA em atraso` : `Comunicar ${oQue} ao SNIRA`,
        descricao:
          dias < 0
            ? `${p.rotulo}: ${oQue} de ${diaIso(p.data)} por comunicar. Prazo excedido há ${Math.abs(dias)} dia(s).`
            : `${p.rotulo}: comunicar ${oQue} de ${diaIso(p.data)} em ${dias} dia(s).`,
        diasRestantes: dias,
      };
    });
}

/* ------------------------------------------------------------------ *
 *  Reprodução
 * ------------------------------------------------------------------ */

/**
 * Dois alertas, e nenhum deles tem prazo LEGAL — são prazos de maneio. Por isso
 * nenhum é `urgente` por vencimento de data: sobem a urgente quando o atraso já
 * custou o ciclo, que é a régua que faz sentido aqui.
 *
 * Os dois trazem `diasRestantes` NEGATIVO (o atraso), e não um prazo a correr.
 * É o que os põe no topo da lista ordenada e, ao mesmo tempo, o que os torna
 * NÃO dispensáveis (ver `dispensados.ts`): uma vaca parada há cinco meses não é
 * coisa que se cale, é coisa que se resolve.
 */
function alertasReproducao(animais: Animal[], eventos: Evento[]): Alerta[] {
  const out: Alerta[] = [];

  for (const { animal, estado } of aguardamDiagnostico(animais, eventos)) {
    const rotulo = animal.nome ?? animal.numeroIdentificacao ?? 'Sem nome';
    const dias = estado.diasNaFase;
    const duvidosa = estado.fase === 'duvidosa';
    out.push({
      id: `diag-${animal.id}`,
      categoria: 'reproducao',
      animalId: animal.id,
      exploracaoId: animal.exploracaoId,
      // Sem `data`: o que falta é uma ida do veterinário, não um dia marcado.
      // Pô-lo no calendário fazia-o passar por tarefa agendada.
      gravidade: dias >= PrazosReproducao.diagnosticoUrgenteAPartirDe ? 'urgente' : 'aviso',
      titulo: duvidosa ? 'Diagnóstico por repetir' : 'Diagnóstico de gestação em falta',
      descricao: duvidosa
        ? `${rotulo}: o diagnóstico ficou por confirmar há ${dias} dias. Repetir.`
        : `${rotulo}: coberta há ${dias} dias e ainda sem diagnóstico. Confirme se está gestante.`,
      diasRestantes: -dias,
    });
  }

  for (const { animal, estado } of semCobricaoAposParto(animais, eventos)) {
    const rotulo = animal.nome ?? animal.numeroIdentificacao ?? 'Sem nome';
    const dias = estado.diasDesdeUltimoParto ?? 0;
    out.push({
      id: `cobr-${animal.id}`,
      categoria: 'reproducao',
      animalId: animal.id,
      exploracaoId: animal.exploracaoId,
      gravidade: dias >= PrazosReproducao.cobrirUrgenteApos ? 'urgente' : 'aviso',
      titulo: 'Sem cobrição desde o parto',
      descricao: `${rotulo}: pariu há ${dias} dias e não voltou a ser coberta. Cada dia parada adia o parto seguinte.`,
      diasRestantes: -dias,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 *  Existências
 * ------------------------------------------------------------------ */

/**
 * Os únicos alertas que não falam de um animal — falam da arrecadação. Por isso
 * não trazem `animalId`, e quem os agrupa por animal (a lista de Animais) tem
 * de contar com isso.
 *
 * Um lote esgotado NÃO gera alerta: acabar é o destino normal de um frasco, e
 * um aviso por cada um que acaba enchia a lista de coisas resolvidas. O que
 * gera aviso é o que está a acabar (dá para comprar a tempo) e o que já não se
 * pode usar (é preciso tirá-lo da prateleira).
 */
function alertasExistencias(medicamentos: Medicamento[], eventos: Evento[]): Alerta[] {
  return lotesComEstado(medicamentos, eventos).flatMap((l): Alerta[] => {
    const m = l.medicamento;
    const nome = m.lote?.trim() ? `${m.nome} (lote ${m.lote.trim()})` : m.nome;

    if (l.expirado) {
      // Um lote expirado e já vazio não interessa a ninguém: não há nada para
      // tirar da prateleira. Só avisa se ainda lá está alguma coisa.
      if (l.esgotado) return [];
      return [
        {
          id: `val-${m.id}`,
          categoria: 'existencias',
          exploracaoId: m.exploracaoId,
          medicamentoId: m.id,
          data: m.validade,
          gravidade: 'urgente',
          titulo: 'Medicamento fora de validade',
          descricao: `${nome}: a validade passou há ${Math.abs(l.diasParaValidade ?? 0)} dia(s) e ainda há existências. Não administrar.`,
          diasRestantes: l.diasParaValidade,
        },
      ];
    }

    if (l.aExpirar && !l.esgotado) {
      return [
        {
          id: `val-${m.id}`,
          categoria: 'existencias',
          exploracaoId: m.exploracaoId,
          medicamentoId: m.id,
          data: m.validade,
          gravidade: (l.diasParaValidade ?? 0) <= 7 ? 'aviso' : 'info',
          titulo: 'Validade a terminar',
          descricao: `${nome}: expira em ${l.diasParaValidade} dia(s). Gaste este lote antes dos outros.`,
          diasRestantes: l.diasParaValidade,
        },
      ];
    }

    if (l.quaseVazio) {
      return [
        {
          id: `stock-${m.id}`,
          categoria: 'existencias',
          exploracaoId: m.exploracaoId,
          medicamentoId: m.id,
          // Sem `data`: não há prazo nenhum. É por isso — e de propósito — que
          // este é o único alerta das existências que se pode calar.
          gravidade: 'info',
          titulo: 'Existências a acabar',
          descricao: `${nome}: restam ${l.resta} ${m.unidade} de ${m.quantidade}.`,
        },
      ];
    }

    return [];
  });
}
