// The landing's live parts: the hero's canvas (windows move by their header,
// come to the front when touched, fill the canvas on a double-click) and Roles (a role shows its windows; they turn
// over on their own until someone picks one).

(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The canvas ---------------------------------------------------------------
  const canvas = document.querySelector('[data-canvas]');
  if (canvas) {
    const wins = [...canvas.querySelectorAll(':scope > .win')];
    let top = 10;
    const focus = (w) => {
      for (const o of wins) o.classList.toggle('is-focused', o === w);
      w.style.zIndex = String(++top);
    };
    for (const w of wins) {
      const head = w.querySelector('.win-head');
      let start = null;
      w.addEventListener('pointerdown', () => focus(w));
      head.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || w.classList.contains('is-max')) return;
        const [x, y] = (w.style.translate || '0px 0px').split(' ').map((v) => parseFloat(v) || 0);
        // Anywhere on the canvas, its whole width, and up over the hero's
        // words to the header.
        const box = (canvas.closest('.shot-cell') ?? canvas).getBoundingClientRect();
        const hero = canvas.closest('.band-hero')?.getBoundingClientRect();
        const header = document.querySelector('[data-topbar]')?.getBoundingClientRect().bottom ?? 0;
        const ceiling = hero ? Math.max(hero.top, header) : box.top;
        const r = w.getBoundingClientRect();
        // Kept inside the canvas: at least its header stays in reach.
        start = { px: e.clientX, py: e.clientY, x, y, minX: x + box.left - r.left, maxX: x + box.right - r.right, minY: y + Math.min(ceiling, box.top) - r.top, maxY: y + box.bottom - r.top - 32 };
        head.setPointerCapture(e.pointerId);
        w.classList.add('is-dragging');
        e.preventDefault();
      });
      head.addEventListener('pointermove', (e) => {
        if (!start) return;
        const clamp = (v, lo, hi) => Math.min(Math.max(v, Math.min(lo, hi)), Math.max(lo, hi));
        const x = clamp(start.x + e.clientX - start.px, start.minX, start.maxX);
        const y = clamp(start.y + e.clientY - start.py, start.minY, start.maxY);
        w.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
      });
      const end = () => {
        start = null;
        w.classList.remove('is-dragging');
      };
      head.addEventListener('pointerup', end);
      head.addEventListener('lostpointercapture', end);
      head.addEventListener('dblclick', () => {
        focus(w);
        w.classList.toggle('is-max');
      });
    }

  }

  // Roles --------------------------------------------------------------------
  const roles = document.querySelector('[data-roles]');
  if (roles) {
    const tabs = [...roles.querySelectorAll('[role="tab"]')];
    const show = (tab) => {
      for (const t of tabs) {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls'))?.classList.toggle('is-active', on);
      }
    };
    let timer = null;
    const stop = () => {
      clearInterval(timer);
      timer = null;
    };
    for (const t of tabs) {
      t.addEventListener('click', () => {
        stop();
        show(t);
      });
      t.addEventListener('mouseenter', () => {
        stop();
        show(t);
      });
      t.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(t);
        const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length] : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length] : null;
        if (!next) return;
        e.preventDefault();
        stop();
        show(next);
        next.focus();
      });
    }
    show(tabs[0]);
    // Turning over on their own, while it's in view and nobody's picked one.
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !timer && roles.dataset.picked !== '1') {
          timer = setInterval(() => {
            const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
            show(tabs[(i + 1) % tabs.length]);
          }, 4000);
        } else if (!e.isIntersecting) stop();
      }, { threshold: 0.4 }).observe(roles);
      roles.addEventListener('pointerenter', () => (roles.dataset.picked = '1'), { once: true });
    }
  }
})();

// Cards: the light under the pointer follows it.
for (const card of document.querySelectorAll('.mini:not(.mini-soon), .facts-row li')) {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}
