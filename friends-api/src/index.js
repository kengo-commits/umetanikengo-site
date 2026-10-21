// KENGO FRIEND SNS — API on Cloudflare Workers (D1 + R2)
import { KFS_MUT as M } from './mutations.js';

const JSON_LIMIT = 256 * 1024;
const DOC_LIMIT = 256 * 1024;
const MEDIA_LIMIT = 20 * 1024 * 1024;
const MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/webm']);
const TOKEN_DAYS = 180;
const PBKDF2_ITER = 6000;
const PUBLIC_COLS = ['users', 'posts', 'comments', 'likes', 'follows', 'stories', 'storyviews', 'tracks'];
const SELF_COLS = new Set(['users', 'likes', 'follows', 'stories', 'storyviews']);
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/;

class HttpError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code || 'error'; } }
const bad = (msg, code) => new HttpError(400, msg, code || 'bad_request');
const denied = (msg) => new HttpError(403, msg || 'この操作を行う権限がありません', 'forbidden');
const notFound = (msg) => new HttpError(404, msg || '見つかりません', 'not_found');

/* ---------- small helpers ---------- */
const enc = new TextEncoder();
const now = () => Date.now();
function uid(n = 16) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); }
function hex(buf) { return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join(''); }
function b64url(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64urlDecode(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
function hashInt(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function safeSegment(s) { return String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, '-').slice(0, 180); }
function extractTags(text) { const out = new Set(); for (const m of String(text || '').matchAll(/#([\p{L}\p{N}_]+)/gu)) out.add(m[1].toLowerCase()); return Array.from(out).slice(0, 30); }
function extractMentions(text) { const out = new Set(); for (const m of String(text || '').matchAll(/@([a-z0-9._]{2,30})/gi)) out.add(m[1].toLowerCase()); return Array.from(out); }
function clean(s, max) { return String(s == null ? '' : s).slice(0, max); }
function isPlainObject(o) { return o && typeof o === 'object' && !Array.isArray(o); }
function threadIdFor(ids) {
  ids = Array.from(new Set(ids)).sort();
  if (ids.length === 2) { const s = 'dm_' + ids.map(safeSegment).join('__'); return s.length <= 190 ? s : 'dm_' + hashInt(ids[0]).toString(36) + '_' + hashInt(ids[1]).toString(36); }
  return 't' + uid(14);
}

/* ---------- settings & crypto ---------- */
let secretCache = null;
async function getSetting(env, key) { const r = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first(); return r ? r.value : null; }
async function setSetting(env, key, value) { await env.DB.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, value, now()).run(); }
async function getSecret(env) {
  if (secretCache) return secretCache;
  let s = await getSetting(env, 'session_secret');
  if (!s) { s = hex(crypto.getRandomValues(new Uint8Array(32))); await setSetting(env, 'session_secret', s); }
  secretCache = s; return s;
}
async function hmacKey(secret) { return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }
async function signToken(env, payload) {
  const key = await hmacKey(await getSecret(env));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return body + '.' + b64url(sig);
}
async function verifyToken(env, token) {
  const i = token.indexOf('.'); if (i < 0) return null;
  const body = token.slice(0, i), sig = token.slice(i + 1);
  try {
    const key = await hmacKey(await getSecret(env));
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload.uid || !payload.exp || payload.exp < now()) return null;
    return payload;
  } catch (e) { return null; }
}
async function hashPassword(env, password, saltHex) {
  const pepper = await getSecret(env);
  const key = await crypto.subtle.importKey('raw', enc.encode(password + '\u0000' + pepper), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64urlDecode(saltHex), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
function timingEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* ---------- documents ---------- */
function rowToDoc(r) { if (r.deleted) return { id: r.id, _deleted: true, updatedAt: r.updated_at }; const d = JSON.parse(r.data); d.id = r.id; return d; }
async function getDoc(env, col, id) { const r = await env.DB.prepare('SELECT * FROM docs WHERE col = ? AND id = ?').bind(col, id).first(); return r && !r.deleted ? rowToDoc(r) : null; }
async function getRow(env, col, id) { return env.DB.prepare('SELECT * FROM docs WHERE col = ? AND id = ?').bind(col, id).first(); }
function docJson(doc) { const d = Object.assign({}, doc); delete d.id; const s = JSON.stringify(d); if (s.length > DOC_LIMIT) throw bad('データが大きすぎます', 'too_large'); return s; }
function putStmt(env, col, id, doc, ownerId, ts) {
  return env.DB.prepare('INSERT INTO docs (col, id, data, owner_id, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?) ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, owner_id = COALESCE(excluded.owner_id, docs.owner_id), deleted = 0, updated_at = excluded.updated_at')
    .bind(col, id, docJson(doc), ownerId, ts, ts);
}
async function putDoc(env, col, id, doc, ownerId) { const ts = now(); doc.updatedAt = ts; await putStmt(env, col, id, doc, ownerId, ts).run(); doc.id = id; return doc; }
function delStmt(env, col, id, ts) { return env.DB.prepare('UPDATE docs SET deleted = 1, data = ?, updated_at = ? WHERE col = ? AND id = ?').bind('{}', ts, col, id); }
async function mutateDoc(env, col, id, fn, ownerId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await getRow(env, col, id);
    const cur = row && !row.deleted ? rowToDoc(row) : null;
    const ts = now();
    const next = fn(cur ? JSON.parse(JSON.stringify(cur)) : null, ts);
    if (next === undefined) return cur;
    if (next === null) { await delStmt(env, col, id, ts).run(); return null; }
    delete next.id; next.updatedAt = ts;
    let res;
    if (row) res = await env.DB.prepare('UPDATE docs SET data = ?, owner_id = COALESCE(?, owner_id), deleted = 0, updated_at = ? WHERE col = ? AND id = ? AND updated_at = ?').bind(docJson(next), ownerId || null, ts, col, id, row.updated_at).run();
    else res = await env.DB.prepare('INSERT OR IGNORE INTO docs (col, id, data, owner_id, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)').bind(col, id, docJson(next), ownerId || null, ts, ts).run();
    if (res.meta.changes > 0) { next.id = id; return next; }
    await new Promise(r => setTimeout(r, 20 + Math.random() * 60));
  }
  throw new HttpError(409, '他の操作と重なりました。もう一度お試しください', 'conflict');
}

/* ---------- request plumbing ---------- */
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'Vary': 'Origin' };
  if (allowed.includes(origin) || allowed.includes('*')) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Authorization, Content-Type, X-File-Name, Range';
    h['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Accept-Ranges, ETag';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra) }); }
