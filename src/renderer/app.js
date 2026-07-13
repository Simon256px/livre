'use strict';

/* ═══════════ Utilitaires ═══════════ */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const basename = (p) => p.split(/[\\/]/).pop();

const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', location.href).href;
const PDF_OPTS = {
  isEvalSupported: false, // neutralise CVE-2024-4367 (JS via polices piégées)
  standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', location.href).href,
  cMapUrl: new URL('../../node_modules/pdfjs-dist/cmaps/', location.href).href,
  cMapPacked: true,
};

const GAP = 64; // espace entre deux "pages" (colonnes CSS)
const THEMES = ['creme', 'sepia', 'ambre', 'nuit'];
const ACCENTS = ['var(--yellow)', 'var(--blue)', 'var(--green)', 'var(--red)', 'var(--pink)', 'var(--purple)'];
const FONTS = {
  literata: "'Literata', Georgia, serif",
  georgia: "Georgia, 'Times New Roman', serif",
  palatino: "'Palatino Linotype', 'Book Antiqua', Georgia, serif",
  segoe: "'Segoe UI', system-ui, sans-serif",
};
const DEFAULT_SETTINGS = {
  theme: 'creme',
  font: 'literata',
  fontSize: 19,
  lineHeight: 1.75,
  pageWidth: 620,
  justify: true,
  bionic: false,
  bionicIntensity: 0.45,
  focus: false,
};

let store = { version: 1, settings: { ...DEFAULT_SETTINGS }, books: [] };
let current = null; // { book, paras, page, total, pw }
let timerId = null;

const persist = debounce(() => window.livre.saveStore(store), 500);

