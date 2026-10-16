/* ===================================================================
   State, indexes, derived data and domain actions
   =================================================================== */
const STORY_TTL = 24 * 60 * 60 * 1000;
const S = {
  store: null, mode: 'boot', gate: null,
  uid: null, isOwner: false, canWrite: true, canUpload: false, readOnly: false,
  users: {}, posts: {}, extraPosts: {}, comments: {}, likes: {}, follows: {}, stories: {}, storyviews: {}, threads: {}, tracks: {},
  priv: { saves: {}, notifSeenAt: 0, threadReads: {}, recent: [], hiddenPosts: {} },
  loaded: {}, online: new Set(), typing: {}, room: null, platformProfile: null,
  route: { name: 'home', params: {} }, history: [], apiBase: '', gateError: '', authStatus: null, justSignedUp: false,
  ui: { muted: true, feedTab: 'home', profileTab: 'posts', searchQ: '', msgsOpen: false, activeThread: null, reply: null },
  idx: { likesByPost: {}, followers: {}, commentCount: {} },
};
const me = () => S.users[S.uid] || null;
const userOf = id => S.users[id] || { id, username: 'unknown', name: '', missing: true };
const userByName = name => Object.values(S.users).find(u => u.username === String(name || '').toLowerCase()) || null;
const displayName = u => (u && (u.username || u.name)) || 'unknown';

