# cache-status

Adds a status line below the editor after each response:

```
cache 99% (session 97%) | 101k in / 1.2k out | last $0.048 | session $1.92
```

- **cache %**: `cacheRead / (input + cacheRead + cacheWrite)`, for the last call and the session.
- **in / out**: tokens for the last call. `in` counts uncached, cache-read, and cache-write tokens.
- **NO CACHE** (red): a Claude model made two calls in a row with no cache reads or writes,
  which means no cache points are being sent.

Uses `setWidget` (below the editor), not `setStatus`: Prime Agent's footer renders no
extension statuses, and `setFooter` is a no-op in daemon mode. The line shows below the
bottom bar only with `"terminal": { "fullscreen": false }`; in fullscreen mode Prime Agent
puts below-editor widgets above the input box.

Counts assistant messages in the current session branch only (not subagents or auxiliary calls).

## Test

`node stats.mjs`