function fmtTime(sec) {
  if (!sec || sec < 60) return sec ? '< 1 min' : '0 min';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
function fmtDur(mins) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}`;
}

/* ═══════════ Écrans & chargement ═══════════ */
function readerVisible() {
  return !$('#readerScreen').classList.contains('hidden');
}
function switchScreen(name) {
  $('#libraryScreen').classList.toggle('hidden', name !== 'library');
  $('#readerScreen').classList.toggle('hidden', name !== 'reader');
  updateFocusRuler();
}
function showLoader(text) {
  $('#loaderText').textContent = text;
  $('#loader').classList.remove('hidden');
}
function hideLoader() {
  $('#loader').classList.add('hidden');
}

/* ═══════════ Bionic reading ═══════════ */
function bionify(text, intensity) {
  return text.split(/(\s+)/).map((tok) => {
    if (!tok || /^\s+$/.test(tok)) return tok;
    const m = tok.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}’'-]+)(.*)$/u);
    if (!m) return esc(tok);
    const [, pre, word, post] = m;
    const n = Math.max(1, Math.min(word.length, Math.round(word.length * intensity)));
    return esc(pre) + '<b>' + esc(word.slice(0, n)) + '</b>' + esc(word.slice(n)) + esc(post);
  }).join('');
}

/* ═══════════ Extraction du texte PDF ═══════════
   Reconstruit des lignes à partir des items pdf.js, retire les
   en-têtes/pieds de page répétés et les numéros de page, puis
   fusionne les lignes en paragraphes (gaps verticaux, indentation,
   césures) et détecte les titres par leur taille de police.        */
async function extractBook(pdf, onProgress) {
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lines = [];
    let cur = null;
    const flush = () => { if (cur && cur.text.trim()) lines.push(cur); cur = null; };
    for (const it of tc.items) {
      const h = it.height || Math.abs(it.transform[3]) || 10;
      const x = it.transform[4];
      const y = it.transform[5];
      if (cur && Math.abs(y - cur.y) > Math.max(cur.h, h) * 0.6) flush();
      if (!cur) cur = { text: '', x, y, h: 0, xEnd: x };
      if (it.str) {
        const gap = x - cur.xEnd;
        const needSpace = cur.text && gap > h * 0.18 &&
          !cur.text.endsWith(' ') && !it.str.startsWith(' ');
        cur.text += (needSpace ? ' ' : '') + it.str;
        cur.xEnd = x + (it.width || 0);
        cur.h = Math.max(cur.h, h);
      }
      if (it.hasEOL) flush();
    }
    flush();
    pages.push(lines);
    if (i % 5 === 0 || i === pdf.numPages) onProgress(i, pdf.numPages);
  }

  // En-têtes / pieds de page : lignes en bord de page répétées sur
  // une bonne partie du document (les chiffres sont normalisés).
  const norm = (t) => t.trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ');
  const counts = new Map();
  for (const lines of pages) {
    const edges = new Set([...lines.slice(0, 2), ...lines.slice(-2)]);
    for (const l of edges) {
      const k = norm(l.text);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const junkThreshold = Math.max(3, Math.floor(pages.length * 0.35));
  const kept = pages.map((lines) => lines.filter((l, idx) => {
    if (/^\s*[-–—.]*\s*\d+\s*[-–—.]*\s*$/.test(l.text)) return false;
    const isEdge = idx < 2 || idx >= lines.length - 2;
    return !(isEdge && (counts.get(norm(l.text)) || 0) >= junkThreshold);
  }));

  const allLines = kept.flat();
  if (!allLines.length) return { paras: [], words: 0 };
  const heights = allLines.map((l) => l.h).sort((a, b) => a - b);
  const medH = heights[heights.length >> 1] || 12;
  const gaps = [];
  for (const lines of kept) {
    for (let i = 1; i < lines.length; i++) {
      const g = lines[i - 1].y - lines[i].y;
      if (g > 0 && g < medH * 4) gaps.push(g);
    }
  }
  gaps.sort((a, b) => a - b);
  const medGap = gaps[gaps.length >> 1] || medH * 1.4;

  const paras = [];
  let buf = '';
  const flushPara = () => {
    const t = buf.replace(/\s+/g, ' ').trim();
    if (t) paras.push({ type: 'p', text: t });
    buf = '';
  };
  const endsSentence = (t) => /[.!?…:»"’)\]]\s*$/.test(t.trim());

  for (const lines of kept) {
    if (!lines.length) continue;
    const pageMinX = Math.min(...lines.map((l) => l.x));
    let prev = null;
    for (const l of lines) {
      const t = l.text.trim();
      if (!t) continue;
      const isHeading = l.h > medH * 1.3 && t.length < 90 && !/[.,;]$/.test(t);
      if (isHeading) {
        flushPara();
        paras.push({ type: 'h', text: t });
        prev = l;
        continue;
      }
      let brk = false;
      if (buf) {
        if (prev) {
          const g = prev.y - l.y;
          if (g > medGap * 1.75) brk = true;
          if (l.x - pageMinX > medH * 1.1 && endsSentence(buf)) brk = true;
        } else if (endsSentence(buf)) {
          brk = true; // changement de page sur une phrase terminée
        }
      }
      if (brk) flushPara();
      if (buf && /\p{L}-$/u.test(buf) && /^\p{Ll}/u.test(t)) {
        buf = buf.slice(0, -1) + t; // recolle la césure
      } else {
        buf += (buf ? ' ' : '') + t;
      }
      prev = l;
    }
  }
  flushPara();

  const words = paras.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
  return { paras, words };
}

async function renderCover(pdf) {
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 260 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}

/* ═══════════ Bibliothèque ═══════════ */
async function addBooks(paths) {
  for (const p of paths) {
    if (store.books.some((b) => b.path === p)) continue;
    showLoader(`Ouverture de ${basename(p)}…`);
    try {
      const buf = await window.livre.readFile(p);
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), ...PDF_OPTS }).promise;
      const meta = await pdf.getMetadata().catch(() => null);
      const title = String(meta?.info?.Title || '').trim() || basename(p).replace(/\.pdf$/i, '');
      const cover = await renderCover(pdf);
      store.books.push({
        id: crypto.randomUUID(),
        path: p,
        title,
        pages: pdf.numPages,
        cover,
        words: null,
        progress: 0,
        anchor: null,
        readingSeconds: 0,
        addedAt: Date.now(),
        lastOpenedAt: 0,
      });
      pdf.destroy();
    } catch (e) {
      console.error(e);
      alert(`Impossible d'ouvrir « ${basename(p)} » : ${e.message || e}`);
    }
  }
  hideLoader();
  persist();
  renderLibrary();
}