function rebuildIndexes() {
  const likesByPost = {};
  for (const l of Object.values(S.likes)) for (const [pid, ts] of Object.entries(l.posts || {})) (likesByPost[pid] = likesByPost[pid] || []).push({ uid: l.id, ts });
  for (const arr of Object.values(likesByPost)) arr.sort((a, b) => b.ts - a.ts);
  const followers = {};
  for (const f of Object.values(S.follows)) for (const [tid, ts] of Object.entries(f.following || {})) (followers[tid] = followers[tid] || []).push({ uid: f.id, ts });
  const commentCount = {};
  for (const c of Object.values(S.comments)) commentCount[c.id] = (c.items || []).length;
  S.idx = { likesByPost, followers, commentCount };
}
const allPostsMap = () => Object.assign({}, S.extraPosts, S.posts);
const postOf = id => S.posts[id] || S.extraPosts[id] || null;
const postLikes = pid => S.idx.likesByPost[pid] || [];
const likeCount = pid => postLikes(pid).length;
const likedByMe = pid => !!(S.likes[S.uid] && S.likes[S.uid].posts && S.likes[S.uid].posts[pid]);
const savedByMe = pid => !!(S.priv.saves && S.priv.saves[pid]);
const followingOf = uid => Object.keys((S.follows[uid] && S.follows[uid].following) || {});
const followersOf = uid => (S.idx.followers[uid] || []).map(f => f.uid);
const isFollowing = (a, b) => !!(S.follows[a] && S.follows[a].following && S.follows[a].following[b]);
const commentsOf = pid => (S.comments[pid] && S.comments[pid].items) || [];
const commentCount = pid => S.idx.commentCount[pid] || 0;
const postsBy = uid => Object.values(allPostsMap()).filter(p => p.authorId === uid).sort((a, b) => b.createdAt - a.createdAt);
const isVideoPost = p => !!(p.media || []).some(m => m.type === 'video');
const isReel = p => p.kind === 'reel' || (p.media && p.media.length === 1 && p.media[0].type === 'video');
function feedPosts() {
  const fol = new Set(followingOf(S.uid)); fol.add(S.uid);
  const hidden = S.priv.hiddenPosts || {};
  const all = Object.values(S.posts).filter(p => !hidden[p.id]).sort((a, b) => b.createdAt - a.createdAt);
  return { main: all.filter(p => fol.has(p.authorId)), suggested: all.filter(p => !fol.has(p.authorId)) };
}
function explorePosts() {
  const score = p => likeCount(p.id) * 3 + commentCount(p.id) * 2 + Math.max(0, 14 - (now() - p.createdAt) / 86400000);
  return Object.values(allPostsMap()).filter(p => p.authorId !== S.uid).sort((a, b) => score(b) - score(a));
}
function activeStories() {
  const cutoff = now() - STORY_TTL; const out = [];
  for (const doc of Object.values(S.stories)) {
    const items = (doc.items || []).filter(i => i.createdAt > cutoff).sort((a, b) => a.createdAt - b.createdAt);
    if (!items.length) continue;
    const seenMap = (S.storyviews[S.uid] && S.storyviews[S.uid].seen && S.storyviews[S.uid].seen[doc.id]) || {};
    const unseen = items.some(i => !seenMap[i.id]);
    out.push({ ownerId: doc.id, items, unseen, latest: items[items.length - 1].createdAt });
  }
  out.sort((a, b) => (a.ownerId === S.uid ? -1 : b.ownerId === S.uid ? 1 : 0) || (b.unseen - a.unseen) || (b.latest - a.latest));
  return out;
}
function storyViewers(ownerId, storyId) {
  const out = [];
  for (const v of Object.values(S.storyviews)) { if (v.id === ownerId) continue; const ts = v.seen && v.seen[ownerId] && v.seen[ownerId][storyId]; if (ts) out.push({ uid: v.id, ts }); }
  return out.sort((a, b) => b.ts - a.ts);
}
function tagIndex() {
  const m = {};
  for (const p of Object.values(allPostsMap())) for (const t of p.tags || []) m[t] = (m[t] || 0) + 1;
  return m;
}
function postsWithTag(tag) { return Object.values(allPostsMap()).filter(p => (p.tags || []).includes(tag)).sort((a, b) => b.createdAt - a.createdAt); }
function notifications() {
  if (!S.uid) return [];
  const mine = me(); const myName = mine ? mine.username : null; const out = [];
  const myPosts = new Set(Object.values(allPostsMap()).filter(p => p.authorId === S.uid).map(p => p.id));
  for (const l of Object.values(S.likes)) { if (l.id === S.uid) continue; for (const [pid, ts] of Object.entries(l.posts || {})) if (myPosts.has(pid)) out.push({ type: 'like', actor: l.id, postId: pid, ts }); }
  for (const c of Object.values(S.comments)) {
    const p = postOf(c.id); const items = c.items || []; const byId = Object.fromEntries(items.map(i => [i.id, i]));
    for (const it of items) {
      if (it.authorId === S.uid) {
        for (const [u, ts] of Object.entries(it.likedBy || {})) if (u !== S.uid) out.push({ type: 'commentlike', actor: u, postId: c.id, commentId: it.id, ts, text: it.text });
        continue;
      }
      const parent = it.parentId ? byId[it.parentId] : null;
      if (parent && parent.authorId === S.uid) out.push({ type: 'reply', actor: it.authorId, postId: c.id, commentId: it.id, ts: it.createdAt, text: it.text });
      else if (p && p.authorId === S.uid) out.push({ type: 'comment', actor: it.authorId, postId: c.id, commentId: it.id, ts: it.createdAt, text: it.text });
      else if (myName && (it.mentions || []).includes(myName)) out.push({ type: 'mention', actor: it.authorId, postId: c.id, commentId: it.id, ts: it.createdAt, text: it.text });
    }
  }
  for (const f of Object.values(S.follows)) { if (f.id === S.uid) continue; const ts = f.following && f.following[S.uid]; if (ts) out.push({ type: 'follow', actor: f.id, ts }); }
  if (myName) for (const p of Object.values(allPostsMap())) if (p.authorId !== S.uid && (p.mentions || []).includes(myName)) out.push({ type: 'mention', actor: p.authorId, postId: p.id, ts: p.createdAt, text: p.caption });
  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, 300);
}
const unreadNotifCount = () => notifications().filter(n => n.ts > (S.priv.notifSeenAt || 0)).length;
function threadsSorted() { return Object.values(S.threads).filter(t => (t.members || []).includes(S.uid)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }
function threadUnread(t) { const last = t.lastMessage; if (!last || last.from === S.uid) return false; return (last.createdAt || 0) > ((S.priv.threadReads || {})[t.id] || 0); }
const unreadThreadCount = () => threadsSorted().filter(threadUnread).length;
function threadTitle(t) { if (t.name) return t.name; const others = (t.members || []).filter(m => m !== S.uid); if (!others.length) return displayName(me()); return others.map(o => displayName(userOf(o))).join(', '); }
function threadOthers(t) { return (t.members || []).filter(m => m !== S.uid); }
function suggestedUsers(limit = 5) {
  const fol = new Set(followingOf(S.uid));
  return Object.values(S.users).filter(u => u.id !== S.uid && !fol.has(u.id)).sort((a, b) => followersOf(b.id).length - followersOf(a.id).length || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
}
const mediaUrl = id => (id ? S.store.mediaUrl(id) : '');
const avatarUrl = u => (u && u.avatar ? mediaUrl(u.avatar) : '');

/* ---------- Subscriptions ---------- */
const unsubs = [];
let renderQueued = false;
function invalidate() { rebuildIndexes(); scheduleRender(); }
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; try { render(); } catch (e) { console.error(e); } }); }
function indexDocs(docs) { const m = {}; for (const d of docs) m[d.id] = d; return m; }
function subscribeAll() {
  const st = S.store;
  const onErr = e => { if (e && e.code === 'revoked') { S.readOnly = true; S.canWrite = false; toast('アクセス権が変更されました。表示のみになります'); scheduleRender(); } };
  unsubs.push(st.subscribe('users', null, d => { S.users = indexDocs(d); S.loaded.users = true; invalidate(); maybeOnboard(); if (S.pendingHash) { const r = routeFromHash(); if (r) { S.pendingHash = null; go(r.name, r.params, { replace: true }); } } }, onErr));
  unsubs.push(st.subscribe('posts', { orderBy: ['createdAt', 'desc'], limit: 400 }, d => { S.posts = indexDocs(d); S.loaded.posts = true; invalidate(); }, onErr));
  unsubs.push(st.subscribe('comments', { orderBy: ['updatedAt', 'desc'], limit: 400 }, d => { const m = indexDocs(d); for (const [k, v] of Object.entries(S.comments)) if (!m[k] && v._fetched) m[k] = v; S.comments = m; invalidate(); }, onErr));
  unsubs.push(st.subscribe('likes', null, d => { S.likes = indexDocs(d); invalidate(); }, onErr));
  unsubs.push(st.subscribe('follows', null, d => { S.follows = indexDocs(d); invalidate(); }, onErr));
  unsubs.push(st.subscribe('stories', null, d => { S.stories = indexDocs(d); invalidate(); }, onErr));
  unsubs.push(st.subscribe('storyviews', null, d => { S.storyviews = indexDocs(d); invalidate(); }, onErr));
  unsubs.push(st.subscribe('tracks', { orderBy: ['createdAt', 'desc'], limit: 1000 }, d => { S.tracks = indexDocs(d); S.loaded.tracks = true; invalidate(); }, onErr));
  if (S.uid) unsubs.push(st.subscribe('threads', { where: [['members', 'array-contains', S.uid]], orderBy: ['updatedAt', 'desc'], limit: 100 }, d => { S.threads = indexDocs(d); S.loaded.threads = true; invalidate(); }, onErr));
  unsubs.push(st.subscribePriv(p => { S.priv = Object.assign({ saves: {}, notifSeenAt: 0, threadReads: {}, recent: [], hiddenPosts: {} }, p || {}); S.loaded.priv = true; invalidate(); }));
}
async function fetchPostsBy(uid) {
  try { const docs = await S.store.query('posts', { where: [['authorId', '==', uid]], orderBy: ['createdAt', 'desc'], limit: 300 }); for (const d of docs) if (!S.posts[d.id]) S.extraPosts[d.id] = d; invalidate(); } catch (e) { console.warn(e); }
}
async function fetchPostsByTag(tag) {
  try { const docs = await S.store.query('posts', { where: [['tags', 'array-contains', tag]], orderBy: ['createdAt', 'desc'], limit: 200 }); for (const d of docs) if (!S.posts[d.id]) S.extraPosts[d.id] = d; invalidate(); } catch (e) { console.warn(e); }
}
async function fetchPost(id) {
  if (postOf(id)) return postOf(id);
  try { const d = await S.store.get('posts', id); if (d) { S.extraPosts[id] = d; invalidate(); } return d; } catch (e) { return null; }
}
async function ensureComments(pid) {
  if (S.comments[pid]) return;
  try { const d = await S.store.get('comments', pid); if (d) { d._fetched = true; S.comments[pid] = d; invalidate(); } } catch (e) { console.warn(e); }
}

