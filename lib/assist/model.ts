export type Provider = "ollama" | "openai" | "anthropic" | "none";

type Env = Record<string, string | undefined>;

const OLLAMA_BASE = "http://localhost:11434/v1";
const OLLAMA_MODEL = "gemma3:4b";
const ANTHROPIC_MODEL = "claude-opus-5-5";

export function assistProvider(env: Env = process.env): Provider {
  if (env.WN_ASSIST === "off") return "none";
  const p = env.WN_ASSIST_PROVIDER;
  if (p === "ollama") return "ollama";
  if (p === "openai") return env.WN_ASSIST_BASE_URL && env.WN_ASSIST_MODEL ? "openai" : "none";
  if (p === "anthropic") return env.ANTHROPIC_API_KEY ? "anthropic" : "none";
  if (p) return "none";
  if (env.WN_ASSIST_BASE_URL && env.WN_ASSIST_MODEL) return "openai";
  if (env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

export function assistConfigured(env: Env = process.env): boolean {
  return assistProvider(env) !== "none";
}

export function assistModel(env: Env = process.env): string {
  switch (assistProvider(env)) {
    case "ollama":
      return env.WN_ASSIST_MODEL || OLLAMA_MODEL;
    case "openai":
      return env.WN_ASSIST_MODEL as string;
    case "anthropic":
      return env.WN_ASSIST_MODEL || ANTHROPIC_MODEL;
    default:
      return "";
  }
}

function baseUrl(env: Env): string {
  const b = assistProvider(env) === "ollama" ? env.WN_ASSIST_BASE_URL || OLLAMA_BASE : env.WN_ASSIST_BASE_URL || "";
  return b.replace(/\/+$/, "");
}

export class ModelError extends Error {}

interface Opts {
  maxTokens?: number;
  timeoutMs?: number;
  env?: Env;
  fetchImpl?: typeof fetch;
}

export async function reachable(opts: Opts = {}): Promise<boolean> {
  const env = opts.env ?? process.env;
  const provider = assistProvider(env);
  if (provider !== "ollama") return provider !== "none";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 1500);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${baseUrl(env)}/models`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function complete(system: string, user: string, opts: Opts = {}): Promise<string> {
  const env = opts.env ?? process.env;
  const provider = assistProvider(env);
  if (provider === "none") throw new ModelError("not_configured");
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? (provider === "ollama" ? 60000 : 15000));
  const maxTokens = opts.maxTokens ?? 400;
  try {
    if (provider === "anthropic") {
      const res = await doFetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY as string, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: assistModel(env), max_tokens: maxTokens, temperature: 0, system, messages: [{ role: "user", content: user }] }),
      });
      if (!res.ok) throw new ModelError(`http_${res.status}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    }
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.WN_ASSIST_API_KEY) headers.authorization = `Bearer ${env.WN_ASSIST_API_KEY}`;
    const gemini = baseUrl(env).includes("generativelanguage.googleapis.com");
    const res = await doFetch(`${baseUrl(env)}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: assistModel(env),
        temperature: 0,
        max_tokens: gemini ? maxTokens + 1500 : maxTokens,
        ...(gemini ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new ModelError(`http_${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    if (e instanceof ModelError) throw e;
    throw new ModelError(controller.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}
