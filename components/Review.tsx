"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DISTRICTS } from "@/lib/data/districts";
import { validateDataset } from "@/lib/data/validate";
import { leavesOf } from "@/lib/engine/evaluate";
import { generatedChecks } from "@/lib/engine/generated-checks";
import { parseAnswerString, runProfile, type ProfileRun } from "@/lib/engine/profile";
import { isScreenable, screenAll } from "@/lib/engine/screen";
import type { Dataset, SchemeResult } from "@/lib/engine/types";
import { conditionText } from "@/lib/i18n/describe";
import { STRINGS } from "@/lib/i18n/strings";

const MARK = { T: "✓", F: "✗", U: "?" } as const;
const frac = (a: number, b: number) => `${a} / ${b}`;

function isReviewed(reviewedBy: string | undefined, verifiedBy: string | undefined) {
  return !!reviewedBy && !/pending/i.test(reviewedBy) && reviewedBy.trim() !== (verifiedBy ?? "").trim();
}

export default function Review({ ds }: { ds: Dataset }) {
  const [runs, setRuns] = useState<ProfileRun[]>(() => ds.profiles.map((p) => runProfile(ds, p)));
  const [gen, setGen] = useState(() => generatedChecks(ds));
  const [runCount, setRunCount] = useState(1);
  const [custom, setCustom] = useState("");
  const [customResult, setCustomResult] = useState<SchemeResult[] | null>(null);
  const [customError, setCustomError] = useState("");
  const issues = useMemo(() => validateDataset(ds), [ds]);

  const screenable = ds.schemes.filter(isScreenable);
  const partial = ds.schemes.filter((s) => s.verification.eligibility === "partial");
  const informational = ds.schemes.filter((s) => s.verification.eligibility === "informational");
  const leaves = screenable.flatMap((s) => leavesOf(s.rule).map((l) => ({ s, l })));
  const quoted = leaves.filter(({ l }) => l.source?.quote).length;
  const reviewed = leaves.filter(({ s, l }) => isReviewed(l.reviewedBy, s.verifiedBy)).length;
  const passed = runs.filter((r) => r.passed).length;
  const genPassed = gen.filter((g) => g.ok).length;
  const adaptiveOk = runs.filter((r) => r.adaptiveOk).length;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const mlUnreviewed = Object.values(STRINGS).filter((s) => !("mlReviewed" in s && s.mlReviewed)).length;
  const districtTypes = ds.locationTypes.filter((t) => t.scope !== "state");
  const stateTypes = ds.locationTypes.filter((t) => t.scope === "state");
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT ?? "unknown";
  const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";

  function runAll() {
    setRuns(ds.profiles.map((p) => runProfile(ds, p)));
    setGen(generatedChecks(ds));
    setRunCount((n) => n + 1);
  }

  function runCustom() {
    setCustomError("");
    try {
      setCustomResult(screenAll(ds, parseAnswerString(ds, custom)));
    } catch (e) {
      setCustomResult(null);
      setCustomError((e as Error).message);
    }
  }

  return (
    <div className="shell review">
      <header className="masthead">
        <div className="masthead-inner">
          <div>
            <p className="brand">Welfare Navigator · Reviewer page</p>
            <p className="brand-sub">ANAVANDI FutureBuild 2026 · PS-07</p>
          </div>
          <Link href="/" className="btn btn-small" style={{ color: "#fff", borderColor: "#fff", background: "transparent" }}>
            Citizen screen
          </Link>
        </div>
      </header>
      <main className="page" id="main">
        <p className="help">
          Everything here is computed live in this browser, from the same engine and dataset the citizen screen uses. Failures are shown, not hidden.
        </p>
        {ds.meta.includesExamples && <p className="notice">Built with EXAMPLE rows. Not the real dataset.</p>}

        <section className="panel" aria-labelledby="v-title">
          <h1 id="v-title">Verification</h1>
          <table className="kv">
            <tbody>
              <tr>
                <th>Household profiles (expected results written from sources)</th>
                <td className={passed === runs.length ? "ok" : "bad"}>{frac(passed, runs.length)} passed</td>
              </tr>
              <tr>
                <th>Adaptive questions reach the same result as the full profile</th>
                <td className={adaptiveOk === runs.length ? "ok" : "bad"}>{frac(adaptiveOk, runs.length)}</td>
              </tr>
              <tr>
                <th>Rule checks generated from every condition (limit −1, limit, limit +1, unknown)</th>
                <td className={genPassed === gen.length ? "ok" : "bad"}>{frac(genPassed, gen.length)} passed</td>
              </tr>
              <tr>
                <th>Dataset errors</th>
                <td className={errors.length ? "bad" : "ok"}>{errors.length}</td>
              </tr>
              <tr>
                <th>Dataset warnings</th>
                <td>{warnings.length}</td>
              </tr>
              <tr>
                <th>Build</th>
                <td className="mono">
                  commit {commit}
                  {builtAt ? ` · built ${builtAt}` : ""} · dataset {ds.meta.generatedAt}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={runAll}>
              Run all checks again
            </button>
            <span className="meta">Runs so far: {runCount}</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="d-title">
          <h2 id="d-title">Dataset</h2>
          <table className="kv">
            <tbody>
              <tr>
                <th>Schemes screened automatically (eligibility verified)</th>
                <td>
                  {screenable.length} ({screenable.filter((s) => s.category === "fishing").length} fishing, {screenable.filter((s) => s.category === "plantation").length} plantation)
                </td>
              </tr>
              <tr>
                <th>Schemes shown but not screened</th>
                <td>
                  {partial.length} partial, {informational.length} informational
                </td>
              </tr>
              <tr>
                <th>Screened conditions with an exact source quote</th>
                <td className={quoted === leaves.length ? "ok" : "bad"}>{frac(quoted, leaves.length)}</td>
              </tr>
              <tr>
                <th>Screened conditions cross-checked by a second person</th>
                <td className={reviewed === leaves.length ? "ok" : "bad"}>{frac(reviewed, leaves.length)}</td>
              </tr>
              <tr>
                <th>Screenable schemes with a published document list</th>
                <td>{frac(screenable.filter((s) => s.documents.length > 0).length, screenable.length)}</td>
              </tr>
              <tr>
                <th>Official sources</th>
                <td>
                  {ds.sources.length} (tier 1: {ds.sources.filter((s) => s.tier === 1).length}, tier 2: {ds.sources.filter((s) => s.tier === 2).length}, tier 3:{" "}
                  {ds.sources.filter((s) => s.tier === 3).length})
                </td>
              </tr>
              <tr>
                <th>Offices and centres</th>
                <td>{ds.locations.length}</td>
              </tr>
              <tr>
                <th>Interface strings with Malayalam not yet reviewed by a native speaker</th>
                <td className={mlUnreviewed ? "bad" : "ok"}>
                  {frac(mlUnreviewed, Object.keys(STRINGS).length)}
                </td>
              </tr>
            </tbody>
          </table>

          <h3>Schemes</h3>
          <div className="scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Scheme</th>
                  <th>Type</th>
                  <th>Eligibility</th>
                  <th>Documents</th>
                  <th>Apply</th>
                  <th>Conditions</th>
                  <th>Cross-checked</th>
                </tr>
              </thead>
              <tbody>
                {ds.schemes.map((s) => {
                  const ls = leavesOf(s.rule);
                  return (
                    <tr key={s.id}>
                      <td>
                        <details>
                          <summary>{s.id}</summary>
                          <ul className="list">
                            {ls.map((l) => {
                              const src = ds.sources.find((x) => x.id === l.source?.sourceId);
                              return (
                                <li key={l.id}>
                                  <strong>{l.id}</strong> {conditionText(l, ds.facts.find((f) => f.id === l.fact), "en")}
                                  {l.source?.quote && <blockquote>“{l.source.quote}”</blockquote>}
                                  {src && src.url && (
                                    <a href={src.url} target="_blank" rel="noreferrer noopener">
                                      {src.id} · tier {src.tier} · {src.title}
                                      {l.source?.locator ? ` · ${l.source.locator}` : ""}
                                    </a>
                                  )}
                                  <p className="meta">Reviewed by: {l.reviewedBy ?? "—"}</p>
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      </td>
                      <td>{s.name.en}</td>
                      <td>{s.category}</td>
                      <td>{s.verification.eligibility}</td>
                      <td>
                        {s.verification.documents} ({s.documents.length})
                      </td>
                      <td>{s.verification.apply}</td>
                      <td>{ls.length}</td>
                      <td>{frac(ls.filter((l) => isReviewed(l.reviewedBy, s.verifiedBy)).length, ls.length)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3>District coverage</h3>
          <p className="meta">
            State-level offices shown to every district: {stateTypes.map((t) => `${t.label.en} (${ds.locations.filter((l) => l.type === t.id).length})`).join(", ") || "none"}.
          </p>
          <div className="scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>District</th>
                  {districtTypes.map((t) => (
                    <th key={t.id}>{t.label.en}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DISTRICTS.map((d) => (
                  <tr key={d.id}>
                    <td>{d.en}</td>
                    {districtTypes.map((t) => {
                      const n = ds.locations.filter((l) => l.type === t.id && (l.district === d.id || (l.serves ?? []).includes(d.id))).length;
                      return (
                        <td key={t.id} className={n ? "" : "bad"}>
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Sources</h3>
          <div className="scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tier</th>
                  <th>Authority</th>
                  <th>Title</th>
                  <th>Accessed</th>
                </tr>
              </thead>
              <tbody>
                {ds.sources.map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{s.tier}</td>
                    <td>{s.authority}</td>
                    <td>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer noopener">
                          {s.title}
                        </a>
                      ) : (
                        <span>
                          {s.title} <span className="meta">(saved copy: {s.localFile})</span>
                        </span>
                      )}
                      {s.notes && <p className="meta">{s.notes}</p>}
                    </td>
                    <td>{s.accessedOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {issues.length > 0 && (
          <section className="panel" aria-labelledby="i-title">
            <h2 id="i-title">Dataset issues</h2>
            <ul className="list">
              {issues.map((i, n) => (
                <li key={n}>
                  <span className={i.level === "error" ? "bad" : ""}>{i.level}</span> {i.where}: {i.message}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel" aria-labelledby="p-title">
          <h2 id="p-title">Household profiles</h2>
          {runs.map((r) => (
            <details key={r.profile.id} className="profile" open={!r.passed}>
              <summary>
                <span className={r.passed ? "ok" : "bad"}>{r.passed ? "PASS" : "FAIL"}</span> {r.profile.id} · {r.profile.kind} · {r.profile.title}
              </summary>
              {r.error && <p className="bad">{r.error}</p>}
              <p className="mono">{Object.entries(r.profile.answers).map(([k, v]) => `${k}=${v}`).join("; ")}</p>
              <p className="meta">Questions the adaptive flow asked: {r.asked.join(" → ") || "none"}</p>
              {!r.adaptiveOk && <p className="bad">Adaptive mismatch: {r.adaptiveMismatches.join(", ")}</p>}
              <div className="scroll">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Scheme</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {r.checks.map((c, i) => (
                      <tr key={i} className={c.ok ? "" : "bad"}>
                        <td>{c.schemeId}</td>
                        <td>{c.expected}</td>
                        <td>{c.actual}</td>
                        <td>
                          {c.ok ? "✓" : "✗"} {c.note ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.profile.notes && <p className="meta">{r.profile.notes}</p>}
            </details>
          ))}
        </section>

        <section className="panel" aria-labelledby="c-title">
          <h2 id="c-title">Screen any household</h2>
          <p className="help">
            One answer per line or separated by semicolons, as <span className="mono">fact=value</span>. Use <span className="mono">unknown</span> for “I don&apos;t know”. Several
            choices: <span className="mono">fishing,plantation_worker</span>. Numbers can be exact (<span className="mono">age=61</span>).
          </p>
          <details>
            <summary>Available facts</summary>
            <ul className="list mono">
              {ds.facts.map((f) => (
                <li key={f.id}>
                  {f.id} ({f.type}
                  {f.options.length ? `: ${f.options.map((o) => o.value).join(" | ")}` : ""})
                </li>
              ))}
            </ul>
          </details>
          <label htmlFor="custom-profile" className="sr-only">
            Household answers
          </label>
          <textarea id="custom-profile" rows={5} value={custom} onChange={(e) => setCustom(e.target.value)} className="mono" />
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={runCustom}>
              Screen this household
            </button>
          </div>
          {customError && <p className="bad">{customError}</p>}
          {customResult && (
            <div className="scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Scheme</th>
                    <th>Status</th>
                    <th>Conditions</th>
                    <th>Missing</th>
                    <th>One step</th>
                  </tr>
                </thead>
                <tbody>
                  {customResult.map((r) => (
                    <tr key={r.scheme.id}>
                      <td>
                        {r.scheme.id} {r.scheme.name.en}
                      </td>
                      <td>{r.status}</td>
                      <td>
                        {r.leaves.map(({ leaf, result }) => (
                          <div key={leaf.id}>
                            {MARK[result]} {conditionText(leaf, ds.facts.find((f) => f.id === leaf.fact), "en")}
                          </div>
                        ))}
                      </td>
                      <td>{r.missingFacts.join(", ")}</td>
                      <td>{r.oneStep ? r.oneStep.leaf.fact : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel" aria-labelledby="a-title">
          <h2 id="a-title">API</h2>
          <p className="help">The same engine as a stateless endpoint. Request bodies are not logged or stored; responses are not cached.</p>
          <pre className="mono">{`curl -X POST <site>/api/screen -H 'content-type: application/json' \\
  -d '{"answers":{"livelihood":"fishing","active_fisher":"yes"}}'`}</pre>
        </section>
      </main>
    </div>
  );
}
