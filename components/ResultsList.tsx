"use client";

import { useEffect, useRef, useState } from "react";
import { checklist } from "@/lib/engine/screen";
import type { Dataset, Lang, SchemeResult, SchemeStatus } from "@/lib/engine/types";
import { pick } from "@/lib/i18n/describe";
import { t } from "@/lib/i18n/strings";
import { statusLabel } from "@/lib/i18n/terms";

interface Props {
  ds: Dataset;
  results: SchemeResult[];
  answeredCount: number;
  lang: Lang;
  previous: Record<string, SchemeStatus> | null;
  onOpen: (schemeId: string) => void;
}

function Card({ ds, r, lang, onOpen }: { ds: Dataset; r: SchemeResult; lang: Lang; onOpen: (id: string) => void }) {
  return (
    <li className={`card st-${r.status}`}>
      <p className="status-tag">{statusLabel(ds, r.status, lang)}</p>
      <h3>{pick(r.scheme.name, lang)}</h3>
      <p>{pick(r.scheme.summary, lang)}</p>
      <p className="meta">{pick(r.scheme.authority, lang)}</p>
      {r.oneStep?.leaf.howTo && <p className="onestep-line">{pick(r.oneStep.leaf.howTo, lang)}</p>}
      <button type="button" className="btn" onClick={() => onOpen(r.scheme.id)} aria-label={`${t("viewDetails", lang)}: ${pick(r.scheme.name, lang)}`}>
        {t("viewDetails", lang)} →
      </button>
    </li>
  );
}

export default function ResultsList({ ds, results, answeredCount, lang, previous, onOpen }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const eligible = results.filter((r) => r.status === "potentially_eligible");
  const needs = results.filter((r) => r.status === "needs_information");
  const oneStep = results.filter((r) => r.status === "not_matched" && r.oneStep);
  const notMatched = results.filter((r) => r.status === "not_matched" && !r.oneStep);
  const info = results.filter((r) => r.status === "informational");
  const docs = checklist(results);
  const noDocs = eligible.filter((r) => r.documents.length === 0).map((r) => pick(r.scheme.name, lang));
  const changes = previous ? results.filter((r) => previous[r.scheme.id] && previous[r.scheme.id] !== r.status) : [];
  const title = eligible.length === 0 ? t("foundNone", lang) : eligible.length === 1 ? t("foundOne", lang) : t("foundN", lang, { n: eligible.length });
  const listText = docs.map((d) => `[ ] ${pick(d.name.name, lang)}`).join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(listText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const section = (id: string, heading: string, items: SchemeResult[], help?: string) =>
    items.length > 0 && (
      <section aria-labelledby={id} className="result-section">
        <h2 id={id}>
          {heading} <span className="count">({items.length})</span>
        </h2>
        {help && <p className="help">{help}</p>}
        <ul className="cards">
          {items.map((r) => (
            <Card key={r.scheme.id} ds={ds} r={r} lang={lang} onOpen={onOpen} />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="results">
      <div className="summary">
        <h1 tabIndex={-1} ref={heading}>
          {title}
        </h1>
        <p className="meta">{t("basedOn", lang, { n: answeredCount })}</p>
        {ds.disclaimer.main && <p className="disclaimer">{pick(ds.disclaimer.main, lang)}</p>}
      </div>

      {previous && (
        <section className="panel changes" aria-live="polite">
          <h2>{t("changes", lang)}</h2>
          {changes.length === 0 ? (
            <p>{t("noChanges", lang)}</p>
          ) : (
            <ul className="list">
              {changes.map((r) => (
                <li key={r.scheme.id}>
                  <strong>{pick(r.scheme.name, lang)}</strong>: {statusLabel(ds, previous[r.scheme.id], lang)} → {statusLabel(ds, r.status, lang)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {section("sec-eligible", t("sec_eligible", lang), eligible)}
      {section("sec-needs", t("sec_needs", lang), needs, t("sec_needs_help", lang))}
      {section("sec-onestep", t("sec_onestep", lang), oneStep, t("sec_onestep_help", lang))}

      {eligible.length > 0 && (
        <section className="panel checklist print-area" aria-labelledby="checklist-title">
          <h2 id="checklist-title">{t("checklistTitle", lang)}</h2>
          <p className="help">{t("checklistHelp", lang)}</p>
          {docs.length > 0 && (
            <ul className="check-rows">
              {docs.map((d) => (
                <li key={d.docId}>
                  <span className="checkbox" aria-hidden />
                  <span className="doc-name">
                    {pick(d.name.name, lang)}
                    {d.conditional && <span className="meta"> ({t("ifApplies", lang)})</span>}
                  </span>
                  <span className="meta">{d.schemes.length === 1 ? t("requiredByOne", lang) : t("requiredBy", lang, { n: d.schemes.length })}</span>
                </li>
              ))}
            </ul>
          )}
          {noDocs.length > 0 && <p className="notice">{t("noDocListFor", lang, { names: noDocs.join(", ") })}</p>}
          <p className="meta">{t("checklistNote", lang)}</p>
          <div className="row no-print">
            {docs.length > 0 && (
              <>
                <button type="button" className="btn" onClick={() => window.print()}>
                  {t("print", lang)}
                </button>
                <button type="button" className="btn" onClick={copy}>
                  {copied ? t("copied", lang) : t("copy", lang)}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {notMatched.length > 0 && (
        <details className="fold">
          <summary>
            {t("sec_not", lang)} ({notMatched.length})
          </summary>
          <ul className="cards">
            {notMatched.map((r) => (
              <Card key={r.scheme.id} ds={ds} r={r} lang={lang} onOpen={onOpen} />
            ))}
          </ul>
        </details>
      )}
      {info.length > 0 && (
        <details className="fold">
          <summary>
            {t("sec_info", lang)} ({info.length})
          </summary>
          <p className="help">{t("sec_info_help", lang)}</p>
          <ul className="cards">
            {info.map((r) => (
              <Card key={r.scheme.id} ds={ds} r={r} lang={lang} onOpen={onOpen} />
            ))}
          </ul>
        </details>
      )}
      {ds.disclaimer.not_official && <p className="meta">{pick(ds.disclaimer.not_official, lang)}</p>}
    </div>
  );
}
