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
  rsvp.words = [];
  const from = firstTextPara(current.book.anchor ?? 0);
  for (let i = Math.max(0, from); i < current.paras.length; i++) {
    const p = current.paras[i];
    if (p.type === 'img') continue;
    for (const w of p.text.split(/\s+/)) {
      if (w) rsvp.words.push({ w, para: i });
    }
  }
  if (!rsvp.words.length) { toast('Rien à lire ici'); return; }
  rsvp.idx = 0;
  rsvp.playing = false;
  $('#rsvpWpm').value = store.settings.rsvpWpm;
  $('#rsvpWpmVal').textContent = store.settings.rsvpWpm + ' mots/min';
  $('#rsvpOverlay').classList.remove('hidden');
  rsvpShow();
  rsvpSetPlaying(true);
}

function rsvpShow() {
  const { w } = rsvp.words[rsvp.idx];
  const letters = [...w];
  const orp = Math.min(letters.length - 1, Math.max(0, Math.round((letters.length - 1) * 0.35)));
  $('#rsvpWord').innerHTML =
    esc(letters.slice(0, orp).join('')) +
    `<span class="orp">${esc(letters[orp])}</span>` +
    esc(letters.slice(orp + 1).join(''));
  $('#rsvpProgress').textContent =
    `${(rsvp.idx + 1).toLocaleString('fr-FR')} / ${rsvp.words.length.toLocaleString('fr-FR')} mots`;
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
