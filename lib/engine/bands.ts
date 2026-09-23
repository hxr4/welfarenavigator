import { INF, leavesOf } from "./evaluate";
import type { Answer, Fact, Scheme } from "./types";

export function cutPoints(factId: string, schemes: Scheme[]): number[] {
  const cuts = new Set<number>();
  for (const s of schemes) {
    for (const leaf of leavesOf(s.rule)) {
      if (leaf.fact !== factId) continue;
      const v = Number(leaf.value);
      if (!Number.isFinite(v)) continue;
      switch (leaf.op) {
        case "lte":
        case "gt":
          cuts.add(v);
          break;
        case "lt":
        case "gte":
          cuts.add(v - 1);
          break;
        case "eq":
        case "neq":
          cuts.add(v - 1);
          cuts.add(v);
          break;
      }
    }
    for (const d of s.documents) {
      if (d.when && d.when.fact === factId) {
        const v = Number(d.when.value);
        if (Number.isFinite(v)) {
          if (d.when.op === "lte" || d.when.op === "gt") cuts.add(v);
          if (d.when.op === "lt" || d.when.op === "gte") cuts.add(v - 1);
        }
      }
    }
  }
  return [...cuts].filter((c) => c >= 0).sort((a, b) => a - b);
}

export function bandsFor(fact: Fact, schemes: Scheme[]): Answer[] {
  const cuts = cutPoints(fact.id, schemes);
  const bands: Answer[] = [];
  let lo = 0;
  for (const c of cuts) {
    if (c < lo) continue;
    bands.push({ kind: "range", lo, hi: c });
    lo = c + 1;
  }
  bands.push({ kind: "range", lo, hi: INF });
  return bands;
}

export function choicesFor(fact: Fact, schemes: Scheme[]): Answer[] {
  switch (fact.type) {
    case "boolean":
      return [
        { kind: "value", value: true },
        { kind: "value", value: false },
      ];
    case "enum":
      return fact.options.map((o) => ({ kind: "value", value: o.value }));
    case "multi":
      return fact.options.map((o) => ({ kind: "value", value: [o.value] }));
    case "number":
      return bandsFor(fact, schemes);
  }
}
