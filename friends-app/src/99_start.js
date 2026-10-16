/* ---------- boot (last, after every module is defined) ---------- */
(function startApp() {
  const hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ route: S.route, activeThread: S.ui.activeThread })); } catch (e) {}
  const start = data => boot(data || {}).catch(e => { console.error(e); loadingScreen('読み込みに失敗しました。ページを再読み込みしてください。'); });
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
$('#layer').addEventListener('click', e => { if (e.target === e.currentTarget) closeTopModal(); });
window.addEventListener('resize', debounce(() => scheduleRender(), 200));
