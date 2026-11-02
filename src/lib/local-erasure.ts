/**
 * Effacement des données stockées sur l'appareil (historique vocal, file analytics,
 * reprises d'exercices, journal de consentement).
 */
const LOCAL_KEYS = {
  audio: [
    "alesim.sessions.v1",
    "alesim.pron-history.v1",
    "alesim:resume:pron:v1",
    "alesim:resume:lesson:v1",
    "alesim:resume:confidence:v1",
  ],
  analytics: ["alesim.analytics.queue", "alesim.analytics.anonId"],
  consentLog: ["alesim.audio_consent_log"],
} as const;

const SESSION_KEYS = ["alesim.guest.result", "alesim.guest.prompt", "alesim.analytics.sessionId"];

function removeAll(keys: readonly string[]) {
  let removed = 0;
  for (const key of keys) {
    try {
      if (window.localStorage.getItem(key) !== null) removed++;
      window.localStorage.removeItem(key);
    } catch {
      /* stockage indisponible */
    }
  }
  return removed;
}

export function eraseLocalAudioData() {
  if (typeof window === "undefined") return 0;
  let removed = removeAll(LOCAL_KEYS.audio);
  for (const key of SESSION_KEYS) {
    try {
      if (window.sessionStorage.getItem(key) !== null) removed++;
      window.sessionStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
  return removed;
}

export function eraseLocalAnalyticsData() {
  if (typeof window === "undefined") return 0;
  return removeAll(LOCAL_KEYS.analytics);
}

export function eraseLocalConsentLog() {
  if (typeof window === "undefined") return 0;
  return removeAll(LOCAL_KEYS.consentLog);
}
