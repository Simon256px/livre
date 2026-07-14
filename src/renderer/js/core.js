'use strict';

/* ═══════════ Utilitaires & état partagé ═══════════
   Scripts classiques chargés dans l'ordre : les déclarations
   top-level sont partagées entre tous les fichiers js/.        */

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const basename = (p) => p.split(/[\\/]/).pop();
const snippet = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t);
// Minuscules sans accents, avec table de correspondance vers les
// offsets d'origine (NFD peut changer la longueur de la chaîne)
function foldWithMap(str) {
  let out = '';
  const map = [];
  for (let i = 0; i < str.length; i++) {
    const f = str[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const ch of f) { out += ch; map.push(i); }
  }
  return { out, map };
}

const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../../node_modules/pdfjs-dist/build/pdf.worker.min.js', location.href).href;
const PDF_OPTS = {
  isEvalSupported: false, // neutralise CVE-2024-4367 (JS via polices piégées)
  standardFontDataUrl: new URL('../../node_modules/pdfjs-dist/standard_fonts/', location.href).href,
  cMapUrl: new URL('../../node_modules/pdfjs-dist/cmaps/', location.href).href,
  cMapPacked: true,
};

const GAP = 64; // espace entre deux colonnes-pages
const CACHE_V = 4; // à incrémenter quand la logique d'extraction change
const THEMES = ['creme', 'sepia', 'ambre', 'nuit'];
const ACCENTS = ['var(--yellow)', 'var(--blue)', 'var(--green)', 'var(--red)', 'var(--pink)', 'var(--purple)'];
const HL_COLORS = ['yellow', 'green', 'blue', 'pink'];
const FONTS = {
  literata: "'Literata', Georgia, serif",
  atkinson: "'Atkinson Hyperlegible', 'Segoe UI', sans-serif",
  plex: "'IBM Plex Serif', Georgia, serif",
  opendyslexic: "'OpenDyslexic', 'Comic Sans MS', sans-serif",
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
  flow: 'pages',   // 'pages' | 'scroll'
  spread: 'auto',  // 'auto' | '1' | '2'
  rsvpWpm: 350,
  dictOnline: false, // dictionnaire Wiktionnaire (requête réseau) — opt-in
  dailyGoalMin: 20,  // objectif de lecture quotidien en minutes (0 = off)
  pomodoroFocus: 25, // durée d'une session de lecture (minutes)
  pomodoroBreak: 5,  // durée d'une pause (minutes)
};

let store = { version: 2, settings: { ...DEFAULT_SETTINGS }, books: [], stats: { daily: {} } };
// { book, paras, page, total, totalCols, cols, colW, lastCol, toc }
let current = null;
let timerId = null;
let searchState = { active: false, q: '', results: [], idx: 0 };

const persist = debounce(() => window.livre.saveStore(store), 500);
// Écriture immédiate (fermeture de fenêtre, sortie du lecteur) : garantit
// que la position de lecture n'est jamais perdue.
function flushStore() {
  try { window.livre.saveStore(store); } catch {}
}

function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD local
}
function bumpDaily(field, amount) {
  const k = todayKey();
  const day = store.stats.daily[k] || (store.stats.daily[k] = { seconds: 0, words: 0 });
  day[field] += amount;
}

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

function readerVisible() {
  return !$('#readerScreen').classList.contains('hidden');
}
function switchScreen(name) {
  $('#libraryScreen').classList.toggle('hidden', name !== 'library');
  $('#readerScreen').classList.toggle('hidden', name !== 'reader');
  updateFocusRuler();
}
// Interruption d'un chargement long : levée depuis les boucles
// d'extraction quand l'utilisateur clique sur « Interrompre »
let loadCancelled = false;
class CancelledError extends Error {
  constructor() { super('chargement interrompu'); this.name = 'CancelledError'; }
}
function throwIfCancelled() {
  if (loadCancelled) throw new CancelledError();
}

function showLoader(text, { progress = false, cancelable = false } = {}) {
  $('#loaderText').textContent = text;
  $('#loaderBar').classList.toggle('hidden', !progress);
  $('#loaderCancel').classList.toggle('hidden', !cancelable);
  if (progress) $('#loaderFill').style.width = '0%';
  $('#loader').classList.remove('hidden');
}
function setProgress(done, total, text) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  $('#loaderFill').style.width = pct + '%';
  if (text) $('#loaderText').textContent = `${text} · ${pct} %`;
}
function hideLoader() {
  $('#loader').classList.add('hidden');
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

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
