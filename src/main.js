const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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

const FILTERS = {
  md: [{ name: 'Markdown', extensions: ['md'] }],
  json: [{ name: 'Bibliothèque Livre (JSON)', extensions: ['json'] }],
};

// Tests : écrit dans LIVRE_TEST_EXPORT_DIR sans dialogue
async function testExportPath(defaultName) {
  if (!process.env.LIVRE_TEST_EXPORT_DIR) return undefined;
  await fs.mkdir(process.env.LIVRE_TEST_EXPORT_DIR, { recursive: true });
  return path.join(process.env.LIVRE_TEST_EXPORT_DIR, defaultName);
}

ipcMain.handle('export-file', async (_e, { defaultName, content, kind = 'md' }) => {
  let filePath = await testExportPath(defaultName);
  if (!filePath) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Exporter',
      defaultPath: defaultName,
      filters: FILTERS[kind] || FILTERS.md,
    });
    if (r.canceled || !r.filePath) return null;
    filePath = r.filePath;
  }
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
});

ipcMain.handle('import-file', async (_e, { kind = 'json' } = {}) => {
  let filePath = process.env.LIVRE_TEST_IMPORT_FILE;
  if (!filePath) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Importer',
      filters: FILTERS[kind] || FILTERS.json,
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    filePath = r.filePaths[0];
  }
  return { path: filePath, content: await fs.readFile(filePath, 'utf8') };
});

// Export d'un PDF de notes : rendu HTML → printToPDF dans une fenêtre cachée
ipcMain.handle('export-pdf', async (_e, { defaultName, html }) => {
  let filePath = await testExportPath(defaultName);
  if (!filePath) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Exporter en PDF',
      defaultPath: defaultName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.canceled || !r.filePath) return null;
    filePath = r.filePath;
  }
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    await fs.writeFile(filePath, pdf);
  } finally {
    w.destroy();
  }
  return filePath;
});

ipcMain.handle('toggle-fullscreen', () => {
  win.setFullScreen(!win.isFullScreen());
  return win.isFullScreen();
});

// Ouverture d'un lien externe (dictionnaire) : restreint au Wiktionnaire fr
ipcMain.handle('open-external', (_e, url) => {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && u.hostname === 'fr.wiktionary.org') {
      shell.openExternal(url);
      return true;
    }
  } catch {}
  return false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
