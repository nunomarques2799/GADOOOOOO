// Gera uma página HTML por imagem da loja (1290x2796, o 6,9" da Apple) e o
// ficheiro de ecrãs para o capturar.js as fotografar a escala 1.
const fs = require('fs');
const path = require('path');

const aqui = __dirname;
const saidaHtml = path.join(aqui, 'slides');
fs.mkdirSync(saidaHtml, { recursive: true });

// label: etiqueta mono por cima; ambar: é sobre prazos (o único acento do site)
const slides = [
  { ecra: '1-inicio', label: 'Início', ambar: true,
    titulo: 'A sua exploração <em>num relance</em>',
    sub: 'O calendário e tudo o que precisa da sua atenção, logo à entrada.' },
  { ecra: '2-snira', label: 'Prazos do SNIRA', ambar: true,
    titulo: 'Nenhum prazo do SNIRA <em>fica esquecido</em>',
    sub: 'A app conta os dias e mostra o que falta comunicar.' },
  { ecra: '3-animais', label: 'Efetivo',
    titulo: 'Todo o efetivo <em>no bolso</em>',
    sub: 'Procure por nome, brinco ou raça. Funciona mesmo sem rede.' },
  { ecra: '4-animal', label: 'Ficha do animal',
    titulo: 'Cada animal com a <em>sua ficha</em>',
    sub: 'Brinco, nascimento, raça, mãe e pai, tudo no mesmo sítio.' },
  { ecra: '5-reproducao', label: 'Reprodução',
    titulo: 'Saiba quem está <em>prestes a parir</em>',
    sub: 'Gestantes, cobertas e vazias, contadas pela app.' },
  { ecra: '6-terreno', label: 'Terrenos',
    titulo: 'Os seus terrenos <em>no mapa</em>',
    sub: 'A área, os animais que lá estão e o caminho até lá.' },
];

const bateria = `<svg width="84" height="40" viewBox="0 0 28 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2z" fill="currentColor" fill-opacity=".45"/></svg>`;
const rede = `<svg width="54" height="36" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="6" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>`;
const wifi = `<svg width="50" height="36" viewBox="0 0 17 12"><path d="M8.5 2.3c2.4 0 4.6.9 6.2 2.5l1.2-1.2C14 1.7 11.4.6 8.5.6S3 1.7 1.1 3.6l1.2 1.2C3.9 3.2 6.1 2.3 8.5 2.3zm0 3.4c1.5 0 2.8.6 3.8 1.5L13.5 6c-1.3-1.2-3.1-2-5-2s-3.7.8-5 2l1.2 1.2c1-.9 2.3-1.5 3.8-1.5zm0 3.4c.6 0 1.1.2 1.5.6L8.5 11.2 7 9.7c.4-.4.9-.6 1.5-.6z" fill="currentColor"/></svg>`;

function pagina(s) {
  const img = fs.readFileSync(path.join(aqui, 'ecras', `${s.ecra}.png`)).toString('base64');
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=IBM+Plex+Mono:wght@500;600&family=Nunito:wght@500;600;700&display=block" rel="stylesheet">
<style>
  :root { --papel:#eeeee8; --tinta:#14201a; --tinta-2:#4c584f; --musgo:#3d5a45; --ambar:#8a5713; --linha:#dcddd3; }
  * { margin:0; box-sizing:border-box; }
  html, body { width:1290px; height:2796px; overflow:hidden; background:var(--papel); }
  body { font-family:Nunito, sans-serif; color:var(--tinta); position:relative; }
  /* Grelha de caderno de registo, muito leve, como no site. */
  body::before { content:""; position:absolute; inset:0;
    background-image:linear-gradient(var(--linha) 1px, transparent 1px);
    background-size:100% 64px; opacity:.45; }
  .texto { position:absolute; left:110px; right:110px; top:150px; }
  .rotulo { font-family:"IBM Plex Mono", monospace; font-weight:600; font-size:34px;
    letter-spacing:.14em; text-transform:uppercase; color:var(--musgo);
    display:flex; align-items:center; gap:18px; }
  .rotulo::before { content:""; width:56px; height:4px; background:currentColor; }
  .ambar .rotulo { color:var(--ambar); }
  h1 { font-family:"Bricolage Grotesque", sans-serif; font-weight:760; font-size:112px;
    line-height:1.02; letter-spacing:-.025em; margin-top:34px; text-wrap:balance; }
  h1 em { font-style:normal; color:var(--musgo); }
  .ambar h1 em { color:var(--ambar); }
  p { font-size:46px; line-height:1.3; color:var(--tinta-2); margin-top:34px; font-weight:600; max-width:1000px; text-wrap:pretty; }
  /* O telemóvel: moldura escura, ilha e barra de estado desenhadas. */
  .tel { position:absolute; left:50%; transform:translateX(-50%); width:960px; height:2078px;
    top:760px; border-radius:150px; background:#101512; padding:22px;
    box-shadow: 0 60px 120px rgba(13,25,18,.28), 0 10px 30px rgba(13,25,18,.12), inset 0 0 0 3px #2c332e; }
  .ecra { width:916px; height:2034px; border-radius:128px; overflow:hidden; position:relative; background:#f2f4f0; }
  .barra { height:120px; display:flex; align-items:center; justify-content:space-between; padding:14px 78px 0 110px;
    font-family:-apple-system, "SF Pro Text", Nunito, sans-serif; font-weight:700; font-size:50px; }
  .barra .ic { display:flex; gap:12px; align-items:center; transform:scale(.8); transform-origin:right center; }
  .ilha { position:absolute; top:34px; left:50%; transform:translateX(-50%); width:250px; height:76px; border-radius:38px; background:#000; }
  .ecra img { display:block; width:916px; }
</style></head>
<body class="${s.ambar ? 'ambar' : ''}">
  <div class="texto">
    <div class="rotulo">${s.label}</div>
    <h1>${s.titulo}</h1>
    <p>${s.sub}</p>
  </div>
  <div class="tel"><div class="ecra">
    <div class="barra" id="barra"><span>9:41</span><span class="ic">${rede}${wifi}${bateria}</span></div>
    <div class="ilha"></div>
    <img id="cap" src="data:image/png;base64,${img}">
  </div></div>
  <script>
    // A barra de estado toma a cor do topo do ecrã, e o texto fica claro ou
    // escuro conforme o fundo (o Início tem cabeçalho verde, os outros não).
    const im = document.getElementById('cap');
    const pintar = () => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = 4;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      const [r, g, b] = x.getImageData(Math.floor(im.naturalWidth / 2), 1, 1, 1).data;
      const barra = document.getElementById('barra');
      barra.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
      barra.parentElement.style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
      barra.style.color = (0.299 * r + 0.587 * g + 0.114 * b) < 140 ? '#fff' : '#000';
      document.body.dataset.pronto = '1';
    };
    im.complete ? pintar() : im.addEventListener('load', pintar);
  </script>
</body></html>`;
}

const ecras = [];
for (const s of slides) {
  const f = path.join(saidaHtml, `${s.ecra}.html`);
  fs.writeFileSync(f, pagina(s));
  ecras.push({
    nome: `loja-${s.ecra}`,
    url: 'file:///' + f.replace(/\\/g, '/'),
    esperar: 2500,
    js: 'await document.fonts.ready; while (!document.body.dataset.pronto) await new Promise(r => setTimeout(r, 100));',
  });
}
fs.writeFileSync(path.join(aqui, 'slides.json'), JSON.stringify(ecras, null, 1));
console.log(`${slides.length} páginas`);
