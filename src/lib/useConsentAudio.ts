"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Language } from "@/lib/demo-consent";

export function splitConsentAudio(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining) {
    const limit = chunks.length ? 650 : 180;
    let end = Math.min(limit, remaining.length);
    if (end < remaining.length) {
      const sentence = Math.max(remaining.lastIndexOf(". ", end - 1), remaining.lastIndexOf("। ", end - 1), remaining.lastIndexOf("\n", end - 1));
      const space = remaining.lastIndexOf(" ", end);
      if (sentence >= limit / 3) end = sentence + 1;
      else if (space > 0) end = space;
    }
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trimStart();
  }
  return chunks;
}

function deviceVoice(language: Language) {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis.getVoices().find(voice => voice.localService && voice.lang.toLowerCase().split(/[-_]/)[0] === language)
    : undefined;
}

type AudioResult = { audios: string[] };
export function useConsentAudio(patientId: string) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const player = useRef<HTMLAudioElement | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const finish = useRef<(() => void) | null>(null);
  const cache = useRef(new Map<string, Promise<AudioResult>>());
  const requests = useRef(new Set<AbortController>());

  const cancel = useCallback(() => {
    generation.current++;
    player.current?.pause();
    if (utterance.current) window.speechSynthesis.cancel();
    finish.current?.();
    finish.current = null;
    utterance.current = null;
  }, []);
  const stop = useCallback(() => { cancel(); setState("idle"); }, [cancel]);
  useEffect(() => {
    const pending = requests.current;
    const entries = cache.current;
    return () => { cancel(); for (const controller of pending) controller.abort(); pending.clear(); entries.clear(); };
  }, [patientId, cancel]);

  const load = useCallback((text: string, language: Language) => {
    const key = `${patientId}:${language}:${text}`;
    const existing = cache.current.get(key);
    if (existing) return existing;
    const controller = new AbortController();
    requests.current.add(controller);
    const result = apiFetch<AudioResult>(`/patients/${patientId}/consent-audio`, {
      method: "POST", body: JSON.stringify({ text, language }),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]),
    }).then(value => {
      if (!value.audios?.length) throw new Error("No audio was returned. Please retry.");
      return value;
    }).catch(reason => { cache.current.delete(key); throw reason; })
      .finally(() => requests.current.delete(controller));
    if (cache.current.size >= 12) cache.current.delete(cache.current.keys().next().value!);
    cache.current.set(key, result);
    return result;
  }, [patientId]);

  const preload = useCallback((text: string, language: Language) => {
    if (deviceVoice(language)) return;
    const first = splitConsentAudio(text)[0];
    if (first) void load(first, language).catch(() => undefined);
  }, [load]);

  const play = useCallback(async (text: string, language: Language) => {
    cancel(); const current = generation.current; setState("loading"); setError("");
    const chunks = splitConsentAudio(text);
    try {
      const voice = deviceVoice(language);
      if (voice) {
        let started = false;
        try {
          for (const chunk of chunks) {
            if (current !== generation.current) return;
            await new Promise<void>((resolve, reject) => {
              const speech = new SpeechSynthesisUtterance(chunk); utterance.current = speech;
              speech.voice = voice; speech.lang = language === "hi" ? "hi-IN" : "en-IN";
              const timeout = window.setTimeout(() => { window.speechSynthesis.cancel(); reject(new Error("Device speech did not start")); }, 1500);
              const done = () => { window.clearTimeout(timeout); resolve(); };
              finish.current = done;
              speech.onstart = () => { window.clearTimeout(timeout); if (current === generation.current) { started = true; setState("playing"); } };
              speech.onend = done;
              speech.onerror = () => { window.clearTimeout(timeout); reject(new Error("Device speech unavailable")); };
              window.speechSynthesis.speak(speech);
            });
          }
          return;
        } catch (reason) {
          if (current !== generation.current) return;
          if (started) throw reason;
          // A missing/broken device voice falls back to the configured speech provider.
        } finally { utterance.current = null; }
      }
      // Request one clip ahead while the current clip plays; never wait for the full form.
      const prepare = (index: number) => load(chunks[index], language).then(value => ({value, error: null})).catch(error => ({value: null, error}));
      let prepared = chunks.length ? prepare(0) : null;
      for (let index = 0; index < chunks.length; index++) {
        if (current !== generation.current) return;
        const result = await prepared!;
        if (current !== generation.current) return;
        if (result.error || !result.value) throw result.error || new Error("Audio unavailable");
        prepared = index + 1 < chunks.length ? prepare(index + 1) : null;
        for (const encoded of result.value.audios) {
          if (current !== generation.current) return;
          const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], {type:"audio/wav"}));
          try {
            const audio = new Audio(url); player.current = audio;
            await new Promise<void>((resolve, reject) => {
              finish.current = resolve;
              audio.onplaying = () => { if (current === generation.current) setState("playing"); };
              audio.onended = () => resolve();
              audio.onerror = () => reject(new Error("Unable to play audio. Please retry."));
              void audio.play().catch(reject);
            });
          } finally { URL.revokeObjectURL(url); }
        }
      }
    } catch (reason) {
      if (current === generation.current) setError(reason instanceof Error && reason.name !== "TimeoutError" ? reason.message : language === "hi" ? "ऑडियो तैयार होने में अधिक समय लग रहा है। फिर प्रयास करें।" : "Audio is taking too long. Please retry.");
    } finally { if (current === generation.current) setState("idle"); }
  }, [cancel, load]);
  return { state, error, play, stop, preload };
}
