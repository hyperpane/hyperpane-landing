// hyperpane landing: the top bar's hairline once the page scrolls, and which
// download is this computer's. Nothing else on the page moves.

(() => {
  'use strict';

  const topbar = document.querySelector('[data-topbar]');
  const onScroll = () => topbar.toggleAttribute('data-scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const ipad = /Mac/i.test(platform) && navigator.maxTouchPoints > 1;
  let os = null;
  if (/Mac/i.test(platform) && !ipad) os = 'mac';
  else if (/Win/i.test(platform)) os = 'win';
  else if (/Linux/i.test(platform) && !/Android/i.test(navigator.userAgent)) os = 'linux';

  const row = os && document.querySelector(`.platform[data-os="${os}"] .platform-name`);
  if (row) {
    const tag = document.createElement('span');
    tag.className = 'this-computer';
    tag.textContent = 'This computer';
    row.append(tag);
  }
})();
