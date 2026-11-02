/** Consentement cookies — stockage local, aucun traceur non essentiel avant acceptation. */

export type CookieConsent = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  date: string; // ISO
  version: number;
};

export const CONSENT_VERSION = 1;
const KEY = "alesim_cookie_consent";
/** Le consentement expire au bout de 6 mois (recommandation CNIL). */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 183;
export const CONSENT_EVENT = "alesim:cookie-consent";

export function readConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (Date.now() - new Date(parsed.date).getTime() > MAX_AGE_MS) return null;
    return { ...parsed, necessary: true };
  } catch {
    return null;
  }
}

export function saveConsent(choice: { preferences: boolean; analytics: boolean }): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    preferences: choice.preferences,
    analytics: choice.analytics,
    date: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(consent));
  } catch {
    /* stockage indisponible */
  }
  if (!consent.analytics) clearAnalyticsCookies();
  window.dispatchEvent(new CustomEvent<CookieConsent>(CONSENT_EVENT, { detail: consent }));
  return consent;
}

export function resetConsent() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
  clearAnalyticsCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

export function hasAnalyticsConsent() {
  return readConsent()?.analytics === true;
}

/** Supprime les cookies de mesure d'audience éventuellement déposés (_ga, _gid, Firebase). */
export function clearAnalyticsCookies() {
  if (typeof document === "undefined") return;
  const patterns = [/^_ga/, /^_gid$/, /^_gat/, /^_fb/, /^firebase/i, /^amp_/];
  for (const raw of document.cookie.split(";")) {
    const name = raw.split("=")[0]?.trim();
    if (!name || !patterns.some((p) => p.test(name))) continue;
    const host = window.location.hostname;
    const domains = [host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
    }
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
}

/** Ouvre le panneau de personnalisation depuis n'importe où (footer, profil). */
export const OPEN_PREFS_EVENT = "alesim:open-cookie-prefs";
export function openCookiePreferences() {
  window.dispatchEvent(new CustomEvent(OPEN_PREFS_EVENT));
}
