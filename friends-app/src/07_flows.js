/* ===================================================================
   Flows: create post / reel / story, story viewer, profile, boot
   =================================================================== */
function pickFiles(multiple, cb, imageOnly = false) {
  const input = imageOnly ? $('#file-input-image') : (multiple ? $('#file-input') : $('#file-input-single'));
  input.value = '';
  input.onchange = () => { const files = Array.from(input.files || []); if (files.length) cb(files); };
  input.click();
}
function openCreateMenu() {
  if (!requireWrite('投稿')) return;
  if (!S.store.canUpload()) { toast('写真や動画のアップロードには編集者の権限が必要です'); return; }
  openSheet([
    { label: '投稿', icon: 'image', onClick: () => openCreate('post') },
    { label: 'リール', icon: 'reels', onClick: () => openCreate('reel') },
    { label: 'ストーリーズ', icon: 'plusCircle', onClick: () => openStoryCompose() },
  ]);
}
async function ingestFiles(files, kind) {
  const out = []; const errors = [];
  for (const f of files) {
    try {
      if (kind === 'reel' && !/^video\//.test(f.type)) { errors.push(`${f.name}: リールには動画を選択してください`); continue; }
      const item = await processFile(f);
      item.url = URL.createObjectURL(item.blob); item.filter = 'original'; item.adj = { b: 0, c: 0, s: 0, t: 0 }; item.alt = ''; item.name = f.name;
      out.push(item);
    } catch (e) { errors.push(`${f.name}: ${e.message}`); }
  }
  if (errors.length) toast(errors[0]);
  return out;
}
function openCreate(kind = 'post') {
  if (!requireWrite('投稿')) return;
  const st = { kind, items: [], step: 'pick', active: 0, aspect: 'original', caption: '', location: '', hideLikes: false, commentsOff: false, busy: false, progress: '' };
  const node = el('div', { class: 'modal create xl' });
  const close = openModal(node, { dismissible: false, autofocus: false, onClose: () => st.items.forEach(i => { try { URL.revokeObjectURL(i.url); } catch (e) {} }) });
  const discard = async () => { if (st.items.length && !(await confirmDialog({ title: '投稿を破棄しますか？', text: '編集内容は保存されません。', okLabel: '破棄', danger: true }))) return; close(); };
  const ratio = () => { if (st.aspect === '1:1') return 1; if (st.aspect === '4:5') return 0.8; if (st.aspect === '16:9') return 16 / 9; const m = st.items[0]; if (!m) return 1; return kind === 'reel' ? Math.min(1, Math.max(0.5625, m.w / m.h)) : Math.min(1.91, Math.max(0.8, m.w / m.h)); };
  const preview = (item, big = true) => {
    const frame = el('div', { class: 'media-frame', style: `aspect-ratio:${ratio()};${big ? 'height:100%;max-width:100%;' : ''}` });
    const css = filterCss(item);
    let media;
    if (item.type === 'video') { media = el('video', { src: item.url, playsinline: true, loop: true, autoplay: true, muted: true }); media.muted = true; }
    else media = el('img', { src: item.url, alt: '', draggable: 'false' });
    media.style.cssText = `width:100%;height:100%;object-fit:cover;${css ? 'filter:' + css : ''}`;
    frame.append(media);
    return frame;
  };
  const addFiles = async files => {
    st.busy = true; draw();
    const items = await ingestFiles(files, kind);
    st.items = kind === 'reel' ? items.slice(0, 1) : st.items.concat(items).slice(0, 10);
    st.busy = false; st.active = Math.min(st.active, Math.max(0, st.items.length - 1));
    if (st.items.length && st.step === 'pick') st.step = 'edit';
    draw();
  };
  const head = () => {
    const h = el('div', { class: 'modal-head' });
    if (st.step === 'pick') h.append(closeBtn(discard), el('div', { class: 't' }, kind === 'reel' ? '新しいリール' : '新規投稿を作成'), el('span', { style: 'min-width:48px' }));
    else if (st.step === 'edit') h.append(backBtn(() => { st.step = 'pick'; draw(); }), el('div', { class: 't' }, '編集'), el('button', { onclick: () => { st.step = 'details'; draw(); } }, '次へ'));
    else if (st.step === 'details') h.append(backBtn(() => { st.step = 'edit'; draw(); }), el('div', { class: 't' }, kind === 'reel' ? '新しいリール' : '新規投稿を作成'), el('button', { onclick: share }, 'シェア'));
    else h.append(el('span', { style: 'min-width:48px' }), el('div', { class: 't' }, 'シェア中…'), el('span', { style: 'min-width:48px' }));
    return h;
  };
  const share = async () => {
    if (!st.items.length) return;
    st.step = 'uploading'; st.progress = '準備中…'; draw();
    try {
      const id = await createPost({ items: st.items, caption: st.caption, location: st.location, aspect: kind === 'reel' ? 'original' : st.aspect, hideLikes: st.hideLikes, commentsOff: st.commentsOff, kind, onProgress: (i, n) => { st.progress = `アップロード中 ${i + 1}/${n}`; const p = node.querySelector('.progress i'); if (p) p.style.width = `${Math.round((i / n) * 100)}%`; const t = node.querySelector('.upload-state .msg'); if (t) t.textContent = st.progress; } });
      close(); toast(kind === 'reel' ? 'リールをシェアしました' : '投稿をシェアしました', 'check');
      if (kind === 'reel') go('reels'); else { go('home'); }
      void id;
    } catch (e) { console.error(e); st.step = 'details'; draw(); toast('シェアできませんでした：' + friendlyError(e)); }
  };
  const draw = () => {
    clear(node); node.append(head());
    if (st.step === 'pick') {
      const dz = el('div', { class: 'dropzone' });
      if (st.busy) dz.append(el('div', { class: 'spinner' }), el('p', {}, '読み込み中…'));
      else dz.append(icon(kind === 'reel' ? 'reels' : 'image'), el('h3', {}, kind === 'reel' ? '動画をここにドラッグ' : '写真や動画をここにドラッグ'), el('p', {}, kind === 'reel' ? 'MP4 / WebM、20MBまで' : '写真は自動で最適化されます。動画はMP4 / WebM、20MBまで。最大10枚。'), el('button', { class: 'btn primary', onclick: () => pickFiles(kind !== 'reel', addFiles) }, 'ファイルを選択'));
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); const files = Array.from(e.dataTransfer.files || []); if (files.length) addFiles(files); });
      node.append(el('div', { class: 'stage single' }, dz));
      return;
    }
    if (st.step === 'uploading') {
      node.append(el('div', { class: 'stage single' }, el('div', { class: 'upload-state' }, el('div', { class: 'spinner' }), el('div', { class: 'msg bold' }, st.progress), el('div', { class: 'progress', style: 'width:min(320px,80%)' }, el('i')), el('p', { class: 'hint' }, 'この画面を閉じずにお待ちください。'))));
      return;
    }
    const item = st.items[st.active] || st.items[0];
    const canvas = el('div', { class: 'canvas' }, preview(item));
    const side = el('div', { class: 'side' });
    if (st.step === 'edit') {
      if (kind !== 'reel') {
        const thumbs = el('div', { class: 'thumbs' });
        st.items.forEach((it, i) => { const t = el('button', { class: 'th' + (i === st.active ? ' active' : ''), onclick: () => { st.active = i; draw(); } }); t.append(it.type === 'video' ? el('video', { src: it.url, muted: true }) : el('img', { src: it.url, alt: '' })); if (st.items.length > 1) t.append(el('span', { class: 'rm', 'aria-label': '削除', html: iconHTML('x'), onclick: e => { e.stopPropagation(); st.items.splice(i, 1); st.active = Math.max(0, Math.min(st.active, st.items.length - 1)); draw(); } })); thumbs.append(t); });
        if (st.items.length < 10) thumbs.append(el('button', { class: 'add', 'aria-label': '追加', html: iconHTML('plus'), onclick: () => pickFiles(true, addFiles) }));
        side.append(thumbs);
        const asp = el('div', { class: 'aspects' });
        for (const [k, label] of ASPECTS) asp.append(el('button', { class: k === st.aspect ? 'active' : '', onclick: () => { st.aspect = k; draw(); } }, label));
        side.append(asp);
      }
      const filters = el('div', { class: 'filters' });
      for (const [k, label, css] of FILTERS) { const b = el('button', { class: k === item.filter ? 'active' : '', onclick: () => { item.filter = k; draw(); } }); const th = el('div', { class: 'th' }); const im = item.type === 'video' ? el('video', { src: item.url, muted: true }) : el('img', { src: item.url, alt: '' }); if (css) im.style.filter = css; th.append(im); b.append(th, el('span', {}, label)); filters.append(b); }
      side.append(el('div', { class: 'side-sec', style: 'padding:0' }, filters));
      const sl = el('div', { class: 'sliders' });
      const defs = [['b', '明るさ', -50, 50], ['c', 'コントラスト', -50, 50], ['s', '彩度', -60, 60], ['t', 'あたたかさ', 0, 60]];
      for (const [k, label, min, max] of defs) {
        const val = el('span', { class: 'num' }, item.adj[k]);
        const r = el('input', { type: 'range', min, max, value: item.adj[k], id: `adj-${k}` });
        r.addEventListener('input', () => { item.adj[k] = Number(r.value); val.textContent = r.value; const m = canvas.querySelector('img,video'); if (m) m.style.filter = filterCss(item); });
        sl.append(el('label', { for: r.id }, el('span', {}, label), val), r);
      }
      side.append(el('div', { class: 'side-sec' }, el('h5', {}, '調整'), sl, el('button', { class: 'btn sm ghost', style: 'align-self:flex-start', onclick: () => { item.adj = { b: 0, c: 0, s: 0, t: 0 }; item.filter = 'original'; draw(); } }, 'リセット')));
      if (item.type === 'image') { const alt = el('input', { class: 'input', id: 'alt-text', placeholder: '代替テキスト（任意）', value: item.alt, maxlength: 200 }); alt.addEventListener('input', () => { item.alt = alt.value; }); side.append(el('div', { class: 'side-sec' }, el('h5', {}, 'アクセシビリティ'), alt, el('p', { class: 'hint' }, '画像の内容を短く説明すると、スクリーンリーダーで読み上げられます。'))); }
    } else {
      const m = me();
      side.append(el('div', { class: 'side-sec' }, el('div', { class: 'row' }, avatarEl(m, 's'), el('b', {}, m ? m.username : ''))));
      const ta = el('textarea', { id: 'cap-text', placeholder: 'キャプションを入力…', maxlength: 2200 }, st.caption);
      const cnt = el('div', { class: 'count num' }, `${st.caption.length}/2,200`);
      const sug = el('div', { class: 'suggest' }); sug.hidden = true;
      const updateSug = () => {
        const pos = ta.selectionStart; const before = ta.value.slice(0, pos); const mm = before.match(/(?:^|\s)@([a-z0-9._]*)$/i);
        clear(sug);
        if (!mm) { sug.hidden = true; return; }
        const q = mm[1].toLowerCase();
        const users = Object.values(S.users).filter(u => u.id !== S.uid && (u.username.startsWith(q) || (u.name || '').toLowerCase().includes(q))).slice(0, 6);
        if (!users.length) { sug.hidden = true; return; }
        sug.hidden = false;
        for (const u of users) sug.append(el('button', { type: 'button', onmousedown: e => { e.preventDefault(); const start = before.lastIndexOf('@'); ta.value = ta.value.slice(0, start) + '@' + u.username + ' ' + ta.value.slice(pos); st.caption = ta.value; sug.hidden = true; ta.focus(); } }, avatarEl(u, 'xs'), el('span', {}, el('b', {}, u.username), ' ', el('span', { class: 'muted small' }, u.name || ''))));
      };
      ta.addEventListener('input', () => { st.caption = ta.value; cnt.textContent = `${ta.value.length.toLocaleString()}/2,200`; updateSug(); });
      ta.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 150));
      const emo = el('button', { class: 'btn sm ghost', type: 'button', onclick: () => emojiPicker(e => { ta.value += e; st.caption = ta.value; cnt.textContent = `${ta.value.length}/2,200`; }) }, icon('smile'), '絵文字');
      side.append(el('div', { class: 'side-sec' }, el('div', { class: 'caption-wrap' }, ta, sug), el('div', { class: 'row', style: 'justify-content:space-between' }, emo, cnt)));
      const loc = el('input', { class: 'input bare', id: 'cap-loc', placeholder: '場所を追加', value: st.location, maxlength: 80 });
      loc.addEventListener('input', () => { st.location = loc.value; });
      side.append(el('div', { class: 'side-sec' }, el('div', { class: 'row' }, icon('mapPin', 's'), loc)));
      const toggle = (label, hint, key) => { const t = el('button', { class: 'toggle', role: 'switch', 'aria-checked': String(st[key]), onclick: () => { st[key] = !st[key]; t.setAttribute('aria-checked', String(st[key])); } }); return el('div', { class: 'switch' }, el('div', {}, el('div', {}, label), el('div', { class: 'hint' }, hint)), t); };
      side.append(el('div', { class: 'side-sec' }, el('h5', {}, '詳細設定'), toggle('この投稿のいいね数を非表示', '合計数はあなただけに表示されます。', 'hideLikes'), toggle('コメントをオフ', '後から投稿のメニューで変更できます。', 'commentsOff')));
      if (kind !== 'reel' && st.items.length > 1) side.append(el('div', { class: 'side-sec' }, el('p', { class: 'hint' }, `${st.items.length}枚の写真・動画をカルーセルとして投稿します。`)));
    }
    node.append(el('div', { class: 'stage' }, canvas, side));
  };
  draw();
  if (!st.items.length) setTimeout(() => pickFiles(kind !== 'reel', addFiles), 50);
}

