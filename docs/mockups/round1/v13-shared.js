/* v13 shared: mock bar, theme, icon sprite, shell (rail + phone tabs). Mockup scaffolding only. */
(function () {
  const ICONS = {
    now: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M16 13h.01"/>',
    plan: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    salary: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    budget: '<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    fund: '<path d="M4 10 12 4l8 6"/><path d="M5 10v9M10 10v9M14 10v9M19 10v9M3 19h18"/>',
    forecast: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
    skip: '<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    bank: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  };
  window.icon = (n, cls) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>';

  const html = document.documentElement;
  const hashTheme = () => (/light/.test(location.hash) ? 'light' : /dark/.test(location.hash) ? 'dark' : null);
  let saved = null; try { saved = localStorage.getItem('v13theme'); } catch (e) {}
  const sys = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  const setTheme = (t) => { html.dataset.theme = t; document.querySelectorAll('.mockbar .t button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === t)); document.dispatchEvent(new Event('themechange')); };
  html.dataset.theme = hashTheme() || saved || sys;
  addEventListener('hashchange', () => { const t = hashTheme(); if (t) setTheme(t); });

  const NAV = [
    ['Today', [['now', 'Now', 'v13-now-a.html', 'now'], ['inbox', 'Inbox', 'v13-inbox.html', 'inbox', 4], ['accounts', 'Accounts', 'v13-accounts.html', 'wallet']]],
    ['Plan', [['salary', 'Salary path', 'v13-salary.html', 'salary'], ['budget', 'Budget', 'v13-budget.html', 'budget'], ['bonus', 'Bonuses', 'v13-bonus.html', 'gift'], ['funds', 'Funds', 'v13-funds.html', 'fund'], ['forecast', 'Forecast', 'v13-forecast-a.html', 'forecast']]],
  ];
  const PLAN = ['salary', 'budget', 'bonus', 'funds', 'forecast'];

  document.addEventListener('DOMContentLoaded', () => {
    const b = document.body, cur = b.dataset.nav, title = document.title;
    const bar = document.createElement('div'); bar.className = 'mockbar';
    bar.innerHTML = '<a href="v13-gallery.html">← Gallery</a><span class="nm">' + title + '</span><span class="t" role="group" aria-label="Theme"><button data-t="dark">Dark</button><button data-t="light">Light</button></span>';
    b.prepend(bar);
    bar.querySelectorAll('button').forEach((x) => x.addEventListener('click', () => { setTheme(x.dataset.t); try { localStorage.setItem('v13theme', x.dataset.t); } catch (e) {} }));
    setTheme(html.dataset.theme);
    const main = document.querySelector('main'); if (!main) return;
    main.classList.add('main');
    const app = document.createElement('div'); app.className = 'app';
    let rail = '<nav class="rail" aria-label="Main"><div class="logo"><span class="pip" style="width:30px;height:30px"></span>Bad(yet)</div>';
    NAV.forEach(([g, items]) => {
      rail += '<div class="grp">' + g + '</div>';
      items.forEach(([k, l, href, ic, n]) => { rail += '<a href="' + href + '"' + (cur === k ? ' aria-current="page"' : '') + '>' + icon(ic) + l + (n ? '<span class="badge" aria-label="' + n + ' pending">' + n + '</span>' : '') + '</a>'; });
    });
    rail += '<div class="foot"><a href="v13-settings.html"' + (cur === 'settings' ? ' aria-current="page"' : '') + '>' + icon('settings') + 'Settings</a></div></nav>';
    const tab = (k, l, href, ic, n, add) => '<a href="' + href + '"' + (cur === k || (k === 'plan' && PLAN.includes(cur)) ? ' aria-current="page"' : '') + (add ? ' class="add"' : '') + '>' + (add ? '<span class="fab">' + icon('plus') + '</span><span class="sr">' + l + '</span>' : icon(ic) + l) + (n ? '<span class="badge">' + n + '</span>' : '') + '</a>';
    const tabs = '<nav class="tabs" aria-label="Main tabs">' + tab('now', 'Now', 'v13-now-a.html', 'now') + tab('inbox', 'Inbox', 'v13-inbox.html', 'inbox', 4) + tab('add', 'Quick add', 'v13-inbox.html#add', 'plus', 0, true) + tab('accounts', 'Accounts', 'v13-accounts.html', 'wallet') + tab('plan', 'Plan', 'v13-budget.html', 'plan') + '</nav>';
    main.before(app); app.innerHTML = rail; app.appendChild(main); b.appendChild(Object.assign(document.createElement('div'), { innerHTML: tabs }).firstChild);
    if (PLAN.includes(cur)) {
      const sn = document.createElement('nav'); sn.className = 'subnav'; sn.setAttribute('aria-label', 'Plan sections');
      sn.innerHTML = NAV[1][1].map(([k, l, href]) => '<a href="' + href + '"' + (cur === k ? ' aria-current="page"' : '') + '>' + l + '</a>').join('');
      main.prepend(sn);
    }
  });

  /* generic helpers */
  window.$ = (s, r) => (r || document).querySelector(s);
  window.$$ = (s, r) => [...(r || document).querySelectorAll(s)];
  window.seg = (root, cb) => { root.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; root.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); cb(b.dataset.v, b); }); };
  window.toggleChk = (el) => { const on = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', on); return on; };
  window.CHECK = icon('check');
})();
