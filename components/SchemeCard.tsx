"use client";

import type { Answers, Dataset, Lang, Location, SchemeResult } from "@/lib/engine/types";
import { answerText, conditionText, pick } from "@/lib/i18n/describe";
import { t, type StringKey } from "@/lib/i18n/strings";

interface Props {
  ds: Dataset;
  result: SchemeResult;
  answers: Answers;
  lang: Lang;
  district: string;
  origin?: { lat: number; lng: number } | null;
  onAnswerFact?: (factId: string) => void;
}

const MARK = { T: "✓", F: "✗", U: "?" } as const;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function mapLink(l: Location) {
  const q = l.lat && l.lng ? `${l.lat},${l.lng}` : `${l.name.en} ${l.address ?? ""} ${l.district}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function SourceNote({ ds, sourceId, quote, locator, lang }: { ds: Dataset; sourceId?: string; quote?: string; locator?: string; lang: Lang }) {
  const src = ds.sources.find((s) => s.id === sourceId);
  if (!src) return null;
  const tierKey = `tier${src.tier}` as StringKey;
  return (
    <details className="source">
      <summary>
        {t("source", lang)}: {src.authority}
      </summary>
      {quote && <blockquote>{quote}</blockquote>}
      <p className="small">
        {src.title}
        {locator ? ` · ${locator}` : ""} · {t(tierKey, lang)}
        {src.dateIssued ? ` · ${src.dateIssued}` : ""}
      </p>
      <a href={src.url} target="_blank" rel="noreferrer" className="small">
        {t("openSource", lang)} ↗
      </a>
    </details>
  );
}

export default function SchemeCard({ ds, result, answers, lang, district, origin, onAnswerFact }: Props) {
  const { scheme, status } = result;
  const factOf = (id: string) => ds.facts.find((f) => f.id === id);
  const showLeaves = status !== "informational";
  const leaves = status === "not_matched" ? result.leaves.filter((l) => l.result === "F") : result.leaves;

  return (
    <article className={`card scheme st-${status}`}>
      <header>
        <p className="pill">{t(`st_${status}` as StringKey, lang)}</p>
        <h3>{pick(scheme.name, lang)}</h3>
        <p className="muted small">{pick(scheme.authority, lang)}</p>
      </header>
      <p>{pick(scheme.summary, lang)}</p>

      {status === "needs_information" && (
        <div className="block">
          <h4>{t("weNeed", lang)}</h4>
          <ul className="plain">
            {result.missingFacts.map((f) => (
              <li key={f} className="row between">
                <span>{pick(factOf(f)?.label, lang) || f}</span>
                {onAnswerFact && (
                  <button type="button" className="btn small" onClick={() => onAnswerFact(f)}>
                    {t("answerThis", lang)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.oneStep && (
        <div className="block onestep">
          <h4>{t("whatToDo", lang)}</h4>
          <p>{pick(result.oneStep.leaf.howTo, lang) || conditionText(result.oneStep.leaf, factOf(result.oneStep.leaf.fact), lang)}</p>
          <p className="small muted">
            {t("thenStatus", lang)}: {t(`st_${result.oneStep.becomes}` as StringKey, lang)}
          </p>
        </div>
      )}

      {showLeaves && (
        <details className="block" open={status === "potentially_eligible"}>
          <summary>
            <h4>{status === "not_matched" ? t("whyNot", lang) : t("why", lang)}</h4>
          </summary>
          <ul className="plain why">
            {leaves.map(({ leaf, result: r }) => (
              <li key={leaf.id}>
                <span className={`mark m-${r}`} aria-hidden>
                  {MARK[r]}
                </span>
                <div>
                  <p>{conditionText(leaf, factOf(leaf.fact), lang)}</p>
                  <p className="small muted">
                    {t("youAnswered", lang)}: {factOf(leaf.fact) ? answerText(factOf(leaf.fact)!, answers[leaf.fact], lang) : "—"}
                  </p>
                  <SourceNote ds={ds} sourceId={leaf.source?.sourceId} quote={leaf.source?.quote} locator={leaf.source?.locator} lang={lang} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

      {(status === "potentially_eligible" || status === "needs_information" || status === "informational") && (
        <>
          <div className="block">
            <h4>{t("documents", lang)}</h4>
            {result.documents.length > 0 && <ul className="docs">
              {result.documents.map((d) => (
                <li key={d.doc.id}>
                  {pick(d.doc.name, lang)}
                  {d.conditional && <span className="muted"> ({t("ifApplies", lang)})</span>}
                  {d.doc.issuedBy && (
                    <span className="small muted">
                      {" "}
                      · {t("getFrom", lang)}: {pick(d.doc.issuedBy, lang)}
                    </span>
                  )}
                </li>
              ))}
            </ul>}
            {scheme.verification.documents !== "verified" && <p className="small notice">{t("docsPartial", lang)}</p>}
          </div>
          <div className="block">
            <h4>{t("whereToApply", lang)}</h4>
            {scheme.apply.map((a, i) => {
              const type = ds.locationTypes.find((x) => x.id === a.locationType);
              let locs = ds.locations.filter((l) => l.type === a.locationType && (!district || l.district === district));
              if (origin) {
                locs = locs
                  .filter((l) => l.lat && l.lng)
                  .sort((x, y) => distanceKm(origin, x as never) - distanceKm(origin, y as never));
              }
              return (
                <div key={i} className="apply">
                  <p>
                    <strong>{pick(type?.label, lang) || a.locationType}</strong> · {t(`mode_${a.mode}` as StringKey, lang)}
                  </p>
                  {a.note && <p className="small">{pick(a.note, lang)}</p>}
                  {locs.length === 0 && district && <p className="small muted">{t("noOffice", lang)}</p>}
                  <ul className="plain locs">
                    {locs.slice(0, 3).map((l) => (
                      <li key={l.id}>
                        <p>
                          {pick(l.name, lang)}
                          {origin && l.lat && l.lng ? ` · ${distanceKm(origin, { lat: l.lat, lng: l.lng }).toFixed(1)} km` : ""}
                        </p>
                        <p className="small muted">
                          {[l.address, l.area, l.district].filter(Boolean).join(", ")}
                          {l.phone ? ` · ${l.phone}` : ""}
                          {l.hours ? ` · ${l.hours}` : ""}
                        </p>
                        <a className="small" href={mapLink(l)} target="_blank" rel="noreferrer">
                          {t("openMap", lang)} ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                  <SourceNote ds={ds} sourceId={a.source?.sourceId} quote={a.source?.quote} lang={lang} />
                </div>
              );
            })}
            {scheme.verification.apply !== "verified" && <p className="small notice">{t("applyPartial", lang)}</p>}
          </div>
        </>
      )}
      {scheme.lastVerified && (
        <p className="small muted">
          {t("checkedOn", lang)} {scheme.lastVerified}
        </p>
      )}
    </article>
  );
}
