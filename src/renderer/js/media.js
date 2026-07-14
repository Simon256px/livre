'use strict';

/* ═══════════ Lecture rapide (RSVP) ═══════════
   Affiche le texte un mot à la fois, avec un point de fixation. En
   pause, un aperçu lisible du passage permet de choisir visuellement
   où (re)commencer : chaque mot est cliquable, le mot courant est mis
   en évidence, et la barre porte des repères de chapitres.          */

const rsvp = { words: [], idx: 0, playing: false, timer: null };

function firstTextPara(from) {
  for (let i = from; i < current.paras.length; i++) {
    if (current.paras[i].type !== 'img') return i;
  }
  return 0;
}

function rsvpOpen() {
  if (!current) return;
  // Tout le livre est indexé (mot → paragraphe) pour permettre de
  // remonter librement ; on démarre au paragraphe de lecture courant.
  rsvp.words = [];
  for (let i = 0; i < current.paras.length; i++) {
    const p = current.paras[i];
    if (p.type === 'img') continue;
    for (const w of p.text.split(/\s+/)) {
      if (w) rsvp.words.push({ w, para: i });
    }
  }
  if (!rsvp.words.length) { toast('Rien à lire ici'); return; }
  const startPara = firstTextPara(current.book.anchor ?? 0);
  rsvp.idx = Math.max(0, rsvp.words.findIndex((x) => x.para >= startPara));
  $('#rsvpWpm').value = store.settings.rsvpWpm;
  $('#rsvpWpmVal').textContent = store.settings.rsvpWpm + ' mots/min';
  rsvpBuildTicks();
  $('#rsvpOverlay').classList.remove('hidden');
  // On ouvre en pause : l'utilisateur choisit son point de reprise
  // dans l'aperçu, puis appuie sur Lire / espace.
  rsvpSetPlaying(false);
  rsvpShow();
}

// Repères de chapitres le long de la barre de progression
function rsvpBuildTicks() {
  const firstWordOfPara = {};
  rsvp.words.forEach((wd, i) => {
    if (firstWordOfPara[wd.para] === undefined) firstWordOfPara[wd.para] = i;
  });
  const total = rsvp.words.length;
  const ticks = (current.toc || [])
    .filter((h) => firstWordOfPara[h.i] !== undefined)
    .map((h) => ({ frac: firstWordOfPara[h.i] / Math.max(1, total - 1), text: h.text }));
  $('#rsvpTicks').innerHTML = ticks.map((t) =>
    `<span class="tick" style="left:${(t.frac * 100).toFixed(2)}%" title="${esc(t.text)}"></span>`
  ).join('');
}

function rsvpShow() {
  const total = rsvp.words.length;
  const { w, para } = rsvp.words[rsvp.idx];

  // Mot courant, découpé autour du point de fixation optimal (ORP)
  const letters = [...w];
  const orp = Math.min(letters.length - 1, Math.max(0, Math.round((letters.length - 1) * 0.35)));
  const wordEl = $('#rsvpWord');
  wordEl.innerHTML =
    esc(letters.slice(0, orp).join('')) +
    `<span class="orp">${esc(letters[orp])}</span>` +
    esc(letters.slice(orp + 1).join(''));
  wordEl.classList.remove('flip');
  void wordEl.offsetWidth;
  wordEl.classList.add('flip');

  $('#rsvpChapter').textContent = (typeof chapterOf === 'function' && chapterOf(para)) || '';

  // Fil d'ariane estompé (visible en lecture)
  const before = rsvp.words.slice(Math.max(0, rsvp.idx - 6), rsvp.idx);
  const after = rsvp.words.slice(rsvp.idx + 1, rsvp.idx + 7);
  const chip = (word, i, cls) => `<span class="w ${cls}" data-i="${i}">${esc(word.w)}</span>`;
  $('#rsvpContext').innerHTML =
    before.map((x, k) => chip(x, rsvp.idx - before.length + k, 'read')).join('') +
    after.map((x, k) => chip(x, rsvp.idx + 1 + k, 'ahead')).join('');

  // Aperçu lisible (visible en pause) : on ne le recalcule qu'à l'arrêt
  if (!rsvp.playing) rsvpRenderPreview();

  const frac = total > 1 ? rsvp.idx / (total - 1) : 1;
  $('#rsvpFill').style.width = (frac * 100) + '%';
  $('#rsvpKnob').style.left = (frac * 100) + '%';
  const pctRead = Math.round(((rsvp.idx + 1) / total) * 100);
  $('#rsvpProgress').textContent =
    `${(rsvp.idx + 1).toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')} mots · ${pctRead} % lu`;
}

