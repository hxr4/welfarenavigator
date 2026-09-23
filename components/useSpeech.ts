"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/engine/types";

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

export function useSpeech(lang: Lang) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const ref = useRef<Recognition | null>(null);

  useEffect(() => {
    const update = () => setSupported(!!getCtor() && navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      ref.current?.abort();
    };
  }, []);

  const listen = useCallback(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const Ctor = getCtor();
        if (!Ctor) return reject(new Error("unsupported"));
        ref.current?.abort();
        const rec = new Ctor();
        rec.lang = lang === "ml" ? "ml-IN" : "en-IN";
        rec.interimResults = false;
        rec.maxAlternatives = 5;
        rec.continuous = false;
        let done = false;
        rec.onresult = (e) => {
          done = true;
          const alts = Array.from(e.results[0] ?? []).map((a) => a.transcript);
          resolve(alts);
        };
        rec.onerror = (e) => {
          done = true;
          reject(new Error(e.error));
        };
        rec.onend = () => {
          setListening(false);
          if (!done) resolve([]);
        };
        ref.current = rec;
        setListening(true);
        rec.start();
      }),
    [lang],
  );

  const stop = useCallback(() => {
    ref.current?.abort();
    setListening(false);
  }, []);

  return { supported, listening, listen, stop };
}

export function speak(text: string, lang: Lang, audioFile?: string) {
  if (typeof window === "undefined") return;
  if (audioFile) {
    new Audio(`/audio/${audioFile}`).play().catch(() => undefined);
    return;
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "ml" ? "ml-IN" : "en-IN";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

export function canSpeak(lang: Lang, audioFile?: string): boolean {
  if (audioFile) return true;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return window.speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith(lang));
}