/* ---------- Story compose ---------- */
function openStoryCompose() {
  if (!requireWrite('ストーリーズ')) return;
  if (!S.store.canUpload()) { toast('アップロードには編集者の権限が必要です'); return; }
  pickFiles(false, async files => {
    const items = await ingestFiles(files, 'story'); const item = items[0]; if (!item) return;
    const stage = el('div', { class: 'story-compose' });
    stage.append(item.type === 'video' ? el('video', { src: item.url, autoplay: true, muted: true, loop: true, playsinline: true }) : el('img', { src: item.url, alt: '' }));
    const cap = el('input', { class: 'cap-in', placeholder: 'テキストを追加…', maxlength: 200, id: 'story-cap' });
    stage.append(cap);
    const body = el('div', { class: 'modal-body', style: 'background:#111;align-items:center' }, stage);
    const addBtn = el('button', { onclick: async () => { addBtn.disabled = true; addBtn.textContent = '追加中…'; try { await addStory(item, cap.value); close(); toast('ストーリーズに追加しました', 'check'); } catch (e) { addBtn.disabled = false; addBtn.textContent = 'シェア'; toast('追加できませんでした：' + friendlyError(e)); } } }, 'シェア');
    const m = modalFrame({ title: 'ストーリーズに追加', left: closeBtn(() => close()), right: addBtn, body, size: 'md' });
    const close = openModal(m, { onClose: () => { try { URL.revokeObjectURL(item.url); } catch (e) {} } });
  });
}

