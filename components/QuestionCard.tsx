"use client";

import { useEffect, useRef, useState } from "react";
import type { Answer, Fact, Lang } from "@/lib/engine/types";
import { answerText, pick } from "@/lib/i18n/describe";
import { t } from "@/lib/i18n/strings";
import { matchSpeech } from "@/lib/voice/match";
import { canRead, readAloud, stopSpeaking, useSpeechInput, useVoicesReady, type Utterance } from "./useSpeech";
import { MicIcon, SpeakerIcon } from "./icons";

interface Props {
  fact: Fact;
  choices: Answer[];
  lang: Lang;
  current?: Answer;
  number?: number;
  remaining?: number;
  canGoBack: boolean;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
  onSeeResults?: () => void;
  allowUnknown?: boolean;
}

const MAX_VOICE_TRIES = 2;

function same(a: Answer | undefined, b: Answer): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

export default function QuestionCard({ fact, choices, lang, current, number, remaining, canGoBack, onAnswer, onBack, onSeeResults, allowUnknown = true }: Props) {
  const [multi, setMulti] = useState<string[]>(current?.kind === "value" && Array.isArray(current.value) ? current.value : []);
  const [heard, setHeard] = useState<{ text: string; answer: Answer } | null>(null);
  const [voiceMsg, setVoiceMsg] = useState("");
  const [tries, setTries] = useState(0);
  const [reading, setReading] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { supported, listening, listen, stop } = useSpeechInput(lang);
  const voicesTick = useVoicesReady();
  const [readable, setReadable] = useState(false);

  useEffect(() => {
    heading.current?.focus();
    return () => stopSpeaking();
  }, []);

  const labelFor = (c: Answer, i: number) => {
    if (fact.type === "boolean") return t(i === 0 ? "yes" : "no", lang);
    if (fact.type === "number") return answerText(fact, c, lang);
    return pick(fact.options[i].label, lang);
  };
  const clipFor = (i: number) => {
    if (fact.type === "boolean") return i === 0 ? "option.yes" : "option.no";
    if (fact.type === "number") return undefined;
    return `option.${fact.id}.${fact.options[i].value}`;
  };
  const parts: Utterance[] = [
    { text: pick(fact.question, lang), clip: `fact.${fact.id}` },
    ...choices.map((c, i) => ({ text: labelFor(c, i), clip: clipFor(i) })),
    { text: t("dontKnow", lang), clip: "option.unknown" },
  ];
  useEffect(() => {
    setReadable(canRead(lang, parts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, fact.id, voicesTick]);
  const gaveUp = tries >= MAX_VOICE_TRIES;

  function toggleRead() {
    if (reading) {
      stopSpeaking();
      setReading(false);
      return;
    }
    setReading(true);
    readAloud(lang, parts, () => setReading(false));
  }

  async function onSpeak() {
    stopSpeaking();
    setReading(false);
    setHeard(null);
    setVoiceMsg("");
    try {
      const alts = await listen();
      const m = matchSpeech(alts, fact, choices);
      const text = alts[0] ?? "";
      if (!m) {
        const n = tries + 1;
        setTries(n);
        setVoiceMsg(n >= MAX_VOICE_TRIES ? t("voiceGaveUp", lang) : `${text ? `“${text}” — ` : ""}${t("notUnderstood", lang)}`);
        return;
      }
      if (m.kind === "unknown") return setHeard({ text, answer: { kind: "unknown" } });
      if (fact.type === "multi") return setHeard({ text, answer: { kind: "value", value: m.indices.map((i) => fact.options[i].value) } });
      setHeard({ text, answer: choices[m.indices[0]] });
    } catch (e) {
      const msg = (e as Error).message;
      setTries(MAX_VOICE_TRIES);
      setVoiceMsg(msg === "not-allowed" || msg === "service-not-allowed" ? t("micDenied", lang) : t("voiceGaveUp", lang));
    }
  }

  return (
    <section className="panel" aria-labelledby={`q-${fact.id}`}>
      {number !== undefined && (
        <p className="eyebrow">
          {t("questionN", lang, { n: number })}
          {remaining !== undefined && remaining > 1 ? ` · ${t("atMost", lang, { n: remaining - 1 })}` : ""}
        </p>
      )}
      <h1 id={`q-${fact.id}`} className="q-text" tabIndex={-1} ref={heading}>
        {pick(fact.question, lang)}
      </h1>
      {fact.help && <p className="help">{pick(fact.help, lang)}</p>}

      <div className="tools">
        {readable ? (
          <button type="button" className="btn btn-quiet" onClick={toggleRead} aria-pressed={reading}>
            <SpeakerIcon /> {reading ? t("stop", lang) : t("listen", lang)}
          </button>
        ) : (
          <span className="note">{t("ttsUnavailable", lang)}</span>
        )}
        {supported && !gaveUp && (
          <button type="button" className="btn btn-quiet" onClick={listening ? stop : onSpeak} aria-pressed={listening}>
            <MicIcon /> {listening ? t("stop", lang) : t("speak", lang)}
          </button>
        )}
        {!supported && <span className="note">{t("voiceUnavailable", lang)}</span>}
      </div>

      <div aria-live="polite" className="live">
        {listening && <p className="status">{t("listening", lang)}</p>}
        {voiceMsg && <p className="status status-warn">{voiceMsg}</p>}
        {heard && (
          <div className="confirm">
            <p>
              {t("youSaid", lang)}: <q>{heard.text}</q>
            </p>
            <p>
              {t("weUnderstood", lang)}: <strong>{answerText(fact, heard.answer, lang)}</strong>
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={() => onAnswer(heard.answer)}>
                {t("confirm", lang)}
              </button>
              <button type="button" className="btn" onClick={() => setHeard(null)}>
                {t("change", lang)}
              </button>
            </div>
          </div>
        )}
      </div>

      {fact.type === "multi" && !fact.help && <p className="help">{t("chooseAll", lang)}</p>}
      <div className="choices" role={fact.type === "multi" ? "group" : undefined} aria-labelledby={`q-${fact.id}`}>
        {choices.map((c, i) => {
          if (fact.type === "multi") {
            const val = fact.options[i].value;
            const on = multi.includes(val);
            return (
              <button
                type="button"
                key={val}
                className={`choice ${on ? "is-on" : ""}`}
                aria-pressed={on}
                onClick={() => setMulti(on ? multi.filter((x) => x !== val) : [...multi, val])}
              >
                <span className="box" aria-hidden>{on ? "✓" : ""}</span>
                <span>{labelFor(c, i)}</span>
              </button>
            );
          }
          const on = same(current, c);
          return (
            <button type="button" key={i} className={`choice ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => onAnswer(c)}>
              <span>{labelFor(c, i)}</span>
            </button>
          );
        })}
      </div>
      {fact.type === "multi" && (
        <button
          type="button"
          className="btn btn-primary btn-wide"
          disabled={multi.length === 0}
          onClick={() => onAnswer({ kind: "value", value: multi })}
        >
          {t("continue", lang)}
        </button>
      )}
      <div className="row">
        {allowUnknown && (
          <button type="button" className={`btn ${current?.kind === "unknown" ? "is-on" : ""}`} onClick={() => onAnswer({ kind: "unknown" })}>
            {t("dontKnow", lang)}
          </button>
        )}
        {fact.sensitivity === "high" && (
          <button type="button" className={`btn ${current?.kind === "declined" ? "is-on" : ""}`} onClick={() => onAnswer({ kind: "declined" })}>
            {t("preferNot", lang)}
          </button>
        )}
      </div>
      <nav className="row row-split" aria-label="Question navigation">
        {canGoBack ? (
          <button type="button" className="btn btn-link" onClick={onBack}>
            ← {t("back", lang)}
          </button>
        ) : (
          <span />
        )}
        {onSeeResults && (
          <button type="button" className="btn btn-link" onClick={onSeeResults}>
            {t("seeResultsNow", lang)} →
          </button>
        )}
      </nav>
    </section>
  );
}
