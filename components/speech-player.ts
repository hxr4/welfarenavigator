"use client";

import manifest from "@/data/audio-manifest.json";
import { ReadSequence, type Segment, type SegmentEvents, type SegmentPlayer } from "@/lib/a11y/read-sequence";
import type { Lang } from "@/lib/engine/types";

const CLIPS: Record<Lang, Set<string>> = {
  ml: new Set((manifest as { ml?: string[] }).ml ?? []),
  en: new Set((manifest as { en?: string[] }).en ?? []),
};

export function hasClip(key: string, lang: Lang = "ml"): boolean {
  return CLIPS[lang].has(key);
}

const live = new Set<() => void>();

export function stopAllAudio() {
  for (const stop of [...live]) stop();
  live.clear();
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const want = lang === "ml" ? "ml" : "en";
  return voices.find((v) => v.lang.toLowerCase() === (lang === "ml" ? "ml-in" : "en-in")) ?? voices.find((v) => v.lang.toLowerCase().startsWith(want));
}

function clipFor(lang: Lang, seg: Segment): string | null {
  return seg.clip && hasClip(seg.clip, lang) ? `/audio/${lang}/${seg.clip}.mp3` : null;
}

function playClip(src: string, ev: SegmentEvents): () => void {
  const audio = new Audio(src);
  let on = true;
  const cancel = () => {
    on = false;
    live.delete(cancel);
    audio.pause();
    audio.removeAttribute("src");
  };
  live.add(cancel);
  audio.onplaying = () => on && ev.onStart();
  audio.onended = () => {
    live.delete(cancel);
    if (on) ev.onEnd();
  };
  audio.onerror = () => {
    live.delete(cancel);
    if (on) ev.onError();
  };
  audio.play().catch(() => on && ev.onError());
  return cancel;
}

function playVoice(voice: SpeechSynthesisVoice, text: string, rate: number, ev: SegmentEvents): () => void {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  let on = true;
  let started = false;
  const start = () => {
    if (!on || started) return;
    started = true;
    ev.onStart();
  };
  const startFallback = setTimeout(start, 700);
  const endFallback = setTimeout(() => on && ev.onEnd(), 2500 + text.length * 140);
  const clear = () => {
    clearTimeout(startFallback);
    clearTimeout(endFallback);
  };
  const cancel = () => {
    on = false;
    clear();
    live.delete(cancel);
    synth.cancel();
  };
  live.add(cancel);
  u.onstart = start;
  u.onend = () => {
    clear();
    live.delete(cancel);
    if (on) ev.onEnd();
  };
  u.onerror = (e) => {
    clear();
    live.delete(cancel);
    if (on) (e.error === "interrupted" || e.error === "canceled" ? ev.onEnd : ev.onError)();
  };
  synth.speak(u);
  return cancel;
}

export function browserPlayer(lang: Lang, rate = 0.85): SegmentPlayer {
  return {
    available: (seg) => !!clipFor(lang, seg) || !!voiceFor(lang),
    play: (seg, ev) => {
      const src = clipFor(lang, seg);
      if (src) return playClip(src, ev);
      const voice = voiceFor(lang);
      if (!voice) {
        ev.onError();
        return () => {};
      }
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
      return playVoice(voice, seg.text, rate, ev);
    },
  };
}

export function speechAvailable(lang: Lang, segments: Segment[]): boolean {
  if (typeof window === "undefined") return false;
  return segments.some((s) => !!clipFor(lang, s)) || !!voiceFor(lang);
}

export function newSequence(lang: Lang, onChange: ConstructorParameters<typeof ReadSequence>[1]): ReadSequence {
  return new ReadSequence(browserPlayer(lang), onChange);
}
