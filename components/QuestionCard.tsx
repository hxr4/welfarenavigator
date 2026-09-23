"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReadSequence, ReadState, Segment } from "@/lib/a11y/read-sequence";
import { easyOptions } from "@/lib/easy/options";
import type { Answer, Fact, Lang } from "@/lib/engine/types";
import { answerText, pick } from "@/lib/i18n/describe";
import { t } from "@/lib/i18n/strings";
import { matchSpeech } from "@/lib/voice/match";
import { newSequence, speechAvailable } from "./speech-player";
import { useSpeechInput, useVoicesReady } from "./useSpeech";
import { CheckIcon, MicIcon, SpeakerIcon } from "./icons";

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
  const [read, setRead] = useState<ReadState>({ playing: false, speakingId: null, unavailable: false });
  const [readable, setReadable] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const seqRef = useRef<ReadSequence | null>(null);
  const { supported, listening, listen, stop } = useSpeechInput(lang);
  const voicesTick = useVoicesReady();

  const options = useMemo(() => easyOptions(fact, choices, lang, { allowUnknown }), [fact, choices, lang, allowUnknown]);
  const choiceOptions = options.filter((o) => o.kind === "choice");
  const segments: Segment[] = useMemo(
    () => [{ id: "question", text: pick(fact.question, lang), clip: `fact.${fact.id}` }, ...options.map((o) => ({ id: o.id, text: o.label, clip: o.clip }))],
    [fact, lang, options],
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    const seq = newSequence(lang, setRead);
    seqRef.current = seq;
    return () => seq.stop();
  }, [lang]);

  useEffect(() => {
    setReadable(speechAvailable(lang, segments));
  }, [lang, segments, voicesTick]);

  const gaveUp = tries >= MAX_VOICE_TRIES;

  function toggleRead() {
    if (read.playing) return seqRef.current?.stop();
    stop();
    seqRef.current?.start(segments);
  }

  function pickAnswer(a: Answer) {
    seqRef.current?.stop();
    stop();
    onAnswer(a);
  }

  function failTry(text: string) {
    const n = tries + 1;
    setTries(n);
    setVoiceMsg(n >= MAX_VOICE_TRIES ? t("voiceGaveUp", lang) : `${text ? `“${text}” — ` : ""}${t("notUnderstood", lang)}`);
  }

  async function onSpeak() {
    seqRef.current?.stop();
    setHeard(null);
    setVoiceMsg("");
    try {
      const { alternatives, stopped } = await listen();
      if (stopped) return;
      const text = alternatives[0] ?? "";
      const m = matchSpeech(alternatives, fact, choices);
      if (!m) return failTry(text);
      if (m.kind === "unknown") return setHeard({ text, answer: { kind: "unknown" } });
      if (fact.type === "multi") return setHeard({ text, answer: { kind: "value", value: m.indices.map((i) => fact.options[i].value) } });
      setHeard({ text, answer: choices[m.indices[0]] });
    } catch (e) {
      const msg = (e as Error).message;
      setTries(MAX_VOICE_TRIES);
      setVoiceMsg(msg === "not-allowed" || msg === "service-not-allowed" ? t("micDenied", lang) : t("voiceGaveUp", lang));
    }
  }

  const speaking = (id: string) => read.speakingId === id;
  const unknownOpt = options.find((o) => o.kind === "unknown");
  const declinedOpt = options.find((o) => o.kind === "declined");

  return (
    <section className="panel" aria-labelledby={`q-${fact.id}`}>
      {number !== undefined && (
        <p className="eyebrow">
          {t("questionN", lang, { n: number })}
          {remaining !== undefined && remaining > 1 ? ` · ${t("atMost", lang, { n: remaining - 1 })}` : ""}
        </p>
      )}
      <h1 id={`q-${fact.id}`} className={`q-text ${speaking("question") ? "is-speaking-text" : ""}`} tabIndex={-1} ref={heading}>
        {pick(fact.question, lang)}
      </h1>
      {fact.help && <p className="help">{pick(fact.help, lang)}</p>}

      <div className="tools">
        {readable ? (
          <button type="button" className="btn btn-quiet" onClick={toggleRead}>
            <SpeakerIcon /> {read.playing ? t("stop", lang) : t("listen", lang)}
          </button>
        ) : (
          <span className="note">{t("ttsUnavailable", lang)}</span>
        )}
        {supported && !gaveUp && (
          <button type="button" className="btn btn-quiet" onClick={listening ? stop : onSpeak}>
            <MicIcon /> {listening ? t("stop", lang) : t("speak", lang)}
          </button>
        )}
        {!supported && <span className="note">{t("voiceUnavailable", lang)}</span>}
      </div>
      {supported && !gaveUp && <p className="note">{t("voicePrivacy", lang)}</p>}

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
              <button type="button" className="btn btn-primary" onClick={() => pickAnswer(heard.answer)}>
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
        {choiceOptions.map((o, i) => {
          const c = choices[i];
          if (fact.type === "multi") {
            const val = o.value as string;
            const on = multi.includes(val);
            return (
              <button
                type="button"
                key={val}
                className={`choice ${on ? "is-on" : ""} ${speaking(o.id) ? "is-speaking" : ""}`}
                aria-pressed={on}
                onClick={() => setMulti(on ? multi.filter((x) => x !== val) : val === "none" ? [val] : [...multi.filter((x) => x !== "none"), val])}
              >
                <span className="box" aria-hidden>
                  {on ? "✓" : ""}
                </span>
                <span>{o.label}</span>
              </button>
            );
          }
          const on = same(current, c);
          return (
            <button type="button" key={o.id} className={`choice ${on ? "is-on" : ""} ${speaking(o.id) ? "is-speaking" : ""}`} aria-pressed={on} onClick={() => pickAnswer(c)}>
              {on && <CheckIcon />}
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
      {fact.type === "multi" && (
        <button type="button" className="btn btn-primary btn-wide" disabled={multi.length === 0} onClick={() => pickAnswer({ kind: "value", value: multi })}>
          {t("continue", lang)}
        </button>
      )}
      <div className="row">
        {unknownOpt && (
          <button
            type="button"
            className={`btn ${current?.kind === "unknown" ? "is-on" : ""} ${speaking(unknownOpt.id) ? "is-speaking" : ""}`}
            aria-pressed={current?.kind === "unknown"}
            onClick={() => pickAnswer({ kind: "unknown" })}
          >
            {current?.kind === "unknown" && <CheckIcon />}
            {t("dontKnow", lang)}
          </button>
        )}
        {declinedOpt && (
          <button
            type="button"
            className={`btn ${current?.kind === "declined" ? "is-on" : ""} ${speaking(declinedOpt.id) ? "is-speaking" : ""}`}
            aria-pressed={current?.kind === "declined"}
            onClick={() => pickAnswer({ kind: "declined" })}
          >
            {current?.kind === "declined" && <CheckIcon />}
            {t("preferNot", lang)}
          </button>
        )}
      </div>
      <nav className="row row-split" aria-label={t("questionNav", lang)}>
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
