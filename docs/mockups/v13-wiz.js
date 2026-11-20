/* v13 wizard scaffold: steps on the left, a live payslip on the right. Mockup only. */
window.Wiz = function (c) {
  const root = c.root, S = c.S, n = c.steps.length; let i = c.start || 0;
  const st = () => c.steps[i];
  function shell() {
    root.innerHTML = '<div class="wz"><div class="wzhead"><div class="logo"><span class="pip" style="width:30px;height:30px"></span>' + c.title + '</div><ol class="steps" aria-label="Steps">' +
      c.steps.map((s, k) => '<li class="' + (k < i ? 'done' : '') + '" ' + (k === i ? 'aria-current="step"' : '') + '><span class="st"><b>' + (k < i ? CHECK : k + 1) + '</b><span class="tx">' + s.label + '</span></span></li>').join('') +
      '</ol><a class="btn ghost" href="' + c.close + '">Close</a></div><div class="wzgrid"><section class="card wzcard" aria-labelledby="wzt"><div class="lbl">Step ' + (i + 1) + ' of ' + n + '</div><h1 id="wzt" tabindex="-1" style="margin:4px 0 6px">' + st().title + '</h1><p class="muted" style="margin:0 0 18px">' + (st().sub || '') + '</p><div id="wzb"></div>' +
      (st().final ? '' : '<div class="wzfoot">' + (i > 0 ? '<button class="btn" id="wzback">Back</button>' : '') + '<span class="gap"></span>' + (st().skip ? '<button class="btn ghost" id="wzskip">Skip for now</button>' : '') + '<button class="btn pri" id="wzn">' + (st().next || 'Next') + '</button></div>') +
      '</section><aside class="wzslip" id="wzs" aria-live="polite" aria-label="Live preview"></aside></div></div>';
    body(); slip(); upd();
    const bk = root.querySelector('#wzback'); if (bk) bk.onclick = () => go(i - 1);
    const nx = root.querySelector('#wzn'); if (nx) nx.onclick = () => go(i + 1);
    const sk = root.querySelector('#wzskip'); if (sk) sk.onclick = () => go(i + 1);
  }
  function body() { const b = root.querySelector('#wzb'); b.innerHTML = st().body(S); if (st().bind) st().bind(b, S, api); }
  function slip() { root.querySelector('#wzs').innerHTML = c.slip(S, i); }
  function upd() { const nx = root.querySelector('#wzn'); if (nx) { const ok = st().ok ? st().ok(S) : true; nx.disabled = !ok; nx.style.opacity = ok ? '' : '.5'; } }
  function go(k) { if (k < 0 || k >= n) return; i = k; shell(); scrollTo(0, 0); root.querySelector('#wzt').focus(); }
  const api = { S, go, next: () => go(i + 1), slip, upd, redo() { const a = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null; body(); slip(); upd(); if (a) { const e = root.querySelector('[data-k="' + a + '"]'); if (e) e.focus(); } } };
  root.addEventListener('input', onIn); root.addEventListener('change', onIn);
  function onIn(e) {
    const t = e.target, k = t.dataset && t.dataset.k; if (!k) return;
    if (t.type === 'radio' && e.type === 'input') return;
    S[k] = t.type === 'checkbox' ? t.checked : t.dataset.n !== undefined ? (parseFloat(t.value) || 0) : t.value;
    if (st().onchange) st().onchange(S, t, api);
    slip(); upd();
  }
  shell(); return api;
};
