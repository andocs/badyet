# Handoff: the Android (Expo) app for Bad(yet)

Read this first in the new conversation, then `PROJECT_STATE.md` (down to `<!-- END SUMMARY -->`), then `docs/rehaul/ia.md` and `DESIGN.md`. State lives in `PROJECT_STATE.md`, never in `CLAUDE.md`. Start with `/orchestrate`: this is Phase 1 (plan and design) of a new effort, so do not build before the plan is approved at its gate.

## Where things stand (2026-11-21)

- The web app is done and merged. `main` is at `e561be1`, which includes revisions rev-1 to rev-11. Typecheck, lint, 244 unit tests and the production build all pass. The layout work has not been checked in a browser by Claude; the user has been checking it on desktop, tablet and a Z Fold 6 preset (412 x 968).
- `main` is pushed. The older `rev/27` to `rev/36` branches exist from earlier work and are not part of this effort.
- There is no Expo or mobile code yet, no JSON API, and no notification code of any kind.

## What the web app is

A single-user personal budgeting app, converted from a Google Sheet. Next.js 16.4.6 (App Router, `proxy.ts`), React 19.3, Supabase (Postgres, Google sign-in), TypeScript, vitest and Playwright. Every page is per-user and server-rendered. Money is stored as bigint centavos; percents as basis points. Timezone Asia/Manila. Paydays are the 10th and 25th by default; a cutoff runs payday to payday.

`AGENTS.md` warns that this Next.js has breaking changes; read `node_modules/next/dist/docs/` before touching web code. The Expo app does not need Next.

## Decisions already made (docs/rehaul/ia.md and docs/rehaul-prompt.md)

- Android is the primary phone target. Five tabs: Now, Inbox, + (quick add), Accounts, Plan.
- Notification capture: the phone parses GCash, Maya and BPI notifications on the device and inserts a `pending` transaction. Only account, amount, merchant, time and a dedupe hash leave the phone. No raw notification text is stored.
- The notification-listener native module and its manifest permission must be in the FIRST native build; adding a native module later forces a new build. Play Store restricts notification access, so plan on internal distribution (sideload or internal testing track). OTA updates later for JS-only changes.
- Keep `lib/` pure TypeScript so Expo can share it (engine, budget, now, inbox rules).
- Notification access is a user grant in Android settings. The web Settings page already has the `notif_capture_enabled` switch ("saved for when it arrives").

## What the phone has to talk to

There is no REST API. All web writes are Next server actions that depend on a cookie session, so the phone cannot call them. Two options:

1. Talk to Supabase directly from the phone with the user's session (supabase-js) and rely on row-level security. Every table has `user_id default auth.uid()` and "own <table>" policies for select, insert, update and delete. This is the likely choice for Inbox, Accounts, quick add and reading Now.
2. Add a few route handlers for anything that must stay server-side (for example the Now summary built by the engine in `lib/now`).

Auth today: Google OAuth through Supabase (`app/login/actions.ts`, `app/auth/callback/route.ts`). Single user: the email must equal `ALLOWED_EMAIL`, checked only in Next code (`lib/auth/allowed.ts`, the callback, `proxy.ts`, `requireAuthed`). A phone talking straight to Supabase skips those checks. RLS keeps other accounts from seeing your rows, but the project should still refuse other sign-ups (see open question 4).

Env var NAMES only: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (local seed only). Never put the service role key in the app.

## Data the phone needs (supabase/migrations/20261206000000_rehaul_schema.sql, docs/rehaul/model.md)

- `transactions`: id, account_id, occurred_at, amount (centavos, negative is money out), merchant (80 chars), kind expense|income|transfer, category_id, budget_line_id, source notification|manual|transfer|import|bonus, status pending|confirmed|ignored (default confirmed), confirmed_at, note, `dedupe_hash` (unique per user when not null).
- `accounts` (kind ewallet|debit|savings|credit|cash, last4, color) and `balance_anchors`; an account's balance is its latest anchor plus confirmed transactions after it.
- `categories`, `category_groups`, `budget_lines_v2`, `merchant_rules` (pattern is a case-insensitive contains match, with category and optional account; logic in `lib/inbox/rules.ts`: `matchRule`, `normalizePattern`, `bestGuess`).
- `user_settings`: `notif_capture_enabled`, paydays, `office_days`, timezone, `hide_amounts`.
- Pending notification rows appear in the web Inbox only once the phone inserts them. Pending spends are not counted until confirmed.

## Design to match

"Night Emerald", dark by default with a full light theme: `DESIGN.md` (front matter and 178 lines of rules), tokens in `app/globals.css` and `app/v13.css`. Fonts: Gabarito (display, 700 and 800) and Atkinson Hyperlegible Next (body, 500 to 700). Emerald `#34D399` accent, deep blue surfaces, round controls (999px), cards 10px, hero 14px. The web look has: round tick controls, calendar-style popovers instead of dropdowns for dates, a shared confirm dialog and toasts (no native alerts), a hide-amounts mode that masks every peso figure. The `impeccable` skill has an Android reference (`.claude/skills/impeccable/reference/android.md`): follow Material 3 behaviour (system Back, 48 dp targets, window size classes for the Z Fold and tablets) and theme the brand through it, rather than copying the web CSS.

## Suggested scope (the plan should confirm or cut this)

Needed: sign in with Google, Now, Inbox (confirm or ignore pending rows, one tap each), Accounts, quick add expense, notification capture for GCash, Maya and BPI with dedupe, hide amounts.
Nice-to-have, propose cutting for v1: Plan screens (Budget, Salary, Bonuses, Funds, Forecast stay on the web), offline queue, widgets, push notifications.

## Open questions to ask the user first

1. Distribution: sideload APK, internal testing track, or Play Store? This decides the notification-listener approach.
2. Shared code: put the Expo app in this repo (for example `mobile/` with a workspace) so it imports `lib/`, or copy the pure files?
3. Real notification samples: the parsers need the actual text of a few GCash, Maya and BPI notifications (amounts and merchants can be redacted).
4. Sign-up lock: how to stop other Google accounts from creating Supabase users now that the phone talks to Supabase directly (disable sign-ups, or an auth hook that checks the allowlist).
5. Deep-link scheme and redirect URL for Google sign-in on Android, and an EAS account for builds.
6. Offline: must Quick add work with no signal and sync later?

## Rules carried over from this project

- Haiku scouts and runners, Sonnet plans and builds, a human gate after every phase and slice (`.claude/skills/orchestrate/`). Ask the scout instead of browsing directories.
- Update state through `node .claude/scripts/state.js`, never by hand-editing `PROJECT_STATE.md`.
- No secrets in code; validate on the server side of anything the phone sends; keep the notification text on the device.
- Do not run the setup script or recreate the orchestrator: it is already installed here.
