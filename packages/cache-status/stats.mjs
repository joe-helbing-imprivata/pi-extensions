// Pure cache-usage stats over assistant messages. No prime-agent imports, so
// `node stats.mjs` can self-check it.

const inTokens = (u) => u.input + u.cacheRead + u.cacheWrite;
const hitRate = (u) => (inTokens(u) > 0 ? u.cacheRead / inTokens(u) : 0);

/** @param {Array<{model:string, usage:any}>} msgs  assistant messages, oldest first */
export function summarize(msgs) {
  const used = msgs.filter((m) => m?.usage);
  if (!used.length) return undefined;
  const last = used[used.length - 1];
  const sum = { input: 0, cacheRead: 0, cacheWrite: 0 };
  let cost = 0;
  for (const m of used) {
    sum.input += m.usage.input;
    sum.cacheRead += m.usage.cacheRead;
    sum.cacheWrite += m.usage.cacheWrite;
    cost += m.usage.cost?.total ?? 0;
  }
  // Two Claude calls in a row with no cache activity at all = no cache points
  // are being sent (prime-agent issue #2548). Cache writes still count as working.
  const tail = used.slice(-2);
  const noCache =
    tail.length === 2 &&
    tail.every((m) => /claude/i.test(m.model) && m.usage.cacheRead === 0 && m.usage.cacheWrite === 0);
  return {
    lastHit: hitRate(last.usage),
    sessionHit: hitRate(sum),
    lastIn: inTokens(last.usage),
    lastOut: last.usage.output ?? 0,
    lastCost: last.usage.cost?.total ?? 0,
    cost,
    noCache,
  };
}

/** 950 -> "950", 1234 -> "1.2k", 101339 -> "101k" */
export const tokens = (n) => (n < 1000 ? `${n}` : n < 10000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`);

// --- self-check: `node stats.mjs` ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (c, m) => { if (!c) throw new Error("FAIL: " + m); };
  const u = (input, cacheRead, cacheWrite, total, output = 1) => ({ input, cacheRead, cacheWrite, output, cost: { total } });
  const m = (model, usage) => ({ model, usage });

  assert(summarize([]) === undefined, "empty -> undefined");

  const s = summarize([m("claude-x", u(2, 0, 1000, 0.5)), m("claude-x", u(2, 1000, 0, 0.05, 300))]);
  assert(Math.abs(s.lastHit - 1000 / 1002) < 1e-9, "last hit rate");
  assert(Math.abs(s.sessionHit - 1000 / 2004) < 1e-9, "session hit rate");
  assert(Math.abs(s.cost - 0.55) < 1e-9 && s.lastCost === 0.05, "costs");
  assert(s.lastIn === 1002 && s.lastOut === 300, "last token counts");
  assert(s.noCache === false, "write then read is healthy");

  const bad = summarize([m("claude-opus-5", u(20000, 0, 0, 0.1)), m("claude-opus-5", u(20100, 0, 0, 0.1))]);
  assert(bad.noCache === true, "two uncached Claude calls -> warn");
  const nova = summarize([m("amazon.nova", u(100, 0, 0, 0)), m("amazon.nova", u(100, 0, 0, 0))]);
  assert(nova.noCache === false, "non-Claude never warns");

  assert(tokens(950) === "950" && tokens(1234) === "1.2k" && tokens(101339) === "101k", "token format");

  console.log("stats.mjs self-check OK");
}
