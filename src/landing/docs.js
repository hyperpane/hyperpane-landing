// The docs: the contents open on a phone; "On this page" from the page's
// headings, the one you're reading lit; a copy button on code.

(() => {
  'use strict';
  const toggle = document.querySelector('[data-docs-toggle]');
  const side = document.querySelector('[data-docs-nav]');
  toggle?.addEventListener('click', () => {
    const open = !document.body.hasAttribute('data-docs-open');
    document.body.toggleAttribute('data-docs-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  side?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => document.body.removeAttribute('data-docs-open')));
  // The page you're on, in view in the contents.
  side?.querySelector('.is-on')?.scrollIntoView({ block: 'center' });

  const toc = document.querySelector('[data-toc]');
  const heads = [...document.querySelectorAll('.prose h2[id], .prose h3[id]')];
  if (toc && heads.length) {
    for (const h of heads) {
      const a = document.createElement('a');
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      if (h.tagName === 'H3') a.className = 'is-sub';
      toc.append(a);
    }
    const links = [...toc.querySelectorAll('a')];
    const light = () => {
      let i = 0;
      heads.forEach((h, n) => { if (h.getBoundingClientRect().top < 140) i = n; });
      links.forEach((a, n) => a.classList.toggle('is-on', n === i));
    };
    addEventListener('scroll', light, { passive: true });
    light();
  } else toc?.closest('.dtoc')?.remove();

  for (const pre of document.querySelectorAll('.prose pre')) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'copy';
    b.textContent = 'Copy';
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? pre.innerText);
        b.textContent = 'Copied';
        setTimeout(() => { b.textContent = 'Copy'; }, 1400);
      } catch {}
    });
    pre.append(b);
  }
})();
