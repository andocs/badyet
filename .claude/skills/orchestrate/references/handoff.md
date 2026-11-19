# Gate message and user to-do block

Gate message (max 15 lines): what was done; files changed (count); test result `PASS`; what to check; the user to-do block below; token use for this scope (from the ledger row); next step; "Safe to /clear now; type /orchestrate to continue."

Required after every slice and revision. Use real commands from the Run & verify guide; write `none` where it does not apply. The same text goes to `state.js handoff`.

```
AFTER SLICE N: what you do now
1. Get the code:   git fetch && git checkout slice/<n>-<slug>   (merge to main after you approve)
2. Install deps:   <command, or "no new deps">
3. Database:       <migration command, seed command, or "no DB changes">
                   Back up first if data matters. Rollback: <command or step>
4. Config:         <new env vars with example values, or "none">
5. Start the app:  <command>  ->  open <URL>
6. Check these:    <3-5 click-path checks matching the acceptance criteria>
7. Known limits:   <not done yet / flaky, or "none">
Reply: Approve / Request changes / Pause
```

Never write generic advice like "run the migrations". If a migration is destructive, say so in bold and require the user to confirm a backup.
