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

import { DISTRICTS } from "../lib/data/districts";
import { leavesOf } from "../lib/engine/evaluate";
import { simulateAdaptive } from "../lib/engine/profile";
import { isScreenable } from "../lib/engine/screen";
import type { Answers } from "../lib/engine/types";

describe("locations and districts", () => {
  it("uses only the 14 official district spellings", () => {
    const ids = DISTRICTS.map((d) => d.id);
    expect(dataset.locations.filter((l) => !ids.includes(l.district)).map((l) => l.id)).toEqual([]);
  });
  it("every apply channel points to a known office type", () => {
    const types = dataset.locationTypes.map((t) => t.id);
    const bad = dataset.schemes.flatMap((s) => s.apply.filter((a) => !types.includes(a.locationType)).map((a) => `${s.id}:${a.locationType}`));
    expect(bad).toEqual([]);
  });
  it("every district-level office type used by a screenable scheme is covered in all 14 districts, or reported", () => {
    const used = new Set(dataset.schemes.filter(isScreenable).flatMap((s) => s.apply.map((a) => a.locationType)));
    const gaps: string[] = [];
    for (const type of dataset.locationTypes.filter((t) => t.scope !== "state" && used.has(t.id))) {
      const count = dataset.locations.filter((l) => l.type === type.id).length;
      if (count === 0) continue;
      for (const d of DISTRICTS) if (!dataset.locations.some((l) => l.type === type.id && l.district === d.id)) gaps.push(`${type.id}:${d.id}`);
    }
    expect(gaps).toEqual([]);
  });
});

describe("adaptive questioning asks only relevant facts", () => {
  const factsOf = (category: string) =>
    new Set(dataset.schemes.filter((s) => isScreenable(s) && s.category === category).flatMap((s) => leavesOf(s.rule).map((l) => l.fact)));
  const fishingFacts = factsOf("fishing");
  const plantationFacts = factsOf("plantation");
  const onlyPlantation = [...plantationFacts].filter((f) => !fishingFacts.has(f) && f !== "livelihood");
  const onlyFishing = [...fishingFacts].filter((f) => !plantationFacts.has(f) && f !== "livelihood");
  const livelihood = dataset.facts.find((f) => f.id === "livelihood");

  it.skipIf(!livelihood)("a fishing-only household is never asked plantation-only questions", () => {
    const start: Answers = { livelihood: { kind: "value", value: ["fishing"] } };
    const { asked } = simulateAdaptive(dataset, start);
    expect(asked.filter((f) => onlyPlantation.includes(f))).toEqual([]);
  });
  it.skipIf(!livelihood)("a plantation-only household is never asked fishing-only questions", () => {
    const start: Answers = { livelihood: { kind: "value", value: ["plantation_worker"] } };
    const { asked } = simulateAdaptive(dataset, start);
    expect(asked.filter((f) => onlyFishing.includes(f))).toEqual([]);
  });
  it.skipIf(!livelihood)("a household with other work is asked nothing more", () => {
    const { asked } = simulateAdaptive(dataset, { livelihood: { kind: "value", value: ["other"] } });
    expect(asked.filter((f) => f !== "livelihood")).toEqual([]);
  });
});
