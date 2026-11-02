import type { PracticeLang } from "./language-content";

export type UiLang = "fr" | "en";

const UI_LOCALES: Record<UiLang, string> = {
  fr: "fr-FR",
  en: "en-US",
};

const PRACTICE_LOCALES: Record<PracticeLang, string> = {
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
};

/** BCP-47 locale for the language currently displayed in the UI (?hl). */
export function uiLocale(lang: UiLang): string {
  return UI_LOCALES[lang] ?? UI_LOCALES.fr;
}

/** BCP-47 locale for a foreign-language practice target. */
export function practiceLocale(lang: PracticeLang): string {
  return PRACTICE_LOCALES[lang] ?? "en-US";
}

/** Short display label, e.g. "FR" / "EN". */
export function localeLabel(locale: string): string {
  return locale.slice(0, 2).toUpperCase();
}

/** Pick the installed voice that best matches a locale (exact, then language). */
export function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const norm = locale.toLowerCase().replace("_", "-");
  const base = norm.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase().replace("_", "-") === norm) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base + "-")) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
}

/** Speak text with a voice matching the given locale. Returns false if unsupported. */
export function speakInLocale(text: string, locale: string, rate = 0.95): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  u.rate = rate;
  const voice = pickVoice(locale);
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}