async function readJson(req) {
  const len = Number(req.headers.get('Content-Length') || 0); if (len > JSON_LIMIT) throw bad('リクエストが大きすぎます', 'too_large');
  const text = await req.text(); if (text.length > JSON_LIMIT) throw bad('リクエストが大きすぎます', 'too_large');
  try { return text ? JSON.parse(text) : {}; } catch (e) { throw bad('JSONを読み取れません'); }
}
async function auth(req, env, required = true) {
  const h = req.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) { if (required) throw new HttpError(401, 'サインインが必要です', 'unauthorized'); return null; }
  const p = await verifyToken(env, token);
  if (!p) { if (required) throw new HttpError(401, 'サインインの有効期限が切れました', 'unauthorized'); return null; }
  const m = await env.DB.prepare('SELECT id, username, is_owner, disabled, token_version, last_seen FROM members WHERE id = ?').bind(p.uid).first();
  if (!m || m.disabled || m.token_version !== p.v) { if (required) throw new HttpError(401, 'このアカウントは利用できません', 'unauthorized'); return null; }
  return { uid: m.id, username: m.username, isOwner: !!m.is_owner, lastSeen: m.last_seen };
}

/* ---------- auth routes ---------- */
async function memberCount(env) { const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM members').first(); return r ? r.n : 0; }
async function issueToken(env, m) { return signToken(env, { uid: m.id, v: m.token_version, exp: now() + TOKEN_DAYS * 86400000 }); }
async function signup(req, env) {
  const b = await readJson(req);
  const username = String(b.username || '').toLowerCase().trim();
  const password = String(b.password || '');
  if (!USERNAME_RE.test(username) || /\.\./.test(username)) throw bad('ユーザー名は3〜30文字の半角英数字・ピリオド・アンダースコアで、先頭と末尾は英数字にしてください', 'username');
  if (password.length < 8 || password.length > 200) throw bad('パスワードは8文字以上にしてください', 'password');
  const count = await memberCount(env);
  const isOwner = count === 0;
  if (!isOwner) {
    const code = await getSetting(env, 'invite_code');
    if (!code || !timingEqual(String(b.invite || '').trim(), code)) throw new HttpError(403, '合言葉が違います', 'invite');
  }
  const exists = await env.DB.prepare('SELECT id FROM members WHERE username = ?').bind(username).first();
  if (exists) throw bad('このユーザー名はすでに使われています', 'username_taken');
  const id = 'u' + uid(15); const salt = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await hashPassword(env, password, salt); const ts = now();
  const userDoc = { username, name: clean(b.name, 60).trim(), bio: '', website: '', avatar: null, createdAt: ts, updatedAt: ts };
  if (isOwner) userDoc.owner = true;
  const stmts = [
    env.DB.prepare('INSERT INTO members (id, username, pw_hash, pw_salt, is_owner, disabled, token_version, last_seen, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)').bind(id, username, hash, salt, isOwner ? 1 : 0, ts, ts, ts),
    putStmt(env, 'users', id, userDoc, id, ts),
  ];
  if (isOwner && b.newInvite) stmts.push(env.DB.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind('invite_code', clean(b.newInvite, 64).trim(), ts));
  await env.DB.batch(stmts);
  const token = await issueToken(env, { id, token_version: 1 });
  return json({ token, uid: id, isOwner });
}
async function login(req, env) {
  const b = await readJson(req);
  const username = String(b.username || '').toLowerCase().trim();
  const m = await env.DB.prepare('SELECT * FROM members WHERE username = ?').bind(username).first();
  if (!m) throw new HttpError(401, 'ユーザー名かパスワードが違います', 'bad_login');
  const hash = await hashPassword(env, String(b.password || ''), m.pw_salt);
  if (!timingEqual(hash, m.pw_hash)) throw new HttpError(401, 'ユーザー名かパスワードが違います', 'bad_login');
  if (m.disabled) throw new HttpError(403, 'このアカウントは停止されています', 'disabled');
  const token = await issueToken(env, m);
  return json({ token, uid: m.id, isOwner: !!m.is_owner });
}
async function changePassword(req, env, me) {
  const b = await readJson(req);
  const m = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(me.uid).first();
  const cur = await hashPassword(env, String(b.current || ''), m.pw_salt);
  if (!timingEqual(cur, m.pw_hash)) throw bad('現在のパスワードが違います', 'bad_password');
  const next = String(b.next || ''); if (next.length < 8 || next.length > 200) throw bad('新しいパスワードは8文字以上にしてください', 'password');
  const salt = b64url(crypto.getRandomValues(new Uint8Array(16))); const hash = await hashPassword(env, next, salt);
  const v = m.token_version + 1;
  await env.DB.prepare('UPDATE members SET pw_hash = ?, pw_salt = ?, token_version = ?, updated_at = ? WHERE id = ?').bind(hash, salt, v, now(), me.uid).run();
  const token = await issueToken(env, { id: me.uid, token_version: v });
  return json({ ok: true, token });
}
async function logoutAll(env, me) {
  await env.DB.prepare('UPDATE members SET token_version = token_version + 1, updated_at = ? WHERE id = ?').bind(now(), me.uid).run();
  return json({ ok: true });
}
async function whoami(env, me) {
  const user = await getDoc(env, 'users', me.uid);
  const privRow = await env.DB.prepare('SELECT data FROM priv WHERE user_id = ?').bind(me.uid).first();
  const invite = me.isOwner ? await getSetting(env, 'invite_code') : null;
  return json({ uid: me.uid, isOwner: me.isOwner, user, priv: privRow ? JSON.parse(privRow.data) : null, invite, members: await memberCount(env) });
}
async function status(env) { const n = await memberCount(env); return json({ ok: true, open: n === 0, members: n }); }

/* ---------- sync ---------- */
async function sync(req, env, me, url) {
  const since = Math.max(0, Number(url.searchParams.get('since') || 0));
  const from = since ? since - 1500 : 0;
  const ts = now();
  const cols = {};
  const stmts = [];
  for (const col of PUBLIC_COLS) {
    const limit = since ? 1000 : (col === 'posts' || col === 'comments' ? 400 : 5000);
    stmts.push(env.DB.prepare('SELECT col, id, data, deleted, updated_at FROM docs WHERE col = ? AND updated_at > ? ORDER BY updated_at DESC LIMIT ?').bind(col, from, limit));
  }
  stmts.push(env.DB.prepare('SELECT d.col, d.id, d.data, d.deleted, d.updated_at FROM docs d JOIN thread_members tm ON tm.thread_id = d.id AND tm.user_id = ? WHERE d.col = ? AND d.updated_at > ? ORDER BY d.updated_at DESC LIMIT 200').bind(me.uid, 'threads', from));
  stmts.push(env.DB.prepare('SELECT data, updated_at FROM priv WHERE user_id = ? AND updated_at > ?').bind(me.uid, from));
  stmts.push(env.DB.prepare('SELECT id FROM members WHERE last_seen > ? AND disabled = 0').bind(ts - 90000));
  if (url.searchParams.get('ping') === '1' && ts - (me.lastSeen || 0) > 45000) stmts.push(env.DB.prepare('UPDATE members SET last_seen = ? WHERE id = ?').bind(ts, me.uid));
  const results = await env.DB.batch(stmts);
  PUBLIC_COLS.forEach((col, i) => { cols[col] = results[i].results.map(rowToDoc); });
  cols.threads = results[PUBLIC_COLS.length].results.map(rowToDoc);
  const privRes = results[PUBLIC_COLS.length + 1].results[0];
  const online = results[PUBLIC_COLS.length + 2].results.map(r => r.id);
  if (url.searchParams.get('ping') === '1' && !online.includes(me.uid)) online.push(me.uid);
  return json({ now: ts, cols, priv: privRes ? JSON.parse(privRes.data) : undefined, online, full: !since });
}

/* ---------- docs routes ---------- */
async function putDocRoute(req, env, me, col, id) {
  const body = await readJson(req);
  if (!isPlainObject(body)) throw bad('ドキュメントはオブジェクトで送ってください');
  const ts = now();
  if (SELF_COLS.has(col)) {
    if (id !== me.uid && !(me.isOwner && col === 'users')) throw denied();
    if (col === 'users') {
      const m = await env.DB.prepare('SELECT username FROM members WHERE id = ?').bind(id).first();
      if (!m) throw notFound();
      const cur = await getDoc(env, 'users', id) || {};
      const doc = { username: m.username, name: clean(body.name, 60).trim(), bio: clean(body.bio, 150), website: clean(body.website, 120).trim(), avatar: typeof body.avatar === 'string' ? body.avatar.slice(0, 64) : (body.avatar === null ? null : cur.avatar || null), createdAt: cur.createdAt || ts, updatedAt: ts };
      if (cur.owner) doc.owner = true;
      return json(await putDoc(env, 'users', id, doc, id));
    }
    return json(await putDoc(env, col, id, body, id));
  }
  if (col === 'posts') {
    const cur = await getDoc(env, 'posts', id);
    if (cur && cur.authorId !== me.uid && !me.isOwner) throw denied();
    if (!cur && !/^p[a-z0-9]{6,40}$/.test(id)) throw bad('投稿IDが不正です');
    const media = Array.isArray(body.media) ? body.media.slice(0, 10).map(m => ({ id: String(m.id || '').slice(0, 64), type: m.type === 'video' ? 'video' : 'image', w: Number(m.w) || 0, h: Number(m.h) || 0, duration: m.duration ? Number(m.duration) : undefined, poster: m.poster ? String(m.poster).slice(0, 64) : undefined, filter: m.filter ? String(m.filter).slice(0, 20) : undefined, adj: isPlainObject(m.adj) ? m.adj : undefined, alt: m.alt ? clean(m.alt, 200) : undefined })) : (cur ? cur.media : []);
    if (!media.length) throw bad('写真または動画がありません');
    await assertOwnMedia(env, media.flatMap(m => [m.id, m.poster]), cur ? cur.authorId : me.uid, cur ? (cur.media || []).flatMap(m => [m.id, m.poster]) : []);
    const caption = clean(body.caption, 2200);
    const doc = {
      authorId: cur ? cur.authorId : me.uid, caption, media, aspect: ['original', '1:1', '4:5', '16:9'].includes(body.aspect) ? body.aspect : (cur ? cur.aspect : 'original'),
      location: clean(body.location, 80), tags: extractTags(caption), mentions: extractMentions(caption), createdAt: cur ? cur.createdAt : ts, updatedAt: ts,
      hideLikes: !!body.hideLikes, commentsOff: !!body.commentsOff, kind: body.kind === 'reel' ? 'reel' : 'post',
    };
    return json(await putDoc(env, 'posts', id, doc, doc.authorId));
  }
  if (col === 'tracks') {
    const cur = await getDoc(env, 'tracks', id);
    if (cur && cur.ownerId !== me.uid && !me.isOwner) throw denied();
    if (!cur && !/^t[a-z0-9]{6,40}$/.test(id)) throw bad('曲IDが不正です');
    const mediaId = cur ? cur.media.id : String(body.media && body.media.id || '').slice(0, 64);
    if (!mediaId) throw bad('音声ファイルがありません');
    const newCover = typeof body.cover === 'string' ? body.cover.slice(0, 64) : null;
    await assertOwnMedia(env, [mediaId, newCover], cur ? cur.ownerId : me.uid, cur ? [cur.media && cur.media.id, cur.cover] : []);
    const title = clean(body.title, 120).trim(); if (!title) throw bad('曲名を入力してください');
    const doc = {
      ownerId: cur ? cur.ownerId : me.uid, title, artist: clean(body.artist, 120).trim(), note: clean(body.note, 300),
      media: { id: mediaId, duration: Number((body.media && body.media.duration) || (cur && cur.media.duration) || 0) || 0, type: 'audio' },
      cover: typeof body.cover === 'string' ? body.cover.slice(0, 64) : (body.cover === null ? null : (cur ? cur.cover : null)),
      createdAt: cur ? cur.createdAt : ts, updatedAt: ts,
    };
    return json(await putDoc(env, 'tracks', id, doc, doc.ownerId));
  }
  throw denied('このコレクションには直接書き込めません');
}
async function deleteDocRoute(env, me, col, id) {
  if (col === 'posts') {
    const cur = await getDoc(env, 'posts', id);
    if (!cur) return json({ ok: true });
    if (cur.authorId !== me.uid && !me.isOwner) throw denied();
    const ts = now();
    await env.DB.batch([delStmt(env, 'posts', id, ts), delStmt(env, 'comments', id, ts)]);
    await removeOwnedMedia(env, (cur.media || []).flatMap(m => [m.id, m.poster]), cur.authorId);
    return json({ ok: true });
  }
  if (col === 'tracks') {
    const cur = await getDoc(env, 'tracks', id);
    if (!cur) return json({ ok: true });
    if (cur.ownerId !== me.uid && !me.isOwner) throw denied();
    await delStmt(env, 'tracks', id, now()).run();
    await removeOwnedMedia(env, [cur.media && cur.media.id, cur.cover], cur.ownerId);
    return json({ ok: true });
  }
  throw denied();
}

/* ---------- atomic operations ---------- */
async function requireMember(env, threadId, uidv) { const r = await env.DB.prepare('SELECT 1 AS ok FROM thread_members WHERE thread_id = ? AND user_id = ?').bind(threadId, uidv).first(); if (!r) throw denied('このスレッドのメンバーではありません'); }
/* Media in R2 belongs to whoever uploaded it (media.owner_id). A post or track may only reference its author's own
   uploads, and deleting one removes only files that author owns, so nobody can delete another member's files. */
async function assertOwnMedia(env, keys, authorId, alreadyAttached) {
  const keep = new Set((alreadyAttached || []).filter(Boolean));
  for (const key of new Set(keys.filter(Boolean))) {
    if (keep.has(key)) continue;
    const row = await env.DB.prepare('SELECT owner_id FROM media WHERE id = ?').bind(key).first();
    if (!row || row.owner_id !== authorId) throw bad('使えないファイルが含まれています');
  }
}
async function removeOwnedMedia(env, keys, ownerId) {
  for (const key of new Set(keys.filter(Boolean))) {
    try {
      const row = await env.DB.prepare('SELECT owner_id FROM media WHERE id = ?').bind(key).first();
      if (!row || row.owner_id !== ownerId) continue;
      await env.MEDIA.delete(key);
      await env.DB.prepare('DELETE FROM media WHERE id = ? AND owner_id = ?').bind(key, ownerId).run();
    } catch (e) { /* best effort */ }
  }
}
function cleanMedia(m) { if (!isPlainObject(m) || !m.id) return undefined; return { id: String(m.id).slice(0, 64), type: m.type === 'video' ? 'video' : 'image', w: Number(m.w) || 0, h: Number(m.h) || 0, duration: m.duration ? Number(m.duration) : undefined, poster: m.poster ? String(m.poster).slice(0, 64) : undefined, filter: m.filter ? String(m.filter).slice(0, 20) : undefined, adj: isPlainObject(m.adj) ? m.adj : undefined, alt: m.alt ? clean(m.alt, 200) : undefined }; }
async function op(req, env, me, name) {
  const b = await readJson(req);
  const ts = now();
  switch (name) {
    case 'comment.add': {
      const pid = String(b.postId || ''); const post = await getDoc(env, 'posts', pid); if (!post) throw notFound('投稿が見つかりません');
      if (post.commentsOff && post.authorId !== me.uid) throw denied('この投稿へのコメントはオフになっています');
      const text = clean(b.text, 1000).trim(); if (!text) throw bad('コメントを入力してください');
      const item = { id: 'c' + uid(10), authorId: me.uid, text, createdAt: ts, parentId: b.parentId ? String(b.parentId).slice(0, 40) : null, mentions: extractMentions(text), likedBy: {} };
      const doc = await mutateDoc(env, 'comments', pid, (cur, t) => M.commentAdd(cur, pid, item, t), post.authorId);
      return json({ doc, item });
    }
    case 'comment.delete': {
      const pid = String(b.postId || ''); const cid = String(b.commentId || '');
      const post = await getDoc(env, 'posts', pid); const doc = await getDoc(env, 'comments', pid); if (!doc) return json({ doc: null });
      const it = (doc.items || []).find(i => i.id === cid); if (!it) return json({ doc });
      if (it.authorId !== me.uid && (!post || post.authorId !== me.uid) && !me.isOwner) throw denied();
      return json({ doc: await mutateDoc(env, 'comments', pid, (cur, t) => M.commentDelete(cur, cid, t)) });
    }
    case 'comment.like': {
      const pid = String(b.postId || ''); const cid = String(b.commentId || '');
      return json({ doc: await mutateDoc(env, 'comments', pid, (cur, t) => M.commentToggleLike(cur, cid, me.uid, t)) });
    }
    case 'like.set': {
      const pid = String(b.postId || '');
      return json({ doc: await mutateDoc(env, 'likes', me.uid, (cur, t) => M.likesSet(cur, pid, !!b.on, t), me.uid) });
    }
    case 'follow.set': {
      const target = String(b.targetId || ''); if (target === me.uid) throw bad('自分はフォローできません');
      return json({ doc: await mutateDoc(env, 'follows', me.uid, (cur, t) => M.followsSet(cur, target, !!b.on, t), me.uid) });
    }
    case 'follow.remove': {
      const follower = String(b.followerId || '');
      return json({ doc: await mutateDoc(env, 'follows', follower, (cur, t) => M.followsRemove(cur, me.uid, t)) });
    }
    case 'story.add': {
      const media = cleanMedia(b.media); if (!media) throw bad('写真または動画がありません');
      const story = { id: 's' + uid(10), media, createdAt: ts, caption: clean(b.caption, 200) };
      return json({ doc: await mutateDoc(env, 'stories', me.uid, (cur, t) => M.storyAdd(cur, story, t), me.uid), story });
    }
    case 'story.delete': {
      const sid = String(b.storyId || '');
      return json({ doc: await mutateDoc(env, 'stories', me.uid, (cur, t) => M.storyDelete(cur, sid, t), me.uid) });
    }
    case 'storyview.mark': {
      const seen = isPlainObject(b.seen) ? b.seen : {};
      return json({ doc: await mutateDoc(env, 'storyviews', me.uid, (cur, t) => M.storyviewsMark(cur, seen, t), me.uid) });
    }
    case 'thread.open': {
      const members = Array.from(new Set([me.uid, ...(Array.isArray(b.members) ? b.members.map(String) : [])])).slice(0, 32);
      if (members.length < 2) throw bad('相手を選択してください');
      const known = await env.DB.prepare(`SELECT id FROM members WHERE id IN (${members.map(() => '?').join(',')}) AND disabled = 0`).bind(...members).all();
      if (known.results.length !== members.length) throw bad('存在しないメンバーが含まれています');
      const id = threadIdFor(members);
      let doc = await getDoc(env, 'threads', id);
      if (!doc) {
        doc = { members, isGroup: members.length > 2, name: clean(b.name, 60), messages: [], createdAt: ts, updatedAt: ts, createdBy: me.uid, lastMessage: null };
        await env.DB.batch([putStmt(env, 'threads', id, doc, null, ts), ...members.map(m => env.DB.prepare('INSERT OR IGNORE INTO thread_members (thread_id, user_id) VALUES (?, ?)').bind(id, m))]);
        doc.id = id;
      }
      return json({ doc });
    }
    case 'message.send': {
      const tid = String(b.threadId || ''); await requireMember(env, tid, me.uid);
      const msg = { id: 'm' + uid(10), from: me.uid, createdAt: ts };
      if (b.text) msg.text = clean(b.text, 2000);
      const media = cleanMedia(b.media); if (media) msg.media = media;
      if (b.post) msg.post = String(b.post).slice(0, 40);
      if (isPlainObject(b.story)) msg.story = { ownerId: String(b.story.ownerId || '').slice(0, 40), storyId: String(b.story.storyId || '').slice(0, 40), media: cleanMedia(b.story.media) };
      if (!msg.text && !msg.media && !msg.post && !msg.story) throw bad('メッセージが空です');
      return json({ doc: await mutateDoc(env, 'threads', tid, (cur, t) => M.threadSend(cur, msg, t)), msg });
    }
    case 'message.react': {
      const tid = String(b.threadId || ''); await requireMember(env, tid, me.uid);
      return json({ doc: await mutateDoc(env, 'threads', tid, (cur, t) => M.threadReact(cur, String(b.messageId || ''), me.uid, clean(b.emoji, 8), t)) });
    }
    case 'message.unsend': {
      const tid = String(b.threadId || ''); await requireMember(env, tid, me.uid);
      const doc = await getDoc(env, 'threads', tid); const m = doc && (doc.messages || []).find(x => x.id === b.messageId);
      if (m && m.from !== me.uid && !me.isOwner) throw denied();
      return json({ doc: await mutateDoc(env, 'threads', tid, (cur, t) => M.threadUnsend(cur, String(b.messageId || ''), t)) });
    }
    case 'thread.rename': {
      const tid = String(b.threadId || ''); await requireMember(env, tid, me.uid);
      return json({ doc: await mutateDoc(env, 'threads', tid, (cur, t) => M.threadRename(cur, b.name, t)) });
    }
    default: throw notFound('不明な操作です');
  }
}

/* ---------- private state ---------- */
async function putPriv(req, env, me) {
  const b = await readJson(req); if (!isPlainObject(b)) throw bad('データが不正です');
  const data = JSON.stringify(b); if (data.length > 64 * 1024) throw bad('データが大きすぎます', 'too_large');
  const ts = now();
  await env.DB.prepare('INSERT INTO priv (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(me.uid, data, ts).run();
  return json({ ok: true, now: ts });
}

/* ---------- media ---------- */
async function uploadMedia(req, env, me) {
  const type = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!MEDIA_TYPES.has(type)) throw bad('対応していないファイル形式です', 'unsupported_type');
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MEDIA_LIMIT) throw bad('ファイルが大きすぎます（20MBまで）', 'too_large');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) throw bad('ファイルが空です');
  if (buf.byteLength > MEDIA_LIMIT) throw bad('ファイルが大きすぎます（20MBまで）', 'too_large');
  const id = 'm' + uid(23);
  await env.MEDIA.put(id, buf, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  await env.DB.prepare('INSERT INTO media (id, owner_id, content_type, size, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, me.uid, type, buf.byteLength, now()).run();
  return json({ id, url: '/media/' + id, size: buf.byteLength, contentType: type });
}
async function serveMedia(req, env, id) {
  if (!/^m[a-z0-9]{10,40}$/.test(id)) throw notFound();
  const rangeHeader = req.headers.get('Range');
  let range;
  if (rangeHeader) { const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()); if (m && (m[1] || m[2])) { if (m[1] && m[2]) range = { offset: Number(m[1]), length: Number(m[2]) - Number(m[1]) + 1 }; else if (m[1]) range = { offset: Number(m[1]) }; else range = { suffix: Number(m[2]) }; } }
  const obj = await env.MEDIA.get(id, range ? { range } : undefined);
  if (!obj) throw notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Content-Type', (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (range) {
    const start = range.suffix != null ? Math.max(0, obj.size - range.suffix) : range.offset;
    const length = range.suffix != null ? Math.min(range.suffix, obj.size) : (range.length != null ? Math.min(range.length, obj.size - start) : obj.size - start);
    headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${obj.size}`);
    headers.set('Content-Length', String(length));
    return new Response(req.method === 'HEAD' ? null : obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(req.method === 'HEAD' ? null : obj.body, { status: 200, headers });
}

/* ---------- owner tools ---------- */
async function admin(req, env, me, action, url) {
  if (!me.isOwner) throw denied('管理者のみ操作できます');
  if (action === 'members' && req.method === 'GET') {
    const r = await env.DB.prepare('SELECT id, username, is_owner, disabled, last_seen, created_at FROM members ORDER BY created_at').all();
    return json({ members: r.results.map(m => ({ id: m.id, username: m.username, isOwner: !!m.is_owner, disabled: !!m.disabled, lastSeen: m.last_seen, createdAt: m.created_at })) });
  }
  if (action === 'invite' && req.method === 'POST') {
    const b = await readJson(req); const code = clean(b.code, 64).trim(); if (code.length < 4) throw bad('合言葉は4文字以上にしてください');
    await setSetting(env, 'invite_code', code); return json({ ok: true, invite: code });
  }
  if (action === 'member' && req.method === 'POST') {
    const b = await readJson(req); const id = String(b.userId || ''); if (id === me.uid) throw bad('自分自身は変更できません');
    const m = await env.DB.prepare('SELECT * FROM members WHERE id = ?').bind(id).first(); if (!m) throw notFound('メンバーが見つかりません');
    const ts = now(); const out = { ok: true };
    if (typeof b.disabled === 'boolean') await env.DB.prepare('UPDATE members SET disabled = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').bind(b.disabled ? 1 : 0, ts, id).run();
    if (b.resetPassword) {
      const temp = uid(5) + '-' + uid(5); const salt = b64url(crypto.getRandomValues(new Uint8Array(16))); const hash = await hashPassword(env, temp, salt);
      await env.DB.prepare('UPDATE members SET pw_hash = ?, pw_salt = ?, token_version = token_version + 1, updated_at = ? WHERE id = ?').bind(hash, salt, ts, id).run();
      out.tempPassword = temp;
    }
    return json(out);
  }
  if (action === 'stats' && req.method === 'GET') {
    const r = await env.DB.batch([
      env.DB.prepare('SELECT COUNT(*) AS n FROM members'),
      env.DB.prepare("SELECT COUNT(*) AS n FROM docs WHERE col = 'posts' AND deleted = 0"),
      env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM media'),
    ]);
    return json({ members: r[0].results[0].n, posts: r[1].results[0].n, mediaFiles: r[2].results[0].n, mediaBytes: r[2].results[0].bytes });
  }
  throw notFound();
}

/* ---------- entry ---------- */
export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    try {
      let res;
      const [a, b, c] = parts;
      if (!a) res = json({ name: 'KENGO FRIEND SNS API', ok: true });
      else if (a === 'status') res = await status(env);
      else if (a === 'media' && b && (req.method === 'GET' || req.method === 'HEAD')) res = await serveMedia(req, env, b);
      else if (a === 'auth' && b === 'signup' && req.method === 'POST') res = await signup(req, env);
      else if (a === 'auth' && b === 'login' && req.method === 'POST') res = await login(req, env);
      else {
        const me = await auth(req, env, true);
        if (a === 'auth' && b === 'me') res = await whoami(env, me);
        else if (a === 'auth' && b === 'password' && req.method === 'POST') res = await changePassword(req, env, me);
        else if (a === 'auth' && b === 'logout-all' && req.method === 'POST') res = await logoutAll(env, me);
        else if (a === 'sync') res = await sync(req, env, me, url);
        else if (a === 'docs' && b && c && req.method === 'PUT') res = await putDocRoute(req, env, me, b, c);
        else if (a === 'docs' && b && c && req.method === 'DELETE') res = await deleteDocRoute(env, me, b, c);
        else if (a === 'ops' && b && req.method === 'POST') res = await op(req, env, me, b);
        else if (a === 'priv' && req.method === 'PUT') res = await putPriv(req, env, me);
        else if (a === 'media' && !b && req.method === 'POST') res = await uploadMedia(req, env, me);
        else if (a === 'admin' && b) res = await admin(req, env, me, b, url);
        else throw notFound();
      }
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      const res = json({ error: e instanceof HttpError ? e.message : 'サーバーで問題が発生しました', code: e.code || 'internal' }, status);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    }
  },
};
