import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { summarize, tokens } from "./stats.mjs";

// Status line below the editor with prompt-cache use: hit rate, last-call tokens, last/session cost.
// Turns red when a Claude model makes two calls in a row with no cache activity.

const KEY = "cache";
const usd = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function (pi: ExtensionAPI) {
  const update = (ctx: ExtensionContext, latest?: any) => {
    const msgs: any[] = [];
    for (const e of ctx.sessionManager.getBranch() as any[]) {
      if (e.type === "message" && e.message.role === "assistant") msgs.push(e.message);
    }
    // message_end can fire before the entry is saved to the branch.
    if (latest?.role === "assistant" && msgs[msgs.length - 1]?.timestamp !== latest.timestamp) msgs.push(latest);

    const s = summarize(msgs);
    if (!s) return ctx.ui.setWidget(KEY, undefined);

    const t = ctx.ui.theme;
    const text =
      `cache ${pct(s.lastHit)} (session ${pct(s.sessionHit)}) | ${tokens(s.lastIn)} in / ${tokens(s.lastOut)} out` +
      ` | last ${usd(s.lastCost)} | session ${usd(s.cost)}`;
    const line = s.noCache ? t.fg("error", `NO CACHE | ${text}`) : t.fg("dim", text);
    // Widget, not setStatus: Prime Agent's footer renders no extension statuses,
    // and setFooter is a no-op in daemon mode. String-array widgets are forwarded.
    ctx.ui.setWidget(KEY, [line], { placement: "belowEditor" });
  };

  pi.on("session_start", (_e, ctx) => update(ctx));
  pi.on("session_tree", (_e, ctx) => update(ctx));
  pi.on("message_end", (e, ctx) => update(ctx, e.message));
}
