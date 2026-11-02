// Tracks in-progress exercises/quizzes so the user can resume where they left off.

export type PronResume = {
  lang: string;
  level: "beginner" | "intermediate" | "advanced";
  index: number;
  savedAt: number;
};

export type LessonResume = {
  lessonId: string;
  focus?: "confidence" | "pace" | "pronunciation" | null;
  phase: "recording" | "quiz";
  savedAt: number;
};

export type ConfidenceKind = "breathing" | "articulation" | "guided";
export type ConfidenceResume = {
  slug: string;
  kind: ConfidenceKind;
  level: "beginner" | "intermediate" | "advanced";
  focus?: "confidence" | "pace" | "pronunciation" | null;
  title: string;
  savedAt: number;
};

const PRON_KEY = "alesim:resume:pron:v1";
const LESSON_KEY = "alesim:resume:lesson:v1";
const CONFIDENCE_KEY = "alesim:resume:confidence:v1";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
function clear(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export const getPronResume = () => read<PronResume>(PRON_KEY);
export const setPronResume = (r: PronResume) => write(PRON_KEY, r);
export const clearPronResume = () => clear(PRON_KEY);

export const getLessonResume = () => read<LessonResume>(LESSON_KEY);
export const setLessonResume = (r: LessonResume) => write(LESSON_KEY, r);
export const clearLessonResume = () => clear(LESSON_KEY);

export const getConfidenceResume = () => read<ConfidenceResume>(CONFIDENCE_KEY);
export const setConfidenceResume = (r: ConfidenceResume) => write(CONFIDENCE_KEY, r);
export const clearConfidenceResume = () => clear(CONFIDENCE_KEY);
