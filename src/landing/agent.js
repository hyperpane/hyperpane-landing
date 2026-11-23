// The agent in the corner: the hyperpane cat (public/hyperpane-cat.js, a
// <hyperpane-cat> element) going through its states one after another, each
// blending into the next, and round again. The element's script loads once
// the page is idle, so it never holds up the first paint.
const box = document.querySelector('[data-agent]');
if (box) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = () => {
    const s = document.createElement('script');
    s.src = '/hyperpane-cat.js';
    s.async = true;
    s.onload = () => {
      const cat = document.createElement('hyperpane-cat');
      cat.setAttribute('color', '#fff');
      cat.setAttribute('blend', '420');
      box.append(cat);
      requestAnimationFrame(() => box.classList.add('is-on'));
      if (still) return;
      const states = customElements.get('hyperpane-cat').states;
      let i = 0;
      // each state stays long enough to read: two of its loops, 2.4 to 5 s
      const loop = { idle: 4, working: 1.6, thinking: 2.4, waiting: 3, blocked: 2, done: 2, listening: 2, speaking: 1.2, searching: 3.2, reading: 2, sleeping: 4, surprised: 2, confused: 2.4, sad: 3, celebrating: 2, hello: 2 };
      const next = () => {
        cat.state = states[i];
        box.dataset.state = states[i];
        const secs = Math.min(5, Math.max(2.4, (loop[states[i]] ?? 2) * 2));
        i = (i + 1) % states.length;
        setTimeout(next, secs * 1000);
      };
      next();
    };
    document.head.append(s);
  };
  ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(start, { timeout: 2000 });
}
