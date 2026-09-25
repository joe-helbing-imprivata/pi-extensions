# beads-reminder

In a repo that uses [bd (beads)](https://github.com/gastownhall/beads), appends a short
reminder to the system prompt on every turn:

- the **start ritual** (`bd ready`, `bd list --status in_progress`, `bd stale`, `bd orphans`),
- the **capture gate** before the final message on a task (close, update, file),
- that bd is **local-only** on this machine (never push, pull, or add a remote).

It points at the `beads-workflow` skill for the details. A skill alone loads only when the
model decides it is relevant and is lost on compaction; the system prompt is rebuilt every
turn, so this keeps both gates in view.

It injects its own text, not `bd prime`, whose default template conflicts with
`beads-workflow` (an issue before any code, fanning out subagents, `bd remember`).

Detection runs `bd where` once, at load, in the session's starting directory. In a repo
without bd it registers nothing. A session that later changes into a bd repo is not detected.

## Test

`node detect.mjs`