function renderLibrary() {
  const grid = $('#bookGrid');
  const books = [...store.books].sort(
    (a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt)
  );
  $('#emptyState').classList.toggle('hidden', books.length > 0);

  const totalSec = books.reduce((n, b) => n + (b.readingSeconds || 0), 0);
  $('#libStats').textContent = books.length
    ? `${books.length} livre${books.length > 1 ? 's' : ''} · ${fmtTime(totalSec)} de lecture au total`
    : 'Ta bibliothèque est vide';

  grid.innerHTML = books.map((b, i) => {
    const accent = ACCENTS[i % ACCENTS.length];
    const pct = Math.round((b.progress || 0) * 100);
    const cover = b.cover
      ? `<img src="${b.cover}" alt="">`
      : `<span class="letter" style="color:var(--ink)">${esc((b.title[0] || '?').toUpperCase())}</span>`;
    return `<article class="book-card" data-id="${b.id}">
      <div class="cover" style="background:${b.cover ? 'var(--bg)' : accent}">${cover}</div>
      <button class="del" title="Retirer de la bibliothèque">✕</button>
      <h3>${esc(b.title)}</h3>
      <p class="meta">${b.pages} pages · ${fmtTime(b.readingSeconds)}${pct ? ` · ${pct} %` : ''}</p>
      <div class="progress"><div class="fill" style="width:${pct}%"></div></div>
    </article>`;
  }).join('');

  $$('.book-card', grid).forEach((card) => {
    card.addEventListener('click', () => openBook(card.dataset.id));
    $('.del', card).addEventListener('click', (e) => {
      e.stopPropagation();
      const book = store.books.find((b) => b.id === card.dataset.id);
      if (book && confirm(`Retirer « ${book.title} » de la bibliothèque ?\n(Le fichier PDF n'est pas supprimé.)`)) {
        store.books = store.books.filter((b) => b.id !== card.dataset.id);
        persist();
        renderLibrary();
      }
    });
  });
}

/* ═══════════ Lecture ═══════════ */
async function openBook(id) {
  const book = store.books.find((b) => b.id === id);
  if (!book) return;
  showLoader('Lecture du fichier…');
  try {
    const buf = await window.livre.readFile(book.path);
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), ...PDF_OPTS }).promise;
    const { paras, words } = await extractBook(pdf, (i, n) =>
      showLoader(`Extraction du texte — page ${i} / ${n}`));
    pdf.destroy();
    if (!paras.length || words < 40) {
      hideLoader();
      alert("Ce PDF ne contient pas de texte extractible — sans doute un scan.\nL'OCR arrivera dans une prochaine version !");
      return;
    }
    book.words = words;
    book.lastOpenedAt = Date.now();
    persist();
    current = { book, paras, page: 0, total: 1, pw: 0 };
    $('#readerTitle').textContent = book.title;
    $('#runningHead').textContent = book.title;
    await document.fonts.ready;
    switchScreen('reader');
    renderContent();
    paginate();
    restorePosition();
    startTimer();
  } catch (e) {
    console.error(e);
    alert(`Impossible de lire ce livre : ${e.message || e}`);
    switchScreen('library');
  }
  hideLoader();
}

function renderContent() {
  const s = store.settings;
  const c = $('#bookContent');
  c.style.fontFamily = FONTS[s.font] || FONTS.literata;
  c.style.fontSize = s.fontSize + 'px';
  c.style.lineHeight = s.lineHeight;
  c.style.textAlign = s.justify ? 'justify' : 'left';
  c.innerHTML = current.paras.map((p, i) => {
    if (p.type === 'h') return `<h2 data-i="${i}">${esc(p.text)}</h2>`;
    const inner = s.bionic ? bionify(p.text, s.bionicIntensity) : esc(p.text);
    return `<p data-i="${i}">${inner}</p>`;
  }).join('');
}

function paginate() {
  const vp = $('#bookViewport');
  const c = $('#bookContent');
  const pw = Math.max(320, Math.min(store.settings.pageWidth, window.innerWidth - 300));
  current.pw = pw;
  vp.style.width = pw + 'px';
  c.style.transform = 'none'; // mesure sans translation
  c.style.width = pw + 'px';
  c.style.columnWidth = pw + 'px';
  c.style.columnGap = GAP + 'px';
  c.style.height = vp.clientHeight + 'px';
  current.total = Math.max(1, Math.round((vp.scrollWidth + GAP) / (pw + GAP)));
}

