// Gestao de Gado — Electron desktop wrapper.
// Serves the exported Expo web build (./web) from a local HTTP server on
// 127.0.0.1 and loads it in a native window. A local server (instead of
// file://) is required because the SPA references assets with absolute paths
// and uses client-side (history) routing.

const { app, BrowserWindow, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Em produção o build web é copiado como recurso (extraResources) para
// resources/web, para não passar pelo filtro de node_modules do asar
// (que descartava as fontes .ttf dos ícones). Em desenvolvimento fica ao lado.
const WEB_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'web')
  : path.join(__dirname, 'web');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain' });
  res.end(body);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.on('error', () => send(res, 500, 'Erro ao ler o ficheiro'));
}

// Porta FIXA (não 0/aleatória). O localStorage do Chromium é isolado por
// origem (esquema://host:porta); uma porta diferente a cada arranque criava
// uma "origem" nova e a sessão Supabase e a cache offline não persistiam entre
// aberturas. Com porta fixa a origem é sempre a mesma → tudo persiste. O lock
// de instância única (ver fundo do ficheiro) garante que não há conflito com a
// própria app.
const PORTA_FIXA = 41279;

function createServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      } catch (_) {
        urlPath = '/';
      }
      if (urlPath === '/') urlPath = '/index.html';

      // Resolve safely inside WEB_DIR (prevent path traversal).
      const resolved = path.normalize(path.join(WEB_DIR, urlPath));
      if (!resolved.startsWith(WEB_DIR)) return send(res, 403, 'Proibido');

      fs.stat(resolved, (err, stat) => {
        if (!err && stat.isFile()) return serveFile(res, resolved);
        // SPA fallback: unknown route without a file extension -> index.html
        if (!path.extname(urlPath)) {
          return serveFile(res, path.join(WEB_DIR, 'index.html'));
        }
        send(res, 404, 'Nao encontrado');
      });
    });
    // Se a porta fixa estiver ocupada por outra app (raro), cai para uma porta
    // livre só para a app abrir — nessa sessão a persistência não fica garantida.
    server.once('error', () => server.listen(0, '127.0.0.1', () => resolve(server)));
    server.listen(PORTA_FIXA, '127.0.0.1', () => resolve(server));
  });
}

let mainWindow;

async function createWindow() {
  const server = await createServer();
  const { port } = server.address();

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: '#F3F6F2',
    title: 'Gestao de Gado',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(WEB_DIR, 'favicon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  // Open external links (http/https) in the system browser, not new windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    server.close();
  });
}

// Minimal PT menu (mostly hidden; Ctrl+Q/refresh still handy).
Menu.setApplicationMenu(null);

// Instância única: com a porta fixa, uma 2.ª cópia da app colidiria na porta.
// Em vez disso, focamos a janela já aberta e não abrimos outra.
const temLock = app.requestSingleInstanceLock();
if (!temLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
