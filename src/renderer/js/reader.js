'use strict';

/* ═══════════ Lecteur : rendu, pagination, navigation ═══════════ */

async function openBook(id) {
  const book = store.books.find((b) => b.id === id);
  if (!book) return;
  loadCancelled = false;
  showLoader('Lecture du fichier…', { progress: true, cancelable: true });
  try {
    const { paras, words } = await getContent(book);
    if (!paras.length || words < 8) {
      hideLoader();
      alert("Aucun texte à afficher pour ce livre.\nS'il s'agit d'un scan, rouvre-le pour lancer la reconnaissance de texte (OCR).");
      return;
    }
    book.words = words;
    book.lastOpenedAt = Date.now();
    persist();
    current = { book, paras, page: 0, total: 1, totalCols: 1, cols: 1, colW: 0, lastCol: null, toc: [] };
    searchState = { active: false, q: '', results: [], idx: 0 };
    $('#readerTitle').textContent = book.title;
    $('#runningHead').textContent = book.author ? `${book.title} — ${book.author}` : book.title;
    await document.fonts.ready;
    switchScreen('reader');
    const resuming = book.progress > 0 && book.progress < 1;
    renderContent();
    paginate();
    restorePosition();
    buildToc();
    startTimer();
    if (resuming) {
      const where = store.settings.flow === 'scroll'
        ? `${Math.round(book.progress * 100)} %`
        : `la page ${current.page + 1}`;
      toast(`Repris à ${where}`);
    }
    console.log(`[livre] ouvert : ${book.title} — ${paras.length} blocs, ${words} mots`);
  } catch (e) {
    if (e instanceof CancelledError) {
      switchScreen('library');
      toast('Chargement interrompu');
    } else {
      console.error(e);
      alert(`Impossible de lire ce livre : ${e.message || e}`);
      switchScreen('library');
    }
  }
  hideLoader();
}

function closeReader() {
  stopTimer();
  pomodoroStop();
  closeSearch(false);
  current = null;
  $$('.drawer').forEach((d) => d.classList.remove('open'));
  hideHlToolbar();
  hideAnnPopover();
  hideDictPopover();
  flushStore();
  switchScreen('library');
  renderLibrary();
}

/* ---------- Rendu du contenu ---------- */

function renderParaHTML(p, idx) {
  const s = store.settings;
  const text = p.text;
  const ranges = [];
  for (const a of current.book.annotations) {
    if (a.para === idx) ranges.push({ start: a.start, end: a.end, type: 'ann', id: a.id, color: a.color, note: a.note });
  }
  if (searchState.active) {
    for (let k = 0; k < searchState.results.length; k++) {
      const r = searchState.results[k];
      if (r.para === idx) ranges.push({ start: r.start, end: r.end, type: 'hit', id: k });
    }
  }
  if (!ranges.length) return s.bionic ? bionify(text, s.bionicIntensity) : esc(text);

  const cuts = new Set([0, text.length]);
  for (const r of ranges) {
    cuts.add(Math.max(0, Math.min(text.length, r.start)));
    cuts.add(Math.max(0, Math.min(text.length, r.end)));
  }
  const pts = [...cuts].sort((a, b) => a - b);
  let html = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (a === b) continue;
    let seg = s.bionic ? bionify(text.slice(a, b), s.bionicIntensity) : esc(text.slice(a, b));
    for (const r of ranges) {
      if (r.start <= a && r.end >= b) {
        seg = r.type === 'ann'
          ? `<mark class="hl hl-${r.color}${r.note ? ' has-note' : ''}" data-ann="${r.id}">${seg}</mark>`
          : `<mark class="hit" data-hit="${r.id}">${seg}</mark>`;
      }
    }
    html += seg;
  }
  return html;
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
    if (p.type === 'img') return `<figure data-i="${i}"><img src="${p.src}" alt=""></figure>`;
    return `<p data-i="${i}">${renderParaHTML(p, i)}</p>`;
  }).join('');
  applyPageAnimStyle();
}

