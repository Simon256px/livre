'use strict';

/* ═══════════ Annotations : surlignages, notes, signets ═══════════
   Un surlignage est ancré au texte : { id, para, start, end, color,
   note, text } — start/end sont des offsets dans le texte brut du
   paragraphe, donc stables quel que soit le rendu (bionic, etc.).   */

let editingAnnId = null;
let notesQuery = '';

/* ---------- Sélection → surlignage ---------- */

// Offset texte d'un point (node, off) dans un paragraphe rendu :
// Range.toString() reflète le texte brut, balises ignorées
function textOffsetIn(paraEl, node, off) {
  const r = document.createRange();
  r.selectNodeContents(paraEl);
  try { r.setEnd(node, off); } catch { return 0; }
  return r.toString().length;
}

function selectionRanges() {
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const content = $('#bookContent');
  if (!content.contains(range.commonAncestorContainer) &&
      range.commonAncestorContainer !== content) return null;
  const out = [];
  for (const el of content.children) {
    if (el.tagName !== 'P' || !range.intersectsNode(el)) continue;
    const i = Number(el.dataset.i);
    const len = current.paras[i].text.length;
    const start = el.contains(range.startContainer)
      ? textOffsetIn(el, range.startContainer, range.startOffset) : 0;
    const end = el.contains(range.endContainer)
      ? textOffsetIn(el, range.endContainer, range.endOffset) : len;
    if (end > start) out.push({ para: i, start, end });
  }
  return out.length ? out : null;
}

function onTextSelected() {
  if (!current || !readerVisible()) return;
  if (dictVisible()) return; // double-clic → dictionnaire, pas surlignage
  const sel = getSelection();
  if (!sel.rangeCount || sel.isCollapsed) { hideHlToolbar(); return; }
  if (!selectionRanges()) { hideHlToolbar(); return; }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  const tb = $('#hlToolbar');
  tb.classList.remove('hidden');
  const x = Math.max(10, Math.min(window.innerWidth - 180, rect.left + rect.width / 2 - 80));
  const y = rect.top > 60 ? rect.top - 52 : rect.bottom + 10;
  tb.style.left = x + 'px';
  tb.style.top = y + 'px';
}

function hideHlToolbar() {
  $('#hlToolbar').classList.add('hidden');
}

function applyHighlight(color) {
  const ranges = selectionRanges();
  if (!ranges) return;
  for (const r of ranges) {
    current.book.annotations.push({
      id: crypto.randomUUID(),
      para: r.para,
      start: r.start,
      end: r.end,
      color,
      note: '',
      text: current.paras[r.para].text.slice(r.start, r.end),
      created: Date.now(),
    });
  }
  getSelection().removeAllRanges();
  hideHlToolbar();
  persist();
  relayout();
  renderNotesDrawer();
}

/* ---------- Popover d'édition ---------- */

function showAnnPopover(annId, x, y) {
  const a = current.book.annotations.find((an) => an.id === annId);
  if (!a) return;
  editingAnnId = annId;
  const pop = $('#annPopover');
  pop.classList.remove('hidden');
  pop.style.left = Math.max(10, Math.min(window.innerWidth - 280, x - 130)) + 'px';
  pop.style.top = Math.min(window.innerHeight - 180, y + 14) + 'px';
  $('#annNote').value = a.note || '';
  $('#annNote').focus();
}

function hideAnnPopover(save = true) {
  const pop = $('#annPopover');
  if (pop.classList.contains('hidden')) return;
  if (save && editingAnnId) {
    const a = current?.book.annotations.find((an) => an.id === editingAnnId);
    if (a) {
      const note = $('#annNote').value.trim();
      if (note !== (a.note || '')) {
        a.note = note;
        persist();
        relayout();
        renderNotesDrawer();
      }
    }
  }
  editingAnnId = null;
  pop.classList.add('hidden');
}

function recolorAnnotation(color) {
  const a = current?.book.annotations.find((an) => an.id === editingAnnId);
  if (!a) return;
  a.color = color;
  persist();
  relayout();
  renderNotesDrawer();
}

