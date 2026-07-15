'use strict';

/* ═══════════ Extraction PDF & EPUB → paragraphes ═══════════
   Produit un tableau homogène de blocs :
   { type:'p', text } | { type:'h', text } | { type:'img', src }   */

const MAX_FIGS = 120; // limite d'images conservées par livre

/* ---------- PDF ---------- */

// Reconstruit des lignes à partir des items pdf.js, retire les
// en-têtes/pieds de page répétés et les numéros de page, puis
// fusionne les lignes en paragraphes (gaps verticaux, indentation,
// césures) et détecte les titres par leur taille de police.
async function extractPdf(pdf, onProgress) {
  const pages = [];
  let figCount = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    throwIfCancelled();
    const page = await cancellable(pdf.getPage(i));
    const tc = await cancellable(page.getTextContent());
    const lines = [];
    let cur = null;
    const flush = () => { if (cur && cur.text.trim()) lines.push(cur); cur = null; };
    for (const it of tc.items) {
      const h = it.height || Math.abs(it.transform[3]) || 10;
      const x = it.transform[4];
      const y = it.transform[5];
      if (cur && Math.abs(y - cur.y) > Math.max(cur.h, h) * 0.6) flush();
      if (!cur) cur = { text: '', x, y, h: 0, xEnd: x };
      if (it.str) {
        const gap = x - cur.xEnd;
        const needSpace = cur.text && gap > h * 0.18 &&
          !cur.text.endsWith(' ') && !it.str.startsWith(' ');
        cur.text += (needSpace ? ' ' : '') + it.str;
        cur.xEnd = x + (it.width || 0);
        cur.h = Math.max(cur.h, h);
      }
      if (it.hasEOL) flush();
    }
    flush();
    const figs = figCount < MAX_FIGS ? await extractPageImages(page) : [];
    figCount += figs.length;
    pages.push({ lines, figs });
    if (i % 5 === 0 || i === pdf.numPages) onProgress(i, pdf.numPages);
  }

  // Un en-tête/pied de page = même texte (chiffres neutralisés) à la
  // même hauteur sur au moins la moitié des pages
  const norm = (t) => t.trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ');
  const keyOf = (l) => {
    const k = norm(l.text);
    return k ? `${k}@${Math.round(l.y / 10)}` : '';
  };
  const counts = new Map();
  for (const { lines } of pages) {
    const edges = new Set([...lines.slice(0, 2), ...lines.slice(-2)]);
    for (const l of edges) {
      const k = keyOf(l);
      if (k) counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const junkThreshold = Math.max(4, Math.ceil(pages.length * 0.5));
  const kept = pages.map(({ lines, figs }) => ({
    figs,
    lines: lines.filter((l, idx) => {
      if (/^\s*[-–—.]*\s*\d+\s*[-–—.]*\s*$/.test(l.text)) return false;
      const isEdge = idx < 2 || idx >= lines.length - 2;
      return !(isEdge && (counts.get(keyOf(l)) || 0) >= junkThreshold);
    }),
  }));

  const allLines = kept.flatMap((p) => p.lines);
  if (!allLines.length && !kept.some((p) => p.figs.length)) return { paras: [], words: 0 };
  const heights = allLines.map((l) => l.h).sort((a, b) => a - b);
  const medH = heights[heights.length >> 1] || 12;
  const gaps = [];
  for (const { lines } of kept) {
    for (let i = 1; i < lines.length; i++) {
      const g = lines[i - 1].y - lines[i].y;
      if (g > 0 && g < medH * 4) gaps.push(g);
    }
  }
  gaps.sort((a, b) => a - b);
  const medGap = gaps[gaps.length >> 1] || medH * 1.4;

  const paras = [];
  let buf = '';
  let figQueue = [];
  const flushPara = () => {
    const t = buf.replace(/\s+/g, ' ').trim();
    if (t) paras.push({ type: 'p', text: t });
    buf = '';
    if (figQueue.length) { paras.push(...figQueue); figQueue = []; }
  };
  const endsSentence = (t) => /[.!?…:»"’)\]]\s*$/.test(t.trim());

  for (const { lines, figs } of kept) {
    const pageMinX = lines.length ? Math.min(...lines.map((l) => l.x)) : 0;
    let prev = null;
    for (const l of lines) {
      const t = l.text.trim();
      if (!t) continue;
      const isHeading = l.h > medH * 1.3 && t.length < 90 && !/[.,;]$/.test(t);
      if (isHeading) {
        flushPara();
        paras.push({ type: 'h', text: t });
        prev = l;
        continue;
      }
      let brk = false;
      if (buf) {
        if (prev) {
          const g = prev.y - l.y;
          if (g > medGap * 1.75) brk = true;
          if (l.x - pageMinX > medH * 1.1 && endsSentence(buf)) brk = true;
        } else if (endsSentence(buf)) {
          brk = true; // changement de page sur une phrase terminée
        }
      }
      if (brk) flushPara();
      if (buf && /\p{L}-$/u.test(buf) && /^\p{Ll}/u.test(t)) {
        buf = buf.slice(0, -1) + t; // recolle la césure
      } else {
        buf += (buf ? ' ' : '') + t;
      }
      prev = l;
    }
    // Les images d'une page s'insèrent à la fin du paragraphe en cours
    if (figs.length) {
      if (!buf) paras.push(...figs);
      else figQueue.push(...figs);
    }
  }
  flushPara();

  const words = paras.reduce((n, p) => n + (p.text ? p.text.split(/\s+/).length : 0), 0);
  return { paras, words };
}

// Les images décodées par pdf.js sont récupérées après getOperatorList.
// Timeout par page : une page pathologique ne doit pas bloquer le livre.
async function extractPageImages(page) {
  const out = [];
  try {
    const ops = await cancellable(withTimeout(page.getOperatorList(), 10000));
    const seen = new Set();
    for (let i = 0; i < ops.fnArray.length; i++) {
      if (ops.fnArray[i] !== pdfjsLib.OPS.paintImageXObject) continue;
      const name = ops.argsArray[i][0];
      if (seen.has(name)) continue;
      seen.add(name);
      throwIfCancelled();
      // Les images réutilisées sur plusieurs pages sont promues en objets
      // globaux (noms « g_… », stockés dans commonObjs) : interroger
      // page.objs pour elles ne répond jamais. Garde-fou 3 s dans tous
      // les cas pour qu'un objet jamais résolu ne fige pas l'extraction.
      const img = await new Promise((res) => {
        let done = false;
        const cb = (v) => { if (!done) { done = true; res(v); } };
        try {
          const objStore = name.startsWith('g_') ? page.commonObjs : page.objs;
          objStore.get(name, cb);
        } catch { cb(null); }
        setTimeout(() => cb(null), 3000);
      });
      if (!img || !img.width || img.width < 90 || img.height < 90) continue;
      const src = pdfImgToDataURL(img);
      if (src) out.push({ type: 'img', src });
      if (out.length >= 8) break; // garde-fou par page
    }
  } catch (e) {
    if (e instanceof CancelledError) throw e;
    /* timeout ou op-list inexploitable : tant pis pour les images de la page */
  }
  return out;
}

function pdfImgToDataURL(img) {
  try {
    let canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (img.bitmap) {
      ctx.drawImage(img.bitmap, 0, 0);
    } else if (img.data) {
      const n = img.width * img.height;
      let rgba;
      if (img.kind === 3 && img.data.length >= n * 4) { // RGBA_32BPP
        rgba = new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, n * 4);
      } else if (img.kind === 2 && img.data.length >= n * 3) { // RGB_24BPP
        rgba = new Uint8ClampedArray(n * 4);
        for (let i = 0, j = 0; i < n * 3; i += 3, j += 4) {
          rgba[j] = img.data[i];
          rgba[j + 1] = img.data[i + 1];
          rgba[j + 2] = img.data[i + 2];
          rgba[j + 3] = 255;
        }
      } else {
        return null; // masques 1bpp et formats exotiques ignorés
      }
      ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
    } else {
      return null;
    }
    // Réduit les très grandes images : limite le poids du cache et la mémoire
    const MAXW = 1400;
    if (canvas.width > MAXW) {
      const scaled = document.createElement('canvas');
      scaled.width = MAXW;
      scaled.height = Math.round(canvas.height * (MAXW / canvas.width));
      scaled.getContext('2d').drawImage(canvas, 0, 0, scaled.width, scaled.height);
      canvas.width = 0; // libère l'original
      canvas = scaled;
    }
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

async function renderCover(pdf) {
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 260 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}

/* ---------- EPUB ---------- */

function epubResolve(baseDir, rel) {
  rel = decodeURIComponent(rel.split('#')[0]);
  const parts = (baseDir + rel).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

// Certains zips (Compress-Archive…) utilisent des antislashs
function zipEntry(zip, p) {
  return zip.file(p) || zip.file(p.replace(/\//g, '\\'));
}

async function epubOpen(buf) {
  const zip = await JSZip.loadAsync(buf);
  const cf = zipEntry(zip, 'META-INF/container.xml');
  if (!cf) throw new Error('EPUB invalide (container.xml manquant)');
  const cxml = new DOMParser().parseFromString(await cf.async('string'), 'application/xml');
  const opfPath = cxml.getElementsByTagName('rootfile')[0].getAttribute('full-path');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfFile = zipEntry(zip, opfPath);
  if (!opfFile) throw new Error('EPUB invalide (OPF manquant)');
  const opf = new DOMParser().parseFromString(await opfFile.async('string'), 'application/xml');
  return { zip, opf, opfDir };
}

async function epubImgData(zip, pathInZip) {
  const f = zipEntry(zip, pathInZip);
  if (!f) return null;
  const ext = pathInZip.split('.').pop().toLowerCase();
  const mime = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  }[ext];
  if (!mime) return null;
  return `data:${mime};base64,${await f.async('base64')}`;
}

function epubManifest(opf) {
  const items = {};
  for (const it of opf.getElementsByTagNameNS('*', 'item')) {
    items[it.getAttribute('id')] = {
      href: it.getAttribute('href'),
      type: it.getAttribute('media-type') || '',
      props: it.getAttribute('properties') || '',
    };
  }
  return items;
}

async function epubMeta(zip, opf, opfDir) {
  const gm = (tag) => {
    const el = opf.getElementsByTagNameNS('*', tag)[0];
    return el ? el.textContent.trim() : '';
  };
  const items = epubManifest(opf);
  let coverItem = Object.values(items).find((it) => it.props.includes('cover-image'));
  if (!coverItem) {
    const meta = [...opf.getElementsByTagNameNS('*', 'meta')]
      .find((m) => m.getAttribute('name') === 'cover');
    if (meta) coverItem = items[meta.getAttribute('content')];
  }
  const cover = coverItem ? await epubImgData(zip, epubResolve(opfDir, coverItem.href)) : null;
  return { title: gm('title'), author: gm('creator'), cover };
}

async function extractEpub(buf, onProgress) {
  const { zip, opf, opfDir } = await epubOpen(buf);
  const items = epubManifest(opf);
  const spine = [...opf.getElementsByTagNameNS('*', 'itemref')]
    .map((r) => items[r.getAttribute('idref')])
    .filter((it) => it && /xhtml|html/.test(it.type));

  const paras = [];
  let figCount = 0;
  for (let s = 0; s < spine.length; s++) {
    throwIfCancelled();
    const filePath = epubResolve(opfDir, spine[s].href);
    const f = zipEntry(zip, filePath);
    if (!f) continue;
    const fileDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/') + 1) : '';
    const doc = new DOMParser().parseFromString(await f.async('string'), 'text/html');
    for (const el of doc.body.querySelectorAll('h1,h2,h3,h4,p,li,img')) {
      if (el.tagName === 'IMG') {
        if (figCount >= MAX_FIGS) continue;
        const src = el.getAttribute('src');
        if (!src) continue;
        const data = src.startsWith('data:') ? src : await epubImgData(zip, epubResolve(fileDir, src));
        if (data) { paras.push({ type: 'img', src: data }); figCount++; }
        continue;
      }
      if (el.tagName === 'LI' && el.querySelector('p')) continue;
      const t = el.textContent.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      paras.push(/^H[1-4]$/.test(el.tagName) ? { type: 'h', text: t } : { type: 'p', text: t });
    }
    onProgress(s + 1, spine.length);
  }
  const words = paras.reduce((n, p) => n + (p.text ? p.text.split(/\s+/).length : 0), 0);
  return { paras, words };
}

/* ---------- Contenu avec cache ---------- */

async function getContent(book) {
  const cached = await window.livre.loadCache(book.id);
  if (cached && cached.v === CACHE_V && Array.isArray(cached.paras)) return cached;

  const buf = await window.livre.readFile(book.path);
  throwIfCancelled();
  let result;
  let skipCache = false;
  if (book.format === 'epub') {
    result = await extractEpub(buf, (i, n) => setProgress(i, n, 'Extraction du texte'));
  } else {
    await pdfWorkerReady; // garantit un vrai worker (thread UI libre → annulable)
    const pdf = await cancellable(pdfjsLib.getDocument({ data: new Uint8Array(buf), ...PDF_OPTS }).promise);
    try {
      result = await extractPdf(pdf, (i, n) => setProgress(i, n, 'Extraction du texte'));
      // PDF quasi sans texte → probablement un scan : proposer l'OCR
      if (result.words < 30 && ocrAvailable()) {
        const go = window.LIVRE_OCR_AUTO || confirm(
          'Ce PDF semble être un scan (peu ou pas de texte sélectionnable).\n\n' +
          `Lancer la reconnaissance de texte (OCR) sur ${pdf.numPages} page(s) ?\n` +
          'Cela fonctionne hors ligne et peut prendre un moment.');
        if (go) result = await ocrPdf(pdf);
        else skipCache = true; // pas de cache : reproposer l'OCR à la prochaine ouverture
      }
    } finally {
      pdf.destroy();
    }
  }
  const data = { v: CACHE_V, paras: result.paras, words: result.words, ocr: !!result.ocr };
  if (!skipCache) window.livre.saveCache(book.id, data);
  return data;
}
