const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

let win = null;

// Tests : LIVRE_USERDATA isole le profil, LIVRE_EVAL exécute un script
// dans le renderer et logge son résultat, LIVRE_SHOT capture l'écran
if (process.env.LIVRE_USERDATA) app.setPath('userData', process.env.LIVRE_USERDATA);

// Renommage « Livre » → « MontLivre » : le dossier de profil change de nom.
// On rapatrie une seule fois la bibliothèque, les notes, les croquis, les
// réglages et le cache d'extraction pour ne rien perdre à la mise à jour.
function migrateUserData() {
  if (process.env.LIVRE_USERDATA) return;
  try {
    const appData = app.getPath('appData');
    const oldDir = path.join(appData, 'Livre');
    const newDir = path.join(appData, 'MontLivre');
    if (fsSync.existsSync(newDir) || !fsSync.existsSync(oldDir)) return;
    fsSync.mkdirSync(newDir, { recursive: true });
    // Seulement nos données : les caches Chromium n'ont pas à suivre.
    const store = path.join(oldDir, 'livre-store.json');
    if (fsSync.existsSync(store)) fsSync.copyFileSync(store, path.join(newDir, 'livre-store.json'));
    const cache = path.join(oldDir, 'cache');
    if (fsSync.existsSync(cache)) fsSync.cpSync(cache, path.join(newDir, 'cache'), { recursive: true });
    console.log('[main] profil repris depuis', oldDir);
  } catch (e) {
    console.error('[main] migration du profil impossible :', e);
  }
}
migrateUserData();

const storePath = () => path.join(app.getPath('userData'), 'livre-store.json');
const cacheDir = () => path.join(app.getPath('userData'), 'cache');
const cachePath = (id) => path.join(cacheDir(), id.replace(/[^a-z0-9-]/gi, '') + '.json');

// PDF/EPUB passés en ligne de commande : `montlivre mon-livre.pdf`
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
    title: 'MontLivre',
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

ipcMain.handle('pick-font', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Importer une police',
    filters: [{ name: 'Polices', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
    properties: ['openFile'],
  });
  return r.canceled ? null : r.filePaths[0];
});

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
  json: [{ name: 'Bibliothèque MontLivre (JSON)', extensions: ['json'] }],
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

ipcMain.handle('get-version', () => app.getVersion());

/* ---------- Mise à jour intégrée (GitHub Releases) ----------
   Uniquement à la demande de l'utilisateur : aucune vérification
   automatique au démarrage (principe offline). */
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch {}

ipcMain.handle('check-updates', async () => {
  if (!app.isPackaged) return { status: 'dev' };
  if (!autoUpdater) return { status: 'error', message: 'module de mise à jour absent' };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  return await new Promise((resolve) => {
    autoUpdater.removeAllListeners();
    autoUpdater.on('update-available', (i) =>
      win.webContents.send('update-state', { state: 'downloading', version: i.version }));
    autoUpdater.on('download-progress', (p) =>
      win.webContents.send('update-state', { state: 'progress', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (i) => {
      win.webContents.send('update-state', { state: 'ready', version: i.version });
      resolve({ status: 'ready', version: i.version });
    });
    autoUpdater.on('update-not-available', () => resolve({ status: 'uptodate' }));
    autoUpdater.on('error', (e) => resolve({ status: 'error', message: String((e && e.message) || e) }));
    autoUpdater.checkForUpdates().catch((e) => resolve({ status: 'error', message: String(e) }));
  });
});

ipcMain.handle('install-update', () => {
  if (autoUpdater) autoUpdater.quitAndInstall();
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
