import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, Header, Icon, type IconName, Text } from '@/components/ui';
import { avisar } from '@/data/avisos';
import { especieMeta } from '@/data/constants';
import {
  formatDataPt,
  isoDaysAgo,
  isoMaisDias,
  mascaraDataPt,
  paraEuro,
  parseDataPt,
} from '@/data/helpers';
import { normalizar } from '@/data/racas';
import { useGado } from '@/data/store';
import { useFinancas } from '@/data/useFinancas';
import type { EventoTipo, Sexo } from '@/data/types';
import { colors, radii, shadow, sizes, spacing } from '@/theme';

/* ------------------------------------------------------------------ *
 *  Tipos de evento cobertos por este formulário
 * ------------------------------------------------------------------ */

const REGISTAVEIS = ['Parto', 'Vacinação', 'Medicamento', 'Pesagem'] as const;
type Registavel = (typeof REGISTAVEIS)[number];

/**
 * O que se pode registar a vários animais de uma vez.
 *
 * Vacinar e medicar fazem-se a um lote inteiro no mesmo dia, com a mesma
 * vacina e o mesmo lote — obrigar a repetir o formulário trinta vezes é o
 * caminho mais curto para se deixar de registar de todo.
 *
 * Parto e pesagem ficam de fora porque o que se regista é diferente em cada
 * animal: um peso igual para trinta vacas não é um registo, é ruído que ainda
 * por cima estraga o cálculo do ganho médio diário.
 */
const EM_MASSA: Registavel[] = ['Vacinação', 'Medicamento'];

const META: Record<Registavel, { icon: IconName; cor: string; titulo: string }> = {
  Parto: { icon: 'baby-bottle-outline', cor: colors.info, titulo: 'Registar parto' },
  Vacinação: {
    icon: 'needle',
    // Getter porque segue a paleta escolhida: esta tabela é criada no arranque
    // do módulo, antes de a paleta guardada estar aplicada.
    get cor() {
      return colors.primary;
    },
    titulo: 'Registar vacina',
  },
  Medicamento: { icon: 'medical-bag', cor: colors.danger, titulo: 'Registar medicamento' },
  Pesagem: { icon: 'scale', cor: colors.warning, titulo: 'Registar pesagem' },
};

const opcoesData = [
  { label: 'Hoje', dias: 0 },
  { label: 'Ontem', dias: 1 },
  { label: 'Há 2 dias', dias: 2 },
  { label: 'Há 1 semana', dias: 7 },
];

const VACINAS_COMUNS = ['Língua azul', 'Brucelose', 'Clostridioses', 'Carbúnculo'];
const VIAS = ['Injetável', 'Oral', 'Tópica', 'Intramamária'];
const PROXIMA_DOSE = ['3 meses', '6 meses', '12 meses'];
const SEGURANCA_DIAS = [0, 7, 10, 14, 28];

/** Converte "20,5" ou "20.5" num número; NaN se inválido. */
function paraNumero(txt: string): number {
  return parseFloat(txt.replace(',', '.'));
}

