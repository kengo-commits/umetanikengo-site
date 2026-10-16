/* ===================================================================
   UI infrastructure: toasts, modals, routing, shared components
   =================================================================== */
function toast(msg, ic = null) {
  const t = el('div', { class: 'toast' }, ic ? icon(ic) : null, el('span', {}, msg));
  $('#toasts').append(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2600);
}
const modals = [];
function openModal(node, opts = {}) {
  const layer = $('#layer'); const entry = { node, opts };
  modals.push(entry);
  for (const m of modals) m.node.hidden = m !== entry;
  layer.append(node); layer.classList.add('on'); document.body.style.overflow = 'hidden';
  const focusable = node.querySelector('input,textarea,button');
  if (opts.autofocus !== false && focusable && window.innerWidth > 700) setTimeout(() => { try { focusable.focus({ preventScroll: true }); } catch (e) {} }, 30);
  return () => closeModal(entry);
}
function closeModal(entry) {
  const i = modals.indexOf(entry); if (i < 0) return;
  modals.splice(i, 1); entry.node.remove();
  if (entry.opts.onClose) try { entry.opts.onClose(); } catch (e) { console.error(e); }
  const top = modals[modals.length - 1];
  if (top) top.node.hidden = false; else { $('#layer').classList.remove('on'); document.body.style.overflow = ''; }
}
function closeTopModal() { const top = modals[modals.length - 1]; if (top && top.opts.dismissible !== false) closeModal(top); }
function closeAllModals() { while (modals.length) closeModal(modals[modals.length - 1]); }
function modalFrame({ title, left, right, body, size = '', cls = '' }) {
  const m = el('div', { class: `modal ${size} ${cls}` });
  const head = el('div', { class: 'modal-head' });
  head.append(left || el('span', { style: 'min-width:48px' }), el('div', { class: 't' }, title || ''), right || el('span', { style: 'min-width:48px' }));
  m.append(head);
  if (body) m.append(body);
  return m;
}
function closeBtn(close) { return el('button', { class: 'ghost', 'aria-label': '閉じる', onclick: close, html: iconHTML('x') }); }
function backBtn(close) { return el('button', { class: 'ghost', 'aria-label': '戻る', onclick: close, html: iconHTML('back') }); }
function openSheet(items) {
  const list = el('div', { class: 'sheet-list' });
  const m = el('div', { class: 'modal' }, list);
  const close = openModal(m, { autofocus: false });
  for (const it of items) {
    if (!it) continue;
    list.append(el('button', { class: it.danger ? 'danger' : '', onclick: async () => { close(); if (it.onClick) await it.onClick(); } }, it.icon ? icon(it.icon) : null, it.label));
  }
  list.append(el('button', { onclick: close }, 'キャンセル'));
  return close;
}
function confirmDialog({ title, text, okLabel = 'OK', danger = false, cancelLabel = 'キャンセル' }) {
  return new Promise(resolve => {
    const m = el('div', { class: 'modal' });
    m.append(el('div', { class: 'confirm' }, el('h3', {}, title), text ? el('p', {}, text) : null));
    const list = el('div', { class: 'sheet-list', style: 'margin-top:16px' });
    const close = openModal(m, { onClose: () => resolve(false), dismissible: true, autofocus: false });
    list.append(el('button', { class: danger ? 'danger' : '', style: danger ? '' : 'color:var(--accent);font-weight:700', onclick: () => { resolve(true); close(); } }, okLabel));
    list.append(el('button', { onclick: close }, cancelLabel));
    m.append(list);
  });
}
function textPrompt({ title, label, value = '', placeholder = '', maxLength = 60, okLabel = '保存' }) {
  return new Promise(resolve => {
    const input = el('input', { class: 'input', id: 'prompt-' + uid(4), value, placeholder, maxlength: maxLength });
    const body = el('div', { class: 'modal-body' }, el('div', { class: 'field' }, el('label', { for: input.id }, label), input));
    const ok = el('button', { onclick: () => { resolve(input.value.trim()); close(); } }, okLabel);
    const m = modalFrame({ title, left: closeBtn(() => close()), right: ok, body });
    const close = openModal(m, { onClose: () => resolve(null) });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } });
  });
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (storyState.open) { closeStoryViewer(); return; } closeTopModal(); }
});

