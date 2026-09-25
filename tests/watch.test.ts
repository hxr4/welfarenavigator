import { describe, expect, it } from "vitest";
import datasetJson from "../data/dataset.json";
import type { Dataset, Leaf } from "../lib/engine/types";
import { analyse, isTrackable, locateQuote, quoteRefs, squash, valueChange, type QuoteRef } from "../lib/watch/impact";
import { htmlToText, lineChanges, normalizeText } from "../lib/watch/text";
import { sourceFlag } from "../lib/watch/flags";

const ds = datasetJson as unknown as Dataset;
const leaf = (value: number): Leaf => ({ id: "c1", fact: "annual_family_income", op: "lt", value }) as unknown as Leaf;
const ref = (quote: string, l?: Leaf): QuoteRef => ({ ref: "S/c1", schemeId: "S", kind: "condition", sourceId: "SRC", quote, leaf: l });

describe("text extraction", () => {
  it("keeps page content and drops scripts, navigation and markup", () => {
    const html = `<html><body><nav>Home | Menu</nav><main><h1>Scheme</h1><p>Income below Rs.&nbsp;50,000&#47;-</p><script>var x=1</script></main><footer>©</footer></body></html>`;
    expect(htmlToText(html)).toBe("Scheme\nIncome below Rs. 50,000/-");
  });
  it("normalises Malayalam digits and whitespace", () => {
    expect(normalizeText("  ൫൦,൦൦൦   രൂപ \r\n\n x ")).toBe("50,000 രൂപ\nx");
  });
  it("lists added and removed lines", () => {
    expect(lineChanges("a\nb", "b\nc")).toEqual({ added: ["c"], removed: ["a"] });
  });
});

describe("quote tracking", () => {
  const page = "Scheme details.\nAnnual family income must be below Rs. 50,000/- per year.\nApply at the Fisheries Office.";
  it("finds a quote regardless of punctuation, case and spacing", () => {
    expect(locateQuote("annual family income must be below Rs 50000", page).kind).toBe("exact");
    expect(squash("Rs. 50,000/-")).toBe("rs 50000");
  });
  it("classifies an unchanged quote", () => {
    expect(analyse([ref("Annual family income must be below Rs. 50,000/- per year.", leaf(50000))], page)[0].kind).toBe("unchanged");
  });
  it("detects a threshold change and proposes the new value", () => {
    const edited = page.replace("50,000", "60,000");
    const [f] = analyse([ref("Annual family income must be below Rs. 50,000/- per year.", leaf(50000))], edited);
    expect(f.kind).toBe("value_change");
    expect([f.oldValue, f.newValue]).toEqual([50000, 60000]);
  });
  it("treats a number change that is not the rule's value as needing review", () => {
    const [f] = analyse([ref("Annual family income must be below Rs. 50,000/- per year.", leaf(40000))], page.replace("50,000", "60,000"));
    expect(f.kind).toBe("changed");
  });
  it("marks a small rewording with the same numbers as reworded", () => {
    const long = "Applicants must be registered members of the Welfare Fund Board for at least three years before applying for this benefit";
    const [f] = analyse([ref(long)], `x ${long.replace("registered members", "registered members,")} y`.replace("for this benefit", "for the benefit"));
    expect(f.kind).toBe("reworded");
  });
  it("marks a quote that disappeared as missing", () => {
    expect(analyse([ref("Members of cooperative societies affiliated to Matsyafed")], page)[0].kind).toBe("missing");
  });
  it("only proposes a value when every changed number was the rule's value", () => {
    expect(valueChange(leaf(50000), "below 50,000 for 3 years", "below 60,000 for 5 years")).toBeNull();
    expect(valueChange(leaf(50000), "below 50,000 for 3 years", "below 60,000 for 3 years")).toBe(60000);
  });
  it("only tracks quotes it can find verbatim, so unreadable PDFs raise no alarms", () => {
    expect(isTrackable("Annual family income must be below", page)).toBe(true);
    expect(isTrackable("മത്സ്യത്തൊഴിലാളികളുടെ പെൺമക്കളുടെ", "¦Õ¢¸¿À¤¦")).toBe(false);
  });
});

describe("dataset wiring", () => {
  it("every quotation in the dataset becomes a trackable reference", () => {
    const refs = quoteRefs(ds);
    expect(refs.length).toBeGreaterThan(100);
    expect(new Set(refs.map((r) => r.ref)).size).toBe(refs.length);
    for (const r of refs) expect(ds.sources.some((s) => s.id === r.sourceId)).toBe(true);
  });
  it("flags only the schemes listed in source-flags.json", () => {
    expect(sourceFlag("NOPE", {})).toBeNull();
    expect(sourceFlag("FISH-03", { "FISH-03": { since: "2026-09-25", sourceIds: ["SRC-FISH-001"], kinds: ["missing"] } })?.since).toBe("2026-09-25");
  });
});
