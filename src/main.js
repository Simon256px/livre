const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

let win = null;

// Tests : LIVRE_USERDATA isole le profil, LIVRE_EVAL exécute un script
// dans le renderer et logge son résultat, LIVRE_SHOT capture l'écran
if (process.env.LIVRE_USERDATA) app.setPath('userData', process.env.LIVRE_USERDATA);

const storePath = () => path.join(app.getPath('userData'), 'livre-store.json');
const cacheDir = () => path.join(app.getPath('userData'), 'cache');
const cachePath = (id) => path.join(cacheDir(), id.replace(/[^a-z0-9-]/gi, '') + '.json');

// PDF/EPUB passés en ligne de commande : `livre mon-livre.pdf`
const fileArgs = process.argv
  .slice(app.isPackaged ? 1 : 2)
  .filter((a) => /\.(pdf|epub)$/i.test(a))
  .map((a) => path.resolve(a));

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

  win.webContents.on('did-finish-load', async () => {
    console.log('[main] fenêtre chargée');
    if (fileArgs.length) win.webContents.send('open-files', fileArgs);
    if (process.env.LIVRE_EVAL) {
      try {
        const script = await fs.readFile(process.env.LIVRE_EVAL, 'utf8');
        const result = await win.webContents.executeJavaScript(script, true);
        console.log('[eval]', JSON.stringify(result));
      } catch (e) {
        console.error('[eval] échec :', e);
      }
    }
  });
  win.webContents.on('console-message', (eventOrLevel, level, message) => {
    // Compatible ancien (level, message) et nouveau (event objet) format d'Electron
    const isNew = typeof eventOrLevel === 'object' && 'message' in eventOrLevel;
    const lvl = isNew ? eventOrLevel.level : level;
    const msg = isNew ? eventOrLevel.message : message;
    if (lvl === 'error' || lvl === 3) console.error('[renderer]', msg);
  });
  win.webContents.on('render-process-gone', (_e, details) =>
    console.error('[main] renderer parti :', details.reason));

  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));

  // Capture d'écran automatisée pour les tests : LIVRE_SHOT=chemin.png
  if (process.env.LIVRE_SHOT) {
    setTimeout(async () => {
      try {
        const img = await win.webContents.capturePage();
        await fs.writeFile(process.env.LIVRE_SHOT, img.toPNG());
        console.log('[main] capture enregistrée :', process.env.LIVRE_SHOT);
      } catch (e) {
        console.error('[main] capture impossible :', e);
      }
      app.quit();
    }, Number(process.env.LIVRE_SHOT_DELAY) || 9000);
  }
}

ipcMain.handle('pick-books', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Ajouter des livres',
    filters: [
      { name: 'Livres (PDF, EPUB)', extensions: ['pdf', 'epub'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'EPUB', extensions: ['epub'] },
    ],
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

ipcMain.handle('load-cache', async (_e, id) => {
  try {
    return JSON.parse(await fs.readFile(cachePath(id), 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('save-cache', async (_e, id, data) => {
  await fs.mkdir(cacheDir(), { recursive: true });
  await fs.writeFile(cachePath(id), JSON.stringify(data));
  return true;
});

ipcMain.handle('delete-cache', async (_e, id) => {
  try {
    await fs.unlink(cachePath(id));
  } catch {}
  return true;
});

ipcMain.handle('export-file', async (_e, { defaultName, content }) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Exporter',
    defaultPath: defaultName,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (r.canceled || !r.filePath) return null;
  await fs.writeFile(r.filePath, content, 'utf8');
  return r.filePath;
});

ipcMain.handle('toggle-fullscreen', () => {
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
