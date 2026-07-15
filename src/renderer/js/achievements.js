'use strict';

/* ═══════════ Succès à débloquer ═══════════
   Calculés à partir de la bibliothèque et des stats ; l'état débloqué
   est persisté dans store.achievements { id: timestamp }.            */

const ACHIEVEMENTS = [
  { id: 'premier-livre', ico: '📚', name: 'Bibliophile en herbe', desc: 'Ajouter son premier livre', test: (s) => s.books >= 1 },
  { id: 'cinq-livres', ico: '🗄️', name: 'Collectionneur', desc: '5 livres dans la bibliothèque', test: (s) => s.books >= 5 },
  { id: 'premier-fini', ico: '✅', name: 'Fin de l’histoire', desc: 'Terminer un premier livre', test: (s) => s.finished >= 1 },
  { id: 'trois-finis', ico: '🏁', name: 'Marathonien', desc: 'Terminer 3 livres', test: (s) => s.finished >= 3 },
  { id: 'heure-lecture', ico: '⏱️', name: 'Une heure au calme', desc: '1 heure de lecture cumulée', test: (s) => s.seconds >= 3600 },
  { id: 'dix-heures', ico: '🕰️', name: 'Rat de bibliothèque', desc: '10 heures de lecture cumulées', test: (s) => s.seconds >= 36000 },
  { id: 'streak-3', ico: '🔥', name: 'Trois jours de suite', desc: 'Lire 3 jours consécutifs', test: (s) => s.streak >= 3 },
  { id: 'streak-7', ico: '🚀', name: 'Une semaine parfaite', desc: 'Lire 7 jours consécutifs', test: (s) => s.streak >= 7 },
  { id: 'surligneur', ico: '🖍️', name: 'Surligneur', desc: 'Poser un premier surlignage', test: (s) => s.annotations >= 1 },
  { id: 'fluo-mania', ico: '🌈', name: 'Fluo mania', desc: '25 surlignages posés', test: (s) => s.annotations >= 25 },
  { id: 'scribe', ico: '✍️', name: 'Scribe', desc: 'Écrire une première note', test: (s) => s.notes >= 1 },
  { id: 'objectif', ico: '🎯', name: 'Dans le mille', desc: 'Atteindre son objectif quotidien', test: (s) => s.goalReached },
  { id: 'mots-10k', ico: '⚡', name: '10 000 mots', desc: 'Lire 10 000 mots au total', test: (s) => s.words >= 10000 },
  { id: 'mots-100k', ico: '🌟', name: 'Dévoreur', desc: 'Lire 100 000 mots au total', test: (s) => s.words >= 100000 },
];

function achievementStats() {
  const books = store.books;
  let seconds = 0, words = 0;
  for (const d of Object.values(store.stats.daily)) {
    seconds += d.seconds || 0;
    words += d.words || 0;
  }
  const goal = store.settings.dailyGoalMin || 0;
  const today = store.stats.daily[todayKey()] || { seconds: 0 };
  return {
    books: books.length,
    finished: books.filter((b) => (b.progress || 0) >= 1).length,
    seconds,
    words,
    streak: typeof currentStreak === 'function' ? currentStreak() : 0,
    annotations: books.reduce((n, b) => n + (b.annotations || []).length, 0),
    notes: books.reduce((n, b) => n + (b.annotations || []).filter((a) => a.note).length, 0),
    goalReached: goal > 0 && today.seconds >= goal * 60,
  };
}

let checkingAch = false;
function checkAchievements() {
  if (checkingAch || !store.achievements) return;
  checkingAch = true;
  try {
    const s = achievementStats();
    for (const a of ACHIEVEMENTS) {
      if (store.achievements[a.id]) continue;
      if (a.test(s)) {
        store.achievements[a.id] = Date.now();
        toast(`🏆 Succès débloqué : ${a.name} !`);
      }
    }
  } finally {
    checkingAch = false;
  }
}

function renderAchievements() {
  const unlocked = store.achievements || {};
  const count = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
  $('#achSummary').textContent = `${count} / ${ACHIEVEMENTS.length} succès débloqués`;
  $('#achGrid').innerHTML = ACHIEVEMENTS.map((a) => {
    const ts = unlocked[a.id];
    const when = ts ? `Débloqué le ${new Date(ts).toLocaleDateString('fr-FR')}` : a.desc;
    return `<div class="ach ${ts ? '' : 'locked'}">
      <div class="ico">${ts ? a.ico : '🔒'}</div>
      <div><h4>${esc(a.name)}</h4><p>${esc(when)}</p></div>
    </div>`;
  }).join('');
}
