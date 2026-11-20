# Bad(yet) rehaul — mockup brief for Claude Code

Paste everything below the line into Claude Code (or run `/orchestrate` and point it at this file).

---

We are rehauling Bad(yet) from a "Google Sheet port" into a real budget tracker and 5-year projector. This round is **design only: information architecture, flows and HTML mockups. Do not change application code, migrations or tests.** Wait for my approval before anything is built.

## Read first
- `PROJECT_STATE.md` (to `<!-- END SUMMARY -->`), `PRODUCT.md`, `DESIGN.md` (Night Emerald: keep its tokens, fonts and dark + light themes).
- The current app: `app/(app)/*`, `components/dashboard.tsx`, and the domain logic in `lib/pay/compute.ts`, `lib/windfall/compute.ts`, `lib/domain/allocator.ts`, `lib/savings/*`, `lib/accounts/*`. The tax/contribution engine and the bonus logic (de minimis per event, shared 90k yearly cap, 13th month has no de minimis) are correct and stay; the UX around them is what changes.
- Earlier mockups in `docs/mockups/` are history, not a template. a-passbook, b-signal and c-quiet-ledger are rejected anti-references.
- Use the `impeccable` skill for the design pass.

## What is wrong today
1. The app records plans, never what actually happened: no transactions, balances only move when a planned transfer is ticked or typed in by hand. "Left to spend" is planned, not real.
2. Everything hangs off a dated "plan" (duplicate a plan to estimate, compare plans). That is the sheet-tab mental model and it blocks long-range projection.
3. The savings forecast is 12 months, only CIP feeds it (13th month and other bonuses are missing), there are no raises, and fund starting balances are typed by hand.
4. Bonuses are one-off entries, not yearly rules.
5. Categories are fixed (Essentials / Wants / Savings; funds fixed to Emergency / Travel / Wants).
6. Most screens are forms plus tables.

## The new app answers three questions
1. **What do I have right now?** Real account balances, kept current from transactions.
2. **What can I spend until payday?** Planned vs actually spent, per category, per cutoff (paydays 10th and 25th; cutoffs run payday to payday).
3. **Where will I be in 5 years?** A month-by-month projection driven by my real salary path, my bonuses and my budget rules.

## Requirements to design for

### A. Salary path (not a flat % raise)
- A **salary timeline** of dated events, each changing the base from its effective month: merit raise (% or new amount), promotion (new base, optional new title/grade), allowance change, one-off adjustment. Each year can differ; no single "raise %" knob.
- Optional "assumed future raise" rule only for years after the last event I entered, clearly labelled as an assumption and shown differently on charts.
- From the timeline the existing engine computes take-home pay per cutoff for every month of the 5 years (SSS, PhilHealth, Pag-IBIG, withholding tax). Show the assumption that today's tax table and contribution rates hold, with a place to change them later.
- A salary screen that shows: base and take-home per year, the step each event causes, and the take-home change per cutoff in pesos ("+₱1,240 per cutoff from Mar 2027").

