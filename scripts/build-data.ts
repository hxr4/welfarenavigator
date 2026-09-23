import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { SHEETS } from "../lib/data/sheets";
import { validateDataset } from "../lib/data/validate";
import type {
  Condition,
  Dataset,
  Fact,
  FactType,
  L10n,
  Leaf,
  LeafValue,
  Op,
  Profile,
  RuleNode,
  Scheme,
  SchemeApply,
  SchemeDocument,
  SchemeStatus,
  VerificationLevel,
} from "../lib/engine/types";

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--")) ?? "dataset/anavandi-dataset.xlsx";
const includeExamples = args.includes("--examples");
const force = args.includes("--force");

type Row = Record<string, string> & { __row: string };
const errors: string[] = [];

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
    if ("result" in v) return String((v as { result: unknown }).result ?? "");
    return "";
  }
  return String(v);
}

async function readRows(wb: ExcelJS.Workbook, name: string): Promise<Row[]> {
  const spec = SHEETS.find((s) => s.name === name)!;
  const ws = wb.getWorksheet(name);
  if (!ws) {
    errors.push(`Sheet "${name}" is missing`);
    return [];
  }
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => (headers[col] = text(cell.value).trim()));
  const rows: Row[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const obj = { __row: `${name} row ${n}` } as Row;
    let any = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const t = text(row.getCell(col).value).trim();
      obj[h] = t;
      if (t) any = true;
    });
    if (!any) return;
    const first = obj[spec.columns[0].key] ?? "";
    if (!includeExamples && first.startsWith("EXAMPLE")) return;
    for (const c of spec.columns) {
      const val = obj[c.key] ?? "";
      if (c.required && !val) errors.push(`${obj.__row}: "${c.key}" is required`);
      if (val && c.allowed && !c.allowed.includes(val)) errors.push(`${obj.__row}: "${c.key}" must be one of ${c.allowed.filter(Boolean).join(", ")} (found "${val}")`);
    }
    rows.push(obj);
  });
  return rows;
}

const l10n = (en?: string, ml?: string): L10n => ({ en: en ?? "", ml: ml ?? "" });
const opt = (en?: string, ml?: string): L10n | undefined => (en || ml ? l10n(en, ml) : undefined);
const list = (s?: string) => (s ?? "").split("|").map((x) => x.trim()).filter(Boolean);
const yes = (s?: string) => ["yes", "y", "true", "1"].includes((s ?? "").toLowerCase());

function parseValue(fact: Fact | undefined, op: Op, raw: string, where: string): LeafValue {
  if (!fact) return raw;
  const t: FactType = fact.type;
  if (t === "boolean") {
    const l = raw.toLowerCase();
    if (["yes", "true", "y", "1"].includes(l)) return true;
    if (["no", "false", "n", "0"].includes(l)) return false;
    errors.push(`${where}: value must be yes or no`);
    return raw;
  }
  if (t === "number") {
    const n = Number(raw.replace(/[,\s]/g, ""));
    if (!Number.isFinite(n)) errors.push(`${where}: value must be a number`);
    return n;
  }
  const parts = list(raw.replace(/,/g, "|"));
  if (op === "in" || op === "not_in" || op === "includes" || op === "excludes") return parts;
  return parts[0] ?? raw;
}

function parsePairs(s: string, where: string, sep = "="): [string, string][] {
  return s
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(sep);
      if (i < 0) {
        errors.push(`${where}: "${p}" should look like key${sep}value`);
        return ["", ""] as [string, string];
      }
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()] as [string, string];
    })
    .filter(([k]) => k);
}

