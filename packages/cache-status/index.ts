import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { summarize } from "./stats.mjs";

// Footer status with prompt-cache use: hit rate, last/session cost, estimated savings.
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

    const s = summarize(msgs, (provider, id) => ctx.modelRegistry.find(provider, id)?.cost);
    if (!s) return ctx.ui.setStatus(KEY, undefined);

    const t = ctx.ui.theme;
    const text =
      `cache ${pct(s.lastHit)} (session ${pct(s.sessionHit)}) | last ${usd(s.lastCost)}` +
      ` | session ${usd(s.cost)} | saved ~${usd(s.saved)}`;
    ctx.ui.setStatus(KEY, s.noCache ? t.fg("error", `NO CACHE | ${text}`) : t.fg("dim", text));
  };

  pi.on("session_start", (_e, ctx) => update(ctx));
  pi.on("session_tree", (_e, ctx) => update(ctx));
  pi.on("message_end", (e, ctx) => update(ctx, e.message));
}
