#!/usr/bin/env node
/* Deterministic git step. Zero model tokens: replaces the old Haiku git agent.
 * node .claude/scripts/ship.js <slice|rev> <n> <slug> "<commit subject>" [--no-push] [--trailer "<line>"]...
 * Branch: slice/<n>-<slug> (or rev/...). Stages everything not ignored except secret-looking files,
 * commits, pushes with -u when an origin exists. Never force-pushes, never touches main/master.
 * Prints exactly one line.
 */
const { execFileSync } = require('child_process');

const a = process.argv.slice(2);
const [kind, n, slug, subject] = a;
const noPush = a.includes('--no-push');
const trailers = a.flatMap((x, i) => (x === '--trailer' ? [a[i + 1]] : []));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const out = (s) => { console.log(s); process.exit(s.startsWith('GIT ERROR') ? 1 : 0); };

if (!kind || !n || !slug || !subject || !['slice', 'rev'].includes(kind)) out('GIT ERROR: usage: ship.js <slice|rev> <n> <slug> "<subject>"');
try { git('rev-parse', '--is-inside-work-tree'); } catch { out('GIT ERROR: not a git repository (run git init)'); }

const branch = `${kind}/${n}-${slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
if (['main', 'master'].includes(branch)) out('GIT ERROR: refusing main/master');
try {
  const exists = (() => { try { git('rev-parse', '--verify', branch); return true; } catch { return false; } })();
  git('checkout', ...(exists ? [] : ['-b']), branch);
  git('add', '-A');
  const secret = /(^|\/)(\.env(\..*)?|id_rsa.*|.*\.pem|.*\.key|credentials(\.json)?|\.npmrc)$/i;
  const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const bad = staged.filter((f) => secret.test(f) && !/\.example$|\.sample$/i.test(f));
  if (bad.length) git('reset', 'HEAD', '--', ...bad);
  if (!staged.length || staged.length === bad.length) out(`GIT ERROR: nothing to commit on ${branch}` + (bad.length ? ` (skipped secret-looking: ${bad.join(', ')})` : ''));
  const msg = [`${kind === 'rev' ? 'fix' : 'feat'}(${kind}-${n}): ${subject}`.slice(0, 72), ...(trailers.length ? ['', ...trailers] : [])].join('\n');
  git('commit', '-m', msg);
  const sha = git('rev-parse', '--short', 'HEAD');
  const warn = bad.length ? ` | skipped secret-looking: ${bad.join(', ')}` : '';
  let remote = ''; try { remote = git('remote'); } catch {}
  if (noPush || !remote) out(`GIT LOCAL-ONLY: ${branch} @ ${sha} | ${noPush ? 'push skipped' : 'no remote'}${warn}`);
  try { git('push', '-u', 'origin', branch); } catch (e) { out(`GIT LOCAL-ONLY: ${branch} @ ${sha} | push failed: ${String(e.stderr || e.message).split('\n')[0].slice(0, 100)}${warn}`); }
  out(`GIT OK: ${branch} @ ${sha} pushed | files: ${staged.length - bad.length}${warn}`);
} catch (e) {
  out(`GIT ERROR: ${String(e.stderr || e.message).split('\n')[0].slice(0, 140)}`);
}