/* ---------- Story viewer ---------- */
const storyState = { open: false, groups: [], gi: 0, si: 0, raf: 0, start: 0, duration: 5000, paused: false, elapsed: 0, node: null };
function openStoryViewer(ownerId) {
  const groups = activeStories(); const gi = groups.findIndex(g => g.ownerId === ownerId);
  if (gi < 0) { toast('ストーリーズはありません'); return; }
  const g = groups[gi];
  const seen = (S.storyviews[S.uid] && S.storyviews[S.uid].seen && S.storyviews[S.uid].seen[ownerId]) || {};
  let si = g.items.findIndex(i => !seen[i.id]); if (si < 0) si = 0;
  Object.assign(storyState, { open: true, groups, gi, si, paused: false, elapsed: 0 });
  const root = $('#story-root'); clear(root);
  const viewer = el('div', { class: 'story-viewer' });
  const stage = el('div', { class: 'story-stage' });
  const left = el('button', { class: 'story-side l', 'aria-label': '前へ', html: iconHTML('chevL'), onclick: () => storyStep(-1, true) });
  const right = el('button', { class: 'story-side r', 'aria-label': '次へ', html: iconHTML('chevR'), onclick: () => storyStep(1, true) });
  viewer.append(left, stage, right); root.append(viewer);
  storyState.node = stage;
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', storyKeys);
  renderStory();
}
function storyKeys(e) { if (!storyState.open) return; if (e.key === 'ArrowLeft') storyStep(-1, true); else if (e.key === 'ArrowRight') storyStep(1, true); }
function closeStoryViewer() {
  if (!storyState.open) return;
  storyState.open = false; cancelAnimationFrame(storyState.raf);
  clear($('#story-root')); document.removeEventListener('keydown', storyKeys);
  if (!modals.length) document.body.style.overflow = '';
  scheduleRender();
}
function storyStep(dir, manual = false) {
  const st = storyState; if (!st.open) return;
  const g = st.groups[st.gi];
  let si = st.si + dir, gi = st.gi;
  if (si >= g.items.length) { gi++; si = 0; if (gi >= st.groups.length) return closeStoryViewer(); }
  else if (si < 0) { if (manual && st.elapsed > 1500 && dir < 0) { si = st.si; } else { gi--; if (gi < 0) { gi = 0; si = 0; } else si = st.groups[gi].items.length - 1; } }
  st.gi = gi; st.si = si; st.elapsed = 0; st.paused = false;
  renderStory();
}
function renderStory() {
  const st = storyState; const g = st.groups[st.gi]; const item = g.items[st.si]; const u = userOf(g.ownerId);
  const stage = st.node; clear(stage);
  cancelAnimationFrame(st.raf);
  const bars = el('div', { class: 'story-bars' });
  g.items.forEach((_, i) => bars.append(el('i', {}, el('b', { style: i < st.si ? 'width:100%' : 'width:0' }))));
  stage.append(bars);
  const isMine = g.ownerId === S.uid;
  const top = el('div', { class: 'story-top' }, avatarEl(u, 's'), el('button', { class: 'u', onclick: () => { closeStoryViewer(); openProfile(u.id); } }, displayName(u)), el('span', { class: 't' }, timeAgo(item.createdAt, true)));
  if (isMine) top.append(el('button', { 'aria-label': 'オプション', style: 'margin-left:auto;width:36px;height:36px;display:grid;place-items:center', html: iconHTML('more'), onclick: async () => { st.paused = true; const ok = await confirmDialog({ title: 'このストーリーズを削除しますか？', okLabel: '削除', danger: true }); st.paused = false; if (ok) { await deleteStory(item.id); st.groups = activeStories(); if (!st.groups.length) return closeStoryViewer(); st.gi = Math.min(st.gi, st.groups.length - 1); st.si = Math.min(st.si, st.groups[st.gi].items.length - 1); renderStory(); } } }));
  top.append(el('button', { class: 'x', style: isMine ? 'margin-left:0' : '', 'aria-label': '閉じる', html: iconHTML('x'), onclick: closeStoryViewer }));
  stage.append(top);
  let media;
  if (item.media.type === 'video') {
    media = el('video', { src: mediaUrl(item.media.id), playsinline: true, autoplay: true, preload: 'auto' });
    media.muted = S.ui.muted;
    media.addEventListener('loadedmetadata', () => { st.duration = Math.min(60000, Math.max(1000, (media.duration || 5) * 1000)); });
    media.addEventListener('ended', () => storyStep(1));
    media.addEventListener('click', () => setMuted(!S.ui.muted));
    st.duration = Math.min(60000, Math.max(1000, (item.media.duration || 5) * 1000));
  } else { media = el('img', { src: mediaUrl(item.media.id), alt: '' }); st.duration = 5000; }
  stage.append(media);
  const css = filterCss(item.media); if (css) media.style.filter = css;
  stage.append(el('div', { class: 'story-tap l', onclick: () => storyStep(-1, true) }), el('div', { class: 'story-tap r', onclick: () => storyStep(1, true) }));
  if (item.caption) stage.append(el('div', { class: 'story-cap' }, item.caption));
  const foot = el('div', { class: 'story-foot' });
  if (isMine) {
    const viewers = storyViewers(g.ownerId, item.id);
    foot.append(el('button', { class: 'viewers', onclick: () => { st.paused = true; userListModal(`閲覧者 ${viewers.length}人`, () => storyViewers(g.ownerId, item.id).map(v => v.uid), { emptyTitle: 'まだ誰も見ていません' }); } }, icon('eye'), el('span', { class: 'num' }, `閲覧者 ${viewers.length}人`)));
  } else if (S.uid) {
    const input = el('input', { placeholder: `${displayName(u)} に返信…`, id: 'story-reply', maxlength: 500 });
    input.addEventListener('focus', () => { st.paused = true; }); input.addEventListener('blur', () => { st.paused = false; });
    input.addEventListener('keydown', async e => { if (e.key === 'Enter' && input.value.trim()) { const text = input.value.trim(); input.value = ''; input.blur(); await run(async () => { const tid = await getOrCreateThread([g.ownerId]); await sendMessage(tid, { text, story: { ownerId: g.ownerId, storyId: item.id, media: item.media } }); toast('返信を送信しました', 'check'); }, '送信できませんでした'); } });
    foot.append(input, el('button', { 'aria-label': 'ハートを送る', html: iconHTML('heart'), onclick: async e => { const b = e.currentTarget; b.classList.add('liked'); b.innerHTML = iconHTML('heart', '', true); await run(async () => { const tid = await getOrCreateThread([g.ownerId]); await sendMessage(tid, { text: '❤️', story: { ownerId: g.ownerId, storyId: item.id, media: item.media } }); }, '送信できませんでした'); } }), el('button', { 'aria-label': 'シェア', html: iconHTML('send'), onclick: () => { st.paused = true; pickRecipients({ title: 'ストーリーズをシェア', okLabel: '送信' }, async ids => { for (const id of ids) { const tid = await getOrCreateThread([id]); await sendMessage(tid, { text: `${displayName(u)} のストーリーズ`, story: { ownerId: g.ownerId, storyId: item.id, media: item.media } }); } toast('送信しました', 'check'); st.paused = false; }); } }));
  }
  stage.append(foot);
  // hold to pause
  let holdTimer; const down = () => { holdTimer = setTimeout(() => { st.paused = true; if (media.pause) media.pause(); }, 180); };
  const up = () => { clearTimeout(holdTimer); if (st.paused && document.activeElement !== stage.querySelector('input') && !modals.length) { st.paused = false; if (media.play) media.play().catch(() => {}); } };
  stage.addEventListener('pointerdown', down); stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  markStorySeen(g.ownerId, item.id);
  st.elapsed = 0; let last = performance.now();
  const tick = t => {
    if (!st.open) return;
    const dt = t - last; last = t;
    if (!st.paused && !modals.length) st.elapsed += dt;
    if (st.paused && media.pause && !media.paused && media.tagName === 'VIDEO') media.pause();
    if (!st.paused && media.play && media.paused && media.tagName === 'VIDEO' && !modals.length) media.play().catch(() => {});
    const bar = bars.children[st.si] && bars.children[st.si].firstChild;
    if (bar) bar.style.width = `${Math.min(100, (st.elapsed / st.duration) * 100)}%`;
    if (st.elapsed >= st.duration && media.tagName !== 'VIDEO') return storyStep(1);
    if (st.elapsed >= st.duration + 1500 && media.tagName === 'VIDEO') return storyStep(1);
    st.raf = requestAnimationFrame(tick);
  };
  st.raf = requestAnimationFrame(tick);
}

