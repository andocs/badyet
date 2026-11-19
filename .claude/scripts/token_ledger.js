#!/usr/bin/env node
/* Token ledger for the Haiku+Sonnet orchestrator (Node, no dependencies).
 *
 * Sums real token usage per model family from Claude Code session transcripts
 * (<claude config>/projects/<encoded-cwd>/**\/*.jsonl, incl. subagent and worktree logs).
 *
 * Usage:
 *   node token_ledger.js totals                  JSON of all-time totals for this project
 *   node token_ledger.js mark <label>            snapshot current totals under a label
 *   node token_ledger.js delta <label>           JSON of usage since the mark
 *   node token_ledger.js row "<Scope>" <label>   markdown table row of usage since the mark
 *
 * "in" = fresh input + cache writes, "cached" = cache reads, "out" = output tokens.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const MARKS = path.join('.claude', 'ledger', 'marks.json');
const FAMILIES = ['haiku', 'sonnet', 'other'];
const FIELDS = ['in', 'cached', 'out'];

const configDir = () => process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
}

function transcriptFiles() {
  const root = path.join(configDir(), 'projects');
  const enc = process.cwd().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    const n = e.name.toLowerCase();
    // exact project dir, or a worktree of it (<enc>--claude-worktrees-x)
    if (e.isDirectory() && (n === enc || n.startsWith(enc + '--'))) walk(path.join(root, e.name), out);
  }
  return out;
}

const family = (model) => {
  const m = (model || '').toLowerCase();
  return m.includes('haiku') ? 'haiku' : m.includes('sonnet') ? 'sonnet' : 'other';
};

const empty = () => Object.fromEntries(FAMILIES.map((f) => [f, { in: 0, cached: 0, out: 0 }]));

function totals() {
  const files = transcriptFiles();
  const best = new Map(); // streamed messages repeat: keep the entry with the most output tokens
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line.includes('"usage"')) continue;
      let o;
      try { o = JSON.parse(line); } catch { continue; }
      const msg = o && o.message;
      if (!msg || typeof msg !== 'object') continue;
      const u = msg.usage, model = msg.model;
      if (!u || typeof u !== 'object' || !model || model === '<synthetic>') continue;
      const key = (msg.id || o.uuid) + '|' + (o.requestId || '');
      const prev = best.get(key);
      if (!prev || (u.output_tokens || 0) >= (prev.u.output_tokens || 0)) best.set(key, { model, u });
    }
  }
  const t = empty();
  for (const { model, u } of best.values()) {
    const fam = t[family(model)];
    fam.in += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    fam.cached += u.cache_read_input_tokens || 0;
    fam.out += u.output_tokens || 0;
  }
  return { files: files.length, usage: t };
}

function loadMarks() {
  try { return JSON.parse(fs.readFileSync(MARKS, 'utf8')); } catch { return {}; }
}

function diff(now, then) {
  const out = empty();
  for (const f of FAMILIES) for (const k of FIELDS) out[f][k] = Math.max(0, now[f][k] - then[f][k]);
  return out;
}

const fmt = (n) => n.toLocaleString('en-US');

function main(argv) {
  const [cmd, a, b] = argv;
  const cur = totals();

  if (cmd === 'totals') {
    console.log(JSON.stringify(cur, null, 2));
    return 0;
  }
  if (cmd === 'mark' && a) {
    const marks = loadMarks();
    marks[a] = cur.usage;
    fs.mkdirSync(path.dirname(MARKS), { recursive: true });
    fs.writeFileSync(MARKS, JSON.stringify(marks, null, 2));
    console.log(`MARKED ${a} (transcripts: ${cur.files})`);
    return 0;
  }
  if ((cmd === 'delta' && a) || (cmd === 'row' && a)) {
    const label = cmd === 'row' && b ? b : a;
    const scope = cmd === 'row' && b ? a : label;
    const base = loadMarks()[label];
    const note = base ? '' : `no mark '${label}': showing all-time`;
    const d = diff(cur.usage, base || empty());
    if (cmd === 'delta') {
      console.log(JSON.stringify({ label, note, files: cur.files, usage: d }, null, 2));
      return 0;
    }
    if (cur.files === 0) {
      console.log(`| ${scope} | n/a | n/a | n/a | n/a | n/a | n/a | NO TRANSCRIPTS FOUND: estimate manually |`);
      return 0;
    }
    const h = d.haiku, s = d.sonnet;
    console.log(`| ${scope} | ${fmt(h.in)} | ${fmt(h.cached)} | ${fmt(h.out)} | ${fmt(s.in)} | ${fmt(s.cached)} | ${fmt(s.out)} | ${note} |`);
    return 0;
  }
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
  return 1;
}

function markLabel(label) {
  const marks = loadMarks();
  marks[label] = totals().usage;
  fs.mkdirSync(path.dirname(MARKS), { recursive: true });
  fs.writeFileSync(MARKS, JSON.stringify(marks, null, 2));
}

function rowFor(scope, label) {
  const cur = totals();
  const base = loadMarks()[label];
  const note = base ? '' : `no mark '${label}': all-time`;
  if (cur.files === 0) return `| ${scope} | n/a | n/a | n/a | n/a | n/a | n/a | no transcripts found: estimate |`;
  const d = diff(cur.usage, base || empty());
  const h = d.haiku, s = d.sonnet;
  return `| ${scope} | ${fmt(h.in)} | ${fmt(h.cached)} | ${fmt(h.out)} | ${fmt(s.in)} | ${fmt(s.cached)} | ${fmt(s.out)} | ${note} |`;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { rowFor, markLabel };
