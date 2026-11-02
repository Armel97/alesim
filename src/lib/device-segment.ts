/**
 * Segmentation analytics par appareil et systeme.
 *
 * RGPD : aucune empreinte (fingerprint). On derive uniquement une categorie
 * grossiere (ios / android / desktop / other) et un format (mobile / tablette /
 * desktop) a partir du user-agent, sans stocker le user-agent lui-meme.
 */
export const DEVICE_SEGMENTS = ["ios", "android", "desktop", "other"] as const;
export type DeviceSegment = (typeof DEVICE_SEGMENTS)[number];

export const FORM_FACTORS = ["mobile", "tablet", "desktop"] as const;
export type FormFactor = (typeof FORM_FACTORS)[number];

export const SEGMENT_LABELS: Record<DeviceSegment | "unknown", { fr: string; en: string }> = {
  ios: { fr: "iOS", en: "iOS" },
  android: { fr: "Android", en: "Android" },
  desktop: { fr: "Ordinateur", en: "Desktop" },
  other: { fr: "Autre", en: "Other" },
  unknown: { fr: "Non renseigné", en: "Unknown" },
};

export const FORM_FACTOR_LABELS: Record<FormFactor | "unknown", { fr: string; en: string }> = {
  mobile: { fr: "Mobile", en: "Mobile" },
  tablet: { fr: "Tablette", en: "Tablet" },
  desktop: { fr: "Ordinateur", en: "Desktop" },
  unknown: { fr: "Non renseigné", en: "Unknown" },
};

export function isDeviceSegment(v: unknown): v is DeviceSegment {
  return typeof v === "string" && (DEVICE_SEGMENTS as readonly string[]).includes(v);
}

export function isFormFactor(v: unknown): v is FormFactor {
  return typeof v === "string" && (FORM_FACTORS as readonly string[]).includes(v);
}

/** Detecte l'OS a partir d'un user-agent (et du nombre de points tactiles pour iPadOS). */
export function detectSegment(ua: string, maxTouchPoints = 0, platform = ""): DeviceSegment {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  // iPadOS 13+ s'annonce comme un Mac : on le distingue via le tactile.
  if (/macintosh/.test(s) && maxTouchPoints >= 1) return "ios"; // aucun Mac n'est tactile
  if (/android/.test(s)) return "android";
  if (/windows|macintosh|mac os x|cros|linux/.test(s) && !/mobile/.test(s)) return "desktop";
  if (/windows|mac/.test(platform.toLowerCase())) return "desktop";
  return "other";
}

/** Distingue mobile / tablette / desktop. */
export function detectFormFactor(ua: string, maxTouchPoints = 0, width = 0): FormFactor {
  const s = ua.toLowerCase();
  if (/ipad/.test(s) || (/macintosh/.test(s) && maxTouchPoints >= 1)) return "tablet";
  if (/tablet|playbook|silk/.test(s) || (/android/.test(s) && !/mobile/.test(s))) return "tablet";
  if (/mobi|iphone|ipod|windows phone/.test(s)) return "mobile";
  if (width > 0 && width < 640 && maxTouchPoints > 0) return "mobile";
  return "desktop";
}

/** Contexte appareil courant, cote navigateur uniquement. */
export function currentDeviceContext(): { device: DeviceSegment; form_factor: FormFactor } {
  if (typeof navigator === "undefined") return { device: "other", form_factor: "desktop" };
  const ua = navigator.userAgent || "";
  const touch = navigator.maxTouchPoints ?? 0;
  const width = typeof window !== "undefined" ? window.screen?.width || window.innerWidth || 0 : 0;
  return {
    device: detectSegment(ua, touch, (navigator as { platform?: string }).platform ?? ""),
    form_factor: detectFormFactor(ua, touch, width),
  };
}
