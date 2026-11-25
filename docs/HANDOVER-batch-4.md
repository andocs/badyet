# Handover: revision batch 4 (notes from the user, 2026-11-25)

Start a new conversation in d:\projects\badyet and type `/orchestrate`. Read `PROJECT_STATE.md` (status) and this file. Nothing below has been approved or started. Phase 3 flow: analyse, rank (Needed / Nice-to-have), user picks, slice as rev-33 onward, one gate each.

## Where things stand

- Revisions 28 to 32 are merged to `main` and pushed (Rules page, dedupe, card payment legs, Gmail alert check).
- Migrations 20261214 to 20261216 are applied. **20261217000000_gmail_alert_check.sql: confirm it is applied.**
- Latest APK (rev-32): https://expo.dev/artifacts/eas/aQCFWQJlwjwy4N1LgU-VtsNRqLk_1bfxgES4vFJNpuU.apk
- Build the APK with `cd mobile; npx eas-cli@latest build -p android --profile preview --non-interactive --no-wait`; then poll `build:view <id>` for the artifact URL.
- Rules and habits: git goes through `node .claude/scripts/ship.js rev N <slug> "<subject>"` (creates and pushes the branch); main is merged with `--no-ff` and pushed only after the user approves a gate. After pushing, the Vercel preview/prod build must pass (see memory: vercel preview check).
- Known leftovers from batch 3: Maya parser does not read "payment received on your Maya Black"; card payments answered before rev-30 lack their card leg; only one duplicate rule is editable; mobile lint (`expo lint`) was never run on rev-29 to rev-32.

## The user's notes, grouped

### A. Questions to answer first (read the code, answer in chat, no build)

