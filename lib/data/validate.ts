import { leavesOf } from "../engine/evaluate";
import { DISTRICTS } from "./districts";
import { parseAnswerMap } from "../engine/profile";
import type { Dataset, Fact, FactType, Op } from "../engine/types";

export interface Issue {
  level: "error" | "warning";
  where: string;
  message: string;
}

const OPS_FOR: Record<FactType, Op[]> = {
  boolean: ["eq", "neq"],
  number: ["eq", "neq", "lt", "lte", "gt", "gte"],
  enum: ["eq", "neq", "in", "not_in"],
  multi: ["includes", "excludes"],
};

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const d = new Set<string>();
  for (const id of ids) (seen.has(id) ? d : seen).add(id);
  return [...d];
}

function checkValue(fact: Fact, op: Op, value: unknown, where: string, issues: Issue[]) {
  if (!OPS_FOR[fact.type].includes(op)) {
    issues.push({ level: "error", where, message: `Operator "${op}" cannot be used with ${fact.type} fact "${fact.id}". Use one of: ${OPS_FOR[fact.type].join(", ")}` });
    return;
  }
  if (fact.type === "boolean" && typeof value !== "boolean") {
    issues.push({ level: "error", where, message: `Value for yes/no fact "${fact.id}" must be yes or no` });
  }
  if (fact.type === "number" && !Number.isFinite(Number(value))) {
    issues.push({ level: "error", where, message: `Value for number fact "${fact.id}" must be a number` });
  } else if (fact.type === "number" && !Number.isInteger(Number(value))) {
    issues.push({ level: "error", where, message: `Value for number fact "${fact.id}" must be a whole number (answers are asked as whole-number ranges)` });
  }
  if (Array.isArray(value) && value.length === 0) {
    issues.push({ level: "error", where, message: `Condition on "${fact.id}" lists no values` });
  }
  if (fact.type === "enum" || fact.type === "multi") {
    const vals = Array.isArray(value) ? value : [String(value)];
    for (const v of vals) {
      if (!fact.options.some((o) => o.value === v)) {
        issues.push({ level: "error", where, message: `"${v}" is not an option of "${fact.id}"` });
      }
    }
  }
}

