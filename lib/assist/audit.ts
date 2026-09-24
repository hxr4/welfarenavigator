import { leavesOf } from "../engine/evaluate";
import type { Dataset, Leaf, Op } from "../engine/types";
import { asciiDigits } from "./evidence";

export type AuditLevel = "error" | "warn";

export interface AuditFlag {
  level: AuditLevel;
  schemeId: string;
  ref: string;
  check: string;
  detail: string;
}

export interface AuditReport {
  flags: AuditFlag[];
  leaves: number;
  numericLeaves: number;
  pendingReview: number;
  schemes: number;
}

const EN_WORDS: Record<number, string[]> = {
  1: ["one"], 2: ["two"], 3: ["three"], 4: ["four"], 5: ["five"], 6: ["six"], 7: ["seven"], 8: ["eight"], 9: ["nine"], 10: ["ten"],
  15: ["fifteen"], 18: ["eighteen"], 19: ["nineteen"], 20: ["twenty"], 60: ["sixty"],
};
const ML_STEMS: Record<number, string[]> = {
  1: ["ഒന്ന"], 2: ["രണ്ട"], 3: ["മൂന്ന"], 4: ["നാല"], 5: ["അഞ്ച"], 6: ["ആറ"], 7: ["ഏഴ"], 8: ["എട്ട"], 9: ["ഒമ്പത"], 10: ["പത്ത"],
  60: ["അറുപത"],
};

export function numberMentioned(n: number, text: string): boolean {
  const plain = asciiDigits(text).toLowerCase();
  const digits = plain.replace(/(\d),(?=\d)/g, "$1");
  if (new RegExp(`(^|[^\\d])${n}([^\\d]|$)`).test(digits)) return true;
  if (n >= 100000 && n % 100000 === 0 && new RegExp(`(^|[^\\d])${n / 100000}\\s*(lakh|ലക്ഷ)`).test(digits)) return true;
  if ((EN_WORDS[n] ?? []).some((w) => new RegExp(`\\b${w}\\b`).test(plain))) return true;
  return (ML_STEMS[n] ?? []).some((w) => plain.includes(w));
}

const CUES: { ops: Op[]; re: RegExp }[] = [
  { ops: ["gte", "gt"], re: /(at least|minimum|not less than|completed|attaining|കുറഞ്ഞത്|എങ്കിലും|പൂർത്തിയാ)/i },
  { ops: ["lt"], re: /(below|less than|താഴെ)/i },
  { ops: ["lte"], re: /(not exceed|not more than|up to|maximum|കൂടുതലായിരിക്കരുത്|കവിയരുത്|കവിയാത്ത|പരമാവധി)/i },
];

export function directionHint(op: Op, quote: string): string | null {
  if (!["gte", "gt", "lt", "lte"].includes(op)) return null;
  const hits = CUES.filter((c) => c.re.test(quote));
  if (hits.length !== 1) return null;
  return hits[0].ops.includes(op) ? null : `quote reads like ${hits[0].ops.join("/")}, rule uses ${op}`;
}

const norm = (s: string) => asciiDigits(s).replace(/\s+/g, " ").trim();

export function auditDataset(ds: Dataset, sourceTexts: Record<string, string> = {}): AuditReport {
  const flags: AuditFlag[] = [];
  const sourceIds = new Set(ds.sources.map((s) => s.id));
  const docIds = new Set(ds.documents.map((d) => d.id));
  const typeIds = new Set(ds.locationTypes.map((t) => t.id));
  let leaves = 0;
  let numericLeaves = 0;
  let pendingReview = 0;

  const add = (level: AuditLevel, schemeId: string, ref: string, check: string, detail: string) =>
    flags.push({ level, schemeId, ref, check, detail });

  const leafChecks = (schemeId: string, leaf: Leaf) => {
    leaves += 1;
    if (!leaf.reviewedBy || /pending/i.test(leaf.reviewedBy)) pendingReview += 1;
    const src = leaf.source;
    if (!src) return add("error", schemeId, leaf.id, "source", "condition has no source");
    if (!sourceIds.has(src.sourceId)) add("error", schemeId, leaf.id, "source", `unknown source ${src.sourceId}`);
    if (!src.quote?.trim()) return add("error", schemeId, leaf.id, "quote", "condition has no quotation");
    if (typeof leaf.value === "number") {
      numericLeaves += 1;
      if (!numberMentioned(leaf.value, src.quote)) add("warn", schemeId, leaf.id, "threshold", `${leaf.fact} ${leaf.op} ${leaf.value}: number not found in the quote`);
      const hint = directionHint(leaf.op, src.quote);
      if (hint) add("warn", schemeId, leaf.id, "direction", `${leaf.fact}: ${hint}`);
    }
    const text = sourceTexts[src.sourceId];
    if (text && !norm(text).includes(norm(src.quote))) add("warn", schemeId, leaf.id, "quote-match", "quotation not found verbatim in the stored source text");
  };

  for (const scheme of ds.schemes) {
    for (const leaf of leavesOf(scheme.rule)) leafChecks(scheme.id, leaf);
    for (const d of scheme.documents) if (!docIds.has(d.docId)) add("error", scheme.id, d.docId, "document", "document id is not defined");
    for (const a of scheme.apply) if (!typeIds.has(a.locationType)) add("error", scheme.id, a.locationType, "apply", "office type is not defined");
    if (scheme.apply.length === 0) {
      if (scheme.verification.eligibility === "verified") add("error", scheme.id, "-", "apply", "no application route");
      else if (scheme.verification.apply === "verified") add("warn", scheme.id, "-", "apply", "apply marked verified but no route is listed");
    }
    if (scheme.verification.eligibility === "verified" && scheme.documents.length === 0) add("warn", scheme.id, "-", "documents", "verified scheme with no published documents");
  }
  return { flags, leaves, numericLeaves, pendingReview, schemes: ds.schemes.length };
}
