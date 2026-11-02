// Mode invité : tout est conservé côté client (sessionStorage) le temps de la session.
// Aucune donnée n'est envoyée ni persistée côté serveur avant création de compte (RGPD).
import type { FeedbackResult, TranscribedWord } from "./alesim.functions";

export type GuestResult = {
  transcript: string;
  durationSec: number;
  feedback: FeedbackResult;
  words?: TranscribedWord[];
  prompt?: string;
  createdAt: number;
};

const K_RESULT = "alesim.guest.result";
const K_PROMPT = "alesim.guest.prompt";
const K_COUNT = "alesim.guest.count";
const K_NOACCOUNT = "alesim.guest.noAccount";

const ss = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function saveGuestPrompt(prompt?: string) {
  const s = ss();
  if (!s) return;
  if (prompt) s.setItem(K_PROMPT, prompt);
  else s.removeItem(K_PROMPT);
}

export function loadGuestPrompt(): string | undefined {
  return ss()?.getItem(K_PROMPT) ?? undefined;
}

export function saveGuestResult(r: GuestResult) {
  const s = ss();
  if (!s) return;
  try {
    // L'audio (blob URL) n'est pas sérialisable : on ne garde que l'analyse.
    s.setItem(K_RESULT, JSON.stringify(r));
  } catch {
    /* quota : on ignore, le résultat reste affiché en mémoire */
  }
}

export function loadGuestResult(): GuestResult | null {
  const raw = ss()?.getItem(K_RESULT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestResult;
  } catch {
    return null;
  }
}

export function clearGuestSession() {
  const s = ss();
  if (!s) return;
  [K_RESULT, K_PROMPT, K_COUNT, K_NOACCOUNT].forEach((k) => s.removeItem(k));
}

export function guestRecordingCount(): number {
  return Number(ss()?.getItem(K_COUNT) ?? "0") || 0;
}

export function incrementGuestRecordings(): number {
  const s = ss();
  const next = guestRecordingCount() + 1;
  s?.setItem(K_COUNT, String(next));
  return next;
}

/** L'utilisateur a explicitement choisi « Continuer sans compte ». */
export function setContinueWithoutAccount() {
  ss()?.setItem(K_NOACCOUNT, "1");
}

export function hasContinuedWithoutAccount(): boolean {
  return ss()?.getItem(K_NOACCOUNT) === "1";
}
