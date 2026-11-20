# PROJECT_STATE

<!-- Single source of truth. Written only by haiku-logger. Everything above END SUMMARY must stay short (about 80 lines): Sonnet and /where-am-i read only that part. -->

## 1. What we're building
Project badyet-web: hosted personal budgeting web app converted from Google Sheet "Bad(yet) Sheet" (id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4). Single user, hosted with login. Not a git repo yet.

## 2. Current phase & active slice

- **Phase:** 2 Build
- **Active slice / milestone:** 3 Accounts and Inbox
- **Gate:** none
- **Next action:** Build slice 3 (Accounts and Inbox). Apply the wants-fund rename migration and check Now in a browser first.
- **User to-do now:** Apply 20261206000200_rename_wants_fund.sql, run the app and check Now on phone and desktop, push slice/2-shell-theme-now.

## 3. Execution log

- earlier: 15 events (2026-11-20 to 2026-11-20) covering ops, rev-27, rev-28, rev-29, rev-30, rev-31, rev-32, rev-33, rev-34, rev-35, rev-36
- earlier: 15 events (2026-11-20 to 2026-11-20) covering redesign, ops, rev-18, rev-19, rev-24, rev-25, rev-20, rev-21, rev-22, rev-23
- earlier: 15 events (2026-11-19 to 2026-11-20) covering rev-5, rev-6, phase3, rev-7..10, redesign, rev-11, rev-12, rev-13, rev-14/15, rev-16, rev-17
- earlier: 15 events (2026-11-19 to 2026-11-19) covering slice-6, slice-7, slice-8, slice-9, phase3, rev-1, rev-2, rev-3, rev-4
- earlier: 15 events (2026-11-19 to 2026-11-19) covering phase1, slice-1, slice-2, slice-3, slice-4, slice-5
- earlier: 15 events (2026-11-19 to 2026-11-19) covering Phase 1, Phase 1 / Gate 1, phase1
- 2026-11-20 16:28 | design-v13 | Rehaul design round: docs/rehaul/ia.md (IA, flows, 12 open questions), docs/rehaul/model.md (data model sketch, migration map), 16 mockups docs/mockups/v13-*.html + shared v13-shared.css/js and sample-data v13-data.js, gallery v13-gallery.html. 3 directions each for Now, Forecast, Month override; 2 scenario display options. No app code, migrations or tests changed. Mockups checked in screenshots (dark and light, 375 and 1280) for a subset, not every page. Waiting for the user's pick. | -
- 2026-11-20 16:34 | design-v13 | Gallery opened in the user's browser (docs/mockups/v13-gallery.html). Gate still waiting for the user's direction picks and answers to the 12 open questions in docs/rehaul/ia.md. | -
- 2026-11-20 17:51 | design-v13 | Round 2 from review notes: merged Now (A hero + C runway chart + B envelopes + account colour cards), Inbox opens on All activity with desktop wide cards and details panel, Accounts as colour cards with saved receive-QR, Salary and tax calculator (monthly/yearly allowances, payslip with bracket working), Budget group/line redesign, Bonuses (one-offs, past years, mini-budget hero, editable split), single Forecast (stacked or lines, year ladder), Override A single + B bulk, scenario pills removed, wizards for first run / raise / bonus. Removed now-a/b/c, forecast-a/b/c, override-c. ia.md and model.md updated. No app code touched. | -
- 2026-11-20 17:57 | design-v13 | Round 1 mockups restored under docs/mockups/round1/ (gallery: round1/v13-gallery.html) for side-by-side comparison; linked from the round 2 gallery. | -
- 2026-11-20 18:22 | design-v13 | Round 3 from review notes: full-width content; Now (full-width hero, scrolling account row, 70/30 planned vs recent); Inbox (2-4 cards per row, All activity at right); Salary and tax (chart top, Timeline/Payslip tabs, assumptions moved to wizard); raise wizard + first run get contribution overrides; Bonuses (year tabs fixed, custom flat/percent destinations); Forecast (no assumptions, isolate fund lines, Chart/Year by year switch). ia.md and model.md updated. No app code touched. | -
- 2026-11-20 18:39 | design-v13 | Round 4 notes applied: Now hero narrowed with Recent beside it, Inbox cards redesigned, Salary tabs moved under title and two-panel payslip, Bonuses explicit + Add destination with custom names. No app code touched. | -
- 2026-11-20 19:00 | design-v13 | Round 5 notes applied: Now hero ~75% with narrower Recent, Hide amounts button (also wired in Settings), Bills and transfers as a right column beside planned vs spent; Inbox desktop cards reworked (icon+name header, notification line with time at right, bigger amount, pills row, no Details button, smaller standard Confirm/Not mine buttons). No app code touched. | -
- 2026-11-20 19:10 | design-v13 | Round 6: Now planned vs spent fills the space (envelopes open, stretched); Hide amounts now turns pesos into asterisks (all pages, Settings switch synced); Inbox To check fixed at 2 cards per row. No app code touched. | -
- 2026-11-20 19:12 | design-v13 | User approved the v13 design (docs/mockups/v13-gallery.html, docs/rehaul/ia.md, model.md). Gate passed. Next: build planning (slices + defaults for the 15 open questions). | -
- 2026-11-20 19:23 | design-v13 | Open questions answered (ia.md now has a Decisions section). New requirements: counts-to-daily ticker per budget line, RTO budget (per office day amount, contingency line, In office today switch), per-cutoff payslip builder (1st: income tax; 2nd: contributions + allowances), inflation removed, virtual funds, web first then Android, no backup. | -
- 2026-11-20 19:31 | design-v13 | Round 7 mockups of the new pieces: Budget Daily switch per line and Office days (RTO) card with RTO and contingency lines; Now In office today switch; Salary and tax payslip builder (one payslip per cutoff, move/override/add lines, base split, tax working) with two-cutoff chart and year table; inflation removed from mockups; wizards point to the builder. No app code touched. | -
- 2026-11-20 19:49 | design-v13 | Round 8 mockups: Now drops the switch (office days from the calendar, only usual days count); Budget office-day card tidied and new Pools card (use, move to Wants, excess); Salary payslip builder reworked: tables with inline add row, income tax in both cutoffs, per-allowance taxable switches, 13th month and CIP lines on the payslip, bonuses column in the year table. ia.md and model.md updated. No app code touched. | -
- 2026-11-20 20:04 | design-v13 | Round 9: Budget office-day card back to the day-grid layout with tidier spacing (usual days, auto-detected extra days tagged, tap to correct); extra days draw from the contingency pool automatically via the RTO days line; tickers (Daily, RTO days, RTO contingency) moved into the line editor and removed from the rows; Salary tax working table shows all brackets with the highlight; payslip notes say where bonuses and allowances come from. ia.md and model.md updated. No app code touched. | -
- 2026-11-20 20:17 | design-v13 | Round 10: multiple RTO lines + one contingency (no per-day or spontaneous-day inputs, derived); extra days are manual; settle office days (under: pool or Wants, over: Wants or contingency excess) with Now nudge; allowance and bonus lands-in cutoff settings read by the payslip builder. ia.md and model.md updated. No app code touched. | -
- 2026-11-20 20:34 | design-v13 | Round 11: Now envelopes always open and fill the height (no collapse); Budget settle-office-days moved to its own card at the top of the right column; Bonuses show the lands-in cutoff only when a rule is being edited. No app code touched. | -
- 2026-11-20 20:46 | design-v13 | Round 12: Now envelopes collapsible again and not stretched; Budget settle card hidden when nothing to settle (Now card follows); bonus rule edit reopens the wizard; raise wizard simplified (no assumptions step, no assumptions-only option, adds expected vs confirmed); Salary and tax gets a Projected raises card and hollow markers for expected raises. ia.md and model.md updated. No app code touched. | -
- 2026-11-20 20:59 | design-v13 | Round 13: the three raise-planning gaps added. Budget Future years marks months that include an expected raise and has a Compare without expected raises switch; raise wizard has a Where does the extra go step (top-ups tied to the raise, tagged on Budget lines); Forecast shows a with / without expected raises total. ia.md and model.md updated. No app code touched. | -
- 2026-11-20 21:02 | design-v13 | Round 14: both limits fixed. Raise top-ups now live in the shared budget rules (v13-data.js), so Forecast and Budget agree and the with/without views drop top-ups tied to expected raises; the raise wizard's summary text follows the extra you place. No app code touched. | -
- 2026-11-20 21:03 | design-v13 | Design approved by the user. Slice plan, decisions and handoff written to PROJECT_STATE.md. Ready to hand over to a fresh session for slice 1. | -
- 2026-11-20 21:19 | slice-1 | Migrations (schema + data move, rollbacks), pure engine in lib/engine (months, salary timeline, payslip builder, bonuses, budget evaluator, office days/pools, fund allocator, with/without expected runner) and tests. Tests, typecheck, lint, build pass. SQL not executed against a database. | 7f02687
- 2026-11-20 21:19 | slice-1 | Slice 1 approved by the user. | 7f02687
- 2026-11-20 21:30 | slice-2 | Shell (rail + 5 phone tabs), scoped Night Emerald styles, Now page from the new tables via the engine, quick add (dialog + server action, N shortcut), Inbox placeholder, balances and row mappers with tests. Old home page and dashboard removed. Committed locally, not pushed. Not opened in a browser. | 7d51077
- 2026-11-20 21:30 | slice-2 | Slice 2 approved by the user. | 7d51077

