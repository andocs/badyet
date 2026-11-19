# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Next.js (App Router, TypeScript) on Vercel, Supabase (Postgres, magic-link auth). Decided in Phase 1 (see PROJECT_STATE.md). A later port to an Expo Android app is planned, so the design should translate to a phone-first layout.

## Users
One person (the owner), a salaried worker in the Philippines who budgets per pay cutoff (1st and 2nd of the month). They use it on phone and desktop equally: planning sessions on desktop, check-ins on phone when money moves (ticking off transfers to wallets). Single user, login restricted to one allowed email.

## Product Purpose
A hosted personal budgeting app converted from the Google Sheet "Bad(yet) Sheet". It turns an annual base salary into per-cutoff net pay (SSS, PhilHealth, Pag-IBIG, income tax), splits it into Essentials / Wants / Savings, shows what to transfer to which wallet (Gcash, Maya, BPI, Vybe) with done checkboxes, and tracks installments, subscriptions, bonuses (13th month, CIP) and a savings forecast. Success: each payday takes minutes, and the owner knows exactly what is left and where it goes.

## Positioning
Built around the owner's own pay-cutoff routine and Philippine payroll deductions, with a per-cutoff "to transfer by wallet" checklist. Generic budgeting apps do not model this.

## Operating Context
Money is stored as integer centavos in PHP; dates in Asia/Manila. Named plans with date ranges (one active, duplicate to make estimates, past plans read-only). Data is imported once from the sheet; the sheet is retired.

## Capabilities and Constraints
- MVP: salary/tax calculation with per-line overrides, budget split by cutoff and monthly roll-up, To Transfer by wallet, installments and subscriptions, bonuses, savings forecast.
- Dropped: AI Advisor / Scenario Planner.
- Open (non-blocking): some financial-logic items still marked CONFIRM; 2027 CIP tax exemption rule unverified.

## Brand Commitments
Name: "Bad(yet)", a pun on budget. Copy voice is playful and personal: it should feel like the owner's own notebook, not a bank. Three earlier mockups (docs/mockups/a-passbook, b-signal, c-quiet-ledger) were rejected; keep them as anti-references, not starting points.

## Evidence on Hand
Real data in the Google Sheet id 1r7JQq-LOFu5FrZryqhgwsuEHoGKVbpPLxeCD1vPkrG4 (14 tabs; sample totals net 25,008.38 and 24,356.50). The sheet holds personal financial data and family names: never put real values or names in committed mockups. No logo, no testimonials, no brand assets exist.

## Product Principles
- The next action (what to transfer, to which wallet) is always visible before any detail.
- Numbers are exact and legible: centavos-accurate, tabular, never decorative.
- Equal citizens: phone and desktop are both first-class.
- Personality lives in copy and small details, not in obstructing the money.

## Accessibility & Inclusion
WCAG AA contrast and keyboard operability. Dark mode is required alongside light.
