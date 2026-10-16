/* ===================================================================
   Chrome (navigation) and views
   =================================================================== */
function brandEl(small = false) {
  return el('div', { class: 'brand' }, el('span', { class: 'mark' }, 'K'), el('span', { class: 'word' }, 'KENGO FRIEND', el('small', {}, 'SNS')));
}
function navDefs() {
  return [
    { name: 'home', label: 'ホーム', icon: 'home' },
    { name: 'search', label: '検索', icon: 'search' },
    { name: 'explore', label: '発見', icon: 'explore' },
    { name: 'reels', label: 'リール', icon: 'reels' },
    { name: 'music', label: 'MUSIC', icon: 'music' },
    { name: 'messages', label: 'メッセージ', icon: 'send', badge: unreadThreadCount() },
    { name: 'notifications', label: 'お知らせ', icon: 'heart', badge: unreadNotifCount() },
    { name: 'create', label: '作成', icon: 'plus', action: () => openCreateMenu() },
    { name: 'profile', label: 'プロフィール', avatar: true },
  ];
}
function navButton(d, active) {
  const b = el('button', { class: 'nav-item' + (active ? ' active' : ''), onclick: () => (d.action ? d.action() : d.name === 'profile' ? (S.uid ? openProfile(S.uid) : toast('サインインが必要です')) : go(d.name)) });
  if (d.avatar) b.append(avatarEl(me() || { id: S.uid || 'x', username: '?' }, 'xs'));
  else b.append(icon(d.icon, '', active && ['home', 'heart', 'send', 'explore', 'reels'].includes(d.icon) ? false : false));
  b.append(el('span', { class: 'label' }, d.label));
  if (d.badge) b.append(el('span', { class: 'badge num' }, d.badge > 99 ? '99+' : d.badge));
  return b;
}
function renderChrome() {
  const app = $('#app');
  app.classList.toggle('gated', !!S.gate);
  if (S.gate) { clear($('#nav')); clear($('#topbar')); clear($('#tabbar')); clear($('#rail')); return; }
  const route = S.route.name;
  const isActive = d => d.name === route || (d.name === 'profile' && route === 'profile' && S.route.params.uid === S.uid);
  const nav = $('#nav'); clear(nav);
  nav.append(brandEl());
  for (const d of navDefs()) nav.append(navButton(d, isActive(d)));
  nav.append(el('div', { class: 'nav-bottom' }, navButton({ name: 'settings', label: 'その他', icon: 'menu' }, route === 'settings')));
  const top = $('#topbar'); clear(top);
  top.append(el('button', { class: 'brand', onclick: () => go('home') }, el('span', { class: 'mark' }, 'K'), el('span', { class: 'word' }, 'KENGO FRIEND SNS')));
  const acts = el('div', { class: 'actions' });
  const un = unreadNotifCount(), ut = unreadThreadCount();
  acts.append(el('button', { 'aria-label': 'お知らせ', onclick: () => go('notifications'), html: iconHTML('heart') + (un ? `<span class="badge num">${un > 99 ? '99+' : un}</span>` : '') }));
  acts.append(el('button', { 'aria-label': 'メッセージ', onclick: () => go('messages'), html: iconHTML('send') + (ut ? `<span class="badge num">${ut > 99 ? '99+' : ut}</span>` : '') }));
  top.append(acts);
  const tab = $('#tabbar'); clear(tab);
  const tabs = [
    { name: 'home', icon: 'home' }, { name: 'search', icon: 'search' }, { name: 'create', icon: 'plus', action: () => openCreateMenu() }, { name: 'music', icon: 'music' }, { name: 'profile', avatar: true },
  ];
  for (const d of tabs) {
    const b = el('button', { class: isActive(d) ? 'active' : '', 'aria-label': d.name, onclick: () => (d.action ? d.action() : d.name === 'profile' ? (S.uid ? openProfile(S.uid) : toast('サインインが必要です')) : go(d.name)) });
    if (d.avatar) b.append(avatarEl(me() || { id: S.uid || 'x', username: '?' }, 'xs')); else b.append(icon(d.icon, 'l'));
    tab.append(b);
  }
  renderRail();
}
function renderRail() {
  const rail = $('#rail'); clear(rail);
  if (S.gate) return;
  const m = me();
  if (m) rail.append(el('div', { class: 'me' }, ringEl(m, 'm', 'none', () => openProfile(S.uid)), el('div', { class: 'who grow' }, el('button', { class: 'u', onclick: () => openProfile(S.uid) }, m.username), el('div', { class: 'n trunc' }, m.name || '')), el('button', { class: 'link small', onclick: () => go('settings') }, '設定')));
  const sugg = suggestedUsers(5);
  if (sugg.length) {
    rail.append(el('h4', {}, el('span', {}, 'おすすめのアカウント'), el('button', { class: 'small', style: 'color:var(--fg)', onclick: () => userListModal('おすすめ', () => suggestedUsers(50).map(u => u.id)) }, 'すべて見る')));
    for (const u of sugg) rail.append(el('div', { class: 'sugg' }, ringEl(u, 's', storyStateFor(u.id), () => openProfile(u.id)), el('div', { class: 'who' }, el('button', { class: 'u', onclick: () => openProfile(u.id) }, u.username), el('div', { class: 'n trunc' }, followersOf(u.id).length ? `フォロワー${followersOf(u.id).length}人` : (u.name || '新しいメンバー'))), followBtn(u.id)));
  }
  rail.append(el('div', { class: 'foot' }, el('b', {}, 'KENGO FRIEND SNS'), `友人だけのクローズドなタイムライン。写真・動画・ストーリーズ・メッセージを、招待された仲間と。`, el('br'), `${Object.keys(S.users).length}人のメンバー · ${Object.keys(allPostsMap()).length}件の投稿`));
}

/* ---------- Render loop ---------- */
let currentView = null;
function render() {
  renderChrome();
  try { renderPlayer(); } catch (e) { console.error(e); }
  const main = $('#main');
  const key = S.gate ? 'gate' : routeKey(S.route);
  if (!currentView || currentView.key !== key) {
    if (currentView && currentView.onLeave) try { currentView.onLeave(); } catch (e) {}
    clear(main);
    currentView = S.gate ? gateView() : buildView(S.route);
    currentView.key = key;
    main.className = 'main ' + (currentView.cls || '');
    main.append(currentView.el);
    if (currentView.onEnter) try { currentView.onEnter(); } catch (e) { console.error(e); }
    window.scrollTo(0, 0);
  } else if (currentView.update) {
    try { currentView.update(); } catch (e) { console.error(e); }
  }
  for (const fn of Array.from(liveUpdaters)) { try { fn(); } catch (e) { console.error(e); } }
}
function buildView(r) {
  switch (r.name) {
    case 'home': return homeView();
    case 'search': return searchView();
    case 'explore': return exploreView();
    case 'reels': return reelsView();
    case 'music': return musicView();
    case 'messages': return messagesView();
    case 'notifications': return notificationsView();
    case 'profile': return profileView(r.params.uid);
    case 'tag': return tagView(r.params.tag);
    case 'settings': return settingsView();
    case 'post': return postPageView(r.params.id, r.params.focus);
    default: return homeView();
  }
}
function gateView() {
  const g = S.gate;
  if (g === 'auth') return authView();
  if (g === 'offline') return offlineView();
  if (g === 'pending') return pendingView();
  const card = el('div', { class: 'card' }, brandEl());
  if (g === 'signin') { card.append(el('h2', {}, 'サインインして参加する'), el('p', {}, 'KENGO FRIEND SNS は招待制です。招待を受けたアカウントでサインインすると、タイムラインが表示されます。')); }
  else card.append(el('h2', {}, '読み込めませんでした'), el('p', {}, 'ページを再読み込みしてください。問題が続く場合は、招待したオーナーに連絡してください。'));
  return { el: el('div', { class: 'gate' }, card), cls: 'full' };
}

