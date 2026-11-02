// Classification of getUserMedia failures + platform-aware guidance so the UI
// can explain what happened, offer a retry and point to the right settings.

export type MediaKind = "mic" | "camera" | "both";

export type MediaIssue =
  | "denied" // user or system blocked access
  | "notfound" // no device available
  | "inuse" // device busy in another app/tab
  | "insecure" // page is not served over https
  | "unsupported" // browser has no getUserMedia
  | "unknown";

export type MediaPermissionError = {
  kind: MediaKind;
  issue: MediaIssue;
};

export function classifyMediaError(err: unknown, kind: MediaKind): MediaPermissionError {
  if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
    const secure = typeof window === "undefined" || window.isSecureContext;
    return { kind, issue: secure ? "unsupported" : "insecure" };
  }
  const name = (err as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return { kind, issue: "denied" };
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return { kind, issue: "notfound" };
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return { kind, issue: "inuse" };
    default:
      return { kind, issue: "unknown" };
  }
}

export type Platform = "ios" | "android" | "macos" | "windows" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  return "other";
}

/**
 * Browsers forbid navigating to native settings from a web page, except for a
 * few chromium-internal schemes. We return a URL when one exists so the UI can
 * offer a real shortcut, and fall back to written steps otherwise.
 */
export function settingsUrl(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const chromium = /Chrome|Chromium|Edg/.test(ua) && !/OPR/.test(ua);
  if (!chromium) return null;
  return /Edg/.test(ua)
    ? "edge://settings/content/microphone"
    : "chrome://settings/content/microphone";
}

/** Live permission state when the Permissions API supports the query. */
export async function queryPermission(
  kind: "microphone" | "camera",
): Promise<PermissionState | null> {
  try {
    const p = await navigator.permissions?.query({ name: kind as PermissionName });
    return p?.state ?? null;
  } catch {
    return null;
  }
}

type Copy = { title: string; body: string; steps: string[] };

export function permissionCopy(
  { kind, issue }: MediaPermissionError,
  lang: string,
  platform: Platform = detectPlatform(),
): Copy {
  const fr = lang === "fr";
  const device = fr
    ? kind === "mic"
      ? "le microphone"
      : kind === "camera"
        ? "la caméra"
        : "le microphone et la caméra"
    : kind === "mic"
      ? "the microphone"
      : kind === "camera"
        ? "the camera"
        : "the microphone and camera";

  if (issue === "insecure") {
    return {
      title: fr ? "Connexion non sécurisée" : "Insecure connection",
      body: fr
        ? `L'accès à ${device} n'est possible que sur une page en HTTPS.`
        : `Access to ${device} is only possible on an HTTPS page.`,
      steps: [],
    };
  }
  if (issue === "unsupported") {
    return {
      title: fr ? "Navigateur non compatible" : "Browser not supported",
      body: fr
        ? `Ce navigateur ne permet pas d'utiliser ${device}. Essaie Chrome, Safari ou Firefox à jour.`
        : `This browser cannot use ${device}. Try an up-to-date Chrome, Safari or Firefox.`,
      steps: [],
    };
  }
  if (issue === "notfound") {
    return {
      title: fr ? "Aucun appareil détecté" : "No device detected",
      body: fr
        ? `Nous n'avons trouvé aucun appareil pour ${device}. Branche un casque ou une webcam, puis réessaie.`
        : `We couldn't find any device for ${device}. Plug in a headset or webcam, then retry.`,
      steps: [],
    };
  }
  if (issue === "inuse") {
    return {
      title: fr ? "Appareil déjà utilisé" : "Device already in use",
      body: fr
        ? `Une autre application ou un autre onglet utilise ${device}. Ferme-le, puis réessaie.`
        : `Another app or tab is using ${device}. Close it, then retry.`,
      steps: [],
    };
  }
  if (issue === "unknown") {
    return {
      title: fr ? "Accès impossible pour le moment" : "Access failed for now",
      body: fr
        ? `Nous n'avons pas pu accéder à ${device}. Réessaie : c'est souvent temporaire.`
        : `We couldn't access ${device}. Retry — it's often temporary.`,
      steps: [],
    };
  }

  const steps: Record<Platform, string[]> = {
    ios: fr
      ? [
          "Ouvre Réglages › Safari › Microphone (et Caméra) et choisis « Demander » ou « Autoriser ».",
          "Ou touche l'icône « aA » dans la barre d'adresse › Réglages du site web.",
          "Reviens sur ALESIM et appuie sur Réessayer.",
        ]
      : [
          "Open Settings › Safari › Microphone (and Camera) and pick “Ask” or “Allow”.",
          "Or tap the “aA” icon in the address bar › Website Settings.",
          "Come back to ALESIM and tap Retry.",
        ],
    android: fr
      ? [
          "Touche le cadenas à gauche de l'adresse › Autorisations.",
          "Active Microphone (et Caméra), ou va dans Réglages › Applications › Chrome › Autorisations.",
          "Reviens ici et appuie sur Réessayer.",
        ]
      : [
          "Tap the lock icon next to the address › Permissions.",
          "Enable Microphone (and Camera), or go to Settings › Apps › Chrome › Permissions.",
          "Come back here and tap Retry.",
        ],
    macos: fr
      ? [
          "Clique sur le cadenas dans la barre d'adresse et autorise micro/caméra pour ce site.",
          "Puis Réglages Système › Confidentialité et sécurité › Microphone / Caméra : coche ton navigateur.",
          "Recharge la page et clique sur Réessayer.",
        ]
      : [
          "Click the lock icon in the address bar and allow mic/camera for this site.",
          "Then System Settings › Privacy & Security › Microphone / Camera: tick your browser.",
          "Reload the page and click Retry.",
        ],
    windows: fr
      ? [
          "Clique sur l'icône à gauche de l'adresse › Autorisations du site › Microphone / Caméra.",
          "Puis Paramètres Windows › Confidentialité › Microphone / Caméra : autorise ton navigateur.",
          "Recharge la page et clique sur Réessayer.",
        ]
      : [
          "Click the icon left of the address › Site permissions › Microphone / Camera.",
          "Then Windows Settings › Privacy › Microphone / Camera: allow your browser.",
          "Reload the page and click Retry.",
        ],
    other: fr
      ? [
          "Ouvre les autorisations du site dans ton navigateur et autorise micro/caméra.",
          "Vérifie aussi les réglages de confidentialité de ton système.",
          "Reviens ici et clique sur Réessayer.",
        ]
      : [
          "Open the site permissions in your browser and allow mic/camera.",
          "Also check your system privacy settings.",
          "Come back here and click Retry.",
        ],
  };

  return {
    title: fr ? "Autorisation refusée" : "Permission denied",
    body: fr
      ? `ALESIM a besoin de ${device} uniquement pendant l'enregistrement. Rien n'est capté tant que tu n'as pas lancé l'exercice.`
      : `ALESIM needs ${device} only while recording. Nothing is captured until you start the exercise.`,
    steps: steps[platform],
  };
}
