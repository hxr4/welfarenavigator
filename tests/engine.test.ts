import { describe, expect, it } from "vitest";
import { bandsFor, cutPoints } from "../lib/engine/bands";
import { evalCondition, evalNode, INF } from "../lib/engine/evaluate";
import { nextQuestion, pruneAnswers } from "../lib/engine/next-question";
import { parseAnswerString, runProfile, simulateAdaptive } from "../lib/engine/profile";
import { screenAll, screenScheme, statusMap } from "../lib/engine/screen";
import type { Answer, Answers } from "../lib/engine/types";
import { validateDataset } from "../lib/data/validate";
import { fixture } from "./fixture";

const ds = fixture();
const v = (value: boolean | string | string[]): Answer => ({ kind: "value", value });
const n = (x: number): Answer => ({ kind: "range", lo: x, hi: x });
const scheme = (id: string) => ds.schemes.find((s) => s.id === id)!;

describe("three-valued logic", () => {
  it("all: F beats U, U beats T", () => {
    expect(evalNode({ all: [{ ...scheme("FX-01").rule }] }, {})).toBe("U");
    const r = scheme("FX-01").rule;
    expect(evalNode(r, { livelihood: v(["plantation"]) })).toBe("F");
    expect(evalNode(r, { livelihood: v(["fishing"]), fwf_member: v(true) })).toBe("U");
    expect(evalNode(r, { livelihood: v(["fishing"]), fwf_member: v(true), annual_income: n(1) })).toBe("T");
  });
  it("any: T beats U", () => {
    const r = scheme("FX-04").rule;
    expect(evalNode(r, { livelihood: v(["plantation"]), disability: v(true) })).toBe("T");
    expect(evalNode(r, { livelihood: v(["plantation"]), disability: v(false) })).toBe("U");
    expect(evalNode(r, { livelihood: v(["plantation"]), disability: v(false), age: n(40) })).toBe("F");
  });
  it("not swaps T and F and keeps U", () => {
    const leafNode = { id: "x", fact: "fwf_member", op: "eq" as const, value: true, changeable: false };
    expect(evalNode({ not: leafNode }, { fwf_member: v(true) })).toBe("F");
    expect(evalNode({ not: leafNode }, { fwf_member: v(false) })).toBe("T");
    expect(evalNode({ not: leafNode }, {})).toBe("U");
  });
  it("unknown and declined never decide", () => {
    const c = { fact: "annual_income", op: "lte" as const, value: 200000 };
    expect(evalCondition(c, { kind: "unknown" })).toBe("U");
    expect(evalCondition(c, { kind: "declined" })).toBe("U");
    expect(evalCondition(c, undefined)).toBe("U");
  });
});

describe("numeric boundaries", () => {
  const ops = [
    ["lte", 200000, [true, true, false]],
    ["lt", 200000, [true, false, false]],
    ["gte", 60, [false, true, true]],
    ["gt", 60, [false, false, true]],
    ["eq", 60, [false, true, false]],
  ] as const;
  for (const [op, t, expected] of ops) {
    it(`${op} ${t} at t-1, t, t+1`, () => {
      const got = [t - 1, t, t + 1].map((x) => evalCondition({ fact: "f", op, value: t }, n(x)) === "T");
      expect(got).toEqual(expected);
    });
  }
  it("ranges decide only when fully inside or outside", () => {
    const c = { fact: "f", op: "lte" as const, value: 200000 };
    expect(evalCondition(c, { kind: "range", lo: 0, hi: 200000 })).toBe("T");
    expect(evalCondition(c, { kind: "range", lo: 200001, hi: INF })).toBe("F");
    expect(evalCondition(c, { kind: "range", lo: 100000, hi: 300000 })).toBe("U");
  });
  it("bands are built from rule limits and always decide", () => {
    expect(cutPoints("annual_income", ds.schemes)).toEqual([200000]);
    const bands = bandsFor(ds.facts.find((f) => f.id === "annual_income")!, ds.schemes);
    expect(bands).toEqual([
      { kind: "range", lo: 0, hi: 200000 },
      { kind: "range", lo: 200001, hi: INF },
    ]);
    for (const b of bands) expect(evalCondition({ fact: "annual_income", op: "lte", value: 200000 }, b)).not.toBe("U");
  });
});

