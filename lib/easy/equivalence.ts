import { nextQuestion } from "../engine/next-question";
import { parseAnswerMap } from "../engine/profile";
import { screenAll, statusMap } from "../engine/screen";
import type { Answer, Answers, Dataset, Fact, Profile, SchemeStatus } from "../engine/types";
import { answerFor, easyOptions, easyReducer, selectionFor, type EasyState } from "./options";

export type Picker = (fact: Fact, choices: Answer[], want: Answer | undefined) => Answer;

export const standardPick: Picker = (fact, choices, want) => {
  if (!want || want.kind === "unknown") return { kind: "unknown" };
  if (want.kind === "declined") return want;
  if (fact.type === "number") {
    if (want.kind !== "range") return { kind: "unknown" };
    return choices.find((c) => c.kind === "range" && want.lo >= c.lo && want.lo <= c.hi) ?? { kind: "unknown" };
  }
  return want;
};

export const easyPick: Picker = (fact, choices, want) => {
  const options = easyOptions(fact, choices, "ml", { allowUnknown: true });
  const reduce = easyReducer(fact.type === "multi", options);
  let state: EasyState = { selected: [], speakingId: null };
  for (const o of options) {
    state = reduce(state, { type: "speaking", id: o.id });
    state = reduce(state, { type: "speaking", id: null });
  }
  for (const id of selectionFor(fact, options, standardPick(fact, choices, want))) state = reduce(state, { type: "select", id });
  return answerFor(fact, options, state.selected) ?? { kind: "unknown" };
};

export function drive(ds: Dataset, full: Answers, pick: Picker): Record<string, SchemeStatus> {
  const answers: Answers = {};
  for (let i = 0; i < 200; i++) {
    const q = nextQuestion(ds, answers);
    if (!q) break;
    answers[q.fact.id] = pick(q.fact, q.choices, full[q.fact.id]);
  }
  return statusMap(screenAll(ds, answers));
}

export function sameInBothModes(ds: Dataset, p: Profile): boolean {
  const full = parseAnswerMap(ds, p.answers);
  return JSON.stringify(drive(ds, full, standardPick)) === JSON.stringify(drive(ds, full, easyPick));
}
