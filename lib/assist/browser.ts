import type { Lang } from "../engine/types";

export type DeviceStatus = "available" | "downloadable" | "unavailable";

interface LMSession {
  prompt(input: string, opts?: { signal?: AbortSignal }): Promise<string>;
  destroy?(): void;
}
interface LMStatic {
  availability(opts?: unknown): Promise<string>;
  create(opts?: unknown): Promise<LMSession>;
}

function lm(): LMStatic | null {
  const g = globalThis as unknown as { LanguageModel?: LMStatic };
  return g.LanguageModel ?? null;
}

function options(lang: Lang) {
  return {
    expectedInputs: [{ type: "text", languages: lang === "ml" ? ["ml", "en"] : ["en", "ml"] }],
    expectedOutputs: [{ type: "text", languages: [lang] }],
  };
}

export async function deviceStatus(lang: Lang): Promise<DeviceStatus> {
  const LM = lm();
  if (!LM) return "unavailable";
  try {
    const a = await LM.availability(options(lang));
    if (a === "available") return "available";
    if (a === "downloadable" || a === "downloading") return "downloadable";
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function deviceComplete(system: string, user: string, lang: Lang, timeoutMs = 60000): Promise<string> {
  const LM = lm();
  if (!LM) throw new Error("unavailable");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const session = await LM.create({ ...options(lang), initialPrompts: [{ role: "system", content: system }] });
  try {
    return (await session.prompt(user, { signal: controller.signal })).trim();
  } finally {
    clearTimeout(timer);
    session.destroy?.();
  }
}