function deleteAnnotation(id) {
  current.book.annotations = current.book.annotations.filter((a) => a.id !== id);
  persist();
  relayout();
  renderNotesDrawer();
}

/* ---------- Signets ---------- */

function toggleBookmark() {
  const b = current.book;
  const anchor = b.anchor ?? 0;
  const existing = b.bookmarks.find((bm) => bm.para === anchor);
  if (existing) {
    b.bookmarks = b.bookmarks.filter((bm) => bm.id !== existing.id);
    toast('Signet retiré');
  } else {
    const para = current.paras[anchor];
    b.bookmarks.push({
      id: crypto.randomUUID(),
      para: anchor,
      label: snippet(para?.text || 'Image', 60),
      created: Date.now(),
    });
    toast('Signet posé 🔖');
  }
  persist();
  renderNotesDrawer();
}

/* ---------- Panneau notes & signets ---------- */

function chapterOf(paraIdx) {
  let name = '';
  for (const h of current.toc) {
    if (h.i <= paraIdx) name = h.text;
    else break;
  }
  return name;
}

function renderNotesDrawer() {
  if (!current) return;
  const b = current.book;
  const q = foldWithMap(notesQuery.trim()).out;
  const match = (s) => !q || foldWithMap(s).out.includes(q);

  const bms = [...b.bookmarks]
    .filter((bm) => match(bm.label))
    .sort((x, y) => x.para - y.para);
  $('#bookmarkList').innerHTML = b.bookmarks.length
    ? (bms.length
        ? bms.map((bm) =>
            `<li data-para="${bm.para}">🔖 ${esc(bm.label)}<button class="item-del" data-bm="${bm.id}" title="Supprimer">✕</button></li>`
          ).join('')
        : '<li class="list-empty">Aucun signet ne correspond.</li>')
    : '<li class="list-empty">Aucun signet — bouton 🔖 pour en poser un.</li>';

  const anns = [...b.annotations]
    .filter((a) => match(a.text + ' ' + (a.note || '')))
    .sort((x, y) => x.para - y.para || x.start - y.start);
  $('#annList').innerHTML = b.annotations.length
    ? (anns.length
        ? anns.map((a) =>
            `<li data-para="${a.para}" class="c-${a.color}">« ${esc(snippet(a.text, 90))} »` +
            (a.note ? `<span class="ann-note">📝 ${esc(snippet(a.note, 90))}</span>` : '') +
            `<button class="item-del" data-ann-del="${a.id}" title="Supprimer">✕</button></li>`
          ).join('')
        : '<li class="list-empty">Aucun surlignage ne correspond.</li>')
    : '<li class="list-empty">Sélectionne du texte pour surligner.</li>';

  const sketches = b.sketches || [];
  $('#sketchList').innerHTML = sketches.length
    ? sketches.map((s) =>
        `<li data-sk="${s.id}"><img src="${s.image}" alt=""><button class="item-del" data-sk-del="${s.id}" title="Supprimer">✕</button></li>`
      ).join('')
    : '<li class="list-empty">Bouton ✏️ pour dessiner sur la page.</li>';
  $$('#sketchList li[data-sk]').forEach((li) =>
    li.addEventListener('click', () => showSketch(li.dataset.sk)));
  $$('[data-sk-del]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSketch(btn.dataset.skDel);
  }));

  $$('#bookmarkList li[data-para], #annList li[data-para]').forEach((li) =>
    li.addEventListener('click', () => jumpToPara(Number(li.dataset.para))));
  $$('[data-bm]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    b.bookmarks = b.bookmarks.filter((bm) => bm.id !== btn.dataset.bm);
    persist();
    renderNotesDrawer();
  }));
  $$('[data-ann-del]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteAnnotation(btn.dataset.annDel);
  }));
}

/* ---------- Export Markdown ---------- */

