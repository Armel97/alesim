import type { PracticeLang, Level } from "./language-content";
import type { TimelineEvent } from "./hesitations";

export type PronunciationSession = {
  id: string;
  createdAt: number;
  lang: PracticeLang;
  level: Level;
  reference: string;
  transcript: string;
  accuracy: number;
  fluency: number;
  passed: boolean;
  durationSec?: number;
  fillerCount?: number;
  pauseCount?: number;
  pauseSec?: number;
  timeline?: TimelineEvent[];
};

const KEY = "alesim.pron-history.v1";

export function loadPronunciationSessions(): PronunciationSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PronunciationSession[];
  } catch {
    return [];
  }
}

export function savePronunciationSession(s: PronunciationSession) {
  const all = [s, ...loadPronunciationSessions()].slice(0, 200);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearPronunciationSessions() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
