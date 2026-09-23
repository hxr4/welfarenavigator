import type { Dataset, Fact, Leaf, Scheme } from "../lib/engine/types";

const l = (en: string) => ({ en, ml: en });
const src = { sourceId: "S1", quote: "fixture quote" };

const fact = (id: string, type: Fact["type"], order: number, opts: string[] = [], sensitivity: Fact["sensitivity"] = "low"): Fact => ({
  id,
  type,
  label: l(id),
  question: l(`${id}?`),
  sensitivity,
  order,
  unit: type === "number" ? "INR" : "",
  options: opts.map((v) => ({ value: v, label: l(v), synonyms: { en: [v], ml: [] } })),
});

const leaf = (id: string, f: string, op: Leaf["op"], value: Leaf["value"], changeable = false): Leaf => ({
  id,
  fact: f,
  op,
  value,
  changeable,
  howTo: changeable ? l(`do ${f}`) : undefined,
  source: src,
  reviewedBy: "T",
});

const scheme = (id: string, rule: Scheme["rule"], extra: Partial<Scheme> = {}): Scheme => ({
  id,
  name: l(id),
  authority: l("Fixture Board"),
  category: "fishing",
  summary: l("fixture"),
  verification: { eligibility: "verified", documents: "verified", apply: "verified" },
  rule,
  documents: [{ docId: "id_proof", source: src }],
  apply: [{ locationType: "office", mode: "in_person", source: src }],
  ...extra,
});

export function fixture(): Dataset {
  return {
    meta: { generatedAt: "", includesExamples: false, version: "test" },
    sources: [{ id: "S1", tier: 1, authority: "Fixture", title: "Fixture order", url: "https://example.org/x", docType: "government_order", language: "en", accessedOn: "2026-09-23" }],
    facts: [
      fact("livelihood", "multi", 1, ["fishing", "allied", "plantation"]),
      fact("fwf_member", "boolean", 2),
      fact("spwf_member", "boolean", 3),
      fact("annual_income", "number", 4),
      fact("age", "number", 5),
      fact("disability", "boolean", 6, [], "high"),
    ],
    schemes: [
      scheme("FX-01", {
        all: [
          leaf("c1", "livelihood", "includes", ["fishing", "allied"]),
          leaf("c2", "fwf_member", "eq", true, true),
          leaf("c3", "annual_income", "lte", 200000),
        ],
      }),
      scheme("FX-02", { all: [leaf("c1", "fwf_member", "eq", true, true), leaf("c2", "age", "gte", 60)] }),
      scheme("FX-03", { all: [leaf("c1", "livelihood", "includes", ["plantation"]), leaf("c2", "spwf_member", "eq", true, true)] }, { category: "plantation" }),
      scheme(
        "FX-04",
        { all: [leaf("c1", "livelihood", "includes", ["plantation"]), { any: [leaf("c2", "age", "gte", 60), leaf("c3", "disability", "eq", true)] }] },
        {
          category: "plantation",
          documents: [
            { docId: "id_proof", source: src },
            { docId: "disability_cert", when: { fact: "disability", op: "eq", value: true }, source: src },
          ],
        },
      ),
      scheme("FX-05", { all: [leaf("c1", "livelihood", "includes", ["fishing"])] }, { verification: { eligibility: "partial", documents: "partial", apply: "partial" } }),
    ],
    documents: [
      { id: "id_proof", name: l("ID proof") },
      { id: "disability_cert", name: l("Disability certificate") },
    ],
    locationTypes: [{ id: "office", label: l("Office") }],
    locations: [{ id: "L1", type: "office", name: l("Office 1"), district: "Ernakulam", sourceId: "S1" }],
    terms: [],
    profiles: [
      {
        id: "P1",
        title: "fisher member low income",
        kind: "standard",
        answers: { livelihood: "fishing", fwf_member: "yes", annual_income: "150000", age: "45" },
        expected: { "FX-01": "potentially_eligible", "FX-02": "not_matched" },
        expectedOthers: "not_matched",
        expectedMissing: {},
      },
      {
        id: "P2",
        title: "fisher member income unknown",
        kind: "incomplete",
        answers: { livelihood: "fishing", fwf_member: "yes", annual_income: "unknown", age: "30" },
        expected: {},
        expectedMissing: { "FX-01": ["annual_income"] },
      },
    ],
    disclaimer: { main: l("Potentially eligible only.") },
  };
}
