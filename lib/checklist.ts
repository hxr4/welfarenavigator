import type { Dataset, L10n, SchemeResult, VerificationLevel } from "./engine/types";

export interface ChecklistSchemeRef {
  id: string;
  name: L10n;
}

export interface ChecklistDoc {
  docId: string;
  name: L10n;
  issuedBy?: L10n;
  schemes: ChecklistSchemeRef[];
  conditional: boolean;
}

export interface ChecklistApply {
  locationType: string;
  label: L10n;
  mode: "in_person" | "online" | "both";
  note?: L10n;
}

export interface ChecklistScheme {
  id: string;
  name: L10n;
  authority: L10n;
  documents: "verified" | "partial" | "not_published";
  apply: ChecklistApply[];
  applyVerification: VerificationLevel;
}

export interface Checklist {
  schemes: ChecklistScheme[];
  docs: ChecklistDoc[];
  withoutList: ChecklistSchemeRef[];
  partialList: ChecklistSchemeRef[];
}

export function buildChecklist(ds: Dataset, results: SchemeResult[]): Checklist {
  const eligible = results.filter((r) => r.status === "potentially_eligible");
  const docs = new Map<string, ChecklistDoc>();
  for (const r of eligible) {
    for (const d of r.documents) {
      const entry = docs.get(d.doc.id) ?? { docId: d.doc.id, name: d.doc.name, issuedBy: d.doc.issuedBy, schemes: [], conditional: true };
      if (!entry.schemes.some((s) => s.id === r.scheme.id)) entry.schemes.push({ id: r.scheme.id, name: r.scheme.name });
      entry.conditional = entry.conditional && d.conditional;
      docs.set(d.doc.id, entry);
    }
  }
  const schemes: ChecklistScheme[] = eligible.map((r) => ({
    id: r.scheme.id,
    name: r.scheme.name,
    authority: r.scheme.authority,
    documents: r.documents.length === 0 ? "not_published" : r.scheme.verification.documents === "verified" ? "verified" : "partial",
    applyVerification: r.scheme.verification.apply,
    apply: r.scheme.apply.map((a) => ({
      locationType: a.locationType,
      label: ds.locationTypes.find((x) => x.id === a.locationType)?.label ?? { en: a.locationType, ml: a.locationType },
      mode: a.mode,
      note: a.note,
    })),
  }));
  const ref = (s: ChecklistScheme): ChecklistSchemeRef => ({ id: s.id, name: s.name });
  return {
    schemes,
    docs: [...docs.values()].sort((a, b) => b.schemes.length - a.schemes.length || a.docId.localeCompare(b.docId)),
    withoutList: schemes.filter((s) => s.documents === "not_published").map(ref),
    partialList: schemes.filter((s) => s.documents === "partial").map(ref),
  };
}