/* ---------- Pagination (pages / double page / défilement) ---------- */

function paginate() {
  const s = store.settings;
  const vp = $('#bookViewport');
  const c = $('#bookContent');
  const frame = $('#pageFrame');
  const scroll = s.flow === 'scroll';

  vp.classList.toggle('scroll', scroll);
  const avail = window.innerWidth - 300;

  if (scroll) {
    frame.classList.remove('cols2');
    current.cols = 1;
    current.colW = Math.max(320, Math.min(s.pageWidth, avail));
    vp.style.width = current.colW + 'px';
    c.style.transform = 'none';
    c.style.columnWidth = '';
    c.style.columnGap = '';
    c.style.height = '';
    c.style.width = '100%';
    current.total = 1;
    current.totalCols = 1;
    return;
  }

  let cols = s.spread === '2' ? 2 : s.spread === '1' ? 1 : (avail > 1150 ? 2 : 1);
  let colW = cols === 2 ? Math.min(s.pageWidth, (avail - GAP) / 2) : Math.min(s.pageWidth, avail);
  colW = Math.max(320, colW);
  if (cols === 2 && colW * 2 + GAP > avail) {
    cols = 1;
    colW = Math.max(320, Math.min(s.pageWidth, avail));
  }
  current.cols = cols;
  current.colW = colW;
  frame.classList.toggle('cols2', cols === 2);

  vp.style.width = colW * cols + GAP * (cols - 1) + 'px';
  c.style.transform = 'none'; // mesure sans translation
  c.style.width = colW + 'px';
  c.style.columnWidth = colW + 'px';
  c.style.columnGap = GAP + 'px';
  c.style.height = vp.clientHeight + 'px';
  current.totalCols = Math.max(1, Math.round((vp.scrollWidth + GAP) / (colW + GAP)));
  current.total = Math.max(1, Math.ceil(current.totalCols / cols));
}

// Colonne d'un élément : offsetLeft est relatif à #bookViewport
// (position:relative) et ignore la translation courante
function colOf(el) {
  return Math.round(el.offsetLeft / (current.colW + GAP));
}

function goTo(page, save = true) {
  if (!current) return;
  if (store.settings.flow === 'scroll') { scrollBy(page); return; }
  const p = Math.max(0, Math.min(page, current.total - 1));
  current.page = p;
  $('#bookContent').style.transform =
    `translateX(${-p * current.cols * (current.colW + GAP)}px)`;
  updateFoot();
  const col = p * current.cols;
  if (save) {
    if (current.lastCol != null && col > current.lastCol) {
      const wpc = (current.book.words || 0) / Math.max(1, current.totalCols);
      bumpDaily('words', Math.round((col - current.lastCol) * wpc));
    }
    current.book.progress = current.total > 1 ? (p + 1) / current.total : 1;
    current.book.anchor = anchorAt(p);
    persist();
  }
  current.lastCol = col;
  tocHighlight();
}

// Navigation utilisateur (boutons, molette, flèches) : son + animation
function turnPage(delta) {
  if (!current) return;
  const before = current.page;
  goTo(current.page + delta);
  if (store.settings.flow === 'pages' && current.page !== before) {
    playPageSound();
    triggerPageTurn(delta);
  }
}

// Applique la transition selon le réglage d'animation
function applyPageAnimStyle() {
  const c = $('#bookContent');
  if (c) c.style.transition = store.settings.pageAnim === 'none' ? 'none' : 'transform .26s ease';
}

// Balayage « page tournée » dans le sens de la navigation
function triggerPageTurn(delta) {
  if (store.settings.pageAnim !== 'curl' || store.settings.flow === 'scroll') return;
  const el = $('#pageTurn');
  if (!el) return;
  el.classList.remove('next', 'prev');
  void el.offsetWidth; // redémarre l'animation
  el.classList.add(delta > 0 ? 'next' : 'prev');
}

