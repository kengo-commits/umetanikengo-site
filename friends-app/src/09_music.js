/* ===================================================================
   MUSIC: shared library + persistent player
   =================================================================== */
const AUDIO_TYPES = { 'audio/mpeg': 'audio/mpeg', 'audio/mp3': 'audio/mpeg', 'audio/mp4': 'audio/mp4', 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'audio/aac': 'audio/aac', 'audio/wav': 'audio/wav', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/ogg': 'audio/ogg', 'audio/flac': 'audio/flac', 'audio/x-flac': 'audio/flac', 'audio/webm': 'audio/webm' };
function audioMimeOf(file) {
  const t = (file.type || '').toLowerCase();
  if (AUDIO_TYPES[t]) return AUDIO_TYPES[t];
  const ext = (file.name || '').toLowerCase().split('.').pop();
  return { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', flac: 'audio/flac', weba: 'audio/webm' }[ext] || null;
}
function audioDuration(file) {
  return new Promise(res => {
    const url = URL.createObjectURL(file); const a = new Audio(); a.preload = 'metadata';
    const done = v => { URL.revokeObjectURL(url); res(v); };
    a.onloadedmetadata = () => done(isFinite(a.duration) ? a.duration : 0); a.onerror = () => done(0); setTimeout(() => done(0), 8000); a.src = url;
  });
}
function fmtDur(sec) { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; }
const tracksSorted = () => Object.values(S.tracks).sort((a, b) => b.createdAt - a.createdAt);

/* ---------- player ---------- */
const player = { audio: null, queue: [], index: -1, playing: false, el: null, shuffle: false, repeat: false };
function playerAudio() {
  if (player.audio) return player.audio;
  const a = new Audio(); a.preload = 'metadata';
  a.addEventListener('play', () => { player.playing = true; renderPlayer(); });
  a.addEventListener('pause', () => { player.playing = false; renderPlayer(); });
  a.addEventListener('ended', () => { if (player.repeat) { a.currentTime = 0; a.play().catch(() => {}); } else playerStep(1); });
  a.addEventListener('timeupdate', () => playerTick());
  a.addEventListener('loadedmetadata', () => playerTick());
  a.addEventListener('error', () => { toast('この曲を再生できませんでした'); });
  player.audio = a;
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => a.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => a.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => playerStep(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => playerStep(1));
    } catch (e) { /* unsupported */ }
  }
  return a;
}
const currentTrack = () => (player.index >= 0 ? S.tracks[player.queue[player.index]] || null : null);
function playTrack(id, queueIds) {
  const t = S.tracks[id]; if (!t) return;
  player.queue = (queueIds && queueIds.length ? queueIds : tracksSorted().map(x => x.id)).slice();
  player.index = player.queue.indexOf(id);
  loadCurrent(true);
}
function loadCurrent(autoplay) {
  const t = currentTrack(); const a = playerAudio();
  if (!t) { a.pause(); renderPlayer(); return; }
  a.src = mediaUrl(t.media.id);
  if (autoplay) a.play().catch(() => toast('再生ボタンを押してください'));
  if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || displayName(userOf(t.ownerId)), album: 'KENGO FRIEND SNS', artwork: t.cover ? [{ src: mediaUrl(t.cover), sizes: '512x512', type: 'image/jpeg' }] : [] }); } catch (e) { /* ignore */ } }
  renderPlayer();
  if (currentView && currentView.update) currentView.update();
}
function playerStep(dir) {
  if (!player.queue.length) return;
  if (player.shuffle && player.queue.length > 1) { let n; do { n = Math.floor(Math.random() * player.queue.length); } while (n === player.index); player.index = n; }
  else player.index = (player.index + dir + player.queue.length) % player.queue.length;
  loadCurrent(true);
}
function togglePlay() { const a = playerAudio(); if (!currentTrack()) { const first = tracksSorted()[0]; if (first) playTrack(first.id); return; } if (a.paused) a.play().catch(() => {}); else a.pause(); }
function playerTick() {
  const a = player.audio; if (!a || !player.el) return;
  const cur = a.currentTime || 0, dur = isFinite(a.duration) && a.duration ? a.duration : ((currentTrack() || {}).media || {}).duration || 0;
  const bar = player.el.querySelector('.pl-bar i'); if (bar) bar.style.width = dur ? `${Math.min(100, cur / dur * 100)}%` : '0%';
  const tcur = player.el.querySelector('.pl-cur'); if (tcur) tcur.textContent = fmtDur(cur);
  const tdur = player.el.querySelector('.pl-dur'); if (tdur) tdur.textContent = fmtDur(dur);
}
function renderPlayer() {
  let root = $('#player');
  if (!root) { root = el('div', { id: 'player', class: 'player' }); document.body.append(root); }
  player.el = root;
  const t = currentTrack();
  root.hidden = !t || !!S.gate;
  clear(root);
  if (!t) return;
  const owner = userOf(t.ownerId);
  const cover = el('div', { class: 'pl-cover', onclick: () => go('music') });
  if (t.cover) cover.append(el('img', { src: mediaUrl(t.cover), alt: '' })); else { cover.style.background = `hsl(${hueFor(t.id)} 40% 45%)`; cover.append(icon('music')); }
  const bar = el('div', { class: 'pl-bar', onclick: e => { const r = bar.getBoundingClientRect(); const a = playerAudio(); const dur = isFinite(a.duration) ? a.duration : 0; if (dur) a.currentTime = Math.max(0, Math.min(dur, (e.clientX - r.left) / r.width * dur)); } }, el('i'));
  root.append(cover,
    el('div', { class: 'pl-info', onclick: () => go('music') }, el('div', { class: 'pl-title trunc' }, t.title), el('div', { class: 'pl-sub trunc' }, t.artist || displayName(owner))),
    el('div', { class: 'pl-ctl' },
      el('button', { 'aria-label': '前の曲', html: iconHTML('prev'), onclick: () => playerStep(-1) }),
      el('button', { class: 'pl-play', 'aria-label': player.playing ? '一時停止' : '再生', html: iconHTML(player.playing ? 'pause' : 'play'), onclick: togglePlay }),
      el('button', { 'aria-label': '次の曲', html: iconHTML('next'), onclick: () => playerStep(1) }),
      el('button', { class: 'pl-x', 'aria-label': '閉じる', html: iconHTML('x'), onclick: () => { playerAudio().pause(); player.index = -1; player.queue = []; renderPlayer(); if (currentView && currentView.update) currentView.update(); } })),
    el('div', { class: 'pl-time num' }, el('span', { class: 'pl-cur' }, '0:00'), bar, el('span', { class: 'pl-dur' }, fmtDur(t.media.duration))));
  playerTick();
}