## 4. Open questions

- [x] Q3: (blocking Gate 1) Which design direction? Pick v2-a-score, v2-b-route-board, or v2-c-side-a-side-b (docs/mockups/v2-*.html); old a-passbook, b-signal, c-quiet-ledger were rejected 2026-11-19. -> Resolved: Night Emerald chosen at Gate 1 (DESIGN.md); v2 mockups superseded. Redesign round chose direction A (v11-a payday ritual) on 2026-11-20.
- [x] Q1: (non-blocking) CONFIRM items carried over from D:\badyet\docs\financial-logic-spec.md, e.g. cutoff days vs pay dates. -> User 2026-11-20: paydays are the 10th and 25th. Cutoffs are payday-to-payday (old spec: P1 = days 11-24, P2 = 25 to 10 next month), so the calendar split by one start day cannot model it. Building as rev-24 (assumption: first = paid 10th covering 11-24, second = paid 25th covering 25 to 10; a period belongs to the month it starts in).
- [x] Q2: (non-blocking) 2027 CIP tax exemption rule: V-W4 unverified in the old app. -> User 2026-11-20: CIP counts toward the 90,000 cap. CIP and the one-time September bonus each carry their own de minimis exemption (example: 120k CIP has 12k de minimis); the excess goes into the pool that is checked against the 90,000 cap, and anything above the cap is taxable. 13th month has NO de minimis. Building as rev-25 (per-event de minimis amount; 13th month locked to 0). Still need: September bonus de minimis amount.
- [x] Q4: Rehaul design v13: pick Now A/B/C, Forecast A/B/C, Override A/B/C, scenario option 1/2, and answer the 12 open questions at the end of docs/rehaul/ia.md -> Directions picked in review 1: merged Now, one Forecast (A hero + A/B chart styles + C ladder), Override A single + B bulk, scenarios removed, wizards added
- [x] Q5: Rehaul v13 round 2: review the merged mockups (docs/mockups/v13-gallery.html) and answer the 15 open questions at the end of docs/rehaul/ia.md -> Design approved by the user after 6 review rounds (round 6)

