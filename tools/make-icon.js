// Génère build/icon.png (1024×1024) à partir d'un SVG « sticker »,
// en rasterisant via Electron. Lancer : npx electron tools/make-icon.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="44" y="44" width="936" height="936" rx="215" fill="#F2C53D" stroke="#1D1A14" stroke-width="40"/>
  <g stroke="#1D1A14" stroke-width="30" stroke-linejoin="round">
    <path d="M512 322 C 424 268, 296 268, 236 306 L236 706 C296 668, 424 668, 512 722 Z" fill="#FBF5E6"/>
    <path d="M512 322 C 600 268, 728 268, 788 306 L788 706 C728 668, 600 668, 512 722 Z" fill="#FBF5E6"/>
    <line x1="512" y1="322" x2="512" y2="722"/>
    <g stroke-width="17" stroke-linecap="round" opacity="0.9">
      <line x1="300" y1="382" x2="452" y2="368"/>
      <line x1="300" y1="440" x2="452" y2="426"/>
      <line x1="300" y1="498" x2="452" y2="484"/>
      <line x1="572" y1="368" x2="724" y2="382"/>
      <line x1="572" y1="426" x2="724" y2="440"/>
      <line x1="572" y1="484" x2="724" y2="498"/>
    </g>
  </g>
  <path d="M628 262 L628 430 L668 396 L708 430 L708 262 Z" fill="#E4502E" stroke="#1D1A14" stroke-width="22" stroke-linejoin="round"/>
</svg>`;

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent}svg{display:block}</style></head>
<body>${SVG}</body></html>`;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024, height: 1024, show: false,
    transparent: true, frame: false,
    webPreferences: { offscreen: false },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));
  await new Promise((r) => setTimeout(r, 600));
  const img = await win.webContents.capturePage();
  const outDir = path.join(__dirname, '..', 'build');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'icon.png'), img.toPNG());
  console.log('build/icon.png écrit :', img.getSize());
  app.quit();
});
