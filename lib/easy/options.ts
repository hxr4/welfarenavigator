import { INF } from "../engine/evaluate";
import type { Answer, Fact, Lang } from "../engine/types";
import { answerText, pick } from "../i18n/describe";
import { t } from "../i18n/strings";

export type OptionKind = "choice" | "unknown" | "declined";

export interface EasyOption {
  id: string;
  kind: OptionKind;
  label: string;
  clip?: string;
  answer?: Answer;
  value?: string;
}

export const EXCLUSIVE_VALUES = new Set(["none"]);

export function optionLabel(fact: Fact, choice: Answer, index: number, lang: Lang): string {
  if (fact.type === "boolean") return t(index === 0 ? "yes" : "no", lang);
  if (fact.type === "number") return answerText(fact, choice, lang);
  return pick(fact.options[index].label, lang);
}

export function bandClip(factId: string, choice: Answer): string | undefined {
  if (choice.kind !== "range") return undefined;
  return `option.${factId}.${choice.lo}-${choice.hi >= INF ? "plus" : choice.hi}`;
}

export function optionClip(fact: Fact, index: number, choice?: Answer): string | undefined {
  if (fact.type === "boolean") return index === 0 ? "option.yes" : "option.no";
  if (fact.type === "number") return choice ? bandClip(fact.id, choice) : undefined;
  return `option.${fact.id}.${fact.options[index].value}`;
}

export function easyOptions(fact: Fact, choices: Answer[], lang: Lang, opts: { allowUnknown?: boolean } = {}): EasyOption[] {
  const out: EasyOption[] = choices.map((c, i) => {
    const value = fact.type === "multi" ? fact.options[i].value : undefined;
    return {
      id: `c${i}`,
      kind: "choice",
      label: optionLabel(fact, c, i, lang),
      clip: optionClip(fact, i, c),
      answer: fact.type === "multi" ? undefined : c,
      value,
    };
  });
  if (opts.allowUnknown !== false) out.push({ id: "unknown", kind: "unknown", label: t("dontKnow", lang), clip: "option.unknown", answer: { kind: "unknown" } });
  if (fact.sensitivity === "high") out.push({ id: "declined", kind: "declined", label: t("preferNot", lang), clip: "option.declined", answer: { kind: "declined" } });
  return out;
}

export interface EasyState {
  selected: string[];
  speakingId: string | null;
}

export type EasyAction = { type: "speaking"; id: string | null } | { type: "select"; id: string } | { type: "reset"; selected: string[] };

export function easyReducer(multi: boolean, options: EasyOption[]) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const exclusive = (id: string) => {
    const o = byId.get(id);
    return !!o && (o.kind !== "choice" || (o.value !== undefined && EXCLUSIVE_VALUES.has(o.value)));
  };
  return (state: EasyState, action: EasyAction): EasyState => {
    switch (action.type) {
      case "speaking":
        return { ...state, speakingId: action.id };
      case "reset":
        return { selected: action.selected, speakingId: null };
      case "select": {
        if (!byId.has(action.id)) return state;
        if (!multi) return { selected: [action.id], speakingId: null };
        if (state.selected.includes(action.id)) return { selected: state.selected.filter((x) => x !== action.id), speakingId: null };
        if (exclusive(action.id)) return { selected: [action.id], speakingId: null };
        return { selected: [...state.selected.filter((x) => !exclusive(x)), action.id], speakingId: null };
      }
    }
  };
}

export function answerFor(fact: Fact, options: EasyOption[], selected: string[]): Answer | null {
  if (selected.length === 0) return null;
  const chosen = selected.map((id) => options.find((o) => o.id === id)).filter((o): o is EasyOption => !!o);
  if (chosen.length === 0) return null;
  const special = chosen.find((o) => o.kind !== "choice");
  if (special) return special.answer ?? null;
  if (fact.type === "multi") return { kind: "value", value: chosen.map((o) => o.value as string) };
  return chosen[0].answer ?? null;
}

function same(a: Answer, b: Answer): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function selectionFor(fact: Fact, options: EasyOption[], current: Answer | undefined): string[] {
  if (!current) return [];
  if (current.kind === "unknown") return options.some((o) => o.id === "unknown") ? ["unknown"] : [];
  if (current.kind === "declined") return options.some((o) => o.id === "declined") ? ["declined"] : [];
  if (fact.type === "multi" && current.kind === "value" && Array.isArray(current.value)) {
    const vals = current.value;
    return options.filter((o) => o.value !== undefined && vals.includes(o.value)).map((o) => o.id);
  }
  const hit = options.find((o) => o.answer && same(o.answer, current));
  return hit ? [hit.id] : [];
}
