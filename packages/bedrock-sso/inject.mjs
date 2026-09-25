// Pure prompt-cache injection for AWS Bedrock ConverseStream payloads.
// The running prime-agent binary's built-in gate only emits cachePoint blocks
// for Claude 4.x / 3.7 / 3.5 ids, so Claude 5 (opus-5, sonnet-5, ...) is billed
// full price every turn. This adds the missing cache points, and no-ops when the
// built-in already added them (so Claude 4.x is untouched, never doubled).

/** Does the payload already carry any cachePoint block? */
export function hasCachePoint(payload) {
  const inSystem =
    Array.isArray(payload?.system) && payload.system.some((b) => b && b.cachePoint);
  const inMessages =
    Array.isArray(payload?.messages) &&
    payload.messages.some(
      (m) => Array.isArray(m?.content) && m.content.some((c) => c && c.cachePoint),
    );
  return Boolean(inSystem || inMessages);
}

/**
 * Mutate a Bedrock ConverseStream payload in place, adding default (short) cache
 * points on the system prompt and the last user message when none are present.
 * Mirrors the built-in placement: system prefix + conversation prefix.
 * @param {any} payload  ConverseStream command input ({ system, messages, ... }).
 * @returns {boolean} true if cache points were added.
 */
export function injectCachePoints(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (hasCachePoint(payload)) return false;

  let added = false;
  if (Array.isArray(payload.system) && payload.system.length > 0) {
    payload.system.push({ cachePoint: { type: "default" } });
    added = true;
  }
  if (Array.isArray(payload.messages) && payload.messages.length > 0) {
    const last = payload.messages[payload.messages.length - 1];
    if (last && last.role === "user" && Array.isArray(last.content)) {
      last.content.push({ cachePoint: { type: "default" } });
      added = true;
    }
  }
  return added;
}

// --- self-check: `node inject.mjs` ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const assert = (c, m) => { if (!c) { throw new Error("FAIL: " + m); } };

  // Claude 5 style: no cache -> both points added.
  const p5 = { system: [{ text: "sys" }], messages: [{ role: "user", content: [{ text: "hi" }] }] };
  assert(injectCachePoints(p5) === true, "5.x should add points");
  assert(p5.system.length === 2 && p5.system[1].cachePoint.type === "default", "5.x system cachePoint");
  assert(p5.messages[0].content.length === 2 && p5.messages[0].content[1].cachePoint, "5.x user cachePoint");

  // Claude 4.x style: built-in already cached -> untouched (no doubling).
  const p4 = {
    system: [{ text: "sys" }, { cachePoint: { type: "default" } }],
    messages: [{ role: "user", content: [{ text: "hi" }, { cachePoint: { type: "default" } }] }],
  };
  assert(injectCachePoints(p4) === false, "4.x should be left alone");
  assert(p4.system.length === 2, "4.x system unchanged");

  // Last message is assistant -> only system cache point, not conversation.
  const pa = { system: [{ text: "s" }], messages: [{ role: "assistant", content: [{ text: "ok" }] }] };
  assert(injectCachePoints(pa) === true, "assistant-last still caches system");
  assert(pa.messages[0].content.length === 1, "no cachePoint on assistant message");

  console.log("inject.mjs self-check OK");
}
