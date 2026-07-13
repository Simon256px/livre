'use strict';

/* ═══════════ Annotations : surlignages, notes, signets ═══════════
   Un surlignage est ancré au texte : { id, para, start, end, color,
   note, text } — start/end sont des offsets dans le texte brut du
   paragraphe, donc stables quel que soit le rendu (bionic, etc.).   */

let editingAnnId = null;

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

  const bms = [...b.bookmarks].sort((x, y) => x.para - y.para);
  $('#bookmarkList').innerHTML = bms.length
    ? bms.map((bm) =>
        `<li data-para="${bm.para}">🔖 ${esc(bm.label)}<button class="item-del" data-bm="${bm.id}" title="Supprimer">✕</button></li>`
      ).join('')
    : '<li class="list-empty">Aucun signet — bouton 🔖 pour en poser un.</li>';

  const anns = [...b.annotations].sort((x, y) => x.para - y.para || x.start - y.start);
  $('#annList').innerHTML = anns.length
    ? anns.map((a) =>
        `<li data-para="${a.para}" class="c-${a.color}">« ${esc(snippet(a.text, 90))} »` +
        (a.note ? `<span class="ann-note">📝 ${esc(snippet(a.note, 90))}</span>` : '') +
        `<button class="item-del" data-ann-del="${a.id}" title="Supprimer">✕</button></li>`
      ).join('')
    : '<li class="list-empty">Sélectionne du texte pour surligner.</li>';

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
    `_Exporté depuis Livre le ${new Date().toLocaleDateString('fr-FR')}_`,
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
