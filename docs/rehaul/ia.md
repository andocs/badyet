# Bad(yet) rehaul: information architecture and flows

Design round v13. Design only: nothing in `app/`, `lib/`, `supabase/` or tests changes until you pick directions. Mockups: `docs/mockups/v13-gallery.html`. Data model: `docs/rehaul/model.md`.

Written for: the owner, deciding what to build.

**Round 3 (after your second notes).** Content spans the page. Now is a full-width hero, a scrolling account row, then planned vs spent (70%) beside recent spends. Inbox shows To check as 2 to 4 cards per row with All activity at the right. Salary and tax has the chart on top and Timeline / Payslip tabs; assumptions moved into the raise wizard along with contribution overrides. Bonus destinations can be custom, flat or percent. Forecast dropped assumptions, isolates fund lines from the pills and has a Chart / Year by year switch.

**Round 2 (after your first notes).** The directions are merged: one Now, one Forecast, Override A for a single month and B for bulk. Scenarios (the Steady, Slow lane and Big year pills) are gone from every page. Salary became a salary-and-tax calculator, Bonuses gained one-offs, history and a mini-budget view, and there are three wizards (first run, raise or promotion, bonus).

## The three questions

| Question | Answered by | Source of truth |
|---|---|---|
| What do I have right now? | Now (balance strip), Accounts | Last confirmed balance + confirmed transactions since |
| What can I spend until payday? | Now, Inbox | The cutoff's spendable budget lines vs confirmed spend |
| Where will I be in 5 years? | Salary and tax, Budget (future), Bonuses, Funds, Forecast | Rules + salary events + allowances, computed month by month |

Nothing is a "plan" any more. There is one live set of rules and assumptions.

## Navigation

### Phone: five tabs (Android app is the primary phone experience)

| Tab | Goes to | Notes |
|---|---|---|
| Now | Now | Home. Safe to spend until payday. |
| Inbox | Inbox | Badge = pending count. "All activity" is a second view inside it. |
| + (centre) | Quick add sheet | One-handed expense entry from anywhere. |
| Accounts | Accounts | Balances, reconcile, fund-linked accounts. |
| Plan | Budget | A strip at the top reaches the other Plan pages: Salary and tax, Budget, Bonuses, Funds, Forecast. |

Plan pages are desktop-first but every one works at 375px (strips scroll, tables scroll, sheets rise from the bottom).

### Desktop: left rail (216px), same destinations

```
Today    Now · Inbox (badge) · Accounts
Plan     Salary and tax · Budget · Bonuses · Funds · Forecast
(foot)   Settings
```

Quick add is a floating button on Inbox and a keyboard shortcut elsewhere. Theme and hide-amounts live in Settings and the top bar.

### What disappears

| Today | Becomes |
|---|---|
| Plans, duplicate plan, compare plans, plan switcher, "viewing, not active" banner | One live set of assumptions on Salary and tax and Bonuses. Scenarios were dropped from the UI in round 2. |
| Month (Budget, Installments, Subscriptions, Bonuses) | Budget (lines with start/end dates cover installments and subscriptions), Bonuses |
| Savings (12-month forecast) | Funds (setup) + Forecast (60 months) |
| Transfer page (tick sent per wallet) | Transactions of kind "transfer", confirmed from Inbox or ticked on Now |
| Setup (Plans, Accounts, Pay, Settings, Import) | First-run wizard + Settings + Accounts + Salary and tax |

## Screens in one line each

