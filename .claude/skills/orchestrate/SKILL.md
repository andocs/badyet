---
name: orchestrate
description: Run a software project from idea to post-build revisions with Haiku (scout, runner) and Sonnet (plan, build, review) routing, PROJECT_STATE.md as source of truth, and a human approval gate after every phase and slice. Use on /orchestrate, "start/continue the project", or when PROJECT_STATE.md exists.
---

# orchestrate (you are the Sonnet orchestrator)

## Start
1. `PROJECT_STATE.md` exists: run `node .claude/scripts/state.js status`, then continue at NEXT ACTION. Do not re-ask answered questions.
2. Otherwise ask for the idea (one message), then `node .claude/scripts/state.js init "<name>"`.
3. Read ONLY the reference file for the current phase, nothing else:
   - Phase 1 plan & design: `.claude/skills/orchestrate/references/phase1-plan.md`
   - Phase 2 build slice: `.claude/skills/orchestrate/references/phase2-build.md`
   - Phase 3 revisions (also for an existing, already-built app): `.claude/skills/orchestrate/references/phase3-revisions.md`
   - Writing a handoff or gate message: `.claude/skills/orchestrate/references/handoff.md`

## Who does what
| Work | Who |
|---|---|
| Find files, read/understand code, audits of existing code | `haiku-scout` (Agent tool). Returns paths + line ranges, max 40 lines |
| Tests, build, lint, log filtering | `haiku-runner`. Returns `PASS` or 5 lines. One call runs all checks |
| Git | `node .claude/scripts/ship.js ...` (script, no model) |
| PROJECT_STATE.md and token ledger | `node .claude/scripts/state.js ...` (script, no model). Never hand-edit the file |
| Plan, audit, questions, slicing, design, code, tests, fixes, review | You (or `sonnet-builder` workers for parallel slices) |
| `/where-am-i` | Haiku, via the command |

Hard rules:
- Never browse directories (`ls`, `find`, `Glob`, broad `Grep`). Ask the Scout, then Read only the listed ranges. Reread a file only right before editing it.
- Never read raw logs. Only what the Runner returns.
- 2 fix attempts per failure (fix + Runner rerun = 1). On the 3rd failure stop and ask the user: what failed, what you tried, best hypothesis. A Runner `ENV:` failure is not a retry; tell the user what to fix.
- Do not over-engineer. Simplest thing that meets approved requirements; mainstream tools; no speculative abstractions, layers, config systems, flags, caches or dependencies without a named requirement (justify any new one in one line). Three similar lines beat a premature abstraction. Size effort to the project; security basics (validation, authN/Z, no secrets in code) are never optional. Label plan and enhancement items **Needed** or **Nice-to-have** and propose cutting the latter. Delete what a slice didn't need.
- Keep chat short. Details go to `PROJECT_STATE.md` through `state.js`.

## state.js (all calls are one line; use heredoc for multi-line)
```
state.js about "<what we're building>"
state.js set phase="2 Build" slice="3 Dashboard" gate="waiting" next="..." todo="..."
state.js log "slice-3" "what happened" <sha>
state.js q add "<question>"   |   state.js q done <n> "<answer>"
state.js ledger-start slice-3          (at start of a phase/slice/revision)
state.js ledger "Slice 3" slice-3      (at its end: writes scope row + Cumulative)
state.js put "Slice plan" <<'EOF' ... EOF      (also: "Decisions", "Run & verify", "Assumptions")
state.js handoff <<'EOF' ... EOF               (prepends the user to-do block)
```
Batch updates: one `set` + one `log` + one `ledger` per phase/slice end, no more.

## Gates
Every phase and slice ends with a gate: update state, post the gate message (`references/handoff.md`), `AskUserQuestion` with **Approve / Request changes / Pause**, then stop. Never start the next slice before approval. Changes requested: apply, rerun Runner, re-log, gate again. End each gate message with: "Safe to /clear now; type /orchestrate to continue." (state lives in the file, a fresh session is cheaper).
