import { INF } from "../engine/evaluate";
import type { Answer, Fact, L10n, Lang, Leaf, LeafValue } from "../engine/types";
import { t } from "./strings";

export const pick = (x: L10n | undefined, lang: Lang) => (x ? x[lang] || x.en : "");

function mlYears(fact: Pick<Fact, "id">): "age" | "duration" {
  return fact.id === "age" || fact.id.endsWith("_age") ? "age" : "duration";
}

export function formatNumber(n: number, unit: Fact["unit"], lang: Lang, fact?: Pick<Fact, "id">): string {
  const s = n.toLocaleString("en-IN");
  if (unit === "INR") return `₹${s}`;
  if (unit === "years") {
    if (lang !== "ml") return `${s} ${n === 1 ? "year" : "years"}`;
    return fact && mlYears(fact) === "duration" ? `${s} വർഷം` : `${s} വയസ്സ്`;
  }
  return s;
}

function mlMoreThan(fact: Fact, n: number): string {
  const s = n.toLocaleString("en-IN");
  if (fact.unit === "INR") return `₹${s}-ൽ കൂടുതൽ`;
  if (fact.unit === "years") return mlYears(fact) === "age" ? `${s} വയസ്സിൽ കൂടുതൽ` : `${s} വർഷത്തിൽ കൂടുതൽ`;
  return `${s}-ൽ കൂടുതൽ`;
}

function mlBetween(fact: Fact, lo: number, hi: number): string {
  const a = lo.toLocaleString("en-IN");
  const b = hi.toLocaleString("en-IN");
  if (fact.unit === "INR") return `₹${a} മുതൽ ₹${b} വരെ`;
  if (fact.unit === "years") return `${a} മുതൽ ${b} വരെ ${mlYears(fact) === "age" ? "വയസ്സ്" : "വർഷം"}`;
  return `${a} മുതൽ ${b} വരെ`;
}

export function rangeLabel(fact: Fact, lo: number, hi: number, lang: Lang): string {
  const f = (n: number) => formatNumber(n, fact.unit, lang, fact);
  if (lo === hi) return f(lo);
  if (hi >= INF) return lang === "ml" ? mlMoreThan(fact, lo - 1) : fact.unit === "INR" ? `More than ${f(lo - 1)}` : `${f(lo)} or more`;
  if (lo <= 0) return lang === "ml" ? `${f(hi)} വരെ` : `Up to ${f(hi)}`;
  if (lang === "ml") return mlBetween(fact, lo, hi);
  return fact.unit === "INR" ? `${f(lo)} to ${f(hi)}` : fact.unit === "years" ? `${lo.toLocaleString("en-IN")} to ${f(hi)}` : `${f(lo)} to ${f(hi)}`;
}

function optionLabel(fact: Fact, value: string, lang: Lang): string {
  const o = fact.options.find((x) => x.value === value);
  return o ? pick(o.label, lang) : value;
}

export function valueText(fact: Fact, value: LeafValue, lang: Lang): string {
  if (typeof value === "boolean") return t(value ? "yes" : "no", lang);
  if (typeof value === "number") return formatNumber(value, fact.unit, lang, fact);
  const vals = Array.isArray(value) ? value : [value];
  return vals.map((v) => optionLabel(fact, v, lang)).join(lang === "ml" ? " / " : " or ");
}

export function answerText(fact: Fact, answer: Answer | undefined, lang: Lang): string {
  if (!answer) return t("notAnswered", lang);
  if (answer.kind === "unknown") return t("dontKnow", lang);
  if (answer.kind === "declined") return t("preferNot", lang);
  if (answer.kind === "range") return rangeLabel(fact, answer.lo, answer.hi, lang);
  if (Array.isArray(answer.value)) {
    return answer.value.length ? answer.value.map((v) => optionLabel(fact, v, lang)).join(", ") : "—";
  }
  return valueText(fact, answer.value, lang);
}

const EN_OP: Record<string, string> = {
  eq: "",
  neq: "not ",
  lt: "less than ",
  lte: "at most ",
  gt: "more than ",
  gte: "at least ",
  in: "",
  not_in: "none of ",
  includes: "includes ",
  excludes: "does not include ",
};

const ML_OP: Record<string, string> = {
  eq: "",
  neq: " അല്ല",
  lt: "-ൽ കുറവ്",
  lte: " അല്ലെങ്കിൽ അതിൽ കുറവ്",
  gt: "-ൽ കൂടുതൽ",
  gte: " അല്ലെങ്കിൽ അതിൽ കൂടുതൽ",
  in: "",
  not_in: " ഇവയിൽ ഒന്നുമല്ല",
  includes: " ഉൾപ്പെടുന്നു",
  excludes: " ഉൾപ്പെടുന്നില്ല",
};

export function conditionText(leaf: Leaf, fact: Fact | undefined, lang: Lang): string {
  if (!fact) return `${leaf.fact} ${leaf.op} ${String(leaf.value)}`;
  const label = pick(fact.label, lang);
  const v = valueText(fact, leaf.value, lang);
  return lang === "ml" ? `${label}: ${v}${ML_OP[leaf.op]}` : `${label}: ${EN_OP[leaf.op]}${v}`;
}
