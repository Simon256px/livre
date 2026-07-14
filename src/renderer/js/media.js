'use strict';

/* ═══════════ Lecture vocale (TTS) & lecture rapide (RSVP) ═══════════ */

/* ---------- TTS ---------- */

let ttsActive = false;
let ttsPara = -1;

function ttsVoices() {
  return speechSynthesis.getVoices();
}

function populateVoices() {
  const sel = $('#ttsVoice');
  const voices = ttsVoices();
  if (!voices.length) { sel.innerHTML = '<option value="">(aucune voix système)</option>'; return; }
  const sorted = [...voices].sort((a, b) =>
    (b.lang.startsWith('fr') ? 1 : 0) - (a.lang.startsWith('fr') ? 1 : 0));
  sel.innerHTML = sorted.map((v) =>
    `<option value="${esc(v.name)}">${esc(v.name)} (${v.lang})</option>`).join('');
  if (store.settings.ttsVoice && sorted.some((v) => v.name === store.settings.ttsVoice)) {
    sel.value = store.settings.ttsVoice;
  } else {
    store.settings.ttsVoice = sel.value;
  }
}

function ttsToggle() {
  if (ttsActive) { ttsStop(); return; }
  if (!current) return;
  if (!('speechSynthesis' in window) || !ttsVoices().length) {
    toast('Aucune voix de synthèse disponible');
    return;
  }
  ttsActive = true;
  $('#ttsBtn').classList.add('on');
  ttsSpeakFrom(firstTextPara(current.book.anchor ?? 0));
}

function firstTextPara(from) {
  for (let i = from; i < current.paras.length; i++) {
    if (current.paras[i].type !== 'img') return i;
  }
  return -1;
}

function ttsSpeakFrom(i) {
  if (!ttsActive || !current || i < 0 || i >= current.paras.length) { ttsStop(); return; }
  const p = current.paras[i];
  if (p.type === 'img') { ttsSpeakFrom(i + 1); return; }
  ttsPara = i;
  ttsMark(i);
  const u = new SpeechSynthesisUtterance(p.text);
  const voice = ttsVoices().find((v) => v.name === store.settings.ttsVoice);
  if (voice) u.voice = voice;
  u.rate = store.settings.ttsRate;
  u.onend = () => { if (ttsActive) ttsSpeakFrom(i + 1); };
  u.onerror = () => ttsStop();
  speechSynthesis.speak(u);
}

function ttsMark(i) {
  $$('#bookContent .speaking').forEach((el) => el.classList.remove('speaking'));
  const el = $(`#bookContent [data-i="${i}"]`);
  if (!el) return;
  el.classList.add('speaking');
  if (store.settings.flow === 'scroll') {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    onScrolled();
  } else {
    const page = Math.floor(colOf(el) / current.cols);
    if (page !== current.page) goTo(page);
  }
}

function ttsStop() {
  ttsActive = false;
  ttsPara = -1;
  try { speechSynthesis.cancel(); } catch {}
  $('#ttsBtn')?.classList.remove('on');
  $$('#bookContent .speaking').forEach((el) => el.classList.remove('speaking'));
}

/* ---------- RSVP ---------- */

const rsvp = { words: [], idx: 0, playing: false, timer: null };

function rsvpOpen() {
  if (!current) return;
  ttsStop();
  // Le flux complet du livre est indexé pour pouvoir revenir en
  // arrière ; on démarre au paragraphe de lecture courant.
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
  rsvp.playing = false;
  $('#rsvpWpm').value = store.settings.rsvpWpm;
  $('#rsvpWpmVal').textContent = store.settings.rsvpWpm + ' mots/min';
  $('#rsvpOverlay').classList.remove('hidden');
  rsvpShow();
  // On ouvre en pause : l'utilisateur choisit son point de reprise
  // (barre, mots du contexte, flèches), puis appuie sur Lire / espace.
  rsvpSetPlaying(false);
}

function rsvpShow() {
  const total = rsvp.words.length;
  const { w } = rsvp.words[rsvp.idx];
  const letters = [...w];
  const orp = Math.min(letters.length - 1, Math.max(0, Math.round((letters.length - 1) * 0.35)));
  const wordEl = $('#rsvpWord');
  wordEl.innerHTML =
    esc(letters.slice(0, orp).join('')) +
    `<span class="orp">${esc(letters[orp])}</span>` +
    esc(letters.slice(orp + 1).join(''));
  // relance l'animation de « page tournée »
  wordEl.classList.remove('flip');
  void wordEl.offsetWidth;
  wordEl.classList.add('flip');

  // Contexte : mots déjà lus qui s'estompent derrière + mots à venir
  const before = rsvp.words.slice(Math.max(0, rsvp.idx - 6), rsvp.idx);
  const after = rsvp.words.slice(rsvp.idx + 1, rsvp.idx + 7);
  const span = (word, i, cls) =>
    `<span class="w ${cls}" data-i="${i}">${esc(word.w)}</span>`;
  $('#rsvpContext').innerHTML =
    before.map((x, k) => span(x, rsvp.idx - before.length + k, 'read')).join('') +
    after.map((x, k) => span(x, rsvp.idx + 1 + k, 'ahead')).join('');

  const frac = total > 1 ? rsvp.idx / (total - 1) : 1;
  $('#rsvpFill').style.width = (frac * 100) + '%';
  $('#rsvpKnob').style.left = (frac * 100) + '%';
  const pctRead = Math.round(((rsvp.idx + 1) / total) * 100);
  $('#rsvpProgress').textContent =
    `${(rsvp.idx + 1).toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')} mots · ${pctRead} % lu`;
}

// Reprendre à un mot précis (contexte, flèches)
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
  if (on) rsvp.timer = setTimeout(rsvpTick, 60000 / store.settings.rsvpWpm);
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
