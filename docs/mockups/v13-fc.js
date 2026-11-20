/* v13 forecast helpers shared by the forecast and override mockups. Sample data only. */
(function () {
  const P = BY.peso, F = BY.FUNDS, MON = BY.MON;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const FC = (window.FC = {
    ov: clone(BY.OVERRIDES), scn: 'base',
    run(id) { return BY.simulate(id || FC.scn, FC.ov); },
    nice(max) { const st = [25e3, 50e3, 100e3, 250e3, 500e3].find((x) => max / x <= 5) || 1e6; return { mx: Math.ceil(max / st) * st, st }; },
    fund: (id) => F.find((f) => f.id === id),
    sel: (o) => (o && o.funds && o.funds.length ? F.filter((f) => o.funds.includes(f.id)) : F),
    k(n) { return n >= 1e6 ? '₱' + (n / 1e6).toFixed(2).replace(/0$/, '') + 'M' : '₱' + Math.round(n / 1000) + 'k'; },
    why(r, id) {
      const a = r.alloc[id], f = FC.fund(id);
      if (a.why === 'pinned') return 'You pinned ' + P(a.amt);
      if (a.why === 'skipped') return 'You skipped it';
      if (a.why === 'cap hit') return f.rule === 'reset' ? 'Yearly cap hit' : 'Cap hit, nothing needed';
      if (a.why === 'takes the rest') return 'Takes whatever is left';
      if (a.why === 'pool ran out') return 'Pool ran out';
      return 'Priority ' + (r.order.indexOf(id) + 1);
    },
    /* stacked area of fund balances. rows: simulate() output */
    area(rows, o) {
      o = o || {}; const F = FC.sel(o); const W = 720, H = o.h || 300, L = 56, R = 12, T = 16, B = 30, n = rows.length;
      const tot = rows.map((r) => F.reduce((s, f) => s + r.bal[f.id], 0)); const nm = FC.nice(Math.max(...tot)), mx = nm.mx;
      const x = (i) => L + (W - L - R) * i / (n - 1), y = (v) => T + (H - T - B) * (1 - v / mx);
      let s = '';
      for (let v = 0; v <= mx; v += nm.st) s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + FC.k(v) + '</text>';
      const ai = rows.findIndex((r) => r.assumed);
      if (ai > 0) s += '<rect x="' + x(ai) + '" y="' + T + '" width="' + (x(n - 1) - x(ai)) + '" height="' + (H - T - B) + '" style="fill:var(--soft)" opacity=".55"/><text x="' + (x(ai) + 6) + '" y="' + (T + 12) + '">Assumed raises</text>';
      let base = rows.map(() => 0);
      F.slice().reverse().forEach((f) => { /* bottom = last priority so priority 1 sits on top */
        const top = rows.map((r, i) => base[i] + r.bal[f.id]);
        const d = 'M' + rows.map((r, i) => x(i) + ' ' + y(top[i])).join(' L') + ' L' + rows.map((r, i) => x(n - 1 - i) + ' ' + y(base[n - 1 - i])).join(' L') + 'Z';
        s += '<path d="' + d + '" style="fill:' + f.color + '" fill-opacity=".85"/>';
        base = top;
      });
      s += '<path d="M' + tot.map((v, i) => x(i) + ' ' + y(v)).join(' L') + '" fill="none" style="stroke:var(--ink)" stroke-width="1.5"/>';
      rows.forEach((r, i) => { if (r.mo === 1) s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + (r.mo === 1 ? r.y : MON[r.mo - 1]) + '</text>'; });
      rows.forEach((r, i) => { if (r.over) s += '<path d="M' + x(i) + ' ' + (H - B - 2) + ' l-5 -9 h10z" style="fill:var(--ink)" stroke="none"><title>' + BY.ymLabel(r.ym) + ' has an override</title></path>'; });
      const bw = (W - L - R) / (n - 1);
      rows.forEach((r, i) => { s += '<rect class="hit" tabindex="0" role="button" data-ym="' + r.ym + '" x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" aria-label="' + BY.ymLabel(r.ym) + ', savings ' + P(tot[i]) + (r.over ? ', has an override' : '') + '"/>'; });
      if (o.sel) { const i = rows.findIndex((r) => r.ym === o.sel); if (i >= 0) s += '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + (H - B) + '" style="stroke:var(--ink)" stroke-width="2"/>'; }
      return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Fund balances, 60 months, stacked">' + s + '</svg>';
    },
    /* year bars: end-of-year balances */
    years(rows, o) {
      const F = FC.sel(o); const W = 720, H = o && o.h || 300, L = 56, R = 12, T = 16, B = 30;
      const ys = [...new Set(rows.map((r) => r.y))]; const ends = ys.map((y) => rows.filter((r) => r.y === y).slice(-1)[0]);
      const nm = FC.nice(Math.max(...ends.map((r) => F.reduce((s, f) => s + r.bal[f.id], 0)))), mx = nm.mx;
      const bw = (W - L - R) / ys.length, y = (v) => T + (H - T - B) * (1 - v / mx); let s = '';
      for (let v = 0; v <= mx; v += nm.st) s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + FC.k(v) + '</text>';
      ends.forEach((r, i) => {
        let acc = 0; const x0 = L + bw * i + bw * .18, w = bw * .64, a = r.assumed;
        F.slice().reverse().forEach((f) => { const v = r.bal[f.id]; s += '<rect x="' + x0 + '" y="' + y(acc + v) + '" width="' + w + '" height="' + (y(acc) - y(acc + v)) + '" fill-opacity="' + (a ? '.45' : '.9') + '" style="fill:' + f.color + (a ? ';stroke:' + f.color + ';stroke-dasharray:4 3' : '') + '"/>'; acc += v; });
        s += '<text x="' + (x0 + w / 2) + '" y="' + (y(acc) - 6) + '" text-anchor="middle" style="fill:var(--ink)">' + FC.k(acc) + '</text><text x="' + (x0 + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + r.y + (a ? '*' : '') + '</text>';
      });
      return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="End of year fund balances; years marked with an asterisk use assumed raises">' + s + '</svg>';
    },
    /* month detail body */
    detail(r, scnId) {
      const S = BY.SCENARIOS[scnId || FC.scn];
      const rows = F.map((f) => { const a = r.alloc[f.id], b = r.bonusTo[f.id] || 0; return '<tr><td><span class="row" style="gap:8px"><i class="dot" style="background:' + f.color + '"></i>' + f.name + '</span></td><td class="num">' + P(a.amt + b) + '</td><td style="text-align:left"><span class="pill ' + (a.why === 'pinned' ? 'ok' : a.why === 'skipped' ? 'warn' : '') + '">' + FC.why(r, f.id) + '</span>' + (b ? ' <span class="pill ok">+' + P(b) + ' bonus</span>' : '') + '</td><td class="num muted">' + P(r.bal[f.id]) + '</td></tr>'; }).join('');
      const stash = r.lines.find((l) => l.id === 'stash').amt;
      return '<div class="stack"><div class="card flat" style="padding:0;border:0"><div class="lbl">Where the pool came from</div>' +
        '<div class="row sp sm" style="padding:6px 0"><span>Take-home ' + (r.assumed ? '<span class="pill est">assumed</span>' : '') + '</span><b class="num">' + P(r.take) + '</b></div>' +
        '<div class="row sp sm" style="padding:6px 0"><span>Stash line (12%)</span><b class="num">' + P(stash) + '</b></div>' +
        '<div class="row sp sm" style="padding:6px 0"><span>Whatever is left</span><b class="num">' + P(Math.max(0, r.rest)) + '</b></div>' +
        '<div class="row sp" style="padding:8px 0;border-top:1px solid var(--line)"><b>Savings pool</b><b class="num">' + P(r.pool) + '</b></div>' +
        (r.bonus ? '<div class="row sp sm" style="padding:6px 0"><span>' + r.bonus.name + ' net, split by its plan</span><b class="num pos">+' + P(r.bonus.net) + '</b></div>' : '') + '</div>' +
        '<div class="scrollx"><table><thead><tr><th>Fund</th><th>Got</th><th style="text-align:left">Why</th><th>Balance</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (r.unplaced + (r.bonusExcess || 0) > 0.5 ? '<div class="flag"><b>!</b><span>' + P(r.unplaced + (r.bonusExcess || 0)) + ' found no home because funds are full. It stays in your spending account.</span></div>' : '') + '</div>';
    },
  });

  /* line style: one line per fund plus a dashed total, labelled at the right edge */
  const nudge = (items) => { items.sort((a, b) => a.y - b.y); for (let i = 1; i < items.length; i++) if (items[i].y < items[i - 1].y + 14) items[i].y = items[i - 1].y + 14; return items; };
  FC.lines = (rows, o) => {
    o = o || {}; const F = FC.sel(o); const W = 720, H = o.h || 300, L = 56, R = 124, T = 16, B = 30, n = rows.length;
    const tot = rows.map((r) => F.reduce((s, f) => s + r.bal[f.id], 0)); const nm = FC.nice(Math.max(...tot)), mx = nm.mx;
    const x = (i) => L + (W - L - R) * i / (n - 1), y = (v) => T + (H - T - B) * (1 - v / mx); let s = '';
    for (let v = 0; v <= mx; v += nm.st) s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + FC.k(v) + '</text>';
    const ai = rows.findIndex((r) => r.assumed);
    if (ai > 0) s += '<rect x="' + x(ai) + '" y="' + T + '" width="' + (x(n - 1) - x(ai)) + '" height="' + (H - T - B) + '" style="fill:var(--soft)" opacity=".55"/><text x="' + (x(ai) + 6) + '" y="' + (T + 12) + '">Assumed raises</text>';
    const labs = [];
    F.forEach((f) => { s += '<path d="M' + rows.map((r, i) => x(i) + ' ' + y(r.bal[f.id])).join(' L') + '" fill="none" style="stroke:' + f.color + '" stroke-width="2.5" stroke-linejoin="round"/>'; labs.push({ y: y(rows[n - 1].bal[f.id]) + 4, t: f.name + ' ' + FC.k(rows[n - 1].bal[f.id]), c: f.color }); });
    s += '<path d="M' + tot.map((v, i) => x(i) + ' ' + y(v)).join(' L') + '" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-dasharray="6 4"/>'; labs.push({ y: y(tot[n - 1]) + 4, t: (F.length < BY.FUNDS.length ? 'Selected ' : 'Total ') + FC.k(tot[n - 1]), c: 'var(--ink)', b: 1 });
    nudge(labs).forEach((l) => { s += '<text x="' + (W - R + 8) + '" y="' + l.y + '" style="fill:' + l.c + ';font-weight:800">' + l.t + '</text>'; });
    rows.forEach((r, i) => { if (r.mo === 1) s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + r.y + '</text>'; });
    rows.forEach((r, i) => { if (r.over) s += '<path d="M' + x(i) + ' ' + (H - B - 2) + ' l-5 -9 h10z" style="fill:var(--ink)" stroke="none"><title>' + BY.ymLabel(r.ym) + ' has an override</title></path>'; });
    const bw = (W - L - R) / (n - 1);
    rows.forEach((r, i) => { s += '<rect class="hit" tabindex="0" role="button" data-ym="' + r.ym + '" x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '" aria-label="' + BY.ymLabel(r.ym) + ', savings ' + P(tot[i]) + (r.over ? ', has an override' : '') + '"/>'; });
    if (o.sel) { const i = rows.findIndex((r) => r.ym === o.sel); if (i >= 0) s += '<line x1="' + x(i) + '" x2="' + x(i) + '" y1="' + T + '" y2="' + (H - B) + '" style="stroke:var(--ink)" stroke-width="2"/>'; }
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Fund balances, 60 months, one line per fund">' + s + '</svg>';
  };
  FC.yearLines = (rows, o) => {
    const F = FC.sel(o); const W = 720, H = o && o.h || 300, L = 56, R = 124, T = 16, B = 30;
    const ys = [...new Set(rows.map((r) => r.y))], ends = ys.map((y) => rows.filter((r) => r.y === y).slice(-1)[0]);
    const tots = ends.map((r) => F.reduce((s, f) => s + r.bal[f.id], 0)), nm = FC.nice(Math.max(...tots)), mx = nm.mx;
    const x = (i) => L + (W - L - R) * (i + .5) / ys.length, y = (v) => T + (H - T - B) * (1 - v / mx); let s = '';
    for (let v = 0; v <= mx; v += nm.st) s += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + FC.k(v) + '</text>';
    const labs = [];
    F.forEach((f) => { s += '<path d="M' + ends.map((r, i) => x(i) + ' ' + y(r.bal[f.id])).join(' L') + '" fill="none" style="stroke:' + f.color + '" stroke-width="2.5"/>' + ends.map((r, i) => '<circle cx="' + x(i) + '" cy="' + y(r.bal[f.id]) + '" r="4" style="fill:' + f.color + '" stroke="var(--surface)" stroke-width="1.5"/>').join(''); labs.push({ y: y(ends[ends.length - 1].bal[f.id]) + 4, t: f.name + ' ' + FC.k(ends[ends.length - 1].bal[f.id]), c: f.color }); });
    s += '<path d="M' + tots.map((v, i) => x(i) + ' ' + y(v)).join(' L') + '" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-dasharray="6 4"/>'; labs.push({ y: y(tots[tots.length - 1]) + 4, t: (F.length < BY.FUNDS.length ? 'Selected ' : 'Total ') + FC.k(tots[tots.length - 1]), c: 'var(--ink)' });
    nudge(labs).forEach((l) => { s += '<text x="' + (W - R + 8) + '" y="' + l.y + '" style="fill:' + l.c + ';font-weight:800">' + l.t + '</text>'; });
    ends.forEach((r, i) => { s += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + r.y + (r.assumed ? '*' : '') + '</text>'; });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="End of year fund balances as lines; years marked with an asterisk use assumed raises">' + s + '</svg>';
  };
  /* click or Enter/Space on chart hit areas */
  FC.bindHits = (root, cb) => {
    root.addEventListener('click', (e) => { const h = e.target.closest('.hit'); if (h) cb(h.dataset.ym); });
    root.addEventListener('keydown', (e) => { const h = e.target.closest('.hit'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); cb(h.dataset.ym); } });
  };
})();
