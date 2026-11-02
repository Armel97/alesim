// Precise hesitation detector fed by Whisper word-level timestamps.
// Detects three families of hesitations for the main audio module (FR/EN):
//   - fillers ("euh", "hum", "du coup" used as filler, "you know"...)
//   - long silent pauses (> ~1.6s mid-sentence, ignoring natural punctuation)
//   - immediate repetitions ("je je pense", "c'est-c'est important")

export type HesitationType = "filler" | "long_pause" | "repetition";

export type Hesitation = {
  type: HesitationType;
  /** Word that triggered the hesitation (or "…" for a pause). */
  text: string;
  /** Small phrase around the hesitation for context. */
  context: string;
  /** Index of the anchor word in the words array. -1 for standalone pauses. */
  wordIndex: number;
  start: number;
  end: number;
  /** Extra info: for pauses, silence duration; for repetitions, repeated count. */
  extra?: { pauseSec?: number; repeatCount?: number };
};

export type HesitationAnalysis = {
  hesitations: Hesitation[];
  total: number;
  perMinute: number;
  breakdown: { filler: number; long_pause: number; repetition: number };
};

// Multi-word "soft fillers" — matched on the joined transcript.
const FILLERS_MULTI: Record<"fr" | "en", string[]> = {
  fr: ["du coup", "en fait", "tu vois", "tu sais", "genre quoi", "voilà voilà"],
  en: ["you know", "i mean", "sort of", "kind of", "sort of like", "you see"],
};

// Single-token fillers.
const FILLERS_SINGLE: Record<"fr" | "en", RegExp> = {
  fr: /^(euh+|euhm+|heu+|hum+|hm+|mh+|bah|ben|voilà|quoi|genre)$/i,
  en: /^(um+|uh+|erm+|hmm+|mhm+|like|well|basically|actually|literally)$/i,
};

const LONG_PAUSE_SEC = 1.6;
// If the previous word ends with strong punctuation we don't count the pause.
const STRONG_PUNCT = /[.!?…]"?$/;

function stripPunct(w: string) {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}'-]/gu, "");
}

function contextAround(words: { word: string }[], i: number, span = 3) {
  const from = Math.max(0, i - span);
  const to = Math.min(words.length, i + span + 1);
  return words
    .slice(from, to)
    .map((w, k) => (from + k === i ? `«${w.word.trim()}»` : w.word.trim()))
    .join(" ");
}

export function analyzeHesitations(
  words: { word: string; start: number; end: number }[],
  durationSec: number,
  uiLang: "fr" | "en",
): HesitationAnalysis {
  const out: Hesitation[] = [];
  if (!words.length) {
    return {
      hesitations: [],
      total: 0,
      perMinute: 0,
      breakdown: { filler: 0, long_pause: 0, repetition: 0 },
    };
  }

  const single = FILLERS_SINGLE[uiLang];
  const multi = FILLERS_MULTI[uiLang];

  // --- Fillers (single-token) + immediate repetitions
  let prevNorm = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const norm = stripPunct(w.word);
    if (!norm) {
      prevNorm = norm;
      continue;
    }
    // Filler
    if (single.test(norm)) {
      out.push({
        type: "filler",
        text: w.word.trim(),
        context: contextAround(words, i),
        wordIndex: i,
        start: w.start,
        end: w.end,
      });
    }
    // Immediate repetition (same word right after) — skip legit reduplications
    // like "très très", "no no" → count only when 2+ letters and same twice+.
    if (norm && norm === prevNorm && norm.length >= 2) {
      // Count consecutive run length ending at i
      let run = 2;
      let j = i - 2;
      while (j >= 0 && stripPunct(words[j].word) === norm) {
        run++;
        j--;
      }
      // Push a repetition event only once per run (at the first duplicate).
      const prev = out[out.length - 1];
      const isSameRun =
        prev?.type === "repetition" && prev.wordIndex === i - 1 && stripPunct(prev.text) === norm;
      if (!isSameRun) {
        out.push({
          type: "repetition",
          text: `${words[i - 1].word.trim()} ${w.word.trim()}`,
          context: contextAround(words, i),
          wordIndex: i,
          start: words[i - 1].start,
          end: w.end,
          extra: { repeatCount: run },
        });
      } else if (prev) {
        prev.end = w.end;
        prev.extra = { repeatCount: run };
      }
    }
    prevNorm = norm;
  }

  // --- Multi-word fillers on joined text (map back to timestamp windows)
  for (const phrase of multi) {
    const parts = phrase.split(/\s+/);
    const n = parts.length;
    for (let i = 0; i <= words.length - n; i++) {
      let ok = true;
      for (let k = 0; k < n; k++) {
        if (stripPunct(words[i + k].word) !== parts[k]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push({
          type: "filler",
          text: phrase,
          context: contextAround(words, i + Math.floor(n / 2)),
          wordIndex: i,
          start: words[i].start,
          end: words[i + n - 1].end,
        });
      }
    }
  }

  // --- Long silent pauses (mid-utterance)
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= LONG_PAUSE_SEC && !STRONG_PUNCT.test(words[i - 1].word)) {
      out.push({
        type: "long_pause",
        text: "···",
        context: `${words[i - 1].word.trim()} ··· ${words[i].word.trim()}`,
        wordIndex: i,
        start: words[i - 1].end,
        end: words[i].start,
        extra: { pauseSec: Math.round(gap * 10) / 10 },
      });
    }
  }

  // Sort chronologically then de-dupe overlapping filler/repetition on same anchor.
  out.sort((a, b) => a.start - b.start);

  const breakdown = { filler: 0, long_pause: 0, repetition: 0 };
  for (const h of out) breakdown[h.type]++;

  const minutes = Math.max(durationSec / 60, 1 / 60);
  return {
    hesitations: out,
    total: out.length,
    perMinute: Math.round((out.length / minutes) * 10) / 10,
    breakdown,
  };
}

/** Merge word-index → hesitation for O(1) lookup in the highlighted transcript. */
export function indexHesitations(h: Hesitation[]): Map<number, Hesitation> {
  const m = new Map<number, Hesitation>();
  for (const x of h) {
    if (x.wordIndex >= 0) m.set(x.wordIndex, x);
  }
  return m;
}
