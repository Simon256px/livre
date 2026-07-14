const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('livre', {
  pickBooks: () => ipcRenderer.invoke('pick-books'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  loadStore: () => ipcRenderer.invoke('load-store'),
  saveStore: (store) => ipcRenderer.invoke('save-store', store),
  loadCache: (id) => ipcRenderer.invoke('load-cache', id),
  saveCache: (id, data) => ipcRenderer.invoke('save-cache', id, data),
  deleteCache: (id) => ipcRenderer.invoke('delete-cache', id),
  exportFile: (opts) => ipcRenderer.invoke('export-file', opts),
  importFile: (opts) => ipcRenderer.invoke('import-file', opts),
  exportPdf: (opts) => ipcRenderer.invoke('export-pdf', opts),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onFullscreen: (cb) => ipcRenderer.on('fullscreen', (_e, on) => cb(on)),
  onOpenFiles: (cb) => ipcRenderer.on('open-files', (_e, paths) => cb(paths)),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
});
