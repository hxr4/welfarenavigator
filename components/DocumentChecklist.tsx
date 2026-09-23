"use client";

import { useEffect, useRef, useState } from "react";
import { buildChecklist } from "@/lib/checklist";
import type { Dataset, Lang, SchemeResult } from "@/lib/engine/types";
import { pick } from "@/lib/i18n/describe";
import { t, type StringKey } from "@/lib/i18n/strings";
import { PinIcon, PrintIcon } from "./icons";

interface Props {
  ds: Dataset;
  results: SchemeResult[];
  lang: Lang;
  onBack: () => void;
  onFindOffices: () => void;
  onClear: () => void;
}

export default function DocumentChecklist({ ds, results, lang, onBack, onFindOffices, onClear }: Props) {
  const c = buildChecklist(ds, results);
  const heading = useRef<HTMLHeadingElement>(null);
  const [printed, setPrinted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState("");

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
    const stamp = () => setGenerated(new Date().toLocaleString(lang === "ml" ? "ml-IN" : "en-IN", { dateStyle: "long", timeStyle: "short" }));
    stamp();
    const after = () => setPrinted(true);
    window.addEventListener("beforeprint", stamp);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", stamp);
      window.removeEventListener("afterprint", after);
    };
  }, [lang]);

  const names = (ids: { name: { en: string; ml: string } }[]) => ids.map((s) => pick(s.name, lang)).join(", ");
  const listText = [
    `${t("appName", lang)} — ${t("docChecklistTitle", lang)}`,
    ...c.docs.map((d) => `[ ] ${pick(d.name, lang)} (${names(d.schemes)})`),
    ...(c.withoutList.length ? [t("noDocListFor", lang, { names: names(c.withoutList) })] : []),
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(listText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const modeText = (m: "in_person" | "online" | "both") => t(`mode_${m}` as StringKey, lang);

  return (
    <>
      <section className="panel checklist-page screen-only" aria-labelledby="checklist-title">
        <button type="button" className="btn btn-link" onClick={onBack}>
          ← {t("backToResults", lang)}
        </button>
        <h1 id="checklist-title" tabIndex={-1} ref={heading}>
          {t("docChecklistTitle", lang)}
        </h1>
        <p className="help">{t("docChecklistIntro", lang, { n: c.schemes.length })}</p>

        {c.schemes.length === 0 ? (
          <p className="notice">{t("checklistNothing", lang)}</p>
        ) : (
          <>
            {c.docs.length > 0 && (
              <ul className="doc-rows">
                {c.docs.map((d) => (
                  <li key={d.docId} className="doc-row">
                    <details>
                      <summary>
                        <span className="checkbox" aria-hidden />
                        <span className="doc-name">
                          {pick(d.name, lang)}
                          {d.conditional && <span className="meta"> ({t("ifApplies", lang)})</span>}
                        </span>
                        <span className="doc-count">{d.schemes.length === 1 ? t("requiredForOne", lang) : t("requiredForN", lang, { n: d.schemes.length })}</span>
                      </summary>
                      <div className="doc-body">
                        <p className="meta">{t("neededFor", lang)}:</p>
                        <ul>
                          {d.schemes.map((s) => (
                            <li key={s.id}>{pick(s.name, lang)}</li>
                          ))}
                        </ul>
                        {d.issuedBy && (
                          <p className="meta">
                            {t("getFrom", lang)}: {pick(d.issuedBy, lang)}
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            {c.withoutList.length > 0 && <p className="notice">{t("docListNotVerified", lang, { names: names(c.withoutList) })}</p>}
            {c.partialList.length > 0 && <p className="note">{t("docListPartialFor", lang, { names: names(c.partialList) })}</p>}
            <p className="meta">{t("checklistNote", lang)}</p>

            <div className="row checklist-actions">
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>
                <PrintIcon /> {t("printOrSave", lang)}
              </button>
              <button type="button" className="btn" onClick={onFindOffices}>
                <PinIcon /> {t("findWhere", lang)}
              </button>
              {c.docs.length > 0 && (
                <button type="button" className="btn btn-quiet" onClick={copy}>
                  {copied ? t("copied", lang) : t("copy", lang)}
                </button>
              )}
            </div>
            <p className="note">{t("printHint", lang)}</p>
            <div className={`clear-after ${printed ? "is-due" : ""}`} aria-live="polite">
              {printed && <p>{t("printedClearPrompt", lang)}</p>}
              <button type="button" className={`btn ${printed ? "btn-danger" : "btn-quiet"}`} onClick={onClear}>
                {t("clearAfterPrint", lang)}
              </button>
            </div>
          </>
        )}
      </section>

      <div className="print-sheet" aria-hidden="true">
        <header className="ps-head">
          <p className="ps-brand">{t("appName", lang)}</p>
          <h1>{t("docChecklistTitle", lang)}</h1>
          <p className="ps-date">
            {t("generatedOn", lang)}: {generated}
          </p>
        </header>
        {ds.disclaimer.main && <p className="ps-disclaimer">{pick(ds.disclaimer.main, lang)}</p>}
        <h2>{t("printSchemes", lang)}</h2>
        <ol className="ps-schemes">
          {c.schemes.map((s) => (
            <li key={s.id}>
              <strong>{pick(s.name, lang)}</strong> — {pick(s.authority, lang)}
              {s.documents === "not_published" && <span> · {t("docListNotVerifiedShort", lang)}</span>}
            </li>
          ))}
        </ol>
        <h2>{t("printDocs", lang)}</h2>
        {c.docs.length === 0 ? (
          <p>{t("docListNotVerifiedShort", lang)}</p>
        ) : (
          <table className="ps-docs">
            <tbody>
              {c.docs.map((d) => (
                <tr key={d.docId}>
                  <td className="ps-box">☐</td>
                  <td>
                    {pick(d.name, lang)}
                    {d.conditional ? ` (${t("ifApplies", lang)})` : ""}
                  </td>
                  <td className="ps-for">{names(d.schemes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {c.withoutList.length > 0 && <p>{t("docListNotVerified", lang, { names: names(c.withoutList) })}</p>}
        {c.partialList.length > 0 && <p>{t("docListPartialFor", lang, { names: names(c.partialList) })}</p>}
        <h2>{t("whereToApply", lang)}</h2>
        <ul className="ps-apply">
          {c.schemes.map((s) => (
            <li key={s.id}>
              <strong>{pick(s.name, lang)}</strong>
              <ul>
                {s.apply.map((a, i) => (
                  <li key={i}>
                    {pick(a.label, lang)} ({modeText(a.mode)}){a.note ? ` — ${pick(a.note, lang)}` : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {c.schemes.some((s) => s.applyVerification !== "verified") && <p>{t("printApplyPartial", lang)}</p>}
        <p className="ps-foot">{t("finalDecision", lang)}</p>
        {ds.disclaimer.not_official && <p className="ps-foot">{pick(ds.disclaimer.not_official, lang)}</p>}
        <p className="ps-foot">{t("printNoPersonal", lang)}</p>
      </div>
    </>
  );
}
