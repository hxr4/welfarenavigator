"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Segment } from "@/lib/a11y/read-sequence";
import type { Lang } from "@/lib/engine/types";
import { hasClip, newSequence, speechAvailable, stopAllAudio } from "./speech-player";

export { hasClip };

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function getCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface Heard {
  alternatives: string[];
  stopped: boolean;
}

const SOFT_ERRORS = new Set(["no-speech", "aborted", "audio-capture"]);

export function useSpeechInput(lang: Lang) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const ref = useRef<Recognition | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const update = () => setSupported(!!getCtor() && navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      stoppedRef.current = true;
      ref.current?.abort();
    };
  }, []);

  const listen = useCallback(
    () =>
      new Promise<Heard>((resolve, reject) => {
        const Ctor = getCtor();
        if (!Ctor) return reject(new Error("unsupported"));
        ref.current?.abort();
        stoppedRef.current = false;
        const rec = new Ctor();
        rec.lang = lang === "ml" ? "ml-IN" : "en-IN";
        rec.interimResults = false;
        rec.maxAlternatives = 5;
        rec.continuous = false;
        let done = false;
        const finish = (alts: string[]) => {
          if (done) return;
          done = true;
          resolve({ alternatives: alts, stopped: stoppedRef.current });
        };
        const timer = setTimeout(() => rec.abort(), 8000);
        rec.onresult = (e) => finish(Array.from(e.results[0] ?? []).map((a) => a.transcript));
        rec.onerror = (e) => {
          if (SOFT_ERRORS.has(e.error)) return finish([]);
          done = true;
          reject(new Error(e.error));
        };
        rec.onend = () => {
          clearTimeout(timer);
          setListening(false);
          finish([]);
        };
        ref.current = rec;
        setListening(true);
        try {
          rec.start();
        } catch (err) {
          setListening(false);
          done = true;
          reject(err as Error);
        }
      }),
    [lang],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    ref.current?.abort();
    setListening(false);
  }, []);

  return { supported, listening, listen, stop };
}

export interface Utterance {
  text: string;
  clip?: string;
}

export function stopSpeaking() {
  stopAllAudio();
}

export function canRead(lang: Lang, parts: Utterance[]): boolean {
  return speechAvailable(lang, parts.map((p, i) => ({ id: `u${i}`, text: p.text, clip: p.clip })));
}

export function readAloud(lang: Lang, parts: Utterance[], onEnd?: () => void) {
  stopSpeaking();
  const segments: Segment[] = parts.map((p, i) => ({ id: `u${i}`, text: p.text, clip: p.clip }));
  let began = false;
  let ended = false;
  const seq = newSequence(lang, (s) => {
    if (s.playing) began = true;
    if (!ended && !s.playing && (began || s.unavailable)) {
      ended = true;
      onEnd?.();
    }
  });
  seq.start(segments);
}

export function useVoicesReady() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const bump = () => setN((x) => x + 1);
    bump();
    window.speechSynthesis.addEventListener("voiceschanged", bump);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", bump);
  }, []);
  return n;
}
