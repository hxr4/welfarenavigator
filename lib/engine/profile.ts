import { nextQuestion } from "./next-question";
import { isScreenable, screenAll, statusMap } from "./screen";
import type { Answer, Answers, Dataset, Fact, Profile, SchemeResult, SchemeStatus } from "./types";

const TRUE = new Set(["yes", "y", "true", "1", "അതെ", "ഉണ്ട്"]);
const FALSE = new Set(["no", "n", "false", "0", "അല്ല", "ഇല്ല"]);

export function parseAnswer(fact: Fact, raw: string): Answer {
  const v = raw.trim();
  const lower = v.toLowerCase();
  if (lower === "unknown" || lower === "?" || lower === "dont_know") return { kind: "unknown" };
  if (lower === "declined" || lower === "prefer_not") return { kind: "declined" };
  switch (fact.type) {
    case "boolean":
      if (TRUE.has(lower)) return { kind: "value", value: true };
      if (FALSE.has(lower)) return { kind: "value", value: false };
      throw new Error(`"${raw}" is not yes/no for ${fact.id}`);
    case "number": {
      const range = v.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) return { kind: "range", lo: Number(range[1]), hi: Number(range[2]) };
      const n = Number(v.replace(/[,_\s]/g, ""));
      if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a number for ${fact.id}`);
      return { kind: "range", lo: n, hi: n };
    }
    case "multi": {
      const parts = v.split(/[,|]/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (!fact.options.some((o) => o.value === p)) throw new Error(`"${p}" is not an option of ${fact.id}`);
      }
      return { kind: "value", value: parts };
    }
    case "enum":
      if (!fact.options.some((o) => o.value === v)) throw new Error(`"${v}" is not an option of ${fact.id}`);
      return { kind: "value", value: v };
  }
}

export function parseAnswerMap(dataset: Dataset, raw: Record<string, string>): Answers {
  const out: Answers = {};
  for (const [factId, value] of Object.entries(raw)) {
    const fact = dataset.facts.find((f) => f.id === factId);
    if (!fact) throw new Error(`Unknown fact "${factId}"`);
    out[factId] = parseAnswer(fact, value);
  }
  return out;
}

export function parseAnswerString(dataset: Dataset, text: string): Answers {
  const raw: Record<string, string> = {};
  for (const part of text.split(/[;\n]/)) {
    const p = part.trim();
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 0) throw new Error(`"${p}" should look like fact=value`);
    raw[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  }
  return parseAnswerMap(dataset, raw);
}

export function simulateAdaptive(dataset: Dataset, full: Answers) {
  const answers: Answers = {};
  const asked: string[] = [];
  for (let i = 0; i < 200; i++) {
    const q = nextQuestion(dataset, answers);
    if (!q) break;
    if (asked.includes(q.fact.id)) throw new Error(`Fact ${q.fact.id} asked twice`);
    asked.push(q.fact.id);
    answers[q.fact.id] = full[q.fact.id] ?? { kind: "unknown" };
  }
  return { answers, asked };
}

export interface ProfileCheck {
  schemeId: string;
  expected: SchemeStatus;
  actual: SchemeStatus | "missing";
  ok: boolean;
  note?: string;
}

export interface ProfileRun {
  profile: Profile;
  passed: boolean;
  error?: string;
  checks: ProfileCheck[];
  asked: string[];
  adaptiveOk: boolean;
  adaptiveMismatches: string[];
  results: SchemeResult[];
}

export function runProfile(dataset: Dataset, profile: Profile): ProfileRun {
  let full: Answers;
  try {
    full = parseAnswerMap(dataset, profile.answers);
  } catch (e) {
    return {
      profile,
      passed: false,
      error: (e as Error).message,
      checks: [],
      asked: [],
      adaptiveOk: false,
      adaptiveMismatches: [],
      results: [],
    };
  }
  const results = screenAll(dataset, full);
  const actual = statusMap(results);
  const checks: ProfileCheck[] = [];
  for (const [schemeId, expected] of Object.entries(profile.expected)) {
    const a = actual[schemeId] ?? "missing";
    checks.push({ schemeId, expected, actual: a, ok: a === expected });
  }
  if (profile.expectedOthers) {
    for (const s of dataset.schemes) {
      if (!isScreenable(s) || s.id in profile.expected) continue;
      const a = actual[s.id];
      checks.push({ schemeId: s.id, expected: profile.expectedOthers, actual: a, ok: a === profile.expectedOthers, note: "others" });
    }
  }
  for (const [schemeId, facts] of Object.entries(profile.expectedMissing)) {
    const r = results.find((x) => x.scheme.id === schemeId);
    const missing = r?.missingFacts ?? [];
    const lacking = facts.filter((f) => !missing.includes(f));
    checks.push({
      schemeId,
      expected: "needs_information",
      actual: r?.status ?? "missing",
      ok: r?.status === "needs_information" && lacking.length === 0,
      note: `missing: ${facts.join(", ")}${lacking.length ? ` (not reported: ${lacking.join(", ")})` : ""}`,
    });
  }
  let asked: string[] = [];
  let adaptiveMismatches: string[] = [];
  let error: string | undefined;
  try {
    const sim = simulateAdaptive(dataset, full);
    asked = sim.asked;
    const adaptive = statusMap(screenAll(dataset, sim.answers));
    adaptiveMismatches = Object.keys(actual).filter((k) => actual[k] !== adaptive[k]);
  } catch (e) {
    error = (e as Error).message;
    adaptiveMismatches = ["simulation failed"];
  }
  const adaptiveOk = adaptiveMismatches.length === 0;
  return {
    profile,
    passed: checks.every((c) => c.ok) && adaptiveOk && !error,
    error,
    checks,
    asked,
    adaptiveOk,
    adaptiveMismatches,
    results,
  };
}