function goTo(page, save = true) {
  const p = Math.max(0, Math.min(page, current.total - 1));
  current.page = p;
  $('#bookContent').style.transform = `translateX(${-p * (current.pw + GAP)}px)`;
  updateFoot();
  if (save) {
    current.book.progress = current.total > 1 ? (p + 1) / current.total : 1;
    current.book.anchor = anchorAt(p);
    persist();
  }
}

// Premier paragraphe qui démarre sur la page p : sert de point
// d'ancrage stable quand la mise en page change (police, taille…).
function anchorAt(p) {
  const target = p * (current.pw + GAP);
  for (const el of $('#bookContent').children) {
    if (el.offsetLeft >= target - 4) return Number(el.dataset.i);
  }
  return null;
}

function pageOfAnchor(anchor) {
  const el = $(`#bookContent [data-i="${anchor}"]`);
  return el ? Math.round(el.offsetLeft / (current.pw + GAP)) : 0;
}

function restorePosition() {
  const b = current.book;
  let p = 0;
  if (b.anchor != null) p = pageOfAnchor(b.anchor);
  else if (b.progress) p = Math.round(b.progress * current.total) - 1;
  goTo(p, false);
}

function updateFoot() {
  const { page, total, book } = current;
  const pct = Math.round(((page + 1) / total) * 100);
  $('#pageInfo').textContent = `p. ${page + 1} / ${total}`;
  $('#readFill').style.width = pct + '%';
  const remainingWords = (book.words || 0) * (1 - (page + 1) / total);
  const mins = Math.ceil(remainingWords / 220);
  $('#timeLeft').textContent = mins > 0 ? `≈ ${fmtDur(mins)} restant` : 'terminé ✦';
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (document.hasFocus() && readerVisible() && current) {
      current.book.readingSeconds = (current.book.readingSeconds || 0) + 10;
      persist();
    }
  }, 10000);
}
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function closeReader() {
  stopTimer();
  current = null;
  closeDrawer();
  switchScreen('library');
  renderLibrary();
}

/* ═══════════ Réglages ═══════════ */
function openDrawer() { $('#settingsDrawer').classList.add('open'); }
function closeDrawer() { $('#settingsDrawer').classList.remove('open'); }

function updateFocusRuler() {
  const on = store.settings.focus && readerVisible();
  $('#focusRuler').style.display = on ? 'block' : 'none';
}

function syncControls() {
  const s = store.settings;
  document.body.dataset.theme = s.theme;
  $$('.dot').forEach((d) => d.classList.toggle('active', d.dataset.theme === s.theme));
  $('#fontSelect').value = s.font;
  $('#sizeRange').value = s.fontSize;
  $('#sizeVal').textContent = s.fontSize + ' px';
  $('#lhRange').value = s.lineHeight;
  $('#lhVal').textContent = s.lineHeight.toFixed(2);
  $('#widthRange').value = s.pageWidth;
  $('#widthVal').textContent = s.pageWidth + ' px';
  $('#justifyChk').checked = s.justify;
  $('#bionicChk').checked = s.bionic;
  $('#intensityRange').value = s.bionicIntensity;
  $('#intensityVal').textContent = Math.round(s.bionicIntensity * 100) + ' %';
  $('#focusChk').checked = s.focus;
  $('#bionicBtn').classList.toggle('on', s.bionic);
  $('#focusBtn').classList.toggle('on', s.focus);
  updateFocusRuler();
}

// rerender : true quand le changement affecte la mise en page du texte
function applySettings(rerender) {
  syncControls();
  persist();
  if (rerender && current && readerVisible()) {
    const anchor = current.book.anchor;
    renderContent();
    paginate();
    if (anchor != null) goTo(pageOfAnchor(anchor), false);
    else restorePosition();
  }
}

