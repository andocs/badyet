# PROJECT_STATE

<!-- Single source of truth. Written only by haiku-logger. Everything above END SUMMARY must stay short (about 80 lines): Sonnet and /where-am-i read only that part. -->

## 1. What we're building
Project badyet-web: hosted personal budgeting web app converted from Google Sheet "Bad(yet) Sheet" (id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4). Single user, hosted with login. Not a git repo yet.

## 2. Current phase & active slice

- **Phase:** Done
- **Active slice / milestone:** rev-18..25
- **Gate:** none
- **Next action:** Apply 4 migrations; configure Google in Supabase then merge rev-18; merge rev/23; add paid counts, savings balances, 13th/CIP, HMO to the import file; Sept bonus de minimis default
- **User to-do now:** Apply 4 migrations; configure Google in Supabase then merge rev-18; merge rev/23; check payday days in Settings

## 3. Execution log

- earlier: 15 events (2026-11-19 to 2026-11-20) covering rev-5, rev-6, phase3, rev-7..10, redesign, rev-11, rev-12, rev-13, rev-14/15, rev-16, rev-17
- earlier: 15 events (2026-11-19 to 2026-11-19) covering slice-6, slice-7, slice-8, slice-9, phase3, rev-1, rev-2, rev-3, rev-4
- earlier: 15 events (2026-11-19 to 2026-11-19) covering phase1, slice-1, slice-2, slice-3, slice-4, slice-5
- earlier: 15 events (2026-11-19 to 2026-11-19) covering Phase 1, Phase 1 / Gate 1, phase1
- 2026-11-20 09:59 | redesign | Final gate APPROVED by user: rev-11..rev-17. | -
- 2026-11-20 10:18 | ops | User: migrations 20261130000000 and 20261201000000 applied; rev/11..17 merged; default branch moved to main (origin/main contains 9313901, verified). Open: signed-in click-through unconfirmed, Vercel env check unconfirmed, local branch cleanup. | -
- 2026-11-20 10:29 | ops | Git cleanup done: on main (up to date with origin/main), 20 merged local branches deleted incl. stale master. User answers: Google login built before merge and configured by user (magic link removed in same change); balances auto-update on tick (add on tick, subtract on untick); import brings paid counts, savings balances, 13th/CIP, HMO deduction. Q1 (paydays) and Q2 (payslip/CIP inputs) still unanswered; pay-date model NOT started. Plan: rev-18 Google login, rev-19 small features (hide amounts, accounts CSV, auto-sync commitments, mark paid in ritual, balance on tick), rev-20 per-plan Pay/Bonuses, rev-21 tap-to-edit autosave, rev-22 import extras + HMO, rev-23 DESIGN.md regen. | -
- 2026-11-20 10:31 | rev-18 | Google login: Continue with Google (signInWithOAuth), callback requires verified ALLOWED_EMAIL, magic link action and form removed, deploy.md Google setup guide, e2e login test updated. DO NOT MERGE until Google provider is configured in Supabase and tested (see docs/deploy.md). 155 tests, lint, typecheck, build, 24 e2e PASS. | 2202634
- 2026-11-20 10:32 | redesign | Slices added from Q1/Q2 answers: rev-24 pay-date cutoffs (10th/25th, wrapping month), rev-25 windfall de minimis (CIP, September bonus; 13th none). Order: rev-19 batch, rev-24, rev-25, rev-20, rev-21, rev-22 (import + HMO), rev-23 (DESIGN.md). | -
- 2026-11-20 10:34 | rev-19 | Auto-sync of Installments/Subscriptions budget lines (button removed, AutoSync once a day, sync on every change); ticking transfers moves destination balance via apply_transfer_marks (migration 20261202000000, falls back to plain ticks until applied; credit cards go down); Mark paid per installment in payday step 2; Hide amounts (blur, remembered); wallets in CSV export. Migration must be applied. 155 tests, lint, typecheck, build PASS. | c908009
- 2026-11-20 10:37 | rev-24 | Pay-date cutoffs: first = 11-24, second = 25 to 10 next month, belongs to the month it starts in (Jan 5 is Dec second). helpers rebuilt on lib/domain/dates periodOf; Home, Budget, Transfer, Installments, auto-sync use it; Settings has two payday fields (2..27 and later up to 28); migration 20261203000000 adds first_cutoff_start_day and sets existing settings to 11/25. Installment due dates still use the calendar month of the due date. 158 tests, lint, typecheck, build PASS. Migration must be applied. | 6dd5cd4
- 2026-11-20 10:38 | rev-25 | De minimis: per-event exemption on CIP and bonus (never taxed, outside the 90k cap); remainder joins the yearly pool checked against 90k with the 13th month; 13th month locked to 0 (app and DB). Migration 20261204000000. Sept bonus de minimis amount is entered per event (still unconfirmed which figure). 163 tests, lint, typecheck, build PASS. Migration must be applied. | 0b6fcea
- 2026-11-20 10:40 | rev-20 | Pay and Bonuses open on any plan via ?plan= (PlanBar), saves/adds/deletes stay on that plan; addEvent uses the form planId instead of the active plan. 163 tests, lint, typecheck, build PASS. | 175474c
- 2026-11-20 10:42 | rev-21 | Budget lines read at a glance, tap to edit, autosave on leaving a field (saveLineInline), Done/Enter/Escape, delete with confirm; Installments/Subscriptions lines show Automatic and are read-only; budget actions keep ?plan= when editing a non-active plan. 163 tests, typecheck, build, 24 e2e PASS (unused import removed after the run). | f0ee20e
- 2026-11-20 10:44 | rev-22 | HMO/other deduction on Pay (after tax, each cutoff; lowers budget net and take-home, tax unchanged; migration 20261205000000 also updates duplicate_plan to copy it); import snapshot accepts paidCount (writes installment_payments), savings starting balances, windfalls with de minimis; import page counts updated. The snapshot file data/import/sheet-import.json does not yet contain these sections. 167 tests, lint, typecheck, build PASS. Migration must be applied. | 6c36411
- 2026-11-20 10:45 | rev-23 | DESIGN.md merged and refreshed (kept the owner decisions, added token frontmatter, four-destination layout, payday ritual, plan bar, accounts wizard, budget line, Hide amounts, gold text rule). Doctor: dead path fixed; only the size advisory (compact proposal, needs consent) remains. No sidecar .impeccable/design.json written. | 9459625
- 2026-11-20 10:50 | redesign | Final gate APPROVED by user: rev-18..rev-25. | -

