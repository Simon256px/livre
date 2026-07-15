'use strict';

/* ═══════════ Dessin au stylet ═══════════
   Mode croquis : un canvas transparent recouvre la page ; on dessine
   à la souris ou au stylet (la pression module l'épaisseur du trait).
   Le croquis est enregistré en PNG, ancré au paragraphe courant, et
   listé dans le panneau Notes.                                       */

const sketch = { active: false, drawing: false, color: '#1D1A14', ctx: null, dirty: false };
const SKETCH_COLORS = { ink: '#1D1A14', red: '#E4502E', blue: '#3E7BD9', green: '#63C878' };

function sketchVisible() {
  return !$('#sketchLayer').classList.contains('hidden');
}

function sketchOpen() {
  if (!current) return;
  const layer = $('#sketchLayer');
  const frame = $('#pageFrame');
  const canvas = $('#sketchCanvas');
  const r = frame.getBoundingClientRect();
  layer.style.left = r.left + 'px';
  layer.style.top = r.top + 'px';
  layer.style.width = r.width + 'px';
  layer.style.height = r.height + 'px';
  canvas.width = Math.round(r.width * devicePixelRatio);
  canvas.height = Math.round(r.height * devicePixelRatio);
  canvas.style.width = r.width + 'px';
  canvas.style.height = r.height + 'px';
  sketch.ctx = canvas.getContext('2d');
  sketch.ctx.scale(devicePixelRatio, devicePixelRatio);
  sketch.ctx.lineCap = 'round';
  sketch.ctx.lineJoin = 'round';
  sketch.dirty = false;
  sketch.active = true;
  layer.classList.remove('hidden');
  $('#sketchBtn').classList.add('on');
  $$('#sketchTools .hl-dot').forEach((d) =>
    d.classList.toggle('sel', SKETCH_COLORS[d.dataset.pen] === sketch.color));
}

function sketchClose(save) {
  const layer = $('#sketchLayer');
  if (layer.classList.contains('hidden')) return;
  if (save && sketch.dirty && current) {
    const image = $('#sketchCanvas').toDataURL('image/png');
    current.book.sketches.push({
      id: crypto.randomUUID(),
      para: current.book.anchor ?? 0,
      image,
      created: Date.now(),
    });
    persist();
    renderNotesDrawer();
    toast('Croquis enregistré ✏️');
  }
  sketch.active = false;
  layer.classList.add('hidden');
  $('#sketchBtn').classList.remove('on');
}

function sketchClear() {
  const c = $('#sketchCanvas');
  sketch.ctx.clearRect(0, 0, c.width, c.height);
  sketch.dirty = false;
}

function sketchPointerDown(e) {
  if (e.target.closest('#sketchTools')) return;
  sketch.drawing = true;
  sketch.dirty = true;
  const canvas = $('#sketchCanvas');
  canvas.setPointerCapture(e.pointerId);
  const r = canvas.getBoundingClientRect();
  sketch.ctx.beginPath();
  sketch.ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
}

function sketchPointerMove(e) {
  if (!sketch.drawing) return;
  const canvas = $('#sketchCanvas');
  const r = canvas.getBoundingClientRect();
  // la pression du stylet (0..1) module l'épaisseur ; souris = 0.5
  const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
  sketch.ctx.lineWidth = 1.2 + pressure * 4.5;
  sketch.ctx.strokeStyle = sketch.color;
  sketch.ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
  sketch.ctx.stroke();
}

function sketchPointerUp() {
  sketch.drawing = false;
}

/* ---------- Visionneuse ---------- */

function showSketch(id) {
  const sk = current && current.book.sketches.find((s) => s.id === id);
  if (!sk) return;
  $('#sketchViewImg').src = sk.image;
  $('#sketchView').classList.remove('hidden');
}
function hideSketchView() {
  $('#sketchView').classList.add('hidden');
}

function deleteSketch(id) {
  current.book.sketches = current.book.sketches.filter((s) => s.id !== id);
  persist();
  renderNotesDrawer();
}
