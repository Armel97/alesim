import type { FeedbackResult } from "./alesim.functions";

export type Session = {
  id: string;
  createdAt: number;
  durationSec: number;
  transcript: string;
  prompt?: string;
  feedback: FeedbackResult;
  lang: "fr" | "en";
};

const KEY = "alesim.sessions.v1";

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

export function saveSession(s: Session) {
  const all = [s, ...loadSessions()].slice(0, 100);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteSession(id: string) {
  const all = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}
