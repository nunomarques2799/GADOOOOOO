// Imagens da loja na versão EM PREPARAÇÃO (App Store Connect API, Team Key).
//
//   node imagens-loja.js ver                  -> lista conjuntos e imagens (não altera nada)
//   node imagens-loja.js carregar <pasta65> <pasta69>
//        -> em pt-PT, APAGA as imagens que lá estão nos conjuntos 6,5" e 6,9" e
//           carrega as da pasta, pela ordem do nome do ficheiro.
//
// Só mexe na versão 1.1.0; a 1.0 publicada tem as suas próprias imagens e não
// aceita alterações.
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const KEY_ID = '7UFHT59KB3';
const ISSUER_ID = '5d643210-f462-49b4-a7a7-5fff4a1b4742';
const APP_ID = '6799063195';
const VERSAO = '1.1.0';
const KEY_PATH = path.join(process.env.USERPROFILE, '.appstoreconnect', 'private_keys', `AuthKey_${KEY_ID}.p8`);

function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const agora = Math.floor(Date.now() / 1000);
  const entrada = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' +
    b64({ iss: ISSUER_ID, iat: agora, exp: agora + 900, aud: 'appstoreconnect-v1' });
  const assinatura = crypto.sign('sha256', Buffer.from(entrada), {
    key: crypto.createPrivateKey(fs.readFileSync(KEY_PATH)), dsaEncoding: 'ieee-p1363',
  });
  return entrada + '.' + assinatura.toString('base64url');
}

async function chamar(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  const res = { estado: r.status, corpo: texto ? JSON.parse(texto) : null };
  if (r.status >= 400) throw new Error(`${metodo} ${caminho} -> HTTP ${r.status}\n${texto}`);
  return res;
}

async function versaoEmPreparacao() {
  const r = await chamar('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${VERSAO}&filter[platform]=IOS`);
  const v = r.corpo.data[0];
  if (!v) throw new Error(`não há versão ${VERSAO}`);
  return v;
}

async function localizacoes(versaoId) {
  return (await chamar('GET', `/v1/appStoreVersions/${versaoId}/appStoreVersionLocalizations`)).corpo.data;
}

async function conjuntos(locId) {
  return (await chamar('GET', `/v1/appStoreVersionLocalizations/${locId}/appScreenshotSets?include=appScreenshots&limit=50`)).corpo;
}

async function ver() {
  const v = await versaoEmPreparacao();
  console.log(`versão ${v.attributes.versionString}  ${v.attributes.appStoreState}  (${v.id})`);
  for (const l of await localizacoes(v.id)) {
    console.log(`\n  localização ${l.attributes.locale}  (${l.id})`);
    const c = await conjuntos(l.id);
    const imgs = new Map((c.included ?? []).map((i) => [i.id, i.attributes]));
    for (const s of c.data) {
      const ids = s.relationships.appScreenshots.data.map((d) => d.id);
      console.log(`    ${s.attributes.screenshotDisplayType}  ${ids.length} imagem(ns)  (${s.id})`);
      for (const id of ids) {
        const a = imgs.get(id) ?? {};
        console.log(`      - ${a.fileName}  ${a.imageAsset?.width}x${a.imageAsset?.height}  ${a.assetDeliveryState?.state}`);
      }
    }
  }
}

async function carregarEm(locId, tipo, pasta, existentes) {
  let conjunto = existentes.find((s) => s.attributes.screenshotDisplayType === tipo);
  if (!conjunto) {
    conjunto = (await chamar('POST', '/v1/appScreenshotSets', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: tipo },
        relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: locId } } } },
    })).corpo.data;
    console.log(`  ${tipo}: conjunto criado`);
  }
  for (const d of conjunto.relationships?.appScreenshots?.data ?? []) {
    await chamar('DELETE', `/v1/appScreenshots/${d.id}`);
    console.log(`  ${tipo}: apagada ${d.id}`);
  }

  const ficheiros = fs.readdirSync(pasta).filter((f) => f.endsWith('.png')).sort();
  const novos = [];
  for (const nome of ficheiros) {
    const bytes = fs.readFileSync(path.join(pasta, nome));
    const reserva = (await chamar('POST', '/v1/appScreenshots', {
      data: { type: 'appScreenshots', attributes: { fileName: nome, fileSize: bytes.length },
        relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: conjunto.id } } } },
    })).corpo.data;
    for (const op of reserva.attributes.uploadOperations) {
      const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`envio de ${nome} falhou: HTTP ${r.status} ${await r.text()}`);
    }
    await chamar('PATCH', `/v1/appScreenshots/${reserva.id}`, {
      data: { type: 'appScreenshots', id: reserva.id,
        attributes: { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(bytes).digest('hex') } },
    });
    novos.push(reserva.id);
    console.log(`  ${tipo}: carregada ${nome}`);
  }
  // A ordem na loja é a da relação, não a do envio: fixa-se explicitamente.
  await chamar('PATCH', `/v1/appScreenshotSets/${conjunto.id}/relationships/appScreenshots`, {
    data: novos.map((id) => ({ type: 'appScreenshots', id })),
  });
  return novos;
}

async function carregar(pasta65, pasta69) {
  const v = await versaoEmPreparacao();
  if (v.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    throw new Error(`a ${VERSAO} está em ${v.attributes.appStoreState}; só se mexe numa versão em preparação`);
  }
  const loc = (await localizacoes(v.id)).find((l) => l.attributes.locale === 'pt-PT');
  if (!loc) throw new Error('não há localização pt-PT');
  const existentes = (await conjuntos(loc.id)).data;
  const ids = [
    ...(await carregarEm(loc.id, 'APP_IPHONE_65', pasta65, existentes)),
    ...(await carregarEm(loc.id, 'APP_IPHONE_67', pasta69, existentes)),
  ];
  // A Apple processa cada imagem depois do envio; esperar até todas estarem prontas.
  for (let i = 0; i < 40; i++) {
    const estados = [];
    for (const id of ids) {
      estados.push((await chamar('GET', `/v1/appScreenshots/${id}`)).corpo.data.attributes.assetDeliveryState);
    }
    const falhas = estados.filter((e) => e.state === 'FAILED');
    if (falhas.length) throw new Error('a Apple recusou: ' + JSON.stringify(falhas, null, 1));
    if (estados.every((e) => e.state === 'COMPLETE')) return console.log(`\n${ids.length} imagens processadas pela Apple.`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log('\nAinda em processamento; ver com: node imagens-loja.js ver');
}

const [acao, a, b] = process.argv.slice(2);
(acao === 'ver' ? ver() : acao === 'carregar' ? carregar(a, b) : Promise.reject(new Error('node imagens-loja.js ver | carregar <pasta65> <pasta69>')))
  .catch((e) => { console.error(e.message); process.exit(1); });
