export const DEFAULT_MODEL = "claude-opus-5-5";

export function assistConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ANTHROPIC_API_KEY) && env.WN_ASSIST !== "off";
}

export function assistModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.WN_ASSIST_MODEL || DEFAULT_MODEL;
}

export class ModelError extends Error {}

export async function complete(
  system: string,
  user: string,
  opts: { maxTokens?: number; timeoutMs?: number; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const env = opts.env ?? process.env;
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new ModelError("not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: assistModel(env),
        max_tokens: opts.maxTokens ?? 400,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new ModelError(`http_${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
  } catch (e) {
    if (e instanceof ModelError) throw e;
    throw new ModelError(controller.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
}