## 4. Open questions

- [x] Q3: (blocking Gate 1) Which design direction? Pick v2-a-score, v2-b-route-board, or v2-c-side-a-side-b (docs/mockups/v2-*.html); old a-passbook, b-signal, c-quiet-ledger were rejected 2026-11-19. -> Resolved: Night Emerald chosen at Gate 1 (DESIGN.md); v2 mockups superseded. Redesign round chose direction A (v11-a payday ritual) on 2026-11-20.
- [x] Q1: (non-blocking) CONFIRM items carried over from D:\badyet\docs\financial-logic-spec.md, e.g. cutoff days vs pay dates. -> User 2026-11-20: paydays are the 10th and 25th. Cutoffs are payday-to-payday (old spec: P1 = days 11-24, P2 = 25 to 10 next month), so the calendar split by one start day cannot model it. Building as rev-24 (assumption: first = paid 10th covering 11-24, second = paid 25th covering 25 to 10; a period belongs to the month it starts in).
- [x] Q2: (non-blocking) 2027 CIP tax exemption rule: V-W4 unverified in the old app. -> User 2026-11-20: CIP counts toward the 90,000 cap. CIP and the one-time September bonus each carry their own de minimis exemption (example: 120k CIP has 12k de minimis); the excess goes into the pool that is checked against the 90,000 cap, and anything above the cap is taxable. 13th month has NO de minimis. Building as rev-25 (per-event de minimis amount; 13th month locked to 0). Still need: September bonus de minimis amount.

