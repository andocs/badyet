# PROJECT_STATE

<!-- Single source of truth. Written only by haiku-logger. Everything above END SUMMARY must stay short (about 80 lines): Sonnet and /where-am-i read only that part. -->

## 1. What we're building
Project badyet-web: hosted personal budgeting web app converted from Google Sheet "Bad(yet) Sheet" (id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4). Single user, hosted with login. Not a git repo yet.

## 2. Current phase & active slice

- **Phase:** rev-46 gate
- **Active slice / milestone:** rev-45 savings-plan-fund
- **Gate:** awaiting approval
- **Next action:** Approve rev-46: merge + OTA
- **User to-do now:** Apply migration 20261222000000_payroll_labels.sql if not yet; force-close and reopen the phone app (up to twice) for the OTA; consider making the GitHub repo private (history still holds the old notes)

## 3. Execution log

- earlier: 15 events (2026-11-25 to 2026-11-25) covering handover, batch-4-plan, rev-33, rev-34, rev-35, rev-36, rev-37, rev-38
- earlier: 15 events (2026-11-22 to 2026-11-23) covering ota, rev-28, rev-29, rev-30, rev-31, rev-32
- earlier: 15 events (2026-11-22 to 2026-11-22) covering ota, rev-22, rev-23, build, rev-24, rev-25, rev-26, rev-27..29, rev-27
- earlier: 15 events (2026-11-22 to 2026-11-22) covering rev-14, rev-15, rev-16, rev-17, round-three, rev-18, ota, rev-19, rev-20, rev-21
- earlier: 15 events (2026-11-21 to 2026-11-22) covering rev-2, rev-3, G1, G2, G3, G4, G5, G1-G5-release, rev-9, rev-10, rev-11, plan, rev-12, rev-13
- earlier: 15 events (2026-11-21 to 2026-11-21) covering slice-E6, slice-E7, slice-E8, slice-E9, slice-E10, slice-E11, handoff, rev-1, mockups, mockups-v2, mockups-v3, mockups-v4
- earlier: 15 events (2026-11-21 to 2026-11-21) covering slice-E2, slice-E3, expo-plan, slice-E4, slice-E4b, vercel, slice-E5, slice-E6
- earlier: 15 events (2026-11-21 to 2026-11-21) covering rev-10, rev-11, merge, expo-p1, slice-E1, expo-plan, slice-E2
- earlier: 15 events (2026-11-20 to 2026-11-21) covering slice-6, slice-7, perf, rev-1, rev-2, rev-3, rev-4, rev-5, rev-6, rev-7, rev-8, rev-9
- earlier: 15 events (2026-11-20 to 2026-11-20) covering design-v13, slice-1, slice-2, slice-3, slice-4, slice-5
- earlier: 15 events (2026-11-20 to 2026-11-20) covering design-v13
- earlier: 15 events (2026-11-20 to 2026-11-20) covering ops, rev-27, rev-28, rev-29, rev-30, rev-31, rev-32, rev-33, rev-34, rev-35, rev-36
- earlier: 15 events (2026-11-20 to 2026-11-20) covering redesign, ops, rev-18, rev-19, rev-24, rev-25, rev-20, rev-21, rev-22, rev-23
- earlier: 15 events (2026-11-19 to 2026-11-20) covering rev-5, rev-6, phase3, rev-7..10, redesign, rev-11, rev-12, rev-13, rev-14/15, rev-16, rev-17
- earlier: 15 events (2026-11-19 to 2026-11-19) covering slice-6, slice-7, slice-8, slice-9, phase3, rev-1, rev-2, rev-3, rev-4
- earlier: 15 events (2026-11-19 to 2026-11-19) covering phase1, slice-1, slice-2, slice-3, slice-4, slice-5
- earlier: 15 events (2026-11-19 to 2026-11-19) covering Phase 1, Phase 1 / Gate 1, phase1
- 2026-11-25 13:07 | apk | Batch 4 APK built: https://expo.dev/artifacts/eas/ceUP-EgurpB8tJX9yQBgZZF0OSIZzW0l3F0pUJcExaI.apk; Vercel main passed | -
- 2026-11-25 17:30 | rev-39 | Batch 4 leftovers: phone Inbox Pays a bill; phone budget plans (new/edit/delete); six Other app sources with names (+ Another app, patterns per source on phone); settle to savings (new pool kind, adds to month savings pool, forecast too); bonus net uses payslip tax method (test: net = payslip delta); mobile lint 0 warnings. Migration 20261221000000_savings_and_custom_slots.sql | 5149dc1
- 2026-11-25 17:39 | rev-39 | Approved; merged to main (8a9748e); published OTA to channel preview (runtime 1.1.0, group c84f127c); Vercel main: success | -
- 2026-11-25 18:54 | rev-40 | Batch 5 fixes: SSS (SSS Circular 2024-006 table, 5% of MSC) and Pag-IBIG (2% to 10k cap) computed, phone field shows real amount; RTO skip prompt + skipped days listed at once, un-skip clears settle; Transfer category/group hidden, Inbox Transfer button (asTransfer); Forecast chart default saved-so-far + balance switch; transfer pairing windows 60 min gap / 3 h lookback; payslip Necessary vs Other deductions, HMO plan name + editor (web+phone), Budget read-only From your payslip card; savings plan shown per fund (forecast month sheet, Funds page). Migration 20261222000000_payroll_labels.sql. Wants in Planned vs spent pending user info. | 8860ac7
- 2026-11-25 18:56 | rev-40 | Approved; merged to main (238f945); OTA published (group a32f2b2e-fc97-40ef-b6e4-1cb0e238f0bb); Vercel main: success | -
- 2026-11-25 18:58 | rev-41 | Pay checklist mockups (3 options: by line / by wallet / wallet cards with lines), web + phone, sample numbers | -
- 2026-11-25 19:01 | rev-41 | Approved: pay checklist Option 3 + two-way sync (tick records transfer and moves balances; detected transfers auto-tick; duplicates not double counted); merged to main | -
- 2026-11-25 19:08 | rev-42 | Pay checklist (Option 3): page /pay-checklist + phone plan/checklist; tick = one transfer from payroll account (pay_account_id) to line wallet, balances move; Send the rest = one lump; transfers detected from notifications/emails auto-tick lines in budget order; captured transfer that duplicates one the app recorded is ignored (single or lump of several ticks); lines without a wallet get a wallet picker; Now bills links to it. No migration. | a506a71
- 2026-11-25 19:11 | rev-42 | Email dedupe and pairing use the transaction time written inside the email (lib/capture/email-time.ts) instead of the email's receipt time; falls back to arrival time when none found | 8a3f7f5
- 2026-11-25 19:14 | rev-42 | Approved; merged to main (cc9f2e2); OTA published (group 92ae8684-ce87-4500-b817-48406f567942); Vercel main: success | -
- 2026-11-25 19:21 | rev-43 | Wants row in Planned vs spent (plan = whatever-is-left + moved to Wants - taken; spent = Wants group categories); Choose dropdown floats (absolute popover, closes outside/Esc); docs/BATCH-5-notes.md and HANDOVER-batch-4.md removed and ignored; pay checklist uses a styled Pick dropdown, tab labels with payday dates. No migration. | 387f82f
- 2026-11-25 19:23 | rev-43 | Approved; merged to main (a30e9ea); OTA published (group a4ae1f48-ba76-497e-ac73-2c58eaa107b2); Vercel main: success | -
- 2026-11-25 19:41 | rev-45 | Savings plan fund link (uncapped, never resets), pills removed, Other payroll deduction moved beside payslip builder, salary-based contribution labels. All checks PASS. | f3b61f8
- 2026-11-25 19:47 | rev-45 | Other deductions list per cutoff (needs migration 20261225000000_other_deductions.sql), no-cap funds, chart stack order. Checks PASS. | -
- 2026-11-25 19:49 | rev-44 | Merged into rev-45 branch so inbox items (incl. All activity) can be edited | -
- 2026-11-25 19:52 | rev-45 | Inbox edit now includes category (web, phone). | -
- 2026-11-25 19:55 | rev-45 | Built-in Credit card payment category (acts like Transfer, shown in pickers). | -
- 2026-11-25 20:04 | rev-45 | Other-deductions layout; rounded-square tickbox standard (web+phone); skeleton/loading bar; payslip deductions can show under a budget line (panel keeps the rest). | -
- 2026-11-25 20:07 | rev-45 | Deductions link to a budget category (group), shown as read-only rows in that category. | -
- 2026-11-25 20:10 | rev-45 | Payslip deductions + savings plan shown in budget categories with Payslip rule and cutoff; panel removed. | -
- 2026-11-25 20:11 | rev-45 | Credit card payment category hidden from Budget (still in Inbox pickers). | -
- 2026-11-25 20:14 | rev-45 | Merged to main (30e8fe6) with rev-44; OTA published (group 08225860). Pending: user applies migration 20261225000000_other_deductions.sql. | -
- 2026-11-25 20:22 | budget hero | Hero total now includes other payroll deductions (web + phone). Merged to main 6bac596; OTA published. | 6bac596
- 2026-11-26 09:44 | rev-46 | Budget totals include payslip deductions + savings plan again (hero, fixed pill, category totals). Checks PASS. Not merged yet. | -

