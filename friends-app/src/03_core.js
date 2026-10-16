'use strict';
/* ===================================================================
   KENGO FRIEND SNS — core: utilities, icons, media processing, stores
   =================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => Date.now();
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
function uid(n = 16) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
}
function el(tag, props, ...children) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
function frag(...children) { const f = document.createDocumentFragment(); for (const c of children.flat(Infinity)) if (c != null && c !== false) f.append(c.nodeType ? c : document.createTextNode(String(c))); return f; }
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepMerge(target[k], v);
    else target[k] = v;
  }
  return target;
}
function hashInt(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hueFor(id) { return hashInt(String(id)) % 360; }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function fmtCount(n) {
  n = Number(n) || 0;
  if (n >= 100000000) return (n / 100000000).toFixed(n % 100000000 ? 1 : 0) + '億';
  if (n >= 10000) return (n / 10000).toFixed(n % 10000 >= 1000 ? 1 : 0) + '万';
  return n.toLocaleString('ja-JP');
}
function timeAgo(ts, short = false) {
  const s = Math.max(0, Math.floor((now() - ts) / 1000));
  if (s < 45) return short ? '今' : 'たった今';
  const m = Math.max(1, Math.floor(s / 60)); if (m < 60) return short ? `${m}分` : `${m}分前`;
  const h = Math.floor(m / 60); if (h < 24) return short ? `${h}時間` : `${h}時間前`;
  const d = Math.floor(h / 24); if (d < 7) return short ? `${d}日` : `${d}日前`;
  const w = Math.floor(d / 7); if (w < 5) return short ? `${w}週` : `${w}週間前`;
  const dt = new Date(ts);
  const y = dt.getFullYear() === new Date().getFullYear() ? '' : `${dt.getFullYear()}年`;
  return `${y}${dt.getMonth() + 1}月${dt.getDate()}日`;
}
function fmtDateLong(ts) { const d = new Date(ts); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; }
function fmtTime(ts) { const d = new Date(ts); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function sameDay(a, b) { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); }
function dayLabel(ts) {
  const t = new Date(); const d = new Date(ts);
  if (sameDay(ts, t.getTime())) return '今日';
  const y = new Date(t); y.setDate(y.getDate() - 1); if (sameDay(ts, y.getTime())) return '昨日';
  return `${d.getMonth() + 1}月${d.getDate()}日` + (d.getFullYear() !== t.getFullYear() ? ` ${d.getFullYear()}` : '');
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normUsername(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30); }
function isValidUsername(s) { return /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/.test(s) && !/\.\./.test(s); }
function extractTags(text) { const out = new Set(); for (const m of String(text || '').matchAll(/#([\p{L}\p{N}_]+)/gu)) out.add(m[1].toLowerCase()); return Array.from(out).slice(0, 30); }
function extractMentions(text) { const out = new Set(); for (const m of String(text || '').matchAll(/@([a-z0-9._]{2,30})/gi)) out.add(m[1].toLowerCase()); return Array.from(out); }
function safeSegment(s) { return String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 180); }

/* ---------- Icons ---------- */
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z"/>',
  reels: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9h18M8 3l3 6M14 3l3 6"/><path d="m11 12.5 4 2.5-4 2.5z"/>',
  send: '<path d="M21 3 3 10.5l7.5 3L13.5 21z"/><path d="M21 3 10.5 13.5"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z"/>',
  plus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  chevL: '<path d="m15 5-7 7 7 7"/>', chevR: '<path d="m9 5 7 7-7 7"/>', chevD: '<path d="m5 9 7 7 7-7"/>', chevU: '<path d="m5 15 7-7 7 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  tag: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M7 18a5 5 0 0 1 10 0"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5.5-5.5L7 19"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
  volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 0 1 0 7"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13 7 4 4"/>',
  back: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="3"/><path d="M15.5 14.5A5.5 5.5 0 0 1 21.5 20"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 7 7v4"/>',
  plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  mapPin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
  crop: '<path d="M6 2v16h16M2 6h16v16"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  film: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M4 16h16M8 3v18M16 3v18"/>',
  arrowR: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
  device: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M10 18h4"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  prev: '<path d="M6 5v14M19 5 8 12l11 7z" fill="currentColor"/>',
  next: '<path d="M18 5v14M5 5l11 7-11 7z" fill="currentColor"/>',
  shuffle: '<path d="M3 7h3l9 10h6M3 17h3l2-2M15 7h6"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>',
};
function iconHTML(name, cls = '', fill = false) {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
function icon(name, cls = '', fill = false) { const t = document.createElement('template'); t.innerHTML = iconHTML(name, cls, fill); return t.content.firstChild; }

/* ---------- Filters ---------- */
const FILTERS = [
  ['original', 'オリジナル', ''],
  ['clarity', 'クリア', 'contrast(1.12) saturate(1.1)'],
  ['warm', 'ウォーム', 'sepia(.22) saturate(1.3) contrast(1.05) brightness(1.03)'],
  ['cool', 'クール', 'hue-rotate(-8deg) saturate(.92) contrast(1.08) brightness(1.02)'],
  ['fade', 'フェード', 'contrast(.86) brightness(1.1) saturate(.8)'],
  ['vivid', 'ビビッド', 'saturate(1.6) contrast(1.1)'],
  ['mono', 'モノクロ', 'grayscale(1) contrast(1.1)'],
  ['noir', 'ノワール', 'grayscale(1) contrast(1.35) brightness(.9)'],
  ['sepia', 'セピア', 'sepia(.7) contrast(.95) brightness(1.02)'],
  ['lofi', 'ローファイ', 'saturate(1.3) contrast(1.3) brightness(.95)'],
  ['film', 'フィルム', 'sepia(.15) contrast(.9) brightness(1.08) saturate(1.1)'],
  ['dusk', 'ダスク', 'hue-rotate(10deg) saturate(1.2) contrast(1.05) brightness(.92)'],
];
const FILTER_MAP = Object.fromEntries(FILTERS.map(f => [f[0], f]));
function filterCss(m) {
  if (!m) return '';
  const base = (FILTER_MAP[m.filter] || FILTERS[0])[2];
  const a = m.adj || {};
  const parts = [base];
  if (a.b) parts.push(`brightness(${(1 + a.b / 100).toFixed(2)})`);
  if (a.c) parts.push(`contrast(${(1 + a.c / 100).toFixed(2)})`);
  if (a.s) parts.push(`saturate(${(1 + a.s / 100).toFixed(2)})`);
  if (a.t) parts.push(`sepia(${(Math.max(0, a.t) / 100).toFixed(2)})`);
  return parts.filter(Boolean).join(' ');
}
const ASPECTS = [['original', 'オリジナル'], ['1:1', '1:1'], ['4:5', '4:5'], ['16:9', '16:9']];
function aspectRatioOf(post) {
  const m = (post.media || [])[0];
  switch (post.aspect) {
    case '1:1': return 1;
    case '4:5': return 4 / 5;
    case '16:9': return 16 / 9;
    default: {
      if (!m || !m.w || !m.h) return 1;
      const r = m.w / m.h;
      return Math.min(1.91, Math.max(0.8, r));
    }
  }
}

/* ---------- Media processing ---------- */
const MAX_UPLOAD = 20 * 1024 * 1024;
async function loadImageSource(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('画像を読み込めません')); i.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 30000); }
  }
}
async function processImage(file, maxEdge = 1600, quality = 0.86) {
  if (!/^image\//.test(file.type)) throw new Error('対応していない画像形式です');
  if (file.type === 'image/gif') {
    if (file.size > MAX_UPLOAD) throw new Error('GIFは20MBまでです');
    const src = await loadImageSource(file);
    return { blob: file, type: 'image', w: src.width, h: src.height, mime: 'image/gif' };
  }
  const src = await loadImageSource(file);
  const w0 = src.width, h0 = src.height;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0, w, h);
  if (src.close) src.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('画像の変換に失敗しました');
  return { blob, type: 'image', w, h, mime: 'image/jpeg' };
}
async function processVideo(file) {
  if (!/^video\/(mp4|webm)$/.test(file.type)) throw new Error('動画はMP4またはWebM形式のみ対応しています');
  if (file.size > MAX_UPLOAD) throw new Error('動画は20MBまでです');
  const url = URL.createObjectURL(file);
  const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
  await new Promise((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('動画を読み込めません')); setTimeout(() => rej(new Error('動画の読み込みがタイムアウトしました')), 15000); });
  const w = v.videoWidth || 720, h = v.videoHeight || 1280, duration = v.duration || 0;
  let poster = null;
  try {
    v.currentTime = Math.min(0.5, (duration || 1) / 2);
    await new Promise(res => { v.onseeked = () => res(); setTimeout(res, 2000); });
    const c = document.createElement('canvas'); const s = Math.min(1, 900 / Math.max(w, h));
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    poster = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  } catch (e) { poster = null; }
  URL.revokeObjectURL(url);
  return { blob: file, type: 'video', w, h, duration, poster, mime: file.type };
}
async function processFile(file) {
  if (/^image\//.test(file.type)) return processImage(file);
  if (/^video\//.test(file.type)) return processVideo(file);
  throw new Error('画像または動画ファイルを選択してください');
}
async function processAvatar(file) {
  const src = await loadImageSource(file);
  const size = 320; const s = Math.min(src.width, src.height);
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  c.getContext('2d').drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, size, size);
  if (src.close) src.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
  return { blob, mime: 'image/jpeg' };
}

