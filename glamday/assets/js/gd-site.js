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

  ready(function () {
    initFaq();
    initAnchors();
  });
})();