async function exportAnnotations() {
  const b = current.book;
  if (!b.annotations.length && !b.bookmarks.length) {
    toast('Rien à exporter pour l’instant');
    return;
  }
  const lines = [
    `# Notes de lecture — ${b.title}`,
    '',
    `_Exporté depuis MontLivre le ${new Date().toLocaleDateString('fr-FR')}_`,
    '',
  ];
  if (b.bookmarks.length) {
    lines.push('## Signets', '');
    for (const bm of [...b.bookmarks].sort((x, y) => x.para - y.para)) {
      const ch = chapterOf(bm.para);
      lines.push(`- « ${bm.label} »${ch ? ` — _${ch}_` : ''}`);
    }
    lines.push('');
  }
  if (b.annotations.length) {
    lines.push('## Surlignages', '');
    let lastCh = null;
    for (const a of [...b.annotations].sort((x, y) => x.para - y.para || x.start - y.start)) {
      const ch = chapterOf(a.para);
      if (ch !== lastCh) {
        if (ch) lines.push(`### ${ch}`, '');
        lastCh = ch;
      }
      lines.push(`> ${a.text}`);
      if (a.note) lines.push('>', `> 📝 ${a.note}`);
      lines.push('');
    }
  }
  const safe = b.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 60);
  const path = await window.livre.exportFile({
    defaultName: `Notes - ${safe}.md`,
    content: lines.join('\n'),
  });
  if (path) toast(`Exporté : ${basename(path)}`);
}

/* ---------- Export PDF (PDF de notes mis en page) ---------- */

async function exportAnnotationsPdf() {
  const b = current.book;
  if (!b.annotations.length && !b.bookmarks.length) {
    toast('Rien à exporter pour l’instant');
    return;
  }
  const HL = { yellow: '#F2C53D', green: '#63C878', blue: '#3E7BD9', pink: '#F2BFD4' };
  let body = '';
  if (b.bookmarks.length) {
    body += '<h2>Signets</h2><ul class="bm">';
    for (const bm of [...b.bookmarks].sort((x, y) => x.para - y.para)) {
      const ch = chapterOf(bm.para);
      body += `<li>${esc(bm.label)}${ch ? ` <span class="ch">— ${esc(ch)}</span>` : ''}</li>`;
    }
    body += '</ul>';
  }
  if (b.annotations.length) {
    body += '<h2>Surlignages</h2>';
    let lastCh = null;
    for (const a of [...b.annotations].sort((x, y) => x.para - y.para || x.start - y.start)) {
      const ch = chapterOf(a.para);
      if (ch !== lastCh) { if (ch) body += `<h3>${esc(ch)}</h3>`; lastCh = ch; }
      body += `<blockquote style="border-color:${HL[a.color] || '#1D1A14'}">${esc(a.text)}` +
        (a.note ? `<span class="note">📝 ${esc(a.note)}</span>` : '') + '</blockquote>';
    }
  }
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><style>
    @page { margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1D1A14; line-height: 1.55; }
    header { border-bottom: 3px solid #1D1A14; padding-bottom: 10px; margin-bottom: 18px; }
    h1 { font-size: 24px; margin: 0; }
    .sub { font-size: 12px; color: #8A8172; margin-top: 4px; }
    h2 { font-size: 17px; margin: 22px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    h3 { font-size: 14px; margin: 16px 0 6px; color: #3E7BD9; }
    blockquote { margin: 0 0 12px; padding: 6px 12px; border-left: 6px solid #1D1A14;
      background: #FBF5E6; break-inside: avoid; }
    .note { display: block; margin-top: 6px; font-style: italic; color: #555; }
    ul.bm { padding-left: 18px; } ul.bm li { margin-bottom: 4px; }
    .ch { color: #8A8172; font-style: italic; }
  </style></head><body>
    <header><h1>${esc(b.title)}</h1>
      <div class="sub">Notes de lecture${b.author ? ` · ${esc(b.author)}` : ''} · exporté depuis MontLivre le ${new Date().toLocaleDateString('fr-FR')}</div>
    </header>${body}</body></html>`;
  const safe = b.title.replace(/[<>:"/\\|?*]/g, '').slice(0, 60);
  const path = await window.livre.exportPdf({ defaultName: `Notes - ${safe}.pdf`, html });
  if (path) toast(`Exporté : ${basename(path)}`);
}