### B. Bonuses as yearly rules
- 13th month (default December, one month of base at that time, no de minimis), CIP (month, eligible earnings × component × multiplier, with low / base / high multiplier), September bonus, and custom bonuses. Each with its own de minimis where allowed.
- Bonus amounts follow the salary timeline (a raise raises next year's 13th month and CIP).
- A **bonus planner** card per upcoming bonus: gross → de minimis → cap room left this year → tax → net, then how I split it (into funds, debt, wants), with the split ticked off when done.

### C. Budget that follows the salary
- Budget lines in **custom categories** that I create, rename, colour, reorder and archive. Categories belong to groups (start with Essentials / Wants / Savings, but groups are editable too).
- Each line has a **rule**, not just an amount: fixed amount, % of take-home, fixed amount that grows with inflation, or "whatever is left". Each line has a cutoff (1st, 2nd, both) and an optional destination account.
- Because lines are rules, every future month's budget is computed from that month's projected take-home. Show the future budget per year, and flag months where fixed lines exceed take-home.
- Allow a line to start or end on a date (a new rent from Jun 2027, a loan that ends).

### D. Savings funds: custom, scenario-aware, overridable per month
- **Custom funds**, unlimited, replacing the fixed Emergency / Travel / Wants. Each fund has: starting balance (or linked to a real account so it updates itself), target or cap, and a fill rule: fill to cap, fill in steps (current Emergency fund tranche behaviour), reset each year (current Travel behaviour), or fixed monthly amount.
- A **default priority order** for funds.
- **Per-month override power**: for any month I can (1) drag the funds into a different priority order for that month only, (2) pin a fixed amount to a fund for that month, or (3) skip a fund that month. Overridden months are visibly marked and can be reset to default in one tap. Bulk: "apply this order to Jan–Mar".
- Savings into the forecast = the savings-group budget lines of that month (which now grow with take-home) + net bonuses assigned to funds that month.
- **Scenarios**: a scenario is a named set of assumptions (salary timeline variant, CIP multiplier, inflation, assumed raises). The forecast runs for each scenario. Overrides are stored per month and apply to every scenario by default, with an option to scope an override to one scenario. Design how this reads on the screen without becoming confusing; propose 2 options.
- The forecast view: 60 months, zoomable to year view; stacked fund balances; a scenario switcher or compare overlay (2–3 lines max); a month detail sheet showing pool, where it went, why (priority, cap hit, override).

### E. Real money tracking (Android phone app later)
- A `transactions` concept: account, amount, merchant, category, source (bank notification / manual / transfer), status (pending / confirmed). Balance = last confirmed balance + transactions since.
- An **Inbox** of pending transactions parsed from bank app notifications (GCash, Maya, BPI, etc.) to confirm or recategorise with one tap; rules like "always put Grab under Transport".
- Fast manual "+ expense" entry on the phone.
- Now screen shows planned vs spent for the current cutoff and a safe-to-spend-per-day figure based on real spending.
- The phone app will be Expo on Android with one native build and later changes shipped by OTA update, so: design the phone screens (Now, Inbox, Accounts, quick add) as the primary phone experience; planning screens (salary, budget rules, funds, 5-year forecast) are desktop-first but must work on a phone.

### F. Remove or fold away
- Dated "plans", duplicate plan, compare plans → replaced by scenarios.
- Setup becomes a short first-run wizard (accounts → salary → paydays → categories → funds) plus a plain settings page.

## What to produce
1. **IA and flows** (`docs/rehaul/ia.md`): the new navigation (phone tabs and desktop sidebar), each screen's job in one line, and the flows: first run, payday, confirm a notification transaction, add a salary event and see the 5-year change, plan a bonus, override a month's fund priority.
2. **Data model sketch** (`docs/rehaul/model.md`): tables and fields for salary events, bonus rules, categories/groups, budget line rules, funds, month overrides, scenarios, transactions. Note what migrates from current tables. No migrations yet.
3. **Mockups** in `docs/mockups/v13-*.html`, sharing one CSS file, dark and light, phone (375px) and desktop widths, realistic **fake** numbers (never my real figures or names):
   - Now (phone): cutoff, safe-to-spend, planned vs spent, inbox badge.
   - Inbox (phone) and quick add.
   - Salary timeline with take-home per year.
   - Budget with custom categories and line rules, current month and a future year.
   - Bonus planner.
   - Savings funds editor.
   - 5-year forecast with scenarios, and the month override interaction (reorder, pin, skip, reset).
   For Now, the 5-year forecast and the month override, give **2–3 distinct directions** each; the rest one direction.
4. A gallery page `docs/mockups/v13-gallery.html` linking all of them, with a one-line note per direction on its trade-off.
5. Open questions for me, as a short list at the end of `ia.md`.

## Rules
- Copy is playful and personal (my own notebook, not a bank), but never obstructs the numbers. Money in PHP, tabular figures, centavo-exact.
- WCAG AA contrast, keyboard operable, both themes.
- Keep `PROJECT_STATE.md` current (via haiku-logger / state-sync): log this as a new design round and set the gate to waiting for my mockup pick.
- Stop after the mockups and tell me how to open the gallery.
