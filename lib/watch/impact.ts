import { numbersIn } from "../assist/evidence";
import { leavesOf } from "../engine/evaluate";
import type { Dataset, Leaf } from "../engine/types";

export interface QuoteRef {
  ref: string;
  schemeId: string;
  kind: "condition" | "document" | "apply";
  sourceId: string;
  quote: string;
  leaf?: Leaf;
}

export function quoteRefs(ds: Dataset): QuoteRef[] {
  const out: QuoteRef[] = [];
  for (const s of ds.schemes) {
    for (const leaf of leavesOf(s.rule)) {
      if (leaf.source?.quote?.trim()) out.push({ ref: `${s.id}/${leaf.id}`, schemeId: s.id, kind: "condition", sourceId: leaf.source.sourceId, quote: leaf.source.quote, leaf });
    }
    s.documents.forEach((d) => {
      if (d.source?.quote?.trim()) out.push({ ref: `${s.id}/doc:${d.docId}`, schemeId: s.id, kind: "document", sourceId: d.source.sourceId, quote: d.source.quote });
    });
    s.apply.forEach((a, i) => {
      if (a.source?.quote?.trim()) out.push({ ref: `${s.id}/apply:${i}`, schemeId: s.id, kind: "apply", sourceId: a.source.sourceId, quote: a.source.quote });
    });
  }
  return out;
}

function squashToken(t: string): string[] {
  return t
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

export function squash(s: string): string {
  return s.split(/\s+/).flatMap(squashToken).join(" ");
}

interface Indexed {
  sq: string[];
  rawIdx: number[];
  raw: string[];
}

function index(text: string): Indexed {
  const raw = text.split(/\s+/).filter(Boolean);
  const sq: string[] = [];
  const rawIdx: number[] = [];
  raw.forEach((r, i) => {
    for (const t of squashToken(r)) {
      sq.push(t);
      rawIdx.push(i);
    }
  });
  return { sq, rawIdx, raw };
}

export const NEAR = 0.92;
export const RELATED = 0.6;

export type Match =
  | { kind: "exact"; score: 1 }
  | { kind: "near" | "changed"; score: number; candidate: string }
  | { kind: "missing"; score: number };

export function locateQuote(quote: string, text: string, idx: Indexed = index(text)): Match {
  const q = squash(quote).split(" ").filter(Boolean);
  if (q.length === 0) return { kind: "missing", score: 0 };
  if (` ${idx.sq.join(" ")} `.includes(` ${q.join(" ")} `)) return { kind: "exact", score: 1 };
  const k = q.length;
  if (idx.sq.length < Math.ceil(k * RELATED)) return { kind: "missing", score: 0 };
  const need = new Map<string, number>();
  for (const t of q) need.set(t, (need.get(t) ?? 0) + 1);
  const have = new Map<string, number>();
  let overlap = 0;
  let best = -1;
  let bestStart = 0;
  const w = Math.min(k, idx.sq.length);
  for (let i = 0; i < idx.sq.length; i++) {
    const t = idx.sq[i];
    const h = have.get(t) ?? 0;
    if (h < (need.get(t) ?? 0)) overlap++;
    have.set(t, h + 1);
    if (i >= w) {
      const o = idx.sq[i - w];
      const ho = (have.get(o) ?? 0) - 1;
      have.set(o, ho);
      if (ho < (need.get(o) ?? 0)) overlap--;
    }
    if (i >= w - 1 && overlap > best) {
      best = overlap;
      bestStart = i - w + 1;
    }
  }
  const score = best / k;
  if (score < RELATED) return { kind: "missing", score };
  const from = idx.rawIdx[bestStart];
  const to = idx.rawIdx[bestStart + w - 1];
  const candidate = idx.raw.slice(from, to + 1).join(" ");
  return { kind: score >= NEAR ? "near" : "changed", score, candidate };
}

export type FindingKind = "unchanged" | "reworded" | "value_change" | "changed" | "missing";

export interface Finding {
  ref: string;
  schemeId: string;
  sourceId: string;
  kind: FindingKind;
  score: number;
  oldQuote: string;
  newQuote?: string;
  fact?: string;
  oldValue?: number;
  newValue?: number;
}

export function valueChange(leaf: Leaf | undefined, oldQuote: string, newQuote: string): number | null {
  if (!leaf || typeof leaf.value !== "number") return null;
  const a = numbersIn(oldQuote).map(Number);
  const b = numbersIn(newQuote).map(Number);
  if (a.length === 0 || a.length !== b.length) return null;
  const diffs = a.map((x, i) => [x, b[i]] as const).filter(([x, y]) => x !== y);
  if (diffs.length === 0) return null;
  if (!diffs.every(([x]) => x === leaf.value)) return null;
  const targets = new Set(diffs.map(([, y]) => y));
  return targets.size === 1 ? [...targets][0] : null;
}

export function analyse(refs: QuoteRef[], text: string): Finding[] {
  const idx = index(text);
  return refs.map((r) => {
    const m = locateQuote(r.quote, text, idx);
    const base = { ref: r.ref, schemeId: r.schemeId, sourceId: r.sourceId, oldQuote: r.quote, score: Number(m.score.toFixed(3)) };
    if (m.kind === "exact") return { ...base, kind: "unchanged" as const };
    if (m.kind === "missing") return { ...base, kind: "missing" as const };
    const sameNumbers = numbersIn(r.quote).join("|") === numbersIn(m.candidate).join("|");
    if (sameNumbers && m.kind === "near") return { ...base, kind: "reworded" as const, newQuote: m.candidate };
    const nv = valueChange(r.leaf, r.quote, m.candidate);
    if (nv !== null) return { ...base, kind: "value_change" as const, newQuote: m.candidate, fact: r.leaf!.fact, oldValue: r.leaf!.value as number, newValue: nv };
    return { ...base, kind: "changed" as const, newQuote: m.candidate };
  });
}

export function isTrackable(quote: string, text: string): boolean {
  return locateQuote(quote, text).kind === "exact";
}
