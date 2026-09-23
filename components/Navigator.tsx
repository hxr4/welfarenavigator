"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { choicesFor } from "@/lib/engine/bands";
import { nextQuestion, pruneAnswers } from "@/lib/engine/next-question";
import { screenAll, statusMap } from "@/lib/engine/screen";
import type { Answer, Answers, Dataset, Lang, SchemeStatus } from "@/lib/engine/types";
import { answerText, pick } from "@/lib/i18n/describe";
import { t } from "@/lib/i18n/strings";
import QuestionCard from "./QuestionCard";
import Results from "./Results";

type Stage = "welcome" | "ask" | "results" | "answers";
const IDLE_MS = 10 * 60 * 1000;

export default function Navigator({ ds }: { ds: Dataset }) {
  const [lang, setLang] = useState<Lang>("ml");
  const [stage, setStage] = useState<Stage>("welcome");
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [previous, setPrevious] = useState<Record<string, SchemeStatus> | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");

  const results = useMemo(() => screenAll(ds, answers), [ds, answers]);
  const next = useMemo(() => nextQuestion(ds, answers), [ds, answers]);

  const clearAll = useCallback((message = "") => {
    setAnswers({});
    setHistory([]);
    setEditing(null);
    setPrevious(null);
    setConfirmClear(false);
    setStage("welcome");
    setNotice(message);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    let timer = setTimeout(() => clearAll(t("idleCleared", lang)), IDLE_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => clearAll(t("idleCleared", lang)), IDLE_MS);
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [clearAll, lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (stage === "ask" && !editing && !next) setStage("results");
  }, [stage, editing, next]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage, editing, next?.fact.id]);

  function answer(factId: string, a: Answer) {
    setNotice("");
    if (editing) {
      const updated = pruneAnswers(ds, { ...answers, [factId]: a });
      setAnswers(updated);
      setHistory((h) => h.filter((id) => id in updated));
      setEditing(null);
      setStage("ask");
      return;
    }
    setAnswers({ ...answers, [factId]: a });
    setHistory([...history, factId]);
  }

  function back() {
    const last = history[history.length - 1];
    if (!last) return;
    const copy = { ...answers };
    delete copy[last];
    setAnswers(copy);
    setHistory(history.slice(0, -1));
  }

  function startEdit(factId: string) {
    setPrevious(statusMap(results));
    setEditing(factId);
    setStage("ask");
  }

  const editFact = editing ? ds.facts.find((f) => f.id === editing) : undefined;
  const screenable = ds.schemes.filter((s) => s.verification.eligibility === "verified").length;

  return (
    <div className="app">
      <header className="topbar no-print">
        <button type="button" className="brand" onClick={() => setStage(Object.keys(answers).length ? "results" : "welcome")}>
          {t("appName", lang)}
        </button>
        <div className="lang" role="group" aria-label={t("chooseLanguage", lang)}>
          <button type="button" className={lang === "ml" ? "on" : ""} onClick={() => setLang("ml")} lang="ml">
            മലയാളം
          </button>
          <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} lang="en">
            English
          </button>
        </div>
      </header>

      {ds.meta.includesExamples && <p className="banner">{t("exampleData", lang)}</p>}
      {notice && <p className="notice">{notice}</p>}

      <main>
        {stage === "welcome" && (
          <section className="welcome">
            <h1>{t("appName", lang)}</h1>
            <p className="lead">{t("tagline", lang)}</p>
            <p>{t("howItWorks", lang)}</p>
            <p className="muted">{t("noNames", lang)}</p>
            {screenable === 0 ? (
              <p className="notice">{t("noData", lang)}</p>
            ) : (
              <button type="button" className="btn primary big" onClick={() => setStage("ask")}>
                {t("start", lang)} →
              </button>
            )}
            {ds.disclaimer.privacy && <p className="small muted">{pick(ds.disclaimer.privacy, lang)}</p>}
            {ds.disclaimer.not_official && <p className="small muted">{pick(ds.disclaimer.not_official, lang)}</p>}
            <p className="small">
              <Link href="/review">{t("reviewer", lang)}</Link>
            </p>
          </section>
        )}

        {stage === "ask" && editFact && (
          <QuestionCard
            key={`edit-${editFact.id}`}
            fact={editFact}
            choices={choicesFor(editFact, ds.schemes)}
            lang={lang}
            current={answers[editFact.id]}
            canGoBack
            onBack={() => {
              setEditing(null);
              setStage("results");
            }}
            onAnswer={(a) => answer(editFact.id, a)}
          />
        )}

        {stage === "ask" && !editFact && next && (
          <QuestionCard
            key={next.fact.id}
            fact={next.fact}
            choices={next.choices}
            lang={lang}
            remaining={next.remainingUpperBound}
            canGoBack={history.length > 0}
            onBack={back}
            onAnswer={(a) => answer(next.fact.id, a)}
            onSeeResults={history.length > 0 ? () => setStage("results") : undefined}
          />
        )}

        {stage === "results" && (
          <>
            <Results ds={ds} results={results} answers={answers} lang={lang} previous={previous} onAnswerFact={startEdit} />
            <div className="row actions no-print">
              {next && (
                <button type="button" className="btn" onClick={() => setStage("ask")}>
                  {t("next", lang)} →
                </button>
              )}
              <button type="button" className="btn" onClick={() => setStage("answers")}>
                {t("editAnswers", lang)}
              </button>
            </div>
          </>
        )}

        {stage === "answers" && (
          <section className="card">
            <h2>{t("yourAnswers", lang)}</h2>
            <ul className="plain answers">
              {ds.facts
                .filter((f) => f.id in answers)
                .map((f) => (
                  <li key={f.id} className="row between">
                    <div>
                      <p>{pick(f.label, lang)}</p>
                      <p className="muted">{answerText(f, answers[f.id], lang)}</p>
                    </div>
                    <button type="button" className="btn small" onClick={() => startEdit(f.id)}>
                      {t("change", lang)}
                    </button>
                  </li>
                ))}
            </ul>
            <button type="button" className="btn" onClick={() => setStage("results")}>
              ← {t("backToResults", lang)}
            </button>
          </section>
        )}
      </main>

      {stage !== "welcome" && (
        <footer className="clearbar no-print">
          {confirmClear ? (
            <div className="row">
              <span>{t("clearConfirm", lang)}</span>
              <button type="button" className="btn danger" onClick={() => clearAll(t("cleared", lang))}>
                {t("clearYes", lang)}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
                {t("cancel", lang)}
              </button>
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfirmClear(true)}>
              🗑 {t("clear", lang)}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
