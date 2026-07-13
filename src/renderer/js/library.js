'use strict';

/* ═══════════ Bibliothèque & statistiques ═══════════ */

let libraryQuery = '';

// Renvoie les ids des livres correspondant aux chemins (ajoutés ou déjà présents)
async function addBooks(paths) {
  const ids = [];
  for (const p of paths) {
    const existing = store.books.find((b) => b.path === p);
    if (existing) { ids.push(existing.id); continue; }
    showLoader(`Ouverture de ${basename(p)}…`);
    try {
      const format = /\.epub$/i.test(p) ? 'epub' : 'pdf';
      const buf = await window.livre.readFile(p);
      let title = basename(p).replace(/\.(pdf|epub)$/i, '');
      let author = '';
      let cover = null;
      let pages = 0;
      if (format === 'epub') {
        const { zip, opf, opfDir } = await epubOpen(buf);
        const meta = await epubMeta(zip, opf, opfDir);
        title = meta.title || title;
        author = meta.author || '';
        cover = meta.cover;
        pages = opf.getElementsByTagNameNS('*', 'itemref').length;
      } else {
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf), ...PDF_OPTS }).promise;
        const meta = await pdf.getMetadata().catch(() => null);
        title = String(meta?.info?.Title || '').trim() || title;
        author = String(meta?.info?.Author || '').trim();
        cover = await renderCover(pdf);
        pages = pdf.numPages;
        pdf.destroy();
      }
      const id = crypto.randomUUID();
      ids.push(id);
      store.books.push({
        id,
        path: p,
        format,
        title,
        author,
        pages,
        cover,
        words: null,
        progress: 0,
        anchor: null,
        readingSeconds: 0,
        annotations: [],
        bookmarks: [],
        addedAt: Date.now(),
        lastOpenedAt: 0,
      });
    } catch (e) {
      console.error(e);
      alert(`Impossible d'ouvrir « ${basename(p)} » : ${e.message || e}`);
    }
  }
  hideLoader();
  persist();
  renderLibrary();
  return ids;
}

function removeBook(id) {
  const book = store.books.find((b) => b.id === id);
  if (!book) return;
  if (!confirm(`Retirer « ${book.title} » de la bibliothèque ?\n(Le fichier n'est pas supprimé.)`)) return;
  store.books = store.books.filter((b) => b.id !== id);
  window.livre.deleteCache(id);
  persist();
  renderLibrary();
}

function renderLibrary() {
  renderStatsPanel();
  const grid = $('#bookGrid');
  const fold = (s) => foldWithMap(s).out;
  const q = fold(libraryQuery.trim());
  let books = [...store.books].sort(
    (a, b) => (b.lastOpenedAt || b.addedAt) - (a.lastOpenedAt || a.addedAt)
  );
  if (q) books = books.filter((b) => fold(b.title + ' ' + (b.author || '')).includes(q));

  $('#emptyState').classList.toggle('hidden', store.books.length > 0);

  const totalSec = store.books.reduce((n, b) => n + (b.readingSeconds || 0), 0);
  $('#libStats').textContent = store.books.length
    ? (q
        ? `${books.length} résultat${books.length > 1 ? 's' : ''} pour « ${libraryQuery.trim()} »`
        : `${store.books.length} livre${store.books.length > 1 ? 's' : ''} · ${fmtTime(totalSec)} de lecture au total`)
    : 'Ta bibliothèque est vide';

  grid.innerHTML = books.map((b, i) => {
    const accent = ACCENTS[i % ACCENTS.length];
    const pct = Math.round((b.progress || 0) * 100);
    const cover = b.cover
      ? `<img src="${b.cover}" alt="">`
      : `<span class="letter">${esc((b.title[0] || '?').toUpperCase())}</span>`;
    const unit = b.format === 'epub' ? 'sections' : 'pages';
    return `<article class="book-card" data-id="${b.id}">
      <div class="cover" style="background:${b.cover ? 'var(--bg)' : accent}">${cover}<span class="format">${b.format}</span></div>
      <button class="del" title="Retirer de la bibliothèque">✕</button>
      <h3>${esc(b.title)}</h3>
      <p class="meta">${b.pages} ${unit} · ${fmtTime(b.readingSeconds)}${pct ? ` · ${pct} %` : ''}</p>
      <div class="progress"><div class="fill" style="width:${pct}%"></div></div>
    </article>`;
  }).join('');

  $$('.book-card', grid).forEach((card) => {
    card.addEventListener('click', () => openBook(card.dataset.id));
    $('.del', card).addEventListener('click', (e) => {
      e.stopPropagation();
      removeBook(card.dataset.id);
    });
  });
}

/* ---------- Statistiques quotidiennes ---------- */

function currentStreak() {
  const daily = store.stats.daily;
  let streak = 0;
  let offset = daily[todayKey()]?.seconds > 0 ? 0 : -1;
  while (daily[todayKey(offset)]?.seconds > 0) {
    streak++;
    offset--;
  }
  return streak;
}

function renderStatsPanel() {
  const daily = store.stats.daily;
  const today = daily[todayKey()] || { seconds: 0, words: 0 };
  $('#statToday').textContent = fmtTime(today.seconds);
  $('#statStreak').textContent = currentStreak() + ' j';

  // vitesse moyenne sur les 30 derniers jours
  let secs = 0, words = 0;
  for (let o = 0; o > -30; o--) {
    const d = daily[todayKey(o)];
    if (d) { secs += d.seconds; words += d.words; }
  }
  $('#statWpm').textContent = secs >= 120 && words > 0 ? String(Math.round(words / (secs / 60))) : '—';

  // mini graphique des 14 derniers jours
  const chart = $('#statChart');
  const days = [];
  for (let o = -13; o <= 0; o++) days.push(daily[todayKey(o)]?.seconds || 0);
  const max = Math.max(600, ...days); // échelle mini : 10 min
  chart.innerHTML = days.map((sec, i) => {
    const h = Math.max(3, Math.round((sec / max) * 40));
    const cls = sec === 0 ? 'empty' : (i === 13 ? 'today' : '');
    const label = `${todayKey(i - 13)} — ${fmtTime(sec)}`;
    return `<div class="bar ${cls}" style="height:${h}px" title="${label}"></div>`;
  }).join('');
}
