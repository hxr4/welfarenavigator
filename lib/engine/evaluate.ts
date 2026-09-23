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

function evalRange(op: string, v: number, lo: number, hi: number): Tri {
  switch (op) {
    case "lt":
      if (hi < v) return "T";
      if (lo >= v) return "F";
      return "U";
    case "lte":
      if (hi <= v) return "T";
      if (lo > v) return "F";
      return "U";
    case "gt":
      if (lo > v) return "T";
      if (hi <= v) return "F";
      return "U";
    case "gte":
      if (lo >= v) return "T";
      if (hi < v) return "F";
      return "U";
    case "eq":
      if (lo === v && hi === v) return "T";
      if (v < lo || v > hi) return "F";
      return "U";
    case "neq":
      if (lo === v && hi === v) return "F";
      if (v < lo || v > hi) return "T";
      return "U";
    default:
      throw new Error(`Operator ${op} is not valid for numbers`);
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

export function openLeaves(node: RuleNode, answers: Answers): Leaf[] {
  if (isLeaf(node)) return evalCondition(node, answers[node.fact]) === "U" ? [node] : [];
  if (evalNode(node, answers) !== "U") return [];
  if ("all" in node) return node.all.flatMap((c) => openLeaves(c, answers));
  if ("any" in node) return node.any.flatMap((c) => openLeaves(c, answers));
  return openLeaves(node.not, answers);
}
