// Génère build/icon.png (1024×1024) — logo MontLivre : une montagne
// dont les neiges sont les pages d'un livre ouvert. Rasterisé via Electron.
// Lancer : npm run make-icon
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const NAVY = '#22364F';
const GOLD = '#B08D4F';
const CREAM = '#EFE8D6';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="pgL" x1="0.2" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="#FFFDF6"/><stop offset="1" stop-color="#E8DFC8"/>
    </linearGradient>
    <linearGradient id="pgR" x1="0.8" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="#FBF6E9"/><stop offset="1" stop-color="#DED3B8"/>
    </linearGradient>
    <clipPath id="clipL"><path d="M505 402 C 448 454, 366 554, 286 646 C 368 630, 452 660, 505 702 Z"/></clipPath>
    <clipPath id="clipR"><path d="M519 402 C 576 454, 658 554, 738 646 C 656 630, 572 660, 519 702 Z"/></clipPath>
  </defs>

  <!-- fond crème -->
  <rect x="6" y="6" width="1012" height="1012" rx="188" fill="${CREAM}"/>

  <!-- second sommet, en retrait à droite -->
  <path d="M700 664 L790 406 L830 466 L862 430 L870 664 Z" fill="#D6C9AC"/>

  <!-- montagne principale : la base se confond avec le livre -->
  <path d="M512 232 L575 318 L611 288 L676 380 L716 352 L874 664 L150 664 L332 352 L372 380 L437 288 L463 318 Z"
        fill="${NAVY}"/>

  <!-- pages du livre = neiges éternelles : éventail resserré, pentes dégagées -->
  <path d="M505 402 C 448 454, 366 554, 286 646 C 368 630, 452 660, 505 702 Z" fill="url(#pgL)"/>
  <path d="M519 402 C 576 454, 658 554, 738 646 C 656 630, 572 660, 519 702 Z" fill="url(#pgR)"/>
  <!-- feuillets -->
  <g stroke="#D3C9AF" stroke-width="3.5" fill="none" opacity=".9">
    <g clip-path="url(#clipL)">
      <path d="M500 440 C 446 492, 372 578, 300 662"/>
      <path d="M496 486 C 448 530, 392 596, 330 668"/>
    </g>
    <g clip-path="url(#clipR)">
      <path d="M524 440 C 578 492, 652 578, 724 662"/>
      <path d="M528 486 C 576 530, 632 596, 694 668"/>
    </g>
  </g>
  <!-- pli central -->
  <path d="M512 414 L512 698" stroke="#CBBEA0" stroke-width="3" fill="none" opacity=".55"/>

  <!-- couverture du livre : bande qui creuse au centre -->
  <path d="M150 648 C 300 636, 432 668, 512 710 C 592 668, 724 636, 874 648
           L 874 690 C 724 678, 592 710, 512 752 C 432 710, 300 678, 150 690 Z" fill="${NAVY}"/>
  <!-- tranche dorée -->
  <path d="M150 690 C 300 678, 432 710, 512 752 C 592 710, 724 678, 874 690
           L 874 712 C 724 700, 592 732, 512 774 C 432 732, 300 700, 150 712 Z" fill="${GOLD}"/>

  <!-- mot-symbole -->
  <text x="512" y="945" text-anchor="middle" font-family="Literata, Georgia, serif"
        font-weight="700" font-size="118" letter-spacing="1">
    <tspan fill="${NAVY}">Mont</tspan><tspan fill="${GOLD}">Livre</tspan>
  </text>
  <!-- filet orné -->
  <g stroke="${GOLD}" stroke-width="3">
    <path d="M330 985 L478 985"/><path d="M546 985 L694 985"/>
  </g>
  <path d="M512 973 L524 985 L512 997 L500 985 Z" fill="${GOLD}"/>
</svg>`;

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Literata';
    font-weight: 700;
    src: url('../node_modules/@fontsource/literata/files/literata-latin-700-normal.woff2') format('woff2');
  }
  html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent}
  svg{display:block}
</style></head>
<body>${SVG}</body></html>`;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const outDir = path.join(__dirname, '..', 'build');
  await fs.mkdir(outDir, { recursive: true });
  const tmp = path.join(outDir, '_icon.html');
  await fs.writeFile(tmp, HTML, 'utf8');

  const win = new BrowserWindow({
    width: 1024, height: 1024, show: false,
    transparent: true, frame: false,
  });
  await win.loadFile(tmp);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage();
  await fs.writeFile(path.join(outDir, 'icon.png'), img.toPNG());
  await fs.unlink(tmp).catch(() => {});
  console.log('build/icon.png écrit :', img.getSize());
  app.quit();
});
