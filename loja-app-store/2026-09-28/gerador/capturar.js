// Fotografa ecrãs da app em modo demo com o Chrome sem janela, pelo protocolo
// de depuração (CDP). Simula um iPhone de 6,9": 430x932 pontos a 3x.
//
//   node capturar.js <ficheiro-de-ecras.json> <pasta-de-saida> [largura altura escala]
//
// Cada ecrã: { nome, url, esperar (ms), js (opcional, corre antes da foto) }.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , ficheiroEcras, pastaSaida, L = '430', A = '932', E = '3'] = process.argv;
const ecras = JSON.parse(fs.readFileSync(ficheiroEcras, 'utf8'));
fs.mkdirSync(pastaSaida, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORTA = 9333;
const perfil = path.join(__dirname, 'perfil-chrome');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORTA}`,
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--hide-scrollbars',
    '--lang=pt-PT',
    'about:blank',
  ]);
  try {
    let alvo;
    for (let i = 0; i < 50 && !alvo; i++) {
      await esperar(200);
      try {
        const lista = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json();
        alvo = lista.find((t) => t.type === 'page');
      } catch {}
    }
    if (!alvo) throw new Error('o Chrome não abriu');

    const ws = new WebSocket(alvo.webSocketDebuggerUrl);
    await new Promise((r, f) => { ws.onopen = r; ws.onerror = f; });
    let n = 0;
    const pendentes = new Map();
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pendentes.has(d.id)) {
        const { r, f } = pendentes.get(d.id);
        pendentes.delete(d.id);
        d.error ? f(new Error(JSON.stringify(d.error))) : r(d.result);
      }
    };
    const cdp = (method, params = {}) =>
      new Promise((r, f) => { const id = ++n; pendentes.set(id, { r, f }); ws.send(JSON.stringify({ id, method, params })); });

    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Emulation.setDeviceMetricsOverride', {
      width: Number(L), height: Number(A), deviceScaleFactor: Number(E), mobile: true,
    });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });

    for (const e of ecras) {
      await cdp('Page.navigate', { url: e.url });
      await esperar(e.esperar ?? 4000);
      if (e.js) {
        const r = await cdp('Runtime.evaluate', { expression: `(async () => { ${e.js} })()`, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) console.log(`  ${e.nome}: erro no js`, r.exceptionDetails.exception?.description);
        await esperar(e.depoisJs ?? 800);
      }
      const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(pastaSaida, `${e.nome}.png`), Buffer.from(data, 'base64'));
      const t = await cdp('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,160).replace(/\\s+/g," ")', returnByValue: true });
      console.log(`${e.nome}: ${t.result.value}`);
    }
    ws.close();
  } finally {
    chrome.kill();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
