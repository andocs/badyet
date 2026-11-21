# Bad(yet) for Android

The phone app for Bad(yet): Expo (SDK 58) and React Native, talking straight to the same Supabase project as the web app. One user, no server of its own. Row-level security keeps every query to your own rows.

## What it does

- **Now, Inbox, Quick add, Accounts, Plan** (Salary and tax, Budget, Bonuses, Funds, Forecast, Settings), matching the web app's screens.
- **Capture:** reads GCash, Maya, GoTyme, MariBank and BPI notifications on the phone, and BPI, Grab and foodpanda emails through the Gmail API, and turns them into pending Inbox items. Only the amount, merchant, direction and reference are kept. Notification and email text is never stored or sent.
- **Works offline:** Quick add and captures wait in a local queue and send when there is signal. Sending is safe to repeat.

## How the code is arranged

- `src/app/`: screens (Expo Router). `(tabs)/` holds the five tabs; `plan/` the Plan screens; `settings.tsx`, `capture.tsx`.
- `src/lib/`: the phone's data code: queries, writes (ported from the web's server actions), the capture runner, Gmail client.
- `src/components/`: shared building blocks.
- `modules/notification-listener/`: a small native Android module: the notification listener service, its queue and allowlist.
- **Shared with the web app:** the phone imports the web app's pure TypeScript from `../lib` (the alias `@/lib/*`): the budget engine, Now, Inbox rules, money, and `lib/capture/*` (parsers, rules, pairing, validation). The web app must not import from `mobile/`.

## Run and check

```
npm install
npx expo start --dev-client    # needs the installed app (a development or preview build)
npm run typecheck && npm run lint && npm test
npx expo-doctor
```

Environment (copy `.env.example` to `.env`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. They are public identifiers, never a secret. The same three are stored as EAS environment variables for the `preview` environment. Never put the Supabase service role key in the app.

## Builds and updates

- **APK:** `npx eas-cli@latest build -p android --profile preview` (account `docoats`). Sideload it. Needed only when something native changes: a new native package, permissions, the app icon, name or splash.
- **Over the air:** `npx eas-cli@latest update --channel preview --message "..." --environment preview`. JavaScript, screens, logic and styles all ship this way. The installed app checks on launch and uses the update on the next start (Settings has a "Check for updates" button).
- The runtime version is `1.0.0` (policy `appVersion`), so an update reaches any APK built with the same version. If a change needs new native code, bump `version` in `app.json` so older APKs do not receive an update they cannot run.

## Google sign-in for Gmail

Gmail needs the Google sign-in module, so it needs an APK built after it was added. In Google Cloud (one project): enable the Gmail API, put the OAuth consent screen in Testing with your address as a test user, create an Android OAuth client (package `com.docoats.badyet` and the SHA-1 of the EAS signing key) and a Web client; the Web client id goes in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. While the project is in Testing, Google asks you to sign in again about every 7 days.

## The web app must keep building

The web app's TypeScript and lint configs exclude `mobile/`. After any push that touches `mobile/` or the shared `lib/`, check that the Vercel preview for the web app still passes.