/* ---------- Private state ---------- */
let privChain = Promise.resolve();
function setPriv(patch) {
  const next = deepMerge(clone(S.priv), patch);
  S.priv = next; invalidate();
  privChain = privChain.then(() => S.store.setPriv(next)).catch(e => console.warn('priv save', e));
  return privChain;
}

/* ---------- Guards ---------- */
function requireWrite(action = '操作') {
  if (!S.uid) { toast(`${action}にはサインインと招待が必要です`); return false; }
  if (S.readOnly || S.canWrite === false) { toast('閲覧のみの権限です。書き込みには編集者として招待してもらってください'); return false; }
  if (!me()) { openOnboarding(); return false; }
  return true;
}
function friendlyError(e) {
  const code = e && e.code;
  if (code === 'quota_exceeded' || code === 'quota_or_state') return '保存容量の上限に達しました。古い投稿や画像を削除してください';
  if (code === 'resource_exhausted' || code === 'rate_limited') return '操作が多すぎます。少し待ってからお試しください';
  if (code === 'too_large') return 'ファイルが大きすぎます（20MBまで）';
  if (code === 'unsupported_type') return 'このファイル形式には対応していません';
  if (code === 'invalid_argument') return 'この操作を行う権限がありません';
  if (code === 'not_granted') return 'この機能の利用が許可されていません';
  return (e && e.message) || '問題が発生しました';
}
async function run(fn, failMsg) {
  try { return await fn(); } catch (e) { console.error(e); toast(failMsg ? `${failMsg}：${friendlyError(e)}` : friendlyError(e)); return undefined; }
}

