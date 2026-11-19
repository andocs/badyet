# PROJECT_STATE

<!-- Single source of truth. Written only via .claude/scripts/state.js (never hand-edit). Everything above the end-of-summary marker must stay short (about 80 lines): Sonnet and /where-am-i read only that part. -->

## 1. What we're building
_One to three sentences. Fill in after Phase 1 discovery._

## 2. Current phase & active slice
- **Phase:** 1 Plan & Design
- **Active slice / milestone:** none yet
- **Gate:** none open
- **Next action:** Claude: run discovery
- **User to-do now:** none

## 3. Execution log
<!-- newest last: - YYYY-MM-DD HH:MM | phase/slice | what happened or was decided | sha -->
- {{DATE}} | Phase 1 | Project state created | -

## 4. Open questions
<!-- - [ ] Q1: ...   resolved: - [x] Q1: ... -> answer -->
_None._

## 5. Token & usage ledger
Source: transcript (falls back to `estimate` with `~` numbers). in = fresh input + cache writes, cached = cache reads, out = output.

| Scope | Haiku in | Haiku cached | Haiku out | Sonnet in | Sonnet cached | Sonnet out | Note |
|---|---|---|---|---|---|---|---|
| **Cumulative** | 0 | 0 | 0 | 0 | 0 | 0 | |
| Phase 1 | | | | | | | |

<!-- END SUMMARY -->

---

## Slice plan
| # | Slice | Depends on | Run | Status | Branch |
|---|---|---|---|---|---|
| | | | sequential / parallel | planned / building / awaiting gate / approved | |

## Decisions & architecture
- Stack:
- Chosen design direction:
- Key decisions:

## Run & verify guide (detected by Scout, kept current)
| What | Command |
|---|---|
| Install deps | |
| Apply DB migrations | |
| Seed data | |
| Start the app | |
| URL | |
| Run tests | |
| Lint / build | |
| Required env vars | |

## Slice handoffs (what the user does after each slice)
<!-- One block per slice/revision, newest first. Format defined in the orchestrate skill. -->

## Assumptions, risks & sources
- Assumptions:
- Security / compliance notes:
- Token numbers come from Claude Code session transcripts; they exclude anything run outside this project directory.
