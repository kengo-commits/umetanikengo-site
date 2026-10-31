/* ===================================================================
   API mode: sign in / join, account settings, owner tools
   =================================================================== */
function authView() {
  const st = S.authStatus;
  const card = el('div', { class: 'card auth' }, brandEl());
  if (!st) { card.append(el('div', { class: 'spinner' }), el('p', {}, '接続しています…')); return { el: el('div', { class: 'gate' }, card), cls: 'full' }; }
  const first = !!st.open;
  let tab = first ? 'join' : (S.ui.authTab || 'signin');
  const seg = el('div', { class: 'segmented', style: 'width:100%' });
  const body = el('div', { class: 'auth-body' });
  const err = el('div', { class: 'error', style: 'min-height:1.2em' });
  const field = (id, label, type, placeholder, extra = {}) => { const i = el('input', Object.assign({ class: 'input', id, type, placeholder, autocomplete: type === 'password' ? 'current-password' : 'off' }, extra)); return [el('div', { class: 'field' }, el('label', { for: id }, label), i), i]; };
  const draw = () => {
    clear(seg); clear(body); err.textContent = '';
    seg.hidden = first;
    if (!first) for (const [k, label] of [['signin', 'サインイン'], ['join', '参加する']]) seg.append(el('button', { class: k === tab ? 'active' : '', onclick: () => { tab = k; S.ui.authTab = k; draw(); } }, label));
    else body.append(el('p', { class: 'hint', style: 'text-align:center' }, 'まだメンバーがいません。最初に登録した人が管理者になります。友人が参加するときに使う合言葉もここで決めてください。'));
    if (tab === 'signin') {
      const [fu, u] = field('auth-user', 'ユーザー名', 'text', 'ユーザー名', { autocapitalize: 'none', spellcheck: 'false' });
      const [fp, p] = field('auth-pass', 'パスワード', 'password', 'パスワード');
      const btn = el('button', { class: 'btn primary lg block', type: 'submit' }, 'サインイン');
      const form = el('form', { onsubmit: async e => { e.preventDefault(); btn.disabled = true; err.textContent = ''; try { await signIn(u.value, p.value); } catch (ex) { err.textContent = friendlyError(ex); btn.disabled = false; } } }, fu, fp, err, btn);
      body.append(form, el('p', { class: 'hint', style: 'text-align:center' }, 'パスワードを忘れたときは、管理者に再設定を依頼してください。'));
    } else {
      const [fk, key] = first ? field('auth-setupkey', '初期設定キー（Cloudflare の Secret「OWNER_SETUP_KEY」の値）', 'password', '初期設定キー', { autocomplete: 'off' }) : [null, null];
      const [fi, inv] = first ? field('auth-newinvite', '合言葉を決める（友人に伝える参加用のことば）', 'text', '例：tomodachi2026', { autocapitalize: 'none' }) : field('auth-invite', '合言葉', 'text', '招待者から聞いた合言葉', { autocapitalize: 'none' });
      const [fu, u] = field('auth-newuser', 'ユーザー名（半角英数字・. _）', 'text', '例：kengo_umetani', { autocapitalize: 'none', spellcheck: 'false', maxlength: 30 });
      u.addEventListener('input', () => { u.value = normUsername(u.value); });
      const [fn, n] = field('auth-name', '名前', 'text', '表示する名前（あとで変更できます）', { maxlength: 60 });
      const [fp, p] = field('auth-newpass', 'パスワード（8文字以上）', 'password', 'パスワード', { autocomplete: 'new-password', minlength: 8 });
      const btn = el('button', { class: 'btn primary lg block', type: 'submit' }, first ? '管理者として登録する' : '参加する');
      const form = el('form', { onsubmit: async e => {
        e.preventDefault(); err.textContent = '';
        const un = normUsername(u.value);
        if (!isValidUsername(un)) { err.textContent = 'ユーザー名は3〜30文字の半角英数字・ピリオド・アンダースコアで、先頭と末尾は英数字にしてください。'; return; }
        if (p.value.length < 8) { err.textContent = 'パスワードは8文字以上にしてください。'; return; }
        if (first && inv.value.trim().length < 4) { err.textContent = '合言葉は4文字以上にしてください。'; return; }
        if (first && !key.value.trim()) { err.textContent = '初期設定キーを入力してください。'; return; }
        btn.disabled = true;
        try { await signUp({ username: un, password: p.value, name: n.value.trim(), invite: first ? '' : inv.value.trim(), newInvite: first ? inv.value.trim() : '', setupKey: first ? key.value.trim() : undefined }); }
        catch (ex) { err.textContent = friendlyError(ex); btn.disabled = false; }
      } }, ...(first ? [fk] : []), fi, fu, fn, fp, err, btn);
      body.append(form);
    }
  };
  draw();
  card.append(seg, body);
  card.append(el('p', { class: 'hint', style: 'text-align:center' }, el('a', { href: '../', style: 'text-decoration:underline' }, 'KENGO UMETANI OFFICIAL に戻る')));
  return { el: el('div', { class: 'gate' }, card), cls: 'full' };
}
async function signIn(username, password) {
  const r = await apiPublic(S.apiBase, 'POST', '/auth/login', { username: normUsername(username), password });
  await enterWithToken(r.token);
}
async function signUp(p) {
  const r = await apiPublic(S.apiBase, 'POST', '/auth/signup', p);
  S.justSignedUp = true;
  await enterWithToken(r.token);
}
async function enterWithToken(token) {
  saveToken(token);
  const store = new ApiStore(S.apiBase, token);
  await store.init();
  resetState();
  S.gate = null;
  enterApi(store);
}
function offlineView() {
  const card = el('div', { class: 'card' }, brandEl(), el('h2', {}, 'サーバーに接続できません'), el('p', {}, S.gateError || '通信環境を確認して、もう一度お試しください。'), el('button', { class: 'btn primary lg', onclick: () => location.reload() }, '再読み込み'));
  return { el: el('div', { class: 'gate' }, card), cls: 'full' };
}
function pendingView() {
  const card = el('div', { class: 'card' }, brandEl(), el('h2', {}, '準備中'), el('p', {}, 'KENGO FRIEND SNS はまもなく公開されます。'));
  return { el: el('div', { class: 'gate' }, card), cls: 'full' };
}

