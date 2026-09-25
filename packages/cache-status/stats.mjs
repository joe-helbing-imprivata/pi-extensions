// Pure cache-usage stats over assistant messages. No prime-agent imports, so
// `node stats.mjs` can self-check it.

const hitRate = (u) => {
  const total = u.input + u.cacheRead + u.cacheWrite;
  return total > 0 ? u.cacheRead / total : 0;
};

/**
 * @param {Array<{provider:string, model:string, usage:any}>} msgs  assistant messages, oldest first
 * @param {(provider:string, model:string) => {input:number, cacheRead:number} | undefined} priceOf  $/M tokens
 */
export function summarize(msgs, priceOf) {
  const used = msgs.filter((m) => m?.usage);
  if (!used.length) return undefined;
  const last = used[used.length - 1];
  const sum = { input: 0, cacheRead: 0, cacheWrite: 0 };
  let cost = 0;
  let saved = 0;
  for (const m of used) {
    sum.input += m.usage.input;
    sum.cacheRead += m.usage.cacheRead;
    sum.cacheWrite += m.usage.cacheWrite;
    cost += m.usage.cost?.total ?? 0;
    const p = priceOf(m.provider, m.model);
    if (p) saved += (m.usage.cacheRead * (p.input - p.cacheRead)) / 1e6;
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
    lastCost: last.usage.cost?.total ?? 0,
    cost,
    saved,
    noCache,
  };
}

// --- self-check: `node stats.mjs` ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (c, m) => { if (!c) throw new Error("FAIL: " + m); };
  const u = (input, cacheRead, cacheWrite, total) => ({ input, cacheRead, cacheWrite, output: 1, cost: { total } });
  const price = () => ({ input: 3, cacheRead: 0.3 });
  const m = (model, usage) => ({ provider: "p", model, usage });

  assert(summarize([], price) === undefined, "empty -> undefined");

  const s = summarize([m("claude-x", u(2, 0, 1000, 0.5)), m("claude-x", u(2, 1000, 0, 0.05))], price);
  assert(Math.abs(s.lastHit - 1000 / 1002) < 1e-9, "last hit rate");
  assert(Math.abs(s.sessionHit - 1000 / 2004) < 1e-9, "session hit rate");
  assert(Math.abs(s.cost - 0.55) < 1e-9 && s.lastCost === 0.05, "costs");
  assert(Math.abs(s.saved - (1000 * 2.7) / 1e6) < 1e-12, "savings");
  assert(s.noCache === false, "write then read is healthy");

  const bad = summarize([m("claude-opus-5", u(20000, 0, 0, 0.1)), m("claude-opus-5", u(20100, 0, 0, 0.1))], price);
  assert(bad.noCache === true, "two uncached Claude calls -> warn");
  const nova = summarize([m("amazon.nova", u(100, 0, 0, 0)), m("amazon.nova", u(100, 0, 0, 0))], price);
  assert(nova.noCache === false, "non-Claude never warns");

  console.log("stats.mjs self-check OK");
}
