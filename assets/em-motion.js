/* Eichler Market — shared motion engine for static pages (homepage, how-it-works, make-me-move)
 * Vanilla JS, no deps. Injects its own CSS. Honors prefers-reduced-motion.
 * Hooks (add these attributes in markup):
 *   [data-reveal]              — container; on scroll-in, adds .is-in (children animate in, staggered)
 *   [data-reveal-child]        — child of a [data-reveal]; fades/slides up with stagger
 *   [data-reveal-self]         — element animates itself on scroll-in
 *   [data-count="1768"]        — number counts 0->target on scroll-in
 *        data-prefix="$"  data-suffix="/sf"  data-comma="1"  data-dec="1"
 *   [data-tw]                  — typewriter the element's text on scroll-in (gold caret)
 *   [data-parallax="0.15"]     — element drifts on scroll (hero photo); value = speed factor
 */
(function () {
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  // ---- CSS ----
  var css = ''
    + '[data-reveal-child]{opacity:0;transform:translateY(18px);transition:opacity .6s cubic-bezier(.2,.6,.2,1),transform .6s cubic-bezier(.2,.6,.2,1)}'
    + '[data-reveal].is-in [data-reveal-child]{opacity:1;transform:none}'
    + '[data-reveal].is-in [data-reveal-child]:nth-child(2){transition-delay:.07s}'
    + '[data-reveal].is-in [data-reveal-child]:nth-child(3){transition-delay:.14s}'
    + '[data-reveal].is-in [data-reveal-child]:nth-child(4){transition-delay:.21s}'
    + '[data-reveal].is-in [data-reveal-child]:nth-child(5){transition-delay:.28s}'
    + '[data-reveal].is-in [data-reveal-child]:nth-child(6){transition-delay:.35s}'
    + '[data-reveal-self]{opacity:0;transform:translateY(22px);transition:opacity .65s cubic-bezier(.2,.6,.2,1),transform .65s cubic-bezier(.2,.6,.2,1)}'
    + '[data-reveal-self].is-in{opacity:1;transform:none}'
    + '.em-tw-caret{display:inline-block;width:.06em;background:#c8a96e;margin-left:.04em;animation:em-tw-blink .9s steps(1) infinite;vertical-align:baseline}'
    + '@keyframes em-tw-blink{50%{opacity:0}}'
    + '@media(prefers-reduced-motion:reduce){'
    + '  [data-reveal-child],[data-reveal-self]{opacity:1!important;transform:none!important;transition:none!important}'
    + '  .em-tw-caret{display:none}'
    + '}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---- Animated counter ----
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var comma = el.getAttribute('data-comma') === '1';
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    function fmt(v) { return prefix + (comma ? Math.round(v).toLocaleString() : v.toFixed(dec)) + suffix; }
    if (RM) { el.textContent = fmt(target); return; }
    var dur = 1500, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  // ---- Typewriter ----
  function typewrite(el) {
    var full = el.getAttribute('data-tw-text') || el.textContent;
    el.setAttribute('data-tw-text', full);
    if (RM) { el.textContent = full; return; }
    el.textContent = '';
    var caret = document.createElement('span'); caret.className = 'em-tw-caret'; caret.textContent = '\u00A0';
    el.appendChild(caret);
    var i = 0, speed = 30;
    (function tick() {
      if (i <= full.length) {
        el.textContent = full.slice(0, i);
        el.appendChild(caret);
        i++; setTimeout(tick, speed);
      } else {
        setTimeout(function () { if (caret.parentNode) caret.parentNode.removeChild(caret); }, 700);
      }
    })();
  }

  function onIn(el) {
    el.classList.add('is-in');
    el.querySelectorAll('[data-count]').forEach(function (c) { if (!c.__counted) { c.__counted = 1; animateCount(c); } });
    el.querySelectorAll('[data-tw]').forEach(function (t) { if (!t.__tw) { t.__tw = 1; typewrite(t); } });
    if (el.hasAttribute('data-count') && !el.__counted) { el.__counted = 1; animateCount(el); }
    if (el.hasAttribute('data-tw') && !el.__tw) { el.__tw = 1; typewrite(el); }
  }

  function initReveals() {
    var nodes = document.querySelectorAll('[data-reveal],[data-reveal-self],[data-count],[data-tw]');
    if (!('IntersectionObserver' in window)) { nodes.forEach(onIn); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { onIn(en.target); io.unobserve(en.target); } });
    }, { threshold: .14, rootMargin: '-40px 0px' });
    nodes.forEach(function (el) {
      // avoid double-observing a counter that's inside an already-observed [data-reveal]
      if ((el.hasAttribute('data-count') || el.hasAttribute('data-tw')) && el.closest('[data-reveal]')) return;
      io.observe(el);
    });
    // Above-the-fold hero: reveal immediately so it never starts hidden
    setTimeout(function () {
      document.querySelectorAll('.hero [data-reveal],.hero[data-reveal],.mms-hero [data-reveal],.mms-hero[data-reveal]').forEach(function (el) {
        if (!el.classList.contains('is-in')) onIn(el);
      });
    }, 90);
  }

  // ---- Parallax drift (bolder-than-community extra) ----
  function initParallax() {
    if (RM) return;
    var els = [].slice.call(document.querySelectorAll('[data-parallax]'));
    if (!els.length) return;
    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
        var r = el.getBoundingClientRect();
        // only when roughly in view
        if (r.bottom < -200 || r.top > vh + 200) return;
        var mid = r.top + r.height / 2;
        var off = (mid - vh / 2) * -speed;
        el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0) scale(1.06)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  function boot() { initReveals(); initParallax(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
