'use strict';

/* ═══════════ Câblage de l'interface & démarrage ═══════════ */

function syncControls() {
  const s = store.settings;
  document.body.dataset.theme = s.theme;
  $$('.dot').forEach((d) => d.classList.toggle('active', d.dataset.theme === s.theme));
  $('#fontSelect').value = s.font;
  $('#flowSelect').value = s.flow;
  $('#spreadSelect').value = s.spread;
  $('#sizeRange').value = s.fontSize;
  $('#sizeVal').textContent = s.fontSize + ' px';
  $('#lhRange').value = s.lineHeight;
  $('#lhVal').textContent = s.lineHeight.toFixed(2);
  $('#widthRange').value = s.pageWidth;
  $('#widthVal').textContent = s.pageWidth + ' px';
  $('#justifyChk').checked = s.justify;
  $('#bionicChk').checked = s.bionic;
  $('#intensityRange').value = s.bionicIntensity;
  $('#intensityVal').textContent = Math.round(s.bionicIntensity * 100) + ' %';
  $('#focusChk').checked = s.focus;
  $('#ttsRate').value = s.ttsRate;
  $('#ttsRateVal').textContent = s.ttsRate.toFixed(2) + '×';
  $('#bionicBtn').classList.toggle('on', s.bionic);
  $('#focusBtn').classList.toggle('on', s.focus);
  updateFocusRuler();
}

// rerender : true quand le changement affecte la mise en page du texte
function applySettings(rerender) {
  syncControls();
  persist();
  if (rerender) relayout();
}

function closeRightDrawers() {
  $('#settingsDrawer').classList.remove('open');
  $('#notesDrawer').classList.remove('open');
}

function toggleDrawer(id) {
  const el = $(id);
  const wasOpen = el.classList.contains('open');
  closeRightDrawers();
  if (id !== '#tocDrawer') $('#tocDrawer').classList.remove('open');
  if (!wasOpen) el.classList.add('open');
}

