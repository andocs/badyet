#!/usr/bin/env node
/* Deterministic PROJECT_STATE.md writer. Zero model tokens: replaces the old Haiku logger.
 * PROJECT_STATE.md is only ever changed through this script.
 *
 *   node .claude/scripts/state.js init "<project name>"
 *   node .claude/scripts/state.js about "<what we're building>"
 *   node .claude/scripts/state.js set phase="..." slice="..." gate="..." next="..." todo="..."
 *   node .claude/scripts/state.js log "<phase/slice>" "<what happened>" [commit-sha]
 *   node .claude/scripts/state.js q add "<question>"      |  q done <n> "<answer>"
 *   node .claude/scripts/state.js ledger-start <label>    (mark tokens at start of a phase/slice)
 *   node .claude/scripts/state.js ledger "<Scope>" <label> (write scope row + refresh Cumulative)
 *   node .claude/scripts/state.js put "<section heading>" <<'EOF' ... EOF   (replace a section body from stdin)
 *   node .claude/scripts/state.js handoff <<'EOF' ... EOF  (prepend a block to "Slice handoffs")
 *   node .claude/scripts/state.js status                  (12-line snapshot)
 */
const fs = require('fs');
const path = require('path');

const FILE = 'PROJECT_STATE.md';
const TEMPLATE = path.join(__dirname, 'PROJECT_STATE.template.md');
const ledger = () => require('./token_ledger.js');

const read = () => fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const write = (t) => fs.writeFileSync(FILE, t);
const stdin = () => { try { return fs.readFileSync(0, 'utf8').replace(/\r\n/g, '\n').trim(); } catch { return ''; } };
const now = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const die = (m) => { console.log('STATE ERROR: ' + m); process.exit(1); };

// ---- section helpers: a section = "## heading" line up to the next "## " or the END SUMMARY marker or EOF
function bounds(text, name) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && l.toLowerCase().includes(name.toLowerCase()));
  if (start < 0) die(`section "${name}" not found`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ') || lines[i].startsWith('<!-- END SUMMARY') || lines[i] === '---') { end = i; break; }
  }
  return { lines, start, end };
}
function getSection(name) { const b = bounds(read(), name); return b.lines.slice(b.start + 1, b.end); }
function setSection(name, bodyLines) {
  const b = bounds(read(), name);
  const trimmed = [...bodyLines];
  while (trimmed.length && trimmed[0].trim() === '') trimmed.shift();
  while (trimmed.length && trimmed[trimmed.length - 1].trim() === '') trimmed.pop();
  const body = ['', ...trimmed, ''];
  write([...b.lines.slice(0, b.start + 1), ...body, ...b.lines.slice(b.end)].join('\n'));
}

const cmd = process.argv[2], args = process.argv.slice(3);

