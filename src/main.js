const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

let win = null;

const storePath = () => path.join(app.getPath('userData'), 'livre-store.json');

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    title: 'Livre',
    backgroundColor: '#F2EBDA',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('did-finish-load', () => console.log('[main] fenêtre chargée'));
  win.webContents.on('console-message', (eventOrLevel, level, message) => {
    // Compatible ancien (level, message) et nouveau (event objet) format d'Electron
    const isNew = typeof eventOrLevel === 'object' && 'message' in eventOrLevel;
    const lvl = isNew ? eventOrLevel.level : level;
    const msg = isNew ? eventOrLevel.message : message;
    if (lvl === 'error' || lvl === 3) console.error('[renderer]', msg);
  });
  win.webContents.on('render-process-gone', (_e, details) =>
    console.error('[main] renderer parti :', details.reason));
}

ipcMain.handle('pick-pdf', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Ajouter des livres',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('read-file', (_e, filePath) => fs.readFile(filePath));

ipcMain.handle('load-store', async () => {
  try {
    return JSON.parse(await fs.readFile(storePath(), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('save-store', async (_e, store) => {
  await fs.writeFile(storePath(), JSON.stringify(store));
  return true;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