function buildUI() {
  for (const holder of ['#libDots', '#readerDots']) {
    $(holder).innerHTML = THEMES.map((t) =>
      `<button class="dot" data-theme="${t}" title="Thème ${t}"></button>`).join('');
  }
  $$('.dot').forEach((d) => d.addEventListener('click', () => {
    store.settings.theme = d.dataset.theme;
    applySettings(false);
  }));

  /* --- Bibliothèque --- */
  const pick = async () => {
    const paths = await window.livre.pickBooks();
    if (paths.length) addBooks(paths);
  };
  $('#addBtn').addEventListener('click', pick);
  $('#emptyAddBtn').addEventListener('click', pick);
  $('#libSearch').addEventListener('input', debounce((e) => {
    libraryQuery = e.target.value;
    renderLibrary();
  }, 200));

  /* --- Barre de lecture --- */
  $('#backBtn').addEventListener('click', closeReader);
  $('#tocBtn').addEventListener('click', () => toggleDrawer('#tocDrawer'));
  $('#searchBtn').addEventListener('click', openSearch);
  $('#bookmarkBtn').addEventListener('click', toggleBookmark);
  $('#notesBtn').addEventListener('click', () => {
    renderNotesDrawer();
    toggleDrawer('#notesDrawer');
  });
  $('#ttsBtn').addEventListener('click', ttsToggle);
  $('#rsvpBtn').addEventListener('click', rsvpOpen);
  $('#bionicBtn').addEventListener('click', () => {
    store.settings.bionic = !store.settings.bionic;
    applySettings(true);
  });
  $('#focusBtn').addEventListener('click', () => {
    store.settings.focus = !store.settings.focus;
    applySettings(false);
  });
  $('#fullscreenBtn').addEventListener('click', toggleFullscreen);
  $('#settingsBtn').addEventListener('click', () => toggleDrawer('#settingsDrawer'));
  $('#prevBtn').addEventListener('click', () => goTo(current.page - 1));
  $('#nextBtn').addEventListener('click', () => goTo(current.page + 1));

  /* --- Recherche plein texte --- */
  $('#searchInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = e.target.value;
    if (searchState.active && q === searchState.q && searchState.results.length) {
      jumpToHit(searchState.idx + (e.shiftKey ? -1 : 1));
    } else {
      doSearch(q);
    }
  });
  $('#searchPrev').addEventListener('click', () => jumpToHit(searchState.idx - 1));
  $('#searchNext').addEventListener('click', () => jumpToHit(searchState.idx + 1));
  $('#searchClose').addEventListener('click', () => closeSearch());

  /* --- Tiroirs --- */
  $('#tocCloseBtn').addEventListener('click', () => $('#tocDrawer').classList.remove('open'));
  $('#notesCloseBtn').addEventListener('click', () => $('#notesDrawer').classList.remove('open'));
  $('#closeDrawerBtn').addEventListener('click', () => $('#settingsDrawer').classList.remove('open'));
  $('#exportBtn').addEventListener('click', exportAnnotations);

  /* --- Réglages --- */
  $('#fontSelect').addEventListener('change', (e) => {
    store.settings.font = e.target.value;
    applySettings(true);
  });
  $('#flowSelect').addEventListener('change', (e) => {
    store.settings.flow = e.target.value;
    applySettings(true);
  });
  $('#spreadSelect').addEventListener('change', (e) => {
    store.settings.spread = e.target.value;
    applySettings(true);
  });
  $('#sizeRange').addEventListener('input', (e) => {
    store.settings.fontSize = Number(e.target.value);
    applySettings(true);
  });
  $('#lhRange').addEventListener('input', (e) => {
    store.settings.lineHeight = Number(e.target.value);
    applySettings(true);
  });
  $('#widthRange').addEventListener('input', (e) => {
    store.settings.pageWidth = Number(e.target.value);
    applySettings(true);
  });
  $('#justifyChk').addEventListener('change', (e) => {
    store.settings.justify = e.target.checked;
    applySettings(true);
  });
  $('#bionicChk').addEventListener('change', (e) => {
    store.settings.bionic = e.target.checked;
    applySettings(true);
  });
  $('#intensityRange').addEventListener('input', (e) => {
    store.settings.bionicIntensity = Number(e.target.value);
    applySettings(store.settings.bionic);
  });
  $('#focusChk').addEventListener('change', (e) => {
    store.settings.focus = e.target.checked;
    applySettings(false);
  });
  $('#ttsVoice').addEventListener('change', (e) => {
    store.settings.ttsVoice = e.target.value;
    persist();
  });
  $('#ttsRate').addEventListener('input', (e) => {
    store.settings.ttsRate = Number(e.target.value);
    applySettings(false);
  });

  /* --- Surlignage --- */
  document.addEventListener('mouseup', (e) => {
    if (e.target.closest('#hlToolbar, #annPopover, .drawer')) return;
    setTimeout(onTextSelected, 10); // laisse la sélection se stabiliser
  });
  $$('#hlToolbar .hl-dot').forEach((dot) =>
    dot.addEventListener('click', () => applyHighlight(dot.dataset.color)));
  $$('#annPopover .hl-dot').forEach((dot) =>
    dot.addEventListener('click', () => recolorAnnotation(dot.dataset.color)));
  $('#annDeleteBtn').addEventListener('click', () => {
    const id = editingAnnId;
    hideAnnPopover(false);
    if (id) deleteAnnotation(id);
  });
  $('#bookContent').addEventListener('click', (e) => {
    const mark = e.target.closest('mark.hl');
    if (mark && getSelection().isCollapsed) {
      e.stopPropagation();
      showAnnPopover(mark.dataset.ann, e.clientX, e.clientY);
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#annPopover') && !e.target.closest('mark.hl')) hideAnnPopover();
    if (!e.target.closest('#hlToolbar') && !e.target.closest('#bookContent')) hideHlToolbar();
  });

  /* --- RSVP --- */
  $('#rsvpClose').addEventListener('click', rsvpClose);
  $('#rsvpPlay').addEventListener('click', () => rsvpSetPlaying(!rsvp.playing));
  $('#rsvpWpm').addEventListener('input', (e) => {
    store.settings.rsvpWpm = Number(e.target.value);
    $('#rsvpWpmVal').textContent = store.settings.rsvpWpm + ' mots/min';
    persist();
  });

  /* --- Clavier --- */
  document.addEventListener('keydown', (e) => {
    if (rsvpVisible()) {
      if (e.key === ' ') { e.preventDefault(); rsvpSetPlaying(!rsvp.playing); }
      else if (e.key === 'Escape') rsvpClose();
      return;
    }
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
      if (e.key === 'Escape') {
        if (e.target.id === 'searchInput') closeSearch();
        else if (e.target.id === 'annNote') hideAnnPopover();
        else e.target.blur();
      }
      return;
    }
    if (!readerVisible() || !current) return;
    if (e.key === 'f' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); }
    else if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
    else if (e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
      e.preventDefault();
      goTo(current.page + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
      e.preventDefault();
      goTo(current.page - 1);
    } else if (e.key === 'Escape') {
      if (!$('#hlToolbar').classList.contains('hidden')) hideHlToolbar();
      else if (!$('#searchBar').classList.contains('hidden')) closeSearch();
      else if ($$('.drawer.open').length) {
        $$('.drawer.open').forEach((d) => d.classList.remove('open'));
      } else if (document.body.classList.contains('fullscreen')) toggleFullscreen();
      else closeReader();
    }
  });

  /* --- Molette, souris, redimensionnement --- */
  let wheelLock = 0;
  $('.reader-main').addEventListener('wheel', (e) => {
    if (!current || store.settings.flow === 'scroll') return;
    const now = Date.now();
    if (now - wheelLock < 180) return;
    wheelLock = now;
    goTo(current.page + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  $('#bookViewport').addEventListener('scroll', debounce(onScrolled, 150));

  document.addEventListener('mousemove', (e) => {
    if (document.body.classList.contains('fullscreen')) {
      document.body.classList.toggle('peek', e.clientY < 60);
    }
    if (!store.settings.focus || !readerVisible()) return;
    const y = e.clientY;
    $('#focusRuler').style.background =
      `linear-gradient(to bottom, var(--dim) 0px, var(--dim) ${y - 46}px,` +
      ` transparent ${y - 46}px, transparent ${y + 52}px, var(--dim) ${y + 52}px)`;
  });

  window.addEventListener('resize', debounce(() => {
    if (current && readerVisible()) relayout();
  }, 200));

  /* --- Glisser-déposer --- */
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dropping');
  });
  window.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget) document.body.classList.remove('dropping');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dropping');
    const paths = [...e.dataTransfer.files]
      .filter((f) => /\.(pdf|epub)$/i.test(f.name))
      .map((f) => window.livre.pathForFile(f))
      .filter(Boolean);
    if (paths.length) addBooks(paths);
  });

  /* --- Événements du processus principal --- */
  window.livre.onFullscreen(onFullscreenChanged);
  // Fichier passé en argument : on l'ajoute et on l'ouvre directement
  window.livre.onOpenFiles(async (paths) => {
    const ids = await addBooks(paths);
    if (ids.length) openBook(ids[0]);
  });

  if ('speechSynthesis' in window) {
    populateVoices();
    speechSynthesis.addEventListener('voiceschanged', populateVoices);
  }
}

/* ---------- Démarrage ---------- */

(async function init() {
  const saved = await window.livre.loadStore();
  if (saved) {
    store = saved;
    store.settings = { ...DEFAULT_SETTINGS, ...(store.settings || {}) };
    store.books = (store.books || []).map((b) => ({
      format: 'pdf',
      author: '',
      annotations: [],
      bookmarks: [],
      ...b,
    }));
    store.stats = store.stats || { daily: {} };
    store.stats.daily = store.stats.daily || {};
  }
  buildUI();
  syncControls();
  renderLibrary();
})();
