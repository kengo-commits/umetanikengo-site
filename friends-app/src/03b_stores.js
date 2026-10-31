/* ===================================================================
   Stores. Three backends share one interface:
   - ApiStore   : the production backend (Cloudflare Worker + D1 + R2)
   - CloudStore : the claude.ai artifact runtime (db/user/assets)
   - LocalStore : this browser only (preview / fallback)
   Interface: init, subscribe, query, get, subscribePriv, setPriv, canUpload, upload, mediaUrl,
   saveProfile, createPost, editPost, deletePost, setLike, setFollow, removeFollower,
   addComment, deleteComment, toggleCommentLike, addStory, deleteStory, markStorySeen,
   openThread, sendMessage, reactMessage, unsendMessage, renameThread
   =================================================================== */
const mediaUrlCache = new Map();

function matchDoc(doc, q) {
  for (const [f, op, v] of (q && q.where) || []) {
    const x = doc[f];
    if (op === '==' && x !== v) return false;
    if (op === '!=' && x === v) return false;
    if (op === 'array-contains' && !(Array.isArray(x) && x.includes(v))) return false;
    if (op === 'in' && !(Array.isArray(v) && v.includes(x))) return false;
    if (op === '>' && !(x > v)) return false;
    if (op === '>=' && !(x >= v)) return false;
    if (op === '<' && !(x < v)) return false;
    if (op === '<=' && !(x <= v)) return false;
  }
  return true;
}
function runQuery(map, q) {
  let arr = Object.entries(map).map(([id, d]) => Object.assign({ id }, clone(d))).filter(d => matchDoc(d, q));
  if (q && q.orderBy) {
    const [f, dir] = q.orderBy; const m = dir === 'desc' ? -1 : 1;
    arr.sort((a, b) => { const x = a[f], y = b[f]; if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * m; });
  } else arr.sort((a, b) => (a.id < b.id ? -1 : 1));
  if (q && q.limit) arr = arr.slice(0, q.limit);
  return arr;
}

/* ---------- Document-store semantics shared by Cloud and Local ---------- */
class DocStoreBase {
  // subclasses implement: get, set, del, mutate(name, id, fn(cur, now) -> next|null|undefined)
  async saveProfile(doc) { await this.set('users', this.uid, doc); return Object.assign({ id: this.uid }, doc); }
  async createPost(id, doc) { await this.set('posts', id, doc); return Object.assign({ id }, doc); }
  async editPost(id, doc) { await this.set('posts', id, doc); return Object.assign({ id }, doc); }
  async deletePost(id) { await this.del('posts', id); try { await this.del('comments', id); } catch (e) { /* none */ } }
  async createTrack(id, doc) { await this.set('tracks', id, doc); return Object.assign({ id }, doc); }
  async deleteTrack(id) { await this.del('tracks', id); }
  async setLike(pid, on) { return this.mutate('likes', this.uid, (c, t) => KFS_MUT.likesSet(c, pid, on, t)); }
  async setFollow(target, on) { return this.mutate('follows', this.uid, (c, t) => KFS_MUT.followsSet(c, target, on, t)); }
  async removeFollower(follower) { return this.mutate('follows', follower, (c, t) => KFS_MUT.followsRemove(c, this.uid, t)); }
  async addComment(pid, text, parentId) {
    const item = { id: 'c' + uid(10), authorId: this.uid, text, createdAt: now(), parentId: parentId || null, mentions: extractMentions(text), likedBy: {} };
    const doc = await this.mutate('comments', pid, (c, t) => KFS_MUT.commentAdd(c, pid, item, t));
    return { doc, item };
  }
  async deleteComment(pid, cid) { return this.mutate('comments', pid, (c, t) => KFS_MUT.commentDelete(c, cid, t)); }
  async toggleCommentLike(pid, cid) { return this.mutate('comments', pid, (c, t) => KFS_MUT.commentToggleLike(c, cid, this.uid, t)); }
  async addStory(media, caption) {
    const story = { id: 's' + uid(10), media, createdAt: now(), caption: (caption || '').slice(0, 200) };
    const doc = await this.mutate('stories', this.uid, (c, t) => KFS_MUT.storyAdd(c, story, t));
    return { doc, story };
  }
  async deleteStory(sid) { return this.mutate('stories', this.uid, (c, t) => KFS_MUT.storyDelete(c, sid, t)); }
  async markStorySeen(seen) { return this.mutate('storyviews', this.uid, (c, t) => KFS_MUT.storyviewsMark(c, seen, t)); }
  async openThread(members, name = '') {
    members = Array.from(new Set([this.uid, ...members])).filter(Boolean);
    if (members.length < 2) throw new Error('相手を選択してください');
    const id = threadIdFor(members);
    const existing = await this.get('threads', id);
    if (existing) return existing;
    const doc = { members, isGroup: members.length > 2, name: (name || '').slice(0, 60), messages: [], createdAt: now(), updatedAt: now(), createdBy: this.uid, lastMessage: null };
    await this.set('threads', id, doc);
    return Object.assign({ id }, doc);
  }
  async sendMessage(tid, payload) {
    const msg = Object.assign({ id: 'm' + uid(10), from: this.uid, createdAt: now() }, payload);
    if (msg.text) msg.text = msg.text.slice(0, 2000);
    const doc = await this.mutate('threads', tid, (c, t) => KFS_MUT.threadSend(c, msg, t));
    return { doc, msg };
  }
  async reactMessage(tid, mid, emoji) { return this.mutate('threads', tid, (c, t) => KFS_MUT.threadReact(c, mid, this.uid, emoji, t)); }
  async unsendMessage(tid, mid) { return this.mutate('threads', tid, (c, t) => KFS_MUT.threadUnsend(c, mid, t)); }
  async renameThread(tid, name) { return this.mutate('threads', tid, (c, t) => KFS_MUT.threadRename(c, name, t)); }
}
function threadIdFor(uids) {
  const ids = Array.from(new Set(uids)).sort();
  if (ids.length === 2) { const s = 'dm_' + ids.map(safeSegment).join('__'); return s.length <= 190 ? s : 'dm_' + hashInt(ids[0]).toString(36) + '_' + hashInt(ids[1]).toString(36); }
  return 't' + uid(14);
}

