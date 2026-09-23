"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { validateDataset } from "@/lib/data/validate";
import { leavesOf } from "@/lib/engine/evaluate";
import { generatedChecks } from "@/lib/engine/generated-checks";
import { parseAnswerString, runProfile, type ProfileRun } from "@/lib/engine/profile";
import { screenAll } from "@/lib/engine/screen";
import type { Answers, Dataset, Lang, SchemeResult } from "@/lib/engine/types";
import { conditionText, pick } from "@/lib/i18n/describe";
import SchemeCard from "./SchemeCard";

const pct = (a: number, b: number) => `${a}/${b}`;

export default function Review({ ds }: { ds: Dataset }) {
  const [lang, setLang] = useState<Lang>("en");
  const [runs, setRuns] = useState<ProfileRun[]>(() => ds.profiles.map((p) => runProfile(ds, p)));
  const [gen, setGen] = useState(() => generatedChecks(ds));
  const [ranAt, setRanAt] = useState(() => new Date().toLocaleTimeString());
  const [custom, setCustom] = useState("");
  const [customResult, setCustomResult] = useState<{ answers: Answers; results: SchemeResult[] } | null>(null);
  const [customError, setCustomError] = useState("");
  const issues = useMemo(() => validateDataset(ds), [ds]);

  const screenable = ds.schemes.filter((s) => s.verification.eligibility === "verified");
  const byCat = (c: string) => screenable.filter((s) => s.category === c).length;
  const allLeaves = screenable.flatMap((s) => leavesOf(s.rule));
  const quoted = allLeaves.filter((l) => l.source?.quote).length;
  const reviewed = allLeaves.filter((l) => l.reviewedBy).length;
  const passedProfiles = runs.filter((r) => r.passed).length;
  const passedGen = gen.filter((g) => g.ok).length;
  const adaptiveOk = runs.filter((r) => r.adaptiveOk).length;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  function runAll() {
    setRuns(ds.profiles.map((p) => runProfile(ds, p)));
    setGen(generatedChecks(ds));
    setRanAt(new Date().toLocaleTimeString());
  }

  function runCustom() {
    setCustomError("");
    try {
      const answers = parseAnswerString(ds, custom);
      setCustomResult({ answers, results: screenAll(ds, answers) });
    } catch (e) {
      setCustomResult(null);
      setCustomError((e as Error).message);
    }
  }

  return (
    <div className="app review">
      <header className="topbar">
        <Link href="/" className="brand">
          ← Welfare Navigator
        </Link>
        <div className="lang">
          <button type="button" className={lang === "ml" ? "on" : ""} onClick={() => setLang("ml")}>
            മലയാളം
          </button>
          <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
            English
          </button>
        </div>
      </header>
      <main>
        <h1>Reviewer page</h1>
        <p className="muted" suppressHydrationWarning>
          Everything below is computed live in this browser from the same engine and dataset the citizen screen uses.
          Dataset built {new Date(ds.meta.generatedAt).toLocaleString()}.
        </p>
        {ds.meta.includesExamples && <p className="banner">Built with EXAMPLE rows. Not the real dataset.</p>}

        <section className="card">
          <h2>Verification</h2>
          <table className="kv">
            <tbody>
              <tr><th>Household profiles (hand-written from sources)</th><td className={passedProfiles === runs.length ? "ok" : "bad"}>{pct(passedProfiles, runs.length)} passed</td></tr>
              <tr><th>Adaptive flow gives the same result as full evaluation</th><td className={adaptiveOk === runs.length ? "ok" : "bad"}>{pct(adaptiveOk, runs.length)}</td></tr>
              <tr><th>Rule checks generated from every condition</th><td className={passedGen === gen.length ? "ok" : "bad"}>{pct(passedGen, gen.length)} passed</td></tr>
              <tr><th>Dataset errors</th><td className={errors.length ? "bad" : "ok"}>{errors.length}</td></tr>
              <tr><th>Dataset warnings</th><td>{warnings.length}</td></tr>
            </tbody>
          </table>
          <div className="row">
            <button type="button" className="btn primary" onClick={runAll}>Run all checks</button>
            <span className="small muted" suppressHydrationWarning>Last run {ranAt}</span>
          </div>
        </section>

        <section className="card">
          <h2>Dataset audit</h2>
          <table className="kv">
            <tbody>
              <tr><th>Screenable schemes</th><td>{screenable.length} ({byCat("fishing")} fishing, {byCat("plantation")} plantation, {byCat("both")} both)</td></tr>
              <tr><th>Display-only schemes (partial or informational)</th><td>{ds.schemes.length - screenable.length}</td></tr>
              <tr><th>Conditions with exact source quote</th><td>{pct(quoted, allLeaves.length)}</td></tr>
              <tr><th>Conditions cross-checked by a second person</th><td>{pct(reviewed, allLeaves.length)}</td></tr>
              <tr><th>Sources</th><td>{ds.sources.length} (tier 1: {ds.sources.filter((s) => s.tier === 1).length}, tier 2: {ds.sources.filter((s) => s.tier === 2).length}, tier 3: {ds.sources.filter((s) => s.tier === 3).length})</td></tr>
              <tr><th>Offices and centres</th><td>{ds.locations.length} in {new Set(ds.locations.map((l) => l.district)).size} districts</td></tr>
              <tr><th>Terminology entries</th><td>{ds.terms.length}</td></tr>
              <tr><th>Questions available</th><td>{ds.facts.length}</td></tr>
            </tbody>
          </table>
          <div className="scroll">
            <table className="grid">
              <thead>
                <tr><th>ID</th><th>Scheme</th><th>Type</th><th>Eligibility</th><th>Documents</th><th>Apply</th><th>Conditions</th><th>Checked</th></tr>
              </thead>
              <tbody>
                {ds.schemes.map((s) => {
                  const leaves = leavesOf(s.rule);
                  return (
                    <tr key={s.id}>
                      <td>
                        <details>
                          <summary>{s.id}</summary>
                          <ul className="plain small">
                            {leaves.map((l) => {
                              const src = ds.sources.find((x) => x.id === l.source?.sourceId);
                              return (
                                <li key={l.id}>
                                  <strong>{l.id}</strong> {conditionText(l, ds.facts.find((f) => f.id === l.fact), lang)}
                                  {l.source?.quote && <blockquote>{l.source.quote}</blockquote>}
                                  {src && (
                                    <a href={src.url} target="_blank" rel="noreferrer">
                                      {src.id} · tier {src.tier} · {src.title} ↗
                                    </a>
                                  )}
                                  {l.reviewedBy && <span className="muted"> · checked by {l.reviewedBy}</span>}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      </td>
                      <td>{pick(s.name, lang)}</td>
                      <td>{s.category}</td>
                      <td>{s.verification.eligibility}</td>
                      <td>{s.verification.documents}</td>
                      <td>{s.verification.apply}</td>
                      <td>{leaves.length}</td>
                      <td>{s.lastVerified} {s.verifiedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {issues.length > 0 && (
          <section className="card">
            <h2>Dataset issues</h2>
            <ul className="plain small">
              {issues.map((i, n) => (
                <li key={n} className={i.level === "error" ? "bad" : ""}>
                  <strong>{i.level}</strong> {i.where}: {i.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <h2>Household profiles</h2>
          {runs.length === 0 && <p className="muted">No profiles in the dataset yet.</p>}
          {runs.map((r) => (
            <details key={r.profile.id} className="profile">
              <summary>
                <span className={r.passed ? "ok" : "bad"}>{r.passed ? "PASS" : "FAIL"}</span> {r.profile.id} · {r.profile.kind} · {r.profile.title}
              </summary>
              {r.error && <p className="bad small">{r.error}</p>}
              <p className="small mono">
                {Object.entries(r.profile.answers).map(([k, v]) => `${k}=${v}`).join("; ")}
              </p>
              <p className="small muted">Questions the adaptive flow asked: {r.asked.join(" → ") || "none"}</p>
              {!r.adaptiveOk && <p className="bad small">Adaptive mismatch: {r.adaptiveMismatches.join(", ")}</p>}
              <div className="scroll">
                <table className="grid small">
                  <thead><tr><th>Scheme</th><th>Expected</th><th>Actual</th><th></th></tr></thead>
                  <tbody>
                    {r.checks.map((c, i) => (
                      <tr key={i} className={c.ok ? "" : "bad"}>
                        <td>{c.schemeId}</td><td>{c.expected}</td><td>{c.actual}</td><td>{c.ok ? "✓" : "✗"} {c.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.profile.notes && <p className="small muted">{r.profile.notes}</p>}
            </details>
          ))}
        </section>

        <section className="card">
          <h2>Try your own household</h2>
          <p className="small muted">
            One answer per line or separated by semicolons: <span className="mono">fact=value</span>. Use{" "}
            <span className="mono">unknown</span> for I don&apos;t know. Multi-choice: <span className="mono">fishing,plantation</span>.
          </p>
          <details className="small">
            <summary>Available facts</summary>
            <ul className="plain mono">
              {ds.facts.map((f) => (
                <li key={f.id}>
                  {f.id} ({f.type}{f.options.length ? `: ${f.options.map((o) => o.value).join(" | ")}` : ""})
                </li>
              ))}
            </ul>
          </details>
          <label htmlFor="custom-profile" className="sr-only">Household answers</label>
          <textarea id="custom-profile" rows={5} value={custom} onChange={(e) => setCustom(e.target.value)} className="mono" />
          <div className="row">
            <button type="button" className="btn primary" onClick={runCustom}>Screen this household</button>
          </div>
          {customError && <p className="bad">{customError}</p>}
          {customResult && (
            <>
              <table className="grid small">
                <tbody>
                  {customResult.results.map((r) => (
                    <tr key={r.scheme.id}><td>{r.scheme.id}</td><td>{r.status}</td><td>{r.missingFacts.join(", ")}</td></tr>
                  ))}
                </tbody>
              </table>
              {customResult.results.map((r) => (
                <SchemeCard key={r.scheme.id} ds={ds} result={r} answers={customResult.answers} lang={lang} district="" />
              ))}
            </>
          )}
        </section>

        <section className="card">
          <h2>API</h2>
          <p className="small">The same engine is available as a stateless endpoint. Requests are not logged or stored.</p>
          <pre className="mono small">{`curl -X POST /api/screen -H 'content-type: application/json' \\
  -d '{"answers":{"livelihood":"fishing","annual_income":"150000"}}'`}</pre>
        </section>
      </main>
    </div>
  );
}