/* ---------- Home ---------- */
function renderStoriesTray(tray) {
  clear(tray);
  const stories = activeStories(); const mine = stories.find(s => s.ownerId === S.uid);
  const m = me();
  if (S.uid && m) {
    const ring = ringEl(m, '', mine ? (mine.unseen ? '' : 'seen') : 'none');
    ring.append(el('span', { class: 'add', html: iconHTML('plusCircle'), onclick: e => { e.stopPropagation(); openStoryCompose(); } }));
    tray.append(el('button', { class: 'story-btn', onclick: () => (mine ? openStoryViewer(S.uid) : openStoryCompose()) }, ring, el('span', { class: 'name' }, 'ストーリーズ')));
  }
  for (const s of stories) {
    if (s.ownerId === S.uid) continue;
    const u = userOf(s.ownerId);
    tray.append(el('button', { class: 'story-btn', onclick: () => openStoryViewer(s.ownerId) }, ringEl(u, '', s.unseen ? '' : 'seen'), el('span', { class: 'name' }, displayName(u))));
  }
  tray.hidden = !tray.children.length;
}
function homeView() {
  const root = el('div');
  const banner = modeBanner(); if (banner) root.append(banner);
  const tray = el('div', { class: 'stories' });
  const feed = el('div', { class: 'feed' });
  const empty = el('div');
  const sugDivider = el('div', { class: 'divider-label' }, 'おすすめの投稿');
  const sugFeed = el('div', { class: 'feed' });
  root.append(tray, feed, empty, sugDivider, sugFeed);
  const update = () => {
    renderStoriesTray(tray);
    const { main, suggested } = feedPosts();
    keyedList(feed, main, p => p.id, p => postCard(p), (n, p) => n._update(p));
    clear(empty);
    if (!main.length) {
      if (!S.loaded.posts) empty.append(el('div', { class: 'empty' }, el('div', { class: 'spinner' })));
      else if (!suggested.length) empty.append(emptyState('camera', 'まだ投稿がありません', '最初の写真や動画をシェアして、タイムラインを始めましょう。', S.uid ? el('button', { class: 'btn primary', onclick: () => openCreateMenu() }, '投稿を作成') : null));
      else if (S.uid) empty.append(emptyState('users', 'フォローして始めよう', '友人をフォローすると、その投稿がここに並びます。まずはおすすめの投稿をどうぞ。'));
    }
    sugDivider.hidden = !suggested.length || !S.loaded.posts;
    keyedList(sugFeed, suggested.slice(0, 60), p => p.id, p => postCard(p), (n, p) => n._update(p));
  };
  update();
  return { el: root, update, cls: 'flush' };
}

/* ---------- Tiles / Explore ---------- */
function tileEl(p, opts = {}) {
  const t = el('button', { class: 'tile' + (opts.tall ? ' tall' : ''), 'aria-label': '投稿を開く', onclick: () => openPost(p.id) });
  const m = (p.media || [])[0] || {};
  const css = filterCss(m);
  if (m.type === 'video') {
    if (m.poster) { const img = el('img', { src: mediaUrl(m.poster), alt: '', loading: 'lazy' }); if (css) img.style.filter = css; t.append(img); }
    else { const v = el('video', { src: mediaUrl(m.id), preload: 'metadata', playsinline: true }); v.muted = true; if (css) v.style.filter = css; t.append(v); }
  } else { const img = el('img', { src: mediaUrl(m.id), alt: m.alt || '', loading: 'lazy' }); if (css) img.style.filter = css; t.append(img); }
  if ((p.media || []).length > 1) t.append(el('span', { class: 'kind', html: iconHTML('layers') }));
  else if (m.type === 'video') t.append(el('span', { class: 'kind', html: iconHTML('reels') }));
  const stats = el('div', { class: 'stats num' });
  t.append(stats);
  const draw = () => { clear(stats); stats.append(el('span', { html: iconHTML('heart', '', true) + ' ' + fmtCount(likeCount(p.id)) }), el('span', { html: iconHTML('comment', '', true) + ' ' + fmtCount(commentCount(p.id)) })); };
  draw(); t._update = draw;
  return t;
}
function gridOf(container, posts, opts = {}) {
  keyedList(container, posts, p => p.id, p => tileEl(p, opts), (n, p) => n._update && n._update(p));
}
function exploreView() {
  const root = el('div');
  const banner = modeBanner(); if (banner) root.append(banner);
  const grid = el('div', { class: 'explore-grid' });
  const empty = el('div');
  root.append(el('h2', { class: 'page-title' }, el('span', { class: 'grow' }, '発見'), el('button', { class: 'btn sm', onclick: () => go('reels') }, icon('reels'), 'リール')), grid, empty);
  const update = () => {
    const posts = explorePosts();
    keyedList(grid, posts, p => p.id, (p) => tileEl(p, { tall: isReel(p) && posts.indexOf(p) % 7 === 2 }), (n, p) => n._update && n._update(p));
    clear(empty);
    if (!posts.length && S.loaded.posts) empty.append(emptyState('explore', 'まだ発見できる投稿がありません', '友人が投稿すると、ここに新しい写真と動画が並びます。'));
  };
  update();
  return { el: root, update, cls: 'wide' };
}

