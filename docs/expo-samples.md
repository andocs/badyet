# Capture samples (redacted, 2026-11-21)

Fixtures for the E6 (notification) and E7 (Gmail) parsers. The notification samples are generic or from the user's own phone with names redacted. They may not match what real money-out events say. Replace with real ones as they appear.

## Push notifications (title | body)

| Source | Title | Body |
|---|---|---|
| BPI (generic, user's push does not fire) | BPI | Your account XXXXXXX644 has been credited PHP 100.00 through a deposit via BPI partner store. |
| GCash | You have received money in GCash! | You have received 1500.00 of GCash from China Bank Sa.. (sender is truncated; read big text if present) |
| MariBank | Successful Incoming Transfer | You've received PHP 34,990.00 from GrabPay with account ending 4615. |
| Maya (out) | Money transferred | Success! You transferred ₱50.00 to BPI / VYBE by BPI. |
| Maya (in) | Money received | You received ₱1.00 from Maya Savings |
| GoTyme (in) | Transfer received | You received ₱1.00 from <NAME>. |
| Google Wallet | not captured yet (needs a real tap-to-pay) | |

Amount forms seen: `PHP 100.00`, `1500.00`, `PHP 34,990.00`, `₱50.00` (peso sign U+20B1), thousands commas.

## Gmail

- BPI InstaPay: subject "BPI InstaPay", body "Incoming Interbank Funds Transfer Confirmation ... Reference Number 2026...". Amount is below the notification fold; full email body still needed.
- Grab receipt: "Hope you enjoyed your food!", TOTAL ₱514.00, "Pick-up time: 21 Nov 26 10:03 +0800", pick-up location (merchant) "D' Original Pares - Pasig", Payment Method "Visa 1506" (card last4 maps to an account), booking code A-xxxx. Discounts appear as negative lines; "TOTAL (INCL. TAX)" is the charge.
- foodpanda "order placed": Order number, Order time "2026-11-20 22:00:01", Store "KFC - Pasig Caruncho", "Order Total ₱756.50". This is an order-placed email, not a payment receipt; payment method is not shown.

## Parser notes

- Direction: "received / credited / incoming" = income; "transferred / sent / paid" = expense or transfer.
- Counterparty: GrabPay, Maya Savings, BPI / VYBE are likely the user's own accounts, so these may be transfers, not income.
- The same event can arrive twice (for example BPI push plus BPI email); dedupe must work across sources, not only per source.

## Added 2026-11-21 (second batch, real texts, names and numbers redacted)

GCash texts below come from the GCash in-app inbox. The push body may be shorter, so confirm against real pushes.

| Source | Text |
|---|---|
| GCash out (buy load) | "You have paid P112.00 of GCash to purchase NEW POWER ALL FB + BINGE 109 with a convenience fee of P3.00 for 09xxxxxxxxx on 09-23-26 08:55 AM. Your GCash balance is P22.41. Ref. No. 111913449." |
| GCash in | "You have received 900.00 of GCash from BPI / VYBE by BPI with account ending in 8167. Your new balance is 1032.41 11-10-26 07:19 AM. Ref. No. 20261110BOPIPHMMXXXB000071916652428." |
| GCash out (Express Send) | "You have sent PHP 500.00 to LU*******A D. +639xxxxxxxxx on 10-23-2026 09:29 AM with MSG: . Your new balance is PHP 423.41. Ref. No. 1046430918200." |
| GoTyme out | title "Transfer successful": "You sent P1.00 to <NAME> Bank Of The Philippine Islands (BPI) ••••••8167." |
| MariBank out | title "Successful InstaPay Transfer": "An InstaPay transfer of PHP 1.00 to BPI <NAME> on 21 Nov 2026 12:11 was completed. If unauthorized, please chat with us live on the MariBank app." |

BPI emails (Gmail):
- Outgoing, from onlinebanking@bpi.com.ph, subject "Interbank Funds Transfer Confirmation". Table rows: Confirmation Number (R...), Transaction Date and Time ("Saturday, Nov 21 2026; 11:52:34 AM (GMT +8)"), Transfer From ("XXXX-XXXX-167 (nickname)"), Transfer To (masked), Bank Name (GoTyme), Transfer Amount (PHP 1.00), Service Fee, Total Amount, Transfer Service (INSTAPAY), Transaction Ref No.
- Incoming, from bpiinstapay@bpi.com.ph, subject "Incoming Interbank Funds Transfer Confirmation". Rows: Reference Number, Transaction Date and Time ("Saturday, Nov 21 2026; 11:55:16 AM(GMT + 8)"), Transfer From (masked), Transfer To (XXXXXXXXXX8167), Bank Name (Maya Philippines, Inc.), Transfer Amount (PHP 50.00), Transfer Service.

More formats: `P1.00`, `PHP 500.00`, dates `MM-DD-YY`, `MM-DD-YYYY`, `21 Nov 2026 12:11`. GCash texts carry a balance, which could later feed balance anchors (nice-to-have).

## Own-account transfers

One real move shows up in two places: Maya "transferred ₱50.00 to BPI / VYBE" at 11:55 and the BPI email "Transfer Amount PHP 50.00 from Maya Philippines" at 11:55:16. Same pattern for GoTyme to BPI and MariBank to BPI. Pair them by equal amount, opposite direction, within a few minutes, and both ends being the user's own accounts (matched by bank name and last4, e.g. BPI ending 8167). Paired rows become one transfer, not income plus expense.

## Decisions on sources

- Grab and foodpanda emails are receipts, not order-placed mails: capture the total as a pending expense. The foodpanda email shows no payment method, so the account comes from a capture rule or the Inbox. Grab shows "Visa 1506", which maps to an account by last4.
- Capture sources: GCash, Maya, BPI (Gmail only; its push does not fire), GoTyme, MariBank, Grab, foodpanda, Google Wallet (blocked until a real tap-to-pay).
