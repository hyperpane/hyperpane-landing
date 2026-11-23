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

  // Always on: the app closes, the server keeps building, the app comes back
  const scene = document.querySelector('[data-detach]');
  if (scene) {
    const prog = scene.querySelector('.prog');
    const state = scene.querySelector('[data-app-state]');
    const label = scene.querySelector('[data-uptime]');
    const caption = scene.querySelector('[data-caption]');
    let p = 0;
    let tick = null;
    const say = (text) => {
      caption.style.opacity = '0';
      setTimeout(() => { caption.textContent = text; caption.style.opacity = '1'; }, 200);
    };
    const set = (v) => {
      p = v;
      prog.style.strokeDashoffset = String(1 - p);
      label.textContent = `build · ${Math.round(p * 100)}%`;
    };
    const step = () => {
      if (p >= 1) {
        // A pause on the result, then again.
        scene.removeAttribute('data-done');
        set(0);
        scene.dataset.phase = 'open'; state.textContent = 'open';
        say('The app is open: the build runs on your server.');
        return;
      }
      set(Math.min(1, p + 0.08));
      if (p > 0.2 && p < 0.25) { scene.dataset.phase = 'closed'; state.textContent = 'closed'; say('You quit hyperpane. The build doesn’t notice.'); }
      if (p >= 1) { scene.dataset.phase = 'open'; scene.setAttribute('data-done', ''); state.textContent = 'open'; say('Open it again: same windows, with everything they printed meanwhile.'); }
    };
    const start = () => { if (tick) return; scene.dataset.phase = 'open'; say('The app is open: the build runs on your server.'); tick = setInterval(step, reduce ? 1600 : 700); };
    const pause = () => { clearInterval(tick); tick = null; };
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
})();
