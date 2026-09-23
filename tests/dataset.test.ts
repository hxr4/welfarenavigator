import { describe, expect, it } from "vitest";
import { dataset } from "../lib/data/load";
import { validateDataset } from "../lib/data/validate";
import { generatedChecks } from "../lib/engine/generated-checks";
import { runProfile } from "../lib/engine/profile";
import { STRINGS } from "../lib/i18n/strings";

describe("current dataset (data/dataset.json)", () => {
  it("has no validation errors", () => {
    expect(validateDataset(dataset).filter((i) => i.level === "error")).toEqual([]);
  });
  it("passes every rule check generated from its conditions", () => {
    expect(generatedChecks(dataset).filter((c) => !c.ok)).toEqual([]);
  });
  for (const p of dataset.profiles) {
    it(`profile ${p.id}: ${p.title}`, () => {
      const run = runProfile(dataset, p);
      expect(run.error).toBeUndefined();
      expect(run.checks.filter((c) => !c.ok)).toEqual([]);
      expect(run.adaptiveMismatches).toEqual([]);
    });
  }
});

describe("wording", () => {
  it("every UI string has Malayalam", () => {
    const missing = Object.entries(STRINGS).filter(([, v]) => !v.ml.trim()).map(([k]) => k);
    expect(missing).toEqual([]);
  });
  it("never says eligible without potentially", () => {
    const bad = Object.entries(STRINGS)
      .filter(([, v]) => /\beligible\b/i.test(v.en) && !/potentially/i.test(v.en))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it("disclaimer does not promise benefits", () => {
    const text = Object.values(dataset.disclaimer).map((d) => d.en).join(" ");
    expect(text).not.toMatch(/\b(guarantee|will receive|you are eligible)\b/i);
  });
});