| Screen | Job |
|---|---|
| Now | "How much can I spend today, and am I on pace?" One screen: safe-to-spend hero with the runway chart, planned vs spent as envelopes, account cards, Inbox button, recent spends. |
| Inbox | Opens on All activity; To check is one tap away. Confirm, recategorise or ignore in one tap; make "always" rules. Desktop: wide cards open a details panel. Phone: the compact list. |
| Quick add | Record a cash or card expense in under five seconds. |
| Accounts | Colour cards per account; see each balance and the sum that proves it, reconcile, and keep the account's receive-QR for reference. |
| Salary and tax | A salary calculator: dated events, monthly and yearly allowances, and a payslip for any month showing every tax step, so the forecast can trust it. |
| Budget | Edit category and line rules; see this month planned vs sent, and any future month computed. |
| Bonuses | Yearly rules and one-offs by year (past and future); plan each bonus gross to net and allocate it like a mini budget (funds, gifts, big purchases, debt). |
| Funds | Define funds, fill rules, linked accounts and the default priority. |
| Forecast | 60 months or by year, stacked or lines; a year ladder; open a month for pool, where it went, why. |
| Override a month | A: reorder, pin or skip for one month. B: the same, for many months at once. Reset in one tap. |
| Wizards | First run, add a raise or promotion, plan a bonus. Step by step with a live payslip. |
| Settings | Paydays, tax tables, notification rules, looks, export, re-run the first-run wizard. |

## Rules that hold across screens

- Money is PHP with two decimals, tabular figures, stored as centavos. A computed future amount is shown to the centavo.
- Anything that comes from an assumption (assumed raises, drafts) is dashed or labelled "assumed", on every chart and table.
- Overridden months carry a marker everywhere they appear, and a one-tap reset.
- Pending transactions never change a balance or "left to spend" until confirmed. Now says when some are waiting.
- Cutoffs run payday to payday (paid 10th covers 11th to 24th, paid 25th covers 25th to the 10th) and belong to the month they start in. Unchanged from today.
- Both themes, WCAG AA, every control keyboard operable. The mockup month grids and charts have non-pointer paths (jump selects, buttons).

## Flows

### 1. First run (wizard, five steps, skippable)

Mockup: `v13-wizard.html`, full screen with a live "setup so far" payslip on the right.

1. **Accounts.** Name, kind, last four digits only, current balance. Each balance becomes the first balance anchor (as-of today).
2. **Salary.** Base per month, start month, optional title and grade. Creates the "Starting salary" event. A pointer to the raise wizard and the bonus wizard for anything already decided.
3. **Paydays.** 10th and 25th prefilled, with the two cutoffs spelled out.
4. **Budget.** Starter lines in Essentials, Wants and Savings, each with a rule ("% of take-home" by default) you can tick, rename or change.
5. **Funds.** Starter set (Emergency, Travel) or none. Caps and account links come later.

Ends on Now with an honest empty state ("Pip has nothing to count yet. Add an expense or connect notifications"). Settings can re-run it.

### 2. Payday

1. On payday, Now shows a quiet banner: "Payday: ₱24,235.83 expected." Tapping **Landed** (or confirming the matching salary credit in Inbox) creates the income transaction and starts the new cutoff.
2. Now switches to the new cutoff: safe-to-spend recomputed from this cutoff's lines.
3. A "Send it" checklist lists the transfers the budget lines say to make (rent to BPI, stash to savings). Each tick creates a transfer transaction. Ticking does not move the balance twice if the bank notification arrives later; the notification matches the transfer and is merged.
4. Savings lines land in the pool; the forecast's matching month marks that allocation "done".

### 3. Confirm a notification transaction

1. Phone parses a GCash, Maya or BPI notification into a **pending** row: account, amount, merchant, time. Inbox badge goes up.
2. Inbox card shows the best category (an explicit rule first, then the most common past category for the merchant, else none).
3. **Confirm** accepts it. Tapping another category chip changes it before confirming. The switch "Always put <merchant> here" saves a rule.
4. Matching legs of a transfer (cash-in from BPI, cash-in to GCash) are paired into one transfer card. Confirming it moves money between accounts and is neither income nor expense.
5. **Not mine** ignores it (kept as ignored so it is not re-imported).
6. Confirmed transactions update the account balance (last confirmed balance + transactions since) and the cutoff's spent totals. Empty inbox shows Pip and "balances are current".

### 4. Add a salary event and see the five-year change

Mockup: `v13-wizard-raise.html`.