/* ---------- Reels ---------- */
function reelEl(p) {
  const m = (p.media || []).find(x => x.type === 'video');
  const r = el('div', { class: 'reel', dataset: { id: p.id } });
  const v = el('video', { src: mediaUrl(m.id), playsinline: true, loop: true, preload: 'metadata', class: 'auto' });
  if (m.poster) v.setAttribute('poster', mediaUrl(m.poster));
  v.muted = S.ui.muted; const css = filterCss(m); if (css) v.style.filter = css;
  r.append(v, el('div', { class: 'play-hint', html: iconHTML('play') }));
  if (videoIO) videoIO.observe(v);
  v.addEventListener('click', () => { if (v.paused) { v.play().catch(() => {}); r.classList.remove('paused'); } else { v.pause(); r.classList.add('paused'); } });
  r.append(el('button', { class: 'mute', 'aria-label': '音声', html: iconHTML(S.ui.muted ? 'mute' : 'volume'), onclick: () => setMuted(!S.ui.muted) }));
  const side = el('div', { class: 'side' });
  const info = el('div', { class: 'info' });
  r.append(side, info);
  const draw = () => {
    clear(side); clear(info);
    const liked = likedByMe(p.id), saved = savedByMe(p.id);
    side.append(
      el('button', { class: liked ? 'liked' : '', onclick: () => toggleLike(p.id) }, icon('heart', '', liked), el('span', { class: 'num' }, fmtCount(likeCount(p.id)))),
      el('button', { onclick: () => openPost(p.id, { focus: true }) }, icon('comment'), el('span', { class: 'num' }, fmtCount(commentCount(p.id)))),
      el('button', { onclick: () => shareSheet(p) }, icon('send'), el('span', {}, 'シェア')),
      el('button', { class: saved ? 'saved' : '', onclick: () => toggleSave(p.id) }, icon('bookmark', '', saved)),
      el('button', { onclick: () => postOptions(p) }, icon('more')),
    );
    const a = userOf(p.authorId);
    info.append(el('div', { class: 'u' }, avatarEl(a, 's'), el('button', { style: 'font-weight:700', onclick: () => openProfile(a.id) }, displayName(a)), a.id !== S.uid && !isFollowing(S.uid, a.id) ? el('button', { class: 'btn', onclick: () => toggleFollow(a.id) }, 'フォローする') : null));
    if (p.caption) info.append(el('div', { class: 'cap' }, linkify(p.caption)));
  };
  draw(); r._update = draw;
  return r;
}
function reelsView() {
  const root = el('div', { class: 'reels' });
  const empty = el('div');
  const update = () => {
    const posts = Object.values(allPostsMap()).filter(isVideoPost).sort((a, b) => b.createdAt - a.createdAt);
    keyedList(root, posts, p => p.id, p => reelEl(p), (n, p) => n._update && n._update(p));
    if (!posts.length) { if (!root.contains(empty)) root.append(empty); clear(empty); empty.append(emptyState('reels', 'リールはまだありません', '動画を投稿すると、縦スクロールでここに表示されます。', S.uid ? el('button', { class: 'btn primary', onclick: () => openCreate('reel') }, 'リールを作成') : null)); }
    else empty.remove();
  };
  update();
  return { el: root, update, cls: 'wide', onLeave: () => { $$('video', root).forEach(v => v.pause()); } };
}

/* ---------- Search ---------- */
function searchView() {
  const root = el('div');
  const input = el('input', { class: 'input', placeholder: '検索（ユーザー名・名前・#タグ）', id: 'search-q', value: S.ui.searchQ || '', autocomplete: 'off' });
  const box = el('div', { class: 'search-box' }, icon('search'), input);
  const results = el('div');
  const explore = el('div', { class: 'explore-grid', style: 'margin-top:12px' });
  root.append(box, results, explore);
  let timer;
  const draw = () => {
    clear(results);
    const q = (input.value || '').trim(); S.ui.searchQ = q;
    if (!q) {
      const recent = S.priv.recent || [];
      if (recent.length) {
        results.append(el('div', { class: 'row', style: 'justify-content:space-between;padding:4px 10px;margin-bottom:4px' }, el('b', {}, '最近'), el('button', { class: 'link small', onclick: () => clearRecentSearches() }, 'すべてクリア')));
        for (const r of recent) {
          if (r.type === 'user') { const u = userOf(r.key); if (u.missing) continue; results.append(el('button', { class: 'result', onclick: () => openProfile(u.id) }, avatarEl(u, 'm'), el('div', { class: 'who' }, el('div', { class: 'u' }, u.username), el('div', { class: 'n' }, u.name || '')), el('span', { class: 'x', html: iconHTML('x'), onclick: e => { e.stopPropagation(); setPriv({ recent: recent.filter(x => x !== r) }); } }))); }
          else results.append(el('button', { class: 'result', onclick: () => openTag(r.key) }, el('span', { class: 'hash', html: iconHTML('hash') }), el('div', { class: 'who' }, el('div', { class: 'u' }, '#' + r.key), el('div', { class: 'n' }, `投稿${tagIndex()[r.key] || 0}件`)), el('span', { class: 'x', html: iconHTML('x'), onclick: e => { e.stopPropagation(); setPriv({ recent: recent.filter(x => x !== r) }); } })));
        }
      } else results.append(el('p', { class: 'hint', style: 'padding:4px 10px' }, 'ユーザー名や名前、#ハッシュタグで検索できます。'));
      explore.hidden = window.innerWidth >= 700; gridOf(explore, explorePosts().slice(0, 30));
      return;
    }
    explore.hidden = true;
    const needle = q.toLowerCase().replace(/^@/, '');
    const isTag = q.startsWith('#');
    const tagQ = q.replace(/^#/, '').toLowerCase();
    const users = isTag ? [] : Object.values(S.users).filter(u => u.username.includes(needle) || (u.name || '').toLowerCase().includes(needle)).slice(0, 20);
    const tags = Object.entries(tagIndex()).filter(([t]) => t.includes(tagQ)).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!users.length && !tags.length) results.append(emptyState('search', '見つかりませんでした', '別のキーワードで試してください。'));
    for (const u of users) results.append(el('button', { class: 'result', onclick: () => { addRecentSearch({ type: 'user', key: u.id }); openProfile(u.id); } }, avatarEl(u, 'm'), el('div', { class: 'who' }, el('div', { class: 'u' }, u.username), el('div', { class: 'n' }, [u.name, followersOf(u.id).length ? `フォロワー${followersOf(u.id).length}人` : ''].filter(Boolean).join(' · ')))));
    for (const [t, n] of tags) results.append(el('button', { class: 'result', onclick: () => { addRecentSearch({ type: 'tag', key: t }); openTag(t); } }, el('span', { class: 'hash', html: iconHTML('hash') }), el('div', { class: 'who' }, el('div', { class: 'u' }, '#' + t), el('div', { class: 'n' }, `投稿${n}件`))));
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 120); });
  draw();
  return { el: root, update: draw, onEnter: () => { if (window.innerWidth > 700) input.focus(); } };
}

/* ---------- Tag ---------- */
function tagView(tag) {
  const root = el('div');
  const grid = el('div', { class: 'grid' });
  const title = el('h2', { class: 'page-title' });
  root.append(title, grid);
  fetchPostsByTag(tag);
  const update = () => {
    const posts = postsWithTag(tag);
    clear(title); title.append(el('button', { class: 'back', 'aria-label': '戻る', html: iconHTML('back'), onclick: back }), el('span', { class: 'hash', style: 'width:44px;height:44px;border-radius:50%;border:1px solid var(--line-strong);display:grid;place-items:center', html: iconHTML('hash') }), el('div', {}, el('div', {}, '#' + tag), el('div', { class: 'muted small', style: 'font-weight:400' }, `投稿${posts.length}件`)));
    gridOf(grid, posts);
    if (!posts.length) { if (!root.querySelector('.empty')) root.append(emptyState('hash', 'このタグの投稿はまだありません', '')); } else { const e = root.querySelector('.empty'); if (e) e.remove(); }
  };
  update();
  return { el: root, update, cls: 'wide' };
}

