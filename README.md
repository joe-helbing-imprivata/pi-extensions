# pi-extensions

Extensions for [Prime Agent](https://github.com/PrimeIntellect-ai/prime-agent) (pi-compatible).

| Package | What it does |
|---|---|
| [bedrock-sso](packages/bedrock-sso/) | `bedrock-sso` provider: Claude on Amazon Bedrock with prompt caching that works for Claude 5, and automatic `aws sso login` when the SSO session expires. |
| [cache-status](packages/cache-status/) | Status line below the editor with prompt-cache hit rate, token counts, and cost. Turns red when a Claude model stops caching. |

## Install

```bash
prime-agent package install git:github.com/<owner>/pi-extensions
# or, from a local clone:
prime-agent package install /path/to/pi-extensions
```

## Test

```bash
npm test
```