1. Salary and tax → **Add a raise or promotion** starts a wizard: **What happened** (merit, promotion, allowance, one-off, and whether it has happened or you are expecting it) → **The numbers** → **Check the tax** → **Save**. The wizard only ever adds one event; it has no assumptions step.
2. A payslip beside the form shows **before and after** for that month: base, allowances, SSS, PhilHealth, Pag-IBIG, income tax, take-home, change per cutoff. Below it: the five-year take-home effect and the 13th-month effect.
3. Save. The events list, the payslip, the chart and the year table update. Expected events show a hollow marker and an "expected" tag; the forecast counts them. Confirm one by editing it when it happens.
   **Where the extra goes.** An optional wizard step lets you put part of the new take-home on budget lines (pesos or a percent of the extra). The unplaced rest lands in Whatever is left. Each top-up stays tied to its raise: change or delete the raise and the top-ups follow. Budget tags those lines "+₱500 from the Jul 2027 raise".
   **Planning around an unconfirmed raise.** Budget's Future years view marks months that include an expected raise (a ○ and a tag), and has a **Compare without expected raises** switch that shows take-home, percent lines, fixed lines and what is left, with and without. Forecast shows its own with / without total.
   **Projecting raises.** Two tools, both on Salary and tax: dated events marked *expected* (a planned promotion in Jul 2027), and a **Projected raises** card that applies a yearly percent in a chosen month after the last dated event (dashed). The card has an on/off switch.
4. The same change flows to: Budget future months (percent lines grow), Bonuses (13th month and CIP), Forecast. Of each extra peso, the percent lines take their share and the rest lands in "Whatever is left", which feeds the savings pool.

### 5. Plan a bonus

Mockups: `v13-bonus.html` (the page) and `v13-wizard-bonus.html` (add one).

1. Bonuses opens on the year (this year first; history and future years one tap away). A hero shows the year's bonus money after tax and a coloured bar of where it goes. It reads like a small budget: gifts, big purchases, funds, debt, treats.
2. Yearly rules (13th month, CIP) and one-offs (a September or retention bonus, announced once) live on the right. **Add** opens a wizard: **Type** → **When and how much** → **Check the tax** (a payslip of gross, de minimis, shared cap, tax, net) → **Where it goes** → **Save**.
3. Each bonus card walks the arithmetic on the left and the split on the right. **Change split** edits percentages and adds destinations; the unplaced remainder is shown in the warning colour until it is zero. CIP has a Low / Base / High switch and shows what High costs in tax.
4. Past bonuses sit collapsed with planned vs received and where each peso went, ticked.
5. When money lands the card moves to "received"; ticks create transfer transactions. Forecast uses the plan split for the future and actuals once received. Only fund destinations change fund balances; gifts, purchases and debt are spent on purpose.

### 6. Override a month's fund priority

1. From Forecast, tap a month (or "Months that differ") → the month sheet shows pool, where it went and why.
2. **Override this month** opens **A** (one month): reorder list with drag or arrows, pin an amount, skip, a live "what it does" and "five years later" summary, reset, and "apply this order to Jan to Mar". **Edit several months** opens **B** (bulk): a year grid; tick months, then put a fund first, pin or skip for all of them, or reset. Clicking a single cell pins or skips just that fund.
3. Overridden months carry a marker on charts, the month grid and the "Months that differ" list.
4. **Reset.** One tap on the month, or "Reset to default" for ticked months.

## Scenarios

Round 2 dropped the scenario switcher everywhere. The model keeps one set of assumptions (`plan_assumptions`). If "what if the promotion slips" comes back, it can return as a toggle on Salary and tax without reshaping the rest (see model.md).

## Phone app notes (Expo, Android)

- One native build, later changes by OTA update. OTA can ship JS and assets only. **The notification-listener native module and its manifest permission must be in the first native build**, or reading bank notifications will need a second store-style build.
- Reading notifications needs Android's special "Notification access" grant from the user; Google Play restricts this permission, so plan on internal distribution (personal sideload or EAS internal channel) rather than a public Play listing.
- Parse on the device; send only account, amount, merchant, time and a dedupe hash. No raw notification text, card or account numbers.
- Offline: quick add and Inbox confirmations queue locally and sync later; Now computes from the last synced rules and local transactions.
- The shared `lib/` (pay, windfall, allocator, forecast) stays pure TypeScript so web and Expo import the same code.