// En mode défilement, les boutons/flèches font défiler d'un écran
function scrollBy(page) {
  const vp = $('#bookViewport');
  const dir = page >= current.page ? 1 : -1;
  vp.scrollTop += dir * vp.clientHeight * 0.9;
}

function onScrolled() {
  if (!current || store.settings.flow !== 'scroll') return;
  const vp = $('#bookViewport');
  const max = vp.scrollHeight - vp.clientHeight;
  const prog = max > 0 ? vp.scrollTop / max : 1;
  if (current.lastProg != null && prog > current.lastProg) {
    bumpDaily('words', Math.round((prog - current.lastProg) * (current.book.words || 0)));
  }
  current.lastProg = prog;
  current.book.progress = prog;
  for (const el of $('#bookContent').children) {
    if (el.offsetTop + el.offsetHeight >= vp.scrollTop) {
      current.book.anchor = Number(el.dataset.i);
      break;
    }
  }
  persist();
  updateFoot();
  tocHighlight();
}

// Premier bloc qui démarre sur la page p : point d'ancrage stable
// quand la mise en page change (police, taille, colonnes…)
function anchorAt(p) {
  const target = p * current.cols * (current.colW + GAP);
  for (const el of $('#bookContent').children) {
    if (el.offsetLeft >= target - 4) return Number(el.dataset.i);
  }
  return null;
}

function pageOfAnchor(anchor) {
  const el = $(`#bookContent [data-i="${anchor}"]`);
  return el ? Math.floor(colOf(el) / current.cols) : 0;
}

function restorePosition() {
  const b = current.book;
  if (store.settings.flow === 'scroll') {
    const vp = $('#bookViewport');
    const el = b.anchor != null ? $(`#bookContent [data-i="${b.anchor}"]`) : null;
    vp.scrollTop = el ? Math.max(0, el.offsetTop - 16) : (b.progress || 0) * (vp.scrollHeight - vp.clientHeight);
    current.lastProg = null;
    onScrolled();
    return;
  }
  let p = 0;
  if (b.anchor != null) p = pageOfAnchor(b.anchor);
  else if (b.progress) p = Math.round(b.progress * current.total) - 1;
  goTo(p, false);
  updateFoot();
}

// Après un changement de réglages qui refait la mise en page
function relayout() {
  if (!current || !readerVisible()) return;
  const anchor = current.book.anchor;
  renderContent();
  paginate();
  if (store.settings.flow === 'scroll') {
    restorePosition();
  } else if (anchor != null) {
    goTo(pageOfAnchor(anchor), false);
  } else {
    restorePosition();
  }
}

function updateFoot() {
  const { book } = current;
  let pct;
  if (store.settings.flow === 'scroll') {
    pct = Math.round((book.progress || 0) * 100);
    $('#pageInfo').textContent = 'défilement';
  } else {
    const { page, total, totalCols, cols } = current;
    const first = page * cols + 1;
    const last = Math.min(totalCols, (page + 1) * cols);
    pct = Math.round((last / totalCols) * 100);
    $('#pageInfo').textContent = cols === 2 && last > first
      ? `p. ${first}–${last} / ${totalCols}`
      : `p. ${first} / ${totalCols}`;
  }
  $('#readFill').style.width = pct + '%';
  const remainingWords = (book.words || 0) * (1 - pct / 100);
  const mins = Math.ceil(remainingWords / 220);
  $('#timeLeft').textContent = mins > 0 ? `≈ ${fmtDur(mins)} restant` : 'terminé ✦';
}

/* ---------- Sommaire ---------- */