/* ---------- Profile editing & onboarding ---------- */
let onboardShown = false;
function maybeOnboard() {
  if (onboardShown || !S.uid || me() || S.canWrite === false || S.readOnly) return;
  onboardShown = true; openOnboarding();
}
function profileForm(initial, { title, okLabel, onSave, dismissible = true, welcome = false }) {
  const st = { username: initial.username || '', name: initial.name || '', bio: initial.bio || '', website: initial.website || '', avatarFile: null, avatarUrl: avatarUrl(initial) || '' };
  const avatarBox = el('div', { class: 'pick-avatar' });
  const drawAvatar = () => { clear(avatarBox); const a = el('div', { class: 'avatar xl' }); if (st.avatarUrl) a.append(el('img', { src: st.avatarUrl, alt: '' })); else { a.style.background = `hsl(${hueFor(S.uid)} 42% 52%)`; a.textContent = (st.username[0] || st.name[0] || '?').toUpperCase(); } avatarBox.append(a, el('span', { class: 'edit-badge', html: iconHTML('camera') })); };
  drawAvatar();
  avatarBox.addEventListener('click', () => pickFiles(false, f => { st.avatarFile = f[0]; st.avatarUrl = URL.createObjectURL(f[0]); drawAvatar(); }, true));
  const err = el('div', { class: 'error' });
  const un = el('input', { class: 'input', id: 'pf-username', value: st.username, placeholder: 'ユーザー名（半角英数字・. _）', maxlength: 30, autocomplete: 'off', spellcheck: 'false' });
  if (S.mode === 'api') { un.readOnly = true; un.classList.add('bare'); un.title = 'ユーザー名は変更できません'; }
  un.addEventListener('input', () => { un.value = normUsername(un.value); st.username = un.value; err.textContent = ''; });
  const nm = el('input', { class: 'input', id: 'pf-name', value: st.name, placeholder: '名前', maxlength: 60 });
  nm.addEventListener('input', () => { st.name = nm.value; });
  const bio = el('textarea', { class: 'input', id: 'pf-bio', placeholder: '自己紹介', maxlength: 150 }, st.bio);
  const bioCount = el('div', { class: 'count num' }, `${st.bio.length}/150`);
  bio.addEventListener('input', () => { st.bio = bio.value; bioCount.textContent = `${bio.value.length}/150`; });
  const web = el('input', { class: 'input', id: 'pf-web', value: st.website, placeholder: 'ウェブサイト', maxlength: 120, inputmode: 'url' });
  web.addEventListener('input', () => { st.website = web.value.trim(); });
  const body = el('div', { class: 'modal-body' });
  if (welcome || S.justSignedUpWelcome) body.append(el('p', { style: 'text-align:center;margin:0;color:var(--muted)' }, 'ようこそ。タイムラインで使うプロフィールを設定しましょう。'));
  body.append(el('div', { class: 'onboard' }, avatarBox, el('div', { class: 'field' }, el('label', { for: 'pf-username' }, 'ユーザー名'), un), el('div', { class: 'field' }, el('label', { for: 'pf-name' }, '名前'), nm), el('div', { class: 'field' }, el('label', { for: 'pf-bio' }, '自己紹介'), bio, bioCount), el('div', { class: 'field' }, el('label', { for: 'pf-web' }, 'ウェブサイト'), web), err));
  const ok = el('button', { onclick: async () => {
    const u = normUsername(st.username);
    if (!isValidUsername(u)) { err.textContent = 'ユーザー名は3〜30文字の半角英数字・ピリオド・アンダースコアで、先頭と末尾は英数字にしてください。'; return; }
    const taken = Object.values(S.users).find(x => x.username === u && x.id !== S.uid);
    if (taken) { err.textContent = 'このユーザー名はすでに使われています。'; return; }
    ok.disabled = true; ok.textContent = '保存中…';
    try {
      let avatar;
      if (st.avatarFile) { const a = await processAvatar(st.avatarFile); const r = await S.store.upload(a.blob, a.mime); avatar = r.id; }
      await onSave({ username: u, name: st.name.trim(), bio: st.bio.trim(), website: st.website, avatar });
      close();
    } catch (e) { console.error(e); ok.disabled = false; ok.textContent = okLabel; err.textContent = friendlyError(e); }
  } }, okLabel);
  const m = modalFrame({ title, left: dismissible ? closeBtn(() => close()) : el('span', { style: 'min-width:48px' }), right: ok, body, size: 'md' });
  const close = openModal(m, { dismissible });
  return close;
}
function openEditProfile() {
  if (!requireWrite('編集')) return;
  profileForm(me() || {}, { title: 'プロフィールを編集', okLabel: '完了', onSave: async p => { await saveProfile(p); toast('プロフィールを更新しました', 'check'); } });
}
function openOnboarding() {
  const pp = S.platformProfile || {};
  let suggestion = normUsername((pp.name || '').replace(/\s+/g, '_'));
  if (!isValidUsername(suggestion) || Object.values(S.users).some(x => x.username === suggestion)) suggestion = (isValidUsername(suggestion) ? suggestion + '_' : 'friend_') + uid(4);
  profileForm({ username: suggestion, name: pp.name || '' }, { title: 'KENGO FRIEND SNS へようこそ', okLabel: 'はじめる', dismissible: false, welcome: true, onSave: async p => { await saveProfile(p); toast(`ようこそ、${p.username}！`, 'check'); } });
}

