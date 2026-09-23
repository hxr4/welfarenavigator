import { bandsFor } from "./bands";
import { evalCondition, leavesOf } from "./evaluate";
import { isScreenable } from "./screen";
import type { Dataset, Tri } from "./types";

export interface GeneratedCheck {
  schemeId: string;
  leafId: string;
  description: string;
  ok: boolean;
}

function expectNumeric(op: string, t: number, x: number): Tri {
  switch (op) {
    case "lt": return x < t ? "T" : "F";
    case "lte": return x <= t ? "T" : "F";
    case "gt": return x > t ? "T" : "F";
    case "gte": return x >= t ? "T" : "F";
    case "eq": return x === t ? "T" : "F";
    case "neq": return x !== t ? "T" : "F";
  }
  return "U";
}

export function generatedChecks(ds: Dataset): GeneratedCheck[] {
  const out: GeneratedCheck[] = [];
  for (const s of ds.schemes) {
    if (!isScreenable(s)) continue;
    for (const leaf of leavesOf(s.rule)) {
      const fact = ds.facts.find((f) => f.id === leaf.fact);
      if (!fact) continue;
      const push = (description: string, ok: boolean) => out.push({ schemeId: s.id, leafId: leaf.id, description, ok });
      push(`${leaf.fact} unknown gives U`, evalCondition(leaf, { kind: "unknown" }) === "U");
      if (fact.type === "number") {
        const tv = Number(leaf.value);
        for (const x of [tv - 1, tv, tv + 1]) {
          push(`${leaf.fact} ${leaf.op} ${tv} at ${x}`, evalCondition(leaf, { kind: "range", lo: x, hi: x }) === expectNumeric(leaf.op, tv, x));
        }
        const bands = bandsFor(fact, ds.schemes);
        push(`every income/age range decides ${leaf.fact} ${leaf.op} ${tv}`, bands.every((b) => evalCondition(leaf, b) !== "U"));
      } else if (fact.type === "boolean") {
        const want = leaf.op === "eq" ? leaf.value : !leaf.value;
        push(`${leaf.fact} = ${String(want)} satisfies`, evalCondition(leaf, { kind: "value", value: want as boolean }) === "T");
        push(`${leaf.fact} = ${String(!want)} fails`, evalCondition(leaf, { kind: "value", value: !want }) === "F");
      } else {
        const vals = Array.isArray(leaf.value) ? leaf.value : [String(leaf.value)];
        const other = fact.options.map((o) => o.value).filter((v) => !vals.includes(v));
        const positive = leaf.op === "eq" || leaf.op === "in" || leaf.op === "includes";
        const inAns = fact.type === "multi" ? { kind: "value" as const, value: [vals[0]] } : { kind: "value" as const, value: vals[0] };
        push(`${leaf.fact} = ${vals[0]}`, evalCondition(leaf, inAns) === (positive ? "T" : "F"));
        if (other.length) {
          const outAns = fact.type === "multi" ? { kind: "value" as const, value: [other[0]] } : { kind: "value" as const, value: other[0] };
          push(`${leaf.fact} = ${other[0]}`, evalCondition(leaf, outAns) === (positive ? "F" : "T"));
        }
      }
    }
  }
  return out;
}
