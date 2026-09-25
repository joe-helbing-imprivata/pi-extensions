import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  type Api,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type Model,
  type SimpleStreamOptions,
  streamSimple,
} from "@earendil-works/pi-ai";
import { getModels } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { injectCachePoints } from "./inject.mjs";

// bedrock-sso: Claude on Amazon Bedrock, handing off to prime-agent's built-in
// bedrock-converse-stream code, plus two fixes:
//  1. Prompt caching for every Claude model. The bundled cache check skips
//     Claude 5 (prime-agent issue #2548), so cachePoint blocks are added here.
//  2. When the SSO session has fully expired, run `aws sso login` and retry once.
// Credentials come from the normal AWS SDK chain (AWS_PROFILE), which already
// refreshes SSO access tokens silently while the session is valid.

const PROVIDER = "bedrock-sso";
const API = "bedrock-sso-converse";
const LOGIN_TIMEOUT_MS = 180_000;
const SSO_ERROR = /aws sso login|sso.{0,40}(expired|invalid|refresh)|token.{0,20}expired|ExpiredToken/i;

// ponytail: reads prime-agent's cached remote catalog (no extension API exposes it).
// Falls back to the small built-in stub; switch to an API if one appears.
function claudeModels(): Model<Api>[] {
  let models: Model<Api>[] = [];
  try {
    const file = join(homedir(), ".prime/agent/models/provider-model-catalog.v1.json");
    models = JSON.parse(readFileSync(file, "utf8")).payload.models;
  } catch {}
  if (!models?.length) models = getModels("amazon-bedrock") as Model<Api>[];
  return models.filter((m) => m.provider === "amazon-bedrock" && m.id.includes("anthropic.claude"));
}

export default function (pi: ExtensionAPI) {
  let ui: any;
  let loggingIn: Promise<unknown> | null = null;
  pi.on("session_start", (_event, ctx) => {
    ui = ctx.ui;
  });

  const ssoLogin = () =>
    (loggingIn ??= (async () => {
      ui?.notify?.("AWS SSO session expired -- running 'aws sso login'. Approve it in your browser.", "warning");
      await pi.exec("aws", ["sso", "login"], { timeout: LOGIN_TIMEOUT_MS });
    })().finally(() => (loggingIn = null)));

  function stream(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream {
    const out = createAssistantMessageEventStream();
    const run = () =>
      streamSimple({ ...model, api: "bedrock-converse-stream" } as Model<Api>, context, {
        ...options,
        onPayload: async (payload, m) => {
          injectCachePoints(payload);
          return (await options?.onPayload?.(payload, m)) ?? payload;
        },
      });

    (async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        let forwarded = false;
        let retry = false;
        for await (const event of run()) {
          // Auth failures surface as an error before any output: log in, retry once.
          const msg = event.type === "error" ? (event.error.errorMessage ?? "") : "";
          if (attempt === 0 && !forwarded && SSO_ERROR.test(msg)) {
            retry = true;
            break;
          }
          forwarded = true;
          out.push(event);
        }
        if (!retry) break;
        await ssoLogin().catch(() => {}); // on failure the retry reports the original error
      }
      out.end();
    })();
    return out;
  }

  pi.registerProvider(PROVIDER, {
    name: "Amazon Bedrock (SSO)",
    baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
    apiKey: "aws-sdk-credential-chain", // unused: Bedrock signs with SigV4 from AWS_PROFILE
    api: API,
    models: claudeModels().map(({ provider: _p, api: _a, ...m }) => m as any),
    streamSimple: stream,
  });
}
