// Every page: the header (its ground once the page scrolls, the menu on a
// phone) and things that rise into view as they come.

(() => {
  'use strict';
  document.documentElement.classList.remove('no-js');

  const header = document.querySelector('[data-header]');
  if (header) {
    const onScroll = () => header.toggleAttribute('data-scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const menu = header.querySelector('[data-menu]');
    const set = (open) => {
      header.toggleAttribute('data-open', open);
      menu?.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menu?.addEventListener('click', () => set(!header.hasAttribute('data-open')));
    addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
    document.querySelectorAll('.sheet a').forEach((a) => a.addEventListener('click', () => set(false)));
    matchMedia('(min-width: 861px)').addEventListener('change', (e) => e.matches && set(false));
  }

  const items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    items.forEach((el) => io.observe(el));
  } else items.forEach((el) => el.classList.add('is-in'));
})();
