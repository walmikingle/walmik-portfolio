/* ============================================================
   app.js — page controller
   loader · scroll progress · section themes · reveals · menu
   ============================================================ */
(function () {
  'use strict';

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (sel) { return document.querySelector(sel); };

  document.addEventListener('DOMContentLoaded', function () {

    var body = document.body;
    var loader = $('#loader');
    var loaderBar = $('#loaderBar');
    var loaderPct = $('#loaderPct');
    var scene = null;

    /* ---------------- 1. WebGL ---------------- */
    try {
      scene = window.PortfolioScene && window.PortfolioScene.create($('#gl'));
    } catch (err) {
      scene = null; // CSS fallback background remains
    }

    /* ---------------- 2. Loader ---------------- */
    var pct = 0;
    var loaded = false;
    var loaderDone = false;

    function finishLoader() {
      if (loaderDone) return;
      loaderDone = true;
      loader.classList.add('is-filling');
      setTimeout(function () {
        loader.classList.add('is-done');
        body.classList.remove('is-loading');
        if (scene) scene.start();
        revealInView();
      }, 900);
      setTimeout(function () {
        loader.style.display = 'none';
      }, 2000);
    }

    // real asset loading, whichever resolves last
    window.addEventListener('load', function () { loaded = true; });
    var startTime = performance.now();

    var ticker = setInterval(function () {
      var target = loaded ? 100 : 88;
      pct += (target - pct) * 0.18;
      if (pct > 99.2 && loaded) pct = 100;
      loaderBar.style.width = pct.toFixed(1) + '%';
      loaderPct.textContent = Math.round(pct);
      var elapsed = performance.now() - startTime;
      if (pct >= 100 || elapsed > 3500) {
        clearInterval(ticker);
        pct = 100;
        loaderBar.style.width = '100%';
        loaderPct.textContent = '100';
        setTimeout(finishLoader, 260);
      }
    }, 80);

    // fail-safe: never trap the user behind the loader
    setTimeout(function () {
      clearInterval(ticker);
      finishLoader();
    }, 5200);

    /* ---------------- 3. Scroll → scene progress + rail ---------------- */
    var sections = Array.prototype.slice.call(document.querySelectorAll('.section'));
    var railLabel = $('#railLabel');
    var railFill = $('#railFill');
    var lastIndex = -1;

    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    function onScroll() {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? window.scrollY / docHeight : 0;
      if (scene) scene.setProgress(progress);
      if (railFill) railFill.style.width = (progress * 100).toFixed(1) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ---------------- 4. Active section → theme + rail label ---------------- */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var idx = parseInt(el.getAttribute('data-index'), 10) || 0;
        var name = el.getAttribute('data-name') || '';
        var theme = el.getAttribute('data-theme') || 'dark';

        if (idx !== lastIndex) {
          lastIndex = idx;
          if (railLabel) railLabel.textContent = pad2(idx) + ' / ' + name;
          if (scene) scene.setTheme(theme === 'light');
          var active = document.querySelector('.menu__list a[href="#' + el.id + '"]');
          document.querySelectorAll('.menu__list a').forEach(function (a) {
            a.classList.toggle('is-active', a === active);
          });
        }
      });
    }, { threshold: 0.5 });
    sections.forEach(function (s) { io.observe(s); });

    /* ---------------- 5. Reveal on enter ---------------- */
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    function registerReveals() {
      document.querySelectorAll('[data-reveal]').forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i % 6, 5) * 70 + 'ms';
        revealIO.observe(el);
      });
    }
    function revealInView() {
      document.querySelectorAll('[data-reveal]').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.92) el.classList.add('is-in');
      });
    }
    registerReveals();

    /* ---------------- 6. Pointer parallax ---------------- */
    var pointerTarget = { x: 0, y: 0 };
    window.addEventListener('pointermove', function (e) {
      pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointerTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    (function pointerLoop() {
      pointerTarget.x *= 0.985;
      pointerTarget.y *= 0.985;
      if (scene) scene.setPointer(pointerTarget.x, pointerTarget.y);
      requestAnimationFrame(pointerLoop);
    })();

    /* ---------------- 7. Menu ---------------- */
    var burger = $('#burger');
    var menu = $('#menu');

    function setMenu(open) {
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.style.overflow = open ? 'hidden' : '';
      // stagger
      menu.querySelectorAll('.menu__list li').forEach(function (li, i) {
        li.style.transitionDelay = (open ? i * 55 : 0) + 'ms';
      });
    }

    burger.addEventListener('click', function () {
      setMenu(menu.getAttribute('aria-hidden') === 'true');
    });

    document.querySelectorAll('[data-nav]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id.charAt(0) !== '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        setMenu(false);
        setTimeout(function () {
          target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        }, 180);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.getAttribute('aria-hidden') === 'false') setMenu(false);
    });

    /* ---------------- 8. Visibility — pause rendering off-tab ---------------- */
    document.addEventListener('visibilitychange', function () {
      if (!scene) return;
      if (document.hidden) scene.stop();
      else scene.start();
    });

    /* ---------------- 9. Context loss safety ---------------- */
    var canvas = $('#gl');
    if (canvas) {
      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        if (scene) scene.stop();
      });
      canvas.addEventListener('webglcontextrestored', function () {
        if (scene) scene.start();
      });
    }
  });
})();