/* ═══════════ Câblage de l'interface ═══════════ */
function buildUI() {
  for (const holder of ['#libDots', '#readerDots']) {
    $(holder).innerHTML = THEMES.map((t) =>
      `<button class="dot" data-theme="${t}" title="Thème ${t}"></button>`).join('');
  }
  $$('.dot').forEach((d) => d.addEventListener('click', () => {
    store.settings.theme = d.dataset.theme;
    applySettings(false);
  }));

  const pick = async () => {
    const paths = await window.livre.pickPdf();
    if (paths.length) addBooks(paths);
  };
  $('#addBtn').addEventListener('click', pick);
  $('#emptyAddBtn').addEventListener('click', pick);

  $('#backBtn').addEventListener('click', closeReader);
  $('#prevBtn').addEventListener('click', () => goTo(current.page - 1));
  $('#nextBtn').addEventListener('click', () => goTo(current.page + 1));
  $('#settingsBtn').addEventListener('click', () =>
    $('#settingsDrawer').classList.toggle('open'));
  $('#closeDrawerBtn').addEventListener('click', closeDrawer);
  $('#bionicBtn').addEventListener('click', () => {
    store.settings.bionic = !store.settings.bionic;
    applySettings(true);
  });
  $('#focusBtn').addEventListener('click', () => {
    store.settings.focus = !store.settings.focus;
    applySettings(false);
  });

  $('#fontSelect').addEventListener('change', (e) => {
    store.settings.font = e.target.value;
    applySettings(true);
  });
  $('#sizeRange').addEventListener('input', (e) => {
    store.settings.fontSize = Number(e.target.value);
    applySettings(true);
  });
  $('#lhRange').addEventListener('input', (e) => {
    store.settings.lineHeight = Number(e.target.value);
    applySettings(true);
  });
  $('#widthRange').addEventListener('input', (e) => {
    store.settings.pageWidth = Number(e.target.value);
    applySettings(true);
  });
  $('#justifyChk').addEventListener('change', (e) => {
    store.settings.justify = e.target.checked;
    applySettings(true);
  });
  $('#bionicChk').addEventListener('change', (e) => {
    store.settings.bionic = e.target.checked;
    applySettings(true);
  });
  $('#intensityRange').addEventListener('input', (e) => {
    store.settings.bionicIntensity = Number(e.target.value);
    applySettings(store.settings.bionic);
  });
  $('#focusChk').addEventListener('change', (e) => {
    store.settings.focus = e.target.checked;
    applySettings(false);
  });

  document.addEventListener('keydown', (e) => {
    if (!readerVisible() || !current) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
      e.preventDefault();
      goTo(current.page + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
      e.preventDefault();
      goTo(current.page - 1);
    } else if (e.key === 'Escape') {
      if ($('#settingsDrawer').classList.contains('open')) closeDrawer();
      else closeReader();
    }
  });

  let wheelLock = 0;
  $('.reader-main').addEventListener('wheel', (e) => {
    if (!current) return;
    const now = Date.now();
    if (now - wheelLock < 180) return;
    wheelLock = now;
    goTo(current.page + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener('mousemove', (e) => {
    if (!store.settings.focus || !readerVisible()) return;
    const y = e.clientY;
    $('#focusRuler').style.background =
      `linear-gradient(to bottom, var(--dim) 0px, var(--dim) ${y - 46}px,` +
      ` transparent ${y - 46}px, transparent ${y + 52}px, var(--dim) ${y + 52}px)`;
  });

  window.addEventListener('resize', debounce(() => {
    if (current && readerVisible()) {
      const anchor = current.book.anchor;
      paginate();
      if (anchor != null) goTo(pageOfAnchor(anchor), false);
    }
  }, 200));

  // Glisser-déposer de PDF
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dropping');
  });
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) document.body.classList.remove('dropping');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dropping');
    const paths = [...e.dataTransfer.files]
      .filter((f) => /\.pdf$/i.test(f.name))
      .map((f) => window.livre.pathForFile(f))
      .filter(Boolean);
    if (paths.length) addBooks(paths);
  });
}

/* ═══════════ Démarrage ═══════════ */
(async function init() {
  const saved = await window.livre.loadStore();
  if (saved) {
    store = saved;
    store.settings = { ...DEFAULT_SETTINGS, ...(store.settings || {}) };
    store.books = store.books || [];
  }
  buildUI();
  syncControls();
  renderLibrary();
})();