/* ---------- Routing ---------- */
const MAIN_ROUTES = ['home', 'search', 'explore', 'reels', 'music', 'messages', 'notifications', 'profile', 'settings'];
function routeKey(r) { return r.name + ':' + JSON.stringify(r.params || {}); }
function go(name, params = {}, opts = {}) {
  const next = { name, params };
  if (routeKey(next) === routeKey(S.route) && !opts.force) { scheduleRender(); return; }
  if (!opts.replace) S.history.push(S.route);
  if (S.history.length > 60) S.history.shift();
  S.route = next;
  const token = hashFor(next);
  if (token !== null) { try { history.replaceState(null, '', '#' + token); } catch (e) {} }
  S.ui.scrollTop = 0;
  scheduleRender();
}
function back() {
  const prev = S.history.pop();
  if (prev) { S.route = prev; const token = hashFor(prev); if (token !== null) { try { history.replaceState(null, '', '#' + token); } catch (e) {} } scheduleRender(); }
  else go('home', {}, { replace: true });
}
function hashFor(r) {
  if (r.name === 'profile' && r.params.uid) { const u = S.users[r.params.uid]; return u ? 'user-' + u.username : 'profile'; }
  if (r.name === 'post' && r.params.id) return 'post-' + r.params.id;
  if (MAIN_ROUTES.includes(r.name)) return r.name;
  return null;
}
function routeFromHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (!h) return null;
  if (h.startsWith('user-')) { const u = userByName(h.slice(5)); return u ? { name: 'profile', params: { uid: u.id } } : null; }
  if (h.startsWith('post-')) return { name: 'post', params: { id: h.slice(5) } };
  if (MAIN_ROUTES.includes(h)) return { name: h, params: {} };
  return null;
}
function openProfile(uid) { if (!uid) return; go('profile', { uid }); }
function openTag(tag) { go('tag', { tag }); }
function openPost(pid, opts = {}) {
  if (window.innerWidth < 900) go('post', { id: pid, focus: !!opts.focus });
  else openPostModal(pid, opts);
}