export default function NovoEventoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { animais, especieDe, addEvento, updateAnimal, animalById, eventosByAnimal } = useGadoAdaptado();

  const params = useLocalSearchParams<{ tipo?: string; animalId?: string }>();
  const tipoInicial: Registavel = (REGISTAVEIS as readonly string[]).includes(params.tipo ?? '')
    ? (params.tipo as Registavel)
    : 'Pesagem';

  const [tipo, setTipo] = useState<Registavel>(tipoInicial);
  const [animalIds, setAnimalIds] = useState<string[]>(params.animalId ? [params.animalId] : []);
  const [procura, setProcura] = useState('');
  const [diasAtras, setDiasAtras] = useState(0);
  // Data escrita à mão. Os atalhos cobrem o registo do próprio dia, que é o
  // caso comum; isto cobre o resto — a vacina que se deu no mês passado e só
  // agora se está a lançar, ou o parto que aconteceu enquanto não havia rede.
  const [dataManual, setDataManual] = useState('');

  // Parto
  const [tipoParto, setTipoParto] = useState<'Normal' | 'Distócico' | 'Cesariana'>('Normal');
  const [nCrias, setNCrias] = useState(1);
  const [criaViva, setCriaViva] = useState(true);
  const [sexoCria, setSexoCria] = useState<Sexo | undefined>(undefined);

  // Vacinação
  const [vacina, setVacina] = useState('');
  const [lote, setLote] = useState('');
  const [proximaDose, setProximaDose] = useState<string | undefined>(undefined);
  const [vetVacina, setVetVacina] = useState('');

  // Medicamento
  const [medicamento, setMedicamento] = useState('');
  const [dose, setDose] = useState('');
  const [via, setVia] = useState<string | undefined>(undefined);
  const [motivo, setMotivo] = useState('');
  const [seguranca, setSeguranca] = useState(0);
  const [vetMed, setVetMed] = useState('');

  // Pesagem
  const [peso, setPeso] = useState('');

  // Custo (€) — vacinação e medicamento
  const [custo, setCusto] = useState('');

  // Comum
  const [notas, setNotas] = useState('');
  const [aGuardar, setAGuardar] = useState(false);

  // Uma data escrita à mão manda sobre os atalhos. `parseDataPt` recusa datas
  // futuras, que é o que se quer: um evento regista o que JÁ aconteceu.
  const dataManualIso = dataManual.trim() ? parseDataPt(dataManual) : null;
  const dataManualInvalida = dataManual.trim().length > 0 && !dataManualIso;
  const data = dataManualIso ?? isoDaysAgo(diasAtras);
  const varios = EM_MASSA.includes(tipo);
  // Um só animal escolhido é o caso normal — é o que dá o cartão com o nome e
  // o brinco, e o que permite calcular o ganho médio diário.
  const animal = animalIds.length === 1 ? animalById(animalIds[0]) : undefined;
  const { podeRegistarCustoTratamento: podeRegistarCusto } = useFinancas(
    (animal ?? (animalIds[0] ? animalById(animalIds[0]) : undefined))?.exploracaoId,
  );

  // Lista para escolher o animal (só fêmeas quando é um parto).
  const animaisEscolha = useMemo(() => {
    const lista = tipo === 'Parto' ? animais.filter((a) => a.sexo === 'Fêmea') : animais;
    return [...lista].sort((a, b) =>
      (a.nome ?? a.numeroIdentificacao ?? '').localeCompare(b.nome ?? b.numeroIdentificacao ?? ''),
    );
  }, [animais, tipo]);

  /** O que a pesquisa deixa à vista — é sobre isto que age o "escolher todos". */
  const aVista = useMemo(() => {
    const q = normalizar(procura.trim());
    if (!q) return animaisEscolha;
    return animaisEscolha.filter((a) =>
      [a.nome, a.numeroIdentificacao, a.raca, a.casa].some(
        (c) => c && normalizar(c).includes(q),
      ),
    );
  }, [animaisEscolha, procura]);

  /**
   * Trocar para um tipo que não é de massa com vinte animais escolhidos não
   * pode gravar vinte partos. Fica o primeiro, que é o que o criador vê no
   * cartão — em vez de a app apagar a escolha toda sem dizer nada.
   */
  function mudarTipo(t: Registavel) {
    setTipo(t);
    if (!EM_MASSA.includes(t)) setAnimalIds((ids) => ids.slice(0, 1));
  }

  function alternarAnimal(id: string) {
    setAnimalIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      return varios ? [...ids, id] : [id];
    });
  }

  /** Escolhidos que a procura atual não mostra — senão gravava-se às cegas. */
  const escondidos = animalIds.filter((id) => !aVista.some((a) => a.id === id)).length;

  const pesoNum = paraNumero(peso);
  const valido =
    animalIds.length > 0 &&
    !dataManualInvalida &&
    (tipo === 'Parto' ||
      (tipo === 'Vacinação' && vacina.trim().length > 0) ||
      (tipo === 'Medicamento' && medicamento.trim().length > 0) ||
      (tipo === 'Pesagem' && Number.isFinite(pesoNum) && pesoNum > 0));

  /** Ganho médio diário desde a última pesagem registada, se existir. */
  function calcularGmd(kg: number): string | undefined {
    const animalId = animalIds[0];
    if (!animalId) return undefined;
    const ultima = eventosByAnimal(animalId).find((e) => e.tipo === 'Pesagem');
    if (!ultima) return undefined;
    const m = ultima.descricao.match(/([\d.,]+)\s*kg/i);
    if (!m) return undefined;
    const kgAnt = paraNumero(m[1]);
    if (!Number.isFinite(kgAnt)) return undefined;
    const dias = (new Date(data).getTime() - new Date(ultima.data).getTime()) / 86_400_000;
    if (dias < 1) return undefined;
    const gmd = (kg - kgAnt) / dias;
    return `GMD ${gmd.toFixed(2).replace('.', ',')} kg/dia`;
  }

  async function guardar() {
    if (animalIds.length === 0 || !valido || aGuardar) return;

    let descricao = '';
    const partes: string[] = [];

    if (tipo === 'Parto') {
      const rotulo =
        tipoParto === 'Normal' ? 'normal' : tipoParto === 'Distócico' ? 'distócico' : 'por cesariana';
      descricao = `Parto ${rotulo} — ${nCrias} ${nCrias === 1 ? 'cria' : 'crias'}`;
      if (nCrias === 1 && sexoCria) partes.push(`cria ${sexoCria === 'Fêmea' ? 'fêmea' : 'macho'}`);
      partes.push(criaViva ? 'nado-vivo' : 'nado-morto');
    } else if (tipo === 'Vacinação') {
      descricao = `Vacina — ${vacina.trim()}`;
      if (lote.trim()) partes.push(`Lote ${lote.trim()}`);
      if (proximaDose) partes.push(`próxima em ${proximaDose}`);
      if (vetVacina.trim()) partes.push(`Vet. ${vetVacina.trim()}`);
    } else if (tipo === 'Medicamento') {
      descricao = `Medicamento — ${medicamento.trim()}`;
      if (dose.trim()) partes.push(`Dose ${dose.trim()}`);
      if (via) partes.push(via);
      if (motivo.trim()) partes.push(motivo.trim());
      if (vetMed.trim()) partes.push(`Vet. ${vetMed.trim()}`);
      if (seguranca > 0) partes.push(`segurança ${seguranca} dias`);
    } else {
      descricao = `Pesagem: ${peso.trim().replace('.', ',')} kg`;
      const gmd = calcularGmd(pesoNum);
      if (gmd) partes.push(gmd);
    }

    if (notas.trim()) partes.push(notas.trim());
    const detalhe = partes.join(' · ') || undefined;

    // Custo (€) — só faz sentido em vacinação/medicamento, e só se a gestão
    // económica estiver ligada (o servidor limpa-o na mesma, por trigger).
    let valor: number | undefined;
    if (podeRegistarCusto && (tipo === 'Vacinação' || tipo === 'Medicamento')) {
      const n = paraEuro(custo);
      if (Number.isFinite(n) && n > 0) valor = n;
    }

    // Esperar pela gravação antes de sair do ecrã. Sem o `await` e sem o
    // `catch`, uma recusa do servidor (RLS, conflito de versão) ficava numa
    // promessa sem dono: a app navegava para a ficha do animal como se tivesse
    // gravado, e o registo sanitário — uma vacina, um medicamento com intervalo
    // de segurança — desaparecia sem ninguém saber. Offline não muda nada: aí a
    // escrita entra na fila e isto devolve logo sem erro.
    setAGuardar(true);

    // Um a um, e não em paralelo: são escritas com fila de sincronização por
    // trás, e trinta pedidos ao mesmo tempo numa rede de campo dão trinta
    // hipóteses de falhar em vez de uma. Os que passam ficam gravados — um
    // erro a meio não desfaz o que já foi feito.
    const falhados: { nome: string; erro: string }[] = [];
    let gravados = 0;

    for (const id of animalIds) {
      try {
        await addEvento({ animalId: id, tipo, data, descricao, detalhe, valor });

        // Efeitos secundários no animal.
        // O intervalo de segurança conta a partir do dia do TRATAMENTO, não de
        // hoje. Enquanto a data só podia recuar uma semana o erro passava
        // despercebido; com a data exata, lançar hoje um medicamento dado há
        // três meses prendia o animal por mais 14 dias sem razão nenhuma — e o
        // erro simétrico, num tratamento antigo de intervalo curto, dava por
        // vencido um prazo que ainda corria.
        if (tipo === 'Medicamento' && seguranca > 0) {
          await updateAnimal(id, { fimIntervaloSeguranca: isoMaisDias(data, seguranca) });
        }
        if (tipo === 'Parto' && animalById(id)?.dataPrevistaParto) {
          await updateAnimal(id, { dataPrevistaParto: undefined });
        }
        gravados++;
      } catch (e) {
        const a = animalById(id);
        falhados.push({
          nome: a?.nome ?? a?.numeroIdentificacao ?? 'Sem nome',
          erro: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (gravados === 0) {
      avisar('Não foi possível guardar', falhados[0]?.erro ?? 'Tente novamente.');
      setAGuardar(false);
      return;
    }

    if (falhados.length > 0) {
      // Nomear quem ficou de fora é o que permite repetir só esses. Um
      // "gravado com erros" sem dizer quais obrigava a conferir trinta fichas.
      avisar(
        'Guardado, com falhas',
        `Ficou registado em ${gravados} ${gravados === 1 ? 'animal' : 'animais'}. ` +
          `Não foi possível em: ${falhados.map((f) => f.nome).join(', ')}.`,
      );
    }

    if (animalIds.length === 1) {
      router.replace(`/animal/${animalIds[0]}`);
      return;
    }

    if (falhados.length === 0) {
      avisar(
        'Registo guardado',
        `${descricao} em ${gravados} animais, a ${formatDataPt(data)}.`,
      );
    }
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={META[tipo].titulo} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.huge * 2 }}>
        {/* Tipo de evento */}
        <Field label="Tipo de registo" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {REGISTAVEIS.map((t) => (
              <TipoButton
                key={t}
                label={t}
                icon={META[t].icon}
                cor={META[t].cor}
                selected={tipo === t}
                onPress={() => mudarTipo(t)}
              />
            ))}
          </View>
        </Field>

        {/* Animal(is) */}
        <Field
          label={
            tipo === 'Parto'
              ? 'Mãe (fêmea)'
              : varios
                ? `Animais${animalIds.length > 0 ? ` (${animalIds.length} escolhidos)` : ''}`
                : 'Animal'
          }
          obrigatorio>
          {/* Um só animal escolhido, num tipo individual: o cartão com o nome
              e o brinco confirma em quem se está a registar. */}
          {!varios && animal ? (
            <AnimalSelecionado
              icone={especieDe(animal.especie)}
              nome={animal.nome ?? 'Sem nome'}
              brinco={animal.numeroIdentificacao ?? 'Sem brinco'}
              onTrocar={() => setAnimalIds([])}
            />
          ) : (
            <>
              {/* Com efetivo grande, percorrer cem chips à procura de um animal
                  é pior do que escrever três letras do nome. */}
              {animaisEscolha.length > 8 ? (
                <View style={{ marginBottom: spacing.xs }}>
                  <TextField
                    value={procura}
                    onChangeText={setProcura}
                    placeholder="Procurar por nome, brinco, raça ou casa"
                    icon="magnify"
                  />
                </View>
              ) : null}

              {varios && aVista.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs }}>
                  {/* Age sobre o que a pesquisa deixou à vista, não sobre o
                      efetivo todo: é assim que se vacina "os Mertolengos"
                      sem os escolher um a um. */}
                  <Button
                    label={
                      procura.trim()
                        ? `Escolher os ${aVista.length} à vista`
                        : `Escolher todos (${aVista.length})`
                    }
                    icon="checkbox-multiple-marked-outline"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() =>
                      setAnimalIds((ids) => [
                        ...new Set([...ids, ...aVista.map((a) => a.id)]),
                      ])
                    }
                  />
                  {animalIds.length > 0 ? (
                    <Button
                      label="Limpar"
                      icon="close"
                      variant="ghost"
                      fullWidth={false}
                      onPress={() => setAnimalIds([])}
                    />
                  ) : null}
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {aVista.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.nome ?? a.numeroIdentificacao ?? 'Sem nome'}
                    icon={animalIds.includes(a.id) ? 'check' : especieDe(a.especie)}
                    selected={animalIds.includes(a.id)}
                    onPress={() => alternarAnimal(a.id)}
                  />
                ))}
                {animaisEscolha.length === 0 ? (
                  <Text variant="secondary" color={colors.textMuted}>
                    {tipo === 'Parto'
                      ? 'Não há fêmeas registadas para associar a um parto.'
                      : 'Ainda não há animais registados.'}
                  </Text>
                ) : aVista.length === 0 ? (
                  <Text variant="secondary" color={colors.textMuted}>
                    Nenhum animal corresponde a “{procura.trim()}”.
                  </Text>
                ) : null}
              </View>

              {/* Os que estão escolhidos mas a pesquisa escondeu continuam
                  escolhidos — sem este aviso, gravava-se em animais que já não
                  estavam à vista sem se perceber porquê. */}
              {varios && escondidos > 0 ? (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  Mais {escondidos} {escondidos === 1 ? 'animal escolhido' : 'animais escolhidos'}{' '}
                  fora desta procura.
                </Text>
              ) : null}
            </>
          )}
        </Field>

        {/* Data */}
        <Field label="Data" obrigatorio>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {opcoesData.map((o) => (
              <Chip
                key={o.dias}
                label={o.label}
                // Com uma data escrita à mão, nenhum atalho está escolhido —
                // senão o ecrã mostrava "Hoje" aceso por baixo de outra data.
                selected={!dataManualIso && diasAtras === o.dias}
                onPress={() => {
                  setDiasAtras(o.dias);
                  setDataManual('');
                }}
              />
            ))}
          </View>

          <Text
            variant="caption"
            color={colors.textMuted}
            style={{ marginTop: spacing.sm, marginBottom: 4 }}>
            Ou data exata (dd/mm/aaaa) — para registar o que já aconteceu
          </Text>
          <TextField
            value={dataManual}
            onChangeText={(t) => setDataManual(mascaraDataPt(t))}
            placeholder="Ex: 15/03/2026"
            icon="calendar-edit"
            keyboardType="number-pad"
          />
          {dataManualInvalida ? (
            <Text variant="caption" color={colors.danger} style={{ marginTop: 4 }}>
              Data inválida. Use o formato dd/mm/aaaa e uma data não futura.
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm }}>
            <Icon name="calendar-check" size="sm" color={colors.primary} />
            <Text variant="secondary" color={colors.textSecondary}>
              {formatDataPt(data)}
            </Text>
          </View>
        </Field>

        {/* ---- Campos específicos ---- */}
        {tipo === 'Parto' ? (
          <>
            <Field label="Tipo de parto" obrigatorio>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {(['Normal', 'Distócico', 'Cesariana'] as const).map((t) => (
                  <Chip key={t} label={t} selected={tipoParto === t} onPress={() => setTipoParto(t)} />
                ))}
              </View>
            </Field>
            <Field label="Número de crias" obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[1, 2, 3].map((n) => (
                  <BigToggle
                    key={n}
                    label={String(n)}
                    selected={nCrias === n}
                    onPress={() => {
                      setNCrias(n);
                      if (n > 1) setSexoCria(undefined);
                    }}
                  />
                ))}
              </View>
            </Field>
            <Field label="Resultado" obrigatorio>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <BigToggle label="Nado-vivo" icon="heart-pulse" selected={criaViva} onPress={() => setCriaViva(true)} />
                <BigToggle label="Nado-morto" icon="heart-broken" selected={!criaViva} onPress={() => setCriaViva(false)} />
              </View>
            </Field>
            {nCrias === 1 && criaViva ? (
              <Field label="Sexo da cria" opcional>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <BigToggle label="Fêmea" icon="gender-female" selected={sexoCria === 'Fêmea'} onPress={() => setSexoCria('Fêmea')} />
                  <BigToggle label="Macho" icon="gender-male" selected={sexoCria === 'Macho'} onPress={() => setSexoCria('Macho')} />
                </View>
              </Field>
            ) : null}
            <Aviso texto="Depois do parto, lembre-se de identificar a cria (brinco) até aos 20 dias e comunicar o nascimento ao SNIRA." />
          </>
        ) : null}

        {tipo === 'Vacinação' ? (
          <>
            <Field label="Vacina / doença" obrigatorio>
              <TextField value={vacina} onChangeText={setVacina} placeholder="Ex: Língua azul" icon="needle" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {VACINAS_COMUNS.map((v) => (
                  <Chip key={v} label={v} selected={vacina === v} onPress={() => setVacina(v)} />
                ))}
              </View>
            </Field>
            <Field label="Lote" opcional>
              <TextField value={lote} onChangeText={setLote} placeholder="Ex: 4471" icon="flask-outline" autoCapitalize="characters" />
            </Field>
            <Field label="Próxima dose" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {PROXIMA_DOSE.map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    selected={proximaDose === p}
                    onPress={() => setProximaDose(proximaDose === p ? undefined : p)}
                  />
                ))}
              </View>
            </Field>
            <Field label="Veterinário" opcional>
              <TextField value={vetVacina} onChangeText={setVetVacina} placeholder="Ex: Dr. Sousa" icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Medicamento' ? (
          <>
            <Field label="Medicamento" obrigatorio>
              <TextField value={medicamento} onChangeText={setMedicamento} placeholder="Ex: Antibiótico" icon="medical-bag" />
            </Field>
            <Field label="Dose" opcional>
              <TextField value={dose} onChangeText={setDose} placeholder="Ex: 20 ml" icon="cup-water" />
            </Field>
            <Field label="Via de administração" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {VIAS.map((v) => (
                  <Chip key={v} label={v} selected={via === v} onPress={() => setVia(via === v ? undefined : v)} />
                ))}
              </View>
            </Field>
            <Field label="Motivo" opcional>
              <TextField value={motivo} onChangeText={setMotivo} placeholder="Ex: Mastite" icon="clipboard-text-outline" />
            </Field>
            <Field label="Intervalo de segurança (dias)" opcional>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {SEGURANCA_DIAS.map((d) => (
                  <Chip
                    key={d}
                    label={d === 0 ? 'Nenhum' : `${d} dias`}
                    selected={seguranca === d}
                    onPress={() => setSeguranca(d)}
                  />
                ))}
              </View>
              {seguranca > 0 ? (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                  Não vender para abate até {formatDataPt(isoMaisDias(data, seguranca))}.
                </Text>
              ) : null}
            </Field>
            <Field label="Veterinário" opcional>
              <TextField value={vetMed} onChangeText={setVetMed} placeholder="Ex: Dr. Sousa" icon="stethoscope" autoCapitalize="words" />
            </Field>
          </>
        ) : null}

        {tipo === 'Pesagem' ? (
          <Field label="Peso (kg)" obrigatorio>
            <TextField value={peso} onChangeText={setPeso} placeholder="Ex: 520" icon="weight-kilogram" keyboardType="decimal-pad" />
          </Field>
        ) : null}

        {/* Custo — vacinação e medicamento (entra na gestão económica). Some
            com a gestão financeira desligada: o registo sanitário é o mesmo,
            só não se pede o dinheiro. É também a única coisa financeira que o
            veterinário preenche. */}
        {podeRegistarCusto && (tipo === 'Vacinação' || tipo === 'Medicamento') ? (
          <Field label={animalIds.length > 1 ? 'Custo por animal (€)' : 'Custo (€)'} opcional>
            <TextField value={custo} onChangeText={setCusto} placeholder="Ex: 45" icon="cash" keyboardType="decimal-pad" />
            {/* O valor é gravado em CADA animal. Mostrar a conta feita evita o
                engano de escrever aqui o total da fatura e ficar com trinta
                vezes esse total lançado na exploração. */}
            {animalIds.length > 1 && Number.isFinite(paraEuro(custo)) && paraEuro(custo) > 0 ? (
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                {animalIds.length} animais × {paraEuro(custo).toFixed(2).replace('.', ',')} € ={' '}
                {(paraEuro(custo) * animalIds.length).toFixed(2).replace('.', ',')} € no total.
              </Text>
            ) : null}
          </Field>
        ) : null}

        {/* Notas — comum a todos */}
        <Field label="Notas" opcional>
          <TextField value={notas} onChangeText={setNotas} placeholder="Observações (opcional)" icon="note-text-outline" multiline />
        </Field>
      </ScrollView>

      {/* Barra de gravar fixa */}
      <View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
          shadow.lg,
        ]}>
        <Button
          label={
            aGuardar
              ? 'A guardar…'
              : animalIds.length > 1
                ? `Guardar em ${animalIds.length} animais`
                : 'Guardar registo'
          }
          icon="check"
          onPress={guardar}
          disabled={!valido || aGuardar}
        />
      </View>
    </View>
  );
}

