import type { PracticeLang, Level } from "./language-content";

const KEY = "alesim.lang-progress";

type State = Record<string, { completed: number[]; unlockedLevels: Level[] }>;
// key = `${lang}:${level}`

function read(): State {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as State;
  } catch {
    return {};
  }
}
function write(s: State) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

const LEVEL_ORDER: Level[] = ["beginner", "intermediate", "advanced"];

export function getProgress(lang: PracticeLang, level: Level) {
  const s = read();
  const key = `${lang}:${level}`;
  return s[key] ?? { completed: [], unlockedLevels: ["beginner" as Level] };
}

export function isLevelUnlocked(lang: PracticeLang, level: Level, total = 5): boolean {
  if (level === "beginner") return true;
  const idx = LEVEL_ORDER.indexOf(level);
  const prev = LEVEL_ORDER[idx - 1];
  const prog = getProgress(lang, prev);
  return prog.completed.length >= total;
}

export function markCompleted(lang: PracticeLang, level: Level, index: number) {
  const s = read();
  const key = `${lang}:${level}`;
  const cur = s[key] ?? { completed: [], unlockedLevels: ["beginner" as Level] };
  if (!cur.completed.includes(index)) cur.completed = [...cur.completed, index];
  s[key] = cur;
  write(s);
}

export function resetLanguage(lang: PracticeLang) {
  const s = read();
  for (const l of LEVEL_ORDER) delete s[`${lang}:${l}`];
  write(s);
}

export function totalXP(lang: PracticeLang): number {
  const weights: Record<Level, number> = { beginner: 10, intermediate: 20, advanced: 30 };
  let xp = 0;
  for (const l of LEVEL_ORDER) {
    xp += getProgress(lang, l).completed.length * weights[l];
  }
  return xp;
}
