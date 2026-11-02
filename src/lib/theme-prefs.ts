const KEY = "alesim:theme-prefs:v1";
const TS_KEY = "alesim:theme-prefs-ts:v1";

export type ThemePref = "priority" | "neutral" | "avoid";
export type ThemePrefs = Record<string, ThemePref>;
export type ThemePrefsTs = Record<string, string>; // theme -> ISO timestamp

export function getThemePrefs(): ThemePrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ThemePrefs;
  } catch {
    return {};
  }
}

export function setThemePrefs(prefs: ThemePrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function getThemePrefsTs(): ThemePrefsTs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TS_KEY);
    return raw ? (JSON.parse(raw) as ThemePrefsTs) : {};
  } catch {
    return {};
  }
}

export function setThemePrefsTs(ts: ThemePrefsTs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TS_KEY, JSON.stringify(ts));
}

/**
 * Per-theme last-write-wins merge. For each theme present on either side,
 * keep the value whose timestamp is newest. Missing timestamps count as epoch 0.
 */
export function mergePrefs(
  a: ThemePrefs,
  aTs: ThemePrefsTs,
  b: ThemePrefs,
  bTs: ThemePrefsTs,
): { prefs: ThemePrefs; ts: ThemePrefsTs } {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const prefs: ThemePrefs = {};
  const ts: ThemePrefsTs = {};
  for (const k of keys) {
    const ta = Date.parse(aTs[k] ?? "") || 0;
    const tb = Date.parse(bTs[k] ?? "") || 0;
    if (tb > ta) {
      if (b[k]) prefs[k] = b[k];
      if (bTs[k]) ts[k] = bTs[k];
    } else {
      if (a[k]) prefs[k] = a[k];
      if (aTs[k]) ts[k] = aTs[k];
    }
  }
  return { prefs, ts };
}

export function prefWeight(p: ThemePref | undefined): number {
  if (p === "priority") return 1;
  if (p === "avoid") return -1;
  return 0;
}
