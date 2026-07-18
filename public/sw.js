/**
 * Service worker — é o que torna a app instalável no PC e utilizável sem rede.
 * ------------------------------------------------------------------
 * Existe para o criador não ter de descarregar um .exe: com isto, o Edge/Chrome
 * oferece "Instalar", a app ganha ícone no ambiente de trabalho e abre em
 * janela própria — sem o aviso do Windows que assusta quem não é da
 * informática.
 *
 * NÃO corre dentro da app Electron (ver o registo em `src/app/+html.tsx`): lá o
 * conteúdo já vem do disco e uma cache por cima só ia servir versões velhas
 * depois de o electron-updater atualizar a app.
 *
 * Estratégia, em duas frases:
 * - Navegação (abrir a app): rede primeiro, com um limite de tempo curto, e
 *   cai para a última cópia guardada. Sem rede no monte, a app abre na mesma.
 * - Restantes ficheiros: devolve já o que está em cache e revalida em fundo.
 *   Os ficheiros do Expo têm o conteúdo no nome (`/_expo/...-<hash>.js`), por
 *   isso uma cópia guardada nunca fica errada — quando o build muda, muda o
 *   nome.
 *
 * O que NUNCA passa por aqui: tudo o que não seja deste domínio. Os pedidos ao
 * Supabase e os mosaicos do mapa seguem direto para a rede — quem trata dos
 * dados offline é a cache da app (`src/data/cacheLocal.ts`), que sabe resolver
 * conflitos. Uma segunda cache por cima dessa só criaria discordância entre as
 * duas.
 */

// Mudar esta versão descarta as caches antigas no próximo arranque.
const CACHE = 'gado-v1';

// O documento que a app serve em qualquer rota (é uma SPA: o Netlify responde
// com o index.html a tudo). É esta a cópia que abre a app quando não há rede.
const CASCA = '/';

const LIMITE_REDE_MS = 4000;

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Um a um e com falhas toleradas: com `addAll`, um único ficheiro em
      // falta abortava a instalação inteira e a app ficava sem funcionar
      // offline sem nada o indicar.
      await Promise.all(
        [CASCA, '/manifest.json', '/icons/icone-192.png', '/icons/icone-512.png'].map((caminho) =>
          cache.add(caminho).catch(() => undefined)
        )
      );
    })()
  );
  // Sem `skipWaiting` de propósito: uma versão nova fica à espera e é o banner
  // de atualização da app que a manda entrar, para não trocar o código por
  // baixo dos pés a alguém que esteja a meio de registar um animal.
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome)));
      await self.clients.claim();
    })()
  );
});

// O banner de atualização (`useAtualizacao`) manda esta mensagem quando o
// criador carrega em "Atualizar agora".
self.addEventListener('message', (evento) => {
  if (evento.data === 'instalar-atualizacao') void self.skipWaiting();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Supabase, mapas: direto à rede

  if (pedido.mode === 'navigate') {
    evento.respondWith(responderNavegacao(pedido));
    return;
  }
  evento.respondWith(responderRecurso(pedido));
});

/** Abrir a app: rede primeiro (para apanhar versões novas), cache como rede de segurança. */
async function responderNavegacao(pedido) {
  const cache = await caches.open(CACHE);
  try {
    const resposta = await comLimiteDeTempo(fetch(pedido), LIMITE_REDE_MS);
    if (resposta && resposta.ok) await cache.put(CASCA, resposta.clone());
    return resposta;
  } catch {
    const guardada = await cache.match(CASCA);
    if (guardada) return guardada;
    return new Response('Sem ligação e sem cópia guardada desta app.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Ficheiros da app: responde do disco e vai buscar a versão nova em fundo. */
async function responderRecurso(pedido) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(pedido);

  const daRede = fetch(pedido)
    .then((resposta) => {
      // `basic` = mesma origem e resposta completa. Guardar respostas parciais
      // (206) ou opacas dava ficheiros truncados na visita seguinte.
      if (resposta && resposta.ok && resposta.type === 'basic') {
        void cache.put(pedido, resposta.clone());
      }
      return resposta;
    })
    .catch(() => undefined);

  if (guardada) {
    void daRede; // revalida em fundo, sem atrasar a resposta
    return guardada;
  }
  const resposta = await daRede;
  if (resposta) return resposta;
  return new Response('', { status: 504 });
}

/**
 * Uma rede fraca é pior do que rede nenhuma: sem isto, um pedido que nunca
 * responde deixava a app em branco no arranque em vez de abrir a cópia local.
 */
function comLimiteDeTempo(promessa, ms) {
  return new Promise((resolver, rejeitar) => {
    const temporizador = setTimeout(() => rejeitar(new Error('tempo esgotado')), ms);
    promessa.then(
      (valor) => {
        clearTimeout(temporizador);
        resolver(valor);
      },
      (erro) => {
        clearTimeout(temporizador);
        rejeitar(erro);
      }
    );
  });
}
