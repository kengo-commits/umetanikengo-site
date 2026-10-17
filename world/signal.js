/* SIGNAL — a daily data artwork for KENGO'S SYNESTHESIA.
   Every day uses a different source of data and a different way of drawing it.
   Seven recipes rotate one per day; the date seeds every recipe, so no two days match.
   window.SIGNAL.draw(ctx, W, H, day, t, {when, small, level}) draws one frame. */
(function(){
  const START = Date.UTC(2026, 9, 12);                 // No. 001 = 12 Oct 2026
  const ZONES = [["PAR","Europe/Paris",48.86],["MIL","Europe/Rome",45.46],["LDN","Europe/London",51.51],["NYC","America/New_York",40.71],["SEL","Asia/Seoul",37.57],["TYO","Asia/Tokyo",35.68]];
  const TAU = Math.PI * 2;
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const W8 = a => `rgba(255,255,255,${a})`;
  function localFrac(z, when) {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: z, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(when);
    return ((+p.find(x => x.type === "hour").value % 24) * 60 + (+p.find(x => x.type === "minute").value)) / 1440;
  }
  function moon(when) { const d = (when - Date.UTC(2000, 0, 6, 18, 14)) / 864e5; return ((d % 29.530588) + 29.530588) % 29.530588 / 29.530588; }
  function dayLength(lat, when) {
    const n = Math.floor((when - Date.UTC(when.getUTCFullYear(), 0, 0)) / 864e5);
    const decl = 23.44 * Math.sin(TAU * (284 + n) / 365) * Math.PI / 180, l = lat * Math.PI / 180;
    return 24 / Math.PI * Math.acos(Math.max(-1, Math.min(1, -Math.tan(l) * Math.tan(decl))));
  }
  const bg = (c, W, H) => { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); };
  const font = (c, k) => { c.font = `500 ${k.small ? 7 : Math.round(Math.max(9, Math.min(k.W, k.H) / 70))}px Helvetica, Arial, sans-serif`; };

  const R = [
  { id: "WAVES", data: "the words of today's headlines and the time in six cities", ja: "今日の見出しの言葉と、6都市の時刻",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const padX = Math.max(k.small ? 10 : 16, W * .04), padY = H * .08, n = day.items.length || 1, band = (H - padY * 2) / n, amp = band * .42 * (1 + k.level * 1.6);
      const grp = {}; ZONES.forEach(([n2, z]) => { const f = localFrac(z, k.when), key = Math.round(f * 1440); (grp[key] = grp[key] || [f, []])[1].push(n2); });
      let end = -1e9, row = 0; Object.values(grp).sort((a, b) => a[0] - b[0]).forEach(([f, ns]) => { const n2 = ns.join("·"), x = padX + f * (W - padX * 2); row = x + 4 < end ? row + 1 : 0; const ly = padY * .55 + row * 11; c.fillStyle = W8(.14); c.fillRect(x, ly, 1, H - padY * .55 - ly + padY * .45); if (!k.small) { c.fillStyle = W8(.45); c.textBaseline = "top"; c.fillText(n2, x + 4, ly); } end = Math.max(end, x + 4 + c.measureText(n2).width + 6); });
      day.items.forEach((it, i) => {
        const y0 = padY + band * (i + .5), x0 = padX + (k.small ? 4 : 28), x1 = W - padX;
        const terms = it.title.split(/\s+/).slice(0, 7).map((w, j) => { const h = hash(w.toLowerCase() + k.seed); return { f: 1 + h % 9 + j * .37, a: 1 / (j + 1.4), p: (h % 628) / 100, s: .08 + ((h >>> 9) % 40) / 400 }; });
        const y = x => { const u = (x - x0) / (x1 - x0); let v = 0; for (const q of terms) v += q.a * Math.sin(u * TAU * q.f + q.p + t * q.s * 6); return y0 + v * amp * Math.sin(Math.PI * u); };
        if (!k.small) { c.fillStyle = W8(.45); c.textBaseline = "middle"; c.fillText((it.cat[0] + "." + String(i + 1).padStart(2, "0")).toUpperCase(), padX, y0); }
        const st = k.small ? 1.5 : 2;
        if (it.cat === "fashion") { c.strokeStyle = W8(.92); c.lineWidth = k.small ? .8 : 1.1; c.beginPath(); for (let x = x0; x <= x1; x += st) { const yy = y(x); x === x0 ? c.moveTo(x, yy) : c.lineTo(x, yy); } c.stroke(); }
        else if (it.cat === "music") { c.fillStyle = W8(.8); for (let x = x0; x <= x1; x += st * 2) { const yy = y(x); c.fillRect(x, Math.min(y0, yy), k.small ? .7 : 1, Math.abs(yy - y0) + .5); } }
        else { c.fillStyle = W8(.9); const d = k.small ? 1.4 : 2.2; for (let x = x0; x <= x1; x += st * 3.5) { const yy = y(x); c.fillRect(x - d / 2, yy - d / 2, d, d); } }
      });
    } },

  { id: "RINGS", data: "the letters of today's headlines, the phase of the moon and the time in six cities", ja: "見出しの文字、月齢、6都市の時刻",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const cx = W / 2, cy = H / 2, Rm = Math.min(W, H) * .36, n = day.items.length || 1, r0 = rng(k.seed)() * TAU;
      day.items.forEach((it, i) => {
        const r = Rm * (.26 + .74 * (i + 1) / n), letters = it.title.replace(/[^A-Za-z]/g, "").toLowerCase(), L = letters.length || 1, seg = TAU / L;
        const rot = r0 + t * (.02 + i * .006) * (i % 2 ? -1 : 1) * (1 + k.level * 3);
        c.strokeStyle = W8(it.cat === "music" ? .6 : .9); c.lineWidth = it.cat === "fashion" ? (k.small ? 1 : 1.6) : (k.small ? .6 : .9);
        for (let j = 0; j < L; j++) {
          if ("aeiou".includes(letters[j])) continue;
          const a = rot + j * seg;
          c.beginPath(); c.arc(cx, cy, r, a, a + seg * (it.cat === "design" ? .25 : .82)); c.stroke();
          if (it.cat === "music") { c.beginPath(); c.arc(cx, cy, r + (k.small ? 2 : 4), a, a + seg * .5); c.stroke(); }
        }
      });
      const ph = moon(k.when), mr = Rm * .16;                 // the moon, lit as it is today
      c.fillStyle = W8(.12); c.beginPath(); c.arc(cx, cy, mr, 0, TAU); c.fill();
      const waxing = ph < .5, rx = Math.abs(Math.cos(ph * TAU)) * mr, gib = ph > .25 && ph < .75;
      c.fillStyle = W8(.9); c.beginPath(); c.arc(cx, cy, mr, -Math.PI / 2, Math.PI / 2, !waxing); c.closePath(); c.fill();
      c.fillStyle = gib ? W8(.9) : "#000"; c.beginPath(); c.ellipse(cx, cy, Math.max(.01, rx), mr, 0, 0, TAU); c.fill();
      if (!gib) { c.fillStyle = W8(.12); c.beginPath(); c.ellipse(cx, cy, Math.max(.01, rx), mr, 0, 0, TAU); c.fill(); }
      const grp = {}; ZONES.forEach(([n2, z]) => { const f = localFrac(z, k.when), key = Math.round(f * 1440); (grp[key] = grp[key] || [f, []])[1].push(n2); });
      Object.values(grp).forEach(([f, ns]) => { const n2 = ns.join("·"), a = f * TAU - Math.PI / 2, r1 = Rm * 1.04, r2 = Rm * 1.12; c.strokeStyle = W8(.5); c.lineWidth = 1; c.beginPath(); c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); c.stroke(); if (!k.small) { c.fillStyle = W8(.45); c.textBaseline = "middle"; c.textAlign = "center"; const tw = c.measureText(n2).width / 2 + 4; c.fillText(n2, Math.min(W - tw, Math.max(tw, cx + Math.cos(a) * Rm * 1.2)), cy + Math.sin(a) * Rm * 1.2); c.textAlign = "left"; } });
    } },

  { id: "BARCODE", data: "the characters of today's Japanese summaries", ja: "日本語の要約の一文字一文字",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const padX = W * .05, padY = H * .1, n = day.items.length || 1, band = (H - padY * 2) / n, gap = band * .28, span = W - padX * 2;
      day.items.forEach((it, i) => {
        const y = padY + band * i, chars = [...it.ja], bars = chars.map(ch => { const u = ch.codePointAt(0); return { w: 1 + u % 4, a: .2 + ((u >> 3) % 10) / 12 }; });
        const total = bars.reduce((s, b) => s + b.w + 1, 0), scale = span / total * 1.6, off = ((t * (12 + i * 3) * (i % 2 ? 1 : -1)) % (total * scale) + total * scale) % (total * scale);
        c.save(); c.beginPath(); c.rect(padX, y, span, band - gap); c.clip();
        for (let rep = -1; rep <= 1; rep++) { let x = padX - off + rep * total * scale; for (const b of bars) { if (x > padX - 10 && x < W) { c.fillStyle = W8(Math.min(1, b.a * (1 + k.level))); c.fillRect(x, y, b.w * scale * .8, band - gap); } x += (b.w + 1) * scale; } }
        c.restore();
        if (!k.small) { c.fillStyle = W8(.45); c.textBaseline = "top"; c.fillText((it.cat[0] + "." + String(i + 1).padStart(2, "0") + "  " + chars.length + " CHARACTERS").toUpperCase(), padX, y + band - gap + 3); }
      });
    } },

  { id: "CONSTELLATION", data: "where today's stories come from — their sources, categories and lengths", ja: "記事の出どころ（媒体・ジャンル）と文章の長さ",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const r = rng(k.seed);
      for (let i = 0; i < (k.small ? 60 : 160); i++) { c.fillStyle = W8(.08 + r() * .25); const s = r() < .1 ? 1.4 : .8; c.fillRect(r() * W, r() * H, s, s); }
      const pts = day.items.map(it => { const h = hash(it.url + k.seed), h2 = hash(it.source + it.cat); return { it, x: W * (.12 + .76 * ((h % 1000) / 1000)), y: H * (.14 + .72 * (((h >>> 10) % 1000) / 1000)), s: 1.5 + it.ja.length / 40, ph: (h2 % 628) / 100 }; });
      pts.forEach(p => { p.dx = p.x + Math.sin(t * .15 + p.ph) * W * .015; p.dy = p.y + Math.cos(t * .12 + p.ph) * H * .015; });
      c.lineWidth = .8;
      pts.forEach((a, i) => pts.forEach((b, j) => { if (j <= i) return; if (a.it.cat === b.it.cat) { c.strokeStyle = W8(.55); c.setLineDash([]); } else if (a.it.source === b.it.source) { c.strokeStyle = W8(.22); c.setLineDash([2, 4]); } else return; c.beginPath(); c.moveTo(a.dx, a.dy); c.lineTo(b.dx, b.dy); c.stroke(); }));
      c.setLineDash([]);
      pts.forEach(p => { const s = p.s * (k.small ? .6 : 1) * (1 + k.level); c.fillStyle = W8(.95); c.beginPath(); c.arc(p.dx, p.dy, s, 0, TAU); c.fill(); c.strokeStyle = W8(.25); c.beginPath(); c.arc(p.dx, p.dy, s * 3, 0, TAU); c.stroke(); if (!k.small) { const lab = p.it.source.toUpperCase(), lw = c.measureText(lab).width; c.fillStyle = W8(.5); c.textBaseline = "middle"; c.fillText(lab, p.dx + s * 3 + 5 + lw > W - 6 ? p.dx - s * 3 - 5 - lw : p.dx + s * 3 + 5, p.dy); } });
    } },

  { id: "LETTERS", data: "how often each letter from A to Z appears in today's headlines, by category", ja: "見出しに出てくるA〜Zの文字の数（ジャンル別）",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const cats = ["fashion", "music", "design"], AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const counts = cats.map(ct => { const m = {}; day.items.filter(i => i.cat === ct).forEach(i => [...i.title.toUpperCase()].forEach(ch => { if (AZ.includes(ch)) m[ch] = (m[ch] || 0) + 1; })); return m; });
      const max = Math.max(1, ...counts.flatMap(m => Object.values(m)));
      const cols = W > H ? 26 : 13, per = 26 / cols, rows = cats.length * per, G = .9, padX = W * .07, padY = H * .1, cw = (W - padX * 2) / cols, rh = (H - padY * 2) / (rows + cats.length * G), cell = Math.min(cw, rh) * .7;
      cats.forEach((ct, ci) => { for (let a = 0; a < 26; a++) {
        const col = a % cols, row = ci * per + Math.floor(a / cols), v = (counts[ci][AZ[a]] || 0) / max;
        const x = padX + col * cw + cw / 2, y = padY + (row + (ci + 1) * G) * rh + rh / 2, s = cell * Math.sqrt(v) * (1 + .06 * Math.sin(t * .8 + a * .4 + ci)) * (1 + k.level * .5);
        c.strokeStyle = W8(.12); c.lineWidth = .6; c.strokeRect(x - cell / 2, y - cell / 2, cell, cell);
        if (v > 0) { c.fillStyle = W8(.35 + .6 * v); if (ct === "music") { c.beginPath(); c.arc(x, y, s / 2, 0, TAU); c.fill(); } else if (ct === "design") { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-s / 2.8, -s / 2.8, s / 1.4, s / 1.4); c.restore(); } else c.fillRect(x - s / 2, y - s / 2, s, s); }
        if (!k.small) { c.fillStyle = W8(.4); c.textBaseline = "top"; c.textAlign = "center"; c.fillText(AZ[a], x, y + cell / 2 + 2); c.textAlign = "left"; }
      } if (!k.small) { c.fillStyle = W8(.45); c.textBaseline = "bottom"; c.fillText(ct.toUpperCase(), padX, padY + (ci * per + (ci + 1) * G) * rh - 2); } });
    } },

  { id: "ORBITS", data: "the sentences and words of today's Kengo's Note", ja: "今日の KENGO'S NOTE の文と言葉",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const text = (day.note && day.note.en) || day.items.map(i => i.title + ".").join(" ");
      const sents = text.split(/(?<=[.!?])\s+/).filter(Boolean), cx = W / 2, cy = H / 2, Rm = Math.min(W, H) * .44, r0 = rng(k.seed)() * TAU;
      c.fillStyle = W8(.9); c.beginPath(); c.arc(cx, cy, k.small ? 2 : 3, 0, TAU); c.fill();
      sents.forEach((s, i) => {
        const r = Rm * (i + 1) / sents.length, words = s.split(/\s+/);
        c.strokeStyle = W8(.12); c.lineWidth = .7; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke();
        const sp = .12 / Math.sqrt(i + 1) * (1 + k.level * 2);
        words.forEach((w, j) => { const a = r0 + i * .9 + j / words.length * TAU + t * sp * (i % 2 ? -1 : 1), d = Math.max(1, w.replace(/\W/g, "").length * (k.small ? .35 : .6)); c.fillStyle = W8(.35 + Math.min(.6, w.length / 12)); c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, d, 0, TAU); c.fill(); });
        if (!k.small) { c.fillStyle = W8(.4); c.textBaseline = "middle"; c.fillText(String(words.length).padStart(2, "0") + " WORDS", cx + 6, cy - r - 6); }
      });
    } },

  { id: "DAYLIGHT", data: "the length of daylight and the time of day in six cities", ja: "6都市の日照時間と、今の時刻",
    draw(c, W, H, day, t, k) {
      bg(c, W, H); font(c, k);
      const padX = W * .06, padY = H * .12, band = (H - padY * 2) / ZONES.length, span = W - padX * 2;
      for (let h = 0; h <= 24; h += 6) { const x = padX + h / 24 * span; c.fillStyle = W8(.15); c.fillRect(x, padY * .7, 1, H - padY * 1.4); if (!k.small && h < 24) { c.fillStyle = W8(.4); c.textBaseline = "top"; c.fillText(String(h).padStart(2, "0") + ":00", x + 3, padY * .7); } }
      ZONES.forEach(([n2, z, lat], i) => {
        const y = padY + band * i + band * .2, bh = band * .6, L = dayLength(lat, k.when), a = 12 - L / 2, b = 12 + L / 2;
        const steps = k.small ? 60 : 160;
        for (let s = 0; s < steps; s++) { const hr = s / steps * 24, x = padX + hr / 24 * span, sun = Math.max(0, Math.sin(Math.PI * (hr - a) / L)); if (hr < a || hr > b) continue; c.fillStyle = W8(.1 + .8 * sun * (1 + .05 * Math.sin(t * .6 + s * .2))); c.fillRect(x, y + bh * (1 - sun) / 2, span / steps + .5, bh * sun); }
        const nx = padX + localFrac(z, k.when) * span; c.fillStyle = W8(1); c.fillRect(nx - .5, y - 4, 1.5, bh + 8);
        if (!k.small) { c.fillStyle = W8(.5); c.textBaseline = "middle"; c.fillText(n2 + "  " + L.toFixed(1) + "H", 6, y + bh / 2); }
      });
    } }
  ];

  function no(date) { return Math.round((Date.parse(date + "T00:00:00Z") - START) / 864e5) + 1; }
  function pick(date) { const n = no(date); return { no: n, recipe: R[((n - 1) % R.length + R.length) % R.length] }; }
  function draw(c, W, H, day, t, o) {
    const p = pick(day.date), k = Object.assign({ small: false, level: 0, when: new Date(day.date + "T07:30:00+09:00") }, o || {});
    k.seed = hash(day.date + "|" + p.recipe.id); k.W = W; k.H = H;
    c.save(); p.recipe.draw(c, W, H, day, t || 0, k); c.restore();
    return p;
  }
  function meta(date) { const p = pick(date); return { no: p.no, id: p.recipe.id, data: p.recipe.data, ja: p.recipe.ja, label: "SYNESTHESIA DIGITAL ART by KENGO — No. " + String(p.no).padStart(3, "0") + " — " + p.recipe.id }; }
  window.SIGNAL = { draw, meta, recipes: R.map(r => r.id) };

  /* ---------- page: live piece at the top, one still per day in the archive ---------- */
  if (typeof document === "undefined" || !document.getElementById("news-data")) return;
  const E = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const fmt = s => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  function fit(cv) { const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); const cx = cv.getContext("2d"); cx.setTransform(dpr, 0, 0, dpr, 0, 0); return [cx, r.width, r.height]; }
  let days = [], shown = "";
  function load(N) {
    if (!N || !N.days || !N.days.length || (N.updated || "") < shown) return;
    shown = N.updated || "0"; days = N.days.slice().sort((a, b) => a.date < b.date ? 1 : -1);
    const m = meta(days[0].date), set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set("signalName", m.label); set("signalData", "Drawn from " + m.data + "."); set("signalJa", m.ja + "から描いています。"); set("signalDate", days[0].date);
    gallery();
  }
  function gallery() {
    const g = document.getElementById("signals"); if (!g) return;
    g.innerHTML = "";
    const lim = Number(g.dataset.limit) || Infinity, more = document.getElementById("moreArt");
    if (more) more.hidden = !(days.length > lim);
    days.slice(0, lim).forEach(d => { const m = meta(d.date), f = document.createElement("figure"); f.className = "sg"; f.innerHTML = `<canvas aria-label="${E(m.label)}"></canvas><figcaption><span class="no">S.${String(m.no).padStart(3, "0")}</span><span class="t">${E(fmt(d.date))} · ${E(m.id)}</span></figcaption>`; g.appendChild(f); });
    requestAnimationFrame(() => [...g.querySelectorAll("canvas")].forEach((cv, i) => { const [cx, W, H] = fit(cv); draw(cx, W, H, days[i], 0, { small: true }); watch(cv, i, cx, W, H); }));
  }
  /* archive pieces move only while they are on screen (and the tab is visible): the number of drawings per second
     stays the same however many days the archive holds */
  const live = new Map();
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { const v = live.get(e.target); if (v) v.on = e.isIntersecting; }), { rootMargin: "80px" }) : null;
  function watch(cv, i, cx, W, H) { if (!io) return; live.set(cv, { i, cx, W, H, on: false }); io.observe(cv); }
  const galleryStill = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let gLast = 0;
  function galleryLoop(ts) {
    if (!galleryStill && !document.hidden && ts - gLast > 40) {   // about 25 frames a second
      gLast = ts;
      live.forEach((v, cv) => { if (v.on && cv.isConnected && days[v.i]) draw(v.cx, v.W, v.H, days[v.i], ts / 1000, { small: true }); else if (!cv.isConnected) { live.delete(cv); io.unobserve(cv); } });
    }
    requestAnimationFrame(galleryLoop);
  }
  requestAnimationFrame(galleryLoop);
  try { load(JSON.parse(document.getElementById("news-data").textContent)); } catch (e) {}
  try { fetch("news.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(N => { if (N) load(N); }).catch(() => {}); } catch (e) {}
  let gw = 0; addEventListener("resize", () => { const g = document.getElementById("signals"); if (g && Math.abs(g.clientWidth - gw) > 40) { gw = g.clientWidth; gallery(); } });
  const cv = document.getElementById("signal"); if (!cv) return;
  let ctx, W, H; const size = () => { [ctx, W, H] = fit(cv); }; size(); addEventListener("resize", size);
  const buf = new Uint8Array(1024);
  const level = () => { try { if (typeof playing !== "undefined" && playing && an) { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i += 4) { const v = (buf[i] - 128) / 128; s += v * v; } return Math.min(1, Math.sqrt(s / (buf.length / 4)) * 4); } } catch (e) {} return 0; };
  const still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let now = new Date(), last = 0;
  function loop(ts) { if (ts - last > 30000) { now = new Date(); last = ts; } if (days.length) draw(ctx, W, H, days[0], ts / 1000, { when: now, level: level() }); if (!still) requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
})();