## 5. Token & usage ledger

Source: estimate (`token_ledger.js` found no transcripts at mark time; rows stay 0 until `row` is run).
in = fresh input + cache writes, cached = cache reads, out = output.

| Scope | Haiku in | Haiku cached | Haiku out | Sonnet in | Sonnet cached | Sonnet out | Note |
|---|---|---|---|---|---|---|---|
| **Cumulative** | 786,543 | 3,902,329 | 179,291 | 1,228,304 | 150,457,898 | 662,260 |  |
| Phase 1 | 201,838 | 781,627 | 50,905 | 240,574 | 12,654,069 | 153,100 |  |
| Slice 1 | 62,731 | 370,397 | 15,215 | 41,667 | 8,438,561 | 24,781 |  |
| Slice 2 | 9,884 | 85,063 | 2,502 | 28,251 | 4,081,821 | 24,667 |  |
| Slice 3 | 45,025 | 161,686 | 9,312 | 68,100 | 13,630,474 | 50,316 | estimate: cumulative minus cumulative at Slice 2 gate (mark was missed); includes 2 revision rounds and bug fixes |
| Slice 4 | 4,852 | 38,354 | 851 | 19,740 | 3,443,967 | 16,439 |  |
| Slice 5 | 2,948 | 40,664 | 877 | 18,622 | 3,164,006 | 14,653 |  |
| Slice 6 | 18,778 | 70,060 | 3,110 | 34,428 | 5,788,748 | 24,935 |  |
| Slice 7 | 6,549 | 64,826 | 2,129 | 24,800 | 4,102,935 | 19,879 |  |
| Slice 8 | 10,233 | 35,048 | 820 | 22,369 | 3,767,210 | 17,380 |  |
| Slice 9 | 13,213 | 106,954 | 3,450 | 32,395 | 8,555,518 | 25,211 |  |
| Rev-1 | 3,644 | 42,355 | 1,093 | 3,857 | 1,180,225 | 1,181 |  |
| Rev-2 | 3,599 | 42,420 | 934 | 5,576 | 1,791,033 | 2,293 |  |
| rev-7..10 | 39,382 | 215,399 | 8,700 | 19,459 | 1,105,451 | 8,538 |  |
| rev-11..17 | 120,085 | 579,997 | 27,820 | 126,989 | 15,445,879 | 70,608 |  |
| rev-18..23 | 131,120 | 618,049 | 26,724 | 177,898 | 35,812,772 | 88,889 |  |

<!-- END SUMMARY -->

---

## Slice plan

| # | Slice | Depends on | Run | Status | Branch |
|---|---|---|---|---|---|
| 1-9 | Scaffold+dashboard, auth/plans, pay, budget, transfer, installments+subscriptions, bonuses, savings forecast, dashboard on real data | - | sequential | merged to master (local) | slice/1..9 |
| rev-1..5 | Phone menu, duplicate plan, cutoff setting, tax/PhilHealth check, sheet import | - | sequential | done, approved | rev/phase3-revisions |
| rev-6 | Mark installment payments paid one by one (migration installment_payments must be applied) | - | sequential | done, approved (91ec216) | rev/6-installment-payments |
| rev-7..10 | CSV export, deploy runbook (docs/deploy.md), Playwright checks (signed-in tests need a saved session, docs/e2e.md) | - | sequential | done, approved (5834ce3) | rev/10-export-deploy-e2e |

### Redesign round (impeccable critique 2026-11-20, score 25/40)
Decisions: direction A "payday ritual" (docs/mockups/v11-a-payday-ritual.html) for Now; plan switching and compare from v11-c; keep Pip, copy voice and Night Emerald; DESIGN.md regeneration deferred ("not now"). No data-model change for commitments (auto-flow deferred). Accounts: store NO full card or account numbers, CVV or PINs (last 4 digits only); see rev-16.