/* ---------- account dialogs ---------- */
function openChangePassword() {
  const cur = el('input', { class: 'input', id: 'pw-cur', type: 'password', autocomplete: 'current-password', placeholder: '現在のパスワード' });
  const nxt = el('input', { class: 'input', id: 'pw-new', type: 'password', autocomplete: 'new-password', placeholder: '新しいパスワード（8文字以上）' });
  const nxt2 = el('input', { class: 'input', id: 'pw-new2', type: 'password', autocomplete: 'new-password', placeholder: '新しいパスワード（確認）' });
  const err = el('div', { class: 'error' });
  const body = el('div', { class: 'modal-body' }, el('div', { class: 'field' }, el('label', { for: 'pw-cur' }, '現在のパスワード'), cur), el('div', { class: 'field' }, el('label', { for: 'pw-new' }, '新しいパスワード'), nxt), el('div', { class: 'field' }, el('label', { for: 'pw-new2' }, '確認'), nxt2), err);
  const ok = el('button', { onclick: async () => {
    err.textContent = '';
    if (nxt.value.length < 8) { err.textContent = '新しいパスワードは8文字以上にしてください。'; return; }
    if (nxt.value !== nxt2.value) { err.textContent = '確認用のパスワードが一致しません。'; return; }
    ok.disabled = true;
    try { await S.store.changePassword(cur.value, nxt.value); close(); toast('パスワードを変更しました', 'check'); } catch (e) { err.textContent = friendlyError(e); ok.disabled = false; }
  } }, '変更');
  const m = modalFrame({ title: 'パスワードを変更', left: closeBtn(() => close()), right: ok, body });
  const close = openModal(m);
}
function openInviteSettings() {
  const code = el('input', { class: 'input', id: 'invite-code', value: S.store.invite || '', placeholder: '合言葉', maxlength: 64, autocapitalize: 'none' });
  const err = el('div', { class: 'error' });
  const link = location.origin + location.pathname;
  const body = el('div', { class: 'modal-body' },
    el('p', { class: 'hint' }, '友人には「このページのアドレス」と「合言葉」を伝えるだけで参加できます。合言葉を変えると、以降の新規参加にだけ新しい合言葉が必要になります（すでに参加した人には影響しません）。'),
    el('div', { class: 'field' }, el('label', { for: 'invite-code' }, '合言葉'), code),
    el('div', { class: 'field' }, el('label', {}, '参加ページ'), el('div', { class: 'row' }, el('input', { class: 'input bare', readonly: true, value: link, id: 'invite-link' }), el('button', { class: 'btn sm', onclick: () => copyText(link) }, 'コピー'))),
    err);
  const ok = el('button', { onclick: async () => { err.textContent = ''; if (code.value.trim().length < 4) { err.textContent = '合言葉は4文字以上にしてください。'; return; } ok.disabled = true; try { await S.store.adminSetInvite(code.value.trim()); close(); toast('合言葉を更新しました', 'check'); } catch (e) { err.textContent = friendlyError(e); ok.disabled = false; } } }, '保存');
  const m = modalFrame({ title: '合言葉と招待', left: closeBtn(() => close()), right: ok, body, size: 'md' });
  const close = openModal(m);
}
async function openMembers() {
  const list = el('div', { class: 'list-body' });
  const m = modalFrame({ title: 'メンバー管理', left: closeBtn(() => close()), body: list, size: 'md' });
  const close = openModal(m, { autofocus: false });
  const draw = async () => {
    clear(list); list.append(el('div', { class: 'empty', style: 'padding:24px' }, el('div', { class: 'spinner' })));
    let members = [];
    try { members = await S.store.adminMembers(); } catch (e) { clear(list); list.append(emptyState('users', '読み込めませんでした', friendlyError(e))); return; }
    clear(list);
    for (const mb of members) {
      const u = userOf(mb.id);
      const row = el('div', { class: 'person' }, avatarEl(u, 'm'), el('div', { class: 'who' }, el('div', { class: 'u' }, mb.username, mb.isOwner ? el('span', { class: 'pill', style: 'margin-left:6px' }, '管理者') : null, mb.disabled ? el('span', { class: 'pill', style: 'margin-left:6px;color:var(--danger)' }, '停止中') : null), el('div', { class: 'n' }, `${u.name || ''} · 参加 ${fmtDateLong(mb.createdAt)}${mb.lastSeen ? ' · 最終 ' + timeAgo(mb.lastSeen) : ''}`)));
      if (!mb.isOwner) row.append(el('button', { class: 'btn icon ghost', 'aria-label': 'オプション', html: iconHTML('more'), onclick: () => openSheet([
        { label: 'パスワードを再設定（仮パスワードを発行）', onClick: async () => { const r = await run(() => S.store.adminMember(mb.id, { resetPassword: true }), '再設定できませんでした'); if (r && r.tempPassword) { const body = el('div', { class: 'modal-body' }, el('p', {}, `${mb.username} の仮パスワードです。本人に伝えてください。サインイン後に「パスワードを変更」から変更できます。`), el('div', { class: 'row' }, el('input', { class: 'input', readonly: true, value: r.tempPassword, id: 'temp-pw' }), el('button', { class: 'btn sm', onclick: () => copyText(r.tempPassword) }, 'コピー'))); const mm = modalFrame({ title: '仮パスワード', left: closeBtn(() => c2()), body }); const c2 = openModal(mm, { autofocus: false }); } } },
        mb.disabled ? { label: '利用を再開する', onClick: async () => { await run(() => S.store.adminMember(mb.id, { disabled: false }), '変更できませんでした'); draw(); } } : { label: '利用を停止する', danger: true, onClick: async () => { if (await confirmDialog({ title: `${mb.username} の利用を停止しますか？`, text: 'サインインできなくなります。投稿は残ります。', okLabel: '停止', danger: true })) { await run(() => S.store.adminMember(mb.id, { disabled: true }), '変更できませんでした'); draw(); } } },
      ]) }));
      list.append(row);
    }
  };
  draw();
}
async function openUsage() {
  const body = el('div', { class: 'about' }, el('div', { class: 'spinner' }));
  const m = modalFrame({ title: '使用状況', left: closeBtn(() => close()), body });
  const close = openModal(m, { autofocus: false });
  try {
    const s = await S.store.adminStats();
    const gb = s.mediaBytes / (1024 ** 3);
    clear(body);
    body.append(el('b', {}, 'USAGE'), el('dl', {}, el('dt', {}, 'メンバー'), el('dd', { class: 'num' }, `${s.members}人`), el('dt', {}, '投稿'), el('dd', { class: 'num' }, `${s.posts}件`), el('dt', {}, '写真・動画'), el('dd', { class: 'num' }, `${s.mediaFiles}ファイル · ${gb < 0.01 ? (s.mediaBytes / (1024 ** 2)).toFixed(1) + ' MB' : gb.toFixed(2) + ' GB'}`), el('dt', {}, '無料枠'), el('dd', {}, '保存 10 GB まで')), el('div', { class: 'progress', style: 'margin-top:12px' }, el('i', { style: `width:${Math.min(100, gb / 10 * 100).toFixed(1)}%` })));
  } catch (e) { clear(body); body.append(el('p', { class: 'error' }, friendlyError(e))); }
}
