'use strict';

/* ═══════════ Minuteur Pomodoro ═══════════
   Alterne des sessions de lecture et des pauses. Un badge affiche le
   compte à rebours ; un petit bip (WebAudio, sans fichier) signale
   chaque changement de phase.                                        */

const pomo = { phase: null, endsAt: 0, timer: null };

function pomodoroActive() {
  return pomo.phase !== null;
}

function pomodoroToggle() {
  if (pomodoroActive()) pomodoroStop();
  else pomodoroStart('focus');
}

function pomodoroStart(phase) {
  pomo.phase = phase;
  const mins = phase === 'focus' ? store.settings.pomodoroFocus : store.settings.pomodoroBreak;
  pomo.endsAt = Date.now() + mins * 60000;
  $('#pomodoroBadge').classList.remove('hidden');
  $('#pomodoroBadge').classList.toggle('break', phase === 'break');
  $('#pomodoroBtn').classList.add('on');
  clearInterval(pomo.timer);
  pomo.timer = setInterval(pomodoroTick, 500);
  pomodoroTick();
}

function pomodoroTick() {
  const ms = pomo.endsAt - Date.now();
  if (ms <= 0) { pomodoroPhaseEnd(); return; }
  const s = Math.ceil(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  $('#pomoPhase').textContent = pomo.phase === 'focus' ? 'Lecture' : 'Pause';
  $('#pomoTime').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
}

function pomodoroPhaseEnd() {
  pomodoroBeep();
  if (pomo.phase === 'focus') {
    toast('🍅 Pause ! Repose tes yeux un instant.');
    pomodoroStart('break');
  } else {
    toast('📖 Pause terminée — on reprend ?');
    pomodoroStart('focus');
  }
}

function pomodoroStop() {
  clearInterval(pomo.timer);
  pomo.timer = null;
  pomo.phase = null;
  $('#pomodoroBadge').classList.add('hidden');
  $('#pomodoroBtn').classList.remove('on');
}

// Son de tournage de page : court souffle de bruit filtré
function playPageSound() {
  if (!store.settings.pageSound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const dur = 0.16;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2); // enveloppe décroissante
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch { /* audio indisponible */ }
}

function pomodoroBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.36);
    o.onended = () => ctx.close();
  } catch { /* audio indisponible : le toast suffit */ }
}