## 5. Token & usage ledger

Source: estimate (`token_ledger.js` found no transcripts at mark time; rows stay 0 until `row` is run).
in = fresh input + cache writes, cached = cache reads, out = output.

| Scope | Haiku in | Haiku cached | Haiku out | Sonnet in | Sonnet cached | Sonnet out | Note |
|---|---|---|---|---|---|---|---|
| **Cumulative** | 1,294,275 | 5,307,310 | 242,079 | 2,596,107 | 302,306,787 | 1,473,224 |  |
| Phase 1 | 201,838 | 781,627 | 50,905 | 240,574 | 12,654,069 | 153,100 |  |
| Slice 1 | 54,226 | 136,487 | 9,514 | 132,077 | 4,369,183 | 91,339 |  |
| Slice 2 | 55,864 | 189,586 | 13,266 | 102,274 | 7,005,198 | 61,113 |  |
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
| rev-28 | 53,039 | 245,443 | 10,384 | 57,044 | 1,966,748 | 27,118 |  |
| rev-29 | 4,574 | 30,482 | 744 | 22,631 | 993,397 | 7,844 |  |
| rev-30 | 12,105 | 27,159 | 1,105 | 11,276 | 976,333 | 7,753 |  |
| rev-31 | 4,527 | 20,999 | 837 | 9,804 | 1,243,664 | 4,745 |  |

