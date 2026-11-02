import type { PracticeLang } from "./language-content";

// Filler patterns per practice language (word-boundary, case-insensitive).
const FILLERS: Record<PracticeLang, RegExp[]> = {
  en: [/\b(um+|uh+|erm*|hm+|mhm+|like|you know|i mean|sort of|kind of|well)\b/gi],
  es: [/\b(eh+|em+|este|esto|o sea|pues|bueno|digamos|a ver)\b/gi],
  de: [/\b(äh+|ähm+|ehm+|halt|also|naja|quasi|sozusagen)\b/gi],
  it: [/\b(ehm+|mhm+|cioè|tipo|allora|insomma|diciamo|boh)\b/gi],
  pt: [/\b(é+|hum+|tipo|então|bem|assim|sabe|quer dizer)\b/gi],
};

// Rough speaking rate baselines (words per second) used to estimate
// how much of the recording was silence / pausing.
const WPS: Record<PracticeLang, number> = {
  en: 2.5,
  es: 2.8,
  de: 2.3,
  it: 2.6,
  pt: 2.6,
};

export type HesitationStats = {
  fillerCount: number;
  pauseCount: number;
  pauseSec: number;
  durationSec: number;
};

export type TimelineEvent = {
  type: "filler" | "pause" | "speech";
  start: number;
  end: number;
  label?: string;
};

// Any inter-word gap longer than this is treated as a pause event.
const PAUSE_THRESHOLD_SEC = 0.45;

function isFillerWord(word: string, lang: PracticeLang): boolean {
  const w = word.toLowerCase().replace(/[^\p{L}]/gu, "");
  if (!w) return false;
  for (const rx of FILLERS[lang] ?? []) {
    rx.lastIndex = 0;
    if (new RegExp(rx.source, "i").test(w)) return true;
  }
  return false;
}

/**
 * Build a per-recording timeline of speech, filler and pause events from
 * word-level timestamps returned by the transcription service.
 */
export function computeTimeline(
  words: { word: string; start: number; end: number }[],
  durationSec: number,
  lang: PracticeLang,
): TimelineEvent[] {
  if (!words.length) return [];
  const events: TimelineEvent[] = [];
  let cursor = 0;
  for (const w of words) {
    const gap = w.start - cursor;
    if (gap >= PAUSE_THRESHOLD_SEC) {
      events.push({ type: "pause", start: cursor, end: w.start });
    }
    if (isFillerWord(w.word, lang)) {
      events.push({
        type: "filler",
        start: w.start,
        end: w.end,
        label: w.word,
      });
    } else {
      events.push({
        type: "speech",
        start: w.start,
        end: w.end,
        label: w.word,
      });
    }
    cursor = w.end;
  }
  if (durationSec - cursor >= PAUSE_THRESHOLD_SEC) {
    events.push({ type: "pause", start: cursor, end: durationSec });
  }
  return events;
}

export function timelineHesitationStats(
  events: TimelineEvent[],
  durationSec: number,
): HesitationStats {
  const fillers = events.filter((e) => e.type === "filler");
  const pauses = events.filter((e) => e.type === "pause");
  const pauseSec = pauses.reduce((s, e) => s + (e.end - e.start), 0);
  return {
    fillerCount: fillers.length,
    pauseCount: pauses.length,
    pauseSec: Math.round(pauseSec * 10) / 10,
    durationSec: Math.round(durationSec * 10) / 10,
  };
}

export function computeHesitations(
  transcript: string,
  durationSec: number,
  lang: PracticeLang,
): HesitationStats {
  const patterns = FILLERS[lang] ?? [];
  let fillerCount = 0;
  for (const rx of patterns) {
    const m = transcript.match(rx);
    if (m) fillerCount += m.length;
  }

  // Explicit pause markers left by the transcriber (…, ..., long dashes).
  const explicit = transcript.match(/(\.{3,}|…|—{1,})/g);
  let pauseCount = explicit ? explicit.length : 0;

  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const expected = words / (WPS[lang] ?? 2.5);
  const gap = Math.max(0, durationSec - expected);
  // Estimate a hesitation-pause every ~1.2s of unexplained silence.
  const estimated = Math.floor(gap / 1.2);
  pauseCount += estimated;

  return {
    fillerCount,
    pauseCount,
    pauseSec: Math.round(gap * 10) / 10,
    durationSec: Math.round(durationSec * 10) / 10,
  };
}
