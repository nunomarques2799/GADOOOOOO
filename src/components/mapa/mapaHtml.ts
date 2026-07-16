/**
 * Gera o HTML de um mapa Leaflet com tiles de satélite (Esri World Imagery).
 * Usado tanto no nativo (dentro de um WebView) como na web (dentro de um
 * <iframe>). A comunicação com a app é por mensagens:
 *   - o mapa envia  { type: 'pin', lat, lng }  ao tocar (modo selecionável);
 *   - o mapa envia  { type: 'ready' }          quando termina de carregar.
 *
 * postMessage funciona nos dois ambientes: no WebView usa
 * window.ReactNativeWebView.postMessage; na web usa window.parent.postMessage.
 */

export type MapaHtmlOpcoes = {
  latitude?: number;
  longitude?: number;
  /** Permite tocar no mapa para colocar/mover o pino. */
  selecionavel?: boolean;
};

/** Centro de recurso (Portugal continental) quando ainda não há coordenadas. */
const CENTRO_PT = { lat: 39.6, lng: -8.0, zoom: 6 };

export function mapaHtml({ latitude, longitude, selecionavel = false }: MapaHtmlOpcoes): string {
  const temPino = typeof latitude === 'number' && typeof longitude === 'number';
  const centro = temPino
    ? { lat: latitude, lng: longitude, zoom: 16 }
    : CENTRO_PT;

  // Serializado para dentro do <script> — valores numéricos controlados por nós.
  const cfg = JSON.stringify({
    lat: centro.lat,
    lng: centro.lng,
    zoom: centro.zoom,
    temPino,
    pinLat: temPino ? latitude : null,
    pinLng: temPino ? longitude : null,
    selecionavel,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #mapa { height: 100%; margin: 0; padding: 0; }
    #mapa { background: #dfe6da; }
    .leaflet-container { font-family: system-ui, sans-serif; }
    .dica {
      position: absolute; z-index: 1000; left: 50%; top: 10px;
      transform: translateX(-50%);
      background: rgba(21,37,28,0.82); color: #fff;
      font-size: 13px; font-weight: 600; padding: 6px 12px;
      border-radius: 999px; pointer-events: none; white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="mapa"></div>
  ${selecionavel ? '<div class="dica" id="dica">Toque no mapa para marcar o terreno</div>' : ''}
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var CFG = ${cfg};

    function enviar(msg) {
      var texto = JSON.stringify(msg);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(texto);
      } else if (window.parent) {
        window.parent.postMessage(texto, '*');
      }
    }

    var mapa = L.map('mapa', { zoomControl: true, attributionControl: false })
      .setView([CFG.lat, CFG.lng], CFG.zoom);

    // Satélite (Esri World Imagery) + rótulos de estradas/lugares por cima.
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(mapa);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(mapa);

    var marcador = null;
    function colocar(lat, lng) {
      if (marcador) {
        marcador.setLatLng([lat, lng]);
      } else {
        marcador = L.marker([lat, lng], { draggable: CFG.selecionavel }).addTo(mapa);
        if (CFG.selecionavel) {
          marcador.on('dragend', function (e) {
            var p = e.target.getLatLng();
            enviar({ type: 'pin', lat: p.lat, lng: p.lng });
          });
        }
      }
    }

    if (CFG.temPino) colocar(CFG.pinLat, CFG.pinLng);

    if (CFG.selecionavel) {
      mapa.on('click', function (e) {
        colocar(e.latlng.lat, e.latlng.lng);
        var d = document.getElementById('dica');
        if (d) d.style.display = 'none';
        enviar({ type: 'pin', lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    enviar({ type: 'ready' });
  </script>
</body>
</html>`;
}
