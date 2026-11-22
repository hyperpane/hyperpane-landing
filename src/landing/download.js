// The download manager: a system picked by its logo shows its files; this
// computer's system is picked first (or ?os=), and the file for it, its chip
// when the browser says, is marked Recommended and put first.

(() => {
  'use strict';
  const box = document.querySelector('[data-dl]');
  if (!box) return;
  const lists = [...box.querySelectorAll('[data-files]')];

  const ua = navigator.userAgentData;
  const plat = (ua && ua.platform) || navigator.platform || '';
  const ipad = /Mac/i.test(plat) && navigator.maxTouchPoints > 1;
  const mine = /Mac/i.test(plat) && !ipad ? 'mac' : /Win/i.test(plat) ? 'win' : /Linux/i.test(plat) && !/Android/i.test(navigator.userAgent) ? 'linux' : null;
  // The chip: Apple silicon and x64 unless the browser says otherwise.
  let arch = { mac: 'arm64', win: 'x64', linux: 'x64' };

  const show = () => {
    const os = box.querySelector('input[name="os"]:checked')?.value;
    for (const l of lists) l.hidden = l.dataset.files !== os;
  };
  const recommend = () => {
    if (!mine) return;
    const list = lists.find((l) => l.dataset.files === mine);
    if (!list) return;
    const rows = [...list.children];
    const best = rows.find((r) => r.dataset.arch === arch[mine] && r.hasAttribute('data-first'));
    if (!best) return;
    // Only the recommended file's button is the white one.
    for (const r of rows) {
      const on = r === best;
      r.querySelector('.dlm-rec').hidden = !on;
      r.querySelector('.dlm-btn').classList.toggle('btn-primary', on);
      r.querySelector('.dlm-btn').classList.toggle('btn-secondary', !on);
    }
    list.prepend(best);
  };

  if (mine) box.querySelector(`.dlm-os[data-os="${mine}"] .dlm-mine`)?.removeAttribute('hidden');
  const asked = new URLSearchParams(location.search).get('os');
  const start = lists.some((l) => l.dataset.files === asked) ? asked : mine;
  if (start) box.querySelector(`input[name="os"][value="${start}"]`).checked = true;
  recommend();
  show();
  ua?.getHighEntropyValues?.(['architecture']).then((v) => {
    if (v.architecture === 'x86') arch = { ...arch, mac: 'x64' };
    if (v.architecture === 'arm') arch = { ...arch, linux: 'arm64', win: 'x64' };
    recommend();
  }).catch(() => {});

  box.addEventListener('change', show);
})();