1. Where does the Now hero get the total money, i.e. where the "safe to spend per day" limit comes from? Start at `lib/now/load.ts`.
2. How do bills and transfers work (budget lines, paying a bill, transfer pairs, the Inbox)?
3. Inbox consolidation: Maya notification first, BPI transfer email 5 minutes later: one item? **Correction (the earlier answer in chat was wrong for transfers; verify in code):** dedupe (`lib/capture/recent.ts`, `dedupe_rules`) only merges the SAME direction, amount and a notification with an email (30 min, any source). A Maya out plus a BPI in are opposite directions, so they are not merged: they are paired into a linked transfer by `lib/capture/pair.ts` / `pairing.ts` (opposite sign, equal amount, different accounts, a link such as the counterparty naming the other account; 10 min gap in findTransferPairs, 30 min query in pairRecent). Pairing also converts an already-confirmed item and overrides its category. User idea (open): do not let the Maya item be confirmed as spending until the other side has had a chance to arrive (up to ~3 to 5 min, re-checking Gmail), only for items that look like transfers (counterparty is one of the user's accounts). Recommended: show it at once but mark it "may be a transfer, waiting for the other side" and block confirming it as spending for a few minutes, rather than holding it back. Needs a decision from the user.

4. When RTO days are reduced from the usual, does it prompt where to transfer the saved money? (Look at RTO lines in Budget and `lib/budget/load.ts`; likely no.)

### B. Payday and payslip

5. **Payday prompt.** On payday show a panel/prompt: "Has the pay arrived?" On confirm, add the net pay from that month's payslip. If a bonus came with that month's pay, ask the user for the actual take-home amount.
6. **Payslip builder fixes** (lib/salary/*):
   - Add de minimis as its own non-taxable line item.
   - Include the actual leftover bonus in the income tax computation for that pay.
   - Make income tax overridable (like the other deductions).
   - SSS, Pag-IBIG and PenBoost show blank: fix. (Defaults from PROJECT_STATE: SSS 1000, PhilHealth, Pag-IBIG 200, SSS PenBoost 750; tax on the remainder x 24 against the 2023 TRAIN bracket, divided by 24.)

### C. Budget and Now

7. Budget: add a per-cutoff view.
8. Budget: custom budget plans over date ranges, e.g. one plan for Sept 10 to Nov 25 2026 and a different one for Nov 2026 to Mar 2027 (need to settle how overlapping ranges and the boundary day work; ask the user).
9. Now: let the user choose what shows in the Planned vs Spent panel.

### D. Pages and bugs

10. Bonus page (web): spacing in the yearly rules panel is off; the Edit button sits at the very bottom.
11. Forecast: the savings plan still does not show (savings plan was rev-26, migration 20261213000000_savings_plan.sql). Reproduce first; a previous fix did not stick.
12. Web Rules page: the "Pick apps" modal has spacing problems (`AppPicker` and `Modal` in `components/v13/rules.tsx`, styles in `app/v13.css`).

### E. Rules page redesign

13. Make the default sources (GCash, Maya, BPI, GoTyme, MariBank, Grab, Foodpanda, GWallet) editable and removable on the Rules page.
14. Sources and rules look alike: consider merging them into one concept. If merged, the user prefers the layout of the add-rule editor (name, listen on, from, words, what it is) as the single pattern. Design decision for the user: what happens to per-source settings (minimum amount, usual account/category, auto-confirm) and to removing a built-in source whose parser still exists. Propose options before building. Web: `components/v13/capture-rules.tsx` (SourcesArea) and `rules.tsx`; phone: `mobile/src/app/rules.tsx`, `SourceEditor.tsx`, `RuleEditor.tsx`; engine: `lib/capture/decide.ts`, `sources.ts`.

## Suggested order

Answer A first (quick, may reveal bugs). Then the small fixes D (10 to 12) and B6 as one revision, B5 and C as separate ones, E last (needs a design gate before code).

## F. Transfer pairing decisions (from the 2026-11-25 conversation, agreed in principle)

15. **Do not hold items back.** Show a transfer-looking Maya item in the Inbox at once, marked "may be a transfer, waiting for the other side", and block confirming it as spending for a few minutes (about 3 to 5) while Gmail is re-checked. User agreed with this recommendation.
16. **Vague InstaPay side.** The Maya notification only says money was received via InstaPay; it does not name the BPI account. The BPI email does show the other side. Today `pair.ts` needs a link (counterparty naming the other account, or last4) on at least one side, so it may not pair. Proposed: when one leg is vague (generic "InstaPay" or no name), pair if exactly ONE candidate on another account has the same amount within about 10 minutes, but show it as a one-tap "looks like a transfer from BPI, confirm?" suggestion, never silently. Widen the "may be a transfer" mark in item 15 to Maya InstaPay wording too (not only counterparty = own account).
17. **Warning:** a Rules-page transfer rule on the Maya alert (kind transfer, BPI to Maya) records both legs from the alert alone, and the BPI email would then add a second BPI leg (dedupe does not merge opposite directions). Solve before recommending that rule for InstaPay transfers.
18. **Needs from the user:** one real, redacted example each of the Maya InstaPay-received notification and the BPI InstaPay email (sender, subject, amount/recipient/reference lines). Check `lib/capture/parsers.ts` and `lib/capture/email.ts` for what the BPI parser already extracts.

### Update to F (user gave real samples, 2026-11-25)
- Samples: Maya notification "You have received P1,100 from InstaPay."; BPI email "Interbank Funds Transfer Confirmation" with Transfer From "XXXX-XXXX-505 (Gcash x BPI)", Transfer To "09XXXXX0325", Bank Name "Maya Wallet/Maya Philippines", Total Amount PHP 1,100.00, Confirmation Number R1632823694584.
- Ran through the real parsers and `findTransferPairs` in a throwaway test (not committed) with assumed accounts (Maya named "Maya"; BPI last4 0505; GCash): BPI parses out 1100 (counterparty "Maya Wallet/Maya Philippines", counterpartyLast4 0325, accountHint 505, accountName "Gcash x BPI"); Maya parses in 1100 (counterparty "InstaPay"); they PAIR, linked by "maya" in the BPI Bank Name. So item 16 (looser pairing) is not needed for this case; keep as optional for transfers where neither side names the other.
- Risks to check against the user's real accounts: the Maya account name must contain "maya" (or its last4 must be 0325); BPI shows only 3 digits (505) and nickname "Gcash x BPI", which can collide with the GCash account by name, so set the BPI source's usual account (or account last4 0505) and the Maya source's usual account.
- Item 15 still stands: mark such items "may be a transfer" and block spending confirmation for ~3 to 5 minutes. The trigger can be Maya wording "from InstaPay" or an email whose Bank Name names another own account.

### G. Account matching for Maya (decided with the user, 2026-11-25)
19. **Problem.** The user has three Maya accounts: "Maya" (wallet, last4 0325), "Maya Black" and "Maya Savings". Other ewallets share the last four digits 0325 (same mobile number). A Maya notification names no account, so `resolveAccount` (`lib/capture/row.ts`) falls through to the last step (accounts whose name/institution words include a word of the source label "maya") and finds all three, returns null, and the item waits in the Inbox asking "Which account?" every time. Renaming to "Maya Wallet" does not help: `accountWords` drops filler words (wallet, savings, card, account, bank, debit, credit, cash, main), so "Maya Wallet", "Maya Savings" and "Maya" all reduce to `maya`; "Maya Black" reduces to `maya, black`.
20. **Fix (user agreed, option 2).** In the last step of `resolveAccount`, when several accounts match the source, prefer the single account whose name is exactly the source label (case-insensitive, trimmed): "Maya" wins over "Maya Black" / "Maya Savings". Keep returning null if there is still no single winner. Apply the same tie-break to the GCash, BPI, etc. sources. Add tests in `lib/capture/row.test.ts`. The user must keep the wallet named exactly "Maya" (not "Maya Wallet"). It does not help Maya Savings or Maya Black items: those still ask. Use the usual-account setting only as a stopgap.
21. **Digits note.** A shared last4 (0325) across ewallets is safe: `resolveAccount` only accepts a digits match when exactly one account fits, and the pairing link by last4 only links an incoming row that is already on that account (closest in time wins). Only risk: two same-amount incoming items on 0325 accounts within ~10 minutes of one BPI transfer.
