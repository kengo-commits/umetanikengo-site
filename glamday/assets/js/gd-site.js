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

  var PLAN_SPOTS = {
    'uminonamioto/floorplan-1f.webp': { pool: [47, 45.8, 6.1, 18.3], terrace: [57.7, 49.6, 12.3, 13], bedroom1: [78.3, 27.4, 6.4, 24.1], bedroom2: [57.7, 35.6, 12.3, 13.4] },
    'uminonamioto/floorplan-2f.webp': { living: [47.3, 63.6, 17, 17.2], dining: [38.5, 64, 8.5, 17], 'master-bedroom': [71, 63.6, 9.3, 17.8], bathroom: [66.5, 72.2, 3.8, 9.8] },
    'asamanouta/floorplan-1f.webp': { living: [30.8, 64.6, 45.7, 62.1, 51.3, 57.2, 65, 79.7, 31, 79.5], fireplace: [28.3, 15, 38.3, 15, 38.3, 21.2, 33.7, 25.1, 29.3, 26.9, 28.3, 26.9], sauna: [13.5, 77, 5.5, 8] },
    'asamanouta/floorplan-2f.webp': { living: [6.2, 68.5, 31, 63.2, 31, 85.8, 9.3, 88], dining: [38, 56.5, 20.7, 15.8], bedroom: [55.5, 11, 69.9, 11, 69.9, 37.9, 64.1, 51.5, 51.9, 48.8], bathroom: [70.7, 11.4, 9.3, 15.1] },
    'mizunohoshi/vega_1F_floorplan.webp': { living_dining_kitchen: [20, 32.6, 39.7, 51.3], bed_room: [76.7, 37.6, 15.6, 27.3], woodstove: [46.5, 37.5, 9, 9] },
    'mizunohoshi/vega_2F_floorplan.webp': { master_bed_room: [13.7, 19.2, 26.3, 32.9], bed_room_2: [72, 19.7, 16.7, 35.4], atrium: [42, 19.2, 28, 34.4], bath_room_3: [13.3, 62, 9.7, 15.7], sauna: [23, 56, 9, 9.4] },
    'mizunohoshi/altair_1F_floorplan.webp': { living_dining_kitchen: [36.4, 4.7, 52.6, 49.3], bed_room: [36.4, 70.7, 31.1, 19.6], terrace_1: [0.4, 2.7, 35.6, 52.6], terrace_2: [4.6, 56, 31.4, 37], wood_stove: [38.5, 23, 5, 8.5] },
    'mizunohoshi/altair_2F_floorplan.webp': { master_bed_room: [7.3, 62, 40.2, 35.7], bed_room_2: [7.3, 9, 40.7, 20.3], sauna: [48.4, 74.7, 11.2, 10.3] },
    'yamanofumoto/floorplan-maple-1f.webp': { living: [18.8, 30, 71.2, 32.7], balcony: [18.3, 65, 71.7, 21], kitchen: [18.8, 12.5, 14.4, 17.2], stove: [19, 56.5, 7.5, 6.2] },
    'yamanofumoto/floorplan-maple-2f.webp': { 'master-bed': [3.3, 18, 35, 45.3], bed: [39, 41.7, 53.5, 21.6], bath1: [64.6, 14.3, 27.9, 9.4], bath2: [40.5, 77.7, 29, 19.6], powder: [7.1, 77.3, 31.2, 20.7] },
    'yamanofumoto/floorplan-firtree-1f.webp': { living: [30, 14.6, 60, 14.6, 60, 29.3, 58, 29.3, 58, 76.7, 24, 76.7, 24, 21.4, 30, 21.4], balcony: [62.7, 35.3, 23, 62.1], stove: [53, 31, 6, 11] },
    'yamanofumoto/floorplan-firtree-2f.webp': { 'master-bed': [66.5, 46.7, 31.1, 37.4], bed: [5.3, 53.3, 38.9, 30.8], powder: [44.6, 62, 19.5, 10.5], soho: [82.9, 36.7, 14.7, 10] },
    'yamanofumoto/floorplan-birch-1f.webp': { living: [28.7, 8.9, 55.3, 8.9, 55.3, 15.2, 57.3, 15.2, 57.3, 61, 21.3, 61, 21.3, 17.1, 28.7, 17.1], balcony: [64.7, 8.9, 78.7, 8.9, 78.7, 22.7, 80, 22.7, 80, 45.7, 57.3, 45.7, 57.3, 15.2, 64.7, 15.2], bedroom: [3, 63.6, 34, 24.1], bathroom1: [58, 70.6, 12, 17.5] },
    'yamanofumoto/floorplan-birch-2f.webp': { 'master-bed': [18, 45.9, 42, 45.9, 42, 86.5, 5, 86.5, 5, 53.8, 18, 53.8], soho: [5, 15.3, 19.7, 11], bathroom2: [65.7, 47, 77, 47, 77, 70.9, 56.3, 70.9, 56.3, 59.5, 65.7, 59.5] },
    'soranoniwa/floorplan.webp': { living: [23, 17, 11.3, 16.4], dining: [36, 10.8, 12.3, 15], 'master-bedroom': [80.3, 17, 10.7, 20], bathroom: [75, 9, 5.3, 18.7], terrace: [0.3, 10.8, 23, 10.8, 23, 33.9, 48.7, 33.9, 48.7, 63.2, 32.7, 63.2], fireplace: [22.5, 17, 4, 5.5] }
  };

  function planPoints(r) {
    if (r.length === 4) return [r[0], r[1], r[0] + r[2], r[1], r[0] + r[2], r[1] + r[3], r[0], r[1] + r[3]];
    return r;
  }

  function initPlanSpots() {
    var sec = doc.querySelector('.floor-plan-section');
    if (!sec) return;
    var img = sec.querySelector('#floorplan-diagram');
    var tabs = sec.querySelector('.room-tabs');
    if (!img || !tabs) return;
    var NS = 'http://www.w3.org/2000/svg';
    var frame = doc.createElement('span');
    frame.className = 'gd-fplan';
    img.parentNode.insertBefore(frame, img);
    frame.appendChild(img);
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'gd-fplan__svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    frame.appendChild(svg);
    var label = doc.createElement('span');
    label.className = 'gd-fplan__label';
    label.setAttribute('aria-hidden', 'true');
    frame.appendChild(label);
    var hint = doc.createElement('p');
    hint.className = 'gd-fplan__hint';
    hint.textContent = '図面の部屋をタップすると、写真が切り替わります';
    frame.parentNode.appendChild(hint);
    var key = null, maskId = 'gd-plan-mask';

    function mapFor() {
      var parts = (img.getAttribute('src') || '').split('?')[0].split('/');
      return PLAN_SPOTS[parts.slice(-2).join('/')] || null;
    }
    function tabFor(id) { return tabs.querySelector('.room-tab[data-room="' + id + '"]'); }
    function pts(a) { var o = []; for (var i = 0; i < a.length; i += 2) o.push(a[i] + ',' + a[i + 1]); return o.join(' '); }

    function mark() {
      var act = tabs.querySelector('.room-tab.active');
      var id = act ? act.getAttribute('data-room') : '';
      var on = null;
      Array.prototype.forEach.call(svg.querySelectorAll('.gd-fplan__spot'), function (p) {
        var hit = p.getAttribute('data-room') === id;
        p.classList.toggle('is-active', hit);
        p.setAttribute('aria-pressed', hit ? 'true' : 'false');
        if (hit) on = p;
      });
      var hole = svg.querySelector('.gd-fplan__hole');
      var dim = svg.querySelector('.gd-fplan__dim');
      if (on && hole) {
        hole.setAttribute('points', on.getAttribute('points'));
        dim.style.display = '';
        var a = on.getAttribute('data-pts').split(',').map(Number), minx = 100, miny = 100;
        for (var i = 0; i < a.length; i += 2) { minx = Math.min(minx, a[i]); miny = Math.min(miny, a[i + 1]); }
        label.textContent = on.getAttribute('data-label');
        label.style.left = minx + '%'; label.style.top = miny + '%';
        label.style.transform = miny < 8 ? 'none' : '';
        label.hidden = false;
      } else {
        if (dim) dim.style.display = 'none';
        label.hidden = true;
      }
    }
    function render() {
      var map = mapFor();
      var k = (img.getAttribute('src') || '') + '|' + tabs.textContent;
      if (k === key) { mark(); return; }
      key = k;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var n = 0;
      if (map) {
        var defs = doc.createElementNS(NS, 'defs');
        var mask = doc.createElementNS(NS, 'mask');
        mask.setAttribute('id', maskId);
        mask.setAttribute('maskUnits', 'userSpaceOnUse');
        mask.setAttribute('x', '0'); mask.setAttribute('y', '0'); mask.setAttribute('width', '100'); mask.setAttribute('height', '100');
        var full = doc.createElementNS(NS, 'rect');
        full.setAttribute('width', '100'); full.setAttribute('height', '100'); full.setAttribute('fill', '#fff');
        var hole = doc.createElementNS(NS, 'polygon');
        hole.setAttribute('class', 'gd-fplan__hole'); hole.setAttribute('fill', '#000');
        mask.appendChild(full); mask.appendChild(hole); defs.appendChild(mask); svg.appendChild(defs);
        var dim = doc.createElementNS(NS, 'rect');
        dim.setAttribute('class', 'gd-fplan__dim');
        dim.setAttribute('width', '100'); dim.setAttribute('height', '100');
        dim.setAttribute('mask', 'url(#' + maskId + ')');
        svg.appendChild(dim);
        Object.keys(map).forEach(function (id) {
          var t = tabFor(id);
          if (!t) return;
          var a = planPoints(map[id]);
          var p = doc.createElementNS(NS, 'polygon');
          p.setAttribute('class', 'gd-fplan__spot');
          p.setAttribute('points', pts(a));
          p.setAttribute('data-pts', a.join(','));
          p.setAttribute('data-room', id);
          p.setAttribute('data-label', t.textContent.trim());
          p.setAttribute('vector-effect', 'non-scaling-stroke');
          p.setAttribute('tabindex', '0');
          p.setAttribute('role', 'button');
          p.setAttribute('aria-label', t.textContent.trim() + ' の写真を表示');
          var go = function () { var tt = tabFor(id); if (tt) tt.click(); };
          p.addEventListener('click', go);
          p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
          svg.appendChild(p);
          n++;
        });
      }
      hint.hidden = !n;
      mark();
    }
    render();
    img.addEventListener('load', render);
    if (window.MutationObserver) {
      new MutationObserver(render).observe(img, { attributes: true, attributeFilter: ['src'] });
      new MutationObserver(render).observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
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
      head.innerHTML = '<span class="gd-room__floor"></span><span class="gd-room__ttl">\u306e\u304a\u90e8\u5c4b</span>';
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
    initPlanSpots();
    initGalleryMore();
  });
})();