## 4. Open questions

- [x] Q3: (blocking Gate 1) Which design direction? Pick v2-a-score, v2-b-route-board, or v2-c-side-a-side-b (docs/mockups/v2-*.html); old a-passbook, b-signal, c-quiet-ledger were rejected 2026-11-19. -> Resolved: Night Emerald chosen at Gate 1 (DESIGN.md); v2 mockups superseded. Redesign round chose direction A (v11-a payday ritual) on 2026-11-20.
- [x] Q1: (non-blocking) CONFIRM items carried over from D:\badyet\docs\financial-logic-spec.md, e.g. cutoff days vs pay dates. -> User 2026-11-20: paydays are the 10th and 25th. Cutoffs are payday-to-payday (old spec: P1 = days 11-24, P2 = 25 to 10 next month), so the calendar split by one start day cannot model it. Building as rev-24 (assumption: first = paid 10th covering 11-24, second = paid 25th covering 25 to 10; a period belongs to the month it starts in).
- [x] Q2: (non-blocking) 2027 CIP tax exemption rule: V-W4 unverified in the old app. -> User 2026-11-20: CIP counts toward the 90,000 cap. CIP and the one-time September bonus each carry their own de minimis exemption (example: 120k CIP has 12k de minimis); the excess goes into the pool that is checked against the 90,000 cap, and anything above the cap is taxable. 13th month has NO de minimis. Building as rev-25 (per-event de minimis amount; 13th month locked to 0). Still need: September bonus de minimis amount.
- [x] Q4: Rehaul design v13: pick Now A/B/C, Forecast A/B/C, Override A/B/C, scenario option 1/2, and answer the 12 open questions at the end of docs/rehaul/ia.md -> Directions picked in review 1: merged Now, one Forecast (A hero + A/B chart styles + C ladder), Override A single + B bulk, scenarios removed, wizards added
- [x] Q5: Rehaul v13 round 2: review the merged mockups (docs/mockups/v13-gallery.html) and answer the 15 open questions at the end of docs/rehaul/ia.md -> Design approved by the user after 6 review rounds (round 6)
- [x] Q6: Distribution? -> Yes. Quick add and notification captures queue locally and sync later; client-generated ids and dedupe_hash make retries idempotent.
- [x] Q7: Shared code layout? -> mobile/ folder in this repo, own package.json, Metro watchFolders + alias to ../lib.
- [x] Q8: Notification samples? -> User will send redacted samples; not yet received. Blocks E5 only.
- [x] Q9: Sign-up lock? -> Disable Supabase sign-ups + RLS; no auth hook.
- [x] Q10: Deep link and EAS? -> Existing Expo account; scheme badyet, redirect badyet://auth/callback.
- [x] Q11: Offline quick add? -> Yes, offline quick add and captures queue and sync later (client ids + dedupe_hash).
- [x] Q12: Expo username for EAS builds? -> Expo username: docoats
- [x] Q13: Send redacted GCash, Maya, BPI notification samples (blocks E5) -> Samples pending: user to paste redacted text or screenshots into chat. Blocks E6 only.
- [x] Q14: Gmail: which senders/emails (BPI, GCash, Maya alerts or statements?) and sample email text? -> Senders: all banks/wallets (BPI, GCash, Maya) plus Grab, foodpanda, Google Wallet. Email samples still needed for E7.
- [x] Q15: Gmail approach: (a) read Gmail app notifications via listener, (b) Gmail API on device, (c) server-side poller? -> Gmail API on device (gmail.readonly, Google Cloud OAuth in testing mode, re-sign-in about every 7 days).
- [x] Q16: Capture rules: edit on phone only, or synced table also viewable on web? Which actions (ignore, auto-confirm, set category/account)? -> Capture rules editable on phone and web; stored in a synced Supabase table.
- [x] Q17: May a rule auto-confirm (skip Inbox) or must all captures stay pending until tapped? -> Default pending; auto-confirm is an opt-in per rule.
- [x] Q18: Confirm push notifications and OTA updates stay cut from v1? -> Push notifications stay out of v1; OTA updates (expo-updates) IN v1, wired into the first build.
- [x] Q19: Outgoing samples: GCash pay/send, Maya QR/payment, GoTyme sent, MariBank sent (real text)? -> Outgoing samples received for GCash (load, Express Send), GoTyme, MariBank, Maya; Google Wallet and card payments cannot be emulated yet.
- [x] Q20: BPI: full InstaPay email body with amount; BPI push is not firing, so rely on Gmail for BPI? -> Full BPI emails (outgoing and incoming) received. BPI via Gmail only.
- [x] Q21: Own-account moves (Maya to BPI, GrabPay to MariBank): detect as transfers between your accounts, or leave as income/expense for you to fix in Inbox? -> Yes: detect own-account transfers by pairing amount, opposite direction, short time window, own last4.
- [x] Q22: foodpanda order-placed email is not a payment (no method shown): capture as pending anyway, or only Grab receipts? -> Grab and foodpanda emails are receipts; capture as pending expense.
- [x] Q23: Add MariBank and GoTyme as capture sources (besides GCash, Maya, BPI, Grab, foodpanda, Wallet)? -> Yes: add MariBank and GoTyme as sources.
- [x] Q24: T1: what are your own figures for one payslip (base, allowances, SSS, PhilHealth, Pag-IBIG, tax withheld, take-home) and which one differs from the app? -> Method given: per-cutoff tax as in T1. Figures not yet supplied.
- [x] Q25: T4: which line is in both cutoffs with different values, and what does each cutoff show in the app versus what you expect? -> Example: personal savings 15,000 a month, 5,000 in the 1st cutoff, 10,000 in the 2nd.
- [x] Q26: T5: do reimbursements arrive on your payslip (taxed or not), as a separate deposit, or both? Is the utility reimbursement a fixed monthly amount, and which cutoff does each land in? -> Separate deposit; utility fixed monthly on the 17th; wifi pay 2,099 and reimbursed; reallocation needed.
- [x] Q27: T3: are installments card plans (a purchase split over months with a monthly charge) or loans, and do you want them to reduce Wants or sit as their own budget lines? -> Mostly card plans, also loans; each its own budget line.
- [x] Q28: rev-37 plan design -> A plan replaces the whole budget (copied, then edited); start and end picked as cutoffs; no overlaps

## 5. Token & usage ledger

Source: estimate (`token_ledger.js` found no transcripts at mark time; rows stay 0 until `row` is run).
in = fresh input + cache writes, cached = cache reads, out = output.