/**
 * Pequeno adaptador sobre useGado: expõe um seletor de ícone por espécie
 * para não repetir o mapa especieMeta em vários pontos do ecrã.
 */
function useGadoAdaptado() {
  const gado = useGado();
  return {
    ...gado,
    especieDe: (especie: keyof typeof especieMeta): IconName => especieMeta[especie].icon,
  };
}

/* ------------------------------------------------------------------ *
 *  Componentes locais de formulário (partilham o estilo de animal/novo)
 * ------------------------------------------------------------------ */

function Field({
  label,
  obrigatorio,
  opcional,
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs }}>
        <Text variant="label">{label}</Text>
        {obrigatorio ? (
          <Text variant="label" color={colors.danger}>
            *
          </Text>
        ) : null}
        {opcional ? (
          <Text variant="caption" color={colors.textMuted}>
            opcional
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function TextField({
  value,
  onChangeText,
  placeholder,
  icon,
  autoCapitalize,
  keyboardType,
  multiline,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  icon: IconName;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        gap: spacing.xs,
        minHeight: sizes.input,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: multiline ? spacing.sm : 0,
      }}>
      <Icon name={icon} size="md" color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          flex: 1,
          fontFamily: 'Nunito_600SemiBold',
          fontSize: 17,
          color: colors.text,
          paddingTop: multiline ? 4 : 0,
          minHeight: multiline ? 48 : undefined,
        }}
      />
    </View>
  );
}

