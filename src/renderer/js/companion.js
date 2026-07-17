'use strict';

/* ═══════════ Lecture parallèle : volet compagnon ═══════════
   Un second livre s'ouvre dans un volet à droite du livre principal,
   en défilement continu et lecture seule : une œuvre et son analyse,
   une VO et sa traduction… Le livre principal garde toutes ses
   fonctions ; le volet mémorise sa propre position.                  */

let companion = null; // { book, paras }

function companionOpenState() {
  return !$('#companionPane').classList.contains('hidden');
}

function toggleCompanionPicker() {
  const picker = $('#companionPicker');
  if (!picker.classList.contains('hidden')) { picker.classList.add('hidden'); return; }
  if (companionOpenState()) { closeCompanion(); return; }
  const others = store.books.filter((b) => b.id !== current.book.id);
  if (!others.length) { toast('Ajoute un second livre pour la lecture parallèle'); return; }
  picker.innerHTML =
    `<div class="drawer-head"><h2>⿻ Lire en parallèle</h2>` +
    `<button class="pill icon" id="companionPickerClose">✕</button></div>` +
    `<ul>` + others.map((b) =>
      `<li data-id="${b.id}">${esc(snippet(b.title, 60))}` +
      `<span class="mono">${b.format}</span></li>`).join('') + `</ul>`;
  picker.classList.remove('hidden');
  $('#companionPickerClose').addEventListener('click', () => picker.classList.add('hidden'));
  $$('li[data-id]', picker).forEach((li) => li.addEventListener('click', () => {
    picker.classList.add('hidden');
    openCompanion(li.dataset.id);
  }));
}

async function openCompanion(bookId) {
  const book = store.books.find((b) => b.id === bookId);
  if (!book) return;
  loadCancelled = false;
  showLoader('Ouverture du second livre…', { progress: true, cancelable: true });
  try {
    const { paras, words } = await getContent(book);
    if (!paras.length || words < 8) {
      hideLoader();
      toast('Ce livre ne contient pas de texte lisible');
      return;
    }
    companion = { book, paras };
    $('#companionTitle').textContent = book.title;
    const body = $('#companionBody');
    body.innerHTML = paras.map((p) => {
      if (p.type === 'h') return `<h2>${esc(p.text)}</h2>`;
      if (p.type === 'img') return `<figure><img src="${p.src}" alt=""></figure>`;
      return `<p>${esc(p.text)}</p>`;
    }).join('');
    $('#companionPane').classList.remove('hidden');
    $('#companionBtn').classList.add('on');
    // restaure la position propre au volet
    body.scrollTop = (book.companionPos || 0) * Math.max(1, body.scrollHeight - body.clientHeight);
    relayout(); // le livre principal se repagine dans l'espace restant
  } catch (e) {
    if (!(e instanceof CancelledError)) {
      console.error(e);
      toast('Impossible d’ouvrir ce livre en parallèle');
    }
  }
  hideLoader();
}

function closeCompanion() {
  if (!companionOpenState()) return;
  saveCompanionPos();
  companion = null;
  $('#companionPane').classList.add('hidden');
  $('#companionBody').innerHTML = '';
  $('#companionBtn').classList.remove('on');
  if (current && readerVisible()) relayout();
}

function saveCompanionPos() {
  if (!companion) return;
  const body = $('#companionBody');
  const max = body.scrollHeight - body.clientHeight;
  companion.book.companionPos = max > 0 ? body.scrollTop / max : 0;
  persist();
}
