// Pure document mutations shared by the API (server) and the app (local mode).
// Every function takes the current document (or null) and returns the next document.
// The app's build strips the `export` keyword so this file also runs as a classic script.
export const KFS_MUT = {
  STORY_TTL: 24 * 60 * 60 * 1000,
  MAX_COMMENTS: 1000,
  MAX_MESSAGES: 400,

  msgPreview(m) {
    if (m.text) return m.text;
    if (m.media) return m.media.type === 'video' ? '動画を送信しました' : '写真を送信しました';
    if (m.post) return '投稿をシェアしました';
    if (m.story) return 'ストーリーズに返信しました';
    return 'メッセージ';
  },

  commentAdd(doc, pid, item, now) {
    const d = doc || { postId: pid, items: [] };
    d.postId = pid;
    d.items = (d.items || []).slice(-(this.MAX_COMMENTS - 1));
    d.items.push(item);
    d.count = d.items.length;
    d.updatedAt = now;
    return d;
  },
  commentDelete(doc, cid, now) {
    if (!doc) return null;
    doc.items = (doc.items || []).filter(i => i.id !== cid && i.parentId !== cid);
    doc.count = doc.items.length;
    doc.updatedAt = now;
    return doc;
  },
  commentToggleLike(doc, cid, uid, now) {
    if (!doc) return null;
    const it = (doc.items || []).find(i => i.id === cid);
    if (!it) return doc;
    it.likedBy = it.likedBy || {};
    if (it.likedBy[uid]) delete it.likedBy[uid]; else it.likedBy[uid] = now;
    doc.updatedAt = now;
    return doc;
  },

  threadSend(doc, msg, now) {
    if (!doc) return null;
    doc.messages = (doc.messages || []).slice(-(this.MAX_MESSAGES - 1));
    doc.messages.push(msg);
    doc.updatedAt = now;
    doc.lastMessage = { from: msg.from, preview: this.msgPreview(msg).slice(0, 80), createdAt: msg.createdAt };
    return doc;
  },
  threadReact(doc, msgId, uid, emoji, now) {
    if (!doc) return null;
    const m = (doc.messages || []).find(x => x.id === msgId);
    if (!m) return doc;
    m.reactions = m.reactions || {};
    if (m.reactions[uid] === emoji) delete m.reactions[uid]; else m.reactions[uid] = emoji;
    doc.updatedAt = now;
    return doc;
  },
  threadUnsend(doc, msgId, now) {
    if (!doc) return null;
    doc.messages = (doc.messages || []).filter(x => x.id !== msgId);
    const last = doc.messages[doc.messages.length - 1];
    doc.lastMessage = last ? { from: last.from, preview: this.msgPreview(last).slice(0, 80), createdAt: last.createdAt } : null;
    doc.updatedAt = now;
    return doc;
  },
  threadRename(doc, name, now) {
    if (!doc) return null;
    doc.name = String(name || '').slice(0, 60);
    doc.updatedAt = now;
    return doc;
  },

  storyAdd(doc, story, now) {
    const d = doc || { items: [] };
    const cutoff = now - this.STORY_TTL;
    d.items = (d.items || []).filter(i => i.createdAt > cutoff);
    d.items.push(story);
    d.updatedAt = now;
    return d;
  },
  storyDelete(doc, storyId, now) {
    if (!doc) return null;
    doc.items = (doc.items || []).filter(i => i.id !== storyId);
    doc.updatedAt = now;
    return doc;
  },

  likesSet(doc, pid, on, now) {
    const d = doc || { posts: {} };
    d.posts = d.posts || {};
    if (on) d.posts[pid] = now; else delete d.posts[pid];
    d.updatedAt = now;
    return d;
  },
  followsSet(doc, target, on, now) {
    const d = doc || { following: {} };
    d.following = d.following || {};
    if (on) d.following[target] = now; else delete d.following[target];
    d.updatedAt = now;
    return d;
  },
  followsRemove(doc, target, now) {
    if (!doc) return null;
    delete (doc.following || {})[target];
    doc.updatedAt = now;
    return doc;
  },
  storyviewsMark(doc, seen, now) {
    const d = doc || { seen: {} };
    d.seen = d.seen || {};
    const cutoff = now - 2 * this.STORY_TTL;
    for (const [o, m] of Object.entries(seen || {})) d.seen[o] = Object.assign({}, d.seen[o] || {}, m);
    for (const [o, m] of Object.entries(d.seen)) {
      for (const [sid, ts] of Object.entries(m)) if (ts < cutoff) delete m[sid];
      if (!Object.keys(m).length) delete d.seen[o];
    }
    d.updatedAt = now;
    return d;
  },
};