describe("screening", () => {
  it("missing information is reported, not rejected", () => {
    const r = screenScheme(ds, scheme("FX-01"), { livelihood: v(["fishing"]), fwf_member: v(true), annual_income: { kind: "unknown" } });
    expect(r.status).toBe("needs_information");
    expect(r.missingFacts).toEqual(["annual_income"]);
  });
  it("a known failing condition still gives not matched when other facts are unknown", () => {
    const r = screenScheme(ds, scheme("FX-01"), { livelihood: v(["plantation"]) });
    expect(r.status).toBe("not_matched");
  });
  it("partial schemes are never screened", () => {
    const r = screenScheme(ds, scheme("FX-05"), { livelihood: v(["fishing"]) });
    expect(r.status).toBe("informational");
  });
  it("one step away points at a changeable condition", () => {
    const r = screenScheme(ds, scheme("FX-01"), { livelihood: v(["fishing"]), fwf_member: v(false), annual_income: n(100000) });
    expect(r.status).toBe("not_matched");
    expect(r.oneStep?.leaf.fact).toBe("fwf_member");
    expect(r.oneStep?.becomes).toBe("potentially_eligible");
  });
  it("no one step when the failing condition cannot change", () => {
    const r = screenScheme(ds, scheme("FX-01"), { livelihood: v(["fishing"]), fwf_member: v(true), annual_income: n(900000) });
    expect(r.oneStep).toBeUndefined();
  });
  it("conditional documents are marked when their condition is unknown", () => {
    const r = screenScheme(ds, scheme("FX-04"), { livelihood: v(["plantation"]), age: n(70) });
    expect(r.status).toBe("potentially_eligible");
    expect(r.documents.find((d) => d.doc.id === "disability_cert")?.conditional).toBe(true);
    const r2 = screenScheme(ds, scheme("FX-04"), { livelihood: v(["plantation"]), age: n(70), disability: v(false) });
    expect(r2.documents.some((d) => d.doc.id === "disability_cert")).toBe(false);
  });
});

describe("adaptive questions", () => {
  it("asks livelihood first", () => {
    expect(nextQuestion(ds, {})?.fact.id).toBe("livelihood");
  });
  it("does not ask plantation questions of a fishing-only family", () => {
    const { asked } = simulateAdaptive(ds, { livelihood: v(["fishing"]), fwf_member: v(true), annual_income: n(1), age: n(70) });
    expect(asked).not.toContain("spwf_member");
    expect(asked).not.toContain("disability");
  });
  it("stops when nothing is undecided", () => {
    expect(nextQuestion(ds, { livelihood: v([]), fwf_member: v(false) })).toBeNull();
  });
  it("gives the same result as a full evaluation for every combination", () => {
    const opts = {
      livelihood: [v(["fishing"]), v(["plantation"]), v(["fishing", "plantation"]), v(["allied"]), { kind: "unknown" } as Answer],
      fwf_member: [v(true), v(false), { kind: "unknown" } as Answer],
      spwf_member: [v(true), v(false)],
      annual_income: [n(0), n(200000), n(200001), { kind: "unknown" } as Answer],
      age: [n(59), n(60), { kind: "declined" } as Answer],
      disability: [v(true), v(false), { kind: "declined" } as Answer],
    };
    const keys = Object.keys(opts) as (keyof typeof opts)[];
    let count = 0;
    const walk = (i: number, acc: Answers) => {
      if (i === keys.length) {
        const sim = simulateAdaptive(ds, acc);
        expect(statusMap(screenAll(ds, sim.answers))).toEqual(statusMap(screenAll(ds, acc)));
        count++;
        return;
      }
      for (const o of opts[keys[i]]) walk(i + 1, { ...acc, [keys[i]]: o });
    };
    walk(0, {});
    expect(count).toBe(5 * 3 * 2 * 4 * 3 * 3);
  });
  it("prunes answers that no longer matter", () => {
    const full: Answers = { livelihood: v(["fishing"]), fwf_member: v(false), annual_income: n(5), age: n(30) };
    const pruned = pruneAnswers(ds, full);
    expect(pruned.annual_income).toBeUndefined();
    expect(pruned.age).toBeUndefined();
    expect(statusMap(screenAll(ds, pruned))).toEqual(statusMap(screenAll(ds, full)));
  });
});

describe("profiles and data", () => {
  it("fixture profiles pass", () => {
    for (const p of ds.profiles) {
      const run = runProfile(ds, p);
      expect(run.checks.filter((c) => !c.ok)).toEqual([]);
      expect(run.passed).toBe(true);
    }
  });
  it("parses answer strings", () => {
    const a = parseAnswerString(ds, "livelihood=fishing,plantation; fwf_member=yes; annual_income=1,50,000; age=unknown");
    expect(a.livelihood).toEqual(v(["fishing", "plantation"]));
    expect(a.annual_income).toEqual(n(150000));
    expect(a.age).toEqual({ kind: "unknown" });
  });
  it("fixture has no validation errors", () => {
    expect(validateDataset(ds).filter((i) => i.level === "error")).toEqual([]);
  });
  it("rejects tier 3 sources and tracking URLs", () => {
    const bad = fixture();
    bad.sources[0].tier = 3;
    bad.sources[0].url = "https://x.gov.in/?utm_source=chatgpt.com";
    const msgs = validateDataset(bad).map((i) => i.message).join("\n");
    expect(msgs).toMatch(/tier 3/);
    expect(msgs).toMatch(/utm_/);
  });
});