/* ---------- Notifications ---------- */
function notifText(n) {
  switch (n.type) {
    case 'like': return 'があなたの投稿にいいね！しました';
    case 'comment': return `がコメントしました: ${(n.text || '').slice(0, 60)}`;
    case 'reply': return `が返信しました: ${(n.text || '').slice(0, 60)}`;
    case 'mention': return `があなたをメンションしました: ${(n.text || '').slice(0, 60)}`;
    case 'commentlike': return 'があなたのコメントにいいね！しました';
    case 'follow': return 'があなたをフォローしました';
    default: return '';
  }
}
function notificationsView() {
  const root = el('div');
  root.append(el('h2', { class: 'page-title' }, 'お知らせ'));
  const list = el('div');
  root.append(list);
  const update = () => {
    clear(list);
    const ns = notifications(); const seenAt = S.priv.notifSeenAt || 0;
    if (!ns.length) { list.append(emptyState('heart', 'お知らせはまだありません', 'いいね・コメント・フォローがあると、ここに表示されます。')); return; }
    const t = now(); const groups = [['今日', 86400000], ['今週', 7 * 86400000], ['今月', 30 * 86400000], ['以前', Infinity]];
    let gi = 0;
    for (const [label, span] of groups) {
      const items = ns.filter(n => { const age = t - n.ts; const prev = gi ? groups[gi - 1][1] : 0; return age >= prev && age < span; });
      gi++;
      if (!items.length) continue;
      const g = el('div', { class: 'notif-group' }, el('h4', {}, label));
      for (const n of items) {
        const a = userOf(n.actor);
        const row = el('button', { class: 'notif' + (n.ts > seenAt ? ' unread' : ''), onclick: () => (n.postId ? openPost(n.postId) : openProfile(n.actor)) });
        row.append(avatarEl(a, 'm'), el('div', { class: 'txt' }, el('span', { class: 'u' }, displayName(a)), notifText(n), el('span', { class: 't' }, timeAgo(n.ts, true))));
        if (n.type === 'follow') { const fb = followBtn(n.actor); if (fb) row.append(fb); }
        else if (n.postId) { const p = postOf(n.postId); const m = p && p.media && p.media[0]; if (m) row.append(el('img', { class: 'thumb', src: mediaUrl(m.type === 'video' ? (m.poster || m.id) : m.id), alt: '' })); }
        g.append(row);
      }
      list.append(g);
    }
  };
  update();
  let timer = null;
  return { el: root, update, onEnter: () => { timer = setTimeout(markNotifsSeen, 1500); }, onLeave: () => { clearTimeout(timer); markNotifsSeen(); } };
}

