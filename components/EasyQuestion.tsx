"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReadSequence, ReadState, Segment } from "@/lib/a11y/read-sequence";
import { answerFor, easyOptions, easyReducer, selectionFor, type EasyOption } from "@/lib/easy/options";
import type { Answer, Fact, Lang } from "@/lib/engine/types";
import { pick } from "@/lib/i18n/describe";
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
  autoRead: boolean;
  onAutoRead: (on: boolean) => void;
  canGoBack: boolean;
  onAnswer: (a: Answer) => void;
  onBack: () => void;
  onSeeResults?: () => void;
  allowUnknown?: boolean;
}

export default function EasyQuestion({ fact, choices, lang, current, number, autoRead, onAutoRead, canGoBack, onAnswer, onBack, onSeeResults, allowUnknown = true }: Props) {
  const options = useMemo(() => easyOptions(fact, choices, lang, { allowUnknown }), [fact, choices, lang, allowUnknown]);
  const multi = fact.type === "multi";
  const reducer = useMemo(() => easyReducer(multi, options), [multi, options]);
  const [state, dispatch] = useReducer(reducer, { selected: selectionFor(fact, options, current), speakingId: null });
  const [read, setRead] = useState<ReadState>({ playing: false, speakingId: null, unavailable: false });
  const [announce, setAnnounce] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [voiceMsg, setVoiceMsg] = useState("");
  const seqRef = useRef<ReadSequence | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const voices = useVoicesReady();
  const { supported: micOk, listening, listen, stop: stopListening } = useSpeechInput(lang);

  const segments: Segment[] = useMemo(
    () => [{ id: "question", text: pick(fact.question, lang), clip: `fact.${fact.id}` }, ...options.map((o) => ({ id: o.id, text: o.label, clip: o.clip }))],
    [fact, lang, options],
  );
  const [canSpeak, setCanSpeak] = useState(false);

  useEffect(() => {
    setCanSpeak(speechAvailable(lang, segments));
  }, [lang, segments, voices]);

  useEffect(() => {
    const seq = newSequence(lang, (s) => {
      setRead(s);
      dispatch({ type: "speaking", id: s.speakingId });
    });
    seqRef.current = seq;
    return () => {
      seq.stop();
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, [lang]);

  useEffect(() => {
    heading.current?.focus();
    if (!autoRead) return;
    autoTimer.current = setTimeout(() => {
      autoTimer.current = null;
      if (speechAvailable(lang, segments)) seqRef.current?.start(segments);
    }, 350);
    return () => cancelAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fact.id, lang]);

  function cancelAuto() {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
  }

  function listenAgain() {
    cancelAuto();
    stopListening();
    seqRef.current?.start(segments);
  }

  function stopReading() {
    cancelAuto();
    seqRef.current?.stop();
  }

  function flashOn(id: string) {
    setFlash(id);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 600);
  }

  function choose(o: EasyOption) {
    cancelAuto();
    seqRef.current?.stop();
    stopListening();
    const wasOn = state.selected.includes(o.id);
    dispatch({ type: "select", id: o.id });
    flashOn(o.id);
    setAnnounce(multi && wasOn ? `${t("easyUnselected", lang)}: ${o.label}` : `${t("selected", lang)}: ${o.label}. ${t("easyPressContinue", lang)}`);
  }

  const answer = answerFor(fact, options, state.selected);

  function submit() {
    if (!answer) return;
    cancelAuto();
    seqRef.current?.stop();
    stopListening();
    onAnswer(answer);
  }

  async function byVoice() {
    cancelAuto();
    seqRef.current?.stop();
    setVoiceMsg("");
    try {
      const { alternatives, stopped } = await listen();
      if (stopped) return;
      const m = matchSpeech(alternatives, fact, choices);
      if (!m) return setVoiceMsg(`${alternatives[0] ? `“${alternatives[0]}” — ` : ""}${t("notUnderstood", lang)}`);
      const picked = m.kind === "unknown" ? options.filter((o) => o.kind === "unknown") : m.indices.map((i) => options[i]).filter((o): o is EasyOption => !!o);
      if (picked.length === 0) return setVoiceMsg(t("notUnderstood", lang));
      for (const o of multi ? picked : picked.slice(0, 1)) dispatch({ type: multi ? "add" : "select", id: o.id });
      flashOn(picked[0].id);
      setAnnounce(`${t("selected", lang)}: ${picked.map((o) => o.label).join(", ")}. ${t("easyPressContinue", lang)}`);
    } catch (e) {
      const msg = (e as Error).message;
      setVoiceMsg(msg === "not-allowed" || msg === "service-not-allowed" ? t("micDenied", lang) : t("voiceGaveUp", lang));
    }
  }

  return (
    <section className="easy-q" aria-labelledby={`eq-${fact.id}`}>
      {number !== undefined && <p className="easy-count">{t("questionN", lang, { n: number })}</p>}
      <h1 id={`eq-${fact.id}`} className={`easy-question ${read.speakingId === "question" ? "is-speaking" : ""}`} tabIndex={-1} ref={heading}>
        {read.speakingId === "question" && (
          <span className="speaking-badge">
            <SpeakerIcon /> <span className="sr-only">{t("easyReading", lang)}</span>
          </span>
        )}
        {pick(fact.question, lang)}
      </h1>
      {fact.help && (
        <details className="easy-more">
          <summary>{t("easyMore", lang)}</summary>
          <p>{pick(fact.help, lang)}</p>
        </details>
      )}
      {multi && <p className="easy-hint">{t("easyChooseAll", lang)}</p>}

      <div className="easy-audio" aria-live="polite">
        {!canSpeak || read.unavailable ? (
          <p className="easy-status easy-status-warn">{t("easyNoAudio", lang)}</p>
        ) : read.playing ? (
          <p className="easy-status">
            <SpeakerIcon /> {t("easyReading", lang)}
          </p>
        ) : null}
      </div>

      <div className={`easy-options ${multi ? "is-multi" : ""}`} role="group" aria-labelledby={`eq-${fact.id}`}>
        {options.map((o) => {
          const on = state.selected.includes(o.id);
          const speaking = state.speakingId === o.id;
          return (
            <button
              key={o.id}
              type="button"
              className={`easy-option ${on ? "is-selected" : ""} ${speaking ? "is-speaking" : ""} ${flash === o.id ? "is-flash" : ""} ${o.kind !== "choice" ? "is-aside" : ""}`}
              aria-pressed={on}
              onClick={() => choose(o)}
            >
              <span className="easy-mark" aria-hidden>
                {on ? <CheckIcon /> : speaking ? <SpeakerIcon /> : null}
              </span>
              <span className="easy-label">{o.label}</span>
              <span className="easy-tags">
                {speaking && (
                  <span className="easy-tag easy-tag-speaking">
                    <SpeakerIcon /> {t("easyNowReading", lang)}
                  </span>
                )}
                {on && <span className="easy-tag easy-tag-selected">{t("selected", lang)}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>
      <div aria-live="polite">
        {voiceMsg && <p className="easy-status easy-status-warn">{voiceMsg}</p>}
        {listening && <p className="easy-status">{t("listening", lang)}</p>}
      </div>

      <div className="easy-controls">
        <button type="button" className="easy-btn" onClick={onBack} disabled={!canGoBack}>
          <span aria-hidden>←</span> {t("back", lang)}
        </button>
        {canSpeak && (
          <button type="button" className="easy-btn" onClick={read.playing ? stopReading : listenAgain}>
            <SpeakerIcon /> {read.playing ? t("stop", lang) : t("easyListenAgain", lang)}
          </button>
        )}
        <button type="button" className="easy-btn easy-btn-go" onClick={submit} disabled={!answer}>
          {t("continue", lang)} <span aria-hidden>→</span>
        </button>
      </div>

      <div className="easy-extra">
        {micOk && (
          <button type="button" className="easy-btn easy-btn-quiet" onClick={listening ? stopListening : byVoice}>
            <MicIcon /> {listening ? t("stop", lang) : t("speak", lang)}
          </button>
        )}
        {micOk && <p className="note easy-voice-note">{t("voicePrivacy", lang)}</p>}
        {canSpeak && (
          <label className="easy-toggle">
            <input type="checkbox" checked={autoRead} onChange={(e) => onAutoRead(e.target.checked)} />
            <span>{t("easyAutoRead", lang)}</span>
          </label>
        )}
        {onSeeResults && (
          <button type="button" className="btn btn-link" onClick={onSeeResults}>
            {t("seeResultsNow", lang)} →
          </button>
        )}
      </div>
    </section>
  );
}
