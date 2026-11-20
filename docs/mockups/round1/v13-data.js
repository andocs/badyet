/* v13 mockups: shared SAMPLE model. All figures are invented. Simplified tax rules for illustration only;
   the real engine (lib/pay/compute.ts, lib/windfall/compute.ts) stays the source of truth. */
(function (g) {
  const peso = (n, o) => (n < 0 ? '−' : (o && o.sign ? '+' : '')) + '₱' + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const peso0 = (n) => (n < 0 ? '−' : '') + '₱' + Math.abs(Math.round(n)).toLocaleString('en-PH');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ymLabel = (ym) => MON[+ym.slice(5) - 1] + ' ' + ym.slice(0, 4);

  /* --- salary --- */
  function contrib(base) {
    const sss = 0.05 * Math.min(base, 35000), ph = 0.025 * Math.min(base, 100000), pi = 200;
    return { sss, ph, pi, total: sss + ph + pi };
  }
  function annualTax(t) {
    if (t <= 250000) return 0;
    if (t <= 400000) return (t - 250000) * 0.15;
    if (t <= 800000) return 22500 + (t - 400000) * 0.2;
    if (t <= 2000000) return 102500 + (t - 800000) * 0.25;
    return 402500 + (t - 2000000) * 0.3;
  }
  function takeHome(base, allowance) {
    const c = contrib(base), taxable = (base - c.total) * 12, tax = annualTax(taxable) / 12;
    return { base, allowance, contrib: c.total, tax, take: base + allowance - c.total - tax, cutoff: (base + allowance - c.total - tax) / 2 };
  }
  const EVENTS = [
    { ym: '2026-01', kind: 'start', label: 'Starting salary', base: 58000, title: 'Analyst, Grade 6' },
    { ym: '2027-03', kind: 'merit', label: 'Merit raise', pct: 4 },
    { ym: '2027-07', kind: 'promo', label: 'Promotion', base: 70000, title: 'Senior Analyst, Grade 7' },
    { ym: '2028-01', kind: 'allow', label: 'Transport allowance', allowDelta: 1500 },
    { ym: '2028-03', kind: 'merit', label: 'Merit raise', pct: 5 },
  ];
  const SCENARIOS = {
    base: { id: 'base', name: 'Steady', blurb: 'What my manager hinted at', promo: '2027-07', cip: 1, infl: 0.04, assumed: 0.04, color: 'var(--accent)' },
    cautious: { id: 'cautious', name: 'Slow lane', blurb: 'Promotion slips, thin CIP', promo: '2028-01', cip: 0.5, infl: 0.05, assumed: 0.03, color: 'var(--gold)' },
    stretch: { id: 'stretch', name: 'Big year', blurb: 'Early promotion, strong CIP', promo: '2027-04', cip: 1.5, infl: 0.035, assumed: 0.05, color: 'var(--blue)' },
  };
  const months = [];
  for (let i = 0; i < 60; i++) { const t = 2026 * 12 + 11 + i; const y = Math.floor(t / 12), m = t % 12; months.push(y + '-' + String(m + 1).padStart(2, '0')); }

  function salaryAt(ym, scn) {
    let base = 0, allow = 0, assumed = false, lastEv = '2000-01';
    const evs = EVENTS.map((e) => (e.kind === 'promo' ? { ...e, ym: scn.promo } : e)).sort((a, b) => a.ym.localeCompare(b.ym));
    const lastYm = evs[evs.length - 1].ym;
    evs.forEach((e) => {
      if (e.ym > ym) return;
      lastEv = e.ym;
      if (e.kind === 'start' || e.kind === 'promo') base = e.base;
      if (e.kind === 'merit') base = Math.round(base * (1 + e.pct / 100));
      if (e.kind === 'allow') allow += e.allowDelta;
    });
    /* assumed raise: each March after the year of the last entered event */
    const lastY = +lastYm.slice(0, 4);
    for (let y = lastY + 1; y <= +ym.slice(0, 4); y++) {
      if (y + '-03' <= ym) { base = Math.round(base * (1 + scn.assumed)); assumed = true; }
    }
    return { base, allow, assumed };
  }

  /* --- budget lines (rules) --- */
  const GROUPS = [
    { id: 'ess', name: 'Essentials', color: 'var(--accent)' },
    { id: 'wnt', name: 'Wants', color: 'var(--blue)' },
    { id: 'sav', name: 'Savings', color: 'var(--gold)' },
  ];
  const LINES = [
    { id: 'rent1', g: 'ess', name: 'Rent (current place)', cat: 'Rent', rule: 'infl', amt: 14000, cut: 'both', to: 'BPI Checking', end: '2027-05' },
    { id: 'rent2', g: 'ess', name: 'Rent (new place)', cat: 'Rent', rule: 'infl', amt: 17500, cut: 'both', to: 'BPI Checking', start: '2027-06' },
    { id: 'groc', g: 'ess', name: 'Groceries', cat: 'Food at home', rule: 'pct', pct: 13, cut: 'both', to: 'GCash' },
    { id: 'util', g: 'ess', name: 'Power, water, internet', cat: 'Bills', rule: 'infl', amt: 3200, cut: '2nd', to: 'BPI Checking' },
    { id: 'trans', g: 'ess', name: 'Commute', cat: 'Transport', rule: 'pct', pct: 5, cut: 'both', to: 'Maya' },
    { id: 'phone', g: 'ess', name: 'Phone plan', cat: 'Bills', rule: 'fixed', amt: 799, cut: '1st', to: 'GCash' },
    { id: 'lap', g: 'ess', name: 'Laptop installment', cat: 'Loans', rule: 'fixed', amt: 2650, cut: '1st', to: 'BPI Checking', end: '2027-03' },
    { id: 'car', g: 'ess', name: 'Car loan (draft)', cat: 'Loans', rule: 'fixed', amt: 11800, cut: '2nd', to: 'BPI Checking', start: '2029-03', end: '2031-02', draft: true },
    { id: 'eat', g: 'wnt', name: 'Eating out', cat: 'Food out', rule: 'pct', pct: 6, cut: 'both', to: 'GCash' },
    { id: 'hob', g: 'wnt', name: 'Hobbies', cat: 'Fun', rule: 'pct', pct: 3, cut: '2nd', to: 'Maya' },
    { id: 'subs', g: 'wnt', name: 'Subscriptions', cat: 'Fun', rule: 'fixed', amt: 1100, cut: '1st', to: 'Maya' },
    { id: 'stash', g: 'sav', name: 'Stash', cat: 'Savings pool', rule: 'pct', pct: 12, cut: 'both', to: 'Savings pool' },
    { id: 'rest', g: 'sav', name: 'Whatever is left', cat: 'Savings pool', rule: 'rest', cut: '2nd', to: 'Savings pool' },
  ];
  const RULE_LABEL = { fixed: 'Fixed', pct: '% of take-home', infl: 'Fixed + inflation', rest: 'Whatever is left' };

  /* --- funds --- */
  const FUNDS = [
    { id: 'emg', name: 'Emergency', color: 'var(--accent)', rule: 'steps', tranches: [150000, 300000], max: 6000, start: 96400, link: 'BPI Savings', rt: 'Fill in steps: ₱150,000, then ₱300,000' },
    { id: 'trv', name: 'Travel', color: 'var(--blue)', rule: 'reset', cap: 48000, max: 4000, start: 18000, rt: 'Resets every January, cap ₱48,000 a year' },
    { id: 'gdg', name: 'Gadget swap', color: 'var(--violet)', rule: 'fixed', fixed: 1500, cap: 45000, start: 6500, rt: 'Fixed ₱1,500 a month, cap ₱45,000' },
    { id: 'home', name: 'Home down payment', color: 'var(--gold)', rule: 'cap', cap: 1500000, start: 40000, rt: 'Fill to cap ₱1,500,000' },
  ];
  const SPLITS = { '13th': { home: 0.6, emg: 0.4 }, cip: { home: 0.5, trv: 0.2, emg: 0.3 }, sep: { trv: 1 } };

  function demand(f, bal) {
    if (f.rule === 'steps') { const t = f.tranches.find((x) => x > bal); return t ? Math.min(f.max, t - bal) : 0; }
    if (f.rule === 'reset') return Math.min(f.max, f.cap - bal);
    if (f.rule === 'fixed') return Math.min(f.fixed, f.cap - bal);
    return f.cap - bal;
  }

  /* --- bonuses --- */
  const DEMIN = { cip: 12000, sep: 5000, '13th': 0 };
  const CAP = 90000;

  /* overrides: { 'YYYY-MM': { order?:[ids], pin?:{id:amt}, skip?:[ids], scope:'all'|scenarioId } } */
  const OVERRIDES = {
    '2027-03': { order: ['trv', 'emg', 'gdg', 'home'], pin: { trv: 12000 }, scope: 'all', note: 'Trip deposit' },
    '2027-07': { skip: ['gdg'], scope: 'all', note: 'Pause gadget swap' },
    '2028-01': { order: ['home', 'emg', 'trv', 'gdg'], scope: 'stretch', note: 'Home first (Big year only)' },
  };

  function simulate(scnId, ov) {
    const scn = SCENARIOS[scnId || 'base'];
    ov = ov || OVERRIDES;
    const bal = {}; FUNDS.forEach((f) => (bal[f.id] = f.start));
    const used = { 2026: 62000 }, taxed = {};
    const rows = [];
    months.forEach((ym) => {
      const y = +ym.slice(0, 4), mo = +ym.slice(5);
      if (mo === 1) FUNDS.forEach((f) => { if (f.rule === 'reset') bal[f.id] = 0; });
      const s = salaryAt(ym, scn), th = takeHome(s.base, s.allow);
      const infl = Math.pow(1 + scn.infl, Math.max(0, y - 2026));
      let fixedSum = 0, pctSum = 0, stash = 0; const lines = [];
      LINES.forEach((l) => {
        if (l.start && ym < l.start) return; if (l.end && ym > l.end) return;
        let a = 0;
        if (l.rule === 'fixed') a = l.amt; else if (l.rule === 'infl') a = l.amt * infl; else if (l.rule === 'pct') a = th.take * l.pct / 100;
        if (l.rule === 'rest') return;
        if (l.g !== 'sav') { if (l.rule === 'fixed' || l.rule === 'infl') fixedSum += a; else pctSum += a; }
        if (l.id === 'stash') stash = a;
        lines.push({ id: l.id, amt: a });
      });
      const spent = lines.reduce((t, x) => t + x.amt, 0);
      const rest = th.take - spent;
      const pool = Math.max(0, stash + Math.max(0, rest));
      /* bonuses */
      let bonus = null;
      const prevEarn = months.length && y > 2026 ? 12 * (salaryAt((y - 1) + '-12', scn).base) : 12 * 58000;
      let kind = null, gross = 0;
      if (mo === 12) { kind = '13th'; gross = s.base; }
      else if (mo === 3 && y >= 2027) { kind = 'cip'; gross = prevEarn * 0.1 * scn.cip; }
      else if (mo === 9 && y >= 2027) { kind = 'sep'; gross = 15000; }
      if (kind) {
        const dm = Math.min(DEMIN[kind], gross), excess = gross - dm, u = used[y] || 0;
        const room = Math.max(0, CAP - u), over = Math.max(0, excess - room);
        const tax = over * (annualTax((s.base - contrib(s.base).total) * 12) > 102500 ? 0.25 : 0.2);
        used[y] = u + excess;
        bonus = { kind, gross, dm, room, over, tax, net: gross - tax, name: { '13th': '13th month', cip: 'CIP', sep: 'September bonus' }[kind] };
      }
      /* bonus lands first, capped by each fund's room; the rest has no home */
      let bonusTo = {}, bonusExcess = 0;
      if (bonus) { const sp = SPLITS[bonus.kind]; Object.keys(sp).forEach((id) => { const f = FUNDS.find((x) => x.id === id); const room = Math.max(0, (f.cap || (f.tranches ? f.tranches[f.tranches.length - 1] : Infinity)) - bal[id]); const want = bonus.net * sp[id], got = Math.min(want, room); bonusTo[id] = got; bonusExcess += want - got; bal[id] += got; }); }
      /* allocation */
      const o = ov[ym] && (ov[ym].scope === 'all' || ov[ym].scope === scnId) ? ov[ym] : null;
      const order = (o && o.order) || FUNDS.map((f) => f.id), pin = (o && o.pin) || {}, skip = (o && o.skip) || [];
      let remain = pool; const alloc = {};
      FUNDS.forEach((f) => (alloc[f.id] = { amt: 0, why: '' }));
      Object.keys(pin).forEach((id) => { alloc[id] = { amt: pin[id], why: 'pinned' }; remain -= pin[id]; });
      order.forEach((id, i) => {
        if (pin[id] !== undefined) return;
        const f = FUNDS.find((x) => x.id === id);
        if (skip.includes(id)) { alloc[id] = { amt: 0, why: 'skipped' }; return; }
        const d = Math.max(0, demand(f, bal[id])), a = Math.max(0, Math.min(d, remain));
        remain -= a;
        alloc[id] = { amt: a, why: d === 0 ? 'cap hit' : a < d ? (i === order.length - 1 ? 'takes the rest' : 'pool ran out') : i === 0 ? 'priority 1' : 'priority ' + (i + 1) };
      });
      /* leftover pool carried nowhere: goes to last fund that can take it is skipped on purpose; show as "unplaced" */
      const unplaced = Math.max(0, remain);
      FUNDS.forEach((f) => { bal[f.id] += alloc[f.id].amt; });
      rows.push({ ym, y, mo, base: s.base, allow: s.allow, assumed: s.assumed, take: th.take, cutoff: th.cutoff, lines, fixedSum, pctSum, rest, pool, bonus, bonusTo, alloc, unplaced, bonusExcess, order, over: !!o, ovr: o, bal: { ...bal }, tight: rest < 2500, overspent: rest < 0 });
    });
    return rows;
  }

  /* amounts of every line for one month (works for any month, incl. today's) */
  function monthLines(ym, scnId) {
    const scn = SCENARIOS[scnId || 'base'], y = +ym.slice(0, 4), s = salaryAt(ym, scn), th = takeHome(s.base, s.allow);
    const infl = Math.pow(1 + scn.infl, Math.max(0, y - 2026));
    let sum = 0;
    const out = LINES.map((l) => {
      const on = !((l.start && ym < l.start) || (l.end && ym > l.end));
      let a = 0;
      if (on) { if (l.rule === 'fixed') a = l.amt; else if (l.rule === 'infl') a = l.amt * infl; else if (l.rule === 'pct') a = th.take * l.pct / 100; }
      if (on && l.rule !== 'rest') sum += a;
      return { ...l, on, amt: a };
    });
    const rest = th.take - sum;
    out.forEach((l) => { if (l.rule === 'rest') l.amt = Math.max(0, rest); });
    return { ym, take: th.take, lines: out, rest, assumed: s.assumed };
  }

  function byYear(rows) {
    const out = {};
    rows.forEach((r) => {
      const o = out[r.y] || (out[r.y] = { y: r.y, n: 0, base: 0, take: 0, bonusNet: 0, pool: 0, assumed: false, endBase: 0 });
      o.n++; o.base = Math.max(o.base, r.base); o.endBase = r.base; o.take += r.take; o.pool += r.pool; if (r.bonus) o.bonusNet += r.bonus.net; if (r.assumed) o.assumed = true;
    });
    return Object.values(out);
  }

  g.BY = { peso, peso0, MON, ymLabel, EVENTS, SCENARIOS, GROUPS, LINES, RULE_LABEL, FUNDS, SPLITS, DEMIN, CAP, OVERRIDES, months, salaryAt, takeHome, contrib, simulate, monthLines, byYear };
  /* --- "today" is Fri 20 Nov 2026, day 10 of 14 in the cutoff paid 10 Nov (covers 11-24 Nov). Sample only. --- */
  g.BY.NOW = {
    cutoff: { label: '1st cutoff', from: '11 Nov', to: '24 Nov', next: '25 Nov', day: 10, days: 14, left: 5 },
    cats: [
      { name: 'Groceries', c: 'var(--accent)', plan: 3150.66, spent: 2410.5 },
      { name: 'Eating out', c: 'var(--blue)', plan: 1454.15, spent: 1182.75 },
      { name: 'Commute', c: 'var(--teal)', plan: 1211.79, spent: 868.0 },
    ],
    bills: { n: 5, sent: 5, total: 12449.0 },
    txns: [
      { who: 'Grab', cat: 'Commute', acct: 'GCash', amt: -186, when: 'Today 6:42 pm', st: 'pending' },
      { who: 'SM Supermarket', cat: 'Groceries', acct: 'BPI', amt: -1236.4, when: 'Today 1:05 pm', st: 'pending' },
      { who: '7-Eleven', cat: 'Eating out', acct: 'BPI', amt: -94.5, when: 'Today 8:12 am', st: 'pending' },
      { who: 'Jollibee', cat: 'Eating out', acct: 'GCash', amt: -312, when: 'Thu 7:30 pm', st: 'ok' },
      { who: 'Palengke', cat: 'Groceries', acct: 'Cash', amt: -540, when: 'Wed 5:50 pm', st: 'ok' },
    ],
    accounts: [
      { n: 'GCash', k: 'g', bal: 3842.15, sub: 'e-wallet · synced 6:42 pm' },
      { n: 'Maya', k: 'm', bal: 1205.6, sub: 'e-wallet · synced 2 days ago' },
      { n: 'BPI Checking', k: 'b', bal: 21430.88, sub: 'debit ·· 4471 · synced today' },
      { n: 'BPI Savings', k: 'b', bal: 96400, sub: 'Emergency fund ·· 9032', fund: 'emg' },
      { n: 'Maya Savings', k: 'm', bal: 40000, sub: 'Home down payment', fund: 'home' },
      { n: 'GCash GSave', k: 'g', bal: 24500, sub: 'Travel + Gadget swap', fund: 'trv' },
    ],
  };
  if (typeof module !== 'undefined') module.exports = g.BY;
})(typeof window !== 'undefined' ? window : globalThis);
