import { INF } from "../engine/evaluate";
import type { Answer, Fact } from "../engine/types";

export type SpeechMatch = { kind: "choice"; indices: number[] } | { kind: "unknown" } | null;

const YES = ["yes", "yeah", "yep", "correct", "right", "haan", "അതെ", "ഉണ്ട്", "ആണ്", "ശരി", "അതേ", "ഉവ്വ്"];
const NO = ["no", "nope", "not", "illa", "alla", "അല്ല", "ഇല്ല", "വേണ്ട"];
const UNKNOWN = ["don't know", "dont know", "do not know", "not sure", "no idea", "അറിയില്ല", "ഉറപ്പില്ല", "അറിഞ്ഞുകൂടാ"];

const ML_DIGITS: Record<string, number> = {
  ഒന്ന്: 1, ഒരു: 1, രണ്ട്: 2, മൂന്ന്: 3, നാല്: 4, അഞ്ച്: 5, ആറ്: 6, ഏഴ്: 7, എട്ട്: 8, ഒമ്പത്: 9, പത്ത്: 10,
  "൦": 0, "൧": 1, "൨": 2, "൩": 3, "൪": 4, "൫": 5, "൬": 6, "൭": 7, "൮": 8, "൯": 9,
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[.,!?;:"'()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(text: string, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  return ` ${text} `.includes(` ${p} `) || (p.length > 3 && text.includes(p));
}

export function parseSpokenNumber(raw: string): number | null {
  let s = normalize(raw).replace(/(\d),(\d)/g, "$1$2");
  for (const [w, d] of Object.entries(ML_DIGITS)) s = s.split(w).join(` ${d} `);
  s = s.replace(/\s+/g, " ");
  const re = /(\d+(?:\.\d+)?)\s*(crore|കോടി|lakhs?|lacs?|ലക്ഷം|ലക്ഷത്തി|thousand|ആയിരം|ആയിരത്തി|hundred|നൂറ്)?/g;
  const mult: Record<string, number> = {
    crore: 1e7, കോടി: 1e7, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, ലക്ഷം: 1e5, ലക്ഷത്തി: 1e5,
    thousand: 1e3, ആയിരം: 1e3, ആയിരത്തി: 1e3, hundred: 100, നൂറ്: 100,
  };
  let total = 0;
  let found = false;
  for (const m of s.matchAll(re)) {
    found = true;
    total += Number(m[1]) * (m[2] ? mult[m[2]] : 1);
  }
  if (!found) {
    if (/ലക്ഷം|lakh/.test(s)) return 1e5;
    return null;
  }
  return Math.round(total);
}

export function matchSpeech(transcripts: string[], fact: Fact, choices: Answer[]): SpeechMatch {
  for (const raw of transcripts) {
    const text = normalize(raw);
    if (!text) continue;
    if (UNKNOWN.some((u) => hasPhrase(text, u))) return { kind: "unknown" };
    if (fact.type === "boolean") {
      const y = YES.some((w) => hasPhrase(text, w));
      const n = NO.some((w) => hasPhrase(text, w));
      if (y !== n) return { kind: "choice", indices: [y ? 0 : 1] };
      continue;
    }
    if (fact.type === "number") {
      const num = parseSpokenNumber(raw);
      if (num === null) continue;
      const idx = choices.findIndex((c) => c.kind === "range" && num >= c.lo && num <= (c.hi >= INF ? Infinity : c.hi));
      if (idx >= 0) return { kind: "choice", indices: [idx] };
      continue;
    }
    const hits: number[] = [];
    fact.options.forEach((o, i) => {
      const words = [o.label.en, o.label.ml, o.value.replace(/_/g, " "), ...o.synonyms.en, ...o.synonyms.ml];
      if (words.some((w) => hasPhrase(text, w))) hits.push(i);
    });
    if (hits.length && (fact.type === "multi" || hits.length === 1)) return { kind: "choice", indices: hits };
  }
  return null;
}