/* ---------- Shared components ---------- */
function avatarEl(u, size = '') {
  const a = el('div', { class: `avatar ${size}` });
  const url = avatarUrl(u);
  if (url) a.append(el('img', { src: url, alt: '', loading: 'lazy' }));
  else { a.style.background = `hsl(${hueFor(u ? u.id : 'x')} 42% 52%)`; a.textContent = (displayName(u)[0] || '?').toUpperCase(); }
  return a;
}
function ringEl(u, size = '', state = 'none', onClick = null) {
  const r = el('div', { class: `ring ${state}` }, avatarEl(u, size));
  if (onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', onClick); }
  return r;
}
function userLink(u, cls = 'u') { return el('button', { class: cls, onclick: e => { e.stopPropagation(); openProfile(u.id); } }, displayName(u)); }
function linkify(text) {
  const f = document.createDocumentFragment(); const s = String(text || '');
  const re = /(#[\p{L}\p{N}_]+|@[a-z0-9._]{2,30}|https?:\/\/[^\s<]+)/giu; let last = 0; let m;
  while ((m = re.exec(s))) {
    if (m.index > last) f.append(s.slice(last, m.index));
    const tok = m[0];
    if (tok[0] === '#') f.append(el('button', { class: 'tag-link', onclick: e => { e.stopPropagation(); openTag(tok.slice(1).toLowerCase()); } }, tok));
    else if (tok[0] === '@') { const u = userByName(tok.slice(1)); if (u) f.append(el('button', { class: 'tag-link', onclick: e => { e.stopPropagation(); openProfile(u.id); } }, tok)); else f.append(tok); }
    else f.append(el('a', { href: tok, target: '_blank', rel: 'noopener noreferrer', class: 'tag-link', onclick: e => e.stopPropagation() }, tok));
    last = m.index + tok.length;
  }
  if (last < s.length) f.append(s.slice(last));
  return f;
}
function followBtn(targetId, opts = {}) {
  if (targetId === S.uid) return null;
  const on = isFollowing(S.uid, targetId);
  const b = el('button', { class: `btn ${opts.size || 'sm'} ${on ? '' : 'primary'}`, onclick: async e => { e.stopPropagation(); if (on && !opts.noConfirm) { const ok = await confirmDialog({ title: `${displayName(userOf(targetId))} のフォローをやめますか？`, okLabel: 'フォローをやめる', danger: true }); if (!ok) return; } toggleFollow(targetId); } }, on ? 'フォロー中' : (isFollowing(targetId, S.uid) ? 'フォローバック' : 'フォローする'));
  return b;
}
function keyedList(container, items, keyOf, create, update) {
  const existing = new Map();
  for (const c of Array.from(container.children)) if (c.dataset.key) existing.set(c.dataset.key, c);
  const nodes = [];
  for (const it of items) {
    const k = String(keyOf(it)); let n = existing.get(k);
    if (n) { existing.delete(k); if (update) update(n, it); }
    else { n = create(it); n.dataset.key = k; }
    nodes.push(n);
  }
  for (const n of existing.values()) n.remove();
  nodes.forEach((n, i) => { if (container.children[i] !== n) container.insertBefore(n, container.children[i] || null); });
}
function emptyState(ic, title, text, action) {
  const e = el('div', { class: 'empty' }, icon(ic), el('h3', {}, title), text ? el('p', {}, text) : null);
  if (action) e.append(action);
  return e;
}
function modeBanner() {
  if (S.mode === 'api') return null;
  if (S.mode === 'local') return el('div', { class: 'mode-banner' }, icon('device'), el('span', {}, 'ローカルモード：このブラウザだけに保存されます。共有版は公開ページで動作します。'));
  if (S.readOnly || S.canWrite === false) return el('div', { class: 'mode-banner' }, icon('eye'), el('span', {}, '閲覧のみ：投稿・いいね・DMには「編集者」としての招待が必要です。'));
  return null;
}

/* ---------- Video autoplay ---------- */
const videoIO = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
  for (const en of entries) {
    const v = en.target;
    if (en.isIntersecting && en.intersectionRatio >= 0.6) { v.muted = S.ui.muted; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    else v.pause();
  }
}, { threshold: [0, 0.6, 1] }) : null;
function setMuted(m) { S.ui.muted = m; $$('video.auto').forEach(v => { v.muted = m; }); $$('.media-mute, .reel .mute').forEach(b => { b.innerHTML = iconHTML(m ? 'mute' : 'volume'); }); }

/* ---------- Media carousel ---------- */
function mediaFrame(post, opts = {}) {
  const media = post.media || [];
  const ratio = opts.ratio != null ? opts.ratio : aspectRatioOf(post);
  const frame = el('div', { class: 'media-frame' });
  if (!opts.fill) frame.style.aspectRatio = String(ratio);
  const track = el('div', { class: 'media-track' });
  let hasVideo = false;
  media.forEach((m, i) => {
    const item = el('div', { class: 'media-item' + (opts.contain ? ' contain' : '') });
    const css = filterCss(m);
    if (m.type === 'video') {
      hasVideo = true;
      const v = el('video', { src: mediaUrl(m.id), playsinline: true, loop: true, preload: 'metadata', class: 'auto' });
      if (m.poster) v.setAttribute('poster', mediaUrl(m.poster));
      v.muted = S.ui.muted; if (css) v.style.filter = css;
      v.addEventListener('click', e => { e.stopPropagation(); setMuted(!S.ui.muted); });
      item.append(v); if (videoIO) videoIO.observe(v);
    } else {
      const img = el('img', { src: mediaUrl(m.id), alt: m.alt || '', loading: i ? 'lazy' : 'eager', draggable: 'false' });
      if (css) img.style.filter = css;
      img.addEventListener('error', () => { img.replaceWith(el('div', { class: 'muted small', style: 'padding:24px;text-align:center' }, '画像を表示できません')); });
      item.append(img);
    }
    track.append(item);
  });
  frame.append(track);
  const heart = el('div', { class: 'big-heart', html: iconHTML('heart', '', true) });
  frame.append(heart);
  const dots = el('div', { class: 'dots' });
  let index = 0;
  const setIndex = i => { index = Math.max(0, Math.min(media.length - 1, i)); track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' }); };
  const syncUi = () => {
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('on', i === index));
    if (prev) prev.hidden = index === 0; if (next) next.hidden = index >= media.length - 1;
    if (count) count.textContent = `${index + 1}/${media.length}`;
  };
  let prev = null, next = null, count = null;
  if (media.length > 1) {
    prev = el('button', { class: 'media-nav prev', 'aria-label': '前へ', html: iconHTML('chevL'), onclick: e => { e.stopPropagation(); setIndex(index - 1); } });
    next = el('button', { class: 'media-nav next', 'aria-label': '次へ', html: iconHTML('chevR'), onclick: e => { e.stopPropagation(); setIndex(index + 1); } });
    count = el('div', { class: 'media-count num' });
    frame.append(prev, next, count);
    media.forEach(() => dots.append(el('i')));
    track.addEventListener('scroll', debounce(() => { const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (i !== index) { index = i; syncUi(); } }, 60));
    syncUi();
  }
  if (hasVideo) {
    const mute = el('button', { class: 'media-mute', 'aria-label': '音声', html: iconHTML(S.ui.muted ? 'mute' : 'volume'), onclick: e => { e.stopPropagation(); setMuted(!S.ui.muted); } });
    frame.append(mute);
  }
  // double tap / double click to like
  let lastTap = 0;
  const burst = () => { heart.classList.remove('go'); void heart.offsetWidth; heart.classList.add('go'); };
  const like = () => { if (opts.onLike) opts.onLike(); burst(); };
  frame.addEventListener('dblclick', e => { e.preventDefault(); like(); });
  frame.addEventListener('touchend', e => { const t = now(); if (t - lastTap < 320) { e.preventDefault(); like(); lastTap = 0; } else lastTap = t; }, { passive: false });
  return { frame, dots: media.length > 1 ? dots : null, setIndex };
}

/* ---------- Post card ---------- */
function postSig(p) {
  const a = userOf(p.authorId); const cs = commentsOf(p.id);
  return [p.updatedAt || p.createdAt, likeCount(p.id), likedByMe(p.id), savedByMe(p.id), cs.length, cs.length ? cs[cs.length - 1].id : '', a.username, a.avatar, p.hideLikes, p.commentsOff, Object.keys(S.users).length].join('|');
}
function postHead(p, opts = {}) {
  const a = userOf(p.authorId);
  const who = el('div', { class: 'who' }, el('div', { class: 'row', style: 'gap:6px' }, userLink(a), el('span', { class: 'time-dot' }, '· ' + timeAgo(p.createdAt, true))));
  if (p.location) who.append(el('div', { class: 'loc' }, p.location));
  const head = el('div', { class: 'post-head' }, ringEl(a, 's', storyStateFor(a.id), activeStories().some(s => s.ownerId === a.id) ? () => openStoryViewer(a.id) : () => openProfile(a.id)), who);
  if (!opts.noMore) head.append(el('button', { class: 'more', 'aria-label': 'オプション', html: iconHTML('more'), onclick: () => postOptions(p) }));
  return head;
}
function storyStateFor(uid) { const s = activeStories().find(x => x.ownerId === uid); if (!s) return 'none'; return s.unseen ? '' : 'seen'; }
function likesLine(p) {
  const n = likeCount(p.id); const isAuthor = p.authorId === S.uid;
  if (p.hideLikes && !isAuthor) { if (n === 0) return null; const first = userOf(postLikes(p.id)[0].uid); return el('div', { class: 'post-likes' }, el('span', { class: 'muted', style: 'font-weight:500' }, n === 1 ? `${displayName(first)}さんがいいねしました` : `${displayName(first)}さん、他がいいねしました`)); }
  if (n === 0) return el('div', { class: 'post-likes muted', style: 'font-weight:500' }, 'いいね！を送ろう');
  return el('div', { class: 'post-likes' }, el('button', { onclick: () => openLikesList(p.id) }, `いいね！${fmtCount(n)}件`));
}
function captionBlock(p, expanded = false) {
  const a = userOf(p.authorId);
  const cap = el('div', { class: 'post-caption' });
  if (!p.caption) return null;
  cap.append(userLink(a));
  const text = p.caption; const long = text.length > 125 && !expanded;
  cap.append(linkify(long ? text.slice(0, 125).trimEnd() + '…' : text));
  if (long) cap.append(el('button', { class: 'more-btn', onclick: () => cap.replaceWith(captionBlock(p, true)) }, 'もっと見る'));
  return cap;
}
function postFoot(p, opts = {}) {
  const foot = el('div', { class: 'post-foot' });
  const liked = likedByMe(p.id), saved = savedByMe(p.id);
  const actions = el('div', { class: 'post-actions' },
    el('button', { class: liked ? 'liked' : '', 'aria-label': 'いいね', html: iconHTML('heart', '', liked), onclick: () => toggleLike(p.id) }),
    el('button', { 'aria-label': 'コメント', html: iconHTML('comment'), onclick: () => openPost(p.id, { focus: true }) }),
    el('button', { 'aria-label': 'シェア', html: iconHTML('send'), onclick: () => shareSheet(p) }),
    el('button', { class: 'save' + (saved ? ' saved' : ''), 'aria-label': '保存', html: iconHTML('bookmark', '', saved), onclick: () => toggleSave(p.id) }),
  );
  const body = el('div', { class: 'post-body' });
  const ll = likesLine(p); if (ll) body.append(ll);
  const cap = opts.noCaption ? null : captionBlock(p); if (cap) body.append(cap);
  if (!opts.noComments) {
    const cs = commentsOf(p.id); const top = cs.filter(c => !c.parentId);
    if (cs.length) body.append(el('button', { class: 'post-comments-link', style: 'text-align:left', onclick: () => openPost(p.id) }, `コメント${cs.length}件をすべて見る`));
    for (const c of top.slice(-2)) body.append(el('div', { class: 'post-caption' }, userLink(userOf(c.authorId)), linkify(c.text)));
  }
  body.append(el('div', { class: 'post-time' }, timeAgo(p.createdAt)));
  foot.append(actions, body);
  return foot;
}
function addCommentForm(p, opts = {}) {
  if (p.commentsOff) return el('div', { class: 'add-comment muted small', style: 'justify-content:center' }, 'この投稿へのコメントはオフになっています');
  const input = el('input', { placeholder: 'コメントを追加…', id: 'cm-' + p.id + (opts.suffix || ''), maxlength: 1000, autocomplete: 'off' });
  const send = el('button', { type: 'submit' }, '投稿');
  send.disabled = true;
  input.addEventListener('input', () => { send.disabled = !input.value.trim(); });
  const form = el('form', { class: 'add-comment', onsubmit: async e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; send.disabled = true; const ok = await addComment(p.id, v, opts.parentIdRef ? opts.parentIdRef() : null); if (ok) { input.value = ''; if (opts.onSent) opts.onSent(ok); } send.disabled = !input.value.trim(); } });
  form.append(el('button', { type: 'button', class: 'emoji', 'aria-label': '絵文字', html: iconHTML('smile'), onclick: () => emojiPicker(em => { input.value += em; input.dispatchEvent(new Event('input')); input.focus(); }) }), input, send);
  form._input = input;
  return form;
}
function postCard(p, opts = {}) {
  const art = el('article', { class: 'post', dataset: { id: p.id } });
  const mf = mediaFrame(p, { onLike: () => { if (!likedByMe(p.id)) toggleLike(p.id); } });
  const head = postHead(p); const foot = postFoot(p, opts); const add = addCommentForm(p, opts);
  art.append(head, mf.frame); if (mf.dots) art.append(mf.dots); art.append(foot, add);
  art._sig = postSig(p);
  art._update = np => {
    const sig = postSig(np); if (sig === art._sig) return; art._sig = sig;
    const nh = postHead(np), nf = postFoot(np, opts);
    art.querySelector('.post-head').replaceWith(nh); art.querySelector('.post-foot').replaceWith(nf);
    if ((np.media || []).length !== (p.media || []).length || JSON.stringify(np.media) !== JSON.stringify(p.media)) { const nm = mediaFrame(np, { onLike: () => { if (!likedByMe(np.id)) toggleLike(np.id); } }); art.querySelector('.media-frame').replaceWith(nm.frame); const od = art.querySelector('.dots'); if (od) od.remove(); if (nm.dots) nm.frame.after(nm.dots); }
    if (!!np.commentsOff !== !!p.commentsOff) art.querySelector('.add-comment').replaceWith(addCommentForm(np, opts));
    p = np;
  };
  return art;
}
function emojiPicker(onPick) {
  const emojis = ['😊', '😂', '😍', '🔥', '👏', '🙌', '❤️', '💙', '✨', '🎉', '😮', '😢', '🙏', '👀', '💯', '🥰', '😎', '🤔', '🍣', '🏔️', '🎨', '🎧', '📷', '🌸'];
  const grid = el('div', { style: 'display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:12px' });
  const m = el('div', { class: 'modal' }, grid);
  const close = openModal(m, { autofocus: false });
  for (const e of emojis) grid.append(el('button', { style: 'font-size:26px;height:48px;border-radius:10px', onclick: () => { onPick(e); close(); } }, e));
}
function copyText(text) {
  return new Promise(resolve => {
    const done = () => { toast('リンクをコピーしました', 'check'); resolve(true); };
    try { navigator.clipboard.writeText(text).then(done).catch(() => fallback()); } catch (e) { fallback(); }
    function fallback() {
      const input = el('input', { class: 'input', value: text, readonly: true, id: 'copy-' + uid(4) });
      const m = modalFrame({ title: 'リンク', left: closeBtn(() => close()), body: el('div', { class: 'modal-body' }, el('p', { class: 'hint' }, '以下のリンクを選択してコピーしてください'), input) });
      const close = openModal(m, { onClose: () => resolve(false) });
      setTimeout(() => { input.focus(); input.select(); }, 50);
    }
  });
}
function postLink(pid) { return location.origin + location.pathname + '#post-' + pid; }
function profileLink(u) { return location.origin + location.pathname + '#user-' + u.username; }
function postOptions(p) {
  const mine = p.authorId === S.uid; const items = [];
  if (mine || S.isOwner) items.push({ label: '削除', danger: true, onClick: async () => { if (await confirmDialog({ title: '投稿を削除しますか？', text: 'この操作は取り消せません。', okLabel: '削除', danger: true })) { await run(() => deletePost(p.id), '削除できませんでした'); toast('投稿を削除しました'); if (S.route.name === 'post') back(); closeAllModals(); } } });
  if (mine) {
    items.push({ label: '編集', onClick: () => editPostDialog(p) });
    items.push({ label: p.hideLikes ? 'いいね数を表示' : 'いいね数を非表示', onClick: () => run(() => editPost(p.id, { hideLikes: !p.hideLikes })) });
    items.push({ label: p.commentsOff ? 'コメントをオン' : 'コメントをオフ', onClick: () => run(() => editPost(p.id, { commentsOff: !p.commentsOff })) });
  } else {
    if (S.uid) items.push(isFollowing(S.uid, p.authorId) ? { label: 'フォローをやめる', danger: true, onClick: () => toggleFollow(p.authorId) } : { label: 'フォローする', onClick: () => toggleFollow(p.authorId) });
    if (S.uid) items.push({ label: '興味がない（非表示）', onClick: () => hidePost(p.id) });
  }
  items.push({ label: '投稿へ移動', onClick: () => openPost(p.id) });
  items.push({ label: 'シェア', onClick: () => shareSheet(p) });
  items.push({ label: 'リンクをコピー', onClick: () => copyText(postLink(p.id)) });
  items.push({ label: 'このアカウントについて', onClick: () => openProfile(p.authorId) });
  openSheet(items);
}
function shareSheet(p) {
  openSheet([
    { label: 'メッセージで送信', icon: 'send', onClick: () => pickRecipients({ title: 'シェア', okLabel: '送信', multi: true }, async ids => { for (const id of ids) { const tid = await getOrCreateThread([id]); await sendMessage(tid, { post: p.id }); } toast('送信しました', 'check'); }) },
    { label: 'リンクをコピー', icon: 'link', onClick: () => copyText(postLink(p.id)) },
  ]);
}
function editPostDialog(p) {
  const ta = el('textarea', { class: 'input', id: 'edit-cap', maxlength: 2200 }, p.caption || '');
  const loc = el('input', { class: 'input', id: 'edit-loc', value: p.location || '', placeholder: '場所', maxlength: 80 });
  const cnt = el('div', { class: 'count num' }, `${(p.caption || '').length}/2200`);
  ta.addEventListener('input', () => { cnt.textContent = `${ta.value.length}/2200`; });
  const body = el('div', { class: 'modal-body' }, el('div', { class: 'field' }, el('label', { for: 'edit-cap' }, 'キャプション'), ta, cnt), el('div', { class: 'field' }, el('label', { for: 'edit-loc' }, '場所'), loc));
  const save = el('button', { onclick: async () => { save.disabled = true; await run(() => editPost(p.id, { caption: ta.value, location: loc.value }), '保存できませんでした'); close(); toast('投稿を更新しました', 'check'); } }, '完了');
  const m = modalFrame({ title: '投稿を編集', left: closeBtn(() => close()), right: save, body, size: 'md' });
  const close = openModal(m);
}
function userListModal(title, uids, opts = {}) {
  const list = el('div', { class: 'list-body' });
  let close = null;
  const draw = () => {
    clear(list);
    const ids = typeof uids === 'function' ? uids() : uids;
    if (!ids.length) { list.append(emptyState('users', opts.emptyTitle || 'まだ誰もいません', opts.emptyText || '')); return; }
    for (const id of ids) {
      const u = userOf(id);
      const row = el('div', { class: 'person' }, avatarEl(u, 'm'), el('div', { class: 'who' }, el('button', { class: 'u', onclick: () => { close(); openProfile(id); } }, displayName(u)), el('div', { class: 'n' }, u.name || '')));
      const fb = followBtn(id); if (fb) row.append(fb);
      if (opts.rowExtra) { const x = opts.rowExtra(id, close); if (x) row.append(x); }
      list.append(row);
    }
  };
  const m = modalFrame({ title, left: closeBtn(() => close()), body: list, cls: 'list' });
  close = openModal(m, { autofocus: false, onClose: () => liveUpdaters.delete(draw) });
  draw();
  liveUpdaters.add(draw);
  return close;
}
function openLikesList(pid) { userListModal('いいね！', () => postLikes(pid).map(l => l.uid), { emptyTitle: 'まだいいねがありません' }); }
function pickRecipients({ title = '宛先', okLabel = '次へ', multi = true, exclude = [] }, onDone) {
  const picked = new Set();
  const q = el('input', { class: 'input bare', placeholder: '検索…', id: 'pick-q', autocomplete: 'off' });
  const list = el('div', { class: 'list-body' });
  const chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px 0' });
  const ok = el('button', { onclick: async () => { if (!picked.size) return; ok.disabled = true; close(); await onDone(Array.from(picked)); } }, okLabel);
  ok.disabled = true;
  const body = el('div', { class: 'modal-body flush', style: 'min-height:320px' }, chips, el('div', { style: 'padding:8px 16px' }, q), list);
  const m = modalFrame({ title, left: closeBtn(() => close()), right: ok, body, cls: 'list' });
  const close = openModal(m);
  const draw = () => {
    clear(list); clear(chips);
    for (const id of picked) chips.append(el('span', { class: 'chip' }, avatarEl(userOf(id), 'xs'), displayName(userOf(id)), el('button', { 'aria-label': '外す', html: iconHTML('x'), onclick: () => { picked.delete(id); ok.disabled = !picked.size; draw(); } })));
    const needle = q.value.trim().toLowerCase();
    const users = Object.values(S.users).filter(u => u.id !== S.uid && !exclude.includes(u.id) && (!needle || u.username.includes(needle) || (u.name || '').toLowerCase().includes(needle)))
      .sort((a, b) => (isFollowing(S.uid, b.id) - isFollowing(S.uid, a.id)) || a.username.localeCompare(b.username));
    if (!users.length) list.append(emptyState('users', 'ユーザーが見つかりません', ''));
    for (const u of users) {
      const on = picked.has(u.id);
      list.append(el('button', { class: 'person pick', onclick: () => { if (on) picked.delete(u.id); else { if (!multi) picked.clear(); picked.add(u.id); } ok.disabled = !picked.size; draw(); } }, avatarEl(u, 'm'), el('div', { class: 'who' }, el('div', { class: 'u' }, displayName(u)), el('div', { class: 'n' }, u.name || '')), el('span', { class: 'check' + (on ? ' on' : ''), html: on ? iconHTML('check') : '' })));
    }
  };
  q.addEventListener('input', draw);
  draw();
}
const liveUpdaters = new Set();
