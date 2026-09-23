"use client";

import type { Segment, SegmentEvents, SegmentPlayer } from "@/lib/a11y/read-sequence";
import type { Lang } from "@/lib/engine/types";
import { hasClip } from "./useSpeech";

function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === "ml" ? "ml" : "en"));
}

function clipFor(lang: Lang, seg: Segment): string | null {
  return lang === "ml" && seg.clip && hasClip(seg.clip) ? `/audio/ml/${seg.clip}.mp3` : null;
}

function playClip(src: string, ev: SegmentEvents): () => void {
  const audio = new Audio(src);
  let live = true;
  audio.onplaying = () => live && ev.onStart();
  audio.onended = () => live && ev.onEnd();
  audio.onerror = () => live && ev.onError();
  audio.play().catch(() => live && ev.onError());
  return () => {
    live = false;
    audio.pause();
    audio.src = "";
  };
}

function playVoice(voice: SpeechSynthesisVoice, text: string, rate: number, ev: SegmentEvents): () => void {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  let live = true;
  let started = false;
  const start = () => {
    if (!live || started) return;
    started = true;
    ev.onStart();
  };
  const startFallback = setTimeout(start, 700);
  const endFallback = setTimeout(() => live && ev.onEnd(), 2500 + text.length * 140);
  const finish = (fn: () => void) => {
    clearTimeout(startFallback);
    clearTimeout(endFallback);
    if (live) fn();
  };
  u.onstart = start;
  u.onend = () => finish(ev.onEnd);
  u.onerror = (e) => finish(e.error === "interrupted" || e.error === "canceled" ? ev.onEnd : ev.onError);
  synth.speak(u);
  return () => {
    live = false;
    clearTimeout(startFallback);
    clearTimeout(endFallback);
    synth.cancel();
  };
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
