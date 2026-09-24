"use client";

import { useEffect, useRef, useState } from "react";
import type { Answers, Dataset, Lang, SchemeResult } from "@/lib/engine/types";
import { answerText, conditionText, pick } from "@/lib/i18n/describe";
import { t, type StringKey } from "@/lib/i18n/strings";
import { statusLabel } from "@/lib/i18n/terms";
import AssistPanel from "./AssistPanel";
import OfficeFinder from "./OfficeFinder";
import { SourceNote } from "./SourceNote";
import { canRead, readAloud, stopSpeaking, useVoicesReady } from "./useSpeech";
import { SpeakerIcon } from "./icons";

interface Props {
  ds: Dataset;
  result: SchemeResult;
  answers: Answers;
  lang: Lang;
  district: string;
  onDistrict: (d: string) => void;
  onBack: () => void;
  onAnswerFact: (factId: string) => void;
}

const MARK = { T: "✓", F: "✗", U: "?" } as const;
const MARK_LABEL = { T: "met", F: "notMet", U: "unknownMark" } as const;

export default function SchemeDetail({ ds, result, answers, lang, district, onDistrict, onBack, onAnswerFact }: Props) {
  const { scheme, status } = result;
  const [finding, setFinding] = useState(false);
  const [reading, setReading] = useState(false);
  const [readable, setReadable] = useState(false);
  const tick = useVoicesReady();
  const heading = useRef<HTMLHeadingElement>(null);
  const factOf = (id: string) => ds.facts.find((f) => f.id === id);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
    return () => stopSpeaking();
  }, []);
  useEffect(() => setReadable(canRead(lang, [{ text: "x" }])), [lang, tick]);

  const leaves = status === "not_matched" ? result.leaves.filter((l) => l.result === "F") : result.leaves;
  const canApply = status === "potentially_eligible" || status === "needs_information" || status === "informational";
  const speech = [
    pick(scheme.name, lang),
    statusLabel(ds, status, lang),
    pick(scheme.summary, lang),
    result.oneStep ? `${t("oneStepNeeds", lang)} ${pick(result.oneStep.leaf.howTo, lang)}` : "",
    result.documents.length ? `${t("documents", lang)}: ${result.documents.map((d) => pick(d.doc.name, lang)).join(", ")}` : "",
  ].filter(Boolean);

  function toggleRead() {
    if (reading) {
      stopSpeaking();
      return setReading(false);
    }
    setReading(true);
    readAloud(lang, speech.map((text) => ({ text })), () => setReading(false));
  }

  return (
    <article className="detail" aria-labelledby="scheme-title">
      <button type="button" className="btn btn-link" onClick={onBack}>
        ← {t("backToResults", lang)}
      </button>
      <header className={`detail-head st-${status}`}>
        <p className="status-tag">{statusLabel(ds, status, lang)}</p>
        <h1 id="scheme-title" tabIndex={-1} ref={heading}>
          {pick(scheme.name, lang)}
        </h1>
        <p className="meta">{pick(scheme.authority, lang)}</p>
        <p>{pick(scheme.summary, lang)}</p>
        {readable && (
          <button type="button" className="btn btn-quiet" onClick={toggleRead} aria-pressed={reading}>
            <SpeakerIcon /> {reading ? t("stop", lang) : t("listenScheme", lang)}
          </button>
        )}
      </header>

      {result.oneStep && (
        <section className="panel onestep" aria-labelledby="onestep-title">
          <h2 id="onestep-title">{t("oneStepTitle", lang)}</h2>
          <p>
            {t("oneStepNeeds", lang)} <strong>{conditionText(result.oneStep.leaf, factOf(result.oneStep.leaf.fact), lang)}</strong>
          </p>
          {result.oneStep.leaf.howTo && (
            <>
              <h3>{t("howToComplete", lang)}</h3>
              <p>{pick(result.oneStep.leaf.howTo, lang)}</p>
            </>
          )}
          <p className="meta">
            {t("thenStatus", lang)}: {statusLabel(ds, result.oneStep.becomes, lang)}
          </p>
        </section>
      )}

      {status === "needs_information" && (
        <section className="panel" aria-labelledby="need-title">
          <h2 id="need-title">{t("weNeed", lang)}</h2>
          <ul className="list">
            {result.missingFacts.map((f) => (
              <li key={f} className="row row-split">
                <span>{pick(factOf(f)?.label, lang) || f}</span>
                <button type="button" className="btn btn-small" onClick={() => onAnswerFact(f)}>
                  {t("answerThis", lang)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel" aria-labelledby="why-title">
        <h2 id="why-title">{status === "not_matched" ? t("whyNot", lang) : status === "informational" ? t("whyInfo", lang) : t("why", lang)}</h2>
        <ul className="why">
          {leaves.map(({ leaf, result: r }) => {
            const fact = factOf(leaf.fact);
            return (
              <li key={leaf.id} className={`why-item m-${r}`}>
                <span className="mark" aria-hidden>
                  {MARK[r]}
                </span>
                <div>
                  <p>
                    <span className="sr-only">{t(MARK_LABEL[r] as StringKey, lang)}: </span>
                    {conditionText(leaf, fact, lang)}
                  </p>
                  <p className="meta">
                    {t("youAnswered", lang)}: {fact ? answerText(fact, answers[leaf.fact], lang) : "—"}
                  </p>
                  <SourceNote ds={ds} sourceId={leaf.source?.sourceId} quote={leaf.source?.quote} locator={leaf.source?.locator} lang={lang} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <AssistPanel ds={ds} scheme={scheme} lang={lang} />

      {canApply && (
        <section className="panel" aria-labelledby="docs-title">
          <h2 id="docs-title">{t("documents", lang)}</h2>
          {result.documents.length === 0 ? (
            <p className="notice">{t("docsNotPublished", lang)}</p>
          ) : (
            <>
              <ul className="list">
                {result.documents.map((d) => (
                  <li key={d.doc.id}>
                    <p>
                      {pick(d.doc.name, lang)}
                      {d.conditional && <span className="meta"> ({t("ifApplies", lang)})</span>}
                    </p>
                    {d.doc.issuedBy && (
                      <p className="meta">
                        {t("getFrom", lang)}: {pick(d.doc.issuedBy, lang)}
                      </p>
                    )}
                    <SourceNote ds={ds} sourceId={d.source?.sourceId ?? d.doc.sourceId} quote={d.source?.quote} lang={lang} />
                  </li>
                ))}
              </ul>
              {scheme.verification.documents !== "verified" && <p className="notice">{t("docsPartial", lang)}</p>}
            </>
          )}
        </section>
      )}

      {canApply && (
        <section className="panel" aria-labelledby="apply-title">
          <h2 id="apply-title">{t("whereToApply", lang)}</h2>
          {scheme.apply.length === 0 && <p className="notice">{t("applyNotPublished", lang)}</p>}
          <ul className="list">
            {scheme.apply.map((a, i) => (
              <li key={i}>
                <p>
                  <strong>{pick(ds.locationTypes.find((x) => x.id === a.locationType)?.label, lang) || a.locationType}</strong>
                  <span className="meta"> · {t(`mode_${a.mode}` as StringKey, lang)}</span>
                </p>
                {a.note && <p className="meta">{pick(a.note, lang)}</p>}
              </li>
            ))}
          </ul>
          {!finding && scheme.apply.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={() => setFinding(true)}>
              {t("findWhere", lang)}
            </button>
          )}
        </section>
      )}

      {finding && <OfficeFinder ds={ds} schemes={[scheme]} lang={lang} district={district} onDistrict={onDistrict} />}

      {scheme.lastVerified && <p className="meta">{t("checkedOn", lang, { d: scheme.lastVerified })}</p>}
    </article>
  );
}
