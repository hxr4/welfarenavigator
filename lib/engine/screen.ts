import { evalCondition, evalLeaves, evalNode } from "./evaluate";
import type {
  Answer,
  Answers,
  Dataset,
  Leaf,
  OneStep,
  ResolvedDocument,
  Scheme,
  SchemeResult,
  SchemeStatus,
  Tri,
} from "./types";

export function statusFromTri(t: Tri): SchemeStatus {
  return t === "T" ? "potentially_eligible" : t === "F" ? "not_matched" : "needs_information";
}

export function isScreenable(s: Scheme): boolean {
  return s.verification.eligibility === "verified";
}

export function satisfyingAnswer(leaf: Leaf, current: Answer | undefined): Answer | undefined {
  if (typeof leaf.value === "boolean") {
    if (leaf.op === "eq") return { kind: "value", value: leaf.value };
    if (leaf.op === "neq") return { kind: "value", value: !leaf.value };
    return undefined;
  }
  if (leaf.op === "eq" && typeof leaf.value === "string") return { kind: "value", value: leaf.value };
  if (leaf.op === "in") {
    const first = Array.isArray(leaf.value) ? leaf.value[0] : String(leaf.value);
    return { kind: "value", value: first };
  }
  if (leaf.op === "includes") {
    const add = Array.isArray(leaf.value) ? leaf.value[0] : String(leaf.value);
    const have = current && current.kind === "value" && Array.isArray(current.value) ? current.value : [];
    return { kind: "value", value: [...new Set([...have, add])] };
  }
  return undefined;
}

function findOneStep(scheme: Scheme, answers: Answers, failing: Leaf[]): OneStep | undefined {
  for (const leaf of failing) {
    if (!leaf.changeable) continue;
    const sat = satisfyingAnswer(leaf, answers[leaf.fact]);
    if (!sat) continue;
    const r = evalNode(scheme.rule, { ...answers, [leaf.fact]: sat });
    if (r !== "F") return { leaf, becomes: statusFromTri(r) };
  }
  return undefined;
}

function resolveDocuments(dataset: Dataset, scheme: Scheme, answers: Answers): ResolvedDocument[] {
  const out: ResolvedDocument[] = [];
  for (const d of scheme.documents) {
    const doc = dataset.documents.find((x) => x.id === d.docId);
    if (!doc) continue;
    if (!d.when) {
      out.push({ doc, conditional: false, source: d.source });
      continue;
    }
    const t = evalCondition(d.when, answers[d.when.fact]);
    if (t === "T") out.push({ doc, conditional: false, source: d.source });
    else if (t === "U") out.push({ doc, conditional: true, source: d.source });
  }
  return out;
}

export function screenScheme(dataset: Dataset, scheme: Scheme, answers: Answers): SchemeResult {
  const leaves = evalLeaves(scheme.rule, answers);
  const documents = resolveDocuments(dataset, scheme, answers);
  if (!isScreenable(scheme)) {
    return { scheme, status: "informational", leaves, missingFacts: [], failingLeaves: [], documents };
  }
  const status = statusFromTri(evalNode(scheme.rule, answers));
  const missingFacts =
    status === "needs_information"
      ? [...new Set(leaves.filter((l) => l.result === "U").map((l) => l.leaf.fact))]
      : [];
  const failingLeaves = status === "not_matched" ? leaves.filter((l) => l.result === "F").map((l) => l.leaf) : [];
  const oneStep = status === "not_matched" ? findOneStep(scheme, answers, failingLeaves) : undefined;
  return { scheme, status, leaves, missingFacts, failingLeaves, oneStep, documents };
}

const ORDER: SchemeStatus[] = ["potentially_eligible", "needs_information", "not_matched", "informational"];

export function screenAll(dataset: Dataset, answers: Answers): SchemeResult[] {
  return dataset.schemes
    .map((s) => screenScheme(dataset, s, answers))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
}

export function checklist(results: SchemeResult[]): { docId: string; name: SchemeResult["documents"][number]["doc"]; schemes: string[]; conditional: boolean }[] {
  const map = new Map<string, { docId: string; name: ResolvedDocument["doc"]; schemes: string[]; conditional: boolean }>();
  for (const r of results) {
    if (r.status !== "potentially_eligible") continue;
    for (const d of r.documents) {
      const e = map.get(d.doc.id) ?? { docId: d.doc.id, name: d.doc, schemes: [], conditional: true };
      e.schemes.push(r.scheme.id);
      e.conditional = e.conditional && d.conditional;
      map.set(d.doc.id, e);
    }
  }
  return [...map.values()];
}

export function statusMap(results: SchemeResult[]): Record<string, SchemeStatus> {
  return Object.fromEntries(results.map((r) => [r.scheme.id, r.status]));
}