| # | Slice | Depends on | Run | Status | Branch |
|---|---|---|---|---|---|
| rev-11 | Shared cutoff switcher (1st/2nd, defaults to the real current cutoff) in the header via URL, used by Home, Budget, Transfer; fix Transfer opening on the wrong cutoff; delete confirms; login placeholder contrast. **Needed** | - | sequential | approved, next | - |
| rev-12 | Plan switcher in the header: view any plan on Home, Budget, Transfer, Savings without changing the active plan; "viewing, not active" banner; compare two plans (net pay, left to budget, savings per month, savings forecast difference). **Needed** | rev-11 | sequential | approved | - |
| rev-13 | Nav 11 to 4 (Now, Month, Savings, Setup); installments, subscriptions, bonuses become Month sections; phone tab bar = the 4. **Needed** | rev-11 | sequential | approved | - |
| rev-14 | Now = direction A: opens on the current payday step or "N days to the next cutoff" between paydays; wallet checklist tickable in place; charts move to Month. **Needed** | rev-11, rev-13 | sequential | approved | - |
| rev-15 | Payday ritual steps: pay landed, spoken for (commitments), send by wallet, yours to spend with Pip. **Needed** (core of direction A) | rev-14 | sequential | approved | - |
| rev-16 | Accounts wizard: add an e-wallet, debit or credit account step by step; extends wallets with kind, balance (as of date), credit limit, statement and due day; last 4 digits only, never full numbers/CVV/PIN. RLS, input validation, tests, security review. **Needed** | - | sequential | added 2026-11-20 | - |
| rev-17 | Net position on Now/Month: money in accounts, card debt, utilization, due dates, "cash minus debt"; quick "update balance"; balances shown masked (last 4). **Needed** | rev-16, rev-13 | sequential | added 2026-11-20 | - |

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