/* ---------- Profile ---------- */
function profileView(uidArg) {
  const root = el('div');
  const head = el('div', { class: 'profile-head' });
  const tabs = el('div', { class: 'tabs' });
  const grid = el('div', { class: 'grid' });
  const empty = el('div');
  root.append(head, tabs, grid, empty);
  const self = uidArg === S.uid;
  if (uidArg) fetchPostsBy(uidArg);
  let headSig = '';
  const update = () => {
    const u = userOf(uidArg);
    const posts = postsBy(uidArg);
    const sig = [u.username, u.name, u.bio, u.website, u.avatar, u.owner, posts.length, followersOf(uidArg).length, followingOf(uidArg).length, isFollowing(S.uid, uidArg), isFollowing(uidArg, S.uid), storyStateFor(uidArg)].join('|');
    if (sig !== headSig) {
      headSig = sig; clear(head);
      const pic = el('div', { class: 'pic' }, ringEl(u, 'xxl', storyStateFor(uidArg), activeStories().some(s => s.ownerId === uidArg) ? () => openStoryViewer(uidArg) : (self ? () => openEditProfile() : null)));
      const top = el('div', { class: 'top' }, el('span', { class: 'u' }, u.missing ? 'ユーザーが見つかりません' : u.username));
      const actions = el('div', { class: 'actions row' });
      if (self) actions.append(el('button', { class: 'btn', onclick: () => openEditProfile() }, 'プロフィールを編集'), el('button', { class: 'btn', onclick: () => go('settings') }, '設定'));
      else if (!u.missing && S.uid) { const fb = followBtn(uidArg, { size: '' }); if (fb) actions.append(fb); actions.append(el('button', { class: 'btn', onclick: () => openThreadWith(uidArg) }, 'メッセージ')); }
      top.append(actions);
      if (u.owner) top.append(el('span', { class: 'admin' }, '管理者'));
      const stats = el('div', { class: 'stats num' },
        el('button', {}, el('b', {}, posts.length), '投稿'),
        el('button', { onclick: () => userListModal('フォロワー', () => followersOf(uidArg), { rowExtra: (self && S.isOwner) ? (id => el('button', { class: 'btn sm', onclick: async () => { if (await confirmDialog({ title: `${displayName(userOf(id))} をフォロワーから削除しますか？`, okLabel: '削除', danger: true })) removeFollower(id); } }, '削除')) : null }) }, el('b', {}, followersOf(uidArg).length), 'フォロワー'),
        el('button', { onclick: () => userListModal('フォロー中', () => followingOf(uidArg)) }, el('b', {}, followingOf(uidArg).length), 'フォロー中'),
      );
      const bio = el('div', { class: 'bio' });
      if (u.name) bio.append(el('div', { class: 'n' }, u.name));
      if (u.bio) bio.append(el('div', {}, linkify(u.bio)));
      if (u.website) { const href = /^https?:\/\//.test(u.website) ? u.website : 'https://' + u.website; bio.append(el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, u.website.replace(/^https?:\/\//, ''))); }
      head.append(pic, el('div', { class: 'info' }, top, stats, bio));
    }
    clear(tabs);
    const tabDefs = [['posts', 'grid', '投稿'], ['reels', 'reels', 'リール']];
    if (self) tabDefs.push(['saved', 'bookmark', '保存済み']);
    tabDefs.push(['tagged', 'tag', 'タグ付け']);
    const cur = S.ui.profileTab && tabDefs.some(t => t[0] === S.ui.profileTab) ? S.ui.profileTab : 'posts';
    for (const [k, ic, label] of tabDefs) tabs.append(el('button', { class: k === cur ? 'active' : '', onclick: () => { S.ui.profileTab = k; update(); } }, icon(ic), el('span', { class: 'label' }, label)));
    let items = [];
    if (cur === 'posts') items = posts;
    else if (cur === 'reels') items = posts.filter(isVideoPost);
    else if (cur === 'saved') items = Object.entries(S.priv.saves || {}).sort((a, b) => b[1] - a[1]).map(([id]) => postOf(id)).filter(Boolean);
    else if (cur === 'tagged') items = Object.values(allPostsMap()).filter(p => p.authorId !== uidArg && (p.mentions || []).includes(u.username)).sort((a, b) => b.createdAt - a.createdAt);
    gridOf(grid, items);
    clear(empty);
    if (!items.length) {
      const msgs = { posts: self ? ['写真や動画をシェアしよう', 'あなたの投稿はここに並びます。', el('button', { class: 'btn primary', onclick: () => openCreateMenu() }, '最初の投稿を作成')] : ['投稿はまだありません', ''], reels: ['リールはまだありません', ''], saved: ['保存した投稿', 'ブックマークした投稿は、あなただけが見られます。'], tagged: ['タグ付けされた投稿', `@${u.username} とメンションされた投稿がここに表示されます。`] };
      const [t, d, a] = msgs[cur];
      empty.append(emptyState(cur === 'posts' ? 'camera' : cur === 'reels' ? 'reels' : cur === 'saved' ? 'bookmark' : 'tag', t, d, a));
    }
  };
  update();
  return { el: root, update, cls: 'wide' };
}

/* ---------- Settings ---------- */
function settingsView() {
  const root = el('div');
  root.append(el('h2', { class: 'page-title' }, el('button', { class: 'back', 'aria-label': '戻る', html: iconHTML('back'), onclick: back }), '設定'));
  const list = el('div', { class: 'card settings-list' });
  const item = (ic, title, sub, onClick) => el('button', { class: 'item', onclick: onClick }, icon(ic), el('div', { class: 't' }, title, sub ? el('small', {}, sub) : null), icon('chevR', 's'));
  if (S.uid) {
    list.append(item('user', 'プロフィールを編集', 'ユーザー名・名前・自己紹介・アイコン', () => openEditProfile()));
    list.append(item('bookmark', '保存済み', 'ブックマークした投稿', () => { S.ui.profileTab = 'saved'; openProfile(S.uid); }));
    list.append(item('heart', 'いいねした投稿', '', () => openLikedPosts()));
    list.append(item('eye', '非表示にした投稿', `${Object.keys(S.priv.hiddenPosts || {}).length}件`, () => openHiddenPosts()));
    list.append(item('bell', 'お知らせを既読にする', '', () => { markNotifsSeen(); toast('お知らせを既読にしました', 'check'); }));
  }
  if (S.mode === 'api') {
    if (S.isOwner) {
      list.append(item('users', '合言葉と招待', '友人を参加させる方法', () => openInviteSettings()));
      list.append(item('shield', 'メンバー管理', '利用停止・パスワード再設定', () => openMembers()));
      list.append(item('cloud', '使用状況', '投稿数・写真と動画の容量', () => openUsage()));
    }
    list.append(item('lock', 'パスワードを変更', '', () => openChangePassword()));
    list.append(item('device', 'すべての端末からサインアウト', '他の端末のサインインも無効にします', async () => { if (await confirmDialog({ title: 'すべての端末からサインアウトしますか？', okLabel: 'サインアウト', danger: true })) { await run(() => S.store.logoutAll()); signOut(); } }));
    list.append(item('arrowR', 'サインアウト', '', async () => { if (await confirmDialog({ title: 'サインアウトしますか？', okLabel: 'サインアウト' })) signOut(); }));
  } else list.append(item('users', '招待とアクセスについて', '友人を参加させる方法', () => openAccessInfo()));
  list.append(item('info', 'KENGO FRIEND SNS について', '', () => openAbout()));
  if (S.mode === 'local') list.append(item('trash', 'ローカルデータを消去', 'このブラウザに保存したデータをすべて削除', async () => { if (await confirmDialog({ title: 'ローカルデータを消去しますか？', text: '投稿・画像・プロフィールがこのブラウザから削除されます。', okLabel: '消去', danger: true })) { try { localStorage.removeItem('kfs.v1'); } catch (e) {} try { indexedDB.deleteDatabase('kfs-media'); } catch (e) {} location.reload(); } }));
  root.append(list);
  return { el: root };
}
function openLikedPosts() {
  const ids = Object.entries((S.likes[S.uid] || {}).posts || {}).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const grid = el('div', { class: 'grid', style: 'padding:4px' });
  const m = modalFrame({ title: 'いいねした投稿', left: closeBtn(() => close()), body: el('div', { class: 'modal-body flush' }, grid), size: 'md' });
  const close = openModal(m, { autofocus: false });
  const posts = ids.map(postOf).filter(Boolean);
  if (!posts.length) grid.replaceWith(emptyState('heart', 'いいねした投稿はまだありません', ''));
  else gridOf(grid, posts);
}
function openHiddenPosts() {
  const ids = Object.keys(S.priv.hiddenPosts || {});
  const body = el('div', { class: 'modal-body' });
  const m = modalFrame({ title: '非表示にした投稿', left: closeBtn(() => close()), body });
  const close = openModal(m, { autofocus: false });
  if (!ids.length) body.append(emptyState('eye', '非表示の投稿はありません', ''));
  for (const id of ids) {
    const p = postOf(id);
    body.append(el('div', { class: 'row' }, el('span', { class: 'grow trunc' }, p ? `${displayName(userOf(p.authorId))}: ${(p.caption || '（キャプションなし）').slice(0, 40)}` : '削除された投稿'), el('button', { class: 'btn sm', onclick: () => { const h = Object.assign({}, S.priv.hiddenPosts); delete h[id]; const next = clone(S.priv); next.hiddenPosts = h; S.priv = next; privChain = privChain.then(() => S.store.setPriv(next)).catch(() => {}); invalidate(); close(); toast('表示に戻しました', 'check'); } }, '表示する')));
  }
}
function openAccessInfo() {
  const body = el('div', { class: 'about' });
  body.append(el('b', {}, 'INVITE & ACCESS'), el('p', {}, 'KENGO FRIEND SNS は招待制です。参加者はサインインした状態でこのページを開きます。'),
    el('dl', {}, el('dt', {}, '投稿・いいね・DM'), el('dd', {}, 'ページの共有メニューから「編集者」として招待された人ができます。'), el('dt', {}, '閲覧のみ'), el('dd', {}, '閲覧者・コメント権限での招待、または招待前のアカウントは、タイムラインの閲覧だけができます。'), el('dt', {}, '公開リンク'), el('dd', {}, '公開リンク共有をオンにすると、外部から招待した編集者が書き込めなくなります。友人だけのSNSとして使うときは、メール招待のみをおすすめします。'), el('dt', {}, '写真・動画'), el('dd', {}, '1ファイル20MBまで。動画はMP4またはWebM形式に対応しています。')));
  const m = modalFrame({ title: '招待とアクセス', left: closeBtn(() => close()), body, size: 'md' });
  const close = openModal(m, { autofocus: false });
}
function openAbout() {
  const body = el('div', { class: 'about' });
  body.append(el('b', {}, 'KENGO FRIEND SNS'), el('p', {}, '友人だけのクローズドなタイムライン。写真・動画の投稿、複数枚のカルーセル、フィルター、ストーリーズ、リール、いいね、コメントと返信、保存、フォロー、検索とハッシュタグ、お知らせ、ダイレクトメッセージとグループチャットに対応しています。'),
    el('dl', {}, el('dt', {}, 'メンバー'), el('dd', { class: 'num' }, `${Object.keys(S.users).length}人`), el('dt', {}, '投稿'), el('dd', { class: 'num' }, `${Object.keys(allPostsMap()).length}件`), el('dt', {}, 'ストーリーズ'), el('dd', {}, '投稿から24時間で自動的に消えます'), el('dt', {}, '保存先'), el('dd', {}, S.mode === 'api' ? '専用サーバー（参加者全員に同期）' : S.mode === 'cloud' ? '共有データベース（参加者全員に同期）' : 'このブラウザ（ローカルモード）')));
  const m = modalFrame({ title: 'このSNSについて', left: closeBtn(() => close()), body, size: 'md' });
  const close = openModal(m, { autofocus: false });
}

/* ---------- Comments thread ---------- */
function commentEl(c, p, opts) {
  const u = userOf(c.authorId);
  const liked = !!(c.likedBy && c.likedBy[S.uid]); const n = Object.keys(c.likedBy || {}).length;
  const canDelete = c.authorId === S.uid || p.authorId === S.uid || S.isOwner;
  const meta = el('div', { class: 'meta' }, el('span', {}, timeAgo(c.createdAt, true)));
  if (n) meta.append(el('button', { onclick: () => userListModal('いいね！', Object.keys(c.likedBy)) }, `いいね！${n}件`));
  if (S.uid && !p.commentsOff) meta.append(el('button', { onclick: () => opts.onReply(c) }, '返信'));
  if (canDelete) meta.append(el('button', { onclick: async () => { if (await confirmDialog({ title: 'コメントを削除しますか？', okLabel: '削除', danger: true })) deleteComment(p.id, c.id); } }, '削除'));
  return el('div', { class: 'comment', dataset: { cid: c.id } }, avatarEl(u, 's'), el('div', { class: 'c' }, el('div', { class: 'txt' }, userLink(u), linkify(c.text)), meta), el('button', { class: 'like' + (liked ? ' on' : ''), 'aria-label': 'いいね', html: iconHTML('heart', '', liked), onclick: () => toggleCommentLike(p.id, c.id) }));
}
function commentsThread(p, opts) {
  const root = el('div', { class: 'comments' });
  const expanded = new Set();
  let sig = '';
  const draw = () => {
    const post = postOf(p.id) || p;
    const cs = commentsOf(p.id);
    const s = JSON.stringify([post.caption, post.updatedAt, cs.map(c => [c.id, Object.keys(c.likedBy || {}).length]), Array.from(expanded), Object.keys(S.users).length, S.comments[p.id] ? 1 : 0]);
    if (s === sig) return; sig = s;
    const st = root.scrollTop; clear(root);
    if (post.caption) { const a = userOf(post.authorId); root.append(el('div', { class: 'comment caption' }, avatarEl(a, 's'), el('div', { class: 'c' }, el('div', { class: 'txt' }, userLink(a), linkify(post.caption)), el('div', { class: 'meta' }, el('span', {}, timeAgo(post.createdAt, true)))))); }
    const top = cs.filter(c => !c.parentId).sort((a, b) => a.createdAt - b.createdAt);
    if (!top.length && !post.caption) root.append(el('div', { class: 'empty', style: 'padding:32px 0' }, el('h3', {}, 'まだコメントはありません'), el('p', {}, '会話を始めましょう。')));
    for (const c of top) {
      root.append(commentEl(c, post, opts));
      const replies = cs.filter(r => r.parentId === c.id).sort((a, b) => a.createdAt - b.createdAt);
      if (replies.length) {
        if (expanded.has(c.id)) { const box = el('div', { class: 'replies' }); for (const r of replies) box.append(commentEl(r, post, opts)); root.append(box); root.append(el('button', { class: 'replies-toggle', onclick: () => { expanded.delete(c.id); draw(); } }, '返信を非表示')); }
        else root.append(el('button', { class: 'replies-toggle', onclick: () => { expanded.add(c.id); draw(); } }, `返信${replies.length}件を表示`));
      }
    }
    root.scrollTop = st;
  };
  draw();
  return { el: root, update: draw, expand: id => expanded.add(id) };
}
function detailPane(p, opts = {}) {
  const pane = el('div', { class: 'pane' });
  let reply = null;
  const replyBar = el('div', { class: 'replying' }); replyBar.hidden = true;
  const thread = commentsThread(p, { onReply: c => { reply = c; replyBar.hidden = false; clear(replyBar); replyBar.append(el('span', {}, `${displayName(userOf(c.authorId))} に返信中`), el('button', { 'aria-label': '返信をやめる', html: iconHTML('x'), onclick: () => { reply = null; replyBar.hidden = true; } })); form._input.focus(); } });
  const form = addCommentForm(p, { suffix: '-d', parentIdRef: () => (reply ? (reply.parentId || reply.id) : null), onSent: () => { if (reply) thread.expand(reply.parentId || reply.id); reply = null; replyBar.hidden = true; thread.update(); } });
  const foot = postFoot(p, { noComments: true, noCaption: true });
  if (!opts.noHead) pane.append(postHead(p));
  pane.append(thread.el, foot, replyBar, form);
  let sig = postSig(p);
  const update = () => {
    const np = postOf(p.id); if (!np) return;
    const s = postSig(np);
    if (s !== sig) { sig = s; const h = pane.querySelector('.post-head'); if (h) h.replaceWith(postHead(np)); pane.querySelector('.post-foot').replaceWith(postFoot(np, { noComments: true, noCaption: true })); if (opts.onSig) opts.onSig(np); }
    thread.update();
  };
  if (opts.focus) setTimeout(() => { try { form._input.focus(); } catch (e) {} }, 80);
  return { el: pane, update };
}
function openPostModal(pid, opts = {}) {
  const p = postOf(pid);
  if (!p) { fetchPost(pid).then(x => (x ? openPostModal(pid, opts) : toast('投稿が見つかりません'))); return; }
  ensureComments(pid);
  const mf = mediaFrame(p, { fill: true, contain: true, onLike: () => { if (!likedByMe(p.id)) toggleLike(p.id); } });
  const pane = detailPane(p, opts);
  const d = el('div', { class: 'detail' }, mf.frame, pane.el);
  const wrap = el('div', { class: 'modal xl', style: 'background:transparent;box-shadow:none;max-height:100%;overflow:visible' }, d);
  const x = el('button', { class: 'close-x', 'aria-label': '閉じる', html: iconHTML('x', 'l'), onclick: () => close() });
  wrap.append(x);
  const close = openModal(wrap, { autofocus: false, onClose: () => { liveUpdaters.delete(pane.update); $$('video', d).forEach(v => v.pause()); } });
  liveUpdaters.add(pane.update);
}
function postPageView(pid, focus) {
  const root = el('div', { class: 'mobile-detail' });
  root.append(el('h2', { class: 'page-title', style: 'padding:8px 16px 0' }, el('button', { class: 'back', 'aria-label': '戻る', html: iconHTML('back'), onclick: back }), '投稿'));
  const body = el('div');
  root.append(body);
  let pane = null;
  const build = () => {
    const p = postOf(pid);
    clear(body);
    if (!p) { body.append(emptyState('image', '投稿が見つかりません', '削除されたか、まだ読み込まれていません。')); return; }
    ensureComments(pid);
    const mf = mediaFrame(p, { onLike: () => { if (!likedByMe(p.id)) toggleLike(p.id); } });
    const art = el('article', { class: 'post' }, postHead(p), mf.frame);
    if (mf.dots) art.append(mf.dots);
    pane = detailPane(p, { focus, noHead: true, onSig: np => { const h = art.querySelector('.post-head'); if (h) h.replaceWith(postHead(np)); } });
    body.append(art, pane.el);
  };
  fetchPost(pid).then(() => { if (!pane) build(); });
  build();
  return { el: root, update: () => { if (pane) pane.update(); else build(); }, cls: 'flush' };
}

/* ---------- Messages ---------- */
function openThreadWith(uidTarget) {
  if (!requireWrite('メッセージ')) return;
  run(async () => { const id = await getOrCreateThread([uidTarget]); S.ui.activeThread = id; S.ui.msgsOpen = true; go('messages', {}, { force: true }); }, 'スレッドを開けませんでした');
}
function newMessage() {
  if (!requireWrite('メッセージ')) return;
  pickRecipients({ title: '新規メッセージ', okLabel: 'チャット', multi: true }, async ids => {
    await run(async () => { const id = await getOrCreateThread(ids); S.ui.activeThread = id; S.ui.msgsOpen = true; go('messages', {}, { force: true }); }, 'スレッドを作成できませんでした');
  });
}
function messagesView() {
  const root = el('div', { class: 'msgs' + (S.ui.msgsOpen ? ' open' : '') });
  const list = el('div', { class: 'list' });
  const convo = el('div', { class: 'convo' });
  root.append(list, convo);
  const listHead = el('div', { class: 'list-head' }, el('span', {}, me() ? me().username : 'メッセージ'), el('button', { 'aria-label': '新規メッセージ', html: iconHTML('edit'), onclick: newMessage }));
  const presence = el('div', { class: 'presence-row' });
  const listBody = el('div', { class: 'list-body' });
  list.append(listHead, presence, listBody);
  let convoState = { id: null, sig: '', msgSig: '' };
  const drawList = () => {
    const threads = threadsSorted();
    const online = Object.values(S.users).filter(u => u.id !== S.uid && S.online.has(u.id));
    clear(presence); presence.hidden = !online.length;
    for (const u of online) presence.append(el('button', { class: 'story-btn', onclick: () => openThreadWith(u.id) }, el('div', { class: 'ring none', style: 'position:relative' }, avatarEl(u, 'l'), el('span', { class: 'online' })), el('span', { class: 'name' }, displayName(u))));
    keyedList(listBody, threads, t => t.id, t => threadRow(t), (n, t) => { const nn = threadRow(t); n.className = nn.className; n.replaceChildren(...Array.from(nn.childNodes)); });
    if (!threads.length) { if (!listBody.querySelector('.empty')) listBody.append(emptyState('send', S.loaded.threads || S.mode === 'local' ? 'メッセージはまだありません' : '読み込み中…', '友人にメッセージを送ってみましょう。', S.uid ? el('button', { class: 'btn primary', onclick: newMessage }, 'メッセージを送信') : null)); }
    else { const e = listBody.querySelector('.empty'); if (e) e.remove(); }
  };
  const threadRow = t => {
    const others = threadOthers(t); const unread = threadUnread(t);
    const b = el('button', { class: 'thread' + (S.ui.activeThread === t.id ? ' active' : ''), onclick: () => { S.ui.activeThread = t.id; S.ui.msgsOpen = true; root.classList.add('open'); markThreadRead(t.id); drawList(); drawConvo(); } });
    if (others.length >= 2) b.append(el('div', { class: 'pair' }, avatarEl(userOf(others[0]), ''), avatarEl(userOf(others[1]), '')));
    else { const u = userOf(others[0] || S.uid); const wrap = el('div', { class: 'ring none', style: 'position:relative' }, avatarEl(u, 'l')); if (S.online.has(u.id)) wrap.append(el('span', { class: 'online' })); b.append(wrap); }
    const last = t.lastMessage;
    const preview = last ? `${last.from === S.uid ? 'あなた: ' : (others.length >= 2 ? displayName(userOf(last.from)) + ': ' : '')}${last.preview}` : 'メッセージを送信';
    b.append(el('div', { class: 'who' + (unread ? ' unread' : '') }, el('div', { class: 'u trunc' }, threadTitle(t)), el('div', { class: 'p' }, preview, last ? el('span', { class: 'muted' }, ` · ${timeAgo(last.createdAt, true)}`) : null)));
    if (unread) b.append(el('span', { class: 'unread-dot' }));
    return b;
  };
  const drawConvo = () => {
    const t = S.threads[S.ui.activeThread];
    if (!t) {
      if (convoState.id !== null || !convo.children.length) { convoState = { id: null, sig: '', msgSig: '' }; clear(convo); convo.append(el('div', { class: 'empty', style: 'margin:auto' }, icon('send'), el('h3', {}, 'あなたのメッセージ'), el('p', {}, '友人やグループにプライベートな写真やメッセージを送信しましょう。'), S.uid ? el('button', { class: 'btn primary', onclick: newMessage }, 'メッセージを送信') : null)); }
      return;
    }
    const others = threadOthers(t);
    const sig = [t.id, t.name, others.map(o => [userOf(o).username, userOf(o).avatar, S.online.has(o)].join(',')).join(';')].join('|');
    if (convoState.id !== t.id || convoState.sig !== sig) {
      convoState = { id: t.id, sig, msgSig: '' }; clear(convo);
      const headWho = el('div', { class: 'who' }, el('button', { class: 'u', onclick: () => (t.isGroup ? groupInfo(t) : openProfile(others[0])) }, threadTitle(t)), el('div', { class: 's' }, t.isGroup ? `${t.members.length}人のメンバー` : (S.online.has(others[0]) ? 'オンライン' : 'オフライン')));
      const headPic = t.isGroup ? el('div', { class: 'pair', style: 'width:44px;height:44px' }, avatarEl(userOf(others[0]), 's'), avatarEl(userOf(others[1] || others[0]), 's')) : avatarEl(userOf(others[0]), 'm');
      convo.append(el('div', { class: 'convo-head' }, el('button', { class: 'back', 'aria-label': '戻る', html: iconHTML('back'), onclick: () => { S.ui.msgsOpen = false; root.classList.remove('open'); drawList(); } }), headPic, headWho, el('button', { class: 'btn icon ghost', 'aria-label': '詳細', html: iconHTML('info'), onclick: () => (t.isGroup ? groupInfo(t) : openProfile(others[0])) })));
      const body = el('div', { class: 'convo-body' });
      const typing = el('div', { class: 'typing' }); typing.hidden = true;
      convo.append(body, typing, composeBar(t));
    }
    const body = convo.querySelector('.convo-body');
    const msgs = t.messages || [];
    const msgSig = JSON.stringify(msgs.map(m => [m.id, m.reactions ? Object.values(m.reactions).join('') : ''])) + Object.keys(S.users).length;
    if (msgSig !== convoState.msgSig) {
      const atBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80 || convoState.msgSig === '';
      convoState.msgSig = msgSig;
      clear(body);
      if (!t.isGroup) { const u = userOf(others[0]); body.append(el('div', { class: 'convo-intro' }, avatarEl(u, 'xl'), el('div', { class: 'u' }, displayName(u)), el('div', { class: 'small' }, u.name || ''), el('button', { class: 'btn sm', onclick: () => openProfile(u.id) }, 'プロフィールを表示'))); }
      else body.append(el('div', { class: 'convo-intro' }, el('div', { class: 'u' }, threadTitle(t)), el('div', { class: 'small' }, t.members.map(m => displayName(userOf(m))).join('、'))));
      let lastDay = null;
      msgs.forEach((m, i) => {
        if (lastDay === null || !sameDay(lastDay, m.createdAt)) { body.append(el('div', { class: 'date-sep' }, dayLabel(m.createdAt))); lastDay = m.createdAt; }
        const next = msgs[i + 1];
        body.append(messageRow(m, t, !next || next.from !== m.from));
      });
      if (atBottom) requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
    }
    const typing = convo.querySelector('.typing');
    const ty = S.typing[t.id];
    if (ty && ty.until > now() && ty.uid !== S.uid) { typing.hidden = false; typing.textContent = `${displayName(userOf(ty.uid))} が入力中…`; } else typing.hidden = true;
  };
  const messageRow = (m, t, last) => {
    const mine = m.from === S.uid;
    const row = el('div', { class: 'bubble-row' + (mine ? ' me' : '') + (last ? ' last' : '') + (m.reactions && Object.keys(m.reactions).length ? ' reacted' : '') });
    row.append(avatarEl(userOf(m.from), 'xs'));
    let bubble;
    if (m.post) {
      const p = postOf(m.post); const pm = p && p.media && p.media[0];
      bubble = el('div', { class: 'bubble share', onclick: () => openPost(m.post) });
      if (p && pm) { bubble.append(el('img', { src: mediaUrl(pm.type === 'video' ? (pm.poster || pm.id) : pm.id), alt: '' })); bubble.append(el('div', { class: 'meta' }, el('span', { class: 'u' }, displayName(userOf(p.authorId))), ' ', (p.caption || '').slice(0, 50))); }
      else bubble.append(el('div', { class: 'meta muted' }, '投稿は削除されました'));
    } else if (m.media) {
      bubble = el('div', { class: 'bubble media' });
      if (m.media.type === 'video') { const v = el('video', { src: mediaUrl(m.media.id), controls: true, playsinline: true, preload: 'metadata' }); if (m.media.poster) v.setAttribute('poster', mediaUrl(m.media.poster)); bubble.append(v); }
      else bubble.append(el('img', { src: mediaUrl(m.media.id), alt: '', loading: 'lazy', onclick: () => openImageLightbox(mediaUrl(m.media.id)) }));
    } else if (m.story) {
      bubble = el('div', { class: 'bubble share' });
      if (m.story.media) bubble.append(el('img', { src: mediaUrl(m.story.media.type === 'video' ? (m.story.media.poster || m.story.media.id) : m.story.media.id), alt: '' }));
      bubble.append(el('div', { class: 'meta' }, el('span', { class: 'muted small' }, 'ストーリーズへの返信'), el('div', {}, m.text || '')));
    } else bubble = el('div', { class: 'bubble' }, linkify(m.text || ''));
    row.append(bubble);
    if (m.reactions && Object.keys(m.reactions).length) { const counts = {}; for (const e of Object.values(m.reactions)) counts[e] = (counts[e] || 0) + 1; row.append(el('span', { class: 'react', onclick: () => userListModal('リアクション', Object.keys(m.reactions)) }, Object.entries(counts).map(([e, n]) => `${e}${n > 1 ? n : ''}`).join(' '))); }
    row.append(el('span', { class: 'time' }, fmtTime(m.createdAt)));
    if (S.uid) row.append(el('button', { class: 'rx', 'aria-label': 'リアクション', html: iconHTML('smile'), onclick: () => messageActions(m, t) }));
    let pressTimer;
    bubble.addEventListener('touchstart', () => { pressTimer = setTimeout(() => messageActions(m, t), 500); }, { passive: true });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
    return row;
  };
  const messageActions = (m, t) => {
    const emojis = ['❤️', '😂', '😮', '😢', '👏', '🔥'];
    const bar = el('div', { class: 'emoji-bar', style: 'justify-content:center;margin:12px auto 0;width:max-content' });
    const list = el('div', { class: 'sheet-list', style: 'margin-top:12px' });
    const node = el('div', { class: 'modal' }, bar, list);
    const close = openModal(node, { autofocus: false });
    for (const e of emojis) bar.append(el('button', { onclick: () => { close(); reactMessage(t.id, m.id, e); } }, e));
    if (m.text) list.append(el('button', { onclick: () => { close(); copyText(m.text); } }, 'コピー'));
    if (m.from === S.uid || S.isOwner) list.append(el('button', { class: 'danger', onclick: async () => { close(); if (await confirmDialog({ title: '送信を取り消しますか？', text: 'メッセージはすべての参加者から削除されます。', okLabel: '送信取り消し', danger: true })) unsendMessage(t.id, m.id); } }, '送信を取り消す'));
    list.append(el('button', { onclick: close }, 'キャンセル'));
  };
  const composeBar = t => {
    const input = el('input', { placeholder: 'メッセージ…', id: 'compose-' + t.id, maxlength: 2000, autocomplete: 'off' });
    const send = el('button', { class: 'send', type: 'submit' }, '送信'); send.hidden = true;
    const attach = el('button', { type: 'button', 'aria-label': '写真や動画を送信', html: iconHTML('image'), onclick: () => pickFiles(false, async files => { for (const f of files.slice(0, 1)) await run(async () => { const item = await processFile(f); const m = await uploadMedia(item); await sendMessage(t.id, { media: m }); }, '送信できませんでした'); }) });
    const heart = el('button', { type: 'button', 'aria-label': 'ハートを送信', html: iconHTML('heart'), onclick: () => sendMessage(t.id, { text: '❤️' }) });
    const emoji = el('button', { type: 'button', 'aria-label': '絵文字', html: iconHTML('smile'), onclick: () => emojiPicker(e => { input.value += e; input.dispatchEvent(new Event('input')); input.focus(); }) });
    let typingAt = 0;
    input.addEventListener('input', () => { const has = !!input.value.trim(); send.hidden = !has; attach.hidden = has; heart.hidden = has; if (has && now() - typingAt > 2500) { typingAt = now(); emitTyping(t.id); } });
    const form = el('form', { class: 'compose', onsubmit: async e => { e.preventDefault(); const v = input.value.trim(); if (!v) return; input.value = ''; input.dispatchEvent(new Event('input')); await sendMessage(t.id, { text: v }); } });
    form.append(el('div', { class: 'box' }, emoji, input, attach, heart, send));
    return form;
  };
  const update = () => { drawList(); drawConvo(); };
  update();
  if (S.ui.activeThread) markThreadRead(S.ui.activeThread);
  return { el: root, update, cls: 'wide flush', onLeave: () => { S.ui.msgsOpen = false; } };
}
function groupInfo(t) {
  const body = el('div', { class: 'modal-body' });
  const members = el('div', { class: 'list-body' });
  for (const id of t.members) { const u = userOf(id); members.append(el('div', { class: 'person', style: 'padding-inline:0' }, avatarEl(u, 'm'), el('div', { class: 'who' }, el('button', { class: 'u', onclick: () => { close(); openProfile(id); } }, displayName(u)), el('div', { class: 'n' }, u.name || '')), id === S.uid ? el('span', { class: 'pill' }, 'あなた') : followBtn(id))); }
  body.append(el('div', { class: 'row', style: 'justify-content:space-between' }, el('b', {}, `${t.members.length}人のメンバー`), el('button', { class: 'link small', onclick: async () => { const n = await textPrompt({ title: 'グループ名', label: 'グループ名', value: t.name || '', placeholder: '例：京都旅行' }); if (n !== null) { await renameThread(t.id, n); close(); } } }, 'グループ名を変更')), members);
  const m = modalFrame({ title: t.name || 'グループ', left: closeBtn(() => close()), body });
  const close = openModal(m, { autofocus: false });
}
function openImageLightbox(url) {
  const img = el('img', { src: url, alt: '', style: 'max-width:92vw;max-height:88vh;border-radius:12px;object-fit:contain' });
  const wrap = el('div', { class: 'modal', style: 'background:transparent;box-shadow:none;max-width:none;width:auto;align-items:center' }, img);
  const close = openModal(wrap, { autofocus: false });
  wrap.append(el('button', { class: 'close-x', 'aria-label': '閉じる', html: iconHTML('x', 'l'), onclick: close }));
}