## Decisions (open questions, answered)

1. **Inbox** opens on All activity.
2. **Safe-to-spend** counts only budget lines you tick as "Counts toward daily spend" (a ticker on each line in the Budget tab). In practice that is the Wants lines. Fixed bills are sent, not spent.
3. **Pending** spends do not count until confirmed; Now warns when some are waiting.
4. **Allowances** default to not taxed, each with a Taxable switch.
5. **Cutoffs are not equal.** A payslip builder per cutoff (see below) replaces the equal-halves assumption.
6. **Tax tables**: one set holds for five years, with room to change from a month onward.
7. **Inflation is removed.** No "Fixed + inflation" rule and no inflation assumption; fixed lines stay fixed until you edit them.
8. **Funds sharing an account** are virtual shares of that account's balance.
9. **Full funds**: the pool stays in your spending account.
10. **Bonus gifts and big purchases** are spent, not saved.
11. **September bonus** is one-off.
12. **Receive-QR** images are stored privately on the server.
13. **Old transfer ticks** are dropped.
14. **Android** is a private sideload or internal build. Web first; the Expo app comes after.
15. **January Wants reset** stays as-is until reported as a bug.

### New requirements from the answers (not yet mocked)

**A. Counts toward daily spend.** Each budget line gets a ticker. Only ticked lines make up the daily safe-to-spend. Wants lines are ticked by default; Essentials are not.

**B. RTO (return-to-office) budget and Pools.**
- Settings: office days of the week (default Monday and Tuesday) and a **peso amount per office day** (commute, lunch).
- On a usual office day (Mon, Tue) the daily safe-to-spend is higher by that amount, **whether or not you go in**, and today is read from the calendar: there is no "in office today" switch.
- **Designating the RTO lines.** In a line's editor (not shown on the line itself) three tickers sit under "Counts toward": Daily spend, **RTO days** and **RTO contingency**. Any number of lines can be RTO lines (for example commute and food); only one line is the contingency. The app works out an office day's budget itself: the RTO lines' cutoff total divided by the usual office days in the cutoff. There are no per-day or spontaneous-day inputs.
- **Extra days are manual.** You tap the days you went in outside your usual days; each draws one day's budget from the contingency pool.
- **Settling an office day.** When an office day ends under budget, the app asks where the leftover goes: the contingency pool or Wants. When it ends over, it asks what to subtract from: Wants, or the contingency pool's excess. Now shows a nudge until settled; Budget has the choices and an Undo.
- **Pools.** A pool is money that builds across cutoffs (the RTO contingency is one; Car maintenance is another example). From a pool you can **use** an amount for something unplanned (a spontaneous office day) or **move it to Wants**, which adds to the cutoff's daily spend. A pool can have a "keep up to" level; anything above it shows as excess.

**C. Payslip builder (per cutoff).**
- Base pay splits into halves by default. Each cutoff then has its own list of lines, which you can edit:
  - 1st cutoff: base half, minus half of the month's income tax.
  - 2nd cutoff: base half, minus the other half of the income tax, minus SSS, PhilHealth and Pag-IBIG, plus the allowances.
  - Income tax is withheld in **both** cutoffs (split editable, 50/50 by default). Taxable allowances raise taxable pay; non-taxable ones do not.
  - **Bonuses and allowances.** The cutoff each recurring allowance and each bonus lands in is a setting on the allowance (Salary and tax) and on the bonus rule (Bonuses page, and the bonus wizard). The payslip builder reads it, and moving a line in the builder updates the same setting. Bonuses appear on the payslip of the month they land, with their own tax on the part over the shared cap.
  - Lines are added directly in each cutoff's table.
- Any line can be overridden, added or removed per cutoff. The builder shows both payslips side by side and the monthly total.
- Forecast, budget and Now read take-home per cutoff from the builder, not from an equal split. A raise changes the base half; the placement of each deduction stays as you built it.
- Replaces the "per-cutoff overrides" idea and the contribution overrides in the wizard (those become fields in the builder).
