(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  root.classList.add('is-visible');

  function ready(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 767px), (hover: none)').matches);
  }

  function initFaq() {
    var tabs = Array.prototype.slice.call(doc.querySelectorAll('.faq-tab'));
    var contents = Array.prototype.slice.call(doc.querySelectorAll('.faq-content'));
    tabs.forEach(function (tab) {
      tab.setAttribute('type', 'button');
      tab.addEventListener('click', function () {
        var cat = tab.getAttribute('data-category');
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('active', on);
          t.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        contents.forEach(function (c) {
          c.classList.toggle('active', c.getAttribute('data-category') === cat);
        });
      });
    });

    function fit(item) {
      var ans = item.querySelector('.faq-answer');
      if (!ans) return;
      var inner = ans.querySelector('.answer-content') || ans;
      ans.style.maxHeight = item.classList.contains('active') ? inner.scrollHeight + 'px' : '0px';
    }

    Array.prototype.slice.call(doc.querySelectorAll('.faq-question')).forEach(function (q) {
      var item = q.parentElement;
      q.setAttribute('type', 'button');
      q.setAttribute('aria-expanded', item.classList.contains('active') ? 'true' : 'false');
      q.addEventListener('click', function () {
        var open = !item.classList.contains('active');
        item.classList.toggle('active', open);
        q.setAttribute('aria-expanded', open ? 'true' : 'false');
        fit(item);
      });
    });

    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        Array.prototype.slice.call(doc.querySelectorAll('.faq-item.active')).forEach(fit);
      }, 150);
    });
  }

  function offsetTop() {
    var off = 0;
    var header = doc.querySelector('.gd-header');
    if (header) off += header.getBoundingClientRect().height;
    var nav = doc.querySelector('.gd-lp-nav');
    if (nav && window.getComputedStyle(nav).position === 'sticky') off += nav.getBoundingClientRect().height;
    return off;
  }

  function targetY(el) {
    if (el === doc.body) return 0;
    return Math.max(0, Math.round(el.getBoundingClientRect().top + window.pageYOffset - offsetTop()));
  }

  function jump(y, smooth) {
    var lenis = window.lenis;
    if (lenis && typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(y, { immediate: !smooth || reduceMotion(), force: true });
      return;
    }
    if (smooth && !reduceMotion() && 'scrollBehavior' in root.style) {
      window.scrollTo({ top: y, behavior: 'smooth' });
    } else {
      var prev = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, y);
      root.style.scrollBehavior = prev;
    }
  }

  var settleTimer = null;
  function stopSettle() {
    if (settleTimer) { clearInterval(settleTimer); settleTimer = null; }
  }
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) {
    window.addEventListener(ev, stopSettle, { passive: true });
  });

  function scrollToEl(el, smooth) {
    stopSettle();
    jump(targetY(el), smooth);
    var last = -1, still = 0, ticks = 0;
    settleTimer = setInterval(function () {
      var y = window.pageYOffset;
      still = Math.abs(y - last) < 1 ? still + 1 : 0;
      last = y;
      if (still >= 4 || ++ticks > 80) {
        stopSettle();
        var want = targetY(el);
        if (Math.abs(want - y) > 2) jump(want, false);
      }
    }, 100);
  }

  function samePage(url) {
    var norm = function (p) { return p.replace(/index\.html$/, ''); };
    return url.origin === window.location.origin && norm(url.pathname) === norm(window.location.pathname);
  }

  function findTarget(hash) {
    if (!hash || hash.length < 2) return null;
    var id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch (e) { id = hash.slice(1); }
    if (id === 'top') return doc.body;
    return doc.getElementById(id);
  }

  function initAnchors() {
    doc.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a || (a.target && a.target !== '_self')) return;
      var raw = a.getAttribute('href');
      if (!raw || raw === '#') return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (!url.hash || !samePage(url)) return;
      var el = findTarget(url.hash);
      if (!el) return;
      e.preventDefault();
      scrollToEl(el, true);
      if (window.history && history.replaceState) history.replaceState(null, '', url.hash);
    });

    if (window.location.hash) {
      var align = function () {
        var el = findTarget(window.location.hash);
        if (el) scrollToEl(el, false);
      };
      if (doc.readyState === 'complete') setTimeout(align, 60);
      else window.addEventListener('load', function () { setTimeout(align, 60); });
    }
  }

  function initFloorPlan() {
    var sec = doc.querySelector('.floor-plan-section');
    if (!sec) return;
    var levels = sec.querySelector('.floor-level-tabs');
    var selected = doc.getElementById('selected-floor');
    var diagram = sec.querySelector('.floor-plan-diagram');
    var photo = sec.querySelector('.floor-plan-photo');
    var tabs = sec.querySelector('.gd-room .room-tabs');
    var seg = null;

    function badge(host) {
      if (!host) return null;
      var b = doc.createElement('span');
      b.className = 'gd-floor-badge';
      b.setAttribute('aria-hidden', 'true');
      host.appendChild(b);
      return b;
    }
    var badges = selected ? [badge(diagram)] : [];
    var bar = sec.querySelector('.gd-floorbar');
    function placeBar() {
      if (!bar) return;
      var top = 0, h = doc.querySelector('.gd-header'), nav = doc.querySelector('.gd-lp-nav');
      if (h) top += h.getBoundingClientRect().height;
      if (nav && window.getComputedStyle(nav).position === 'sticky') top += nav.getBoundingClientRect().height;
      bar.style.top = Math.round(top) + 'px';
    }
    placeBar();
    window.addEventListener('resize', placeBar);
    window.addEventListener('load', placeBar);
    var head = null;
    var room = sec.querySelector('.gd-room');
    if (selected && room) {
      head = doc.createElement('div');
      head.className = 'gd-room__head';
      head.innerHTML = '<span class="gd-room__floor"></span><span class="gd-room__ttl">\u306e\u304a\u90e8\u5c4b</span><span class="gd-room__count"></span>';
      room.insertBefore(head, room.firstChild);
    }

    function label() {
      var floor = selected ? selected.textContent.trim().toUpperCase() : '';
      var prop = doc.querySelector('.property-tab.active');
      return (prop ? prop.textContent.trim() + ' / ' : '') + floor;
    }

    function buildSeg() {
      if (!levels) return;
      var opts = Array.prototype.slice.call(levels.querySelectorAll('.floor-option'));
      if (opts.length < 2) { levels.classList.remove('is-seg'); if (seg) seg.innerHTML = ''; return; }
      if (!seg) {
        seg = doc.createElement('div');
        seg.className = 'gd-floor-seg';
        seg.setAttribute('role', 'group');
        seg.setAttribute('aria-label', 'フロア切り替え');
        levels.appendChild(seg);
      }
      seg.innerHTML = '';
      opts.forEach(function (o) {
        var b = doc.createElement('button');
        b.type = 'button';
        b.className = 'gd-floor-seg__btn';
        b.textContent = o.textContent.trim();
        b.setAttribute('data-floor', o.getAttribute('data-floor') || '');
        b.addEventListener('click', function (e) { e.stopPropagation(); o.click(); });
        seg.appendChild(b);
      });
      levels.classList.add('is-seg');
    }

    var last = null, fadeTimer = null;
    function sync() {
      var floor = selected ? selected.textContent.trim().toUpperCase() : '';
      if (seg) {
        Array.prototype.forEach.call(seg.children, function (b) {
          var on = b.textContent.trim().toUpperCase() === floor;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      var text = label();
      badges.forEach(function (b) { if (b) b.textContent = text; });
      if (head) {
        head.querySelector('.gd-room__floor').textContent = text;
        var n = tabs ? tabs.querySelectorAll('.room-tab').length : 0;
        head.querySelector('.gd-room__count').textContent = n ? n + ' ROOMS' : '';
        if (last !== null && last !== text) {
          head.classList.add('is-updated'); void head.offsetWidth;
          setTimeout(function () { head.classList.remove('is-updated'); }, 80);
        }
      }
      if (last !== null && last !== text && !reduceMotion()) {
        [diagram, photo].forEach(function (el) { if (el) el.classList.add('is-switching'); });
        clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () {
          [diagram, photo].forEach(function (el) { if (el) el.classList.remove('is-switching'); });
        }, 60);
      }
      last = text;
      if (tabs) tabs.setAttribute('aria-label', (text ? text + ' ' : '') + '部屋の写真');
    }

    buildSeg();
    sync();
    if (window.MutationObserver) {
      if (selected) new MutationObserver(sync).observe(selected, { childList: true, characterData: true, subtree: true });
      var dd = levels && levels.querySelector('.floor-dropdown');
      if (dd) new MutationObserver(function () { buildSeg(); sync(); }).observe(dd, { childList: true });
      if (tabs) new MutationObserver(sync).observe(tabs, { childList: true });
      Array.prototype.forEach.call(doc.querySelectorAll('.property-tab'), function (p) {
        new MutationObserver(sync).observe(p, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  function initGalleryMore() {
    Array.prototype.forEach.call(doc.querySelectorAll('.gd-lp-gallery.is-collapsed'), function (sec) {
      var btn = sec.querySelector('.gd-lp-more');
      if (!btn) return;
      btn.addEventListener('click', function () {
        sec.classList.remove('is-collapsed');
        btn.setAttribute('aria-expanded', 'true');
        var next = sec.querySelector('.gd-gp-grid > .gd-gp-item:nth-child(4)');
        if (next) next.focus({ preventScroll: true });
      });
    });
  }

  ready(function () {
    initFaq();
    initAnchors();
    initFloorPlan();
    initGalleryMore();
  });
})();
