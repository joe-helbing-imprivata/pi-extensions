// Pure bd-workspace detection. No prime-agent imports, so `node detect.mjs` can
// self-check it.
import { execFileSync } from "node:child_process";

/** True when `cwd` (or a parent) has a bd workspace: `bd where` exits 0. */
export function usesBd(cwd, bin = "bd") {
  try {
    execFileSync(bin, ["where"], { cwd, stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false; // non-zero exit (no workspace) or bd not installed
  }
}

// --- self-check: `node detect.mjs` ---
if (import.meta.url === `file://${process.argv[1]}`) {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const assert = (c, m) => { if (!c) throw new Error("FAIL: " + m); };

  const dir = mkdtempSync(join(tmpdir(), "beads-reminder-"));
  try {
    assert(usesBd(dir) === false, "dir without a bd workspace -> false");
    assert(usesBd(dir, "bd-does-not-exist") === false, "bd not installed -> false");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("detect.mjs self-check OK");
}
