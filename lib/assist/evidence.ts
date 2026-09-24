import type { Dataset, Lang, Scheme, SourceRef } from "../engine/types";
import { leavesOf } from "../engine/evaluate";
import { pick } from "../i18n/describe";

export const INTENTS = ["what", "who", "documents", "apply"] as const;
export type Intent = (typeof INTENTS)[number];

export interface Passage {
  n: number;
  label: string;
  text: string;
  sourceId?: string;
  sourceTitle?: string;
  authority?: string;
  locator?: string;
  url?: string;
}

const MAX_PASSAGES = 8;
const MAX_CHARS = 600;

const INTENT_QUESTION: Record<Intent, string> = {
  what: "What is this scheme and what does it give?",
  who: "Who can get this scheme, in plain words?",
  documents: "Which documents are needed and what are they?",
  apply: "Where and how does a family apply?",
};

export function intentQuestion(intent: Intent): string {
  return INTENT_QUESTION[intent];
}

export function isMalayalam(text: string): boolean {
  return /[\u0D00-\u0D7F]/.test(text);
}

function clip(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > MAX_CHARS ? `${one.slice(0, MAX_CHARS - 1)}…` : one;
}

export function gatherEvidence(ds: Dataset, schemeId: string, intent: Intent, lang: Lang): Passage[] {
  const scheme = ds.schemes.find((s) => s.id === schemeId);
  if (!scheme) return [];
  const raw: Omit<Passage, "n">[] = [];
  const seen = new Set<string>();
  const fromRef = (label: string, ref: SourceRef | undefined, prefix = "") => {
    if (!ref?.quote?.trim()) return;
    const text = clip(prefix ? `${prefix} ${ref.quote}` : ref.quote);
    if (seen.has(text)) return;
    seen.add(text);
    const src = ds.sources.find((s) => s.id === ref.sourceId);
    raw.push({
      label,
      text,
      sourceId: ref.sourceId,
      sourceTitle: src?.title,
      authority: src?.authority,
      locator: ref.locator,
      url: src?.url || undefined,
    });
  };
  const summary = () => {
    const text = clip(pick(scheme.summary, lang));
    if (text && !seen.has(text)) {
      seen.add(text);
      raw.push({ label: lang === "ml" ? "പദ്ധതി ചുരുക്കം" : "Scheme summary", text });
    }
  };
  const conditions = () => {
    for (const leaf of leavesOf(scheme.rule)) fromRef(lang === "ml" ? "വ്യവസ്ഥ" : "Condition", leaf.source);
  };

  if (intent === "what") {
    summary();
    conditions();
  } else if (intent === "who") {
    conditions();
  } else if (intent === "documents") {
    for (const d of scheme.documents) {
      const def = ds.documents.find((x) => x.id === d.docId);
      const name = def ? pick(def.name, lang) : d.docId;
      if (d.source?.quote) fromRef(name, d.source);
      else if (!seen.has(name)) {
        seen.add(name);
        raw.push({ label: name, text: clip(name), sourceId: def?.sourceId });
      }
    }
  } else {
    for (const a of scheme.apply) {
      const place = pick(ds.locationTypes.find((x) => x.id === a.locationType)?.label, lang) || a.locationType;
      const note = a.note ? ` ${pick(a.note, lang)}` : "";
      if (a.source?.quote) fromRef(place, a.source, `${place}.${note}`);
      else {
        const text = clip(`${place}.${note}`);
        if (!seen.has(text)) {
          seen.add(text);
          raw.push({ label: place, text });
        }
      }
    }
  }
  return raw.slice(0, MAX_PASSAGES).map((p, i) => ({ ...p, n: i + 1 }));
}

const ML_DIGITS = "൦൧൨൩൪൫൬൭൮൯";

export function asciiDigits(s: string): string {
  return s.replace(/[൦-൯]/g, (d) => String(ML_DIGITS.indexOf(d)));
}

export function numbersIn(text: string): string[] {
  const cleaned = asciiDigits(text).replace(/\[\d+(?:\s*,\s*\d+)*\]/g, " ");
  return (cleaned.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((m) => m.replace(/,/g, "").replace(/\.0+$/, "")).filter(Boolean);
}

const PROMISE = /\b(you are eligible|you will (get|receive)|guaranteed?|you qualify|definitely)\b/i;

export interface Grounding {
  ok: boolean;
  reasons: string[];
}

export function checkGrounding(answer: string, passages: Passage[]): Grounding {
  const reasons: string[] = [];
  const text = answer.trim();
  if (!text) reasons.push("empty");
  if (text.length > 900) reasons.push("too_long");
  const cites = [...text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) => m[1].split(",").map((x) => Number(x.trim())));
  if (cites.length === 0) reasons.push("no_citation");
  if (cites.some((c) => c < 1 || c > passages.length)) reasons.push("bad_citation");
  const allowed = new Set(passages.flatMap((p) => numbersIn(p.text)));
  const stray = numbersIn(text).filter((n) => !allowed.has(n));
  if (stray.length) reasons.push(`number_not_in_sources:${[...new Set(stray)].join(",")}`);
  if (PROMISE.test(text)) reasons.push("promises_benefit");
  return { ok: reasons.length === 0, reasons };
}

export function buildPrompt(scheme: Scheme, intent: Intent, lang: Lang, passages: Passage[]): { system: string; user: string } {
  const language = lang === "ml" ? "Malayalam" : "English";
  const system = [
    "You rewrite official Kerala Government welfare-scheme text into plain language for a family that may have little reading practice.",
    "Use only the numbered quotes you are given. Do not add any fact, amount, age, deadline, office or document that is not in them.",
    "End every sentence with the number of the quote it comes from, in square brackets, like [2].",
    "Copy every amount, age and number exactly as it is written in the quotes.",
    "You do not know this family's answers. Never say whether they qualify, will get money, or are approved.",
    "At most four short sentences.",
    `Write in ${language}.`,
    "If the quotes do not answer the question, reply with exactly: NOT_IN_SOURCES",
  ].join("\n");
  const user = [
    `Scheme: ${scheme.name.en}`,
    `Question: ${intentQuestion(intent)}`,
    "Quotes:",
    ...passages.map((p) => `[${p.n}] (${p.label}${p.sourceTitle ? `; ${p.sourceTitle}` : ""}${p.locator ? `, ${p.locator}` : ""}) ${p.text}`),
  ].join("\n");
  return { system, user };
}
