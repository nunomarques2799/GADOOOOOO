// Ponte entre a app (renderer) e o processo principal, só para a atualização.
// Expõe três funções e mais nada — o renderer continua sem acesso ao Node
// (contextIsolation ligado, nodeIntegration desligado).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gadoAtualizacao', {
  /** true se já há uma versão nova descarregada e pronta a instalar. */
  estado: () => ipcRenderer.invoke('atualizacao-estado'),

  /** Instala a versão descarregada e reinicia a app. */
  instalar: () => ipcRenderer.invoke('atualizacao-instalar'),

  /** Avisa quando a descarga terminar. Devolve a função para deixar de ouvir. */
  aoFicarPronta: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('atualizacao-pronta', handler);
    return () => ipcRenderer.removeListener('atualizacao-pronta', handler);
  },
});
