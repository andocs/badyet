# Phase 3: Revisions (after the build, or for an app that is already built)

1. **Gap & enhancement analysis.** Ask the Scout for a compact map of the app (routes/screens, data model, test gaps, and for performance issues the hot path with file:line). Then review as Sonnet: UX gaps, edge-case bugs, performance (N+1 queries, large payloads, missing indexes, re-renders), security, accessibility, high-value enhancements. Present a short ranked list: item, effort S/M/L, impact, Needed / Nice-to-have. Let the user pick with a multi-select `AskUserQuestion`. Recommend dropping or deferring Nice-to-haves and anything adding running cost or dependencies.
2. **Revision slicing.** Group approved items into small `rev-1`, `rev-2`, ... slices with acceptance criteria. Group tiny items together to save gates. `state.js put "Slice plan"`. Gate the list.
3. **Execute each** exactly like Phase 2 (`references/phase2-build.md`), but label `rev-N`, branch via `ship.js rev N <slug> "..."`, ledger label `rev-N`. Gate 3 after each.
4. **Finish.** When all are approved: `state.js set phase="Done" gate="none"`, final short summary (what exists, how to run it, token totals) and stop.