/* ---------- Room (presence & typing) ---------- */
function setupRoom() {
  const room = S.room; if (!room || !S.uid) return;
  try {
    room.presence({ uid: S.uid, view: 'timeline' }).catch(() => {});
    room.onPeers(ch => { const s = new Set(); for (const p of ch.peers) { if (p.kind !== 'viewer') continue; const id = p.by || (p.presence && p.presence.uid); if (id) s.add(id); } S.online = s; scheduleRender(); }, () => {});
    room.on('typing', m => { if (m.isMe) return; const d = m.data || {}; const id = m.by || d.uid; if (!d.threadId || !id) return; S.typing[d.threadId] = { uid: id, until: now() + 3500 }; scheduleRender(); setTimeout(scheduleRender, 3700); }, () => {});
  } catch (e) { console.warn('room', e); }
}

/* ---------- Boot ---------- */
function loadingScreen(text) {
  const main = $('#main'); clear(main);
  main.append(el('div', { class: 'gate' }, el('div', { class: 'card' }, brandEl(), el('div', { class: 'spinner' }), el('p', {}, text))));
}
function withTimeout(p, ms, fallback = null) { return Promise.race([p, new Promise(r => setTimeout(() => r(fallback), ms))]); }
async function boot(saved) {
  loadingScreen('接続しています…');
  const hasRuntime = !!(window.claude && typeof window.claude.use === 'function');
  if (window.KFS_PENDING && !window.KFS_API) { S.mode = 'api'; S.gate = 'pending'; render(); return; }
  if (window.KFS_API) {
    S.mode = 'api'; S.apiBase = String(window.KFS_API);
    const token = loadToken();
    let store = null;
    if (token) {
      store = new ApiStore(S.apiBase, token);
      try { await store.init(); }
      catch (e) { store = null; if (e.status === 401) saveToken(''); else { S.gate = 'offline'; S.gateError = e.message; render(); return; } }
    }
    if (!store) { await showAuthGate(); return; }
    restoreRoute(saved);
    enterApi(store);
    return;
  }
  if (hasRuntime) {
    S.mode = 'cloud';
    const [db, user, assets, room] = await Promise.all([withTimeout(claude.use('db'), 12000), withTimeout(claude.use('user'), 12000), withTimeout(claude.use('assets'), 12000), withTimeout(claude.use('room'), 12000)]);
    if (!db) { S.gate = 'signin'; S.store = new LocalStore(); render(); renderGateExtras(); return; }
    S.store = new CloudStore(db, user, assets);
    S.uid = await S.store.init();
    if (user) {
      try { S.isOwner = await user.isOwner(); } catch (e) {}
      try { const cw = await user.can('data.write'); if (cw === false) { S.canWrite = false; S.readOnly = true; } } catch (e) {}
      try { S.platformProfile = await user.me(); } catch (e) {}
    }
    S.canUpload = !!assets; S.room = room;
    setupRoom();
  } else {
    S.mode = 'local'; S.store = new LocalStore(); S.uid = await S.store.init(); S.isOwner = true; S.canUpload = true;
  }
  restoreRoute(saved);
  subscribeAll();
  render();
}
function restoreRoute(saved) {
  if (saved && saved.route) S.route = saved.route;
  if (saved && saved.activeThread) S.ui.activeThread = saved.activeThread;
  const hr = routeFromHash();
  if (hr) S.route = hr; else if ((location.hash || '').startsWith('#user-')) S.pendingHash = location.hash;
  if (!restoreRoute.bound) { restoreRoute.bound = true; window.addEventListener('hashchange', () => { const r = routeFromHash(); if (r) go(r.name, r.params); }); }
}
function enterApi(store) {
  S.store = store; S.uid = store.uid; S.isOwner = store.isOwner; S.canUpload = true; S.canWrite = true; S.readOnly = false; S.gate = null;
  store.onAuthLost = () => signOut(true);
  store.onOnline = set => { S.online = set; scheduleRender(); };
  subscribeAll();
  store.start();
  currentView = null;
  render();
  if (S.justSignedUp) { S.justSignedUp = false; setTimeout(() => { if (me()) openEditProfile(); }, 400); }
}
function resetState() {
  for (const u of unsubs.splice(0)) { try { u(); } catch (e) {} }
  Object.assign(S, { store: null, uid: null, isOwner: false, canWrite: true, canUpload: false, readOnly: false, users: {}, posts: {}, extraPosts: {}, comments: {}, likes: {}, follows: {}, stories: {}, storyviews: {}, threads: {}, tracks: {}, loaded: {}, online: new Set(), typing: {}, priv: { saves: {}, notifSeenAt: 0, threadReads: {}, recent: [], hiddenPosts: {} }, route: { name: 'home', params: {} }, history: [] });
  S.ui.activeThread = null; S.ui.msgsOpen = false;
  closeAllModals(); if (storyState.open) closeStoryViewer();
  currentView = null;
}
async function signOut(expired = false) {
  if (S.store && S.store.stop) S.store.stop();
  saveToken('');
  resetState();
  S.ui.authTab = 'signin';
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (expired) toast('サインインの有効期限が切れました。もう一度サインインしてください');
  await showAuthGate();
}
async function showAuthGate() {
  S.gate = 'auth'; S.authStatus = null; currentView = null; render();
  try { S.authStatus = await apiPublic(S.apiBase, 'GET', '/status'); } catch (e) { S.gate = 'offline'; S.gateError = e.message; }
  currentView = null; render();
}
function renderGateExtras() {
  const card = $('#main .gate .card'); if (!card) return;
  card.append(el('a', { class: 'btn primary lg', href: location.origin + location.pathname, target: '_blank', rel: 'noopener' }, 'KENGO FRIEND SNS を開く'));
  card.append(el('button', { class: 'btn ghost', onclick: () => { S.gate = null; S.mode = 'local'; S.store = new LocalStore(); S.store.init().then(id => { S.uid = id; S.isOwner = true; S.canUpload = true; subscribeAll(); currentView = null; render(); }); } }, 'このブラウザだけで試す（ローカルモード）'));
}