<!-- END SUMMARY -->

---

## Slice plan

Approved design: docs/mockups/v13-gallery.html (14 review rounds), docs/rehaul/ia.md (flows + "Decisions" section = answers to all open questions), docs/rehaul/model.md (data model + migration map). Round 1 mockups are kept in docs/mockups/round1/ for comparison only.

Build order (web first, Android later). One slice per gate; slices 1 and 2 must run in order, 3 to 6 can be sequential or parallel after 2.
1. Data foundation. Migrations (with rollback) for: accounts + balance_anchors, transactions + merchant_rules, category_groups/categories/budget_lines (rules fixed|pct|rest, counts_to_daily, kind normal|rto|rto_contingency), salary_events (status confirmed|expected) + allowances (payslip_cutoff) + tax_table_versions, plan_assumptions, bonus_rules (recurrence yearly|once, payslip_cutoff) + splits (amount|percent, custom label) + instances, funds (virtual shares), month_overrides, payslip_templates/lines, raise_allocations, pools + pool_entries, office_day_overrides, user_settings additions. Migrate existing data (keep current balances and budget lines; non-active plans exported to JSON). Pure TypeScript in lib/: month iterator, salary-timeline resolver, payslip builder (tax split across both cutoffs, contributions + allowances on cutoff 2, bonuses on their cutoff), budget evaluator (incl. raise top-ups, daily pool, RTO day budget), fund allocator with overrides, with/without-expected-raises runner. Keep lib/pay/compute.ts and lib/windfall/compute.ts rules (SSS, PhilHealth, Pag-IBIG, withholding; de minimis per event, shared 90k cap, no de minimis on 13th month). Tests for every rule.
2. Shell, theme and Now. Phone 5-tab bar + desktop rail, Night Emerald tokens (both themes), hide-amounts (asterisks), Now (hero + runway chart, recent, accounts row, planned vs spent collapsible cards, bills list, settle nudge), quick add.
3. Accounts and Inbox (colour cards, receive-QR in private storage, confirm/ignore/rules, wide cards on desktop).
4. Salary and tax (timeline, expected vs confirmed events, projected raises card, allowances with Taxable + lands-in cutoff, payslip builder, raise wizard with "where the extra goes").
5. Budget and Bonuses (lines, tickers in the editor only, RTO lines + contingency + settle, pools, future years with expected-raise tags and compare switch; bonus rules, one-offs, history, custom flat/percent splits, bonus wizard).
6. Funds, Forecast, Override (funds editor, 60-month forecast: stacked/lines, isolate pills, year ladder, override A single + B bulk).
7. First run wizard, Settings, retire plans and old pages.
8. Android (Expo) phone app, separate effort: notification capture in the first native build.

## Decisions & architecture

