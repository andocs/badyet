# Deploy and update runbook

The app runs on Vercel with Supabase for the database and sign-in. It is already deployed; this is how to keep it working.

## Environment variables (Vercel > Project > Settings > Environment Variables)

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all environments | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all environments | public anon key; row-level security protects the data |
| `ALLOWED_EMAIL` | all environments | the one email allowed to sign in; server-only |
| `NEXT_PUBLIC_SITE_URL` | Production | your live URL, e.g. `https://your-app.vercel.app`; used as the sign-in return address |

Never set `SUPABASE_SERVICE_ROLE_KEY` on Vercel. It is for local seeding only.
After changing a variable, redeploy (variables apply to new builds only).

## Supabase settings (Authentication > URL Configuration)

- Site URL: your live URL.
- Redirect URLs: `https://<your-live-url>/auth/callback` and `http://localhost:3000/auth/callback`.

If Google sign-in returns to the wrong site or fails, check these first.

## Releasing a change

1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all pass locally.
2. Apply any new file in `supabase/migrations/` to the Supabase database **before** merging (SQL editor, or `supabase db push`). Each migration ends with a rollback comment.
3. Merge to `main`; Vercel builds and deploys it.
4. Open the live site, sign in, and click through Dashboard, Budget, Transfer and Installments.

## Pending migrations to check

Confirm these exist in the live database (Table editor): `user_settings`, `installment_payments`.

## If something breaks

- Roll back the app: Vercel > Deployments > pick the last good one > Promote to Production.
- Roll back a migration: run the rollback comment at the bottom of that migration file.
- Sign-in loops back to /login: `ALLOWED_EMAIL` must match your email exactly.

## Google sign-in (replaces the emailed magic link)

Set this up **before** merging the change that removes the magic link, or you will be locked out. Test it on a Vercel preview or `http://localhost:3000` first.

1. Google Cloud Console > APIs and Services > OAuth consent screen: create it (External is fine for one person; add your own email as a test user, or publish it).
2. Credentials > Create credentials > OAuth client ID > Web application.
   - Authorized redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback` (Supabase shows the exact URL on its Google provider page).
3. Supabase > Authentication > Providers > Google: turn it on and paste the Client ID and Client secret.
4. Supabase > Authentication > URL Configuration: keep the Site URL and the `/auth/callback` redirect URLs listed above (the app's own callback).
5. Sign in once with the Google account whose address equals `ALLOWED_EMAIL`. Supabase links it to your existing user because the email matches.
6. Optional: in Supabase > Authentication > Sign In / Providers, turn off new sign-ups and disable the Email provider. The app already turns away every Google account except `ALLOWED_EMAIL`, so this is extra.

The Client secret lives only in the Supabase dashboard. Never put it in `.env.local` or in the repo.
