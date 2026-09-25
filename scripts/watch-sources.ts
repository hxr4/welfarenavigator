import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import datasetJson from "../data/dataset.json";
import type { Dataset } from "../lib/engine/types";
import { analyse, quoteRefs, type Finding, type QuoteRef } from "../lib/watch/impact";
import { htmlToText, lineChanges, normalizeText } from "../lib/watch/text";

const ds = datasetJson as unknown as Dataset;
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];
const workbookPath = args.find((a) => a.startsWith("--workbook="))?.split("=")[1] ?? "dataset/welfare-dataset.xlsx";

const STATE = "data/source-watch.json";
const FLAGS = "data/source-flags.json";
const REPORT = "docs/source-watch.md";
const SNAP_DIR = "sources/snapshots";
const OUT_DIR = ".source-watch";
const today = new Date().toISOString().slice(0, 10);
const now = new Date().toISOString();

interface SourceState {
  url: string;
  kind: "html" | "pdf";
  http: number;
  hash: string;
  checkedAt: string;
  changedAt: string;
  status: "baseline" | "unchanged" | "changed" | "unreachable";
  failures: number;
  tracked: string[];
  untracked: number;
  findings: Finding[];
  added?: string[];
  removed?: string[];
}
interface State {
  generatedAt: string;
  sources: Record<string, SourceState>;
}
interface Flag {
  since: string;
  sourceIds: string[];
  kinds: string[];
}

const readJson = <T,>(p: string, fallback: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : fallback);
const prevState = readJson<State>(STATE, { generatedAt: "", sources: {} });
const prevFlags = readJson<{ generatedAt: string; flags: Record<string, Flag> }>(FLAGS, { generatedAt: "", flags: {} });

async function fetchSource(url: string): Promise<{ http: number; text: string; kind: "html" | "pdf" }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "WelfareNavigatorSourceWatch/1.0 (+https://github.com/hxr4/welfarenavigator)" } });
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) return { http: res.status, text: "", kind: "html" };
    const isPdf = /pdf/i.test(res.headers.get("content-type") ?? "") || buf.subarray(0, 5).toString() === "%PDF-";
    if (!isPdf) return { http: res.status, text: htmlToText(buf.toString("utf8")), kind: "html" };
    const dir = mkdtempSync(join(tmpdir(), "sw-"));
    try {
      writeFileSync(join(dir, "f.pdf"), buf);
      const out = execFileSync("pdftotext", ["-enc", "UTF-8", join(dir, "f.pdf"), "-"], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
      return { http: res.status, text: normalizeText(out), kind: "pdf" };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    return { http: 0, text: "", kind: "html" };
  } finally {
    clearTimeout(timer);
  }
}