/* ---------- CloudStore: claude.ai artifact runtime ---------- */
class CloudStore extends DocStoreBase {
  constructor(db, user, assets) { super(); this.mode = 'cloud'; this.db = db; this.user = user; this.assets = assets; this.uid = null; }
  async init() { this.uid = this.user ? await this.user.id() : null; return this.uid; }
  _ref(name, q) {
    let ref = this.db.collection(name);
    for (const w of (q && q.where) || []) ref = ref.where(...w);
    if (q && q.orderBy) ref = ref.orderBy(...q.orderBy);
    if (q && q.limit) ref = ref.limit(q.limit);
    return ref;
  }
  _docs(snap) { return snap.docs.map(d => Object.assign({ id: d.id }, d.data())); }
  subscribe(name, q, cb, onErr) { return this._ref(name, q).onSnapshot(snap => cb(this._docs(snap)), e => { console.warn('db:' + name, e); if (onErr) onErr(e); }); }
  async query(name, q) { return this._docs(await this._ref(name, q).get()); }
  async get(name, id) { const s = await this.db.doc(name + '/' + id).get(); return s.exists ? Object.assign({ id: s.id }, s.data()) : null; }
  async set(name, id, data) { const d = clone(data); delete d.id; await this.db.doc(name + '/' + id).set(d); }
  async del(name, id) { await this.db.doc(name + '/' + id).delete(); }
  async mutate(name, id, fn) {
    const ref = this.db.doc(name + '/' + id);
    for (let i = 0; i < 7; i++) {
      let lease = { acquired: true };
      try { lease = await ref.acquire({ holder: this.uid || 'anon', ttlMs: 4000 }); } catch (e) { lease = { acquired: true }; }
      if (lease.acquired) {
        const s = await ref.get();
        const cur = s.exists ? clone(s.data()) : null;
        if (cur) cur.id = id;
        const next = fn(cur, now());
        if (next === null) { await ref.delete(); return null; }
        if (next === undefined) return cur;
        const d = clone(next); delete d.id;
        await ref.set(d);
        return Object.assign({ id }, next);
      }
      await sleep(250 + Math.random() * 450);
    }
    throw new Error('他の操作と重なりました。もう一度お試しください');
  }
  _privRef() { return this.db.doc(`data/users/${this.uid}/state`); }
  subscribePriv(cb) { if (!this.uid) { cb(null); return () => {}; } return this._privRef().onSnapshot(s => cb(s.exists ? clone(s.data()) : null), e => console.warn('priv', e)); }
  async setPriv(data) { if (!this.uid) throw new Error('サインインが必要です'); const d = clone(data); delete d.id; await this._privRef().set(d); }
  canUpload() { return !!this.assets; }
  async upload(blob, type) {
    if (!this.assets) throw new Error('ファイルをアップロードする権限がありません');
    const r = await this.assets.upload(blob, type ? { type } : undefined);
    mediaUrlCache.set(r.id, r.url);
    return { id: r.id, url: r.url };
  }
  mediaUrl(id) { return mediaUrlCache.get(id) || ('/_blob/' + id); }
}

