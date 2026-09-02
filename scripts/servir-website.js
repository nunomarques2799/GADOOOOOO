// Servidor estático para pré-visualizar a landing page (`website/`) sem
// publicar no Netlify. Reproduz os redirects do `netlify.toml` para que
// /privacidade e /termos funcionem como em produção.
//
//   node scripts/servir-website.js        → http://localhost:5055

const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', 'website');
const PORTA = Number(process.env.PORTA || 5055);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

http
  .createServer((req, res) => {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho === '/') caminho = '/index.html';
    if (!path.extname(caminho)) caminho += '.html';

    const ficheiro = path.join(RAIZ, path.normalize(caminho));
    // Serve o mesmo `404.html` que o Cloudflare serve em producao, e com o
    // mesmo codigo. Antes respondia uma linha de texto simples, o que fazia a
    // pagina de erro ser a unica do site que nao se conseguia ver aqui.
    if (!ficheiro.startsWith(RAIZ) || !fs.existsSync(ficheiro)) {
      const pagina404 = path.join(RAIZ, '404.html');
      const temPagina = fs.existsSync(pagina404);
      res.writeHead(404, {
        'Content-Type': temPagina ? TIPOS['.html'] : 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      if (temPagina) fs.createReadStream(pagina404).pipe(res);
      else res.end('Nao encontrado: ' + caminho);
      return;
    }

    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(ficheiro)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(ficheiro).pipe(res);
  })
  .listen(PORTA, () => console.log('Website em http://localhost:' + PORTA));
