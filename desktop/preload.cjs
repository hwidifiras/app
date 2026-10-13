// Electron's sandboxed preload supports CommonJS, not ESM imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('weDisciplineDesktop', Object.freeze({
  status: () => ipcRenderer.invoke('offline:status'),
  backup: () => ipcRenderer.invoke('offline:backup'),
  restoreFile: () => ipcRenderer.invoke('offline:restore-file'),
  restoreOriginal: (password) => ipcRenderer.invoke('offline:restore-original', password),
}));
