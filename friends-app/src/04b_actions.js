/* ---------- Domain actions (store-agnostic) ---------- */
function putLocal(col, doc) {
  if (!doc) return;
  const map = { users: S.users, posts: S.posts, comments: S.comments, likes: S.likes, follows: S.follows, stories: S.stories, storyviews: S.storyviews, threads: S.threads, tracks: S.tracks }[col];
  if (map) map[doc.id] = doc;
  invalidate();
}
async function uploadMedia(item) {
  const r = await S.store.upload(item.blob, item.mime);
  const out = { id: r.id, type: item.type, w: item.w, h: item.h };
  if (item.duration) out.duration = Math.round(item.duration * 10) / 10;
  if (item.poster) { try { const p = await S.store.upload(item.poster, 'image/jpeg'); out.poster = p.id; } catch (e) { console.warn('poster', e); } }
  if (item.filter && item.filter !== 'original') out.filter = item.filter;
  if (item.adj && Object.values(item.adj).some(Boolean)) out.adj = item.adj;
  if (item.alt) out.alt = item.alt.slice(0, 200);
  return out;
}
async function saveProfile(p) {
  const cur = me() || {};
  const doc = {
    username: p.username, name: (p.name || '').slice(0, 60), bio: (p.bio || '').slice(0, 150), website: (p.website || '').slice(0, 120),
    avatar: p.avatar !== undefined ? p.avatar : (cur.avatar || null), createdAt: cur.createdAt || now(), updatedAt: now(),
  };
  if (S.isOwner) doc.owner = true;
  const saved = await S.store.saveProfile(doc);
  putLocal('users', Object.assign({ id: S.uid }, doc, saved || {}));
}
async function createPost(p) {
  const media = [];
  for (let i = 0; i < p.items.length; i++) { p.onProgress && p.onProgress(i, p.items.length); media.push(await uploadMedia(p.items[i])); }
  const caption = (p.caption || '').slice(0, 2200);
  const id = 'p' + uid(14);
  const doc = {
    authorId: S.uid, caption, media, aspect: p.aspect || 'original', location: (p.location || '').slice(0, 80),
    tags: extractTags(caption), mentions: extractMentions(caption), createdAt: now(), updatedAt: now(),
    hideLikes: !!p.hideLikes, commentsOff: !!p.commentsOff, kind: p.kind || 'post',
  };
  const saved = await S.store.createPost(id, doc);
  putLocal('posts', Object.assign({ id }, doc, saved || {}));
  return id;
}
async function editPost(id, patch) {
  const p = postOf(id); if (!p) return;
  const caption = (patch.caption !== undefined ? patch.caption : p.caption).slice(0, 2200);
  const next = Object.assign(clone(p), patch, { caption, tags: extractTags(caption), mentions: extractMentions(caption), updatedAt: now() });
  delete next.id;
  const saved = await S.store.editPost(id, next);
  const doc = Object.assign({ id }, next, saved || {});
  (S.posts[id] ? S.posts : S.extraPosts)[id] = doc; invalidate();
}
async function deletePost(id) {
  await S.store.deletePost(id);
  delete S.posts[id]; delete S.extraPosts[id]; delete S.comments[id]; invalidate();
}
async function createTrack(p) {
  const up = await S.store.upload(p.file, p.mime);
  let cover = null;
  if (p.coverBlob) { try { cover = (await S.store.upload(p.coverBlob, 'image/jpeg')).id; } catch (e) { console.warn('cover', e); } }
  const id = 't' + uid(14);
  const doc = { ownerId: S.uid, title: p.title.slice(0, 120), artist: (p.artist || '').slice(0, 120), note: (p.note || '').slice(0, 300), media: { id: up.id, duration: Math.round(p.duration || 0), type: 'audio' }, cover, createdAt: now(), updatedAt: now() };
  const saved = await S.store.createTrack(id, doc);
  putLocal('tracks', Object.assign({ id }, doc, saved || {}));
  return id;
}
async function deleteTrack(id) {
  await S.store.deleteTrack(id);
  delete S.tracks[id]; invalidate();
}
async function toggleLike(pid) {
  if (!requireWrite('いいね')) return;
  const on = !likedByMe(pid);
  S.likes[S.uid] = KFS_MUT.likesSet(clone(S.likes[S.uid] || { id: S.uid, posts: {} }), pid, on, now()); S.likes[S.uid].id = S.uid; invalidate();
  const doc = await run(() => S.store.setLike(pid, on), 'いいねできませんでした');
  if (doc) putLocal('likes', doc);
}
async function toggleSave(pid) {
  if (!S.uid) { toast('保存にはサインインが必要です'); return; }
  const saves = Object.assign({}, S.priv.saves || {});
  if (saves[pid]) delete saves[pid]; else saves[pid] = now();
  const next = clone(S.priv); next.saves = saves; S.priv = next; invalidate();
  privChain = privChain.then(() => S.store.setPriv(next)).catch(e => { console.warn(e); toast('保存できませんでした：' + friendlyError(e)); });
}
async function addComment(pid, text, parentId = null) {
  if (!requireWrite('コメント')) return null;
  text = String(text || '').trim().slice(0, 1000); if (!text) return null;
  const res = await run(() => S.store.addComment(pid, text, parentId), 'コメントできませんでした');
  if (res && res.doc) putLocal('comments', res.doc);
  return res ? res.item : null;
}
async function deleteComment(pid, cid) {
  const doc = await run(() => S.store.deleteComment(pid, cid), '削除できませんでした');
  if (doc) putLocal('comments', doc);
}
async function toggleCommentLike(pid, cid) {
  if (!requireWrite('いいね')) return;
  const doc = await run(() => S.store.toggleCommentLike(pid, cid), 'いいねできませんでした');
  if (doc) putLocal('comments', doc);
}
async function toggleFollow(target) {
  if (!requireWrite('フォロー')) return;
  if (target === S.uid) return;
  const on = !isFollowing(S.uid, target);
  S.follows[S.uid] = KFS_MUT.followsSet(clone(S.follows[S.uid] || { id: S.uid, following: {} }), target, on, now()); S.follows[S.uid].id = S.uid; invalidate();
  const doc = await run(() => S.store.setFollow(target, on), 'フォローできませんでした');
  if (doc) putLocal('follows', doc);
  if (on && doc) toast(`${displayName(userOf(target))} をフォローしました`);
}
async function removeFollower(uidv) {
  const doc = await run(() => S.store.removeFollower(uidv), '削除できませんでした');
  if (doc) putLocal('follows', doc);
}
async function addStory(item, caption) {
  if (!requireWrite('ストーリーズ')) return;
  const m = await uploadMedia(item);
  const res = await S.store.addStory(m, caption);
  if (res && res.doc) putLocal('stories', res.doc);
}
async function deleteStory(storyId) {
  const doc = await run(() => S.store.deleteStory(storyId), '削除できませんでした');
  if (doc) putLocal('stories', doc);
}
let seenQueue = {}; let seenTimer = null;
function markStorySeen(ownerId, storyId) {
  if (!S.uid || S.canWrite === false || !me()) return;
  const curMap = (S.storyviews[S.uid] && S.storyviews[S.uid].seen && S.storyviews[S.uid].seen[ownerId]) || {};
  if (curMap[storyId]) return;
  (seenQueue[ownerId] = seenQueue[ownerId] || {})[storyId] = now();
  const local = KFS_MUT.storyviewsMark(clone(S.storyviews[S.uid] || { id: S.uid, seen: {} }), { [ownerId]: { [storyId]: now() } }, now()); local.id = S.uid;
  S.storyviews[S.uid] = local; invalidate();
  clearTimeout(seenTimer);
  seenTimer = setTimeout(async () => {
    const q = seenQueue; seenQueue = {};
    try { const doc = await S.store.markStorySeen(q); if (doc) putLocal('storyviews', doc); } catch (e) { console.warn('storyviews', e); }
  }, 1200);
}
async function getOrCreateThread(uids, name = '') {
  const doc = await S.store.openThread(uids, name);
  putLocal('threads', doc);
  return doc.id;
}
async function sendMessage(threadId, payload) {
  if (!requireWrite('メッセージ')) return false;
  const res = await run(() => S.store.sendMessage(threadId, payload), '送信できませんでした');
  if (res && res.doc) { putLocal('threads', res.doc); markThreadRead(threadId); }
  return !!res;
}
async function reactMessage(threadId, msgId, emoji) {
  if (!requireWrite('リアクション')) return;
  const doc = await run(() => S.store.reactMessage(threadId, msgId, emoji), 'リアクションできませんでした');
  if (doc) putLocal('threads', doc);
}
async function unsendMessage(threadId, msgId) {
  const doc = await run(() => S.store.unsendMessage(threadId, msgId), '送信を取り消せませんでした');
  if (doc) putLocal('threads', doc);
}
async function renameThread(threadId, name) {
  const doc = await run(() => S.store.renameThread(threadId, name), '変更できませんでした');
  if (doc) putLocal('threads', doc);
}
function markThreadRead(threadId) {
  if (!S.uid) return;
  const t = S.threads[threadId]; if (!t) return;
  const ts = (t.lastMessage && t.lastMessage.createdAt) || t.updatedAt || now();
  if (((S.priv.threadReads || {})[threadId] || 0) >= ts) return;
  setPriv({ threadReads: { [threadId]: ts } });
}
function markNotifsSeen() { if (!S.uid) return; const n = notifications(); const latest = n.length ? n[0].ts : now(); if ((S.priv.notifSeenAt || 0) < latest) setPriv({ notifSeenAt: latest }); }
function addRecentSearch(item) { if (!S.uid) return; const recent = (S.priv.recent || []).filter(r => !(r.type === item.type && r.key === item.key)); recent.unshift(item); setPriv({ recent: recent.slice(0, 20) }); }
function clearRecentSearches() { setPriv({ recent: [] }); }
function hidePost(pid) { setPriv({ hiddenPosts: { [pid]: now() } }); toast('この投稿を非表示にしました'); }
function emitTyping(threadId) { if (S.room && S.uid) S.room.emit('typing', { threadId }).catch(() => {}); }
