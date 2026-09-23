import type { Answer, Answers, Condition, Leaf, LeafResult, RuleNode, Tri } from "./types";

export const INF = Number.MAX_SAFE_INTEGER;

export function isLeaf(node: RuleNode): node is Leaf {
  return (node as Leaf).fact !== undefined;
}

export function leavesOf(node: RuleNode): Leaf[] {
  if (isLeaf(node)) return [node];
  if ("all" in node) return node.all.flatMap(leavesOf);
  if ("any" in node) return node.any.flatMap(leavesOf);
  return leavesOf(node.not);
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

function normalizeNumeric(op: string, v: number): { op: "lte" | "gte" | "eq" | "neq"; v: number } {
  if (op === "lt") return { op: "lte", v: v - 1 };
  if (op === "gt") return { op: "gte", v: v + 1 };
  if (op === "lte" || op === "gte" || op === "eq" || op === "neq") return { op, v };
  throw new Error(`Operator ${op} is not valid for numbers`);
}

function evalRange(op: string, value: number, lo: number, hi: number): Tri {
  const n = normalizeNumeric(op, value);
  switch (n.op) {
    case "lte":
      if (hi <= n.v) return "T";
      if (lo > n.v) return "F";
      return "U";
    case "gte":
      if (lo >= n.v) return "T";
      if (hi < n.v) return "F";
      return "U";
    case "eq":
      if (lo === n.v && hi === n.v) return "T";
      if (n.v < lo || n.v > hi) return "F";
      return "U";
    case "neq":
      if (lo === n.v && hi === n.v) return "F";
      if (n.v < lo || n.v > hi) return "T";
      return "U";
  }
}

export function evalCondition(cond: Condition, answer: Answer | undefined): Tri {
  if (!answer || answer.kind === "unknown" || answer.kind === "declined") return "U";
  if (answer.kind === "range") {
    return evalRange(cond.op, Number(cond.value), answer.lo, answer.hi);
  }
  const given = answer.value;
  const target = cond.value;
  switch (cond.op) {
    case "eq":
      return String(given) === String(target) ? "T" : "F";
    case "neq":
      return String(given) !== String(target) ? "T" : "F";
    case "in":
      return asArray(target).includes(String(given)) ? "T" : "F";
    case "not_in":
      return asArray(target).includes(String(given)) ? "F" : "T";
    case "includes": {
      const have = asArray(given);
      return asArray(target).some((t) => have.includes(t)) ? "T" : "F";
    }
    case "excludes": {
      const have = asArray(given);
      return asArray(target).some((t) => have.includes(t)) ? "F" : "T";
    }
    default:
      if (typeof given === "number" || !isNaN(Number(given))) {
        const n = Number(given);
        return evalRange(cond.op, Number(target), n, n);
      }
      return "U";
  }
}

export function evalNode(node: RuleNode, answers: Answers): Tri {
  if (isLeaf(node)) return evalCondition(node, answers[node.fact]);
  if ("all" in node) {
    let unknown = false;
    for (const child of node.all) {
      const r = evalNode(child, answers);
      if (r === "F") return "F";
      if (r === "U") unknown = true;
    }
    return unknown ? "U" : "T";
  }
  if ("any" in node) {
    let unknown = false;
    for (const child of node.any) {
      const r = evalNode(child, answers);
      if (r === "T") return "T";
      if (r === "U") unknown = true;
    }
    return unknown ? "U" : "F";
  }
  const inner = evalNode(node.not, answers);
  return inner === "T" ? "F" : inner === "F" ? "T" : "U";
}

export function evalLeaves(node: RuleNode, answers: Answers): LeafResult[] {
  return leavesOf(node).map((leaf) => ({ leaf, result: evalCondition(leaf, answers[leaf.fact]) }));
}

export function isAnswered(answer: Answer | undefined): boolean {
  return answer !== undefined;
}

export function isKnown(answer: Answer | undefined): boolean {
  return answer !== undefined && answer.kind !== "unknown" && answer.kind !== "declined";
}
