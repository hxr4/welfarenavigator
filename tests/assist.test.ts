import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import datasetJson from "../data/dataset.json";
import { auditDataset, directionHint, numberMentioned } from "../lib/assist/audit";
import { buildPrompt, checkGrounding, gatherEvidence, INTENTS, numbersIn, type Passage } from "../lib/assist/evidence";
import { complete, ModelError } from "../lib/assist/model";
import type { Dataset } from "../lib/engine/types";

const ds = datasetJson as unknown as Dataset;

describe("assistant retrieval", () => {
  it("returns numbered, cited passages for every scheme and intent without duplicates", () => {
    for (const s of ds.schemes) {
      for (const intent of INTENTS) {
        const ps = gatherEvidence(ds, s.id, intent, "en");
        expect(ps.map((p) => p.n)).toEqual(ps.map((_, i) => i + 1));
        expect(new Set(ps.map((p) => p.text)).size).toBe(ps.length);
        expect(ps.length).toBeLessThanOrEqual(8);
      }
    }
  });
  it("conditions come only from the scheme's own quotations", () => {
    const s = ds.schemes.find((x) => x.id === "FISH-11")!;
    const ps = gatherEvidence(ds, "FISH-11", "who", "ml");
    const own = JSON.stringify(s.rule);
    for (const p of ps) expect(own.includes(p.text.slice(0, 40))).toBe(true);
  });
  it("returns nothing for an unknown scheme", () => {
    expect(gatherEvidence(ds, "NOPE", "what", "en")).toEqual([]);
  });
  it("prompt carries no household answers and forbids eligibility claims", () => {
    const s = ds.schemes[0];
    const { system, user } = buildPrompt(s, "who", "ml", gatherEvidence(ds, s.id, "who", "ml"));
    expect(system).toMatch(/Never say whether they qualify/);
    expect(user).not.toMatch(/answers|income band|household/i);
  });
});

describe("grounding guard", () => {
  const passages: Passage[] = [
    { n: 1, label: "c", text: "Annual family income must be below Rs 50,000/-." },
    { n: 2, label: "c", text: "Members for at least 3 years." },
  ];
  it("accepts cited text whose numbers all come from the quotes", () => {
    expect(checkGrounding("Family income should be under ₹50,000 a year [1]. You must be a member for 3 years [2].", passages).ok).toBe(true);
  });
  it("rejects an invented amount", () => {
    const g = checkGrounding("The family gets ₹10,000 [1].", passages);
    expect(g.ok).toBe(false);
    expect(g.reasons.join()).toMatch(/number_not_in_sources:10000/);
  });
  it("rejects missing or out-of-range citations", () => {
    expect(checkGrounding("Income must be below 50,000.", passages).reasons).toContain("no_citation");
    expect(checkGrounding("Income must be below 50,000 [3].", passages).reasons).toContain("bad_citation");
  });
  it("rejects promises", () => {
    expect(checkGrounding("You are eligible for this [1].", passages).reasons).toContain("promises_benefit");
  });
  it("reads Malayalam digits and ignores citation markers", () => {
    expect(numbersIn("൫൦,൦൦൦ രൂപ [1, 2]")).toEqual(["50000"]);
  });
});

describe("model client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("refuses to run without a key", async () => {
    await expect(complete("s", "u", { env: {} as NodeJS.ProcessEnv })).rejects.toBeInstanceOf(ModelError);
  });
  it("sends only system and user text and returns the text blocks", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "system", "temperature"]);
      return new Response(JSON.stringify({ content: [{ type: "text", text: "ok [1]" }] }), { status: 200 });
    });
    const text = await complete("s", "u", { env: { ANTHROPIC_API_KEY: "k" } as unknown as NodeJS.ProcessEnv, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(text).toBe("ok [1]");
  });
});

describe("assist API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("reports unavailable and refuses work without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { GET, POST } = await import("../app/api/assist/route");
    expect(await (await GET()).json()).toMatchObject({ available: false });
    const res = await POST(new Request("http://x/api/assist", { method: "POST", body: JSON.stringify({ schemeId: "FISH-01", intent: "what", lang: "en" }) }));
    expect(res.status).toBe(503);
  });
  it("rejects extra fields such as household answers", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    const { POST } = await import("../app/api/assist/route");
    const res = await POST(
      new Request("http://x/api/assist", { method: "POST", body: JSON.stringify({ schemeId: "FISH-01", intent: "what", lang: "en", answers: { age: "61" } }) }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("does not log in the handler", () => {
    for (const dir of ["app/api/assist", "app/api/screen"]) {
      for (const f of readdirSync(dir)) expect(readFileSync(`${dir}/${f}`, "utf8")).not.toMatch(/console\./);
    }
  });
});

describe("rule audit", () => {
  it("finds thresholds in digits, Indian grouping and words", () => {
    expect(numberMentioned(50000, "50,000/- രൂപയിൽ താഴെ")).toBe(true);
    expect(numberMentioned(60, "completed the age of sixty years")).toBe(true);
    expect(numberMentioned(5, "അഞ്ചു വർഷം")).toBe(true);
    expect(numberMentioned(100000, "1 lakh")).toBe(true);
    expect(numberMentioned(60, "age 16")).toBe(false);
  });
  it("flags an operator that disagrees with the quote's wording", () => {
    expect(directionHint("lte", "income must be below 50,000")).toMatch(/lt/);
    expect(directionHint("lt", "income must be below 50,000")).toBeNull();
    expect(directionHint("gte", "members for at least 3 years")).toBeNull();
  });
  it("the shipped dataset has no audit errors", () => {
    const r = auditDataset(ds);
    expect(r.flags.filter((f) => f.level === "error")).toEqual([]);
    expect(r.leaves).toBeGreaterThan(0);
  });
  it("catches a mistyped threshold", () => {
    const copy = JSON.parse(JSON.stringify(ds)) as Dataset;
    const s = copy.schemes.find((x) => x.id === "FISH-11")!;
    const walk = (n: unknown): void => {
      if (n && typeof n === "object") {
        const o = n as Record<string, unknown>;
        if (o.fact === "annual_family_income") o.value = 55000;
        Object.values(o).forEach(walk);
      }
    };
    walk(s.rule);
    expect(auditDataset(copy).flags.some((f) => f.schemeId === "FISH-11" && f.check === "threshold")).toBe(true);
  });
});
