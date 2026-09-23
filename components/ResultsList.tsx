"use client";

import { useEffect, useRef } from "react";
import { buildChecklist } from "@/lib/checklist";
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
  easy?: boolean;
  focusScheme?: string | null;
  onFocused?: () => void;
  onOpen: (schemeId: string) => void;
  onChecklist: () => void;
  onWhere: () => void;
}

function Card({ ds, r, lang, onOpen }: { ds: Dataset; r: SchemeResult; lang: Lang; onOpen: (id: string) => void }) {
  return (
    <li className={`card st-${r.status}`}>
      <p className="status-tag">{statusLabel(ds, r.status, lang)}</p>
      <h3>{pick(r.scheme.name, lang)}</h3>
      <p>{pick(r.scheme.summary, lang)}</p>
      <p className="meta">{pick(r.scheme.authority, lang)}</p>
      {r.oneStep?.leaf.howTo && <p className="onestep-line">{pick(r.oneStep.leaf.howTo, lang)}</p>}
      <button type="button" id={`open-${r.scheme.id}`} className="btn" onClick={() => onOpen(r.scheme.id)} aria-label={`${t("viewDetails", lang)}: ${pick(r.scheme.name, lang)}`}>
        {t("viewDetails", lang)} →
      </button>
    </li>
  );
}

export default function ResultsList({ ds, results, answeredCount, lang, previous, easy, focusScheme, onFocused, onOpen, onChecklist, onWhere }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const back = focusScheme ? document.getElementById(`open-${focusScheme}`) : null;
    if (back) {
      back.focus();
      back.scrollIntoView({ block: "center" });
      onFocused?.();
    } else heading.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligible = results.filter((r) => r.status === "potentially_eligible");
  const needs = results.filter((r) => r.status === "needs_information");
  const oneStep = results.filter((r) => r.status === "not_matched" && r.oneStep);
  const notMatched = results.filter((r) => r.status === "not_matched" && !r.oneStep);
  const info = results.filter((r) => r.status === "informational");
  const list = buildChecklist(ds, results);
  const changes = previous ? results.filter((r) => previous[r.scheme.id] && previous[r.scheme.id] !== r.status) : [];
  const title = eligible.length === 0 ? (needs.length > 0 ? t("foundNoneYet", lang) : t("foundNone", lang)) : eligible.length === 1 ? t("foundOne", lang) : t("foundN", lang, { n: eligible.length });
  const nextSteps = eligible.length > 0 && (
    <section className={`panel next-steps ${easy ? "next-steps-easy" : ""}`} aria-labelledby="next-title">
      <h2 id="next-title">{t("docChecklistTitle", lang)}</h2>
      <p>{t("checklistSummary", lang, { d: list.docs.length, n: list.schemes.length })}</p>
      {list.docs.length > 0 && (
        <ul className="next-docs">
          {list.docs.slice(0, 3).map((d) => (
            <li key={d.docId}>
              {pick(d.name, lang)} <span className="meta">· {d.schemes.length === 1 ? t("requiredForOne", lang) : t("requiredForN", lang, { n: d.schemes.length })}</span>
            </li>
          ))}
        </ul>
      )}
      {list.withoutList.length > 0 && <p className="note">{t("docListNotVerifiedShort", lang)}: {list.withoutList.map((s) => pick(s.name, lang)).join(", ")}</p>}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onChecklist}>
          {t("openChecklist", lang)} →
        </button>
        <button type="button" className="btn" onClick={onWhere}>
          {t("findWhere", lang)} →
        </button>
      </div>
    </section>
  );

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

      {easy && nextSteps}
      {section("sec-eligible", t("sec_eligible", lang), eligible)}
      {section("sec-needs", t("sec_needs", lang), needs, t("sec_needs_help", lang))}
      {section("sec-onestep", t("sec_onestep", lang), oneStep, t("sec_onestep_help", lang))}
      {!easy && nextSteps}

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
