const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('livre', {
  pickPdf: () => ipcRenderer.invoke('pick-pdf'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  loadStore: () => ipcRenderer.invoke('load-store'),
  saveStore: (store) => ipcRenderer.invoke('save-store', store),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
});
