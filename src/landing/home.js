// The landing's live parts: the stage (the real app's windows fly in and
// tilt flat as the page scrolls), Roles (each role's
// windows; they turn over on their own until someone picks one), the
// always-on scene, and the section dock.

(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // The stage ---------------------------------------------------------------
  const stage = document.querySelector('[data-stage]');
  if (stage) {
    requestAnimationFrame(() => setTimeout(() => stage.classList.add('is-in'), reduce ? 0 : 200));

    // Tilted back at first, flat as it comes up the page.
    if (!reduce) {
      let ticking = false;
      const tilt = () => {
        ticking = false;
        const r = stage.getBoundingClientRect();
        const t = clamp(1 - (r.top - innerHeight * 0.18) / (innerHeight * 0.6), 0, 1);
        stage.style.setProperty('--tilt', `${(1 - t) * 16}deg`);
        stage.style.setProperty('--sc', String(0.94 + t * 0.06));
        stage.style.setProperty('--lift', `${(1 - t) * 20}px`);
        // Flat, it's no layer of its own: the captures stay sharp.
        stage.classList.toggle('is-flat', t >= 0.999);
      };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
      addEventListener('resize', tilt);
      tilt();
    }

  }

  // Roles -------------------------------------------------------------------
  const roles = document.querySelector('[data-roles]');
  if (roles) {
    const tabs = [...roles.querySelectorAll('[role="tab"]')];
    const sets = [...roles.querySelectorAll('[data-set]')];
    let timer = null;
    let index = 0;
    const show = (i, user = false) => {
      index = (i + tabs.length) % tabs.length;
      tabs.forEach((t, n) => {
        t.setAttribute('aria-selected', String(n === index));
        t.tabIndex = n === index ? 0 : -1;
      });
      const id = tabs[index].dataset.role;
      for (const s of sets) {
        const on = s.dataset.set === id;
        s.toggleAttribute('data-on', on);
        s.setAttribute('aria-hidden', String(!on));
      }
      if (user) stop();
      else restart();
    };
    const stop = () => { clearTimeout(timer); timer = null; roles.classList.remove('is-playing'); };
    const restart = () => {
      if (reduce) return;
      clearTimeout(timer);
      roles.classList.remove('is-playing');
      void roles.offsetWidth;
      roles.classList.add('is-playing');
      timer = setTimeout(() => show(index + 1), 6000);
    };
    tabs.forEach((t, n) => {
      t.addEventListener('click', () => show(n, true));
      t.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        show(index + step, true);
        tabs[index].focus();
      });
    });
    // Turns over only while it's in view.
    new IntersectionObserver(([e]) => (e.isIntersecting ? timer === null && !roles.dataset.picked && restart() : stop()), { threshold: 0.35 }).observe(roles);
    roles.addEventListener('click', () => { roles.dataset.picked = '1'; });
  }

  // Plugins' drawings start as they come into view (data-reveal adds is-in).

  // Always on: the lid closes, the server keeps building and queues what the
  // laptop misses, the lid opens and it all comes over.
  const scene = document.querySelector('[data-detach]');
  if (scene) {
    const frames = [...scene.querySelectorAll('.lid-f')];
    const cells = [...scene.querySelectorAll('.srv-cell')];
    const queue = [...scene.querySelectorAll('.srv-q')];
    const caption = scene.querySelector('[data-caption]');
    const say = (text) => {
      caption.style.opacity = '0';
      setTimeout(() => { caption.textContent = text; caption.style.opacity = '1'; }, 200);
    };
    let shown = frames.length - 1;
    const show = (i) => { frames[shown].style.display = 'none'; frames[i].style.display = ''; shown = i; };
    let timers = [];
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    // the lid swings through its frames, easing in and out
    const swing = (to, ms = 520) => {
      const from = shown;
      const t0 = performance.now();
      const go = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        show(Math.round(from + (to - from) * e));
        if (t < 1) requestAnimationFrame(go);
      };
      requestAnimationFrame(go);
    };
    const progress = (p) => cells.forEach((c, i) => c.classList.toggle('on', i < Math.round(p / 10)));
    const queued = (n) => queue.forEach((q, i) => q.classList.toggle('on', i < n));
    const phase = (ph, text) => { scene.dataset.phase = ph; if (text) say(text); };
    let p = 0;
    let bar = null;
    const run = () => {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(bar);
      p = 0; progress(0); queued(0); show(frames.length - 1);
      phase('open', 'The app is open: the build runs on your server, its output on your screen.');
      bar = setInterval(() => { p = Math.min(100, p + 1); progress(p); }, 95);
      later(2400, () => { swing(0); phase('closed', 'You close the laptop. The build doesn\u2019t notice.'); });
      later(3600, () => queued(1));
      later(4800, () => queued(2));
      later(6000, () => queued(3));
      later(6800, () => { swing(frames.length - 1); queued(0); phase('sync', 'Open it again: everything it printed meanwhile comes over.'); });
      later(8200, () => phase('open'));
      later(9600, () => { clearInterval(bar); p = 100; progress(100); phase('done', 'Done: 24 tests passed while you were away.'); });
      later(12400, run);
    };
    const still = () => { show(frames.length - 1); progress(60); phase('open', 'The app is open: the build runs on your server, its output on your screen.'); };
    const start = () => { if (reduce) still(); else run(); };
    const pause = () => { timers.forEach(clearTimeout); timers = []; clearInterval(bar); };
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : pause()), { threshold: 0.3 }).observe(scene);
  }

  // The dock: shows past the hero; the section you're in is lit ---------------
  const dock = document.querySelector('[data-dock]');
  if (dock) {
    const hero = document.querySelector('.hero');
    const links = [...dock.querySelectorAll('[data-dock-to]')];
    const sections = links.map((a) => document.getElementById(a.dataset.dockTo));
    const footer = document.querySelector('.ftr');
    const update = () => {
      const past = hero.getBoundingClientRect().bottom < innerHeight * 0.4;
      const atEnd = footer && footer.getBoundingClientRect().top < innerHeight - 20;
      dock.classList.toggle('is-shown', past && !atEnd);
      let here = -1;
      sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * 0.45) here = i; });
      links.forEach((a, i) => a.classList.toggle('is-here', i === here));
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }

  // This computer's system, marked.
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const ipad = /Mac/i.test(plat) && navigator.maxTouchPoints > 1;
  const os = /Mac/i.test(plat) && !ipad ? 'mac' : /Win/i.test(plat) ? 'win' : /Linux/i.test(plat) && !/Android/i.test(navigator.userAgent) ? 'linux' : null;
  if (os) document.querySelector(`.get-systems [data-os="${os}"]`)?.classList.add('is-mine');

  // One swipe, one block. A block taller than the screen (the hero, the
  // plugins) scrolls normally until its edge, then the next swipe pages on.
  const paged = matchMedia('(min-width: 900px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)');
  const blocks = [...document.querySelectorAll('.hero, .roles, .windows, .always, .get, .ftr')];
  if (blocks.length) {
    let busy = false;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const glide = (to) => {
      const from = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      to = Math.max(0, Math.min(max, Math.round(to)));
      if (Math.abs(to - from) < 2) return;
      busy = true;
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto';
      const t0 = performance.now();
      const dur = 760;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        scrollTo(0, from + (to - from) * ease(t));
        if (t < 1) requestAnimationFrame(step);
        else { html.style.scrollBehavior = prev; busy = false; }
      };
      requestAnimationFrame(step);
    };
    // A swipe's momentum keeps sending wheel events after the jump; those are
    // eaten. A new swipe is told apart by a pause in the events or by the
    // deltas growing again instead of fading.
    let lastT = 0;
    let lastAbs = 0;
    let tail = false;
    addEventListener('wheel', (e) => {
      if (!paged.matches || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const now = performance.now();
      const abs = Math.abs(e.deltaY);
      const fresh = now - lastT > 90 || abs > lastAbs * 1.5 + 6;
      lastT = now;
      lastAbs = abs;
      if (busy) { e.preventDefault(); return; }
      if (tail && !fresh) { e.preventDefault(); return; }
      tail = false;
      const down = e.deltaY > 0;
      const vh = innerHeight;
      // the block that holds the middle of the screen
      const i = blocks.findIndex((b) => { const r = b.getBoundingClientRect(); return r.top <= vh / 2 && r.bottom > vh / 2; });
      if (i < 0) return;
      const r = blocks[i].getBoundingClientRect();
      // still more of this block to see: scroll it normally
      if (down && r.bottom > vh + 4) return;
      if (!down && r.top < -4) return;
      const j = i + (down ? 1 : -1);
      if (j < 0 || j >= blocks.length) return;
      const next = blocks[j];
      const top = next.getBoundingClientRect().top + scrollY;
      const tall = next.offsetHeight > vh + 4;
      // going up into a tall block lands on its end, not its start
      const to = down || !tall ? top : top + next.offsetHeight - vh;
      const max = document.documentElement.scrollHeight - vh;
      // nowhere to go (the page's end): let the browser have it
      if (Math.abs(Math.max(0, Math.min(max, to)) - scrollY) < 2) return;
      e.preventDefault();
      tail = true;
      glide(to);
    }, { passive: false });
  }
})();
