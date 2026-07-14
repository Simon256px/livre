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