if (cmd === 'init') {
  if (fs.existsSync(FILE)) { console.log('STATE EXISTS: left untouched'); process.exit(0); }
  let t = fs.readFileSync(TEMPLATE, 'utf8').replace(/\{\{DATE\}\}/g, now());
  if (args[0]) t = t.replace('# PROJECT_STATE', `# PROJECT_STATE: ${args[0]}`);
  write(t);
  ledger().markLabel('project-start');
  ledger().markLabel('phase1');
  console.log('STATE CREATED');
} else if (!fs.existsSync(FILE)) {
  die('PROJECT_STATE.md not found. Run: node .claude/scripts/state.js init "<name>"');
} else if (cmd === 'about') {
  setSection('what we', [args.join(' ')]);
  console.log('OK');
} else if (cmd === 'set') {
  const map = { phase: 'Phase', slice: 'Active slice / milestone', gate: 'Gate', next: 'Next action', todo: 'User to-do now' };
  const body = getSection('current phase');
  for (const a of args) {
    const i = a.indexOf('='); if (i < 0) continue;
    const k = a.slice(0, i), v = a.slice(i + 1), label = map[k];
    if (!label) die(`unknown key ${k}`);
    const idx = body.findIndex((l) => l.startsWith(`- **${label}:**`));
    const line = `- **${label}:** ${v}`;
    idx >= 0 ? (body[idx] = line) : body.push(line);
  }
  setSection('current phase', body.filter((l, i) => l !== '' || i > 0));
  console.log('OK');
} else if (cmd === 'log') {
  const [scope, text, sha] = args;
  const body = getSection('execution log').filter((l) => l.trim() !== '' && !l.startsWith('<!--'));
  body.push(`- ${now()} | ${scope || '-'} | ${text || ''} | ${sha || '-'}`);
  const bullets = body.filter((l) => l.startsWith('- 20'));
  let out = body;
  if (bullets.length > 25) {
    const old = bullets.slice(0, 15), rest = body.filter((l) => !old.includes(l));
    const scopes = [...new Set(old.map((l) => l.split(' | ')[1]))].join(', ');
    out = [`- earlier: ${old.length} events (${old[0].slice(2, 12)} to ${old[old.length - 1].slice(2, 12)}) covering ${scopes}`, ...rest];
  }
  setSection('execution log', out);
  console.log('OK');
} else if (cmd === 'q') {
  const body = getSection('open questions').filter((l) => l.trim() !== '' && l.trim() !== '_None._' && !l.startsWith('<!--'));
  if (args[0] === 'add') {
    const n = Math.max(0, ...body.map((l) => +((l.match(/Q(\d+):/) || [])[1] || 0))) + 1;
    const open = body.filter((l) => l.startsWith('- [ ]')), done = body.filter((l) => l.startsWith('- [x]'));
    setSection('open questions', [...open, `- [ ] Q${n}: ${args.slice(1).join(' ')}`, ...done]);
    console.log(`OK Q${n}`);
  } else if (args[0] === 'done') {
    const n = args[1], ans = args.slice(2).join(' ');
    const hit = body.find((l) => l.startsWith('- [ ]') && l.includes(`Q${n}:`));
    if (!hit) die(`open question Q${n} not found`);
    const rest = body.filter((l) => l !== hit);
    const open = rest.filter((l) => l.startsWith('- [ ]')), done = rest.filter((l) => l.startsWith('- [x]'));
    const res = [...open, ...done, hit.replace('- [ ]', '- [x]') + ` -> ${ans}`];
    setSection('open questions', res);
    console.log('OK');
  } else die('use: q add "<text>" | q done <n> "<answer>"');
} else if (cmd === 'ledger-start') {
  ledger().markLabel(args[0]);
  console.log(`MARKED ${args[0]}`);
} else if (cmd === 'ledger') {
  const [scope, label] = args;
  const upsert = (name, row) => {
    const body = getSection('token');
    const i = body.findIndex((l) => l.startsWith(`| ${name} |`) || l.startsWith(`| **${name}** |`));
    if (i >= 0) body[i] = row;
    else { const last = body.map((l) => l.startsWith('|')).lastIndexOf(true); body.splice(last + 1, 0, row); }
    setSection('token', body);
  };
  upsert(scope, ledger().rowFor(scope, label));
  upsert('Cumulative', ledger().rowFor('**Cumulative**', 'project-start').replace('| **Cumulative** |', '| **Cumulative** |'));
  console.log('OK');
} else if (cmd === 'put') {
  const lines = stdin().split('\n');
  setSection(args[0], lines);
  console.log('OK');
} else if (cmd === 'handoff') {
  const block = stdin();
  const body = getSection('slice handoffs').filter((l) => !l.startsWith('<!--'));
  while (body.length && body[0].trim() === '') body.shift();
  setSection('slice handoffs', [block, '', ...body]);
  console.log('OK');
} else if (cmd === 'status') {
  const t = read();
  const field = (label) => ((t.match(new RegExp(`- \\*\\*${label.replace(/[/]/g, '\\/')}:\\*\\* (.*)`)) || [])[1] || '-').trim();
  const about = getSection('what we').filter((l) => l.trim()).join(' ').replace(/^_.*_$/, 'not described yet').slice(0, 160);
  const logs = getSection('execution log').filter((l) => l.startsWith('- 20'));
  const qs = getSection('open questions').filter((l) => l.startsWith('- [ ]'));
  const cum = getSection('token').find((l) => l.includes('Cumulative')) || '';
  const c = cum.split('|').map((s) => s.trim()).filter(Boolean).slice(1);
  console.log([
    `PROJECT: ${about}`,
    `PHASE: ${field('Phase')}   SLICE: ${field('Active slice / milestone')}   GATE: ${field('Gate')}`,
    `LAST DONE: ${(logs[logs.length - 1] || '-').replace(/^- /, '')}`,
    `OPEN QUESTIONS: ${qs.length}`,
    ...qs.slice(0, 3).map((q) => ` - ${q.replace('- [ ] ', '')}`),
    `NEXT ACTION: ${field('Next action')}`,
    `USER TODO: ${field('User to-do now')}`,
    `TOKENS (cumulative): Haiku in/cached/out = ${c[0] || '-'}/${c[1] || '-'}/${c[2] || '-'} | Sonnet in/cached/out = ${c[3] || '-'}/${c[4] || '-'}/${c[5] || '-'}`,
  ].join('\n'));
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
  process.exit(1);
}
