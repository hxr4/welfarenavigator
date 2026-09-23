import { choicesFor } from "./bands";
import { evalNode, leavesOf } from "./evaluate";
import { isScreenable } from "./screen";
import type { Answers, Dataset, Fact, NextQuestion } from "./types";

const PENALTY = { low: 0, medium: 0.5, high: 1.5 } as const;

export function undecidedSchemes(dataset: Dataset, answers: Answers) {
  return dataset.schemes.filter((s) => isScreenable(s) && evalNode(s.rule, answers) === "U");
}

export function candidateFacts(dataset: Dataset, answers: Answers): Fact[] {
  const ids = new Set<string>();
  for (const s of undecidedSchemes(dataset, answers)) {
    for (const leaf of leavesOf(s.rule)) {
      if (answers[leaf.fact] === undefined) ids.add(leaf.fact);
    }
  }
  return dataset.facts.filter((f) => ids.has(f.id));
}

export function scoreFact(dataset: Dataset, answers: Answers, fact: Fact) {
  const undecided = undecidedSchemes(dataset, answers);
  const choices = choicesFor(fact, dataset.schemes);
  const resolved = choices.map(
    (c) => undecided.filter((s) => evalNode(s.rule, { ...answers, [fact.id]: c }) !== "U").length,
  );
  const min = resolved.length ? Math.min(...resolved) : 0;
  const mean = resolved.length ? resolved.reduce((a, b) => a + b, 0) / resolved.length : 0;
  return { score: min + 0.1 * mean - PENALTY[fact.sensitivity], choices };
}

export function nextQuestion(dataset: Dataset, answers: Answers): NextQuestion | null {
  const candidates = candidateFacts(dataset, answers);
  if (candidates.length === 0) return null;
  let best: { fact: Fact; score: number; choices: NextQuestion["choices"] } | null = null;
  for (const fact of candidates) {
    const { score, choices } = scoreFact(dataset, answers, fact);
    if (
      !best ||
      score > best.score + 1e-9 ||
      (Math.abs(score - best.score) <= 1e-9 && fact.order < best.fact.order)
    ) {
      best = { fact, score, choices };
    }
  }
  return best && { fact: best.fact, choices: best.choices, remainingUpperBound: candidates.length };
}

export function relevantFacts(dataset: Dataset): Set<string> {
  const ids = new Set<string>();
  for (const s of dataset.schemes) {
    if (!isScreenable(s)) continue;
    for (const leaf of leavesOf(s.rule)) ids.add(leaf.fact);
    for (const d of s.documents) if (d.when) ids.add(d.when.fact);
  }
  return ids;
}

export function pruneAnswers(dataset: Dataset, answers: Answers): Answers {
  const undecided = undecidedSchemes(dataset, answers);
  const neededByUndecided = new Set(undecided.flatMap((s) => leavesOf(s.rule).map((l) => l.fact)));
  const out: Answers = { ...answers };
  for (const factId of Object.keys(answers)) {
    if (neededByUndecided.has(factId)) continue;
    const without = { ...out };
    delete without[factId];
    const changed = dataset.schemes.some(
      (s) => isScreenable(s) && evalNode(s.rule, without) !== evalNode(s.rule, out),
    );
    const usedByDocs = dataset.schemes.some((s) => s.documents.some((d) => d.when?.fact === factId));
    if (!changed && !usedByDocs) delete out[factId];
  }
  return out;
}
