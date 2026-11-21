# Next session: the phone app, round two

Read this first, then `PROJECT_STATE.md` (down to `<!-- END SUMMARY -->`), then `mobile/README.md`, `docs/rehaul/ia.md` and `DESIGN.md`. State lives in `PROJECT_STATE.md`, never in `CLAUDE.md`. Start with `/orchestrate`.

## Where things stand (2026-11-21)

- Slices E1 to E12 are merged to `main` (at `9f958be`, deployed on Vercel). The phone has Now, Inbox, Quick add, Accounts, Plan (Salary and tax, Budget, Bonuses, Funds, Forecast), Settings, capture rules, notification capture and Gmail capture.
- The installed APK is build `e5f5bd62` (https://expo.dev/artifacts/eas/34GCgyG4EtnV_VjM5vLCBTf5H9g_h5T7li5ilIsk6pg.apk). Everything since ships over the air (`eas update --channel preview`, latest group `8d6b6c7a`). Runtime version `1.0.0`; only bump it with a native change.
- The user has not yet tested on the phone: E5 migration (`supabase/migrations/20261207000000_capture_rules.sql`), E6 notification capture, E7 Gmail, E8 to E11 screens. Slice gates stay open until they say so.
- Vercel must keep passing after every push touching `mobile/` or `lib/` (see memory `feedback-vercel-preview-check`).

## What the user asked for next (2026-11-21)

1. **Mockups for the Z Fold 3, cover screen, viewport about 320 x 872.** Some screens feel text-heavy. Make them more mobile friendly and easy to understand: fewer words, bigger numbers, icons and simple visuals, progressive detail (tap to expand). One self-contained HTML file per screen in `docs/mockups/` (low-fi is fine), Night Emerald (`DESIGN.md`, `app/globals.css`). Start with Now, Accounts, Inbox, Quick add, Budget, Salary, Bonuses, Funds, Forecast, Settings. Show the unfolded (inner, about 884 dp wide) layout for Now and Accounts too. Get the user's approval of the mockups before rebuilding any screen. No real names or amounts in mockups.
2. **Port the entire web app to the phone.** Still on the web only: Accounts add, move money, reconcile with the real balance, receive-QR; Budget settle office days, pools, categories, RTO card, compare-without-raises; Salary raise wizard (5 steps) and payslip builder; Bonuses rule add/edit, destination add/edit/remove, mark received; Funds create/edit/reorder; Forecast overrides (single and bulk, reset); setup wizard; CSV export; Settings office days. Order by how often the user needs them (reconcile and add account first). Each slice: scout the web code, port the server action to `mobile/src/lib/*Write.ts` with tests (pattern in `budgetWrite.ts`), build the screen to the approved mockup, publish over the air, check Vercel.
3. **Google Wallet capture is on hold** until tomorrow. Needs a real tap-to-pay notification sample first.
4. **Grab and foodpanda senders** are set: `no-reply@grab.com` and `info@mail.foodpanda.ph` (done, merged, published). The user can manage senders, apps, accounts, categories, keyword rules and auto-confirm per source from Capture rules on both the phone and web Settings. Check the phone editor edits and saves the senders list; the web one does too.
5. **Make capture run while the app is closed.** Today notifications queue natively and are processed when the app opens. Plan: register an `expo-background-task` (already in the installed APK, with `expo-task-manager`) that runs `runCapture` and the Gmail check, at WorkManager's 15 minute minimum; define the task at module top level so it exists in a headless start, guard everything with try/catch, and show "last background run" in Settings. For instant processing a headless JS task started by the listener service is needed: that is native, so it needs a new APK; propose it, do not do it silently.
6. **Gmail re-sign-in prompt.** Weekly sign-in is accepted while the Google project is in Testing mode, as long as the app prompts: when `gmailToken()` fails or Gmail answers 401/403, show a clear banner (Now, Inbox, Settings) with a one-tap "Reconnect Gmail". A system notification needs `expo-notifications` (native, new APK): offer it, do not assume.
7. **Real data should be visible in the app.** Verify with the user what they see. If a screen shows empty or "setup needed", find out why (RLS, missing rows, a query returning nothing, the session user versus the web user). Ask for screenshots. Do not guess.
8. **Web Budget page cleanup** (explained to the user, awaiting their go-ahead): make `app/(v13)/budget/page.tsx` call `buildBudgetScreen` from `lib/budget/screen.ts` so the phone and web share one assembly; also the two `validateLine` functions (`lib/budget/line-input.ts` and `lib/budget/validate.ts`), the hardcoded TIGHT, the pay page's hardcoded "paid 10th/25th" labels, and the stale comment in `shell.tsx`.

## Rules carried over

- Haiku scouts and runners, Sonnet plans and builds, a human gate after each slice. Ask the scout instead of browsing directories. Update state through `node .claude/scripts/state.js`.
- Phone writes go straight to Supabase with RLS; every check the web server action does must run on the phone (shared validators in `lib/`). Raw notification and email text is never stored or sent.
- No new native package without telling the user: it forces a new APK. Everything else ships over the air. After each push check the Vercel status.
- Real device checks matter more than tests here: be honest about what was not seen on a real screen.
