/**
 * Consentement RGPD explicite avant toute capture/traitement audio (et audio+vidéo).
 *
 * - Aucune capture micro ne démarre tant que l'utilisateur n'a pas donné un
 *   consentement explicite, libre, éclairé et univoque (art. 4-11 & 7 RGPD).
 * - Le consentement est stocké localement (aucun envoi serveur) et expire au
 *   bout de 12 mois.
 * - Chaque décision et chaque capture est journalisée côté client (preuve du
 *   consentement, art. 7.1) et exportable/effaçable par l'utilisateur.
 */

export const AUDIO_CONSENT_VERSION = 1;
const KEY = "alesim.audio_consent";
const LOG_KEY = "alesim.audio_consent_log";
const LOG_MAX = 200;
/** Le consentement est redemandé au bout de 12 mois. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

export const AUDIO_CONSENT_EVENT = "alesim:audio-consent";

export type AudioConsentDecision = "granted" | "refused";

export type AudioConsentRecord = {
  decision: AudioConsentDecision;
  date: string; // ISO
  version: number;
  /** Finalités acceptées, figées au moment du choix. */
  purposes: string[];
};

export type AudioConsentAction =
  | "granted"
  | "refused"
  | "revoked"
  | "expired"
  | "capture_started"
  | "capture_blocked"
  | "prompt_shown";

export type AudioConsentLogEntry = {
  at: string; // ISO
  action: AudioConsentAction;
  /** Module concerné : recorder, practice, interview, video, onboarding… */
  context: string;
  version: number;
};

export const AUDIO_CONSENT_PURPOSES = [
  "mic_capture",
  "speech_to_text",
  "ai_feedback",
  "local_history",
] as const;

export class AudioConsentDeniedError extends Error {
  constructor() {
    super("Audio consent refused");
    this.name = "AudioConsentDeniedError";
  }
}

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAudioConsent(): AudioConsentRecord | null {
  const store = safeLocal();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AudioConsentRecord;
    if (parsed.version !== AUDIO_CONSENT_VERSION) return null;
    if (Date.now() - new Date(parsed.date).getTime() > MAX_AGE_MS) {
      store.removeItem(KEY);
      logAudioConsent("expired", "auto");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasAudioConsent(): boolean {
  return readAudioConsent()?.decision === "granted";
}

function emit(record: AudioConsentRecord | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AudioConsentRecord | null>(AUDIO_CONSENT_EVENT, { detail: record }),
  );
}

export function setAudioConsent(
  decision: AudioConsentDecision,
  context = "unknown",
): AudioConsentRecord {
  const record: AudioConsentRecord = {
    decision,
    date: new Date().toISOString(),
    version: AUDIO_CONSENT_VERSION,
    purposes: decision === "granted" ? [...AUDIO_CONSENT_PURPOSES] : [],
  };
  try {
    safeLocal()?.setItem(KEY, JSON.stringify(record));
  } catch {
    /* stockage indisponible : le consentement vaut pour la session en cours */
  }
  logAudioConsent(decision, context);
  emit(record);
  return record;
}

/** Retrait du consentement, aussi simple que son octroi (art. 7.3 RGPD). */
export function revokeAudioConsent(context = "settings") {
  try {
    safeLocal()?.removeItem(KEY);
  } catch {
    /* noop */
  }
  logAudioConsent("revoked", context);
  emit(null);
}

/* ------------------------------- Journal ------------------------------- */

export function readAudioConsentLog(): AudioConsentLogEntry[] {
  const store = safeLocal();
  if (!store) return [];
  try {
    const raw = store.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AudioConsentLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function logAudioConsent(action: AudioConsentAction, context = "unknown") {
  const store = safeLocal();
  if (!store) return;
  const entry: AudioConsentLogEntry = {
    at: new Date().toISOString(),
    action,
    context,
    version: AUDIO_CONSENT_VERSION,
  };
  try {
    const next = [...readAudioConsentLog(), entry].slice(-LOG_MAX);
    store.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function clearAudioConsentLog() {
  try {
    safeLocal()?.removeItem(LOG_KEY);
  } catch {
    /* noop */
  }
}

/** Export du journal (portabilité, art. 20 RGPD). */
export function downloadAudioConsentLog(filename = "alesim-consentement-audio.json") {
  const payload = {
    exportedAt: new Date().toISOString(),
    consent: readAudioConsent(),
    log: readAudioConsentLog(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* --------------------------- Demande interactive --------------------------- */

type ConsentPrompt = (context: string) => Promise<boolean>;
let prompt: ConsentPrompt | null = null;

/** Enregistre la boîte de dialogue globale (montée dans __root). */
export function registerAudioConsentPrompt(fn: ConsentPrompt | null) {
  prompt = fn;
}

/**
 * À appeler AVANT tout getUserMedia. Renvoie false si l'utilisateur refuse :
 * l'appelant doit alors proposer une alternative sans micro.
 */
export async function requestAudioConsent(context = "unknown"): Promise<boolean> {
  if (hasAudioConsent()) return true;
  if (readAudioConsent()?.decision === "refused") {
    // Refus déjà exprimé : on redemande explicitement (choix toujours réversible).
    if (!prompt) {
      logAudioConsent("capture_blocked", context);
      return false;
    }
  }
  if (!prompt) {
    logAudioConsent("capture_blocked", context);
    return false;
  }
  logAudioConsent("prompt_shown", context);
  const ok = await prompt(context);
  if (!ok) logAudioConsent("capture_blocked", context);
  return ok;
}
