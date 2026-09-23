"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { choicesFor } from "@/lib/engine/bands";
import { nextQuestion, pruneAnswers } from "@/lib/engine/next-question";
import { isScreenable, screenAll, statusMap } from "@/lib/engine/screen";
import type { Answer, Answers, Dataset, Lang, SchemeStatus } from "@/lib/engine/types";
import { answerText, pick } from "@/lib/i18n/describe";
import { t } from "@/lib/i18n/strings";
import DocumentChecklist from "./DocumentChecklist";
import EasyQuestion from "./EasyQuestion";
import OfficeFinder from "./OfficeFinder";
import QuestionCard from "./QuestionCard";
import ResultsList from "./ResultsList";
import SchemeDetail from "./SchemeDetail";
import { stopSpeaking } from "./useSpeech";

type Stage = "language" | "intro" | "ask" | "checking" | "results" | "detail" | "answers" | "checklist" | "where";
type Mode = "standard" | "easy";
const ENTRY_FACT = "livelihood";

function Stepper({ step, lang }: { step: number; lang: Lang }) {
  const names = [t("step_language", lang), t("step_work", lang), t("step_questions", lang), t("step_results", lang)];
  return (
    <div className="stepper" aria-label={t("stepOf", lang, { n: step, total: 4 })}>
      <p className="eyebrow">{t("stepOf", lang, { n: step, total: 4 })}</p>
      <ol>
        {names.map((n, i) => (
          <li key={n} className={i + 1 < step ? "done" : i + 1 === step ? "now" : ""} aria-current={i + 1 === step ? "step" : undefined}>
            {n}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Navigator({ ds }: { ds: Dataset }) {
  const [lang, setLang] = useState<Lang>("ml");
  const [stage, setStage] = useState<Stage>("language");
  const [answers, setAnswers] = useState<Answers>({});
  const [history, setHistory] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [previous, setPrevious] = useState<Record<string, SchemeStatus> | null>(null);
  const [openScheme, setOpenScheme] = useState<string | null>(null);
  const [district, setDistrict] = useState("");
  const [assisted, setAssisted] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [mode, setMode] = useState<Mode>("standard");
  const [autoRead, setAutoRead] = useState(true);
  const [returnFocus, setReturnFocus] = useState<string | null>(null);
  const introHeading = useRef<HTMLHeadingElement>(null);
  const checkingHeading = useRef<HTMLHeadingElement>(null);
  const answersHeading = useRef<HTMLHeadingElement>(null);

  const idleMinutes = assisted ? 3 : 10;
  const entryFact = ds.facts.find((f) => f.id === ENTRY_FACT);
  const results = useMemo(() => screenAll(ds, answers), [ds, answers]);
  const adaptive = useMemo(() => nextQuestion(ds, answers), [ds, answers]);
  const askEntry = !!entryFact && answers[ENTRY_FACT] === undefined;
  const screenable = ds.schemes.filter(isScreenable).length;

  const clearAll = useCallback((message = "") => {
    stopSpeaking();
    setAnswers({});
    setHistory([]);
    setEditing(null);
    setPrevious(null);
    setOpenScheme(null);
    setReturnFocus(null);
    setDistrict("");
    setConfirmClear(false);
    setStage("intro");
    setNotice(message);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (stage === "language") return;
    const ms = idleMinutes * 60 * 1000;
    let timer = setTimeout(() => clearAll(t("idleCleared", lang, { n: idleMinutes })), ms);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => clearAll(t("idleCleared", lang, { n: idleMinutes })), ms);
    };
    const events = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [clearAll, lang, idleMinutes, stage]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (stage === "ask" && !editing && !askEntry && !adaptive) setStage("checking");
  }, [stage, editing, askEntry, adaptive]);

  useEffect(() => {
    if (stage !== "checking") return;
    checkingHeading.current?.focus();
    const timer = setTimeout(() => setStage("results"), 900);
    return () => clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === "intro") introHeading.current?.focus();
    if (stage === "answers") answersHeading.current?.focus();
    if (stage !== "detail" && !(stage === "results" && returnFocus)) window.scrollTo({ top: 0 });
  }, [stage, editing, adaptive?.fact.id]);

  function answer(factId: string, a: Answer) {
    setNotice("");
    if (editing) {
      const merged = { ...answers, [factId]: a };
      const updated = pruneAnswers(ds, merged, [factId, ENTRY_FACT]);
      setAnswers(updated);
      setHistory((h) => h.filter((id) => id in updated));
      setEditing(null);
      setOpenScheme(null);
      setStage("ask");
      return;
    }
    setAnswers({ ...answers, [factId]: a });
    setHistory([...history, factId]);
  }

  function back() {
    const last = history[history.length - 1];
    if (!last) return setStage("intro");
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
  const easy = mode === "easy";
  const eligibleSchemes = results.filter((r) => r.status === "potentially_eligible").map((r) => r.scheme);

  function Question(p: {
    k: string;
    fact: NonNullable<typeof editFact>;
    choices: Answer[];
    current?: Answer;
    number?: number;
    remaining?: number;
    onBack: () => void;
    onAnswer: (a: Answer) => void;
    onSeeResults?: () => void;
    allowUnknown?: boolean;
  }) {
    if (easy)
      return (
        <EasyQuestion
          key={`easy-${p.k}`}
          fact={p.fact}
          choices={p.choices}
          lang={lang}
          current={p.current}
          number={p.number}
          autoRead={autoRead}
          onAutoRead={setAutoRead}
          canGoBack
          onBack={p.onBack}
          onAnswer={p.onAnswer}
          onSeeResults={p.onSeeResults}
          allowUnknown={p.allowUnknown}
        />
      );
    return (
      <QuestionCard
        key={p.k}
        fact={p.fact}
        choices={p.choices}
        lang={lang}
        current={p.current}
        number={p.number}
        remaining={p.remaining}
        canGoBack
        onBack={p.onBack}
        onAnswer={p.onAnswer}
        onSeeResults={p.onSeeResults}
        allowUnknown={p.allowUnknown}
      />
    );
  }
  const opened = openScheme ? results.find((r) => r.scheme.id === openScheme) : undefined;
  const step = stage === "language" || stage === "intro" ? 1 : stage === "ask" && (askEntry || editing === ENTRY_FACT) ? 2 : stage === "ask" ? 3 : 4;
  const answered = Object.keys(answers).length;

  return (
    <div className={`shell ${easy ? "easy" : ""}`}>
      <a href="#main" className="skip">
        {t("skipToContent", lang)}
      </a>
      <header className="masthead no-print">
        <div className="masthead-inner">
          <div>
            <p className="brand">{t("appName", lang)}</p>
            <p className="brand-sub">{t("appSubtitle", lang)}</p>
          </div>
          {stage !== "language" && (
            <div className="head-tools">
            <button type="button" className="mode-switch" aria-pressed={easy} onClick={() => setMode(easy ? "standard" : "easy")}>
              <span className="mode-switch-box" aria-hidden>
                {easy ? "✓" : ""}
              </span>
              {t("easyModeLabel", lang)}
            </button>
            <div className="lang-switch" role="group" aria-label="Language / ഭാഷ">
              <button type="button" lang="ml" aria-pressed={lang === "ml"} onClick={() => setLang("ml")}>
                മലയാളം
              </button>
              <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
                English
              </button>
            </div>
            </div>
          )}
        </div>
      </header>

      <main id="main" className="page">
        {ds.meta.includesExamples && <p className="notice">{t("exampleData", lang)}</p>}
        {!online && <p className="notice">{t("offline", lang)}</p>}
        {notice && (
          <p className="status" role="status">
            {notice}
          </p>
        )}
        {stage !== "detail" && stage !== "answers" && stage !== "checklist" && stage !== "where" && <Stepper step={step} lang={lang} />}

        {stage === "language" && (
          <section className="panel" aria-labelledby="lang-title">
            <h1 id="lang-title">
              <span lang="ml">ഭാഷ തിരഞ്ഞെടുക്കുക</span> / <span lang="en">Choose language</span>
            </h1>
            <div className="choices choices-2">
              <button
                type="button"
                className="choice choice-lang"
                lang="ml"
                onClick={() => {
                  setLang("ml");
                  setStage("intro");
                }}
              >
                മലയാളം
              </button>
              <button
                type="button"
                className="choice choice-lang"
                lang="en"
                onClick={() => {
                  setLang("en");
                  setStage("intro");
                }}
              >
                English
              </button>
            </div>
          </section>
        )}

        {stage === "intro" && (
          <section className="panel" aria-labelledby="intro-title">
            <h1 id="intro-title" tabIndex={-1} ref={introHeading}>
              {t("introTitle", lang)}
            </h1>
            <ol className="steps-list">
              <li>{t("intro1", lang)}</li>
              <li>{t("intro2", lang)}</li>
              <li>{t("intro3", lang)}</li>
            </ol>
            <p className="meta">{t("noNames", lang)}</p>
            <label className="check">
              <input type="checkbox" id="assisted" checked={assisted} onChange={(e) => setAssisted(e.target.checked)} />
              <span>{t("assisted", lang)}</span>
            </label>
            {assisted && <p className="help">{t("assistedHelp", lang)}</p>}
            {screenable === 0 ? (
              <p className="notice">{t("noData", lang)}</p>
            ) : (
              <fieldset className="mode-pick">
                <legend>{t("modeTitle", lang)}</legend>
                <button
                  type="button"
                  className={`mode-card ${mode === "easy" ? "is-current" : ""}`}
                  aria-describedby="mode-easy-help"
                  onClick={() => {
                    setMode("easy");
                    setStage("ask");
                  }}
                >
                  <span className="mode-name">{t("modeEasy", lang)}</span>
                  <span id="mode-easy-help" className="mode-help">
                    {t("modeEasyHelp", lang)}
                  </span>
                  <span className="mode-go">{t("start", lang)} →</span>
                </button>
                <button
                  type="button"
                  className={`mode-card ${mode === "standard" ? "is-current" : ""}`}
                  aria-describedby="mode-std-help"
                  onClick={() => {
                    setMode("standard");
                    setStage("ask");
                  }}
                >
                  <span className="mode-name">{t("modeStandard", lang)}</span>
                  <span id="mode-std-help" className="mode-help">
                    {t("modeStandardHelp", lang)}
                  </span>
                  <span className="mode-go">{t("start", lang)} →</span>
                </button>
              </fieldset>
            )}
            {ds.disclaimer.privacy && <p className="meta">{pick(ds.disclaimer.privacy, lang)}</p>}
            <p className="meta">{t("voicePrivacy", lang)}</p>
            {ds.disclaimer.not_official && <p className="meta">{pick(ds.disclaimer.not_official, lang)}</p>}
          </section>
        )}

        {stage === "ask" &&
          editFact &&
          Question({
            k: `edit-${editFact.id}`,
            fact: editFact,
            choices: choicesFor(editFact, ds.schemes),
            current: answers[editFact.id],
            onBack: () => {
              setEditing(null);
              setPrevious(null);
              setStage(openScheme ? "detail" : "answers");
            },
            allowUnknown: editFact.id !== ENTRY_FACT,
            onAnswer: (a) => answer(editFact.id, a),
          })}

        {stage === "ask" &&
          !editFact &&
          askEntry &&
          entryFact &&
          Question({
            k: entryFact.id,
            fact: entryFact,
            choices: choicesFor(entryFact, ds.schemes),
            current: answers[entryFact.id],
            onBack: () => setStage("intro"),
            allowUnknown: false,
            onAnswer: (a) => answer(entryFact.id, a),
          })}

        {stage === "ask" &&
          !editFact &&
          !askEntry &&
          adaptive &&
          Question({
            k: adaptive.fact.id,
            fact: adaptive.fact,
            choices: adaptive.choices,
            current: answers[adaptive.fact.id],
            number: history.filter((h) => h !== ENTRY_FACT).length + 1,
            remaining: adaptive.remainingUpperBound,
            onBack: back,
            onAnswer: (a) => answer(adaptive.fact.id, a),
            onSeeResults: () => setStage("results"),
          })}

        {stage === "checking" && (
          <section className="panel" role="status" aria-labelledby="checking-title">
            <h1 id="checking-title" tabIndex={-1} ref={checkingHeading}>
              {t("checkingTitle", lang)}
            </h1>
            <p>{t("checkingBody", lang, { n: screenable })}</p>
          </section>
        )}

        {stage === "results" && (
          <>
            <ResultsList
              ds={ds}
              results={results}
              answeredCount={answered}
              lang={lang}
              previous={previous}
              easy={easy}
              focusScheme={returnFocus}
              onFocused={() => setReturnFocus(null)}
              onOpen={(id) => {
                setPrevious(null);
                setOpenScheme(id);
                setStage("detail");
              }}
              onChecklist={() => {
                setPrevious(null);
                setStage("checklist");
              }}
              onWhere={() => {
                setPrevious(null);
                setStage("where");
              }}
            />
            <div className="row actions no-print">
              {(adaptive || askEntry) && (
                <button type="button" className="btn" onClick={() => setStage("ask")}>
                  {t("continue", lang)}
                </button>
              )}
              <button type="button" className="btn" onClick={() => setStage("answers")}>
                {t("editAnswers", lang)}
              </button>
              {assisted && (
                <button type="button" className="btn btn-primary" onClick={() => clearAll(t("cleared", lang))}>
                  {t("nextFamily", lang)}
                </button>
              )}
            </div>
          </>
        )}

        {stage === "detail" && opened && (
          <SchemeDetail
            key={opened.scheme.id}
            ds={ds}
            result={opened}
            answers={answers}
            lang={lang}
            district={district}
            onDistrict={setDistrict}
            onBack={() => {
              setReturnFocus(openScheme);
              setOpenScheme(null);
              setStage("results");
            }}
            onAnswerFact={startEdit}
          />
        )}

        {stage === "checklist" && (
          <DocumentChecklist
            ds={ds}
            results={results}
            lang={lang}
            onBack={() => setStage("results")}
            onFindOffices={() => setStage("where")}
            onClear={() => clearAll(t("cleared", lang))}
          />
        )}

        {stage === "where" && (
          <>
            <button type="button" className="btn btn-link" onClick={() => setStage("results")}>
              ← {t("backToResults", lang)}
            </button>
            {eligibleSchemes.length === 0 ? (
              <p className="notice">{t("checklistNothing", lang)}</p>
            ) : (
              <OfficeFinder ds={ds} schemes={eligibleSchemes} lang={lang} district={district} onDistrict={setDistrict} headingLevel={1} />
            )}
            <div className="row actions no-print">
              <button type="button" className="btn" onClick={() => setStage("checklist")}>
                {t("openChecklist", lang)}
              </button>
            </div>
          </>
        )}

        {stage === "answers" && (
          <section className="panel" aria-labelledby="answers-title">
            <h1 id="answers-title" tabIndex={-1} ref={answersHeading}>
              {t("yourAnswers", lang)}
            </h1>
            <p className="help">{t("yourAnswersHelp", lang)}</p>
            <ul className="list">
              {ds.facts
                .filter((f) => f.id in answers)
                .map((f) => (
                  <li key={f.id} className="row row-split">
                    <div>
                      <p>{pick(f.label, lang)}</p>
                      <p className="meta">{answerText(f, answers[f.id], lang)}</p>
                    </div>
                    <button type="button" className="btn btn-small" onClick={() => startEdit(f.id)}>
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

      <footer className="footer no-print">
        {stage !== "language" && stage !== "intro" && (
          <div className="clearbar">
            {confirmClear ? (
              <div className="row">
                <span>{t("clearConfirm", lang)}</span>
                <button type="button" className="btn btn-danger" onClick={() => clearAll(t("cleared", lang))}>
                  {t("clearYes", lang)}
                </button>
                <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
                  {t("cancel", lang)}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-quiet" onClick={() => setConfirmClear(true)}>
                {t("clear", lang)}
              </button>
            )}
          </div>
        )}
        <p className="footer-links">
          <Link href="/review">{t("reviewer", lang)}</Link>
        </p>
      </footer>
    </div>
  );
}
