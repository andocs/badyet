# Phase 2: Build (per approved slice)

1. `state.js ledger-start slice-N`; `state.js set slice="N <name>" phase="2 Build" gate="none"`.
2. **Brief.** Ask the Scout only for the files and line ranges this slice touches (skip for greenfield). Keep your own brief to: goal, acceptance criteria, files, decisions, test command.
3. **Build.** Sequential: build it yourself, Read/Write/Edit on listed files only. Parallel (independent slices only): one `sonnet-builder` per slice in the same message, each with `isolation: "worktree"`; gate and merge them one at a time. Write tests for every acceptance criterion. Migrations get a rollback; never edit past migrations.
4. **Test loop.** `haiku-runner` once for tests + lint + build. FAIL: fix, rerun (attempt 1); FAIL: fix, rerun (attempt 2); FAIL again: stop and ask the user.
5. **Review.** Check the change against acceptance criteria and the Phase 1 security notes; remove anything not needed.
6. **Git.** `node .claude/scripts/ship.js slice N <slug> "<what changed>"` (one-line result; if `LOCAL-ONLY`, tell the user why).
7. **Log, once.** `state.js ledger "Slice N" slice-N`, `state.js handoff <<'EOF' ...` (format in `references/handoff.md`), `state.js log "slice-N" "<summary>" <sha>`, `state.js set gate="waiting" next="..." todo="..."`.
8. **Gate 2.** Gate message with the user to-do block. Wait for approval.