export function validateDataset(ds: Dataset): Issue[] {
  const issues: Issue[] = [];
  const add = (level: Issue["level"], where: string, message: string) => issues.push({ level, where, message });

  for (const [name, ids] of [
    ["sources", ds.sources.map((x) => x.id)],
    ["facts", ds.facts.map((x) => x.id)],
    ["schemes", ds.schemes.map((x) => x.id)],
    ["documents", ds.documents.map((x) => x.id)],
    ["location_types", ds.locationTypes.map((x) => x.id)],
    ["locations", ds.locations.map((x) => x.id)],
    ["profiles", ds.profiles.map((x) => x.id)],
  ] as const) {
    for (const d of dupes([...ids])) add("error", name, `Duplicate id "${d}"`);
  }

  const source = (id?: string) => (id ? ds.sources.find((s) => s.id === id) : undefined);

  for (const s of ds.sources) {
    if (/utm_/i.test(s.url)) add("error", `sources ${s.id}`, "URL contains a tracking parameter (utm_). Use the clean official URL.");
    if (s.url && !/^https?:\/\//.test(s.url)) add("error", `sources ${s.id}`, "URL must start with https://");
    if (!s.url && !s.localFile) add("error", `sources ${s.id}`, "Give the official URL, or the saved copy in local_file");
    if (!s.url) add("warning", `sources ${s.id}`, "No public URL; only the saved copy in sources/ is cited");
  }

  for (const f of ds.facts) {
    if ((f.type === "enum" || f.type === "multi") && f.options.length < 2) {
      add("error", `facts ${f.id}`, "Needs at least two options in the options sheet");
    }
    if (!f.question.ml.trim()) add("error", `facts ${f.id}`, "Malayalam question is missing");
  }

  for (const s of ds.schemes) {
    const where = `schemes ${s.id}`;
    const leaves = leavesOf(s.rule);
    for (const d of dupes(leaves.map((l) => l.id))) add("error", where, `Duplicate condition_id "${d}"`);
    if (s.verification.eligibility === "verified" && leaves.length === 0) {
      add("error", where, "Marked verified but has no conditions");
    }
    for (const leaf of leaves) {
      const lw = `conditions ${s.id}/${leaf.id}`;
      const fact = ds.facts.find((f) => f.id === leaf.fact);
      if (!fact) {
        add("error", lw, `Unknown fact "${leaf.fact}"`);
        continue;
      }
      checkValue(fact, leaf.op, leaf.value, lw, issues);
      if (s.verification.eligibility === "verified") {
        const src = source(leaf.source?.sourceId);
        if (!src) add("error", lw, "Verified scheme condition needs a source_id that exists in sources");
        else if (src.tier === 3) add("error", lw, `Source ${src.id} is tier 3 (report). Reports cannot be a rule source.`);
        if (!leaf.source?.quote?.trim()) add("error", lw, "Verified scheme condition needs the exact quote");
        if (!leaf.reviewedBy || /pending/i.test(leaf.reviewedBy)) add("warning", lw, "Not cross-checked yet (reviewed_by empty or pending)");
        else if (s.verifiedBy && leaf.reviewedBy.trim() === s.verifiedBy.trim()) add("warning", lw, `Cross-checked by the same person who entered it (${leaf.reviewedBy})`);
      }
      if (leaf.changeable && !leaf.howTo?.en) add("warning", lw, "Changeable condition has no how_to text");
    }
    for (const d of s.documents) {
      if (!ds.documents.some((x) => x.id === d.docId)) add("error", `scheme_documents ${s.id}`, `Unknown document "${d.docId}"`);
      if (d.when) {
        const fact = ds.facts.find((f) => f.id === d.when!.fact);
        if (!fact) add("error", `scheme_documents ${s.id}`, `Unknown fact "${d.when.fact}"`);
        else checkValue(fact, d.when.op, d.when.value, `scheme_documents ${s.id}/${d.docId}`, issues);
      }
      if (s.verification.documents === "verified" && !source(d.source?.sourceId)) {
        add("error", `scheme_documents ${s.id}/${d.docId}`, "Documents marked verified need a source_id");
      }
    }
    if (s.verification.eligibility === "verified" && s.apply.length === 0) add("error", where, "No row in scheme_apply");
    for (const a of s.apply) {
      if (!ds.locationTypes.some((t) => t.id === a.locationType)) add("error", `scheme_apply ${s.id}`, `Unknown location type "${a.locationType}"`);
      if (s.verification.apply === "verified" && !source(a.source?.sourceId)) add("error", `scheme_apply ${s.id}`, "Apply marked verified needs a source_id");
    }
    if (!s.name.ml.trim()) add("error", where, "Malayalam name is missing");
    if (s.verification.eligibility === "verified") {
      if (s.documents.length === 0) add("warning", where, "No document in scheme_documents; the app will say the list is not published");
      for (const a of s.apply) {
        if (!ds.locations.some((l) => l.type === a.locationType)) add("warning", `scheme_apply ${s.id}`, `No office listed for type "${a.locationType}"`);
      }
    }
  }

  for (const l of ds.locations) {
    if (!ds.locationTypes.some((t) => t.id === l.type)) add("error", `locations ${l.id}`, `Unknown type "${l.type}"`);
    if (!DISTRICTS.some((d) => d.id === l.district)) add("error", `locations ${l.id}`, `"${l.district}" is not one of the 14 Kerala districts`);
    for (const d of l.serves ?? []) if (!DISTRICTS.some((x) => x.id === d)) add("error", `locations ${l.id}`, `serves "${d}" is not one of the 14 Kerala districts`);
    if ((l.lat === undefined) !== (l.lng === undefined)) add("error", `locations ${l.id}`, "Give both lat and lng, or neither");
    if (l.lat !== undefined && l.lng !== undefined && !(Number.isFinite(l.lat) && Number.isFinite(l.lng) && l.lat >= 8 && l.lat <= 13 && l.lng >= 74.5 && l.lng <= 77.6)) {
      add("error", `locations ${l.id}`, "lat/lng must be decimal degrees inside Kerala (for example 9.93, 76.26)");
    }
    if (!l.sourceId) add("warning", `locations ${l.id}`, "No source for this address");
  }

  for (const p of ds.profiles) {
    const where = `profiles ${p.id}`;
    try {
      parseAnswerMap(ds, p.answers);
    } catch (e) {
      add("error", where, (e as Error).message);
    }
    for (const id of [...Object.keys(p.expected), ...Object.keys(p.expectedMissing)]) {
      if (!ds.schemes.some((s) => s.id === id)) add("error", where, `Unknown scheme "${id}"`);
    }
    for (const facts of Object.values(p.expectedMissing)) {
      for (const f of facts) if (!ds.facts.some((x) => x.id === f)) add("error", where, `Unknown fact "${f}"`);
    }
  }

  if (!ds.disclaimer.main) add("error", "disclaimer", 'Row with key "main" is required');

  const screenable = ds.schemes.filter((s) => s.verification.eligibility === "verified").length;
  if (screenable < 10) add("warning", "schemes", `Only ${screenable} screenable (verified) schemes. The brief requires at least 10.`);
  if (ds.meta.includesExamples) add("warning", "meta", "Built with EXAMPLE rows included. Not for demo.");
  return issues;
}