async function watch(): Promise<State> {
  mkdirSync(SNAP_DIR, { recursive: true });
  const refs = quoteRefs(ds);
  const state: State = { generatedAt: now, sources: {} };
  const targets = ds.sources.filter((s) => s.url && (!only || s.id === only));
  for (const s of ds.sources) if (!targets.includes(s) && prevState.sources[s.id]) state.sources[s.id] = prevState.sources[s.id];

  let next = 0;
  async function worker() {
    while (next < targets.length) {
      const src = targets[next++];
      const prev = prevState.sources[src.id];
      const r = await fetchSource(src.url!);
      const srcRefs = refs.filter((x) => x.sourceId === src.id);
      if (!r.text) {
        state.sources[src.id] = prev
          ? { ...prev, http: r.http, checkedAt: now, status: "unreachable", failures: (prev.failures ?? 0) + 1 }
          : { url: src.url!, kind: r.kind, http: r.http, hash: "", checkedAt: now, changedAt: "", status: "unreachable", failures: 1, tracked: [], untracked: srcRefs.length, findings: [] };
        console.log(`${src.id}: unreachable (${r.http})`);
        continue;
      }
      const hash = createHash("sha256").update(r.text).digest("hex");
      const snapPath = join(SNAP_DIR, `${src.id}.txt`);
      const before = existsSync(snapPath) ? readFileSync(snapPath, "utf8") : "";
      writeFileSync(snapPath, r.text + "\n");
      const priorTracked = new Set(prev?.tracked ?? []);
      const exactNow = new Set(analyse(srcRefs, r.text).filter((f) => f.kind === "unchanged").map((f) => f.ref));
      const tracked = srcRefs.filter((x) => priorTracked.has(x.ref) || exactNow.has(x.ref));
      const findings = analyse(tracked, r.text).filter((f) => f.kind !== "unchanged");
      const changed = Boolean(prev?.hash) && prev.hash !== hash;
      const diff = changed && before ? lineChanges(before.trim(), r.text, 15) : undefined;
      state.sources[src.id] = {
        url: src.url!,
        kind: r.kind,
        http: r.http,
        hash,
        checkedAt: now,
        changedAt: changed ? now : prev?.changedAt || (prev ? "" : now),
        status: !prev?.hash ? "baseline" : changed ? "changed" : "unchanged",
        failures: 0,
        tracked: tracked.map((x) => x.ref).sort(),
        untracked: srcRefs.length - tracked.length,
        findings,
        ...(diff ? { added: diff.added, removed: diff.removed } : {}),
      };
      console.log(`${src.id}: ${state.sources[src.id].status}, ${tracked.length}/${srcRefs.length} quotes tracked, ${findings.length} findings`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  return state;
}

function buildFlags(state: State): Record<string, Flag> {
  const flags: Record<string, Flag> = {};
  for (const [sid, s] of Object.entries(state.sources)) {
    for (const f of s.findings) {
      if (f.kind === "reworded") continue;
      const fl = (flags[f.schemeId] ??= { since: prevFlags.flags[f.schemeId]?.since ?? today, sourceIds: [], kinds: [] });
      if (!fl.sourceIds.includes(sid)) fl.sourceIds.push(sid);
      if (!fl.kinds.includes(f.kind)) fl.kinds.push(f.kind);
    }
  }
  return flags;
}

function report(state: State, flags: Record<string, Flag>): string {
  const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 220);
  const rows = Object.entries(state.sources).sort(([a], [b]) => a.localeCompare(b));
  const all = rows.flatMap(([, s]) => s.findings);
  const lines = [
    "# Source watch",
    "",
    `Generated by \`npm run watch:sources\` on ${state.generatedAt.slice(0, 16).replace("T", " ")} UTC. Each official source is fetched, reduced to plain text, and every quotation the dataset relies on is looked up in it. A quotation is *tracked* once it has been found verbatim; only tracked quotations can raise a flag, so unreadable legacy-font PDFs do not cause false alarms.`,
    "",
    "| Finding | Meaning | What happens |",
    "|---|---|---|",
    "| reworded | Same words and numbers, small wording change | Quote updated automatically |",
    "| value_change | Only a threshold number changed | Proposed as a rule update; scheme shows a caution until merged |",
    "| changed | Wording changed around the quote | Needs a person; scheme shows a caution |",
    "| missing | Quote no longer on the page | Needs a person; scheme shows a caution |",
    "",
    `Schemes currently showing a caution: ${Object.keys(flags).length ? Object.keys(flags).sort().join(", ") : "none"}.`,
    "",
    "## Sources",
    "",
    "| Source | Status | Quotes tracked | Last change | Kind |",
    "|---|---|---|---|---|",
    ...rows.map(([id, s]) => `| ${id} | ${s.status}${s.failures > 1 ? ` (${s.failures}×)` : ""} | ${s.tracked.length}/${s.tracked.length + s.untracked} | ${s.changedAt ? s.changedAt.slice(0, 10) : "-"} | ${s.kind} |`),
    "",
    `## Findings (${all.length})`,
    "",
  ];
  if (all.length === 0) lines.push("None.");
  else {
    lines.push("| Ref | Kind | Match | Detail |", "|---|---|---|---|");
    for (const f of all) {
      const detail = f.kind === "value_change" ? `${f.fact}: ${f.oldValue} → ${f.newValue}` : f.newQuote ? `now reads: ${esc(f.newQuote)}` : "not found";
      lines.push(`| ${f.ref} | ${f.kind} | ${Math.round(f.score * 100)}% | ${esc(detail)} |`);
    }
  }
  const changed = rows.filter(([, s]) => s.status === "changed" && (s.added?.length || s.removed?.length));
  if (changed.length) {
    lines.push("", "## Text changes", "");
    for (const [id, s] of changed) {
      lines.push(`### ${id}`, "", "```diff", ...(s.removed ?? []).map((l) => `- ${l.slice(0, 200)}`), ...(s.added ?? []).map((l) => `+ ${l.slice(0, 200)}`), "```", "");
    }
  }
  return lines.join("\n") + "\n";
}

function applyToWorkbook(findings: Finding[], refs: QuoteRef[]): number {
  const safe = findings.filter((f) => f.kind === "reworded" || f.kind === "value_change");
  if (!safe.length) return 0;
  const rows: Record<string, unknown>[] = [];
  const sources = new Set<string>();
  for (const f of safe) {
    const ref = refs.find((r) => r.ref === f.ref);
    if (!ref || !f.newQuote) continue;
    sources.add(f.sourceId);
    if (ref.kind === "condition") {
      const set: Record<string, unknown> = { quote: f.newQuote, reviewed_by: "SOURCE_WATCH" };
      if (f.kind === "value_change") set.value = f.newValue;
      rows.push({ sheet: "conditions", scheme_id: ref.schemeId, condition_id: ref.leaf!.id, set });
    } else if (ref.kind === "document") {
      rows.push({ sheet: "scheme_documents", scheme_id: ref.schemeId, doc_id: ref.ref.split("/doc:")[1], set: { quote: f.newQuote } });
    } else {
      rows.push({ sheet: "scheme_apply", scheme_id: ref.schemeId, index: Number(ref.ref.split("/apply:")[1]), set: { quote: f.newQuote } });
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const editsPath = join(OUT_DIR, "edits.json");
  writeFileSync(editsPath, JSON.stringify({ date: today, sources: [...sources], rows }, null, 1));
  const out = execFileSync("python3", ["scripts/apply-workbook-edits.py", editsPath, workbookPath]).toString();
  return (JSON.parse(out) as { applied: number }).applied;
}

async function main() {
  if (apply) {
    const state = prevState;
    const findings = Object.values(state.sources).flatMap((s) => s.findings);
    const applied = applyToWorkbook(findings, quoteRefs(ds));
    const safe = new Set(findings.filter((f) => f.kind === "reworded" || f.kind === "value_change").map((f) => f.ref));
    for (const s of Object.values(state.sources)) s.findings = s.findings.filter((f) => !safe.has(f.ref));
    const flags = buildFlags(state);
    writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");
    writeFileSync(FLAGS, JSON.stringify({ generatedAt: now, flags }, null, 1) + "\n");
    writeFileSync(REPORT, report(state, flags));
    console.log(JSON.stringify({ applied }));
    return;
  }
  const state = await watch();
  const flags = buildFlags(state);
  writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");
  writeFileSync(FLAGS, JSON.stringify({ generatedAt: now, flags }, null, 1) + "\n");
  writeFileSync(REPORT, report(state, flags));
  const findings = Object.values(state.sources).flatMap((s) => s.findings);
  const outcome = {
    changedSources: Object.entries(state.sources).filter(([, s]) => s.status === "changed").map(([id]) => id),
    proposals: findings.filter((f) => f.kind === "reworded" || f.kind === "value_change").length,
    valueChanges: findings.filter((f) => f.kind === "value_change").length,
    needsReview: findings.filter((f) => f.kind === "changed" || f.kind === "missing").length,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "outcome.json"), JSON.stringify(outcome, null, 1));
  console.log(JSON.stringify(outcome));
}

main();
