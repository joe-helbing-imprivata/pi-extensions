import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { usesBd } from "./detect.mjs";

// In a repo that uses bd, append the beads-workflow rituals to the system prompt
// on every turn. The system prompt is rebuilt each turn, so the reminder
// survives compaction without a separate hook.

const REMINDER = `## bd (beads) in this repo

This repo tracks work in bd. Follow /skill:beads-workflow:
- Start ritual, before starting work: \`bd ready\`, \`bd list --status in_progress\`,
  \`bd stale\`, \`bd orphans\`. Resume or \`bd unclaim\` dead claims; close finished work.
- Capture gate, before your final message on a task: close what finished, update
  what is still in progress, file what remains or was discovered.
- bd is local-only on this machine: never push, pull, or add a remote.`;

export default function (pi: ExtensionAPI) {
  // Detected once, at load, from the directory the session started in.
  if (!usesBd(process.cwd())) return;
  pi.on("before_agent_start", (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n${REMINDER}`,
  }));
}
