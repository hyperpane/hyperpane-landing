// The agent in the corner: the hyperpane cat, going through its states one
// after another (idle, working, thinking, waiting, blocked, done) and round
// again. Its animation (public/agent.json) has a marker per state; the player
// loads once the page is idle, so it never holds up the first paint.
const box = document.querySelector('[data-agent]');
if (box) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const start = async () => {
    const [{ default: lottie }, data] = await Promise.all([
      import('lottie-web/build/player/lottie_light'),
      fetch('/agent.json').then((r) => r.json()),
    ]);
    const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: false, animationData: data });
    const states = data.markers.map((m) => ({ name: m.cm, from: m.tm, to: m.tm + m.dr, secs: m.dr / data.fr }));
    anim.addEventListener('DOMLoaded', () => {
      box.classList.add('is-on');
      if (still) { anim.goToAndStop(states[0].from, true); return; }
      let i = 0;
      const next = () => {
        const s = states[i];
        box.dataset.state = s.name;
        anim.playSegments([s.from, s.to], true);
        // each state plays its loop twice (at least ~3 s), then the next one
        setTimeout(() => { i = (i + 1) % states.length; next(); }, Math.max(3000, s.secs * 2000));
      };
      next();
    });
  };
  ('requestIdleCallback' in window ? requestIdleCallback : setTimeout)(start, { timeout: 2000 });
}