| Scope | Haiku in | Haiku cached | Haiku out | Sonnet in | Sonnet cached | Sonnet out | Note |
|---|---|---|---|---|---|---|---|
| **Cumulative** | 5,209,588 | 21,801,789 | 917,784 | 8,866,890 | 896,594,703 | 3,638,213 |  |
| Phase 1 | 201,838 | 781,627 | 50,905 | 240,574 | 12,654,069 | 153,100 |  |
| Slice 1 | 54,226 | 136,487 | 9,514 | 132,077 | 4,369,183 | 91,339 |  |
| Slice 2 | 55,864 | 189,586 | 13,266 | 102,274 | 7,005,198 | 61,113 |  |
| Slice 3 | 31,692 | 69,931 | 7,732 | 61,392 | 4,284,984 | 40,417 |  |
| Slice 4 | 17,541 | 64,878 | 3,723 | 89,056 | 7,339,876 | 58,555 |  |
| Slice 5 | 23,146 | 79,644 | 2,051 | 128,754 | 17,634,396 | 97,620 |  |
| Slice 6 | 15,745 | 69,488 | 3,581 | 80,760 | 10,601,471 | 54,339 |  |
| Slice 7 | 14,319 | 33,025 | 1,137 | 48,061 | 11,744,614 | 34,596 |  |
| Slice 8 | 10,233 | 35,048 | 820 | 22,369 | 3,767,210 | 17,380 |  |
| Slice 9 | 13,213 | 106,954 | 3,450 | 32,395 | 8,555,518 | 25,211 |  |
| Rev-1 | 3,644 | 42,355 | 1,093 | 3,857 | 1,180,225 | 1,181 |  |
| Rev-2 | 3,599 | 42,420 | 934 | 5,576 | 1,791,033 | 2,293 |  |
| rev-7..10 | 39,382 | 215,399 | 8,700 | 19,459 | 1,105,451 | 8,538 |  |
| rev-11..17 | 120,085 | 579,997 | 27,820 | 126,989 | 15,445,879 | 70,608 |  |
| rev-18..23 | 131,120 | 618,049 | 26,724 | 177,898 | 35,812,772 | 88,889 |  |
| rev-28 | 0 | 0 | 0 | 24,387 | 577,568 | 13,975 |  |
| rev-29 | 62,363 | 234,316 | 8,925 | 40,207 | 1,316,760 | 16,161 |  |
| rev-30 | 80,221 | 494,054 | 18,822 | 25,098 | 1,219,151 | 8,992 |  |
| rev-31 | 53,567 | 213,796 | 9,030 | 242,241 | 6,355,514 | 101,478 |  |
| rev-1..4 | 1,171,705 | 4,752,666 | 196,083 | 2,617,926 | 321,135,092 | 1,441,593 |  |
| rev-2 | 143,075 | 519,295 | 24,072 | 199,133 | 10,426,336 | 94,410 |  |
| rev-3 | 1,237,217 | 5,128,597 | 214,549 | 2,698,695 | 321,747,427 | 1,479,260 |  |
| rev-4 | 1,243,561 | 5,149,458 | 215,342 | 2,698,015 | 321,941,135 | 1,481,033 |  |
| rev-5 | 1,302,028 | 5,300,887 | 224,606 | 2,728,682 | 322,138,795 | 1,490,869 |  |
| rev-7 | 1,324,261 | 5,408,789 | 232,990 | 2,742,622 | 326,747,867 | 1,506,865 |  |
| rev-8 | 1,771,871 | 7,482,453 | 334,525 | 3,416,464 | 417,721,352 | 1,953,810 | no mark 'rev-8': all-time |
| rev-9 | 1,781,135 | 7,498,513 | 335,287 | 3,432,972 | 420,015,261 | 1,962,695 | no mark 'rev-9': all-time |
| rev-10 | 1,791,713 | 7,534,413 | 336,960 | 3,448,107 | 422,001,286 | 1,972,339 | no mark 'rev-10': all-time |
| rev-11 | 1,330,338 | 5,313,958 | 229,057 | 2,562,175 | 330,096,507 | 1,490,936 |  |
| Expo Phase 1 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| Slice E1 | 147,519 | 263,004 | 16,645 | 40,963 | 2,682,280 | 23,457 |  |
| Slice E2 | 41,685 | 170,665 | 9,995 | 39,565 | 3,339,073 | 22,950 |  |
| Slice E3 | 28,847 | 110,887 | 5,315 | 26,843 | 2,605,927 | 19,209 |  |
| Slice E4 | 24,134 | 85,191 | 5,961 | 24,914 | 4,120,774 | 17,102 |  |
| Slice E4b | 0 | 0 | 0 | 31,602 | 3,000,641 | 23,294 |  |
| Slice E5 | 34,760 | 127,057 | 10,165 | 56,170 | 9,020,239 | 41,456 |  |
| Slice E6 | 0 | 0 | 0 | 47,276 | 8,147,375 | 38,297 |  |
| Slice E7 | 51,326 | 176,057 | 11,965 | 62,827 | 12,471,116 | 46,107 |  |
| Slice E8 | 79,192 | 504,268 | 18,351 | 77,312 | 15,256,078 | 44,347 |  |
| Slice E9 | 2,274,724 | 9,188,425 | 424,415 | 4,125,147 | 538,474,423 | 2,417,034 | no mark 'slice-E9': all-time |
| Slice E10 | 2,274,724 | 9,188,425 | 424,415 | 4,156,838 | 546,265,133 | 2,436,245 | no mark 'slice-E10': all-time |
| Slice E11 | 2,274,724 | 9,188,425 | 424,415 | 4,166,681 | 551,353,775 | 2,443,325 | no mark 'slice-E11': all-time |
| rev-1 | 61,948 | 271,167 | 10,438 | 39,709 | 1,647,594 | 11,679 |  |
| G1-G5 | 411,056 | 1,885,707 | 85,638 | 479,934 | 51,413,137 | 251,551 |  |
| rev-12 | 41,259 | 242,973 | 8,891 | 66,222 | 2,682,272 | 28,242 |  |
| rev-13 | 56,692 | 389,768 | 15,481 | 69,970 | 4,802,032 | 29,017 |  |
| rev-14 | 49,434 | 211,197 | 9,291 | 43,287 | 4,373,776 | 17,856 |  |
| rev-15 | 0 | 0 | 0 | 49,273 | 5,909,593 | 23,908 |  |
| rev-16 | 28,866 | 114,296 | 9,314 | 68,962 | 10,234,292 | 25,714 |  |
| rev-17 | 25,781 | 143,108 | 7,133 | 46,045 | 4,580,190 | 33,276 |  |
| rev-18 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| rev-20 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| rev-27 | 14,676 | 7,699 | 1,712 | 30,678 | 925,520 | 13,359 |  |
| rev-32 | 0 | 0 | 0 | 0 | 0 | 0 |  |
| rev-33 | 40,718 | 178,325 | 9,184 | 0 | 0 | 0 |  |
| rev-34 | 155,648 | 1,386,351 | 47,508 | 0 | 0 | 0 |  |
| rev-35 | 90,314 | 258,957 | 18,226 | 0 | 0 | 0 |  |
| rev-36 | 121,097 | 959,389 | 25,764 | 0 | 0 | 0 |  |
| rev-37 | 59,752 | 236,347 | 11,859 | 0 | 0 | 0 |  |
| rev-38 | 71,440 | 325,505 | 13,060 | 0 | 0 | 0 |  |
| rev-39 | 86,578 | 297,338 | 17,560 | 584,423 | 17,689,981 | 48,682 |  |
| rev-40 | 147,843 | 333,414 | 22,018 | 119,072 | 30,873,194 | 68,565 |  |
| rev-41 | 0 | 0 | 0 | 16,704 | 1,519,405 | 14,361 |  |
| rev-42 | 47,003 | 183,558 | 8,760 | 61,365 | 13,044,241 | 46,014 |  |
| rev-43 | 5,209,588 | 21,801,789 | 917,784 | 8,866,890 | 896,594,703 | 3,638,213 | no mark 'rev-43': all-time |

<!-- END SUMMARY -->

---

## Slice plan

Batch 5 (notes in docs/BATCH-5-notes.md, 2026-11-25). Decisions: necessary deductions = tax, SSS, PhilHealth, Pag-IBIG, SSS PenBoost; HMO / savings plan / other stay subtracted from take-home as now, shown in their own payslip section, plus a read-only "from your payslip" card on Budget (not part of the planned total); chart defaults to "saved so far" (never drops) with a balance switch; pay checklist gets mockups first.
- rev-40 (one gate): (6) prompt when deselecting a usual RTO day (Wants / pool / savings); (7) hide the Transfer category and Transfers group everywhere, add an Inbox "Transfer" button; (4) SSS and Pag-IBIG from the official rules, shown as real values on web and phone; (9) Forecast chart default "saved so far" + balance switch; (2) late transfer emails attach to the existing Inbox item; (5) payslip deduction sections + Budget read-only card; (8) savings plan shown per fund in Forecast and Funds page; (1) Wants in Planned vs spent once the user says how Wants lines are set up (picker saved list? percent/rest lines? feeds-savings group?).
- rev-41: pay checklist MOCKUPS (web + phone): per-cutoff checklist grouped by wallet with wallet totals, like the sheet's To Transfer tab.
- rev-42: pay checklist build per the rev-41 choice.

