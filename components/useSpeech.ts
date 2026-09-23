"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import manifest from "@/data/audio-manifest.json";
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

export function useSpeechInput(lang: Lang) {
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
        const timer = setTimeout(() => rec.abort(), 8000);
        rec.onresult = (e) => {
          done = true;
          resolve(Array.from(e.results[0] ?? []).map((a) => a.transcript));
        };
        rec.onerror = (e) => {
          done = true;
          reject(new Error(e.error));
        };
        rec.onend = () => {
          clearTimeout(timer);
          setListening(false);
          if (!done) resolve([]);
        };
        ref.current = rec;
        setListening(true);
        try {
          rec.start();
        } catch (err) {
          setListening(false);
          reject(err as Error);
        }
      }),
    [lang],
  );

  const stop = useCallback(() => {
    ref.current?.abort();
    setListening(false);
  }, []);

  return { supported, listening, listen, stop };
}

const clips = new Set<string>((manifest as { ml: string[] }).ml);

export function hasClip(key: string): boolean {
  return clips.has(key);
}

function browserVoice(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === "ml" ? "ml" : "en"));
}

export interface Utterance {
  text: string;
  clip?: string;
}

let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  current?.pause();
  current = null;
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function canRead(lang: Lang, parts: Utterance[]): boolean {
  if (typeof window === "undefined") return false;
  if (lang === "ml" && parts.length > 0 && parts.every((p) => p.clip && hasClip(p.clip))) return true;
  return !!browserVoice(lang);
}

export function readAloud(lang: Lang, parts: Utterance[], onEnd?: () => void) {
  stopSpeaking();
  if (lang === "ml" && parts.every((p) => p.clip && hasClip(p.clip))) {
    const queue = [...parts];
    const next = () => {
      const p = queue.shift();
      if (!p) return onEnd?.();
      current = new Audio(`/audio/ml/${p.clip}.mp3`);
      current.onended = next;
      current.onerror = next;
      current.play().catch(() => onEnd?.());
    };
    next();
    return;
  }
  const voice = browserVoice(lang);
  if (!voice) return onEnd?.();
  const u = new SpeechSynthesisUtterance(parts.map((p) => p.text).join(". "));
  u.lang = voice.lang;
  u.voice = voice;
  u.rate = 0.9;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.speak(u);
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
