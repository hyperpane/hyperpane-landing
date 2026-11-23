// The landing's live parts: the stage (the real app's windows fly in, tilt
// flat as the page scrolls, and move by dragging), Roles (each role's
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
      };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
      addEventListener('resize', tilt);
      tilt();
    }

    // Windows move by dragging, in the canvas's bounds, and come forward.
    const canvas = stage.querySelector('[data-canvas]');
    const wins = [...canvas.querySelectorAll('.dw')];
    let top = 10;
    for (const w of wins) {
      let start = null;
      w.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const c = canvas.getBoundingClientRect();
        const r = w.getBoundingClientRect();
        start = {
          x: e.clientX, y: e.clientY,
          dx: parseFloat(w.style.getPropertyValue('--dx')) || 0,
          dy: parseFloat(w.style.getPropertyValue('--dy')) || 0,
          // How far it may go each way, in px.
          minX: c.left - r.left, maxX: c.right - r.right,
          minY: c.top - r.top, maxY: c.bottom - r.bottom - 0,
        };
        for (const o of wins) o.classList.toggle('is-focus', o === w);
        w.style.zIndex = String(++top);
        w.classList.add('is-drag');
        w.setPointerCapture(e.pointerId);
      });
      w.addEventListener('pointermove', (e) => {
        if (!start) return;
        const mx = clamp(e.clientX - start.x, start.minX, start.maxX);
        const my = clamp(e.clientY - start.y, start.minY, start.maxY);
        w.style.setProperty('--dx', `${start.dx + mx}px`);
        w.style.setProperty('--dy', `${start.dy + my}px`);
        if (Math.abs(mx) + Math.abs(my) > 6) stage.classList.add('was-dragged');
      });
      const end = () => { start = null; w.classList.remove('is-drag'); };
      w.addEventListener('pointerup', end);
      w.addEventListener('pointercancel', end);
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

  // Always on: the app closes, the server keeps going, the app comes back --
  const scene = document.querySelector('[data-detach]');
  if (scene) {
    const log = scene.querySelector('[data-log]');
    const meter = scene.querySelector('[data-meter]');
    const uptime = scene.querySelector('[data-uptime]');
    const state = scene.querySelector('[data-app-state]');
    const caption = scene.querySelector('[data-caption]');
    const lines = [
      '<i>$</i> npm run build',
      'vite v7.1.4 building for production…',
      'transforming (184) src/routes/orders.ts',
      'transforming (412) src/server.ts',
      '<b>✓</b> 412 modules transformed.',
      'rendering chunks (12)…',
      'computing gzip size…',
      'dist/server.js   48.21 kB │ gzip: 14.02 kB',
      '<i>$</i> npm test',
      '<b>✓</b> orders › creates an order (12 ms)',
      '<b>✓</b> products › lists products (8 ms)',
      '<b>✓</b> health › answers ok (2 ms)',
      'Tests  <b>24 passed</b> (24)',
      '<b>✓</b> built in 41.8s',
    ];
    let step = 0;
    let seconds = 0;
    let running = false;
    let tick = null;
    const phase = (p, text, label) => {
      scene.dataset.phase = p;
      caption.style.opacity = '0';
      setTimeout(() => { caption.textContent = text; caption.style.opacity = '1'; }, 200);
      state.textContent = label;
    };
    const add = () => {
      const span = document.createElement('span');
      span.innerHTML = lines[step % lines.length];
      log.append(span);
      while (log.children.length > 9) log.firstElementChild.remove();
      meter.style.width = `${((step % lines.length) + 1) / lines.length * 100}%`;
      step++;
      if (step % lines.length === 3) phase('closed', 'You quit hyperpane. The build doesn’t notice.', 'App closed');
      if (step % lines.length === 0) {
        phase('open', 'Open it again: same windows, with everything they printed meanwhile.', 'App open');
        setTimeout(() => { log.textContent = ''; }, 2600);
      }
    };
    const loop = () => {
      seconds += 7;
      const m = Math.floor(seconds / 60);
      uptime.textContent = `running · ${m}:${String(seconds % 60).padStart(2, '0')}`;
      add();
    };
    const start = () => { if (running) return; running = true; phase('open', 'The app is open: the build runs on your server.', 'App open'); tick = setInterval(loop, reduce ? 2200 : 1300); loop(); };
    const pause = () => { running = false; clearInterval(tick); };
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