## Decisions & architecture

2026-11-22 answers for round three. Income tax: per cutoff, not per month. Deduction order: SSS (1000), PhilHealth, Pag-IBIG (200), SSS PenBoost (750), then tax on the remainder x 24 against the 2023 TRAIN bracket, divided by 24. Both-cutoff lines: a line can total 15,000 a month but be split 5,000 in the 1st cutoff and 10,000 in the 2nd. Reimbursements: a separate deposit; utility is fixed monthly, usually the 17th; wifi case is pay 2,099 then reimbursed; reallocation of the value needed. Installments: mostly card plans, also loans, each as its own budget line.
- 2026-11-25 Budget plans (rev-37): no overlapping plans; plans start and end on cutoff days; a plan replaces the whole budget (copied from the normal budget, then edited).
- 2026-11-25 Rules redesign = Option 1 "One list" (mockups docs/mockups/v13-rules-redesign.html); sources are "Everything else from..." cards; patterns also read emails.
- 2026-11-25 Phone app updates: ship JS-only changes OTA: cd mobile; npx eas-cli@latest update --channel preview --environment preview --message "..." --non-interactive (runtime 1.1.0, channel preview; phone applies it after a force-close and reopen, up to twice). New APK only for native changes (new native library, Kotlin listener, permissions/plugins in app.json, Expo SDK upgrade); bump the app version then.
- 2026-11-25 Batch 5: necessary deductions = tax, SSS, PhilHealth, Pag-IBIG, SSS PenBoost; HMO / savings plan / other stay subtracted from take-home, shown in their own payslip section and a read-only Budget card. SSS = 5% of the monthly salary credit (SSS Circular 2024-006, Jan 2025 table, MSC 5,000..35,000 in 500 steps); Pag-IBIG = 2% of up to 10,000. Forecast chart defaults to saved-so-far with a balance switch. Transfer is a built-in Inbox button, its category is hidden.
- 2026-11-25 Pay checklist (rev-42) = mockup Option 3 (wallet cards with lines, docs/mockups/v13-pay-checklist.html): tick a line = one transfer from the payroll account (pay_account_id) to the line's wallet; "Send the rest" on a wallet = one lump transfer for unticked lines; transfers the app detects from notifications/emails tick lines automatically (unlinked transfers into a wallet from the payroll account in the cutoff are allocated to its unticked lines in order); a captured transfer that duplicates one the app recorded is ignored, not counted twice.

## Run & verify guide (detected by Scout, kept current)

Mobile (planned): cd mobile; npm install; npx expo start (dev client); npm test (vitest/jest for parsers and queue); eas build -p android --profile preview (APK). Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY. Web unchanged: npm run dev, test, lint, build.

## Slice handoffs (what the user does after each slice)

AFTER REV-42: what you do now
1. Get the code:   git fetch && git checkout rev/42-pay-checklist   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000/pay-checklist   (or the Vercel preview for rev/42-pay-checklist)
6. Check these:    pick "Send from" (your payroll account); tick a line: a transfer appears under Accounts and both balances move; tick again to undo; "Send the rest" on a wallet records one lump and ticks the unticked lines, Undo cancels it; make a transfer in the bank (or add one in the Inbox) from payroll to a wallet and see the lines tick themselves; "No wallet yet": pick a wallet for a line and it joins the checklist; the phone gets it by OTA after approval (More > Pay checklist)
7. Known limits:   no whole-month tab yet; a lump the app detected from a notification is undone from the Inbox, not from the checklist; ticking a line you never ticked while a detected lump already covers it is not offered
Reply: Approve / Request changes / Pause

AFTER REV-40: what you do now
1. Get the code:   git fetch && git checkout rev/40-batch5-fixes   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       apply supabase/migrations/20261222000000_payroll_labels.sql (adds pay_settings.other_deduction_label). Rollback: alter table public.pay_settings drop column if exists other_deduction_label;
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000   (or the Vercel preview for rev/40-batch5-fixes)
6. Check these:    Salary and tax: Other payroll deduction > name it HMO plan > Save; Payslip builder shows Necessary deductions / Other deductions; SSS and Pag-IBIG amounts are the table values (SSS 1,750 at a 50,000 base); Budget > From your payslip card; Budget > Office days: tap a usual day off > "Put it in: Wants / Contingency pool / Savings"; Inbox: a pending item has a "Transfer" button, and no Transfer category anywhere in Budget; Forecast: chart defaults to Saved so far, with a Balance switch; Funds / Forecast month sheet show "from your payroll savings plan" on the plan fund
7. Known limits:   Wants in Planned vs spent not changed yet (needs your answer); pay checklist is next (mockups); the phone gets rev-40 by OTA after approval
Reply: Approve / Request changes / Pause

AFTER REV-39: what you do now
1. Get the code:   git fetch && git checkout rev/39-batch4-leftovers   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       apply supabase/migrations/20261221000000_savings_and_custom_slots.sql (savings pool-entry kind, capture_sources.label, source checks widened to custom2..custom6). No data changes.
                   Rollback: see the comment block at the end of the migration (delete rows using the new values first).
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000   (or the Vercel preview for rev/39-batch4-leftovers)
6. Check these:    Rules > "+ Another app" > name it (e.g. ShopeePay), add an app, add a pattern, Save; Budget > Settle office days > Savings on an under-budget day, then the month's savings pool/Forecast rises by that amount; Bonuses page net for a bonus month equals the payslip's take-home change; on the phone: Inbox > a pending payment > "Pays a bill?" then Now shows the bill sent; Budget > "+ New plan"
7. Known limits:   phone Forecast has no Savings plan card; held captures from extra Other-app sources show a generic name; phone needs the new APK
Reply: Approve / Request changes / Pause

AFTER REV-38: what you do now
1. Get the code:   git fetch && git checkout rev/38-rules-redesign   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       apply supabase/migrations/20261220000000_source_removed.sql (adds capture_sources.removed, default false)
                   Rollback: alter table public.capture_sources drop column if exists removed;
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000/rules   (or the Vercel preview for rev/38-rules-redesign)
6. Check these:    Rules: rules first, then "Everything else from..." cards; open Maya: apps, senders, How it's read (patterns for Maya only), account/category/skip under/auto-confirm, Save; Remove GoTyme -> it moves to Removed -> Add back; add an @domain sender; add a pattern on a source with no email reader and check an email from it is read (phone, after the new APK)
7. Known limits:   no Listen-on switch on sources (apps = notifications, senders = emails); phone keeps patterns in their own card; still one "Other app" custom source; phone capture changes need a new APK
Reply: Approve / Request changes / Pause

