import { describe, expect, it } from "vitest";
import { dataset as ds } from "../lib/data/load";
import { validateDataset } from "../lib/data/validate";
import { evalCondition } from "../lib/engine/evaluate";
import { nextQuestion, pruneAnswers } from "../lib/engine/next-question";
import { parseAnswerMap, parseAnswerString, simulateAdaptive } from "../lib/engine/profile";
import { screenAll, screenScheme } from "../lib/engine/screen";
import type { Dataset } from "../lib/engine/types";
import { channelFor } from "../lib/offices";
import { POST } from "../app/api/screen/route";

const fact = (id: string) => ds.facts.find((f) => f.id === id)!;
const scheme = (id: string) => ds.schemes.find((s) => s.id === id)!;

describe("answer parsing rejects values that could decide a scheme wrongly", () => {
  it("rejects reversed ranges, blanks, negatives and empty multi answers", () => {
    const bads: Record<string, string>[] = [{ age: "99-0" }, { annual_family_income: "" }, { annual_family_income: "  " }, { age: "-5" }, { livelihood: "" }, { livelihood: "," }];
    for (const bad of bads) {
      expect(() => parseAnswerMap(ds, bad)).toThrow();
    }
  });
  it("error messages name the fact but never echo the raw value", () => {
    try {
      parseAnswerMap(ds, { annual_family_income: "52000abc" });
    } catch (e) {
      expect((e as Error).message).toContain("annual_family_income");
      expect((e as Error).message).not.toContain("52000abc");
    }
  });
  it("still accepts unknown for a blank-looking answer when said explicitly", () => {
    expect(parseAnswerMap(ds, { annual_family_income: "unknown" }).annual_family_income).toEqual({ kind: "unknown" });
  });
});

describe("strict comparisons are exact for decimals", () => {
  it("lt and gt compare directly", () => {
    const n = (x: number) => ({ kind: "range" as const, lo: x, hi: x });
    expect(evalCondition({ fact: "x", op: "lt", value: 50000 }, n(49999.5))).toBe("T");
    expect(evalCondition({ fact: "x", op: "lt", value: 50000 }, n(50000))).toBe("F");
    expect(evalCondition({ fact: "x", op: "gt", value: 60 }, n(60.5))).toBe("T");
    expect(evalCondition({ fact: "x", op: "gt", value: 60 }, n(60))).toBe("F");
    expect(evalCondition({ fact: "x", op: "lt", value: 2.5 }, n(2))).toBe("T");
  });
});

describe("only questions that can still change a result are asked or listed as missing", () => {
  const answers = parseAnswerString(ds, "livelihood=fishing; kfwfb_member=yes; kfwfb_contributions_paid=yes; kfwfb_family_status=member_under_60; family_event=daughter_marriage; bride_18=yes; annual_family_income=30000; kfwfb_membership_years=unknown");
  it("FISH-11 does not list prior marriage assistance once a no-limit category is chosen", () => {
    const r = screenScheme(ds, scheme("FISH-11"), answers);
    expect(r.status).toBe("needs_information");
    expect(r.missingFacts).toEqual(["kfwfb_membership_years"]);
  });
  it("the adaptive flow never asks prior marriage assistance in that case", () => {
    const full = { ...answers, prior_marriage_assistance: { kind: "value" as const, value: false } };
    expect(simulateAdaptive(ds, full).asked).not.toContain("prior_marriage_assistance");
    let a = { ...answers };
    for (let i = 0; i < 60; i++) {
      const q = nextQuestion(ds, a);
      if (!q) break;
      expect(q.fact.id).not.toBe("prior_marriage_assistance");
      a = { ...a, [q.fact.id]: { kind: "unknown" } };
    }
  });
  it("every profile still reaches the same results", () => {
    for (const p of ds.profiles) {
      const full = parseAnswerMap(ds, p.answers);
      const adaptive = screenAll(ds, simulateAdaptive(ds, full).answers).map((r) => [r.scheme.id, r.status]);
      expect(adaptive).toEqual(screenAll(ds, full).map((r) => [r.scheme.id, r.status]));
    }
  });
});

describe("editing an answer keeps it", () => {
  it("pruneAnswers never drops a fact the user just changed", () => {
    const a = parseAnswerString(ds, "livelihood=fishing; kfwfb_member=yes; age=30; fisher_work_10_years=yes; retired_from_fishing=yes; kfwfb_membership_years=1");
    expect(pruneAnswers(ds, a, ["fisher_work_10_years", "livelihood"])).toHaveProperty("fisher_work_10_years");
  });
});

describe("office area filter", () => {
  it("an Akshaya area does not hide the district's other offices", () => {
    const fo = channelFor(ds, "fisheries_district_office", { district: "Ernakulam", area: "Kolencherry" });
    expect(fo.status).toBe("ok");
    expect(fo.offices.every((o) => o.location.district === "Ernakulam")).toBe(true);
    const ak = channelFor(ds, "akshaya", { district: "Ernakulam", area: "Kolencherry" });
    expect(ak.offices.every((o) => o.location.area === "Kolencherry")).toBe(true);
  });
});

describe("dataset validation catches more bad workbooks", () => {
  const clone = (): Dataset => JSON.parse(JSON.stringify(ds));
  it("decimal thresholds", () => {
    const d = clone();
    const s = d.schemes.find((x) => x.id === "FISH-06")!;
    const leaf = (s.rule as { all: { fact?: string; value?: unknown }[] }).all.find((l) => l.fact === "age")!;
    leaf.value = 59.5;
    expect(validateDataset(d).some((i) => i.level === "error" && /whole number/.test(i.message))).toBe(true);
  });
  it("duplicate condition ids and coordinates outside Kerala", () => {
    const d = clone();
    const s = d.schemes.find((x) => x.id === "FISH-06")!;
    const all = (s.rule as { all: { id?: string }[] }).all;
    all[1].id = all[0].id;
    d.locations[0].lat = 51.5;
    d.locations[0].lng = -0.12;
    const errs = validateDataset(d).filter((i) => i.level === "error").map((i) => i.message);
    expect(errs.some((m) => /Duplicate condition_id/.test(m))).toBe(true);
    expect(errs.some((m) => /inside Kerala/.test(m))).toBe(true);
  });
});

describe("/api/screen", () => {
  const call = (body: unknown) => POST(new Request("http://x/api/screen", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
  it("screens a valid household and does not cache", async () => {
    const res = await call({ answers: { livelihood: "fishing", kfwfb_member: "yes" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const json = await res.json();
    expect(json.results.find((r: { schemeId: string }) => r.schemeId === "FISH-01").status).toBe("potentially_eligible");
  });
  it("rejects bad input without echoing it", async () => {
    const res = await call({ answers: { annual_family_income: "secret-99999" } });
    expect(res.status).toBe(400);
    expect(JSON.stringify(await res.json())).not.toContain("secret-99999");
  });
  it("rejects oversized bodies and non-JSON", async () => {
    const many = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`f${i}`, "yes"]));
    expect((await call({ answers: many })).status).toBe(400);
    expect((await call({ answers: { age: "x".repeat(500) } })).status).toBe(400);
    expect((await call("not json")).status).toBe(400);
  });
});
