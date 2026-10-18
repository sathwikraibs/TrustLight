// TrustLight opening animation. A separate file because the site's security policy (CSP) blocks
// scripts written inside the page.
// Play the opening once per app launch, only on the home page (never when something was shared to TrustLight)
(function () {
  var el = document.getElementById('tl-intro');
  if (!el) return;
  try {
    var p = location.pathname, q = location.search;
    if ((p !== '/' && p !== '/index.html') || /shared|reinstall/.test(q) || sessionStorage.getItem('tl-intro')) { el.remove(); return; }
    sessionStorage.setItem('tl-intro', '1');
  } catch (e) { /* storage blocked: just play it */ }
  // Never show it unstyled: only when intro.css has really loaded (otherwise it would sit on the page as a big picture)
  if (getComputedStyle(el).position !== 'fixed') { el.remove(); return; }
  el.hidden = false;
  var root = document.documentElement;
  root.classList.add('tl-intro-on');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var start = Date.now(), least = reduced ? 900 : 2900;
  function ready() { var r = document.getElementById('root'); return r && r.childElementCount > 0; }
  (function wait() {
    var t = Date.now() - start;
    if ((t >= least && ready()) || t > 8000) {       // the page is ready, or it's taking too long: open anyway
      root.classList.remove('tl-intro-on');
      root.classList.add('tl-reveal');
      el.classList.add('tl-out');
      setTimeout(function () { el.remove(); root.classList.remove('tl-reveal'); }, 800);
    } else setTimeout(wait, 50);
  })();
})();