AFTER REV-37: what you do now
1. Get the code:   git fetch && git checkout rev/37-budget-plans   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       apply supabase/migrations/20261219000000_budget_plans.sql (after 20261218000000). Adds budget_plans, budget_lines_v2.plan_id, and changes the one-contingency-line index to one per budget. No data changes.
                   Rollback (deletes all plans and their lines): see the comment block at the end of the migration file.
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000/budget   (or the Vercel preview for rev/37-budget-plans)
6. Check these:    Budget > + New plan > name, Sep 2026 1st cutoff to Nov 2026 2nd cutoff > Create: the board switches to the plan with your lines copied; change a line there and check the Normal budget is unchanged; try a second plan overlapping it (refused, names the clash); Now and Forecast follow the plan in force; Delete plan returns to normal
7. Known limits:   plans are made/changed on the web only (phone can view and edit a plan's lines); settling office days and contingency saves need the migration applied
Reply: Approve / Request changes / Pause

AFTER REV-36: what you do now
1. Get the code:   git fetch && git checkout rev/36-now-budget   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       apply supabase/migrations/20261218000000_payday_and_now_panel.sql (Supabase SQL editor, or: npx supabase db push). Additive: two new nullable columns on user_settings.
                   Rollback: alter table public.user_settings drop column if exists pay_account_id, drop column if exists now_categories;
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000   (or the Vercel preview for rev/36-now-budget)
6. Check these:    Now (first 7 days of a cutoff): "Has the pay arrived?" > pick account > Yes, add it > income appears and the card goes; Now > Planned vs spent > Choose > untick a category > Save (phone shows the same); Budget > 1st cutoff / 2nd cutoff switch; skip a usual office day earlier this cutoff > Budget > Settle office days lists it "(skipped)"
7. Known limits:   pay account is set from the payday prompt (no separate Salary-page setting); no "to savings" option for skipped-day money (pool or Wants only); phone needs a new APK
Reply: Approve / Request changes / Pause

AFTER REV-35: what you do now
1. Get the code:   git fetch && git checkout rev/35-inbox-capture   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes (uses the existing transactions.budget_line_id column)
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000   (or the Vercel preview for rev/35-inbox-capture)
6. Check these:    Accounts: keep the Maya wallet named exactly "Maya"; a new Maya notification lands on it without asking. Inbox: a fresh "from InstaPay" item says "May be a transfer ... until HH:MM" and only confirms as Transfer for 5 min. Now: Bills > Mark sent > pick the paying account > it shows sent and the "N of M sent" count goes up; Undo reverses it. Inbox detail of a pending payment: "Pays a bill" links it.
7. Known limits:   phone Inbox has no "Pays a bill" yet (web only); no automated test for the Mark sent writes; the phone needs a new APK to get the hold and Mark sent
Reply: Approve / Request changes / Pause

AFTER REV-34: what you do now
1. Get the code:   git fetch && git checkout rev/34-small-fixes   (merge to main after you approve)
2. Install deps:   cd mobile && npm install   (new dev tools: eslint, eslint-config-expo; web: no new deps)
3. Database:       no DB changes
4. Config:         none
5. Start the app:  npm run dev  ->  open http://localhost:3000   (or the Vercel preview for rev/34-small-fixes)
6. Check these:    Bonuses: yearly rules list as rows with Edit on the right; Rules > rule > + App: list scrolls inside the dialog, Done stays visible; Salary payslip: SSS/Pag-IBIG/PenBoost show 1,000/200/750, Income tax box editable (clear = computed); a bonus month shows "<bonus> de minimis" and no "<bonus> tax" line; Forecast: Savings plan card says which fund gets it or why it is left out
7. Known limits:   payslip bonus tax can differ slightly from the Bonuses page net (old calculation there); phone Forecast has no Savings plan card yet; 16 mobile lint warnings left; APK not rebuilt
Reply: Approve / Request changes / Pause

AFTER REV-33: what you do now
1. Get the code:   git fetch && git checkout rev/33-rules-mockups   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Start the app:  none; open docs/mockups/v13-rules-redesign.html and docs/mockups/phone/rules-redesign.html in a browser
6. Check these:    switch between Options 1/2/3 at the top; tap list cards to open each editor; read the comparison table; pick one
7. Known limits:   mockups only, sample data; also confirm migration 20261217000000 is applied and install the latest APK (from batch 3)
Reply: Approve (with option) / Request changes / Pause

Review rev-32 on branch rev/32-gmail-alert-check.
1. Apply migration 20261217000000_gmail_alert_check.sql (adds user_settings.gmail_alert_check, default on). Until then the phone treats it as on and the web toggle shows an "apply the update" error if you change it.
2. Rules page (web and phone) has a new "Check Gmail when Gmail notifies" switch (on by default). With it on, a Gmail app notification triggers a Gmail check at once. The Gmail notification text is never read or stored.
3. The JS part reaches the phone by update, but the text-skipping part is native, so build a new APK (eas build -p android --profile preview) for the privacy part.
4. Gmail must be allowed to post notifications on the phone, and the listener access must stay granted.

Review rev-31 on branch rev/31-rules-page.
1. Apply migration 20261216000000_rules_page.sql to Supabase (also 20261214000000 and 20261215000000 if not yet). Until then the Rules page shows an "Apply the Rules database update" notice and old rules keep working.
2. Web: npm run dev, open Rules (before Settings). Add a rule, switch it, reorder, Test it, edit the Duplicate rule tab; Settings now just links to Rules.
3. Phone: rebuild and install (new native code: installed-apps list, QUERY_ALL_PACKAGES, boot receiver). More > Rules; open an App picker to sync the apps list, then check it shows on the web picker. Senders fill in after a Gmail check.
4. Try a Payment rule (Maya to Maya Black, confirm automatically) with a test alert: both legs should appear and the card balance should drop. Your Maya parser may not read "payment received on your Maya Black" yet; add a custom wording if not.
5. Check the Vercel preview passes. Mobile lint was not run (mobile eslint is not configured from the root).

Review rev-30 on branch rev/30-card-payment-leg.
1. Apply migration 20261215000000_transfer_peer_backlink.sql to Supabase (links the two halves of a transfer both ways).
2. Cause found from the code, not from your real data: answering a held capture as a move to one of your own accounts saved only the paying side, so the card never got its "in" leg. It now saves both. Test: pay Maya Black from a wallet, answer the held item with Maya Black as the other account, and check the card balance drops by the amount.
3. Already-answered payments are NOT fixed retroactively; tell me if you want a one-off fix for the missing card legs.
4. Not covered: the Maya parser may not read "payment received on your Maya Black" alerts at all (no parser wording for it). Say if you want that added.
5. Check the Vercel preview passes and rebuild the phone app.

Review rev-29 on branch rev/29-dedupe-boot (cut from main, which now includes the local rev-28 merge).
1. Apply migration 20261214000000_dedupe_rules.sql to Supabase. Until then the defaults apply, so nothing breaks.
2. Build and install a new phone build (the boot receiver and RECEIVE_BOOT_COMPLETED permission are native). Reboot the phone and check capture still works without opening the app.
3. Test: a GCash/bank alert then its email up to 30 min later should make one item; a bank alert should trigger a Gmail check at once.
4. Check the Vercel preview for this branch passes (lib/capture/recent.ts is shared with web).

Open docs/mockups/v13-rules.html (desktop) and docs/mockups/phone/rules.html (phone, use a 320px-wide window). Try both tabs: Capture and Duplicates. On the phone page tap a rule, the + button, or a duplicate rule; links #edit, #new, #dup, #dupedit open each view directly. Check: listen on Notifications / Emails / Both, the keyword lists (any / must include / skip), the Card payment type, and the Test box.

AFTER rev-27: what you do now
1. Get the code:   git fetch && git checkout rev/27-capture-dedupe   (merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Phone:          after merge I publish an OTA update; open the app twice to receive it
6. Check these:    a BPI push then its email (or the other way round) within 10 min gives ONE inbox item; drop or answer the push first, the email still adds nothing; two real same-amount BPI pushes are both kept
7. Known limits:   matches by bank, direction and amount within 10 min (not account); only BPI has both an email and a push parser; items sent while offline and older than the current check are still covered by the old DB check only; mobile lint is not configured in this repo
Reply: Approve / Request changes / Pause

AFTER SLICE E11 (release and polish): what you do now
1. Get the code:   git fetch && git checkout slice/E11-release-polish (it contains E1-E11; each slice branch builds on the one before)
2. Install deps / Database / Config: none new
3. Get the update: open the app twice (or Settings > Check for updates): update group 84a8adcc. The APK to have installed is build e5f5bd62 (https://expo.dev/artifacts/eas/34GCgyG4EtnV_VjM5vLCBTf5H9g_h5T7li5ilIsk6pg.apk): it has the notification permission fix, the listener, the Google sign-in module and the Pip icon. Everything after that ships over the air.
4. Check these:    tab bar now has icons (Now, Inbox, Add, Accounts, Plan); on a wide screen (Z Fold opened, tablet) screens are a centred readable column; mobile/README.md explains setup, builds, updates and the Google setup.
5. Known limits:   not looked at on your real screens by me. Still on the web only: Accounts add/move/reconcile/QR, Budget settle/pools/categories/RTO card, raise wizard and payslip builder, bonus rule and destination editing and "mark received", fund create/edit/reorder, forecast overrides, setup wizard, CSV export. Google Wallet capture (no sample). Capture and Gmail run when the app is opened (no background check).
Reply: Approve / Request changes / Pause

AFTER SLICE E10 (Plan: Forecast and Settings): what you do now
1. Get the code:   git fetch && git checkout slice/E10-forecast-settings
2. Install deps / Database / Config: none
3. Get the update: open the app twice (or Settings > Check for updates): update group 0588ad64, no new APK.
4. Check these:    Plan > Forecast ("Where I'll be"): Chart / Year by year switch; hero with all funds together (end of 60 months, up from today, without expected raises, each fund); Chart with Stacked or Lines, fund chips, tap anywhere to open a month; Year by year ladder with split bars; month cards for the chosen year; "Months that differ"; tapping a month opens the story sheet (pool, bonuses, each fund's reason and balance). Plan > Settings: Paydays (edit and save), Looks (Hide amounts), updates, notifications, capture rules, Gmail, tax note, setup/data note, sign out. Compare against the web Forecast and Settings.
5. Known limits:   viewing only for the forecast: overriding a month (order, pins, skips), bulk edit, and resetting a month are on the web. Settings: office days are set from Budget (web) and the timezone is fixed to Asia/Manila, as on the web; running the setup wizard and the CSV data export are on the web. Not run on real data by me.
Reply: Approve / Request changes / Pause

AFTER SLICE E9 (Plan: Bonuses and Funds): what you do now
1. Get the code:   git fetch && git checkout slice/E9-plan-bonuses-funds
2. Install deps / Database / Config: none
3. Get the update: open the app twice (or Settings > Check for updates): no new APK.
4. Check these:    Plan > Bonuses: year chips; hero (bonus money after tax, gross/tax/count, vs last year, stacked bar by destination); a card per bonus with gross, de minimis, cap bar, over-cap tax, net, and where it goes (tap a destination to tick it done; CIP has Low/Base/High). Received bonuses are collapsed. Rules list. Plan > Funds: funds in priority order with balance, progress to target, rule and what it does, tranches, limits.
5. Known limits:   viewing and ticking only: adding or editing bonus rules, destinations, "mark received", and creating, editing or reordering funds are on the web. Not run against your real data by me.
Reply: Approve / Request changes / Pause

AFTER SLICE E8 (Plan: Budget and Salary): what you do now
1. Get the code:   git fetch && git checkout slice/E8-plan-budget-salary
2. Install deps:   no new deps
3. Database:       none
4. Config:         none
5. Get the update: open the app twice (or Settings > Check for updates): update group c15b540c. No new APK.
6. Check these:    the Settings tab is now the Plan tab (Settings is inside Plan). Plan > Budget: header with This month / Future years, hero "left of take-home" with fixed-lines, cutoff and daily-pool pills, tight/over flag, groups with share bars and lines (rule, cutoff, account, spent or sent); tap a line to edit (name, category, rule, amount or percent, cutoff, account, start/end, draft, daily, office-day kind) or delete; + Add a line per group; Future years has year arrows and 12 month chips. Plan > Salary and tax: take-home chart with markers, events (Confirm / Remove), recurring allowances (cutoff 1st/2nd, Remove), projected raises (switch, percent, month, Save), year by year. Compare each against the web page.
7. Known limits:   not run against your real data by me. Still on the web only: Budget's settle office days, pools, categories and the RTO card; the raise wizard (add a raise) and the payslip builder; Future-years "compare without expected raises". The shared Budget view code (lib/budget/screen.ts) is a copy of the web page's assembly, tested; the web page still builds its own view.
Reply: Approve / Request changes / Pause

AFTER SLICE E7 (Gmail capture): what you do now
1. Get the code:   git fetch && git checkout slice/E7-gmail-capture   (E1-E6 included; merge to main after you approve)
2. Install deps:   no new deps
3. Database:       none new
4. Config:         Google Cloud setup (about 10 minutes), in this order, all in ONE project:
   a. console.cloud.google.com > create a project (for example "Bad(yet)").
   b. APIs & Services > Library > enable "Gmail API".
   c. Google Auth Platform / OAuth consent screen: User type External, app name Bad(yet), your email as support and contact. Data access / scopes: add https://www.googleapis.com/auth/gmail.readonly. Audience / Test users: add the Gmail address that receives your bank emails. Leave it in Testing (no review needed).
   d. Credentials > Create credentials > OAuth client ID > Application type ANDROID. Package name: com.docoats.badyet. SHA-1 certificate fingerprint: EE:82:9B:C2:B9:C1:6A:7E:D8:1D:8F:A8:E2:11:0C:17:BF:CF:AF:55 (this is the signing key of every build EAS has made for you).
   e. Credentials > Create credentials > OAuth client ID > Application type WEB application (no redirect URIs needed). Copy its Client ID (ends .apps.googleusercontent.com). This is a public id, not a secret.
   f. Send me that Web client ID. I add it as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in EAS and publish it over the air (no new APK).
5. Get the update: install the new APK from build e5f5bd62 (it contains the Google sign-in module), then open the app twice (or Settings > Check for updates) for update group ed63cce6 plus the one with the client id.
6. Check these:    (a) Settings has a Gmail card; before the client id arrives it says the id is missing; (b) after: Connect Gmail opens Google's sign-in; Google warns the app is unverified (it is in testing): tap Advanced, Continue; allow read-only Gmail access; (c) the card shows "Connected as ..." and "Check now" reports N new; (d) a BPI transfer email (InstaPay in or out) from the last 3 days appears as a pending Inbox item with the right amount and in the right account (BPI account matched by the last digits or nickname); (e) a Grab receipt paid by card appears in the account whose last 4 digits match the card, and cash rides are skipped; (f) a foodpanda order appears in the foodpanda source's usual account; (g) the same transfer seen in a phone notification and an email is recorded once; (h) it asks you to connect again after about 7 days while the project is in testing.
7. Known limits:   NOT tested by me on a real mailbox or a real Google sign-in. Parsers are tested on rebuilt layouts of your BPI, Grab and foodpanda emails; if Google or the bank changes the layout, an email is ignored, not guessed. Only the last 3 days are read on each check, once per message. Grab and foodpanda sender addresses are guessed from their domains (grab.com, foodpanda.com/.ph): tell me if their mail comes from another domain, or add the sender in Capture rules. Gmail is checked when you open the app (at most every 5 minutes) or tap Check now; there is no background check yet. Google Wallet is still missing (no sample).
Reply: Approve / Request changes / Pause

AFTER SLICE E6 (notification capture): what you do now
1. Get the code:   git fetch && git checkout slice/E6-notification-capture   (E1-E5 included; merge to main after you approve)
2. Install deps:   no new deps
3. Database:       none new. Saving capture settings needs the E5 migration (supabase/migrations/20261207000000_capture_rules.sql) applied in Supabase if you have not yet. Capture itself works with the defaults without it.
4. Config:         none
5. Get the update: use the APK with the permission fix (https://expo.dev/artifacts/eas/RD1KmHqP2wFlP7Mzwo6gOV4UKl1sj-xoatg33i8s784.apk) and turn on notification access in Settings (Allow notifications first). Then open the app twice (or Settings > Check for updates) for update group c4234731.
6. Check these:    (a) Settings > Capture rules: GCash and Maya already list their apps; for GoTyme and MariBank open the editor, tap their app in "Apps that have posted notifications on this phone", Save; (b) make a small payment or transfer (even P1) so GCash, Maya, GoTyme or MariBank posts a notification, then open Bad(yet): a pending row appears in Inbox with the right amount, direction and merchant; (c) the same notification does not appear twice, and a promo or OTP never shows; (d) each row sits in the right account (an account named like the source, or the usual account you chose; if none, Capture rules shows "N captures waiting for an account"); (e) a keyword rule "ignore" on a word in the notification keeps it out; (f) a move between two of your own captured accounts (for example Maya to GoTyme) shows as one transfer with both legs in Inbox; (g) turn on "Confirm without asking" with an account and category set for one source and see its next capture arrive already confirmed.
7. Known limits:   NOT tested by me on a real notification (parsers are tested on your real sample texts). Captures are turned into Inbox items when the app is open or the next time you open it; notifications that arrive while it is closed wait safely and are picked up on the next open (no background run yet). Not done: Google Wallet (no sample), Grab, foodpanda and BPI emails (E7). BPI push is parsed but your BPI alerts do not fire. Maya "You paid" payments and GCash wording for other transactions are guesses until you send real examples; anything unrecognised is ignored, not guessed. If a notification's wording differs from the samples it is silently skipped, so send me any that never appear.
Reply: Approve / Request changes / Pause

AFTER SLICE E5 (capture rules): what you do now
1. Get the code:   git fetch && git checkout slice/E5-capture-rules   (E1-E4b included; merge to main after you approve)
2. Install deps:   no new deps
3. Database:       ADDS two new tables (capture_sources, capture_rules); changes nothing existing, so no backup needed. Apply supabase/migrations/20261207000000_capture_rules.sql: open the Supabase dashboard > SQL editor, paste the whole file, Run (or `supabase db push` if you use the CLI). Rollback: the last lines of the file (drop table capture_rules; drop table capture_sources;). Until it is applied, Settings on the web and the phone say so instead of breaking.
4. Config:         none
5. Get the update: open the app twice (or Settings > Check for updates) for update group 81d4c1f6. The web updates when this branch is merged and deployed; the Vercel preview for this branch passed.
6. Check these:    (a) after the SQL: web Settings > "Capture rules" lists GCash, Maya, BPI, GoTyme, MariBank, Grab, foodpanda, Google Wallet, each expandable; (b) on the web turn one off, set a usual account and category, a minimum amount, save; (c) on the phone Settings > Capture rules shows the same choices; (d) edit one on the phone, reload the web page: it matches; (e) in a source's editor the "Apps that have posted notifications on this phone" list shows real apps (post a GCash or Maya notification first); tap one to add it; (f) add a keyword rule "cashback" > ignore on one side and see it on the other; delete it; (g) bad input shows a clear message (app id like com.example.app, email like name@bank.com, minimum in pesos).
7. Known limits:   these settings only take effect when notification capture arrives in E6 and Gmail in E7 (the rules logic is built and tested but nothing feeds it yet); app ids for GCash, Maya, Grab, foodpanda and Google Wallet are best guesses, GoTyme and MariBank are empty on purpose: add them from the "apps seen on this phone" list; BPI/Grab/foodpanda email senders (other than BPI's two) are blank until you send a sample; the phone listener's allowlist updates when you open the app.
Reply: Approve / Request changes / Pause

AFTER SLICE E4b (parity pass): what you do now
1. Get the code:   git fetch && git checkout slice/E4b-parity   (E1-E4 included; merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Get the update: new APK first if you have not: https://expo.dev/artifacts/eas/RD1KmHqP2wFlP7Mzwo6gOV4UKl1sj-xoatg33i8s784.apk (declares the notification permission). Then open the app twice (or Settings > Check for updates) for update group 5f9c8929.
6. Check these, phone next to the web: Now - (a) title is the date ("Sat 21 Nov") with "1st cutoff · range · payday"; (b) hero with safe-to-spend, "+ Expense" button, office-day note, the spending chart with legend, "Spent / pace says / over or under pace"; (c) Recent grouped by day with "All activity →"; (d) "What I have right now" with total and sideways account cards; (e) "Planned vs spent" envelopes: tap to open, status pill, bar with pace marker; (f) Bills with "N of M sent" and "Sent this cutoff"; (g) next payday note. Accounts and Inbox and Quick add: same checks as before. Send me screenshots of any place that looks different from the web.
7. Known limits:   I compared by reading the web code, not by looking at both screens side by side; I have not seen the phone render. Not yet on the phone: Accounts Add account, Move money, Reconcile with real balance, receive-QR (they write data; proposed as a follow-up); "Settle office days" button (Budget comes in E8); the web's desktop-only side layout.
Reply: Approve / Request changes / Pause

AFTER SLICE E4: what you do now
1. Get the code:   git fetch && git checkout slice/E4-quick-add   (E1-E3 included; merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Get the update: no new APK. Open Bad(yet), close it fully, open it again (or Settings > Check for updates). Update group 436b4a82, channel preview.
6. Check these:    (a) + tab shows Amount, Where, Account, Category and Save expense; (b) save an expense with signal: it says Saved, then appears in Inbox > All activity and in Now recent, and the account balance on Accounts drops after pull-to-refresh; (c) turn on airplane mode, save another: it says it will sync later and the "1 waiting to sync" card shows it; (d) turn airplane mode off: it syncs by itself within a few seconds (or tap Sync now) and the card disappears; (e) it appears once only, not twice; (f) with airplane mode on, close and reopen the app: the queued expense is still there and the account and category lists still show; (g) a bad amount (0, abc) shows the web's message.
7. Known limits:   offline confirm or ignore in Inbox is not queued (only Quick add is); the entry time is saved as when you tapped Save, not when it syncs; not run against real data by me; Accounts balance and Now show it only after you pull to refresh.
Reply: Approve / Request changes / Pause

AFTER SLICE E3: what you do now
1. Get the code:   git fetch && git checkout slice/E3-inbox   (E1, E2 included; merge to main after you approve)
2. Install deps:   no new deps
3. Database:       no DB changes
4. Config:         none
5. Get the update: no new APK. Open Bad(yet), close it fully and open it again (the update downloads on the first open, applies on the second). Published as update group 8a9a6463 on channel preview.
6. Check these:    (a) Inbox tab shows "To check (n)" with your pending rows (if none, "All caught up"); (b) a pending row shows account, time, source and category chips, with a suggested category preselected when a rule or history matches; (c) Confirm stays disabled until a category is picked, then moves the row out and the Accounts balance and Now spending update (pull down to refresh); (d) "Always put X under Y" creates a rule that preselects next time; (e) "Not mine" removes the row for good; (f) All activity lists recent rows with their status; (g) a transfer row shows both accounts and confirms without a category; (h) compare against the web Inbox.
7. Known limits:   needs signal (offline confirm comes with E4's queue); pending rows only appear once capture (E6/E7) or Quick add (E4) creates them, so to test now add a pending row on the web or in the database; not run against real data by me.
Reply: Approve / Request changes / Pause

AFTER SLICE E2: what you do now
1. Get the code:   git fetch && git checkout slice/E2-data-accounts-now   (E1 is included; merge to main after you approve)
2. Install deps:   cd mobile && npm install
3. Database:       no DB changes
4. Config:         none new
5. Install the APK: build 6cb8b6c4 on https://expo.dev/accounts/docoats/projects/badyet/builds (new native packages: fonts, gradient, so this needs a fresh APK, not an OTA update). Install over the old app.
6. Check these:    (a) Now tab shows today's safe-to-spend, envelopes, bills, recent; numbers match the web Now page; (b) Accounts tab lists accounts with balances and "You own" total matching the web; (c) "Hide" button masks every peso figure with *****, stays hidden after closing the app; (d) pull down on Now or Accounts refreshes; (e) switch the phone to light mode and the app follows; (f) if Now says setup is needed, finish salary/budget on the web.
7. Known limits:   Now and Accounts were not run against real data by me (no phone session here); only bundle, typecheck, lint and 10 unit tests. Inbox, + and Settings are stubs until E3/E4. Tab bar has text labels only, no icons yet.
Reply: Approve / Request changes / Pause

AFTER SLICE E1: what you do now
1. Get the code:   git fetch && git checkout slice/E1-expo-scaffold   (merge to main after you approve)
2. Install deps:   cd mobile && npm install
3. Database:       no DB changes
4. Config:         create mobile/.env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (same values as the web app's NEXT_PUBLIC_ ones). In Supabase > Auth > URL configuration, add badyet://auth/callback to Redirect URLs.
   Expo: npx eas-cli@latest login (docoats); in mobile/: npx eas-cli init, then npx eas-cli update:configure (writes updates.url and projectId).
5. Build the APK:  cd mobile && npx eas-cli build -p android --profile preview  -> download the APK from the link and install it on your phone
6. Check these:    (a) app opens to a login screen; (b) Continue with Google signs you in and lands on the Now tab; (c) tabs Now, Inbox, +, Accounts, Settings show; (d) Settings shows your email and "Notification access: off", the button opens Android's notification access page, enable Bad(yet), come back and it says "on"; (e) Sign out returns to login; (f) a different Google account is refused.
7. Known limits:   the Android native code (listener module) has never been compiled; the EAS build is its first test. Placeholder colours (E2 applies Night Emerald). expo-doctor flags react duplicated in the web app's node_modules (repo layout; revisit in E2 when mobile imports lib/). No OTA update tested yet: after a first install, run npx eas-cli update --channel preview --message test --environment preview.
Reply: Approve / Request changes / Pause

Check on desktop, a tablet width (about 800px) and the Z Fold 6 preset (412px): login centered with the Google icon; tab changes feel instant; hide-amounts now covers the Budget hero, payslip builder lines and chart axes; file upload button in Accounts; bonus edit rows; 18 fund colors; links underline left to right on hover; Settings no longer has the RTO amount (Now infers it from the RTO lines); charts on Salary, Forecast, Now readable on tablet and phone; payslip builder panels stack on phone; wizard spacing; bonuses hero mascot stays beside the text. Branch rev/2-batch-notes-2 is pushed. No migrations; the rto_amount column is left in the database but unused.

Try on desktop and a phone (or 360px width): Budget hero shows left / take-home; the 1/2 circles have no extra box; Bonuses year tabs show a skeleton; color pickers have 22 colors; login matches the app; phone More tab opens every other page; Inbox tabs stay on one line; Now chart is readable; Budget Future years shows six months with arrows. Branch rev/1-batch-notes is pushed; merge to main when happy. No migrations.

Slice 7 (First run wizard, Settings, retire old pages) is built and committed locally on slice/7-first-run-settings-retire (not pushed; stacked on slices 2 to 6). No new migration.
1. Setup wizard (/setup): five skippable steps (accounts with opening balances, salary with optional SSS and Pag-IBIG, paydays, starter budget lines, starter funds) with a live "setup so far" payslip. Re-running it from Settings adds to what you have. Now and Salary and tax point to it when there is no salary.
2. Settings (/settings): paydays (also keeps the old cutoff columns in step), office-day amount, notification switch and merchant rules (delete), theme and hide amounts, run the wizard again, CSV export of the new tables, sign out.
3. Retired: Plans, Transfer, More, Installments, Subscriptions and Import pages, the old shell and nav, and the old libraries only they used. The e2e routes now point at the new pages.
Old database tables are untouched. When you are happy with the rehaul, docs/rehaul/retire-old-tables.sql is an optional script that drops them (not a migration; it asks you to check and export first). budget_lines_v2 keeps that name.
Not verified: not opened in a browser or run against your data. Tests, typecheck, lint and build pass.

Slice 6 (Funds, Forecast, Override) is built and committed locally on slice/6-funds-forecast-override (not pushed; stacked on slices 2 to 5). No new migration.
1. Funds (/funds): default priority with up/down, balance bars, editor (name, colour, linked account with optional share or typed balance, fill rule steps/cap/reset/fixed, target, monthly limit, tranches, reset month), archive.
2. Forecast (/forecast): 60 months from this month with your salary, bonuses, budget lines and funds. Hero total with "without expected raises", fund pills, stacked or lines chart, tap or Jump-to a month for the sheet (pool, where it went, why), Year by year ladder with month cards, Months that differ.
3. Override a month (/forecast/override?m=2027-03): reorder, pin, skip with live "what it does" and "five years later", save, reset, apply the order to a range. Bulk (?bulk=1): tick months, then put a fund first, pin, skip or reset; click a cell to pin or skip one fund.
Notes: the old Savings page is gone. If you have no funds or no salary, Forecast shows a prompt instead. Fund balances start from the linked account balance or the typed balance.
Not verified: not opened in a browser or run against your data. Tests, typecheck, lint and build pass.

Slice 5 (Budget and Bonuses) is built and committed locally on slice/5-budget-bonuses (not pushed; stacked on slices 2 to 4).
1. Apply supabase/migrations/20261206000400_pools_created_on.sql in the SQL Editor (adds pools.created_on and a positive-amount check on pool entries).
2. Budget (/budget): This month (groups, lines with rule, cutoff, raise top-up tags, spent so far; tap a line to edit; tickers for Daily spend, RTO days, RTO contingency; draft; start/end months), Future years (year pick, 12-month bars with tight/over flags and an expected-raise marker, month detail, Compare without expected raises), RTO card (usual weekdays, tap extra days), Settle office days, Pools (use, move to Wants, new pool), Categories (add, edit, archive).
3. Bonuses (/bonuses): year picker, hero with where the money goes, one card per bonus (gross to net with the shared 90,000 cap, CIP Low/Base/High, destinations with done ticks, Edit amounts, Mark received), history for received bonuses, and Yearly rules / One-offs with one editor (the six-step bonus wizard is replaced by this editor).
4. Now now includes pool money moved to Wants in the daily amount and shows a Settle nudge.
Notes: the old Budget and Bonuses pages are removed (installments and subscriptions pages remain until slice 7; their lines are budget lines with end dates now, so check your migrated installment lines). Contingency pool balance = what its line adds each cutoff since the pool was created, plus entries.
Not verified: not opened in a browser or run against your data. Tests, typecheck, lint and build pass.

Slice 4 (Salary and tax) is built and committed locally on slice/4-salary-and-tax (not pushed; stacked on slices 2 and 3).
No new migration. Open /pay in the app and check:
1. Timeline: the take-home chart (hollow markers = expected events, dashed = assumed raises), the events list with "It happened: confirm" and Remove, Projected raises (switch, percent, month), Recurring allowances (lands-in cutoff, Taxable, Remove), and the Year by year table (December payslip plus bonuses after tax; 13th month and CIP come from your migrated bonus rules).
2. Payslip builder (tab): pick a month, change the base and tax split, move SSS/PhilHealth/Pag-IBIG between cutoffs, add your own lines, then "Save from this month on". "Standard layout" resets. The tax working shows bracket by bracket.
3. + Add a raise or promotion: the five-step wizard with the payslip before and after, the five-year effect, and "where the extra goes" (tied top-ups on budget lines).
Notes: the old Pay page and its wizard are gone. Contribution overrides (SSS, PhilHealth, Pag-IBIG) are edited by overriding a line in the builder, saved as a layout. Editing an existing event is by remove and re-add for now. An allowance can only be added through the wizard.
Not verified: not opened in a browser or run against your data. Tests, typecheck, lint and build pass.

Slice 3 (Accounts and Inbox) is built and committed locally on slice/3-accounts-inbox (not pushed; it sits on top of slice 2's branch).
1. Apply supabase/migrations/20261206000300_accounts_storage.sql in the SQL Editor. It creates the private account-qr bucket with per-user policies and flips migrated credit-card balances to negative (owed). Also apply 20261206000200_rename_wants_fund.sql if you have not.
2. Run the app. Accounts: add an account, reconcile a balance, move money between two accounts, upload a receive-QR image (PNG/JPEG/WebP, up to 1 MB) and open "Show big". Inbox: spend you add with + appears in All activity.
3. Pending rows only appear once the phone app exists (slice 8) or if you insert one by hand, so to test confirm/ignore/rules insert a transactions row with status 'pending' in the Table Editor.
Notes: the old Accounts page and its wallets-based form are gone; the old Budget/Transfer pages still read the wallets table, so accounts you add now do not appear there until slice 7. Credit cards show "owed" and available credit.
Not verified: nothing was opened in a browser or run against your database; the storage policies and the upload path are untested. Tests, typecheck, lint and build pass.

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

- lib/ is almost pure TS; only lib/auth/require.ts and lib/supabase/server.ts import Next/SSR. Mobile imports engine, budget, now, inbox, domain only.
- Phone talks to Supabase directly (supabase-js + RLS). No new route handlers unless Now proves too heavy on device.
- Raw notification text never leaves the device or is stored; only account, amount, merchant, time, dedupe_hash.
- Notification listener native module and manifest permission go into the FIRST build. Module choice (a maintained RN listener + Expo config plugin) decided and justified in slice 1.
- Security: disable Supabase sign-ups; anon key only in app; never ship the service role key.