All 15 earlier open questions are answered in docs/rehaul/ia.md under "Decisions". Highlights: inflation removed; funds sharing an account are virtual shares; income tax is withheld in BOTH cutoffs (split editable), contributions and allowances sit on cutoff 2 by default; payslip builder per cutoff; scenarios removed (one live set of assumptions); expected vs confirmed raises plus a projected yearly raise (dashed); RTO: any number of RTO lines + one contingency, day budget derived (RTO lines' cutoff total / usual office days), extra office days tapped manually, settle under/over to pool or Wants; pools generic; bonus and allowance "lands in" cutoff is a setting; no DB backup needed before migrating.

## Run & verify guide (detected by Scout, kept current)

Mockups are static HTML: open docs/mockups/v13-gallery.html. Mock data and tax rules in docs/mockups/v13-data.js are simplified and invented; the real engine in lib/ stays the source of truth. Mockups share some state through localStorage keys (v13place, v13raise, v13settle, v13hide, v13theme) only to demo cross-page behaviour.

## Slice handoffs (what the user does after each slice)

Slice 2 (shell, theme and Now) is built and committed locally on slice/2-shell-theme-now (not pushed).
1. Apply supabase/migrations/20261206000200_rename_wants_fund.sql in the SQL Editor (renames the savings fund to "Wants savings").
2. Run the app (npm run dev), sign in and open Now. Check: phone width shows 5 tabs with a + in the middle; desktop shows the left rail; press N on desktop or tap + to add an expense; the eye button hides amounts; Theme flips dark/light.
3. Push when happy: git push -u origin slice/2-shell-theme-now.
What changed: the new shell and Now live in app/(v13) with their own styles (app/v13.css, every class prefixed v-). Old pages (Budget, Pay, Savings, Bonuses, Accounts, Settings) still use the old shell until their slices; the rail links to them. Forecast shows as unavailable. The Inbox page is a placeholder.
Deferred on purpose: ticking bills as sent (needs transfer pairs from Inbox, slice 3); the settle-office-days card (office-day data arrives with Budget, slice 5); the Now page's runway and envelopes stay empty until transactions exist.
Not verified: pages were not opened in a browser or signed in here, so the layout and the data load are unchecked against your real data. Tests, typecheck, lint and build pass.

Slice 1 (data foundation) is built. Nothing in the running app changed; the new tables and engine are not used by any page yet.
1. Apply the two new migrations in the Supabase SQL Editor, in order: supabase/migrations/20261206000000_rehaul_schema.sql, then 20261206000100_rehaul_data_migration.sql. They only add tables and columns; the old tables are untouched. Each file ends with a rollback note.
2. After step 1, check in the Table Editor: accounts and balance_anchors match your wallets, category_groups has Essentials/Wants/Savings, budget_lines_v2 matches your active plan's lines, funds has 3 rows, legacy_plan_snapshots has your non-active plans.
3. Review three decisions below, then approve.
Decisions to confirm: (a) the payroll savings plan stays in pay_settings, no percent budget line is created for it (the model said to create one, but that would be a percent of take-home rather than of basic pay); (b) Wants is migrated as a fund that resets every January, matching today's allocator, so confirm that is intended; (c) the new budget table is budget_lines_v2 until slice 7 drops the old one; (d) tax_table_versions is created empty and the engine uses the built-in tables.
Not verified: the SQL has not been run against a database (no Postgres available here), so step 1 is its first real run.

HANDOFF (design approved, build not started)
- Design is approved after 14 review rounds. Nothing in app/, lib/, supabase/ or tests has been changed yet.
- Start a fresh session and run /orchestrate. It will read PROJECT_STATE.md and continue at NEXT ACTION: build slice 1 (data foundation).
- Read first: PROJECT_STATE.md (Slice plan, Decisions), docs/rehaul/ia.md, docs/rehaul/model.md. Use docs/mockups/v13-gallery.html as the visual spec for slices 2 to 7.
- Your to-do: nothing needed before slice 1. Decide whether to commit the docs/ design files (not committed).

Review rev-31 on branch rev/31-faster-tab-switching: run `npm run build && npm start` (dev mode is always slower on first visits), sign in, and click Now / Month / Savings / Setup. Tell me which tabs still feel slow. Branches rev-27..31 are stacked: merge in order.

Review rev-30 on branch rev/30-sidenav-icons-spacing: run `npm run dev`. Check the sidenav (icons, Today/Manage groups, accent bar on current page, Theme / Hide amounts / Sign out footer), the phone tab bar icons (narrow the window under 760px), and spacing on Home, Budget and Savings. Branches rev-28, 29, 30 are stacked: merge in order.

Review rev-29 on branch rev/29-hide-amounts-asterisks: run `npm run dev`, press Hide amounts, check Home (incl. the "unplanned" pill), Budget, Accounts, Installments, Savings: every figure should show ***** and money inputs show dots.

Review rev-28 on branch rev/28-perf-pay-links-plan: run `npm run dev`, open Home. Check: page switches show a skeleton at once; payday strip "Not yet" stays gone on reload; links are green not violet; plan menu floats and Compare plans stays put.

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

- AGENTS.md warns this Next.js version has breaking changes: read the relevant guide in node_modules/next/dist/docs/ before writing app code.
- Uncommitted changes that predate this work (leave alone unless asked): .impeccable/config.json, package.json, proxy.ts (debug log), earlier PROJECT_STATE.md edits. The design files under docs/ are also uncommitted and nothing has been committed or pushed this session.
- Impeccable design hook may flag the Pip mascot smile (border-accent-on-rounded) in the mockup CSS; ignored for docs/mockups only.