const STATUS_ALIASES: Record<string, SchemeStatus> = {
  potentially_eligible: "potentially_eligible",
  eligible: "potentially_eligible",
  needs_information: "needs_information",
  needs_info: "needs_information",
  not_matched: "not_matched",
  informational: "informational",
};

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(input);
  const r = Object.fromEntries(await Promise.all(SHEETS.map(async (s) => [s.name, await readRows(wb, s.name)] as const)));

  const facts: Fact[] = r.facts.map((f: Row) => ({
    id: f.fact_id,
    type: f.type as FactType,
    label: l10n(f.label_en, f.label_ml),
    question: l10n(f.question_en, f.question_ml),
    help: opt(f.help_en, f.help_ml),
    unit: (f.unit || "") as Fact["unit"],
    sensitivity: (f.sensitivity || "low") as Fact["sensitivity"],
    order: Number(f.ask_order) || 99,
    audioMl: f.audio_ml || undefined,
    options: r.options
      .filter((o: Row) => o.fact_id === f.fact_id)
      .map((o: Row) => ({
        value: o.value,
        label: l10n(o.label_en, o.label_ml),
        synonyms: { en: list(o.synonyms_en), ml: list(o.synonyms_ml) },
        icon: o.icon || undefined,
      })),
  }));
  for (const o of r.options) if (!facts.some((f) => f.id === o.fact_id)) errors.push(`${o.__row}: unknown fact "${o.fact_id}"`);

  const factOf = (id: string) => facts.find((f) => f.id === id);

  const schemes: Scheme[] = r.schemes.map((s: Row) => {
    const conds = r.conditions.filter((c: Row) => c.scheme_id === s.scheme_id);
    const groups = new Map<string, Leaf[]>();
    for (const c of conds) {
      const leaf: Leaf = {
        id: c.condition_id,
        fact: c.fact_id,
        op: c.op as Op,
        value: parseValue(factOf(c.fact_id), c.op as Op, c.value, c.__row),
        changeable: yes(c.changeable),
        howTo: opt(c.how_to_en, c.how_to_ml),
        source: c.source_id ? { sourceId: c.source_id, quote: c.quote, locator: c.locator || undefined } : undefined,
        reviewedBy: c.reviewed_by || undefined,
      };
      const g = c.group || "1";
      groups.set(g, [...(groups.get(g) ?? []), leaf]);
    }
    const all: RuleNode[] = [...groups.values()].map((leaves) => (leaves.length === 1 ? leaves[0] : { any: leaves }));
    const documents: SchemeDocument[] = r.scheme_documents
      .filter((d: Row) => d.scheme_id === s.scheme_id)
      .map((d: Row) => {
        let when: Condition | undefined;
        if (d.when_fact) {
          when = { fact: d.when_fact, op: (d.when_op || "eq") as Op, value: parseValue(factOf(d.when_fact), (d.when_op || "eq") as Op, d.when_value, d.__row) };
        }
        return { docId: d.doc_id, when, source: d.source_id ? { sourceId: d.source_id, quote: d.quote } : undefined };
      });
    const apply: SchemeApply[] = r.scheme_apply
      .filter((a: Row) => a.scheme_id === s.scheme_id)
      .map((a: Row) => ({
        locationType: a.type_id,
        mode: a.mode as SchemeApply["mode"],
        note: opt(a.note_en, a.note_ml),
        source: a.source_id ? { sourceId: a.source_id, quote: a.quote } : undefined,
      }));
    return {
      id: s.scheme_id,
      name: l10n(s.name_en, s.name_ml),
      authority: l10n(s.authority_en, s.authority_ml),
      category: s.category as Scheme["category"],
      summary: l10n(s.summary_en, s.summary_ml),
      verification: {
        eligibility: s.eligibility_verification as VerificationLevel,
        documents: s.documents_verification as VerificationLevel,
        apply: s.apply_verification as VerificationLevel,
      },
      rule: { all },
      documents,
      apply,
      lastVerified: s.last_verified || undefined,
      verifiedBy: s.verified_by || undefined,
      notes: s.notes || undefined,
    };
  });
  for (const c of r.conditions) if (!schemes.some((s) => s.id === c.scheme_id)) errors.push(`${c.__row}: unknown scheme "${c.scheme_id}"`);

  const profiles: Profile[] = r.profiles.map((p: Row) => {
    const expected: Record<string, SchemeStatus> = {};
    for (const [k, v] of parsePairs(p.expected, p.__row)) {
      const st = STATUS_ALIASES[v];
      if (!st) errors.push(`${p.__row}: unknown status "${v}"`);
      else expected[k] = st;
    }
    const expectedMissing: Record<string, string[]> = {};
    for (const [k, v] of parsePairs(p.expected_missing ?? "", p.__row, ":")) expectedMissing[k] = v.split(",").map((x) => x.trim()).filter(Boolean);
    return {
      id: p.profile_id,
      title: p.title,
      kind: p.kind as Profile["kind"],
      answers: Object.fromEntries(parsePairs(p.answers, p.__row)),
      expected,
      expectedOthers: p.expected_others ? STATUS_ALIASES[p.expected_others] : undefined,
      expectedMissing,
      writtenBy: p.written_by || undefined,
      notes: p.notes || undefined,
    };
  });

  const ds: Dataset = {
    meta: { generatedAt: new Date().toISOString(), includesExamples: includeExamples, version: "1" },
    sources: r.sources.map((s: Row) => ({
      id: s.source_id,
      tier: Number(s.tier) as 1 | 2 | 3,
      authority: s.authority,
      title: s.title,
      url: s.url,
      docType: s.doc_type,
      language: s.language,
      dateIssued: s.date_issued || undefined,
      accessedOn: s.accessed_on,
      localFile: s.local_file || undefined,
      notes: s.notes || undefined,
    })),
    facts,
    schemes,
    documents: r.documents.map((d: Row) => ({ id: d.doc_id, name: l10n(d.name_en, d.name_ml), issuedBy: opt(d.issued_by_en, d.issued_by_ml), sourceId: d.source_id || undefined })),
    locationTypes: r.location_types.map((t: Row) => ({ id: t.type_id, label: l10n(t.label_en, t.label_ml) })),
    locations: r.locations.map((l: Row) => ({
      id: l.location_id,
      type: l.type_id,
      name: l10n(l.name_en, l.name_ml),
      district: l.district,
      area: l.area || undefined,
      address: l.address || undefined,
      phone: l.phone || undefined,
      hours: l.hours || undefined,
      lat: l.lat ? Number(l.lat) : undefined,
      lng: l.lng ? Number(l.lng) : undefined,
      sourceId: l.source_id || undefined,
    })),
    terms: r.terminology.map((t: Row) => ({ id: t.term_id, en: t.en, ml: t.ml, context: t.context || undefined, sourceId: t.source_id || undefined })),
    profiles,
    disclaimer: Object.fromEntries(r.disclaimer.map((d: Row) => [d.key, l10n(d.en, d.ml)])),
  };

  const issues = errors.length ? [] : validateDataset(ds);
  for (const e of errors) console.error(`ERROR    ${e}`);
  for (const i of issues) console[i.level === "error" ? "error" : "warn"](`${i.level.toUpperCase().padEnd(9)}${i.where}: ${i.message}`);
  const bad = errors.length + issues.filter((i) => i.level === "error").length;
  console.log(`\n${ds.schemes.length} schemes (${ds.schemes.filter((s) => s.verification.eligibility === "verified").length} screenable), ${ds.facts.length} facts, ${ds.sources.length} sources, ${ds.profiles.length} profiles, ${ds.locations.length} locations`);
  if (bad && !force) {
    console.error(`\n${bad} error(s). data/dataset.json was NOT updated. Fix them or pass --force.`);
    process.exit(1);
  }
  mkdirSync("data", { recursive: true });
  writeFileSync("data/dataset.json", JSON.stringify(ds, null, 2));
  console.log("Wrote data/dataset.json");
}

main();