/* ---------- LocalStore: this browser only ---------- */
class LocalStore extends DocStoreBase {
  constructor() { super(); this.mode = 'local'; this.key = 'kfs.v1'; this.data = {}; this.subs = new Set(); this.privSubs = new Set(); this.urls = new Map(); this.idb = null; }
  async init() {
    try { this.data = JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { this.data = {}; }
    if (!this.data.__uid) this.data.__uid = 'local_' + uid(10);
    this.uid = this.data.__uid;
    try { await this._openIdb(); await this._loadBlobs(); } catch (e) { console.warn('idb', e); }
    this._save();
    return this.uid;
  }
  _save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { console.warn('local save failed', e); } }
  _openIdb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const r = indexedDB.open('kfs-media', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('blobs'); };
      r.onsuccess = () => { this.idb = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  }
  _loadBlobs() {
    return new Promise((res, rej) => {
      if (!this.idb) return res();
      const tx = this.idb.transaction('blobs', 'readonly'); const st = tx.objectStore('blobs');
      const req = st.openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { this.urls.set(c.key, URL.createObjectURL(c.value)); c.continue(); } else res(); };
      req.onerror = () => rej(req.error);
    });
  }
  _putBlob(id, blob) {
    return new Promise((res, rej) => {
      if (!this.idb) return res();
      const tx = this.idb.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(blob, id);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  }
  _col(name) { if (!this.data[name]) this.data[name] = {}; return this.data[name]; }
  subscribe(name, q, cb) { const sub = { name, q, cb }; this.subs.add(sub); queueMicrotask(() => { if (this.subs.has(sub)) cb(runQuery(this._col(name), q)); }); return () => this.subs.delete(sub); }
  _notify(name) { for (const s of Array.from(this.subs)) if (s.name === name) { try { s.cb(runQuery(this._col(s.name), s.q)); } catch (e) { console.error(e); } } }
  async query(name, q) { return runQuery(this._col(name), q); }
  async get(name, id) { const d = this._col(name)[id]; return d ? Object.assign({ id }, clone(d)) : null; }
  async set(name, id, data) { const d = clone(data); delete d.id; this._col(name)[id] = d; this._save(); this._notify(name); }
  async del(name, id) { delete this._col(name)[id]; this._save(); this._notify(name); }
  async mutate(name, id, fn) { const cur = await this.get(name, id); const next = fn(cur, now()); if (next === null) { await this.del(name, id); return null; } if (next === undefined) return cur; await this.set(name, id, next); return Object.assign({ id }, next); }
  subscribePriv(cb) { const sub = cb; this.privSubs.add(sub); queueMicrotask(() => cb(clone((this.data.__priv || {})[this.uid] || null))); return () => this.privSubs.delete(sub); }
  async setPriv(data) { if (!this.data.__priv) this.data.__priv = {}; this.data.__priv[this.uid] = clone(data); this._save(); for (const s of this.privSubs) s(clone(data)); }
  canUpload() { return true; }
  async upload(blob) { const id = 'm' + uid(14); await this._putBlob(id, blob); const url = URL.createObjectURL(blob); this.urls.set(id, url); return { id, url }; }
  mediaUrl(id) { return this.urls.get(id) || ''; }
}

/* ---------- ApiStore: Cloudflare Worker backend ---------- */
class ApiError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
class ApiStore {
  constructor(base, token) {
    this.mode = 'api'; this.base = base.replace(/\/+$/, ''); this.token = token; this.uid = null; this.isOwner = false;
    this.cols = { users: {}, posts: {}, comments: {}, likes: {}, follows: {}, stories: {}, storyviews: {}, threads: {}, tracks: {} };
    this.subs = new Set(); this.privSubs = new Set(); this.priv = null; this.online = new Set();
    this.since = 0; this.timer = null; this.polling = false; this.lastPing = 0; this.lastActivity = now(); this.onAuthLost = null; this.onOnline = null; this.started = false; this.invite = null; this.memberCount = 0; this.mediaToken = '';
  }
  async req(method, path, body, opts = {}) {
    const headers = {};
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    let payload;
    if (body instanceof Blob) { headers['Content-Type'] = opts.type || body.type; payload = body; }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let res;
    try { res = await fetch(this.base + path, { method, headers, body: payload }); }
    catch (e) { throw new ApiError(0, 'サーバーに接続できません。通信環境を確認してください', 'network'); }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      if (res.status === 401 && this.onAuthLost && !opts.noAuthHandling) this.onAuthLost();
      throw new ApiError(res.status, (data && data.error) || `エラー (${res.status})`, data && data.code);
    }
    return data;
  }
  async init() {
    const me = await this.req('GET', '/auth/me');
    this.uid = me.uid; this.isOwner = !!me.isOwner; this.invite = me.invite; this.memberCount = me.members;
    if (me.mediaToken) this.mediaToken = me.mediaToken;
    if (me.user) this.cols.users[me.uid] = me.user;
    this.priv = me.priv || null;
    return this.uid;
  }
  _merge(cols) {
    const changed = new Set();
    for (const [col, docs] of Object.entries(cols || {})) {
      const map = this.cols[col]; if (!map) continue;
      for (const d of docs) {
        if (d._deleted) { if (map[d.id]) { delete map[d.id]; changed.add(col); } continue; }
        const cur = map[d.id];
        if (!cur || (cur.updatedAt || 0) <= (d.updatedAt || 0)) { map[d.id] = d; changed.add(col); }
      }
    }
    return changed;
  }
  _notify(cols) { for (const s of Array.from(this.subs)) if (cols.has(s.name)) { try { s.cb(runQuery(this.cols[s.name], s.q)); } catch (e) { console.error(e); } } }
  _apply(col, doc) { if (!doc) return; const changed = this._merge({ [col]: [doc] }); this._notify(changed); this.syncSoon(); }
  async sync() {
    if (this.polling) return; this.polling = true;
    try {
      const ping = now() - this.lastPing > 60000;
      const data = await this.req('GET', `/sync?since=${this.since}&ping=${ping ? 1 : 0}`);
      if (ping) this.lastPing = now();
      this.since = data.now;
      if (data.mediaToken) this.mediaToken = data.mediaToken;   // short-lived signed token for /media/:id (refreshed by every sync)
      const changed = this._merge(data.cols);
      if (data.full || !this.synced) { this.synced = true; for (const col of Object.keys(this.cols)) changed.add(col); }
      if (data.priv !== undefined) { this.priv = data.priv; for (const s of this.privSubs) s(clone(this.priv)); }
      this.online = new Set(data.online || []); if (this.onOnline) this.onOnline(this.online);
      this._notify(changed);
      this.failures = 0;
    } catch (e) {
      this.failures = (this.failures || 0) + 1;
      if (e.status !== 401) console.warn('sync', e.message);
    } finally { this.polling = false; }
  }
  start() {
    if (this.started) return; this.started = true;
    const loop = async () => {
      if (!this.started) return;
      if (document.visibilityState !== 'hidden') await this.sync();
      const idle = now() - this.lastActivity > 5 * 60000;
      const delay = this.failures ? Math.min(60000, 5000 * this.failures) : (idle ? 45000 : 8000);
      this.timer = setTimeout(loop, delay);
    };
    loop();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { this.lastActivity = now(); this.syncSoon(); } });
    for (const ev of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(ev, () => { this.lastActivity = now(); }, { passive: true });
  }
  syncSoon() { clearTimeout(this.soon); this.soon = setTimeout(() => this.sync(), 250); }
  stop() { this.started = false; clearTimeout(this.timer); }
  subscribe(name, q, cb) { const sub = { name, q, cb }; this.subs.add(sub); if (this.synced) queueMicrotask(() => { if (this.subs.has(sub)) cb(runQuery(this.cols[name] || {}, q)); }); return () => this.subs.delete(sub); }
  async query(name, q) { return runQuery(this.cols[name] || {}, q); }
  async get(name, id) { const d = (this.cols[name] || {})[id]; return d ? clone(d) : null; }
  subscribePriv(cb) { this.privSubs.add(cb); queueMicrotask(() => cb(clone(this.priv))); return () => this.privSubs.delete(cb); }
  async setPriv(data) { this.priv = clone(data); await this.req('PUT', '/priv', this.priv); }
  canUpload() { return true; }
  async upload(blob, type) { const r = await this.req('POST', '/media', blob, { type: type || blob.type }); return { id: r.id, url: this.mediaUrl(r.id) }; }
  mediaUrl(id) { return id ? this.base + '/media/' + id + (this.mediaToken ? '?t=' + encodeURIComponent(this.mediaToken) : '') : ''; }
  // semantic writes
  async saveProfile(doc) { const d = await this.req('PUT', `/docs/users/${this.uid}`, doc); this._apply('users', d); return d; }
  async createPost(id, doc) { const d = await this.req('PUT', `/docs/posts/${id}`, doc); this._apply('posts', d); return d; }
  async editPost(id, doc) { const d = await this.req('PUT', `/docs/posts/${id}`, doc); this._apply('posts', d); return d; }
  async createTrack(id, doc) { const d = await this.req('PUT', `/docs/tracks/${id}`, doc); this._apply('tracks', d); return d; }
  async deleteTrack(id) { await this.req('DELETE', `/docs/tracks/${id}`); delete this.cols.tracks[id]; this._notify(new Set(['tracks'])); this.syncSoon(); }
  async deletePost(id) { await this.req('DELETE', `/docs/posts/${id}`); delete this.cols.posts[id]; delete this.cols.comments[id]; this._notify(new Set(['posts', 'comments'])); this.syncSoon(); }
  async setLike(pid, on) { const r = await this.req('POST', '/ops/like.set', { postId: pid, on }); this._apply('likes', r.doc); return r.doc; }
  async setFollow(target, on) { const r = await this.req('POST', '/ops/follow.set', { targetId: target, on }); this._apply('follows', r.doc); return r.doc; }
  async removeFollower(follower) { const r = await this.req('POST', '/ops/follow.remove', { followerId: follower }); this._apply('follows', r.doc); return r.doc; }
  async addComment(pid, text, parentId) { const r = await this.req('POST', '/ops/comment.add', { postId: pid, text, parentId: parentId || null }); this._apply('comments', r.doc); return r; }
  async deleteComment(pid, cid) { const r = await this.req('POST', '/ops/comment.delete', { postId: pid, commentId: cid }); this._apply('comments', r.doc); return r.doc; }
  async toggleCommentLike(pid, cid) { const r = await this.req('POST', '/ops/comment.like', { postId: pid, commentId: cid }); this._apply('comments', r.doc); return r.doc; }
  async addStory(media, caption) { const r = await this.req('POST', '/ops/story.add', { media, caption }); this._apply('stories', r.doc); return r; }
  async deleteStory(sid) { const r = await this.req('POST', '/ops/story.delete', { storyId: sid }); this._apply('stories', r.doc); return r.doc; }
  async markStorySeen(seen) { const r = await this.req('POST', '/ops/storyview.mark', { seen }); this._apply('storyviews', r.doc); return r.doc; }
  async openThread(members, name = '') { const r = await this.req('POST', '/ops/thread.open', { members, name }); this._apply('threads', r.doc); return r.doc; }
  async sendMessage(tid, payload) { const r = await this.req('POST', '/ops/message.send', Object.assign({ threadId: tid }, payload)); this._apply('threads', r.doc); return r; }
  async reactMessage(tid, mid, emoji) { const r = await this.req('POST', '/ops/message.react', { threadId: tid, messageId: mid, emoji }); this._apply('threads', r.doc); return r.doc; }
  async unsendMessage(tid, mid) { const r = await this.req('POST', '/ops/message.unsend', { threadId: tid, messageId: mid }); this._apply('threads', r.doc); return r.doc; }
  async renameThread(tid, name) { const r = await this.req('POST', '/ops/thread.rename', { threadId: tid, name }); this._apply('threads', r.doc); return r.doc; }
  // account & owner tools
  async changePassword(current, next) { const r = await this.req('POST', '/auth/password', { current, next }); if (r.token) { this.token = r.token; saveToken(r.token); } return r; }
  async logoutAll() { return this.req('POST', '/auth/logout-all', {}); }
  async adminMembers() { return (await this.req('GET', '/admin/members')).members; }
  async adminSetInvite(code) { const r = await this.req('POST', '/admin/invite', { code }); this.invite = r.invite; return r; }
  async adminMember(userId, patch) { return this.req('POST', '/admin/member', Object.assign({ userId }, patch)); }
  async adminStats() { return this.req('GET', '/admin/stats'); }
}
const TOKEN_KEY = 'kfs.token';
function loadToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
function saveToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* private mode */ } }
async function apiPublic(base, method, path, body) {
  let res;
  try { res = await fetch(base.replace(/\/+$/, '') + path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }); }
  catch (e) { throw new ApiError(0, 'サーバーに接続できません。通信環境を確認してください', 'network'); }
  let data = null; try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `エラー (${res.status})`, data && data.code);
  return data;
}
