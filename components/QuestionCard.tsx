"use client";

import { useEffect, useState } from "react";
import type { Answer, Fact, Lang } from "@/lib/engine/types";
import { answerText, pick } from "@/lib/i18n/describe";
import { t } from "@/lib/i18n/strings";
import { matchSpeech } from "@/lib/voice/match";
import { canSpeak, speak, useSpeech } from "./useSpeech";

interface Props {
  fact: Fact;
  choices: Answer[];
  lang: Lang;
  current?: Answer;
  remaining?: number;
  canGoBack: boolean;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
  onSeeResults?: () => void;
}

function same(a: Answer | undefined, b: Answer): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

export default function QuestionCard({ fact, choices, lang, current, remaining, canGoBack, onAnswer, onBack, onSeeResults }: Props) {
  const [multi, setMulti] = useState<string[]>(() =>
    current?.kind === "value" && Array.isArray(current.value) ? current.value : [],
  );
  const [heard, setHeard] = useState<{ text: string; answer: Answer | null } | null>(null);
  const [voiceMsg, setVoiceMsg] = useState("");
  const [ttsOk, setTtsOk] = useState(false);
  const { supported, listening, listen, stop } = useSpeech(lang);
  const audio = lang === "ml" ? fact.audioMl : undefined;

  useEffect(() => {
    setMulti(current?.kind === "value" && Array.isArray(current.value) ? current.value : []);
    setHeard(null);
    setVoiceMsg("");
    stop();
  }, [fact.id, current, stop]);

  useEffect(() => {
    const check = () => setTtsOk(canSpeak(lang, audio));
    check();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", check);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", check);
    }
  }, [lang, audio]);

  const labelFor = (c: Answer, i: number) => {
    if (fact.type === "boolean") return t(i === 0 ? "yes" : "no", lang);
    if (fact.type === "number") return answerText(fact, c, lang);
    const o = fact.options[i];
    return pick(o.label, lang);
  };

  async function onSpeak() {
    setHeard(null);
    setVoiceMsg("");
    try {
      const alts = await listen();
      const m = matchSpeech(alts, fact, choices);
      const text = alts[0] ?? "";
      if (!m) {
        setHeard({ text, answer: null });
        setVoiceMsg(t("notUnderstood", lang));
        return;
      }
      if (m.kind === "unknown") return setHeard({ text, answer: { kind: "unknown" } });
      if (fact.type === "multi") {
        const vals = m.indices.map((i) => fact.options[i].value);
        return setHeard({ text, answer: { kind: "value", value: vals } });
      }
      setHeard({ text, answer: choices[m.indices[0]] });
    } catch {
      setVoiceMsg(t("voiceUnavailable", lang));
    }
  }

  return (
    <section className="card question" aria-live="polite">
      <div className="q-meta">
        {remaining !== undefined && remaining > 0 && <span>{t("atMost", lang, { n: remaining })}</span>}
      </div>
      <h2 className="q-text">{pick(fact.question, lang)}</h2>
      {fact.help && <p className="muted">{pick(fact.help, lang)}</p>}
      <div className="q-tools">
        {ttsOk && (
          <button type="button" className="btn ghost" onClick={() => speak(pick(fact.question, lang), lang, audio)}>
            🔊 {t("listen", lang)}
          </button>
        )}
        {supported ? (
          <button type="button" className="btn ghost" onClick={listening ? stop : onSpeak} aria-pressed={listening}>
            🎤 {listening ? t("listening", lang) : t("speak", lang)}
          </button>
        ) : (
          <span className="muted small">{t("voiceUnavailable", lang)}</span>
        )}
      </div>

      {heard && heard.answer && (
        <div className="heard">
          <p>
            {t("youSaid", lang)}: <q>{heard.text}</q>
          </p>
          <p>
            {t("weHeard", lang)}: <strong>{answerText(fact, heard.answer, lang)}</strong>
          </p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => onAnswer(heard.answer!)}>
              {t("confirm", lang)}
            </button>
            <button type="button" className="btn" onClick={onSpeak}>
              {t("tryAgain", lang)}
            </button>
          </div>
        </div>
      )}
      {voiceMsg && <p className="notice">{heard?.text ? <><q>{heard.text}</q> — </> : null}{voiceMsg}</p>}

      {fact.type === "multi" && <p className="muted small">{t("chooseAll", lang)}</p>}
      <div className="choices">
        {choices.map((c, i) => {
          const icon = fact.type === "enum" || fact.type === "multi" ? fact.options[i]?.icon : undefined;
          if (fact.type === "multi") {
            const val = fact.options[i].value;
            const on = multi.includes(val);
            return (
              <button
                type="button"
                key={val}
                className={`choice ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => setMulti(on ? multi.filter((x) => x !== val) : [...multi, val])}
              >
                {icon && <span className="icon" aria-hidden>{icon}</span>}
                <span>{labelFor(c, i)}</span>
                <span className="tick" aria-hidden>{on ? "✓" : ""}</span>
              </button>
            );
          }
          return (
            <button type="button" key={i} className={`choice ${same(current, c) ? "on" : ""}`} onClick={() => onAnswer(c)}>
              {icon && <span className="icon" aria-hidden>{icon}</span>}
              <span>{labelFor(c, i)}</span>
            </button>
          );
        })}
      </div>
      {fact.type === "multi" && (
        <button type="button" className="btn primary wide" onClick={() => onAnswer({ kind: "value", value: multi })}>
          {t("next", lang)}
        </button>
      )}
      <div className="row secondary">
        <button type="button" className={`btn ${current?.kind === "unknown" ? "on" : ""}`} onClick={() => onAnswer({ kind: "unknown" })}>
          {t("dontKnow", lang)}
        </button>
        {fact.sensitivity === "high" && (
          <button type="button" className="btn" onClick={() => onAnswer({ kind: "declined" })}>
            {t("preferNot", lang)}
          </button>
        )}
      </div>
      <div className="row nav">
        {canGoBack && (
          <button type="button" className="btn ghost" onClick={onBack}>
            ← {t("back", lang)}
          </button>
        )}
        {onSeeResults && (
          <button type="button" className="btn ghost" onClick={onSeeResults}>
            {t("seeResultsNow", lang)} →
          </button>
        )}
      </div>
    </section>
  );
}
