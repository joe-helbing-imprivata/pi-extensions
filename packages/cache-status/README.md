# cache-status

Adds a footer status after each response:

```
cache 99% (session 97%) | last $0.048 | session $1.92 | saved ~$6.10
```

- **cache %**: `cacheRead / (input + cacheRead + cacheWrite)`, for the last call and the session.
- **saved**: `cacheRead x (input price - cached-read price)`, from the model's cost table.
- **NO CACHE** (red): a Claude model made two calls in a row with no cache reads or writes,
  which means no cache points are being sent.

Counts assistant messages in the current session branch only (not subagents or auxiliary calls).

## Test

`node stats.mjs`