function buildToc() {
  current.toc = current.paras
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.type === 'h')
    .map(({ p, i }) => ({ i, text: p.text }));
  const list = $('#tocList');
  if (!current.toc.length) {
    list.innerHTML = '<li class="toc-empty">Aucun chapitre détecté dans ce livre.</li>';
    return;
  }
  list.innerHTML = current.toc.map((h) =>
    `<li data-i="${h.i}">${esc(snippet(h.text, 70))}</li>`).join('');
  $$('li[data-i]', list).forEach((li) => li.addEventListener('click', () => {
    jumpToPara(Number(li.dataset.i));
    $('#tocDrawer').classList.remove('open');
  }));
  tocHighlight();
}

function jumpToPara(i) {
  if (store.settings.flow === 'scroll') {
    const el = $(`#bookContent [data-i="${i}"]`);
    if (el) $('#bookViewport').scrollTop = Math.max(0, el.offsetTop - 16);
  } else {
    goTo(pageOfAnchor(i));
  }
}

function tocHighlight() {
  if (!current || !current.toc.length) return;
  const anchor = current.book.anchor ?? 0;
  let active = null;
  for (const h of current.toc) {
    if (h.i <= anchor) active = h.i;
    else break;
  }
  $$('#tocList li[data-i]').forEach((li) =>
    li.classList.toggle('active', Number(li.dataset.i) === active));
}

/* ---------- Recherche plein texte ---------- */

function openSearch() {
  $('#searchBar').classList.remove('hidden');
  $('#searchInput').focus();
  $('#searchInput').select();
}

function doSearch(q) {
  q = q.trim();
  if (!q) { closeSearch(); return; }
  const { out: fq } = foldWithMap(q);
  const results = [];
  for (let i = 0; i < current.paras.length && results.length < 400; i++) {
    const p = current.paras[i];
    if (p.type === 'img') continue;
    const { out, map } = foldWithMap(p.text);
    let pos = 0;
    while ((pos = out.indexOf(fq, pos)) !== -1 && results.length < 400) {
      results.push({ para: i, start: map[pos], end: map[pos + fq.length - 1] + 1 });
      pos += fq.length;
    }
  }
  searchState = { active: true, q, results, idx: 0 };
  renderContent();
  paginate();
  if (results.length) jumpToHit(0);
  else {
    restorePosition();
    $('#searchCount').textContent = '0 résultat';
  }
}

function jumpToHit(k) {
  const n = searchState.results.length;
  if (!n) return;
  searchState.idx = ((k % n) + n) % n;
  $$('#bookContent mark.hit.current').forEach((m) => m.classList.remove('current'));
  const el = $(`#bookContent mark[data-hit="${searchState.idx}"]`);
  if (el) {
    el.classList.add('current');
    if (store.settings.flow === 'scroll') {
      el.scrollIntoView({ block: 'center' });
      onScrolled();
    } else {
      goTo(Math.floor(colOf(el) / current.cols));
    }
  }
  $('#searchCount').textContent = `${searchState.idx + 1} / ${n}`;
}

function closeSearch(relayoutAfter = true) {
  const wasActive = searchState.active;
  searchState = { active: false, q: '', results: [], idx: 0 };
  $('#searchBar').classList.add('hidden');
  $('#searchCount').textContent = '';
  $('#searchInput').value = '';
  if (wasActive && relayoutAfter && current && readerVisible()) relayout();
}

/* ---------- Plein écran & focus ---------- */

async function toggleFullscreen() {
  await window.livre.toggleFullscreen();
}

function onFullscreenChanged(on) {
  document.body.classList.toggle('fullscreen', on);
  document.body.classList.remove('peek');
  if (current && readerVisible()) relayout();
}

function updateFocusRuler() {
  const on = store.settings.focus && readerVisible();
  $('#focusRuler').style.display = on ? 'block' : 'none';
}

/* ---------- Minuteur de lecture ---------- */

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    if (document.hasFocus() && readerVisible() && current) {
      current.book.readingSeconds = (current.book.readingSeconds || 0) + 10;
      bumpDaily('seconds', 10);
      persist();
    }
  }, 10000);
}
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}