/* ---------- MUSIC view ---------- */
function musicView() {
  const root = el('div');
  const head = el('div', { class: 'music-head' });
  const list = el('div', { class: 'tracks' });
  const empty = el('div');
  root.append(head, list, empty);
  const trackRow = t => {
    const owner = userOf(t.ownerId); const active = currentTrack() && currentTrack().id === t.id;
    const row = el('div', { class: 'track' + (active ? ' active' : '') });
    const art = el('button', { class: 'tr-art', 'aria-label': '再生', onclick: () => (active ? togglePlay() : playTrack(t.id)) });
    if (t.cover) art.append(el('img', { src: mediaUrl(t.cover), alt: '', loading: 'lazy' })); else { art.style.background = `hsl(${hueFor(t.id)} 40% 45%)`; art.append(icon('music')); }
    art.append(el('span', { class: 'tr-play', html: iconHTML(active && player.playing ? 'pause' : 'play') }));
    const info = el('div', { class: 'tr-info', onclick: () => (active ? togglePlay() : playTrack(t.id)) }, el('div', { class: 'tr-title trunc' }, t.title), el('div', { class: 'tr-sub trunc' }, [t.artist, displayName(owner), timeAgo(t.createdAt, true)].filter(Boolean).join(' · ')));
    const more = el('button', { class: 'tr-more', 'aria-label': 'オプション', html: iconHTML('more'), onclick: () => openSheet([
      { label: '次に再生', onClick: () => { if (!player.queue.length) { playTrack(t.id); return; } player.queue = player.queue.filter(x => x !== t.id); player.queue.splice(player.index + 1, 0, t.id); toast('次に再生します', 'check'); } },
      { label: 'メッセージで送信', icon: 'send', onClick: () => pickRecipients({ title: 'シェア', okLabel: '送信' }, async ids => { for (const id of ids) { const tid = await getOrCreateThread([id]); await sendMessage(tid, { text: `♪ ${t.title}${t.artist ? ' / ' + t.artist : ''}（MUSIC に保存されています）` }); } toast('送信しました', 'check'); }) },
      (t.ownerId === S.uid || S.isOwner) ? { label: '削除', danger: true, onClick: async () => { if (await confirmDialog({ title: `「${t.title}」を削除しますか？`, text: 'ライブラリから消え、元に戻せません。', okLabel: '削除', danger: true })) { if (currentTrack() && currentTrack().id === t.id) { playerAudio().pause(); player.index = -1; player.queue = []; renderPlayer(); } await run(() => deleteTrack(t.id), '削除できませんでした'); toast('削除しました'); } } } : null,
    ]) });
    row.append(art, info, el('span', { class: 'tr-dur num' }, fmtDur(t.media.duration)), more);
    return row;
  };
  const update = () => {
    const tracks = tracksSorted();
    clear(head);
    head.append(el('div', { class: 'grow' }, el('h2', { class: 'page-title', style: 'margin:0' }, 'MUSIC'), el('div', { class: 'muted small num' }, `${tracks.length}曲${tracks.length ? ' · ' + fmtDur(tracks.reduce((a, t) => a + (t.media.duration || 0), 0)) : ''}`)));
    if (tracks.length) head.append(el('button', { class: 'btn', onclick: () => { player.shuffle = true; const ids = tracks.map(t => t.id); playTrack(ids[Math.floor(Math.random() * ids.length)], ids); } }, icon('shuffle'), 'シャッフル'));
    if (S.uid && S.store.canUpload()) head.append(el('button', { class: 'btn primary', onclick: openTrackUpload }, icon('plus'), '追加'));
    keyedList(list, tracks, t => t.id, trackRow, (n, t) => { const nn = trackRow(t); n.className = nn.className; n.replaceChildren(...Array.from(nn.childNodes)); });
    clear(empty);
    if (!tracks.length) empty.append(emptyState('music', 'まだ曲がありません', 'MP3 や M4A をアップロードすると、みんなのライブラリに保存され、ここからすぐ再生できます。', S.uid ? el('button', { class: 'btn primary', onclick: openTrackUpload }, '最初の曲を追加') : null));
  };
  update();
  return { el: root, update };
}
function openTrackUpload() {
  if (!requireWrite('MUSIC への追加')) return;
  pickAudio(async file => {
    const mime = audioMimeOf(file);
    if (!mime) { toast('対応していない音声形式です（MP3 / M4A / AAC / WAV / OGG / FLAC）'); return; }
    if (file.size > MAX_UPLOAD) { toast('音声ファイルは20MBまでです'); return; }
    const duration = await audioDuration(file);
    const base = (file.name || '').replace(/\.[^.]+$/, '');
    const st = { title: base, artist: '', note: '', coverBlob: null, coverUrl: '' };
    const title = el('input', { class: 'input', id: 'tr-title', value: st.title, placeholder: '曲名', maxlength: 120 }); title.addEventListener('input', () => { st.title = title.value; });
    const artist = el('input', { class: 'input', id: 'tr-artist', placeholder: 'アーティスト（任意）', maxlength: 120 }); artist.addEventListener('input', () => { st.artist = artist.value; });
    const note = el('input', { class: 'input', id: 'tr-note', placeholder: 'ひとこと（任意）', maxlength: 300 }); note.addEventListener('input', () => { st.note = note.value; });
    const coverBox = el('button', { class: 'tr-cover-pick', type: 'button', 'aria-label': 'ジャケット画像' });
    const drawCover = () => { clear(coverBox); if (st.coverUrl) coverBox.append(el('img', { src: st.coverUrl, alt: '' })); else coverBox.append(icon('image'), el('span', {}, 'ジャケット画像（任意）')); };
    drawCover();
    coverBox.addEventListener('click', () => pickFiles(false, async f => { try { const r = await processImage(f[0], 800, 0.85); st.coverBlob = r.blob; st.coverUrl = URL.createObjectURL(r.blob); drawCover(); } catch (e) { toast(e.message); } }, true));
    const err = el('div', { class: 'error' });
    const body = el('div', { class: 'modal-body' }, el('div', { class: 'row', style: 'gap:12px' }, coverBox, el('div', { class: 'grow' }, el('div', { class: 'bold trunc' }, file.name), el('div', { class: 'muted small num' }, `${fmtDur(duration)} · ${(file.size / 1048576).toFixed(1)} MB`))),
      el('div', { class: 'field' }, el('label', { for: 'tr-title' }, '曲名'), title), el('div', { class: 'field' }, el('label', { for: 'tr-artist' }, 'アーティスト'), artist), el('div', { class: 'field' }, el('label', { for: 'tr-note' }, 'ひとこと'), note), err);
    const ok = el('button', { onclick: async () => {
      if (!st.title.trim()) { err.textContent = '曲名を入力してください。'; return; }
      ok.disabled = true; ok.textContent = 'アップロード中…';
      try { const id = await createTrack({ file, mime, duration, title: st.title.trim(), artist: st.artist.trim(), note: st.note.trim(), coverBlob: st.coverBlob }); close(); toast('MUSIC に追加しました', 'check'); if (S.route.name !== 'music') go('music'); playTrack(id); }
      catch (e) { ok.disabled = false; ok.textContent = '追加'; err.textContent = friendlyError(e); }
    } }, '追加');
    const m = modalFrame({ title: 'MUSIC に追加', left: closeBtn(() => close()), right: ok, body, size: 'md' });
    const close = openModal(m);
  });
}
function pickAudio(cb) {
  let input = $('#file-input-audio');
  if (!input) { input = el('input', { type: 'file', id: 'file-input-audio', class: 'sr', accept: 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac', tabindex: '-1' }); document.body.append(input); }
  input.value = ''; input.onchange = () => { const f = input.files && input.files[0]; if (f) cb(f); }; input.click();
}
