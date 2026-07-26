/**
 * Em que ambiente é que esta build está a correr.
 * ------------------------------------------------------------------
 * Há duas bases de dados Supabase: a de PRODUÇÃO, com os registos reais de
 * quem usa a app, e a de DEV, onde se experimenta e se pode partir tudo. O que
 * decide qual delas a app usa são as variáveis EXPO_PUBLIC_SUPABASE_*, e essas
 * não se veem no ecrã: duas builds idênticas podem estar ligadas a bases
 * diferentes sem nada o denunciar.
 *
 * Daí esta variável existir. Não muda o comportamento da app — só permite
 * marcar o ecrã (ver `FaixaAmbiente.tsx`) para que ninguém registe um animal
 * de teste na exploração de um criador a sério, nem apague dados reais a
 * pensar que está a limpar a base de testes.
 *
 * Por omissão é 'producao': um ambiente que se esqueceu de se identificar tem
 * de ser tratado como o perigoso, nunca ao contrário. Ver `AMBIENTES.md`.
 */

/** 'dev' só quando EXPO_PUBLIC_AMBIENTE=dev; tudo o resto é produção. */
export const ambiente: 'dev' | 'producao' =
  process.env.EXPO_PUBLIC_AMBIENTE === 'dev' ? 'dev' : 'producao';

/** true na app de testes — usar para marcar o ecrã, não para mudar regras. */
export const ehDev = ambiente === 'dev';
