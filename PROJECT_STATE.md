# PROJECT_STATE

<!-- Single source of truth. Written only by haiku-logger. Everything above END SUMMARY must stay short (about 80 lines): Sonnet and /where-am-i read only that part. -->

## 1. What we're building
Project badyet-web: hosted personal budgeting web app converted from Google Sheet "Bad(yet) Sheet" (id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4). Single user, hosted with login. Not a git repo yet.

## 2. Current phase & active slice

- **Phase:** 2 Build
- **Active slice / milestone:** 1 Scaffold + theme + Dashboard (sample data)
- **Gate:** building
- **Next action:** Build Slice 1; then gate
- **User to-do now:** git init and add a remote (needed for slice branches/push)

## 3. Execution log

- 2026-11-19 --:-- | Phase 1 | Read all 14 sheet tabs; found existing Expo app in D:\badyet; user chose a new web app in D:\projects\badyet reusing its logic; decisions D1-D8 recorded | -
- 2026-11-19 20:08 | Phase 1 | PROJECT_STATE.md created from state-sync template; ledger marks project-start and phase1 set | -
- 2026-11-19 --:-- | Phase 1 | 3 design mockups written to docs/mockups/: a-passbook.html (warm paper, Fraunces + Plex Mono, terracotta #B4532A), b-signal.html (navy #10233F + yellow #F2C230, Archivo Black + Space Grotesk, wallet tiles), c-quiet-ledger.html (Plex Sans/Mono, teal #1F7A6E / amber #C98A1B / plum #7A4E6E, sidebar desktop) | -
- 2026-11-19 --:-- | Phase 1 / Gate 1 | PAUSED by user: all 3 mockups rejected (files kept as reference). New mockups to be made with /impeccable, which is not installed in this session. On resume: install /impeccable, restart Claude Code, regenerate directions, re-run Gate 1 (design pick + plan approval) | -
- 2026-11-19 --:-- | Phase 1 | Installed impeccable skill (npx skills add pbakaus/impeccable) to .claude/skills/impeccable; skills.sh audit: Gen Safe, Socket 0 alerts, Snyk Critical Risk (unreviewed). Needs Claude Code restart before /impeccable works | -
- 2026-11-19 --:-- | Phase 1 | Impeccable: hooks on, PRODUCT.md written (web, phone+desktop, playful voice, WCAG AA + dark mode). 3 new Operate-mode mockups in docs/mockups/: v2-a-score.html (labanotation-style month score, cobalt/ink, Familjen Grotesk), v2-b-route-board.html (wallet transit routes, deep green rail + yellow, Atkinson Hyperlegible), v2-c-side-a-side-b.html (mixtape j-card, ballpoint blue + red, Patrick Hand headings). Synthetic data, not sheet values. Not visually verified (no Chrome for impeccable shot); awaiting user pick | -
- 2026-11-19 20:32 | phase1 | User leaning v2-a/v2-b. Added v3 set in docs/mockups/: v3-a-score-plus.html (A score + B green rail, blocks coloured by wallet), v3-b-route-by-amount.html (B route map in A calm cobalt palette, stops spaced by amount), v3-c-pay-and-budget.html (Pay + Budget screen in the hybrid world, editable lines with over/under states). Hook scanned clean; not visually verified (no Chrome). Gate 1 still awaiting pick. | -
- 2026-11-19 20:35 | phase1 | User wants dashboard first. Added 3 dashboard mockups in docs/mockups/: v4-a-dashboard-score.html (next-send list + month score + funds + coming up), v4-b-dashboard-route.html (wallet tiles with stop dots, next stops, timeline), v4-c-dashboard-timeline.html (next-action bar + month ruler with pay days/bills/13th month). Hook clean; not visually verified (no Chrome). Gate 1 awaiting pick. | -
- 2026-11-19 20:39 | phase1 | Added docs/mockups/v5-gallery.html: one file, 6 new dashboard designs (Slate Score, Night Route, Pandan, Two-Ink, Transit Paper, Dusk Timeline) with arrow-key browsing and Desktop/Phone toggle. Hook clean; not visually verified. Gate 1 awaiting pick. | -
- 2026-11-19 20:44 | phase1 | User disliked v2-v5. Added docs/mockups/v6-gallery.html (built without impeccable workflow): 6 familiar-style designs (Mint, Pocket, Sheet, Boards, Bento, Calendar), each a different layout. Awaiting user pick/feedback. | -
- 2026-11-19 20:50 | phase1 | User: designs felt plain/off; wants rich+premium, charts, mascot, gradients, motion, like their trip planner app (K:\projects\trip-planner, Atlas x Departure Board). Added docs/mockups/v7-gallery.html: 5 designs in that visual language (split-flap board for amounts, boarding-pass tickets per transfer, donut/area/stacked charts, coin mascot Pip, confetti). Hook clean; not visually verified. Awaiting feedback/pick. | -
- 2026-11-19 20:54 | phase1 | User liked v7 designs 2,3,5 (Night Board, Atlas, Control Room) but wants a finance feel, not travel, and different fonts. Added docs/mockups/v8-gallery.html: 3 designs (Night, Daylight, Control Room), Plus Jakarta Sans + Manrope, emerald/blue/gold palette, transaction rows and bank-style wallet cards replace tickets and flap board, Pip mascot keeps (sprout instead of cap), Light/Dark toggle. Hook clean; not visually verified. Awaiting feedback/pick. | -
- 2026-11-19 20:58 | phase1 | User liked v8 dash 1 layout (greeting + big balance), wallet cards and 13th month ring. Added docs/mockups/v9-gallery.html: 5 variants combining them (Night Emerald, Ink and Gold, Daylight Blue, Fresh Mint, Violet Night), different palettes/fonts/layout arrangements. JS syntax + render smoke test passed; not visually verified (no Chrome). Awaiting pick. | -
- 2026-11-19 21:04 | phase1 | User leaning to v9 design 1 (Night Emerald) but too rounded; wants other colour schemes. Added docs/mockups/v10-gallery.html: 5 variants of that layout with sharper corners (4-14px) and new palettes (Cobalt Night, Amber Ledger, Rose Night, Graphite Lime, Navy and Orange light). Checks: syntax, render, no global-name collisions; not visually verified. | -
- 2026-11-19 21:05 | phase1 | User chose v9 design 1 (Night Emerald). Wrote DESIGN.md (tokens dark+light, Plus Jakarta Sans + Manrope, components). Slice plan updated: slice 1 now includes theme + shell; new slice 8 Dashboard. Gate 1 awaiting plan approval. | -
- 2026-11-19 21:07 | phase1 | Gate 1 APPROVED by user: Night Emerald design + plan, with changes: dashboard first (Slice 1 now scaffold+theme+dashboard on sample data; auth/plans moved to Slice 2; real-data wiring is Slice 9) and less round corners with contrast (square cards, round controls) recorded in DESIGN.md. | -

## 4. Open questions
<!-- - [ ] Q1: ...   resolved: - [x] Q1: ... -> answer -->
Blocking: Q3 (blocks Gate 1).
- [ ] Q1: (non-blocking) CONFIRM items carried over from D:\badyet\docs\financial-logic-spec.md, e.g. cutoff days vs pay dates.
- [ ] Q2: (non-blocking) 2027 CIP tax exemption rule: V-W4 unverified in the old app.
- [ ] Q3: (blocking Gate 1) Which design direction? Pick v2-a-score, v2-b-route-board, or v2-c-side-a-side-b (docs/mockups/v2-*.html); old a-passbook, b-signal, c-quiet-ledger were rejected 2026-11-19.

## 5. Token & usage ledger

Source: estimate (`token_ledger.js` found no transcripts at mark time; rows stay 0 until `row` is run).
in = fresh input + cache writes, cached = cache reads, out = output.

| Scope | Haiku in | Haiku cached | Haiku out | Sonnet in | Sonnet cached | Sonnet out | Note |
|---|---|---|---|---|---|---|---|
| **Cumulative** | 201,838 | 781,627 | 50,905 | 240,574 | 12,654,069 | 153,100 |  |
| Phase 1 | 201,838 | 781,627 | 50,905 | 240,574 | 12,654,069 | 153,100 |  |

<!-- END SUMMARY -->

---

## Slice plan

| # | Slice | Depends on | Run | Status | Branch |
|---|---|---|---|---|---|
| 1 | Scaffold + theme + **Dashboard on sample data**: Next.js app, design tokens (dark default + light, DESIGN.md radii: square cards, round controls), app shell (rail / bottom tabs), the full dashboard (greeting, hero balance, wallet cards, 13th month ring, forecast + cutoff charts, pending transfers, Pip), sample data from a local fixture, domain logic copied with tests passing. No login yet. **Needed** | none | sequential | planned | - |
| 2 | Auth, DB and plans: Supabase schema + RLS, magic-link login limited to ALLOWED_EMAIL, plans CRUD (create/duplicate/activate/date range), gitignored sheet snapshot + seed script skeleton. **Needed** | 1 | sequential | planned | - |
| 3 | Pay: per-plan salary screen; annual base -> per-cutoff earnings, deductions, tax, net; overrides. **Needed** | 2 | sequential | planned | - |
| 4 | Budget split: Essentials/Wants/Savings lines per cutoff + monthly roll-up, budget-left vs net pay, seeded from sheet. **Needed** | 3 | sequential | planned | - |
| 5 | To Transfer: wallets (Gcash, Maya, BPI, Vybe), wallet per line, per-cutoff checklist with done state. **Needed** | 4 | sequential | planned | - |
| 6 | Installments & subscriptions trackers feeding Essentials. **Needed** | 4 | parallel with 7 | planned | - |
| 7 | Bonuses: 13th month and CIP computation + allocation checklists. **Needed** | 3 | parallel with 6 | planned | - |
| 8 | Savings forecast: funds with caps, priority rules, month-by-month projection. **Needed** | 4 | sequential | planned | - |
| 9 | Wire dashboard to real data (replace sample fixture with plan data from slices 3-8). **Needed**. Pip confetti polish is **Nice-to-have** | 5, 7, 8 | sequential | planned | - |

## Decisions & architecture
- Stack: Next.js (App Router, TypeScript) on Vercel + Supabase (Postgres; Auth magic link restricted to one allowed email; RLS by user_id).
- Chosen design direction: none yet (Gate 1 paused 2026-11-19; the 3 existing mockups were rejected; new ones to be made with /impeccable).
- Key decisions (2026-11-19, all answered by user):
  - D1 Data: app owns data; one-time import from the sheet; sheet retired.
  - D2 Hosting: single user, hosted with login. Stack as above.
  - D3 MVP scope: core budget flow (salary/tax -> budget split -> essentials/wants/savings -> to-transfer by wallet with checkboxes), bonuses (13th month, CIP), installments & subscriptions, savings forecast.
  - D4 AI Advisor / Scenario Planner: dropped.
  - D5 Versions: named plans with date ranges; one active; duplicate to create estimates; past plans read-only.
  - D6 Salary: auto-calculate from annual base (SSS, PhilHealth, Pag-IBIG, PH income tax table, allowances) with per-line overrides.
  - D7 Location: new app in D:\projects\badyet. The old Expo/Android app at D:\badyet stays untouched as reference. Reuse its pure logic (src/domain: money in centavos, pay.ts, budget.ts, allocator.ts, windfall.ts and their Vitest tests, docs/financial-logic-spec.md) by copying into lib/domain. Later the user plans to port back to an Expo Android app.
  - D8 Money stored as integer centavos; dates in Asia/Manila.

## Run & verify guide (detected by Scout, kept current)
Planned from the Phase 1 plan; not yet verified (app not scaffolded). Node 22.
| What | Command |
|---|---|
| Install deps | `npm install` |
| Apply DB migrations | `npx supabase link`, then `npx supabase db push` |
| Seed data | `npm run seed` (local only, uses service-role key) |
| Start the app | `npm run dev` |
| URL | http://localhost:3000 |
| Run tests | `npm test` |
| Lint / build | `npm run lint` / `npm run build` |
| Required env vars | `.env.local`: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (seed only, local), ALLOWED_EMAIL |

## Slice handoffs (what the user does after each slice)
<!-- One block per slice/revision, newest first. Format defined in the orchestrate skill. -->
_None yet._

## Assumptions, risks & sources
- Assumptions: none recorded beyond D1-D8.
- Security / compliance notes: the sheet contains personal financial data and family names, so the import snapshot JSON is gitignored and never committed; the seed uses the service-role key only locally. Single allowed email is enforced server-side and by RLS.
- Cleanup: D:\badyet now also contains orchestrator .claude files and a PROJECT_STATE.md added this session (can be removed later).
- Sources: Google Sheet id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4; D:\badyet\docs\financial-logic-spec.md.
- Token numbers come from Claude Code session transcripts; they exclude anything run outside this project directory.