| What | Command |
|---|---|
| Install deps | `npm install` |
| Env vars | copy `.env.example` to `.env.local`, fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ALLOWED_EMAIL |
| Apply DB migration | easiest: paste `supabase/migrations/20261120000000_plans.sql` into Supabase dashboard > SQL Editor > Run. Or CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push` |
| Start the app | `npm run dev` then open http://localhost:3000 |
| Run tests | `npm test` (70 tests) |
| Typecheck / lint / build | `npm run typecheck` / `npm run lint` / `npm run build` |
| Seed | arrives in a later slice |

## Slice handoffs (what the user does after each slice)

1. Apply these migrations to Supabase, in order: 20261202000000_transfer_marks_balance.sql, 20261203000000_cutoff_paydays.sql (sets your saved settings to paydays 11/25), 20261204000000_windfall_de_minimis.sql, 20261205000000_hmo_deduction.sql.
2. Google login (rev/18-google-login) is on its own branch: set up Google in Supabase first (docs/deploy.md, "Google sign-in"), test it, THEN merge it. Merging it before that locks you out.
3. Merge rev/23-design-md into main (it carries rev-19, 24, 25, 20, 21, 22, 23). If rev-18 is merged too, PROJECT_STATE.md will conflict: keep the rev/23 version.
4. Settings: check the two payday days (11 and 25). Bonuses: enter the de minimis on your CIP and September bonus.
5. Tell me the September bonus de minimis figure if you want it as a default, and whether the sheet has paid counts, savings balances, 13th/CIP and HMO so I can add them to the import file.

1. Apply supabase/migrations/20261130000000_installment_payments.sql and 20261201000000_accounts.sql to Supabase (accounts and Mark paid need them).
2. Merge the rev branches in order (rev/11 ... rev/17) into main; they are stacked.
3. Open the live app signed in and click through Now (payday steps), plan switcher, Compare, Accounts wizard. Signed-in pages were not visually checked.
4. Optional: save a session (docs/e2e.md) and run npm run e2e for signed-in checks.

1. Apply supabase/migrations/20261130000000_installment_payments.sql to Supabase (rev-6).
2. On Vercel, check env vars and Supabase redirect URLs against docs/deploy.md (rev-8).
3. Optional: save a session (docs/e2e.md) then run `npm run e2e` for signed-in page checks (rev-9/10).

AFTER REV-2 (duplicate copies everything): what you do now
1. Get the code:   git checkout rev/phase3-revisions   (one branch for all Phase 3 revisions)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor: run supabase/migrations/20261128000000_duplicate_plan.sql (adds function duplicate_plan). Rollback: drop function public.duplicate_plan(uuid);
4. Config:         none
5. Start the app:  npm run dev  ->  http://localhost:3000/plans
6. Check these:    (a) set up a plan with Pay, a few budget lines (with wallets) and Savings settings; (b) press Duplicate on it: the copy appears named "... (copy)", inactive; (c) Activate the copy: Pay, Budget lines, wallets per line and Savings settings are all there, so you can edit them freely as an estimate; (d) the original is untouched
7. Known limits:   not copied on purpose: transfer ticks and per-month savings overrides (month-specific) and bonuses (dated for the original period); not tested against live Supabase
Reply: Approve / Request changes / Pause

AFTER REV-1 (phone menu): what you do now
1. Get the code:   git checkout rev/1-phone-menu   (merge to master after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000 and narrow the window below 760px (or open it on your phone)
6. Check these:    (a) bottom bar shows Home, Plans, Transfer, Budget, More; (b) tap More: a page lists Pay, Bonuses, Savings forecast, Installments, Subscriptions, plus Theme and Sign out; (c) open one (for example Pay): the More tab stays highlighted; (d) Theme and Sign out work from this page
7. Known limits:   desktop is unchanged (the left rail already lists everything); not visually checked in a browser (rev-9 does that)
Reply: Approve / Request changes / Pause

AFTER SLICE 9: what you do now
1. Get the code:   git checkout slice/9-dashboard-data   (merge to master after you approve)
2. Install deps:   no new deps
3. Database:       no new migrations. All earlier ones (plans ... savings) must be applied.
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000
6. Check these:    (a) the greeting, big "Left to send", wallet cards and Pending transfers now come from your real budget lines for the current cutoff (1st = days 1 to 15, 2nd = 16 to month end); (b) tap "Pending · tap to mark sent" on a transfer, or "Mark all sent": the balance drops, confetti fires, Pip smiles, and the same ticks show on the Cutoff (Transfer) page; (c) the Emergency fund forecast chart uses your Savings settings (or invites you to set them up); (d) the 13th month ring counts days to your next 13th month event with its estimated net; (e) "Spend by cutoff" shows your Essentials / Wants / Savings split for both cutoffs; (f) with no plan, no lines or no savings setup you see friendly prompts instead of empty charts; (g) Theme button and phone width still work
7. Known limits:   the cutoff split (1st = days 1 to 15) is an assumption (open question Q1); not tested against a live Supabase from my side; tax table, PhilHealth and the 90,000 bonus cap are unverified (Q2); all amounts you see are only as good as what you entered; sheet import was not built (you type your data in)
Reply: Approve / Request changes / Pause

AFTER SLICE 8: what you do now
1. Get the code:   git checkout slice/8-savings   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor: run supabase/migrations/20261127000000_savings.sql (adds tables savings_settings and savings_overrides; earlier migrations must be applied). Rollback: drop table public.savings_overrides; drop table public.savings_settings;
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000/savings (needs an active plan; Savings lines on the Budget page feed it)
6. Check these:    (a) first visit: fill "Set up your funds" (start month, balances today, Emergency fund step e.g. 100,000, caps, priority order) and Save; (b) the chart and month-by-month table appear for 12 months: each fund shows its balance, what it received that month, and a status (Saving, Paused, Step reached); (c) the monthly amount comes from your Savings budget lines (both cutoffs); change a line on Budget and the forecast changes; (d) pick "Travel fund first" for one month in "Lead this month" and press Set: that month's money goes there first; (e) add a CIP on Bonuses: its estimated net is added to the month it is paid, marked CIP; (f) if every fund hits its cap you see a note about leftover savings
7. Known limits:   rules (EF steps, Travel resets each January with first call until its cap, EF-first window around a CIP month) come straight from your old app's allocator; adding the CIP net to the savings pool is my reading of "the month whose pool includes the CIP"; fund names are fixed (Emergency, Travel, Wants); not tested against live Supabase
Reply: Approve / Request changes / Pause

AFTER SLICE 7: what you do now
1. Get the code:   git checkout slice/7-bonuses   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor: run supabase/migrations/20261126000000_windfalls.sql (adds tables windfall_events and windfall_allocations; earlier migrations must be applied). Rollback: drop table public.windfall_allocations; drop table public.windfall_events;
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000/bonuses (needs an active plan and Pay set up)
6. Check these:    (a) add a 13th month (leave gross blank = one month of your basic) with a pay date and cutoff: it shows gross, tax-free part, ESTIMATED net, and what is left to allocate; (b) add a CIP: eligible earnings, component % (e.g. 13.81505) and multiplier (e.g. 1.25) give the gross (600,000 x 13.81505% x 1.25 = 103,612.88); (c) under an event, add allocations ("Emergency fund 20,000" etc.): "Left to allocate" goes down, and over-allocating turns it red; (d) tap the circle to mark an allocation as moved: it does NOT change what is left (that is the old app's rule); (e) the yearly 90,000 tax-free cap is shared across events in the same year, so a second bonus in the same year shows less tax-free
7. Known limits:   net amounts are estimates: the 90,000 cap and the method of taxing a bonus (annualizing the cutoff) come from your old app and are unverified (open question Q2); compare with a real payslip; tax overrides on regular pay are not applied to bonus estimates; not tested against live Supabase
Reply: Approve / Request changes / Pause

AFTER SLICE 6: what you do now
1. Get the code:   git checkout slice/6-installments   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor: run supabase/migrations/20261125000000_installments_subscriptions.sql (adds tables installments and subscriptions and a "source" column on budget_lines; the wallets migration must already be applied). Rollback: alter table public.budget_lines drop column source; drop table public.subscriptions; drop table public.installments;
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000/installments and /subscriptions
6. Check these:    (a) add an installment (price, optional down payment, number of payments, yearly interest %, first payment date, cutoff, wallet): the list shows the monthly payment, payments left and end month, plus interest cost; try 20,000 at 6% over 60 payments: 386.66 each, interest 3,199.36; (b) add a subscription with an amount, cutoff and wallet; Pause and Resume it; (c) press "Sync to budget": the Budget page now has Essentials lines "Installments" and "Subscriptions" per cutoff equal to what is due this month; edit your installment, sync again and the line updates (your own other budget lines are never touched); (d) the lines show on the Transfer checklist under their wallet once you pick a wallet for them on the Budget page
7. Known limits:   sync uses what is due in the current month (Manila time); it does not auto-run, press it when things change; installments are not marked paid one by one (remaining is counted by due date); not tested against live Supabase
Reply: Approve / Request changes / Pause

AFTER SLICE 5: what you do now
1. Get the code:   git checkout slice/5-transfer   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor: run supabase/migrations/20261124000000_wallets_transfers.sql (adds tables wallets and transfer_marks, and a wallet_id column on budget_lines; earlier migrations must be applied). Rollback: drop table public.transfer_marks; alter table public.budget_lines drop column wallet_id; drop table public.wallets;
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000/transfer (left rail "Cutoff")
6. Check these:    (a) first visit: press "Add Gcash, Maya, BPI, Vybe" in the Wallets card (or add your own); (b) Budget page: each line now has a wallet dropdown, pick one and Save; (c) Transfer page: lines appear grouped by wallet with totals, tap the circle to tick a transfer sent, tap again to undo; (d) the top card shows "X left of Y" and a progress bar, and "All sent" when done; (e) switch 1st / 2nd cutoff and step months with the arrows: ticks are kept per month, so next month starts fresh; (f) deleting a wallet keeps its lines under "No wallet yet"
7. Known limits:   dashboard still uses sample data until Slice 9; not tested against live Supabase; "sent" is per line per month (a plan can run for many months)
Reply: Approve / Request changes / Pause

AFTER SLICE 4: what you do now
1. Get the code:   git checkout slice/4-budget   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor: run supabase/migrations/20261123000000_budget_lines.sql (adds table budget_lines with row-level security; earlier migrations must already be applied). Rollback: drop table public.budget_lines;
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000/budget (needs an active plan and Pay set up)
6. Check these:    (a) the top card shows net pay to budget for the chosen cutoff and "X has no job yet" until you allocate it all; (b) add lines under Essentials, Wants and Savings, edit an amount and Save, delete one; (c) when lines add up to the net it says "Every peso has a job", and if you overshoot it says "Over by" in red; (d) switch 1st / 2nd cutoff, each has its own lines; (e) Month roll-up shows net, budgeted and left for 1st, 2nd and the month; (f) a negative amount (like -2,099) is accepted for reimbursements
7. Known limits:   wallets per line and the To Transfer checklist come in Slice 5; lines are typed in by hand (no import from your sheet yet); not tested against live Supabase; the net amount is "net to budget" (before the payroll savings plan), as the old sheet budgeted
Reply: Approve / Request changes / Pause

AFTER SLICE 3 (revision): what you do now
1. Get the code:   git checkout slice/3-pay   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase SQL Editor, run in order if not yet applied: 20261120000000_plans.sql, 20261121000000_pay_profiles.sql, then NEW 20261122000000_plans_open_ended.sql (lets a plan have no end date). Rollback for the new one: alter table public.plans alter column end_date set not null; (only if no plan has a blank end date)
4. Config:         none new
5. Start the app:  npm run dev  ->  http://localhost:3000/plans then /pay
6. Check these:    (a) Plans: create a plan with the Ends field blank; it shows "Dec 10, 2026 onwards" and is never marked past; (b) activate it; (c) Pay: wizard step 1 pick Monthly or Annual and type your base, see the year/month/cutoff figures appear; (d) step 2 allowance, SSS, Pag-IBIG (PhilHealth is calculated); (e) step 3 optional savings plan % and overrides; (f) step 4 review table, Save; (g) "Edit pay" reopens the wizard with your values; Enter moves to the next step instead of submitting
7. Known limits:   tax table (TRAIN 2023) and PhilHealth 5% unverified (flagged on screen); not tested against live Supabase; SSS is typed from your payslip, not auto-calculated (the SSS table is not in the app)
Reply: Approve / Request changes / Pause

AFTER SLICE 3: what you do now
1. Get the code:   git checkout slice/3-pay   (local branch; merge to master after you approve)
2. Install deps:   no new deps
3. Database:       Supabase dashboard > SQL Editor: paste supabase/migrations/20261121000000_pay_profiles.sql and Run (adds table pay_profiles with row-level security; slice 2 migration must already be applied). Rollback: drop table public.pay_profiles;
4. Config:         none new
5. Start the app:  npm run dev  ->  open http://localhost:3000/pay (needs an active plan from Plans)
6. Check these:    (a) enter your annual base, allowance, SSS, Pag-IBIG, savings plan % and Save; (b) the table shows 1st cutoff / 2nd cutoff / Month with basic, allowance, mandatory, tax, net to budget, savings plan, lands in your account; (c) compare against a real payslip: if tax or PhilHealth differ, type the payslip value in the override field and it replaces the calculated one; (d) a plan that has ended shows pay read-only; (e) no active plan shows a "Go to Plans" prompt
7. Known limits:   tax table (TRAIN 2023) and PhilHealth 5% are carried over from the old app and unverified (Q1/Q2, flagged on screen); not tested against live Supabase; the old sheet's totals (25,008.38 / 24,356.50) are not asserted yet because they need your real salary, which is not stored in the repo. Dashboard still sample data until Slice 9.
Reply: Approve / Request changes / Pause

AFTER SLICE 2: what you do now
1. Get the code:   git checkout slice/2-auth-db-plans   (local branch; merge to master after you approve)
2. Install deps:   npm install   (new: @supabase/supabase-js, @supabase/ssr)
3. Database:       create a free project at supabase.com. Open SQL Editor, paste supabase/migrations/20261120000000_plans.sql, Run. Creates table "plans" with row-level security. Empty project, so no backup needed. Rollback: run the last line of that file (drop function public.activate_plan(uuid); drop table public.plans;).
4. Config:         copy .env.example to .env.local and fill: NEXT_PUBLIC_SUPABASE_URL (Project Settings > API > Project URL), NEXT_PUBLIC_SUPABASE_ANON_KEY (same page, anon public key), ALLOWED_EMAIL=<your email>. In Supabase: Authentication > Users > Add user > your email (tick auto-confirm). Then Authentication > Sign In / Providers > Email: turn OFF "Allow new users to sign up". Authentication > URL Configuration: Site URL http://localhost:3000 and add http://localhost:3000/auth/callback to Redirect URLs.
5. Start the app:  npm run dev  ->  open http://localhost:3000 (you are sent to /login)
6. Check these:    (a) enter your email, get the magic link, click it, land on the dashboard; (b) a different email gets the same "check your inbox" message but no mail; (c) Plans page: create a plan, duplicate it, activate one (the other loses "Active"), edit dates, delete a non-active plan; (d) a plan whose end date is before today shows "Past, read-only" and cannot be edited or activated; (e) Sign out (left rail) returns to /login and / is blocked until you log in again
7. Known limits:   I could not test against a live Supabase from here, so the login and plans flow is unverified end to end (70 unit tests, typecheck, lint and build pass). Dashboard still shows sample data until Slice 9. Seed script skeleton is deferred to Slice 4 where the data lands.
Reply: Approve / Request changes / Pause

AFTER SLICE 1: what you do now
1. Get the code:   git checkout slice/1-scaffold-dashboard   (local branch, no remote yet; merge to master after you approve)
2. Install deps:   npm install   (already done in this folder)
3. Database:       no DB changes
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000
6. Check these:    (a) dashboard shows greeting, big "Left to send" balance, Pip, 4 wallet cards, forecast, 13th month ring, cutoff bars, pending transfers; (b) "Mark all sent" fires confetti and Pip smiles, and tapping a pending transfer marks it sent and updates the balance; (c) Theme button flips dark/light and remembers it; (d) narrow the window under 760px: bottom tab bar appears; (e) corners: square cards, round buttons/pills/avatars
7. Known limits:   sample data only (synthetic, not your sheet); no login; other nav items are disabled; not visually verified by me (no browser here), so expect small CSS fixes
Reply: Approve / Request changes / Pause

_None yet._

## Assumptions, risks & sources
- Assumptions: none recorded beyond D1-D8.
- Security / compliance notes: the sheet contains personal financial data and family names, so the import snapshot JSON is gitignored and never committed; the seed uses the service-role key only locally. Single allowed email is enforced server-side and by RLS.
- Cleanup: D:\badyet now also contains orchestrator .claude files and a PROJECT_STATE.md added this session (can be removed later).
- Sources: Google Sheet id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4; D:\badyet\docs\financial-logic-spec.md.
- Token numbers come from Claude Code session transcripts; they exclude anything run outside this project directory.