/** Cartão grande de escolha do tipo de evento (ícone + rótulo). */
function TipoButton({
  label,
  icon,
  cor,
  selected,
  onPress,
}: {
  label: string;
  icon: IconName;
  cor: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flexGrow: 1,
          flexBasis: '46%',
          minHeight: 64,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? cor : colors.border,
          backgroundColor: selected ? cor : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
          paddingHorizontal: spacing.sm,
        },
        pressed && { opacity: 0.85 },
      ]}>
      <Icon name={icon} size="md" color={selected ? colors.onPrimary : cor} />
      <Text variant="button" color={selected ? colors.onPrimary : colors.textSecondary} style={{ fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Resumo do animal escolhido, com opção de trocar. */
function AnimalSelecionado({
  icone,
  nome,
  brinco,
  onTrocar,
}: {
  icone: IconName;
  nome: string;
  brinco: string;
  onTrocar: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: radii.md,
        borderWidth: 1.5,
        borderColor: colors.primary,
        backgroundColor: colors.primaryTint,
        padding: spacing.sm,
      }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={icone} size="md" color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{nome}</Text>
        <Text variant="secondary" color={colors.textSecondary}>
          {brinco}
        </Text>
      </View>
      <Pressable onPress={onTrocar} accessibilityRole="button" accessibilityLabel="Trocar animal" hitSlop={8}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: spacing.sm,
            paddingVertical: 6,
            borderRadius: radii.pill,
            backgroundColor: colors.surface,
          }}>
          <Icon name="swap-horizontal" size="sm" color={colors.primaryDark} />
          <Text variant="label" color={colors.primaryDark}>
            Trocar
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function BigToggle({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        {
          flex: 1,
          height: sizes.button,
          borderRadius: radii.md,
          borderWidth: 1.5,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryTint : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xs,
        },
        pressed && { opacity: 0.85 },
      ]}>
      {icon ? <Icon name={icon} size="md" color={selected ? colors.primary : colors.textMuted} /> : null}
      <Text variant="button" color={selected ? colors.primaryDark : colors.textSecondary} style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Nota informativa (contexto legal / boas práticas). */
function Aviso({ texto }: { texto: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        alignItems: 'flex-start',
        backgroundColor: colors.infoTint,
        borderRadius: radii.md,
        padding: spacing.sm,
        marginBottom: spacing.lg,
      }}>
      <Icon name="information" size="md" color={colors.info} />
      <Text variant="secondary" color={colors.textSecondary} style={{ flex: 1 }}>
        {texto}
      </Text>
    </View>
  );
}
