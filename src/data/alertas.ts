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

import { t, type ChaveTexto } from '@/i18n';

import {
  PartoPrevisaoCaducaDias,
  PrazosExistencias,
  PrazosLegais,
  PrazosReproducao,
  PrazosSanitarios,
} from './constants';
import { diaIso, diasAte, diasEntreDatas, idadeDias, isoMaisDias } from './helpers';
import { lotesComEstado } from './medicamentos';
import { aguardamDiagnostico, semCobricaoAposParto } from './reproducao';
import { comunicacoesPendentes, type TipoComunicacao } from './snira';
import type { Alerta, Animal, Evento, Medicamento } from './types';

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
    const rotulo = a.nome ?? a.numeroIdentificacao ?? t('animais.semNome');

    // Identificação (brinco) até 20 dias de vida, bovinos
    if (a.especie === 'Bovino' && !a.numeroIdentificacao) {
      const prazo = PrazosLegais.identificacao - idadeDias(a.dataNascimento);
      out.push({
        id: `id-${a.id}`,
        categoria: 'identificacao',
        animalId: a.id,
        exploracaoId: a.exploracaoId,
        data: isoMaisDias(a.dataNascimento, PrazosLegais.identificacao),
        gravidade: prazo <= 0 ? 'urgente' : prazo <= 5 ? 'aviso' : 'info',
        titulo: t(prazo <= 0 ? 'aviso.idAtrasoTitulo' : 'aviso.idTitulo'),
        descricao:
          prazo <= 0
            ? t('aviso.idAtrasoDesc', { rotulo, n: Math.abs(prazo) })
            : t('aviso.idDesc', {
                rotulo,
                idade: t('idade.dias', { n: idadeDias(a.dataNascimento) }),
                n: prazo,
              }),
        diasRestantes: prazo,
      });
    }

    // Comunicação ao SNIRA: 7 dias após a identificação
    if (a.dataIdentificacao && a.comunicadoSnira === false) {
      const prazo = PrazosLegais.snira - idadeDias(a.dataIdentificacao);
      out.push({
        id: `snira-${a.id}`,
        categoria: 'snira',
        animalId: a.id,
        exploracaoId: a.exploracaoId,
        data: isoMaisDias(a.dataIdentificacao, PrazosLegais.snira),
        gravidade: prazo <= 0 ? 'urgente' : prazo <= 3 ? 'aviso' : 'info',
        titulo: t(prazo <= 0 ? 'aviso.sniraAtrasoTitulo' : 'aviso.sniraNascTitulo'),
        descricao:
          prazo <= 0
            ? t('aviso.sniraNascAtrasoDesc', { rotulo, n: Math.abs(prazo) })
            : t('aviso.sniraNascDesc', { rotulo, n: prazo }),
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
          titulo: t('aviso.partoConfirmarTitulo'),
          descricao: t('aviso.partoConfirmarDesc', {
            rotulo,
            dias: PartoPrevisaoCaducaDias,
          }),
        });
      } else if (dias <= 14) {
        out.push({
          id: `parto-${a.id}`,
          categoria: 'parto',
          animalId: a.id,
          exploracaoId: a.exploracaoId,
          data: a.dataPrevistaParto,
          gravidade: dias <= 3 ? 'aviso' : 'info',
          titulo: t('aviso.partoTitulo'),
          descricao:
            dias < 0
              ? t('aviso.partoAtrasoDesc', { rotulo, n: Math.abs(dias) })
              : t('aviso.partoDesc', { rotulo, n: dias }),
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
          titulo: t('aviso.segurancaTitulo'),
          descricao: t('aviso.segurancaDesc', { rotulo, n: dias }),
          diasRestantes: dias,
        });
      }
    }

    // Vacinação: revacinação anual (ou falta de registo em adultos).
    const idade = idadeDias(a.dataNascimento);
    const ultima = ultimaVacinacao.get(a.id);
    if (ultima !== undefined) {
      // Dias de CALENDÁRIO, como todos os outros prazos: a data da vacinação
      // fica ao meio-dia, e dividir a diferença por um dia tirava um dia até ao
      // meio-dia — a mesma manhã inteira que enganava a idade e a validade.
      const diasDesde = diasEntreDatas(new Date(ultima), new Date());
      const restam = PrazosSanitarios.revacinacao - diasDesde;
      if (restam <= PrazosSanitarios.avisoRevacinacaoDias) {
        out.push({
          id: `vac-${a.id}`,
          categoria: 'vacinacao',
          animalId: a.id,
          exploracaoId: a.exploracaoId,
          data: isoMaisDias(new Date(ultima).toISOString(), PrazosSanitarios.revacinacao),
          gravidade: restam <= 0 ? 'urgente' : 'info',
          titulo: t(restam <= 0 ? 'aviso.revacinarAtrasoTitulo' : 'aviso.revacinarTitulo'),
          descricao:
            restam <= 0
              ? t('aviso.revacinarAtrasoDesc', { rotulo, n: Math.abs(restam) })
              : t('aviso.revacinarDesc', { rotulo, n: restam, desde: diasDesde }),
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
        titulo: t('aviso.semVacinacaoTitulo'),
        descricao: t('aviso.semVacinacaoDesc', { rotulo }),
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
  /**
   * O que se comunica, em minúsculas e na língua da app.
   *
   * NÃO usa o `rotuloComunicacao`: essa tabela alimenta também a exportação
   * para o iDigital, que é um formulário do Estado português e tem de continuar
   * a dizer "Movimentação" seja qual for a língua em que o criador leia a app.
   */
  const oQueSeComunica: Record<TipoComunicacao, ChaveTexto> = {
    nascimento: 'snira.nascimento',
    morte: 'snira.morte',
    saida: 'snira.saida',
    entrada: 'snira.entrada',
    movimentacao: 'snira.movimentacao',
  };

  return comunicacoesPendentes(animais, eventos)
    .filter((p) => p.tipo !== 'nascimento')
    .map((p) => {
      const dias = p.diasRestantes;
      const oQue = t(oQueSeComunica[p.tipo]);
      return {
        id: `snira-ev-${p.eventoId}`,
        categoria: 'snira' as const,
        animalId: p.animalId,
        exploracaoId: p.exploracaoId,
        data: p.prazo,
        gravidade: dias < 0 ? ('urgente' as const) : dias <= 3 ? ('aviso' as const) : ('info' as const),
        titulo:
          dias < 0 ? t('aviso.sniraAtrasoTitulo') : t('aviso.sniraEvTitulo', { oQue }),
        descricao:
          dias < 0
            ? t('aviso.sniraEvAtrasoDesc', {
                rotulo: p.rotulo,
                oQue,
                data: diaIso(p.data),
                n: Math.abs(dias),
              })
            : t('aviso.sniraEvDesc', {
                rotulo: p.rotulo,
                oQue,
                data: diaIso(p.data),
                n: dias,
              }),
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
    const rotulo = animal.nome ?? animal.numeroIdentificacao ?? t('animais.semNome');
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
      titulo: t(duvidosa ? 'aviso.diagRepetirTitulo' : 'aviso.diagTitulo'),
      descricao: duvidosa
        ? t('aviso.diagRepetirDesc', { rotulo, n: dias })
        : t('aviso.diagDesc', { rotulo, n: dias }),
      diasRestantes: -dias,
    });
  }

  for (const { animal, estado } of semCobricaoAposParto(animais, eventos)) {
    const rotulo = animal.nome ?? animal.numeroIdentificacao ?? t('animais.semNome');
    const dias = estado.diasDesdeUltimoParto ?? 0;
    out.push({
      id: `cobr-${animal.id}`,
      categoria: 'reproducao',
      animalId: animal.id,
      exploracaoId: animal.exploracaoId,
      gravidade: dias >= PrazosReproducao.cobrirUrgenteApos ? 'urgente' : 'aviso',
      titulo: t('aviso.semCobricaoTitulo'),
      descricao: t('aviso.semCobricaoDesc', { rotulo, n: dias }),
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
    const nome = m.lote?.trim()
      ? t('aviso.comLote', { nome: m.nome, lote: m.lote.trim() })
      : m.nome;

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
          titulo: t('aviso.foraValidadeTitulo'),
          descricao: t('aviso.foraValidadeDesc', {
            nome,
            n: Math.abs(l.diasParaValidade ?? 0),
          }),
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
          titulo: t('aviso.validadeATerminarTitulo'),
          descricao: t('aviso.validadeATerminarDesc', { nome, n: l.diasParaValidade ?? 0 }),
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
          titulo: t('aviso.aAcabarTitulo'),
          descricao: t('aviso.aAcabarDesc', {
            nome,
            resta: l.resta,
            unidade: m.unidade,
            total: m.quantidade,
          }),
        },
      ];
    }

    return [];
  });
}