// Passage lisible autour du mot courant : mot en évidence, tout cliquable
function rsvpRenderPreview() {
  const from = Math.max(0, rsvp.idx - 45);
  const to = Math.min(rsvp.words.length, rsvp.idx + 45);
  let html = '';
  let lastPara = null;
  for (let i = from; i < to; i++) {
    const wd = rsvp.words[i];
    if (lastPara !== null && wd.para !== lastPara) html += '<span class="pbreak"></span>';
    lastPara = wd.para;
    const cls = i === rsvp.idx ? 'now' : (i < rsvp.idx ? 'read' : 'ahead');
    html += `<span class="w ${cls}" data-i="${i}">${esc(wd.w)}</span> `;
  }
  const prev = $('#rsvpPreview');
  prev.innerHTML = html;
  const now = $('.now', prev);
  if (now) now.scrollIntoView({ block: 'center' });
}

// Reprendre à un mot précis (clic sur l'aperçu, le contexte, ou les flèches)
function rsvpGoto(idx) {
  rsvp.idx = Math.max(0, Math.min(rsvp.words.length - 1, idx));
  rsvpShow();
}
function rsvpStep(delta) {
  rsvpSetPlaying(false);
  rsvpGoto(rsvp.idx + delta);
}
// Clic sur la barre : reprise proportionnelle
function rsvpSeek(fraction) {
  rsvpSetPlaying(false);
  rsvpGoto(Math.round(fraction * (rsvp.words.length - 1)));
}

function rsvpTick() {
  if (!rsvp.playing) return;
  if (rsvp.idx >= rsvp.words.length - 1) { rsvpSetPlaying(false); return; }
  rsvp.idx++;
  rsvpShow();
  const { w } = rsvp.words[rsvp.idx];
  let delay = 60000 / store.settings.rsvpWpm;
  if (/[.!?…]$/.test(w)) delay *= 2;
  else if (/[,;:»)]$/.test(w)) delay *= 1.5;
  else if (w.length > 9) delay *= 1.3;
  rsvp.timer = setTimeout(rsvpTick, delay);
}

function rsvpSetPlaying(on) {
  rsvp.playing = on;
  clearTimeout(rsvp.timer);
  $('#rsvpPlay').textContent = on ? '⏸ Pause' : '▶ Lire';
  $('#rsvpOverlay').classList.toggle('playing', on);
  if (on) rsvp.timer = setTimeout(rsvpTick, 60000 / store.settings.rsvpWpm);
  else rsvpRenderPreview(); // rafraîchit l'aperçu au moment où l'on s'arrête
}

function rsvpClose() {
  if ($('#rsvpOverlay').classList.contains('hidden')) return;
  rsvpSetPlaying(false);
  $('#rsvpOverlay').classList.add('hidden');
  // reprend la lecture classique là où le RSVP s'est arrêté
  const para = rsvp.words[rsvp.idx]?.para;
  if (para != null && current) {
    current.book.anchor = para;
    persist();
    if (store.settings.flow === 'scroll') jumpToPara(para);
    else goTo(pageOfAnchor(para));
  }
}

function rsvpVisible() {
  return !$('#rsvpOverlay').classList.contains('hidden');
}
