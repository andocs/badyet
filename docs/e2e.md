# Browser checks (Playwright)

`npx playwright test` starts the app on port 3100 and runs every test on phone and desktop, light and dark. Screenshots land in `e2e/results/`.

- **Signed out** tests (login page fits, protected pages redirect to login) always run.
- **Signed in** tests are read-only and run only if `e2e/.auth/state.json` exists. Sign-in is by emailed magic link, so save a session once:
  1. `npx playwright codegen --save-storage=e2e/.auth/state.json http://localhost:3100/login`
  2. Sign in with the magic link in that window, then close it.
  The file is git-ignored. Delete it when you are done.

They use whichever Supabase project `.env.local` points to, so they never create or change data.
