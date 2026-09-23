"use client";

import { useState } from "react";
import { checklist } from "@/lib/engine/screen";
import type { Answers, Dataset, Lang, SchemeResult, SchemeStatus } from "@/lib/engine/types";
import { pick } from "@/lib/i18n/describe";
import { t, type StringKey } from "@/lib/i18n/strings";
import SchemeCard from "./SchemeCard";

interface Props {
  ds: Dataset;
  results: SchemeResult[];
  answers: Answers;
  lang: Lang;
  previous?: Record<string, SchemeStatus> | null;
  onAnswerFact?: (factId: string) => void;
}

export default function Results({ ds, results, answers, lang, previous, onAnswerFact }: Props) {
  const districts = [...new Set(ds.locations.map((l) => l.district))].sort();
  const [district, setDistrict] = useState(districts.length === 1 ? districts[0] : "");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const hasCoords = ds.locations.some((l) => l.lat && l.lng);

  const eligible = results.filter((r) => r.status === "potentially_eligible");
  const needs = results.filter((r) => r.status === "needs_information");
  const oneStep = results.filter((r) => r.status === "not_matched" && r.oneStep);
  const notMatched = results.filter((r) => r.status === "not_matched" && !r.oneStep);
  const info = results.filter((r) => r.status === "informational");
  const docs = checklist(results);
  const changes = previous
    ? results.filter((r) => previous[r.scheme.id] && previous[r.scheme.id] !== r.status)
    : [];

  const card = (r: SchemeResult) => (
    <SchemeCard key={r.scheme.id} ds={ds} result={r} answers={answers} lang={lang} district={district} origin={origin} onAnswerFact={onAnswerFact} />
  );

  const checklistText = docs.map((d) => `☐ ${pick(d.name.name, lang)}`).join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(checklistText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="results">
      <section className="summary">
        <h2>
          {eligible.length === 0
            ? t("foundNone", lang)
            : eligible.length === 1
              ? t("foundOne", lang)
              : t("foundN", lang, { n: eligible.length })}
        </h2>
        {ds.disclaimer.main && <p className="disclaimer">{pick(ds.disclaimer.main, lang)}</p>}
      </section>

      {previous && (
        <section className="card changes">
          <h3>{t("changes", lang)}</h3>
          {changes.length === 0 ? (
            <p className="muted">{t("noChanges", lang)}</p>
          ) : (
            <ul className="plain">
              {changes.map((r) => (
                <li key={r.scheme.id}>
                  <strong>{pick(r.scheme.name, lang)}</strong>: {t(`st_${previous[r.scheme.id]}` as StringKey, lang)} → {t(`st_${r.status}` as StringKey, lang)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {ds.locations.length > 0 && (
        <div className="row filters">
          <label htmlFor="district">{t("district", lang)}</label>
          <select id="district" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">{t("allDistricts", lang)}</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {hasCoords && (
            <button
              type="button"
              className="btn small ghost"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  (p) => setOrigin({ lat: p.coords.latitude, lng: p.coords.longitude }),
                  () => setOrigin(null),
                  { timeout: 8000 },
                )
              }
            >
              📍 {lang === "ml" ? "അടുത്തുള്ളവ" : "Nearest to me"}
            </button>
          )}
        </div>
      )}

      {eligible.length > 0 && (
        <section>
          <h2 className="sec">{t("sec_eligible", lang)}</h2>
          {eligible.map(card)}
        </section>
      )}
      {needs.length > 0 && (
        <section>
          <h2 className="sec">{t("sec_needs", lang)}</h2>
          {needs.map(card)}
        </section>
      )}
      {oneStep.length > 0 && (
        <section>
          <h2 className="sec">{t("sec_onestep", lang)}</h2>
          <p className="muted">{t("sec_onestep_help", lang)}</p>
          {oneStep.map(card)}
        </section>
      )}

      {docs.length > 0 && (
        <section className="card checklist print-area">
          <h3>{t("checklist", lang)}</h3>
          <ul className="plain">
            {docs.map((d) => (
              <li key={d.docId}>
                ☐ {pick(d.name.name, lang)}
                {d.conditional && <span className="muted"> ({t("ifApplies", lang)})</span>}
                <span className="small muted">
                  {" "}
                  · {t("forSchemes", lang)}: {d.schemes.map((id) => pick(ds.schemes.find((s) => s.id === id)?.name, lang)).join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <p className="small muted">{t("checklistNote", lang)}</p>
          <div className="row no-print">
            <button type="button" className="btn" onClick={() => window.print()}>
              {t("print", lang)}
            </button>
            <button type="button" className="btn" onClick={copy}>
              {copied ? t("copied", lang) : t("copy", lang)}
            </button>
          </div>
        </section>
      )}

      {notMatched.length > 0 && (
        <details className="section-fold">
          <summary>
            {t("sec_not", lang)} · {t("showN", lang, { n: notMatched.length })}
          </summary>
          {notMatched.map(card)}
        </details>
      )}
      {info.length > 0 && (
        <details className="section-fold">
          <summary>
            {t("sec_info", lang)} · {t("showN", lang, { n: info.length })}
          </summary>
          <p className="muted">{t("sec_info_help", lang)}</p>
          {info.map(card)}
        </details>
      )}
      {ds.disclaimer.not_official && <p className="small muted">{pick(ds.disclaimer.not_official, lang)}</p>}
    </div>
  );
}
