---
description: Concise status snapshot from PROJECT_STATE.md (phase, slice, open questions, next action, tokens)
model: haiku
allowed-tools: Bash(node .claude/scripts/state.js:*)
---

Run `node .claude/scripts/state.js status` and reply with its output exactly as printed, in a code block, with no extra commentary. If it says PROJECT_STATE.md is missing, reply only: `No PROJECT_STATE.md here yet. Run /orchestrate to start a project.`
